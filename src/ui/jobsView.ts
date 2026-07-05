import type { JobKind, JobState } from "../api/types";
import { deriveJobProgress, isTerminalJobStatus } from "../app/jobs";
import type { MessageKey, Translator } from "../app/i18n/translator";

export type JobsViewFormatters = {
  i18n: Translator;
  escapeHtml: (value: string) => string;
  formatBytes: (value?: number) => string;
  formatJobKind: (kind: JobKind) => string;
  canRetryJobWithPassword: (jobId: string, state: JobState) => boolean;
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
      const progress = deriveJobProgress(state);
      const formatDuration = formatters.formatDuration ?? defaultFormatDuration;
      const filesText = progress.totalFiles === null
        ? String(progress.processedFiles)
        : `${progress.processedFiles} / ${progress.totalFiles}`;
      const progressValue = progress.progressPercent ?? 0;
      const progressAttributes = progress.progressPercent === null && !isTerminalJobStatus(snapshot.status)
        ? ""
        : `value="${progressValue.toFixed(0)}" max="100"`;
      return `
        <article class="job-card">
          <div class="job-header">
            <div>
              <p class="job-title">${formatters.escapeHtml(formatters.formatJobKind(snapshot.kind))}</p>
              <p class="job-subtitle">${formatters.escapeHtml(i18n.t(jobStatusKey(snapshot.status)).toUpperCase())} - ${formatters.escapeHtml(snapshot.jobId)}</p>
            </div>
            <div class="job-actions">
              ${snapshot.status === "queued" || snapshot.status === "running"
                ? `<button type="button" data-cancel="${formatters.escapeHtml(snapshot.jobId)}">${formatters.escapeHtml(i18n.t("jobs.action.cancel"))}</button>`
                : ""
              }
              ${canRetryPassword ? `<button type="button" data-retry-password="${formatters.escapeHtml(snapshot.jobId)}">${formatters.escapeHtml(i18n.t("jobs.action.retryPassword"))}</button>` : ""}
              ${snapshot.canDismiss ? `<button type="button" data-dismiss="${formatters.escapeHtml(snapshot.jobId)}">${formatters.escapeHtml(i18n.t("jobs.action.dismiss"))}</button>` : ""}
            </div>
          </div>
          <div class="job-progress-grid">
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.elapsedTime"))}</dt><dd>${formatters.escapeHtml(formatDuration(progress.elapsedMs))}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.remainingTime"))}</dt><dd>${formatters.escapeHtml(formatDuration(progress.remainingMs))}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.files"))}</dt><dd>${filesText}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.errors"))}</dt><dd>${progress.errorCount}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.warnings"))}</dt><dd>${progress.warningCount}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.totalSize"))}</dt><dd>${progress.totalBytes === null ? "" : formatters.formatBytes(progress.totalBytes)}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.speed"))}</dt><dd>${progress.speedBytesPerSecond === null ? "" : `${formatters.formatBytes(progress.speedBytesPerSecond)}/s`}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.processed"))}</dt><dd>${formatters.formatBytes(progress.processedBytes)}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.compressedSize"))}</dt><dd>${progress.compressedBytes === null ? "" : formatters.formatBytes(progress.compressedBytes)}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.compressionRatio"))}</dt><dd>${progress.compressionRatio === null ? "" : `${Math.round(progress.compressionRatio * 100)}%`}</dd></div>
            <div><dt>${formatters.escapeHtml(i18n.t("jobs.metric.status"))}</dt><dd>${formatters.escapeHtml(progress.latestStatusMessage)}</dd></div>
            <div class="span-2"><dt>${formatters.escapeHtml(i18n.t("jobs.metric.fileName"))}</dt><dd>${formatters.escapeHtml(progress.currentFile)}</dd></div>
          </div>
          <progress
            aria-label="${formatters.escapeHtml(i18n.t("jobs.progress.aria"))}"
            ${progressAttributes}
          ></progress>
          <div class="job-summary">
            ${
              summary
                ? `
                  <p><strong>${formatters.escapeHtml(i18n.t("jobs.summary.written"))}</strong> ${summary.writtenEntries} entries, ${formatters.formatBytes(summary.writtenBytes)}</p>
                  ${
                    typeof summary.skippedEntries === "number"
                      ? `<p><strong>${formatters.escapeHtml(i18n.t("jobs.summary.skipped"))}</strong> ${summary.skippedEntries}</p>`
                      : ""
                  }
                  ${
                    summary.warnings.length
                      ? `<p><strong>${formatters.escapeHtml(i18n.t("jobs.summary.warnings"))}</strong> ${summary.warnings.length}</p>`
                      : ""
                  }
                `
                : `<p>${formatters.escapeHtml(i18n.t("jobs.summary.empty"))}</p>`
            }
          </div>
        </article>
      `;
    })
    .join("");
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
