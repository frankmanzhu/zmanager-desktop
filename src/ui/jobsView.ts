import type { MessageKey, Translator } from "../app/i18n/translator";

export type JobOutputAction = {
  kind: "open" | "reveal";
  path: string;
};

export type JobsViewJobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type JobsViewProgress = {
  remainingMs: number | null;
  processedFiles: number;
  totalFiles: number | null;
  totalBytes: number | null;
  processedBytes: number;
  speedBytesPerSecond: number | null;
  currentFile: string;
  progressPercent: number | null;
  latestStatusMessage: string;
};

export type JobsViewTerminalSummary = {
  writtenEntries: number;
  skippedEntries?: number | null;
  writtenBytes: number;
  warnings: readonly unknown[];
};

export type JobsViewEvent = {
  eventType: string;
  message?: string;
  path?: string;
};

export type JobsViewItem = {
  jobId: string;
  kind: string;
  status: JobsViewJobStatus;
  canDismiss: boolean;
  events: readonly JobsViewEvent[];
  terminalSummary?: JobsViewTerminalSummary | null;
  progress: JobsViewProgress;
  isTerminal: boolean;
  completedSizeLabelKey: MessageKey;
  canRetryPassword: boolean;
  readyOutputActions: readonly JobOutputAction[];
};

export type JobsViewFormatters = {
  i18n: Translator;
  escapeHtml: (value: string) => string;
  formatBytes: (value?: number) => string;
  formatJobKind: (kind: string) => string;
  formatDuration?: (milliseconds: number | null) => string;
};

export function activeJobStatusText(
  activeJob: Pick<JobsViewItem, "kind" | "status"> | null,
  formatJobKind: (kind: string) => string,
  i18n: Translator,
): string {
  if (!activeJob) {
    return i18n.t("status.noJobs");
  }

  return `${formatJobKind(activeJob.kind)}: ${i18n.t(jobStatusKey(activeJob.status))}`;
}

export function renderJobsListHtml(jobs: readonly JobsViewItem[], formatters: JobsViewFormatters): string {
  const { i18n } = formatters;
  if (!jobs.length) {
    return `
      <div class="job-empty">
        <strong>${formatters.escapeHtml(i18n.t("jobs.empty.title"))}</strong>
        <span>${formatters.escapeHtml(i18n.t("jobs.empty.description"))}</span>
      </div>
    `;
  }

  return jobs
    .map((job) => {
      const summary = job.terminalSummary;
      const outputActions = job.status === "completed" ? job.readyOutputActions : [];
      const progress = job.progress;
      const formatDuration = formatters.formatDuration ?? defaultFormatDuration;
      const filesText = progress.totalFiles === null
        ? String(progress.processedFiles)
        : `${progress.processedFiles} / ${progress.totalFiles}`;
      const progressValue = progress.progressPercent ?? 0;
      const progressAttributes = progress.progressPercent === null && !job.isTerminal
        ? ""
        : `value="${progressValue.toFixed(0)}" max="100"`;
      const statusLabel = i18n.t(jobStatusKey(job.status));
      const failedEvent = latestFailedEvent(job);
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
        <article class="job-card" data-job-status="${formatters.escapeHtml(job.status)}">
          <div class="job-header">
            <div class="job-heading">
              <p class="job-title">${formatters.escapeHtml(formatters.formatJobKind(job.kind))}</p>
              <p class="job-subtitle">${formatters.escapeHtml(job.jobId)}</p>
            </div>
            <span class="job-status-pill">${formatters.escapeHtml(statusLabel)}</span>
          </div>
          ${renderJobBody(job, {
            currentItem,
            failedItem,
            failedMessage,
            filesText,
            formatters,
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
  currentItem: string;
  failedItem?: string;
  failedMessage: string;
  filesText: string;
  formatters: JobsViewFormatters;
  outputActions: readonly JobOutputAction[];
  progressAttributes: string;
  processedText: string;
  remainingText: string;
  speedText: string;
  summary?: JobsViewTerminalSummary | null;
};

function renderJobBody(job: JobsViewItem, options: RenderJobBodyOptions): string {
  const { i18n } = options.formatters;
  const jobId = options.formatters.escapeHtml(job.jobId);

  if (job.status === "failed") {
    return `
      <div class="job-message job-message-error">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.failed.title", { kind: options.formatters.formatJobKind(job.kind) }))}</strong>
        <span>${options.formatters.escapeHtml(options.failedMessage)}</span>
        ${options.failedItem
          ? `<small>${options.formatters.escapeHtml(i18n.t("jobs.failed.item"))} ${options.formatters.escapeHtml(options.failedItem)}</small>`
          : ""
        }
      </div>
      <div class="job-actions">
        ${job.canRetryPassword ? `<button type="button" data-retry-password="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.retryPassword"))}</button>` : ""}
        ${job.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
      </div>
    `;
  }

  if (job.status === "completed") {
    return `
      <div class="job-completion">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.completed.title"))}</strong>
        ${renderJobSummary(job, options)}
      </div>
      ${renderOutputActions(jobId, options)}
      <div class="job-actions">
        ${job.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
      </div>
      <progress
        aria-label="${options.formatters.escapeHtml(i18n.t("jobs.progress.aria"))}"
        ${options.progressAttributes}
      ></progress>
    `;
  }

  if (job.status === "cancelled") {
    return `
      <div class="job-message">
        <strong>${options.formatters.escapeHtml(i18n.t("jobs.cancelled.title"))}</strong>
        <span>${options.formatters.escapeHtml(options.currentItem)}</span>
      </div>
      <div class="job-actions">
        ${job.canDismiss ? `<button type="button" data-dismiss="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
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
      ${job.status === "running" ? `<button type="button" data-pause="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.pause"))}</button>` : ""}
      ${job.status === "paused" ? `<button type="button" data-resume="${jobId}">${options.formatters.escapeHtml(i18n.t("common.continue"))}</button>` : ""}
      ${job.status === "queued" || job.status === "running" || job.status === "paused"
        ? `<button type="button" data-cancel="${jobId}">${options.formatters.escapeHtml(i18n.t("jobs.action.cancel"))}</button>`
        : ""
      }
    </div>
  `;
}

function renderJobSummary(job: JobsViewItem, options: RenderJobBodyOptions): string {
  const { i18n } = options.formatters;
  const summary = options.summary;

  if (!summary) {
    return `<p>${options.formatters.escapeHtml(i18n.t("jobs.summary.empty"))}</p>`;
  }

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
    <p class="job-output-size">${options.formatters.escapeHtml(i18n.t(job.completedSizeLabelKey))}</p>
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

function latestFailedEvent(job: JobsViewItem): JobsViewEvent | null {
  for (let index = job.events.length - 1; index >= 0; index -= 1) {
    const event = job.events[index];
    if (event.eventType === "failed") {
      return event;
    }
  }

  return null;
}

function jobStatusKey(status: JobsViewJobStatus): MessageKey {
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
