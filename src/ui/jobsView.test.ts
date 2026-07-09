import { describe, expect, it } from "vitest";

import { createTranslator } from "../app/i18n/translator";
import {
  renderJobsListHtml,
  type JobsViewItem,
  type JobsViewProgress,
} from "./jobsView";

const formatters = {
  i18n: createTranslator("en"),
  escapeHtml: (value: string) => value,
  formatBytes: (value = 0) => `${Math.round(value)} B`,
  formatJobKind: (kind: string) => kind,
  formatDuration: () => "0s",
};

describe("jobs view", () => {
  it("renders completed jobs with a determinate, full progress bar", () => {
    const jobs = [job({
      jobId: "job-create",
      kind: "zipCreate",
      status: "completed",
      canDismiss: true,
      terminalSummary: {
        writtenEntries: 1,
        skippedEntries: null,
        writtenBytes: 42,
        warnings: [],
      },
      events: [{ eventType: "completed" }],
      progress: { progressPercent: 100 },
    })];

    expect(renderJobsListHtml(jobs, formatters)).toContain('value="100" max="100"');
  });

  it("renders completed jobs with compact output summary and output actions when available", () => {
    const jobs = [job({
      jobId: "job-create",
      kind: "zipCreate",
      status: "completed",
      canDismiss: true,
      terminalSummary: {
        writtenEntries: 1,
        skippedEntries: null,
        writtenBytes: 42,
        warnings: [],
      },
      events: [{ eventType: "started" }, { eventType: "completed" }],
      progress: {
        processedBytes: 168,
        totalBytes: 168,
        processedFiles: 1,
        totalFiles: 1,
        progressPercent: 100,
      },
      readyOutputActions: [{ kind: "reveal", path: "C:/work/archive.zip" }],
    })];

    const html = renderJobsListHtml(jobs, formatters);

    expect(html).toContain("Output ready");
    expect(html).toContain("1 entries, 42 B");
    expect(html).toContain("Archive output");
    expect(html).toContain("data-output-action=\"reveal\"");
    expect(html).toContain("Reveal Output");
  });

  it("renders failed terminal jobs as concise recovery cards", () => {
    const jobs = [job({
      jobId: "job-create",
      kind: "zipCreate",
      status: "failed",
      canDismiss: true,
      events: [
        { eventType: "entryStarted", path: "docs/private.txt" },
        { eventType: "failed", message: "Cannot write archive.", path: "docs/private.txt" },
      ],
      progress: {
        currentFile: "docs/private.txt",
        latestStatusMessage: "Cannot write archive.",
        progressPercent: 0,
      },
    })];

    const html = renderJobsListHtml(jobs, formatters);

    expect(html).toContain("zipCreate failed");
    expect(html).toContain("Cannot write archive.");
    expect(html).toContain("Failed item: docs/private.txt");
    expect(html).toContain('data-dismiss="job-create"');
  });

  it("renders running jobs with current item, progress, speed, remaining time, and controls", () => {
    const jobs = [job({
      jobId: "job-create",
      kind: "zipCreate",
      status: "running",
      canDismiss: false,
      events: [
        { eventType: "started" },
        { eventType: "entryStarted", path: "docs/report.pdf" },
        { eventType: "bytesProcessed" },
        { eventType: "entryFinished" },
      ],
      progress: {
        currentFile: "docs/report.pdf",
        processedBytes: 50,
        totalBytes: 100,
        processedFiles: 2,
        totalFiles: 4,
        speedBytesPerSecond: 50,
        remainingMs: 4_000,
        progressPercent: 50,
      },
    })];

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
    const html = renderJobsListHtml([], formatters);

    expect(html).toContain("No running or terminal jobs.");
    expect(html).toContain("Start create, extract, or test actions to watch progress.");
  });
});

function job(
  overrides: Partial<Omit<JobsViewItem, "progress">> & { progress?: Partial<JobsViewProgress> } = {},
): JobsViewItem {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "queued",
    canDismiss: false,
    events: [],
    terminalSummary: null,
    isTerminal: overrides.status === "completed" || overrides.status === "failed" || overrides.status === "cancelled",
    completedSizeLabelKey: "jobs.summary.archiveSize",
    canRetryPassword: false,
    readyOutputActions: [],
    ...overrides,
    progress: {
      remainingMs: null,
      processedFiles: 0,
      totalFiles: null,
      totalBytes: null,
      processedBytes: 0,
      speedBytesPerSecond: null,
      currentFile: "",
      progressPercent: null,
      latestStatusMessage: overrides.status ?? "queued",
      ...overrides.progress,
    },
  };
}
