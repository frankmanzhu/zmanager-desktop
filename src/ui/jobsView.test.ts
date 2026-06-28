import { describe, expect, it } from "vitest";

import { renderJobsListHtml } from "./jobsView";
import type { JobKind, JobState } from "../api/types";

const formatters = {
  escapeHtml: (value: string) => value,
  formatBytes: (value = 0) => `${value} B`,
  formatEventCode: (code: string) => code,
  formatJobKind: (kind: JobKind) => kind,
  canRetryJobWithPassword: () => false,
  formatDuration: () => "0s",
};

describe("jobs view", () => {
  it("renders completed jobs with a determinate, full progress bar", () => {
    const jobs = new Map<string, JobState>([
      [
        "job-create",
        {
          snapshot: {
            jobId: "job-create",
            kind: "zipCreate",
            status: "completed",
            createdAt: "2026-06-11T00:00:00Z",
            canDismiss: true,
            events: [],
            terminalSummary: {
              writtenEntries: 1,
              skippedEntries: null,
              writtenBytes: 42,
              warnings: [],
            },
          },
          events: [{ eventType: "completed", jobKind: "zipCreate" }],
        },
      ],
    ]);

    expect(renderJobsListHtml(jobs, formatters)).toContain('value="100" max="100"');
  });

  it("renders failed terminal jobs with a determinate stopped progress bar", () => {
    const jobs = new Map<string, JobState>([
      [
        "job-create",
        {
          snapshot: {
            jobId: "job-create",
            kind: "zipCreate",
            status: "failed",
            createdAt: "2026-06-11T00:00:00Z",
            canDismiss: true,
            events: [],
            terminalSummary: null,
          },
          events: [{ eventType: "failed", message: "Cannot write archive." }],
        },
      ],
    ]);

    expect(renderJobsListHtml(jobs, formatters)).toContain('value="0" max="100"');
  });
});
