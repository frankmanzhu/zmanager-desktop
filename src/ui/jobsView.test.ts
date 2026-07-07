import { describe, expect, it } from "vitest";

import { renderJobsListHtml } from "./jobsView";
import type { JobKind, JobState } from "../api/types";
import { createTranslator } from "../app/i18n/translator";

const formatters = {
  i18n: createTranslator("en"),
  escapeHtml: (value: string) => value,
  formatBytes: (value = 0) => `${Math.round(value)} B`,
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

  it("renders completed jobs with compact output summary and output actions when available", () => {
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

    const html = renderJobsListHtml(jobs, {
      ...formatters,
      getOutputActions: () => [{ kind: "reveal", path: "C:/work/archive.zip" }],
    });

    expect(html).toContain("Output ready");
    expect(html).toContain("1 entries, 42 B");
    expect(html).toContain("Archive output");
    expect(html).toContain("data-output-action=\"reveal\"");
    expect(html).toContain("Reveal Output");
  });

  it("renders failed terminal jobs as concise recovery cards", () => {
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
          events: [
            { eventType: "entryStarted", path: "docs/private.txt" },
            { eventType: "failed", message: "Cannot write archive.", path: "docs/private.txt" },
          ],
        },
      ],
    ]);

    const html = renderJobsListHtml(jobs, formatters);

    expect(html).toContain("zipCreate failed");
    expect(html).toContain("Cannot write archive.");
    expect(html).toContain("Failed item: docs/private.txt");
    expect(html).toContain('data-dismiss="job-create"');
  });

  it("renders running jobs with current item, progress, speed, remaining time, and controls", () => {
    const createdAt = new Date(Date.now() - 1000).toISOString();
    const jobs = new Map<string, JobState>([
      [
        "job-create",
        {
          snapshot: {
            jobId: "job-create",
            kind: "zipCreate",
            status: "running",
            createdAt,
            canDismiss: false,
            events: [],
            terminalSummary: null,
          },
          events: [
            { eventType: "started", entries: 0, totalEntries: 4 },
            { eventType: "entryStarted", path: "docs/report.pdf" },
            { eventType: "bytesProcessed", totalBytesProcessed: 50, totalBytes: 100 },
            { eventType: "entryFinished", entries: 2, totalEntries: 4 },
          ],
        },
      ],
    ]);

    const html = renderJobsListHtml(jobs, {
      ...formatters,
      formatDuration: () => "4s",
    });

    expect(html).toContain("Current item");
    expect(html).toContain("docs/report.pdf");
    expect(html).toContain('value="50" max="100"');
    expect(html).toContain("50 B/s");
    expect(html).toContain("4s");
    expect(html).toContain('data-pause="job-create"');
    expect(html).toContain('data-cancel="job-create"');
  });

  it("renders translated empty state text from the translator", () => {
    const html = renderJobsListHtml(new Map(), formatters);

    expect(html).toContain("No running or terminal jobs.");
    expect(html).toContain("Start create, extract, or test actions to watch progress.");
  });
});
