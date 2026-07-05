import { describe, expect, it } from "vitest";

import { renderJobsListHtml } from "./jobsView";
import type { JobKind, JobState } from "../api/types";
import { createTranslator } from "../app/i18n/translator";

const formatters = {
  i18n: createTranslator("en"),
  escapeHtml: (value: string) => value,
  formatBytes: (value = 0) => `${value} B`,
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

  it("renders create compressed size and compression ratio separately from progress", () => {
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
          events: [
            { eventType: "started", totalBytes: 168, entries: 0, totalEntries: 1 },
            { eventType: "completed", jobKind: "zipCreate" },
          ],
        },
      ],
    ]);

    const html = renderJobsListHtml(jobs, formatters);

    expect(html).toContain("<dt>Compressed size</dt><dd>42 B</dd>");
    expect(html).toContain("<dt>Compression ratio</dt><dd>25%</dd>");
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

  it("renders processed files against known totals", () => {
    const jobs = new Map<string, JobState>([
      [
        "job-create",
        {
          snapshot: {
            jobId: "job-create",
            kind: "zipCreate",
            status: "running",
            createdAt: "2026-06-11T00:00:00Z",
            canDismiss: false,
            events: [],
            terminalSummary: null,
          },
          events: [
            { eventType: "started", entries: 0, totalEntries: 4 },
            { eventType: "entryFinished", entries: 2, totalEntries: 4 },
          ],
        },
      ],
    ]);

    expect(renderJobsListHtml(jobs, formatters)).toContain("<dd>2 / 4</dd>");
  });

  it("renders translated empty state text from the translator", () => {
    const html = renderJobsListHtml(new Map(), formatters);

    expect(html).toContain("No running or terminal jobs.");
    expect(html).toContain("Start create, extract, or test actions to watch progress.");
  });
});
