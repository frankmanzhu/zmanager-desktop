import { describe, expect, it } from "vitest";

import {
  canRetryJobWithPassword,
  createInitialJobState,
  deriveJobProgress,
  getLatestPasswordFailureEvent,
  mergePolledJobState,
  selectJobPollingDecision,
  selectQuickActionJobCompletionDecision,
} from "./jobs";
import type { JobState, PollJobEventsResponseDto, StartJobResponseDto } from "../api/types";

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

function pollResponse(overrides: Partial<PollJobEventsResponseDto> = {}): PollJobEventsResponseDto {
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

describe("job state helpers", () => {
  it("creates initial job state from a start response", () => {
    expect(createInitialJobState(startJobResponse())).toEqual({
      snapshot: {
        jobId: "job-1",
        kind: "zipExtract",
        status: "queued",
        createdAt: startedAt,
        canDismiss: false,
        events: [],
        terminalSummary: null,
      },
      events: [],
    });
  });

  it("appends drained poll events and preserves terminal summaries", () => {
    const previous: JobState = {
      snapshot: {
        ...pollResponse({
          status: "completed",
          canDismiss: true,
          terminalSummary: {
            writtenEntries: 2,
            skippedEntries: null,
            writtenBytes: 42,
            warnings: [],
          },
        }),
      },
      events: [{ eventType: "completed", jobKind: "zipExtract" }],
    };

    const merged = mergePolledJobState(
      previous,
      pollResponse({
        status: "completed",
        canDismiss: true,
        events: [{ eventType: "warning", message: "late warning" }],
        terminalSummary: null,
      }),
    );

    expect(merged.snapshot.terminalSummary?.writtenEntries).toBe(2);
    expect(merged.events.map((event) => event.eventType)).toEqual(["completed", "warning"]);
  });

  it("detects latest password failure and requires retry context", () => {
    const state: JobState = {
      snapshot: pollResponse({ status: "failed" }),
      events: [
        { eventType: "failed", code: "io_error" },
        { eventType: "failed", code: "password_required" },
      ],
    };

    expect(getLatestPasswordFailureEvent(state)?.code).toBe("password_required");
    expect(canRetryJobWithPassword(false, state)).toBe(false);
    expect(canRetryJobWithPassword(true, state)).toBe(true);
  });

  it("selects job polling decisions for in-flight, stopped, and pollable jobs", () => {
    const pollableState = createInitialJobState(startJobResponse({ jobId: "job-pollable" }));
    const dismissibleState: JobState = {
      snapshot: pollResponse({
        jobId: "job-done",
        status: "completed",
        canDismiss: true,
      }),
      events: [{ eventType: "completed", jobKind: "zipExtract" }],
    };

    expect(selectJobPollingDecision([pollableState], true)).toEqual({ action: "requestAgain" });
    expect(selectJobPollingDecision([dismissibleState], false)).toEqual({ action: "stop" });
    expect(selectJobPollingDecision([pollableState, dismissibleState], false)).toEqual({
      action: "poll",
      jobIds: ["job-pollable"],
    });
  });

  it("waits, requests attention, or completes focused quick-action jobs", () => {
    const running = createInitialJobState(startJobResponse({ jobId: "job-running" }));
    const completed: JobState = {
      snapshot: pollResponse({
        jobId: "job-completed",
        status: "completed",
        canDismiss: true,
      }),
      events: [{ eventType: "completed", jobKind: "zipExtract" }],
    };
    const failed: JobState = {
      snapshot: pollResponse({
        jobId: "job-failed",
        status: "failed",
        canDismiss: true,
      }),
      events: [{ eventType: "failed", message: "Nope" }],
    };

    expect(selectQuickActionJobCompletionDecision({
      canEvaluate: false,
      autoClosePending: false,
      trackedJobIds: ["job-completed"],
      jobsById: new Map([["job-completed", completed]]),
    })).toEqual({ action: "wait" });
    expect(selectQuickActionJobCompletionDecision({
      canEvaluate: true,
      autoClosePending: false,
      trackedJobIds: ["job-running"],
      jobsById: new Map([["job-running", running]]),
    })).toEqual({ action: "wait" });
    expect(selectQuickActionJobCompletionDecision({
      canEvaluate: true,
      autoClosePending: false,
      trackedJobIds: ["job-failed"],
      jobsById: new Map([["job-failed", failed]]),
    })).toEqual({ action: "needsAttention" });
    expect(selectQuickActionJobCompletionDecision({
      canEvaluate: true,
      autoClosePending: false,
      trackedJobIds: ["job-completed"],
      jobsById: new Map([["job-completed", completed]]),
    })).toEqual({ action: "completed" });
  });

  it("derives progress fields from job lifecycle events", () => {
    const state: JobState = {
      snapshot: pollResponse({ status: "running" }),
      events: [
        { eventType: "started", totalBytes: 100 },
        { eventType: "entryStarted", path: "docs/readme.txt" },
        { eventType: "bytesProcessed", totalBytesProcessed: 25, totalBytes: 100 },
        { eventType: "entryFinished" },
        { eventType: "warning", message: "skipped odd metadata" },
      ],
    };

    const progress = deriveJobProgress(state, Date.parse(startedAt) + 5000);

    expect(progress.processedBytes).toBe(25);
    expect(progress.totalBytes).toBe(100);
    expect(progress.progressPercent).toBe(25);
    expect(progress.processedFiles).toBe(1);
    expect(progress.totalFiles).toBeNull();
    expect(progress.warningCount).toBe(1);
    expect(progress.currentFile).toBe("docs/readme.txt");
    expect(progress.speedBytesPerSecond).toBe(5);
  });

  it("derives elapsed time from epoch-second timestamps", () => {
    const state: JobState = {
      snapshot: pollResponse({ createdAt: String(Date.parse(startedAt) / 1000) }),
      events: [{ eventType: "started" }],
    };

    const progress = deriveJobProgress(state, Date.parse(startedAt) + 3500);

    expect(progress.elapsedMs).toBe(3500);
  });

  it("derives file totals and ETA from entry counts when bytes are unavailable", () => {
    const state: JobState = {
      snapshot: pollResponse({ status: "running" }),
      events: [
        { eventType: "started", entries: 0, totalEntries: 4 },
        { eventType: "entryFinished", path: "one.txt", entries: 1, totalEntries: 4 },
        { eventType: "entryFinished", path: "two.txt", entries: 2, totalEntries: 4 },
      ],
    };

    const progress = deriveJobProgress(state, Date.parse(startedAt) + 4000);

    expect(progress.processedFiles).toBe(2);
    expect(progress.totalFiles).toBe(4);
    expect(progress.progressPercent).toBe(50);
    expect(progress.remainingMs).toBe(4000);
  });

  it("derives tzap create file progress and final archive-byte ratio", () => {
    const runningState: JobState = {
      snapshot: pollResponse({ kind: "tzapCreate", status: "running" }),
      events: [
        { eventType: "started", totalBytes: 1000, entries: 0, totalEntries: 2 },
        { eventType: "bytesProcessed", totalBytesProcessed: 500, totalBytes: 1000 },
        { eventType: "entryFinished", path: "one.bin", entries: 1, totalEntries: 2 },
      ],
    };

    const runningProgress = deriveJobProgress(runningState, Date.parse(startedAt) + 5000);

    expect(runningProgress.processedFiles).toBe(1);
    expect(runningProgress.totalFiles).toBe(2);
    expect(runningProgress.progressPercent).toBe(50);
    expect(runningProgress.compressionRatio).toBeNull();

    const completedState: JobState = {
      snapshot: pollResponse({
        kind: "tzapCreate",
        status: "completed",
        canDismiss: true,
        terminalSummary: {
          writtenEntries: 2,
          skippedEntries: null,
          writtenBytes: 420,
          warnings: [],
        },
      }),
      events: [
        { eventType: "started", totalBytes: 1000, entries: 0, totalEntries: 2 },
        { eventType: "bytesProcessed", totalBytesProcessed: 1000, totalBytes: 1000 },
        { eventType: "completed", jobKind: "tzapCreate" },
      ],
    };

    const completedProgress = deriveJobProgress(completedState, Date.parse(startedAt) + 5000);

    expect(completedProgress.compressedBytes).toBe(420);
    expect(completedProgress.compressionRatio).toBe(0.42);
    expect(completedProgress.progressPercent).toBe(100);
  });

  it("keeps tzap progress below completion across writer phases", () => {
    const planningComplete: JobState = {
      snapshot: pollResponse({ kind: "tzapCreate", status: "running" }),
      events: [
        { eventType: "started", totalBytes: 1000 },
        { eventType: "phaseStarted", phase: "planningPayload", totalBytes: 1000 },
        {
          eventType: "phaseBytesProcessed",
          phase: "planningPayload",
          totalBytes: 1000,
          totalBytesProcessed: 1000,
        },
      ],
    };
    const emittingHalf: JobState = {
      snapshot: planningComplete.snapshot,
      events: [
        ...planningComplete.events,
        { eventType: "phaseStarted", phase: "planningMetadata" },
        { eventType: "phaseStarted", phase: "emittingPayload", totalBytes: 1000 },
        {
          eventType: "phaseBytesProcessed",
          phase: "emittingPayload",
          totalBytes: 1000,
          totalBytesProcessed: 500,
        },
      ],
    };
    const committing: JobState = {
      snapshot: planningComplete.snapshot,
      events: [
        ...emittingHalf.events,
        { eventType: "phaseStarted", phase: "emittingMetadata" },
        { eventType: "phaseStarted", phase: "committingOutput" },
      ],
    };

    expect(deriveJobProgress(planningComplete).progressPercent).toBe(40);
    expect(deriveJobProgress(emittingHalf).progressPercent).toBe(68);
    expect(deriveJobProgress(committing).progressPercent).toBe(99);
  });

  it("derives create compression ratio from terminal output bytes", () => {
    const state: JobState = {
      snapshot: pollResponse({
        kind: "zipCreate",
        status: "completed",
        canDismiss: true,
        terminalSummary: {
          writtenEntries: 1,
          skippedEntries: null,
          writtenBytes: 25,
          warnings: [],
        },
      }),
      events: [
        { eventType: "started", totalBytes: 100, entries: 0, totalEntries: 1 },
        { eventType: "bytesProcessed", totalBytesProcessed: 100, totalBytes: 100 },
        { eventType: "completed", jobKind: "zipCreate" },
      ],
    };

    const progress = deriveJobProgress(state, Date.parse(startedAt) + 5000);

    expect(progress.processedBytes).toBe(100);
    expect(progress.compressedBytes).toBe(25);
    expect(progress.compressionRatio).toBe(0.25);
    expect(progress.progressPercent).toBe(100);
  });

  it("makes completed jobs determinate even when total bytes are unknown", () => {
    const state: JobState = {
      snapshot: pollResponse({
        status: "completed",
        canDismiss: true,
        terminalSummary: {
          writtenEntries: 2,
          skippedEntries: null,
          writtenBytes: 42,
          warnings: [],
        },
      }),
      events: [{ eventType: "completed", jobKind: "zipCreate" }],
    };

    const progress = deriveJobProgress(state, Date.parse(startedAt) + 5000);

    expect(progress.progressPercent).toBe(100);
    expect(progress.latestStatusMessage).toBe("completed");
  });

  it("stops failed and cancelled jobs at a determinate progress value", () => {
    const failed: JobState = {
      snapshot: pollResponse({ status: "failed", canDismiss: true }),
      events: [{ eventType: "failed", message: "Cannot write archive." }],
    };
    const cancelled: JobState = {
      snapshot: pollResponse({ status: "cancelled", canDismiss: true }),
      events: [{ eventType: "cancelled", message: "Cancelled." }],
    };

    expect(deriveJobProgress(failed).progressPercent).toBe(0);
    expect(deriveJobProgress(cancelled).progressPercent).toBe(0);
  });
});
