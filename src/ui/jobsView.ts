import type { JobKind, JobState } from "../api/types";
import { deriveJobProgress, isCreateJobKind, isTerminalJobStatus } from "../app/jobs";
import type { MessageKey, Translator } from "../app/i18n/translator";

export type JobOutputAction = {
  kind: "open" | "reveal";
  path: string;
};

export type JobsViewFormatters = {
  i18n: Translator;
  escapeHtml: (value: string) => string;
  formatBytes: (value?: number) => string;
  formatJobKind: (kind: JobKind) => string;
  canRetryJobWithPassword: (jobId: string, state: JobState) => boolean;
  getOutputActions?: (jobId: string, state: JobState) => JobOutputAction[];
  formatDuration?: (milliseconds: number | null) => string;
};

export function sortedJobStates(jobs: Map<string, JobState>): JobState[] {
  return Array.from(jobs.values()).sort((a, b) =>
    b.snapshot.createdAt.localeCompare(a.snapshot.createdAt),
  );
}

export function activeJobStatusText(
  jobs: Map<string, JobState>,
  formatJobKind: (kind: JobKind) => string,
  i18n: Translator,
): string {
  const active = sortedJobStates(jobs).find((state) =>
    state.snapshot.status === "queued" || state.snapshot.status === "running" || state.snapshot.status === "paused",
  ) ?? sortedJobStates(jobs)[0];

  if (!active) {
    return i18n.t("status.noJobs");
  }

  return `${formatJobKind(active.snapshot.kind)}: ${i18n.t(jobStatusKey(active.snapshot.status))}`;
}

export function renderJobsListHtml(jobs: Map<string, JobState>, formatters: JobsViewFormatters): string {
  const { i18n } = formatters;
  if (!jobs.size) {
    return `
      <div class="job-empty">
        <strong>${formatters.escapeHtml(i18n.t("jobs.empty.title"))}</strong>
        <span>${formatters.escapeHtml(i18n.t("jobs.empty.description"))}</span>
      </div>
    `;
  }

  return sortedJobStates(jobs)
    .map((state) => {
      const snapshot = state.snapshot;
      const summary = snapshot.terminalSummary;
      const canRetryPassword = formatters.canRetryJobWithPassword(snapshot.jobId, state);
      const outputActions = snapshot.status === "completed"
        ? formatters.getOutputActions?.(snapshot.jobId, state) ?? []
        : [];
      const progress = deriveJobProgress(state);
      const formatDuration = formatters.formatDuration ?? defaultFormatDuration;
      const filesText = progress.totalFiles === null
        ? String(progress.processedFiles)
        : `${progress.processedFiles} / ${progress.totalFiles}`;
      const progressValue = progress.progressPercent ?? 0;
      const progressAttributes = progress.progressPercent === null && !isTerminalJobStatus(snapshot.status)
        ? ""
        : `value="${progressValue.toFixed(0)}" max="100"`;
      const statusLabel = i18n.t(jobStatusKey(snapshot.status));
      const failedEvent = latestFailedEvent(state);
      const failedMessage = failedEvent?.message ?? progress.latestStatusMessage;
      const failedItem = failedEvent?.path ?? progress.currentFile;
      const currentItem = progress.currentFile || i18n.t("jobs.current.none");
      const speedText = progress.speedBytesPerSecond === null
        ? i18n.t("jobs.metric.notAvailable")
        : `${formatters.formatBytes(progress.speedBytesPerSecond)}/s`;
      const remainingText = formatDuration(progress.remainingMs) || i18n.t("jobs.metric.notAvailable");
      const processedText = progress.totalBytes === null
        ? formatters.formatBytes(progress.processedBytes)
        : `${formatters.formatBytes(progress.processedBytes)} / ${formatters.formatBytes(progress.totalBytes)}`;
      return `
        <article class="job-card" data-job-status="${formatters.escapeHtml(snapshot.status)}">
          <div class="job-header">
            <div class="job-heading">
              <p class="job-title">${formatters.escapeHtml(formatters.formatJobKind(snapshot.kind))}</p>
              <p class="job-subtitle">${formatters.escapeHtml(snapshot.jobId)}</p>
            </div>
            <span class="job-status-pill">${formatters.escapeHtml(statusLabel)}</span>
          </div>
          ${renderJobBody(state, {
            canRetryPassword,
            currentItem,
            failedItem,
            failedMessage,
            filesText,
            formatters,
            kind: snapshot.kind,
            outputActions,
            progressAttributes,
            processedText,
            remainingText,
            speedText,
            summary,
          })}
        </article>
      `;
    })
    .join("");
}

type RenderJobBodyOptions = {
  canRetryPassword: boolean;
  currentItem: string;
  failedItem?: string;
  failedMessage: string;
  filesText: string;
  formatters: JobsViewFormatters;
  kind: JobKind;
  outputActions: JobOutputAction[];
  progressAttributes: string;
  processedText: string;
  remainingText: string;
  speedText: string;
  summary: JobState["snapshot"]["terminalSummary"];
};

function renderJobBody(state: JobState, options: RenderJobBodyOptions): string {
  const { i18n } = options.formatters;
  const snapshot = state.snapshot;
  const jobId = options.formatters.escapeHtml(snapshot.jobId);

  if (snapshot.status === "failed") {
    return `
      <div class="job-message job-message-error">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.failed.title", { kind: options.formatters.formatJobKind(snapshot.kind) }))}</strong>
        <span>${options.formatters.escapeHtml(options.failedMessage)}</span>
        ${options.failedItem
          ? `<small>${options.formatters.escapeHtml(i18n.t("jobs.failed.item"))} ${options.formatters.escapeHtml(options.failedItem)}</small>`
          : ""
        }
      </div>
      <div class="job-actions">
        ${options.canRetryPassword ? `<button type="button" data-retry-password="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.retryPassword"))}</button>` : ""}
        ${snapshot.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
      </div>
    `;
  }

  if (snapshot.status === "completed") {
    return `
      <div class="job-completion">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.completed.title"))}</strong>
        ${renderJobSummary(options)}
      </div>
      ${renderOutputActions(jobId, options)}
      <div class="job-actions">
        ${snapshot.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
      </div>
      <progress
        aria-label="${options.formatters.escapeHtml(i18n.t("jobs.progress.aria"))}"
        ${options.progressAttributes}
      ></progress>
    `;
  }

  if (snapshot.status === "cancelled") {
    return `
      <div class="job-message">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.cancelled.title"))}</strong>
        <span>${options.formatters.escapeHtml(options.currentItem)}</span>
      </div>
      <div class="job-actions">
        ${snapshot.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
      </div>
      <progress
        aria-label="${options.formatters.escapeHtml(i18n.t("jobs.progress.aria"))}"
        ${options.progressAttributes}
      ></progress>
    `;
  }

  return `
    <div class="job-current">
      <span>${options.formatters.escapeHtml(i18n.t("jobs.current.label"))}</span>
      <strong>${options.formatters.escapeHtml(options.currentItem)}</strong>
    </div>
    <progress
      aria-label="${options.formatters.escapeHtml(i18n.t("jobs.progress.aria"))}"
      ${options.progressAttributes}
    ></progress>
    <div class="job-facts" aria-label="${options.formatters.escapeHtml(i18n.t("jobs.metrics.aria"))}">
      <span><strong>${options.formatters.escapeHtml(options.filesText)}</strong> ${options.formatters.escapeHtml(i18n.t("jobs.metric.files"))}</span>
      <span><strong>${options.formatters.escapeHtml(options.speedText)}</strong> ${options.formatters.escapeHtml(i18n.t("jobs.metric.speed"))}</span>
      <span><strong>${options.formatters.escapeHtml(options.remainingText)}</strong> ${options.formatters.escapeHtml(i18n.t("jobs.metric.remainingTime"))}</span>
      <span><strong>${options.formatters.escapeHtml(options.processedText)}</strong> ${options.formatters.escapeHtml(i18n.t("jobs.metric.processed"))}</span>
    </div>
    <div class="job-actions">
      ${snapshot.status === "running" ? `<button type="button" data-pause="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.pause"))}</button>` : ""}
      ${snapshot.status === "paused" ? `<button type="button" data-resume="${jobId}">${options.formatters.escapeHtml(i18n.t("common.continue"))}</button>` : ""}
      ${snapshot.status === "queued" || snapshot.status === "running" || snapshot.status === "paused"
        ? `<button type="button" data-cancel="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.cancel"))}</button>`
        : ""
      }
    </div>
  `;
}

function renderJobSummary(options: RenderJobBodyOptions): string {
  const { i18n } = options.formatters;
  const summary = options.summary;

  if (!summary) {
    return `<p>${options.formatters.escapeHtml(i18n.t("jobs.summary.empty"))}</p>`;
  }

  const sizeLabelKey = isCreateJobKind(options.kind)
    ? "jobs.summary.archiveSize"
    : "jobs.summary.outputSize";

  return `
    <p>${options.formatters.escapeHtml(i18n.t("jobs.summary.entries", {
      count: summary.writtenEntries,
      size: options.formatters.formatBytes(summary.writtenBytes),
    }))}</p>
    ${
      typeof summary.skippedEntries === "number"
        ? `<p>${options.formatters.escapeHtml(i18n.t("jobs.summary.skippedCount", { count: summary.skippedEntries }))}</p>`
        : ""
    }
    ${
      summary.warnings.length
        ? `<p>${options.formatters.escapeHtml(i18n.t("jobs.summary.warningCount", { count: summary.warnings.length }))}</p>`
        : ""
    }
    <p class="job-output-size">${options.formatters.escapeHtml(i18n.t(sizeLabelKey))}</p>
  `;
}

function renderOutputActions(jobId: string, options: RenderJobBodyOptions): string {
  if (!options.outputActions.length) {
    return "";
  }

  return `
    <div class="job-output-actions">
      ${options.outputActions.map((action, index) => {
        const labelKey = action.kind === "open" ? "jobs.action.openOutput" : "jobs.action.revealOutput";
        return `<button type="button" data-output-action="${options.formatters.escapeHtml(action.kind)}" data-output-job="${jobId}" data-output-index="${index}">${options.formatters.escapeHtml(options.formatters.i18n.t(labelKey))}</button>`;
      }).join("")}
    </div>
  `;
}

function latestFailedEvent(state: JobState) {
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];
    if (event.eventType === "failed") {
      return event;
    }
  }

  return null;
}

function jobStatusKey(status: JobState["snapshot"]["status"]): MessageKey {
  switch (status) {
    case "queued":
      return "jobs.status.queued";
    case "running":
      return "jobs.status.running";
    case "paused":
      return "jobs.status.paused";
    case "completed":
      return "jobs.status.completed";
    case "failed":
      return "jobs.status.failed";
    case "cancelled":
      return "jobs.status.cancelled";
  }
}

function defaultFormatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
