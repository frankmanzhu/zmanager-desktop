import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactSnapshot,
} from "../appRuntime";
import { JobsDrawer, QuickActionProgress } from "./JobsSurfaces";

type JobItem = ZManagerReactSnapshot["jobs"]["jobs"][number];
type JobItemOverrides =
  & Pick<JobItem, "jobId" | "kind" | "status">
  & Partial<Omit<JobItem, "jobId" | "kind" | "status" | "state" | "progress">>
  & Readonly<{
    progress?: Partial<JobItem["progress"]>;
    progressPercent?: number | null;
  }>;

describe("React jobs surfaces", () => {
  it("renders job drawer cards and output actions from job snapshots", () => {
    const html = renderJobs(<JobsDrawer />, jobsSnapshot({
      shell: { jobDrawerOpen: true },
      jobs: [completedJob(), runningJob()],
    }));

    expect(html).toContain('id="job-drawer"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('id="jobs-list"');
    expect(html).toContain('data-job-status="completed"');
    expect(html).toContain('data-output-action="reveal"');
    expect(html).toContain('data-dismiss="job-complete"');
    expect(html).toContain('data-pause="job-running"');
    expect(html).toContain('data-cancel="job-running"');
  });

  it("renders focused quick-action progress with controls and context", () => {
    const html = renderJobs(<QuickActionProgress />, jobsSnapshot({
      shell: {
        quickActionWindow: {
          mode: "jobOnly",
          shown: true,
        },
      },
      quickActionProgress: {
        state: "tracking",
        jobCount: 1,
        latestJob: {
          jobId: "job-running",
          kind: "zipExtract",
          status: "running",
        },
        latestContext: {
          kind: "extract",
          title: "archive",
          archivePath: "C:/archives/demo.zip",
          destinationPath: "C:/out",
          overwrite: "rename",
        },
        allTerminal: false,
        allCompleted: false,
        anyActive: true,
        anyPaused: false,
        elapsedMs: 3723000,
        remainingMs: 15000,
        processedFiles: 2,
        totalFiles: 4,
        processedBytes: 2048,
        totalBytes: 4096,
        compressedBytes: null,
        speedBytesPerSecond: 1024,
        progressPercent: 50,
        currentFile: "docs/readme.md",
        progressClock: { shouldRun: true },
      },
    }));

    expect(html).toContain('id="quick-progress"');
    expect(html).toContain('id="quick-title"');
    expect(html).toContain("Extract archive");
    expect(html).toContain("C:/archives/demo.zip");
    expect(html).toContain('id="quick-progress-bar"');
    expect(html).toContain('value="50"');
    expect(html).toContain('id="quick-background"');
    expect(html).toContain('id="quick-continue"');
    expect(html).toContain('id="quick-cancel"');
  });
});

function renderJobs(node: React.ReactElement, snapshot: ZManagerReactSnapshot): string {
  const store = createZManagerAppStore(snapshot, noopZManagerReactActions);
  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      node,
    ),
  );
}

function jobsSnapshot(options: Readonly<{
  shell?: Partial<ZManagerReactSnapshot["shell"]>;
  jobs?: readonly JobItem[];
  quickActionProgress?: ZManagerReactSnapshot["quickActionProgress"];
}>): ZManagerReactSnapshot {
  const initial = createInitialZManagerReactSnapshot();
  const jobs = options.jobs ?? [];
  return createZManagerReactSnapshot({
    ...initial,
    shell: {
      ...initial.shell,
      ...options.shell,
      quickActionWindow: {
        ...initial.shell.quickActionWindow,
        ...options.shell?.quickActionWindow,
      },
    },
    jobs: {
      jobs,
      activeJob: jobs[0] ? { kind: jobs[0].kind, status: jobs[0].status } : null,
      progressClock: { shouldRun: jobs.some((job) => job.status === "queued" || job.status === "running" || job.status === "paused") },
    },
    quickActionProgress: options.quickActionProgress ?? initial.quickActionProgress,
  });
}

function runningJob(): JobItem {
  return jobItem({
    jobId: "job-running",
    kind: "zipExtract",
    status: "running",
    progress: {
      progressPercent: 42,
      currentFile: "docs/readme.md",
    },
  });
}

function completedJob(): JobItem {
  return jobItem({
    jobId: "job-complete",
    kind: "zipCreate",
    status: "completed",
    canDismiss: true,
    progressPercent: 100,
    terminalSummary: {
      writtenEntries: 3,
      skippedEntries: null,
      writtenBytes: 4096,
      warnings: [],
    },
    readyOutputActions: [{ kind: "reveal", path: "C:/out/demo.zip" }],
  });
}

function jobItem(overrides: JobItemOverrides): JobItem {
  const events = [...(overrides.events ?? [])];
  const snapshot = {
    jobId: overrides.jobId,
    kind: overrides.kind,
    status: overrides.status,
    createdAt: "2026-07-09T10:00:00.000Z",
    canDismiss: overrides.canDismiss ?? false,
    events,
    terminalSummary: overrides.terminalSummary ?? null,
  };
  return {
    jobId: overrides.jobId,
    kind: overrides.kind,
    status: overrides.status,
    canDismiss: overrides.canDismiss ?? false,
    events,
    terminalSummary: overrides.terminalSummary ?? null,
    state: {
      snapshot,
      events,
    },
    progress: {
      id: overrides.jobId,
      kind: overrides.kind,
      status: overrides.status,
      elapsedMs: 1000,
      remainingMs: 2000,
      processedFiles: 1,
      totalFiles: 2,
      errorCount: 0,
      warningCount: 0,
      totalBytes: 4096,
      processedBytes: 2048,
      compressedBytes: null,
      speedBytesPerSecond: 1024,
      compressionRatio: null,
      currentFile: overrides.progress?.currentFile ?? "",
      progressPercent: overrides.progress?.progressPercent ?? overrides.progressPercent ?? null,
      latestStatusMessage: "Working",
      ...overrides.progress,
    },
    isTerminal: ["completed", "failed", "cancelled"].includes(overrides.status),
    completedSizeLabelKey: overrides.completedSizeLabelKey ?? "jobs.summary.archiveSize",
    canRetryPassword: overrides.canRetryPassword ?? false,
    readyOutputActions: overrides.readyOutputActions ?? [],
  };
}
