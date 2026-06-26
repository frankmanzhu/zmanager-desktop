import type { JobKind, JobState } from "../api/types";

export type JobsViewFormatters = {
  escapeHtml: (value: string) => string;
  formatBytes: (value?: number) => string;
  formatEventCode: (code: string) => string;
  formatJobKind: (kind: JobKind) => string;
  canRetryJobWithPassword: (jobId: string, state: JobState) => boolean;
};

export function sortedJobStates(jobs: Map<string, JobState>): JobState[] {
  return Array.from(jobs.values()).sort((a, b) =>
    b.snapshot.createdAt.localeCompare(a.snapshot.createdAt),
  );
}

export function activeJobStatusText(jobs: Map<string, JobState>, formatJobKind: (kind: JobKind) => string): string {
  const active = sortedJobStates(jobs).find((state) =>
    state.snapshot.status === "queued" || state.snapshot.status === "running",
  ) ?? sortedJobStates(jobs)[0];

  if (!active) {
    return "No jobs";
  }

  return `${formatJobKind(active.snapshot.kind)}: ${active.snapshot.status}`;
}

export function renderJobsListHtml(jobs: Map<string, JobState>, formatters: JobsViewFormatters): string {
  if (!jobs.size) {
    return `
      <div class="job-empty">
        <strong>No running or terminal jobs.</strong>
        <span>Start create, extract, or test actions to watch progress.</span>
      </div>
    `;
  }

  return sortedJobStates(jobs)
    .map((state) => {
      const snapshot = state.snapshot;
      const summary = snapshot.terminalSummary;
      const recentEvents = state.events.slice(-12);
      const canRetryPassword = formatters.canRetryJobWithPassword(snapshot.jobId, state);
      return `
        <article class="job-card">
          <div class="job-header">
            <div>
              <p class="job-title">${formatters.escapeHtml(formatters.formatJobKind(snapshot.kind))}</p>
              <p class="job-subtitle">${snapshot.status.toUpperCase()} - ${formatters.escapeHtml(snapshot.jobId)}</p>
            </div>
            <div class="job-actions">
              ${snapshot.status === "queued" || snapshot.status === "running"
                ? `<button type="button" data-cancel="${formatters.escapeHtml(snapshot.jobId)}">Cancel</button>`
                : ""
              }
              ${canRetryPassword ? `<button type="button" data-retry-password="${formatters.escapeHtml(snapshot.jobId)}">Retry Password</button>` : ""}
              ${snapshot.canDismiss ? `<button type="button" data-dismiss="${formatters.escapeHtml(snapshot.jobId)}">Dismiss</button>` : ""}
            </div>
          </div>
          <ul class="event-list">
            ${
              recentEvents.length
                ? recentEvents
                    .map(
                      (event) => `
                    <li>
                      <strong>${formatters.escapeHtml(event.eventType)}</strong>
                      ${event.path ? ` - ${formatters.escapeHtml(event.path)}` : ""}
                      ${typeof event.bytes === "number" ? ` - ${formatters.formatBytes(event.bytes)}` : ""}
                      ${typeof event.entries === "number" ? ` - ${event.entries} entries` : ""}
                      ${event.code ? ` - ${formatters.escapeHtml(formatters.formatEventCode(event.code))}` : ""}
                      ${event.message ? ` - ${formatters.escapeHtml(event.message)}` : ""}
                      ${event.hint ? ` - ${formatters.escapeHtml(event.hint)}` : ""}
                    </li>
                  `,
                    )
                    .join("")
                : "<li class=empty>Waiting for updates...</li>"
            }
          </ul>
          <div class="job-summary">
            ${
              summary
                ? `
                  <p><strong>Written:</strong> ${summary.writtenEntries} entries, ${formatters.formatBytes(summary.writtenBytes)}</p>
                  ${
                    typeof summary.skippedEntries === "number"
                      ? `<p><strong>Skipped:</strong> ${summary.skippedEntries}</p>`
                      : ""
                  }
                  ${
                    summary.warnings.length
                      ? `<p><strong>Warnings:</strong> ${summary.warnings.length}</p>`
                      : ""
                  }
                `
                : "<p>No summary yet.</p>"
            }
          </div>
        </article>
      `;
    })
    .join("");
}
