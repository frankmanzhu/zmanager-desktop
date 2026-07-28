import { describe, expect, it } from "vitest";

import type {
  DesktopJobSnapshotDto,
  JobEventDto,
  JobState,
  BaseJobSnapshotDto,
  StartJobResponseDto,
} from "../../api/types";
import {
  createJobsWorkspace,
  type FocusedJobProgressContext,
  type JobOutputAction,
} from "./jobsWorkspace";
import type { JobRetryContext } from "../jobs";

const startedAt = "2026-06-11T00:00:00Z";

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "queued",
    createdAt: startedAt,
    ...overrides,
  };
}

function baseSnapshot(overrides: Partial<BaseJobSnapshotDto> = {}): BaseJobSnapshotDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "running",
    createdAt: startedAt,
    canDismiss: false,
    events: [],
    terminalSummary: null,
    ...overrides,
  };
}

const extractRetryContext: JobRetryContext = {
  retryKind: "extractArchive",
  archivePath: "C:/archives/source.zip",
  destinationPath: "C:/out/source",
  overwrite: "ask",
  stripComponents: 0,
};

describe("jobs workspace", () => {
  it("restores secret-free retry recipes and output actions from retained snapshots", () => {
    const failedWorkspace = createJobsWorkspace();
    failedWorkspace.acceptRetainedSnapshot({
      revision: "7",
      jobId: "failed-job",
      kind: "zipExtract",
      status: "failed",
      createdAt: startedAt,
      updatedAt: startedAt,
      canPause: false,
      canResume: false,
      canCancel: false,
      canDismiss: true,
      progressFacts: { processedBytes: 0, processedEntries: 0, recentPaths: [], phaseProcessedBytes: 0, warningCount: 0, activeElapsedMillis: 0, phaseElapsedMillis: 0 },
      latestFailure: { eventType: "failed", code: "password_required", retryable: true },
      boundedNotices: [],
      availableActions: [],
      outputArtifacts: [],
      retryDescriptor: {
        retryKind: "extractArchive",
        actionId: "retry-with-password",
        archivePath: "C:/archives/source.zip",
        destinationPath: "C:/out/source",
        overwrite: "ask",
        destinationCollisionStrategy: "refuse",
        entryPaths: ["one.txt"],
        stripComponents: 0,
      },
    } satisfies DesktopJobSnapshotDto);
    expect(failedWorkspace.getPasswordRetryDetails("failed-job")?.context).toEqual({
      ...extractRetryContext,
      destinationCollisionStrategy: "refuse",
      entryPaths: ["one.txt"],
      tzapRestorePolicy: "portable",
      tzapAllowDegraded: false,
      tzapAllowAbsoluteSymlinks: false,
      ignoreSymlinks: false,
    });
    expect(JSON.stringify(failedWorkspace.getRetryContext("failed-job"))).not.toContain("password");

    const completedWorkspace = createJobsWorkspace();
    completedWorkspace.acceptRetainedSnapshot({
      revision: "8",
      jobId: "completed-job",
      kind: "zipExtract",
      status: "completed",
      createdAt: startedAt,
      updatedAt: startedAt,
      canPause: false,
      canResume: false,
      canCancel: false,
      canDismiss: true,
      progressFacts: { processedBytes: 1, processedEntries: 1, recentPaths: [], phaseProcessedBytes: 0, warningCount: 0, activeElapsedMillis: 1, phaseElapsedMillis: 0 },
      boundedNotices: [],
      availableActions: [{ actionId: "open-output", kind: "open", artifactId: "output" }],
      outputArtifacts: [{ artifactId: "output", kind: "directory", path: "C:/out/source" }],
    } satisfies DesktopJobSnapshotDto);
    expect(completedWorkspace.getReadyOutputActions("completed-job")).toEqual([
      { kind: "open", path: "C:/out/source" },
    ]);
  });

  it("adds jobs with retry and output metadata without exposing password state", () => {
    const workspace = createJobsWorkspace();
    const outputActions: JobOutputAction[] = [{ kind: "open", path: "C:/out/source" }];

    workspace.addJob(startJobResponse(), {
      retryContext: extractRetryContext,
      outputActions,
    });
    outputActions[0] = { kind: "reveal", path: "C:/changed" };

    expect(workspace.getJob("job-1")?.snapshot.status).toBe("queued");
    expect(workspace.getRetryContext("job-1")).toEqual(extractRetryContext);
    expect(JSON.stringify(workspace.getRetryContext("job-1"))).not.toContain("password");
    expect(workspace.getOutputActions("job-1")).toEqual([{ kind: "open", path: "C:/out/source" }]);
    expect(workspace.getReadyOutputActions("job-1")).toEqual([]);

    workspace.applyJobSnapshot(baseSnapshot({
      status: "completed",
      canDismiss: true,
    }));

    expect(workspace.getReadyOutputActions("job-1")).toEqual([{ kind: "open", path: "C:/out/source" }]);
    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "open" })).toEqual({
      action: "ready",
      outputAction: {
        kind: "open",
        path: "C:/out/source",
      },
    });
    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "reveal" })).toEqual({
      action: "unavailable",
    });
  });

  it("returns cloned job, retry, map, and output objects for read seams", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse(), {
      retryContext: {
        ...extractRetryContext,
        entryPaths: ["secret.txt"],
      },
      outputActions: [{ kind: "open", path: "C:/out/source" }],
    });

    const job = workspace.getJob("job-1");
    job?.events.push({ eventType: "warning", message: "mutated clone" });
    job?.snapshot.events.push({ eventType: "warning", message: "mutated snapshot clone" });
    const retryContext = workspace.getRetryContext("job-1");
    if (retryContext?.retryKind === "extractArchive") {
      retryContext.entryPaths?.push("changed.txt");
    }
    const jobsMap = workspace.getJobsMap();
    jobsMap.get("job-1")?.events.push({ eventType: "failed", message: "mutated map clone" });
    jobsMap.clear();
    const actions = workspace.getOutputActions("job-1") as JobOutputAction[];
    actions[0] = { kind: "reveal", path: "C:/changed" };

    expect(workspace.getJob("job-1")).toBeDefined();
    expect(workspace.getJob("job-1")?.events).toEqual([]);
    expect(workspace.getJob("job-1")?.snapshot.events).toEqual([]);
    expect(workspace.getRetryContext("job-1")).toEqual({
      ...extractRetryContext,
      entryPaths: ["secret.txt"],
    });
    expect(workspace.getOutputActions("job-1")).toEqual([{ kind: "open", path: "C:/out/source" }]);
  });

  it("applies fixture snapshots and preserves previous terminal summaries", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse());
    workspace.applyJobSnapshot(baseSnapshot({
      status: "completed",
      canDismiss: true,
      events: [{ eventType: "completed", jobKind: "zipExtract" }],
      terminalSummary: {
        writtenEntries: 2,
        skippedEntries: null,
        writtenBytes: 42,
        warnings: [],
      },
    }));

    const latePoll = baseSnapshot({
      status: "completed",
      canDismiss: true,
      events: [{ eventType: "warning", message: "late warning" }],
      terminalSummary: null,
    });
    const merged = workspace.applyJobSnapshot(latePoll);
    latePoll.events[0].message = "mutated after merge";

    expect(merged.snapshot.terminalSummary?.writtenEntries).toBe(2);
    expect(merged.events.map((event) => event.eventType)).toEqual(["warning"]);
    expect(workspace.getJob("job-1")?.events.at(-1)?.message).toBe("late warning");
  });

  it("marks poll failures as dismissible failed jobs", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse());
    const failedEvent: JobEventDto = {
      eventType: "failed",
      code: "io_error",
      severity: "error",
      retryable: true,
      message: "Cannot read progress.",
    };

    const failed = workspace.markJobFailed("job-1", failedEvent);
    failedEvent.message = "Mutated after mark.";

    expect(failed?.snapshot.status).toBe("failed");
    expect(failed?.snapshot.canDismiss).toBe(true);
    expect(failed?.events.at(-1)?.message).toBe("Cannot read progress.");
    expect(workspace.getJob("job-1")?.events.at(-1)?.message).toBe("Cannot read progress.");
  });

  it("tracks password retry eligibility and only marks a job prompted once", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse(), { retryContext: extractRetryContext });
    workspace.applyJobSnapshot(baseSnapshot({
      status: "failed",
      canDismiss: true,
      events: [{ eventType: "failed", code: "password_required" }],
    }));

    expect(workspace.canRetryJobWithPassword("job-1")).toBe(true);
    expect(workspace.getPasswordRetryDetails("job-1")?.failure.code).toBe("password_required");
    expect(workspace.markPasswordRetryPromptedIfEligible("job-1")).toBe(true);
    expect(workspace.markPasswordRetryPromptedIfEligible("job-1")).toBe(false);
  });

  it("cleans retry, output, and prompted metadata when jobs are removed or replaced", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse(), {
      retryContext: extractRetryContext,
      outputActions: [{ kind: "open", path: "C:/out/source" }],
    });
    workspace.applyJobSnapshot(baseSnapshot({
      status: "failed",
      canDismiss: true,
      events: [{ eventType: "failed", code: "password_required" }],
    }));
    workspace.markPasswordRetryPromptedIfEligible("job-1");

    workspace.removeJob("job-1");

    expect(workspace.getJob("job-1")).toBeUndefined();
    expect(workspace.getRetryContext("job-1")).toBeUndefined();
    expect(workspace.getOutputActions("job-1")).toEqual([]);
    expect(workspace.markPasswordRetryPromptedIfEligible("job-1")).toBe(false);

    workspace.replaceJobs([
      {
        snapshot: baseSnapshot({
          jobId: "fixture-job",
          status: "completed",
          canDismiss: true,
        }),
        events: [],
        outputActions: [{ kind: "reveal", path: "C:/archives/source.zip" }],
      } satisfies JobState & { outputActions: readonly JobOutputAction[] },
    ]);

    expect(workspace.getJob("fixture-job")).toBeDefined();
    expect(workspace.getOutputAction({ jobId: "fixture-job", index: 0, kind: "reveal" })).toEqual({
      action: "ready",
      outputAction: {
        kind: "reveal",
        path: "C:/archives/source.zip",
      },
    });
    expect(workspace.hasJobs()).toBe(true);
  });

  it("updates status for pause and resume command responses", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ status: "running" }));

    expect(workspace.hasActiveJob()).toBe(true);
    expect(workspace.getProgressClockSnapshot()).toEqual({ shouldRun: true });
    expect(workspace.updateJobStatus("job-1", "paused")?.snapshot.status).toBe("paused");
    expect(workspace.updateJobStatus("job-1", "running")?.snapshot.status).toBe("running");
    workspace.updateJobStatus("job-1", "completed");
    expect(workspace.getProgressClockSnapshot()).toEqual({ shouldRun: false });
    expect(workspace.updateJobStatus("missing", "running")).toBeNull();
  });

  it("derives deterministic job list snapshots for status, progress, and ready output actions", () => {
    const workspace = createJobsWorkspace();
    const nowMs = Date.parse(startedAt) + 5_000;
    workspace.addJob(startJobResponse({
      jobId: "older-job",
      status: "completed",
      createdAt: "2026-06-10T23:59:00Z",
    }));
    workspace.addJob(startJobResponse({
      jobId: "newer-job",
      status: "running",
      createdAt: startedAt,
    }), {
      outputActions: [{ kind: "open", path: "C:/out/newer" }],
    });
    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "newer-job",
      status: "running",
      events: [{
        eventType: "bytesProcessed",
        path: "C:/work/file.bin",
        totalBytes: 100,
        totalBytesProcessed: 25,
      }],
    }));

    const snapshot = workspace.getJobListSnapshot(nowMs);

    expect(snapshot.jobs.map((job) => job.state.snapshot.jobId)).toEqual([
      "newer-job",
      "older-job",
    ]);
    expect(snapshot.activeJob).toEqual({ kind: "zipExtract", status: "running" });
    expect(snapshot.progressClock).toEqual({ shouldRun: true });
    expect(snapshot.jobs[0].progress.processedBytes).toBe(25);
    expect(snapshot.jobs[0].progress.totalBytes).toBe(100);
    expect(snapshot.jobs[0].progress.progressPercent).toBe(25);
    expect(snapshot.jobs[0].readyOutputActions).toEqual([]);

    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "newer-job",
      status: "completed",
      canDismiss: true,
    }));

    expect(workspace.getJobListSnapshot(nowMs).jobs[0].readyOutputActions).toEqual([
      { kind: "open", path: "C:/out/newer" },
    ]);
  });

  it("resolves output actions only when job status, kind, index, and path are valid", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse(), {
      outputActions: [
        { kind: "open", path: "C:/out/source" },
        { kind: "reveal", path: "" },
      ],
    });

    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "open" })).toEqual({
      action: "unavailable",
    });

    workspace.applyJobSnapshot(baseSnapshot({
      status: "completed",
      canDismiss: true,
    }));

    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "open" })).toEqual({
      action: "ready",
      outputAction: { kind: "open", path: "C:/out/source" },
    });
    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "reveal" })).toEqual({
      action: "unavailable",
    });
    expect(workspace.getOutputAction({ jobId: "job-1", index: 1, kind: "reveal" })).toEqual({
      action: "unavailable",
    });
    expect(workspace.getOutputAction({ jobId: "job-1", index: 1.5, kind: "reveal" })).toEqual({
      action: "unavailable",
    });
    expect(workspace.getOutputAction({ jobId: "job-1", index: 0, kind: "delete" })).toEqual({
      action: "unavailable",
    });
    expect(workspace.getOutputAction({ index: 0, kind: "open" })).toEqual({
      action: "unavailable",
    });
  });

  it("tracks focused quick-action jobs and clones progress contexts", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ jobId: "create-job", status: "running" }));
    const context: FocusedJobProgressContext = {
      kind: "create",
      sources: ["C:/work/project", "C:/work/assets"],
      destinationPath: "C:/out/project.zip",
      format: "zip",
      cleanSource: false,
    };

    workspace.trackFocusedQuickActionJob("create-job", context);
    (context.sources as string[]).push("C:/mutated");

    const trackedContext = workspace.getFocusedQuickActionProgressContext("create-job");
    expect(workspace.getFocusedQuickActionJobIds()).toEqual(["create-job"]);
    expect(workspace.getFocusedQuickActionJobs().map((job) => job.snapshot.jobId)).toEqual(["create-job"]);
    expect(trackedContext).toEqual({
      kind: "create",
      sources: ["C:/work/project", "C:/work/assets"],
      destinationPath: "C:/out/project.zip",
      format: "zip",
      cleanSource: false,
    });

    if (trackedContext?.kind === "create") {
      (trackedContext.sources as string[]).push("C:/changed");
    }

    expect(workspace.getFocusedQuickActionProgressContext("create-job")).toEqual({
      kind: "create",
      sources: ["C:/work/project", "C:/work/assets"],
      destinationPath: "C:/out/project.zip",
      format: "zip",
      cleanSource: false,
    });
  });

  it("derives focused quick-action aggregate progress snapshots", () => {
    const workspace = createJobsWorkspace();
    const nowMs = Date.parse(startedAt) + 5_000;
    workspace.addJob(startJobResponse({ jobId: "job-a", status: "running" }));
    workspace.addJob(startJobResponse({ jobId: "job-b", status: "running" }));
    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "job-a",
      status: "running",
      events: [{
        eventType: "bytesProcessed",
        path: "C:/work/a.bin",
        totalBytes: 100,
        totalBytesProcessed: 25,
      }],
    }));
    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "job-b",
      status: "running",
      events: [{
        eventType: "bytesProcessed",
        path: "C:/work/b.bin",
        totalBytes: 200,
        totalBytesProcessed: 50,
      }],
    }));
    workspace.trackFocusedQuickActionJob("job-a");
    workspace.trackFocusedQuickActionJob("job-b", {
      kind: "extract",
      title: "selection",
      archivePath: "C:/archives/source.zip",
      destinationPath: "C:/out/source",
      overwrite: "rename",
      entryPaths: ["docs/readme.md"],
    });

    const snapshot = workspace.getFocusedQuickActionProgressSnapshot(nowMs);

    expect(snapshot.state).toBe("tracking");
    if (snapshot.state !== "tracking") {
      return;
    }
    expect(snapshot.jobCount).toBe(2);
    expect(snapshot.latestJob).toEqual({
      jobId: "job-b",
      kind: "zipExtract",
      status: "running",
    });
    expect(snapshot.latestContext).toEqual({
      kind: "extract",
      title: "selection",
      archivePath: "C:/archives/source.zip",
      destinationPath: "C:/out/source",
      overwrite: "rename",
      entryPaths: ["docs/readme.md"],
    });
    expect(snapshot.allTerminal).toBe(false);
    expect(snapshot.anyActive).toBe(true);
    expect(snapshot.anyPaused).toBe(false);
    expect(snapshot.elapsedMs).toBe(5_000);
    expect(snapshot.processedBytes).toBe(75);
    expect(snapshot.totalBytes).toBe(300);
    expect(snapshot.speedBytesPerSecond).toBe(15);
    expect(snapshot.remainingMs).toBe(15_000);
    expect(snapshot.progressPercent).toBe(25);
    expect(snapshot.currentFile).toBe("C:/work/b.bin");
    expect(snapshot.progressClock).toEqual({ shouldRun: true });

    if (snapshot.latestContext?.kind === "extract") {
      (snapshot.latestContext.entryPaths as string[]).push("mutated.txt");
    }

    const nextSnapshot = workspace.getFocusedQuickActionProgressSnapshot(nowMs);
    expect(nextSnapshot.state).toBe("tracking");
    if (nextSnapshot.state === "tracking") {
      expect(nextSnapshot.latestContext).toEqual({
        kind: "extract",
        title: "selection",
        archivePath: "C:/archives/source.zip",
        destinationPath: "C:/out/source",
        overwrite: "rename",
        entryPaths: ["docs/readme.md"],
      });
    }
  });

  it("selects controllable focused quick-action job ids from live tracked jobs", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ jobId: "running-job", status: "running" }));
    workspace.addJob(startJobResponse({ jobId: "paused-job", status: "paused" }));
    workspace.addJob(startJobResponse({ jobId: "done-job", status: "completed" }));
    workspace.trackFocusedQuickActionJob("running-job");
    workspace.trackFocusedQuickActionJob("paused-job");
    workspace.trackFocusedQuickActionJob("done-job");

    expect(workspace.getControllableFocusedQuickActionJobIds()).toEqual([
      "running-job",
      "paused-job",
    ]);
  });

  it("owns focused quick-action completion decisions and auto-close action state", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ jobId: "job-1", status: "running" }));
    workspace.trackFocusedQuickActionJob("job-1");

    expect(workspace.getFocusedJobAutoCloseAction()).toBe("closeWindow");
    workspace.setFocusedJobAutoCloseAction("returnToWorkspace");
    expect(workspace.getFocusedJobAutoCloseAction()).toBe("returnToWorkspace");
    expect(workspace.selectFocusedQuickActionCompletion({
      canEvaluate: true,
      autoClosePending: false,
    })).toEqual({ action: "wait" });

    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "job-1",
      status: "completed",
      canDismiss: true,
    }));
    expect(workspace.selectFocusedQuickActionCompletion({
      canEvaluate: true,
      autoClosePending: false,
    })).toEqual({ action: "completed" });
    expect(workspace.selectFocusedQuickActionCompletion({
      canEvaluate: true,
      autoClosePending: true,
    })).toEqual({ action: "wait" });

    workspace.resetFocusedQuickActionProgress();
    expect(workspace.getFocusedJobAutoCloseAction()).toBe("closeWindow");
    expect(workspace.getFocusedQuickActionJobIds()).toEqual([]);
  });

  it("reports focused quick-action jobs needing attention when any tracked job fails", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ jobId: "completed-job" }));
    workspace.addJob(startJobResponse({ jobId: "failed-job" }));
    workspace.trackFocusedQuickActionJob("completed-job");
    workspace.trackFocusedQuickActionJob("failed-job");
    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "completed-job",
      status: "completed",
      canDismiss: true,
    }));
    workspace.applyJobSnapshot(baseSnapshot({
      jobId: "failed-job",
      status: "failed",
      canDismiss: true,
    }));

    expect(workspace.selectFocusedQuickActionCompletion({
      canEvaluate: true,
      autoClosePending: false,
    })).toEqual({ action: "needsAttention" });
  });

  it("cleans focused quick-action tracking when jobs are removed", () => {
    const workspace = createJobsWorkspace();
    workspace.addJob(startJobResponse({ jobId: "extract-job" }));
    workspace.trackFocusedQuickActionJob("extract-job", {
      kind: "extract",
      title: "selection",
      archivePath: "C:/archives/source.zip",
      destinationPath: "C:/out/source",
      overwrite: "rename",
      entryPaths: ["docs/readme.md"],
    });

    workspace.removeJob("extract-job");

    expect(workspace.getFocusedQuickActionJobIds()).toEqual([]);
    expect(workspace.getFocusedQuickActionProgressContext("extract-job")).toBeUndefined();
    expect(workspace.selectFocusedQuickActionCompletion({
      canEvaluate: true,
      autoClosePending: false,
    })).toEqual({ action: "wait" });
  });
});
