import { describe, expect, it, vi } from "vitest";

import type { CommandErrorDto, PollJobEventsResponseDto, StartJobResponseDto } from "../../api/types";
import { createJobsWorkspace } from "../workspaces/jobsWorkspace";
import { createJobPollingController, type JobPollingControllerOptions } from "./jobPollingController";

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

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "poll failed",
    hint: null,
    severity: "error",
    retryable: true,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createHarness(overrides: Partial<JobPollingControllerOptions> = {}) {
  const workspace = createJobsWorkspace();
  const calls = {
    startPolling: 0,
    stopPolling: 0,
    startProgressClock: 0,
    stopProgressClock: 0,
    renderJobs: 0,
    closeQuickAction: 0,
    statuses: [] as string[],
    promptedJobIds: [] as string[],
  };
  let pollingCallback: (() => void) | null = null;
  let progressClockCallback: (() => void) | null = null;
  const pollJobEvents = vi.fn(async (jobId: string) => pollResponse({ jobId }));

  const controller = createJobPollingController({
    workspace,
    timers: {
      startPolling(callback) {
        calls.startPolling += 1;
        pollingCallback = callback;
      },
      stopPolling() {
        calls.stopPolling += 1;
      },
      startProgressClock(callback) {
        calls.startProgressClock += 1;
        progressClockCallback = callback;
      },
      stopProgressClock() {
        calls.stopProgressClock += 1;
      },
    },
    pollJobEvents,
    async maybePromptForJobPasswordRetry(jobId) {
      calls.promptedJobIds.push(jobId);
    },
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    readProgressFailedMessage() {
      return "Could not read progress.";
    },
    setOperationalStatus(message) {
      calls.statuses.push(message);
    },
    renderJobs() {
      calls.renderJobs += 1;
    },
    maybeCloseCompletedQuickActionWindow() {
      calls.closeQuickAction += 1;
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    flushPollingCallback() {
      pollingCallback?.();
    },
    flushProgressClockCallback() {
      progressClockCallback?.();
    },
    pollJobEvents,
    workspace,
  };
}

describe("job polling controller", () => {
  it("stops polling and renders when there are no pollable jobs", async () => {
    const harness = createHarness();

    await harness.controller.pollJobs();

    expect(harness.calls.stopPolling).toBe(1);
    expect(harness.calls.renderJobs).toBe(1);
    expect(harness.calls.closeQuickAction).toBe(1);
    expect(harness.pollJobEvents).not.toHaveBeenCalled();
  });

  it("polls current jobs, merges snapshots, prompts for retry, and renders", async () => {
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse({ jobId: "job-1" }));
    harness.workspace.addJob(startJobResponse({ jobId: "job-2" }));
    harness.pollJobEvents
      .mockResolvedValueOnce(pollResponse({ jobId: "job-1", status: "running" }))
      .mockResolvedValueOnce(pollResponse({ jobId: "job-2", status: "completed", canDismiss: true }));

    await harness.controller.pollJobs();

    expect(harness.pollJobEvents).toHaveBeenCalledWith("job-1");
    expect(harness.pollJobEvents).toHaveBeenCalledWith("job-2");
    expect(harness.workspace.getJob("job-1")?.snapshot.status).toBe("running");
    expect(harness.workspace.getJob("job-2")?.snapshot.status).toBe("completed");
    expect(harness.calls.promptedJobIds).toEqual(["job-1", "job-2"]);
    expect(harness.calls.renderJobs).toBe(1);
    expect(harness.calls.closeQuickAction).toBe(1);
  });

  it("removes missing jobs without surfacing an operational error", async () => {
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse());
    harness.pollJobEvents.mockRejectedValueOnce(commandError({ code: "not_found", message: "gone" }));

    await harness.controller.pollJobs();

    expect(harness.workspace.hasJob("job-1")).toBe(false);
    expect(harness.calls.statuses).toEqual([]);
    expect(harness.calls.renderJobs).toBe(1);
  });

  it("marks failed jobs and reports non-not-found polling errors", async () => {
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse());
    harness.pollJobEvents.mockRejectedValueOnce(commandError({ code: "io", message: "disk unavailable" }));

    await harness.controller.pollJobs();

    const job = harness.workspace.getJob("job-1");
    expect(job?.snapshot.status).toBe("failed");
    expect(job?.events.at(-1)).toMatchObject({
      eventType: "failed",
      code: "io",
      message: "disk unavailable",
      retryable: true,
    });
    expect(harness.calls.statuses).toEqual(["disk unavailable"]);
  });

  it("requests another poll while one is in flight and reruns after finish", async () => {
    const pending = deferred<PollJobEventsResponseDto>();
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse());
    harness.pollJobEvents
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(pollResponse({ status: "completed", canDismiss: true }));

    const firstPoll = harness.controller.pollJobs();
    await harness.controller.pollJobs();
    expect(harness.pollJobEvents).toHaveBeenCalledTimes(1);

    pending.resolve(pollResponse({ status: "running" }));
    await firstPoll;
    await vi.waitFor(() => expect(harness.pollJobEvents).toHaveBeenCalledTimes(2));

    expect(harness.workspace.getJob("job-1")?.snapshot.status).toBe("completed");
  });

  it("routes polling and progress-clock timers through the injected adapter", () => {
    const harness = createHarness();

    harness.controller.schedulePolling();
    harness.controller.scheduleProgressClock();
    harness.flushProgressClockCallback();
    harness.controller.stopProgressClock();
    harness.controller.stopPolling();

    expect(harness.calls.startPolling).toBe(1);
    expect(harness.calls.startProgressClock).toBe(1);
    expect(harness.calls.renderJobs).toBe(1);
    expect(harness.calls.stopProgressClock).toBe(1);
    expect(harness.calls.stopPolling).toBe(1);
  });

  it("syncs progress clock from supplied or current snapshots", () => {
    const harness = createHarness();

    harness.controller.syncProgressClock({ shouldRun: true });
    harness.controller.syncProgressClock({ shouldRun: false });
    harness.controller.syncProgressClock();

    expect(harness.calls.startProgressClock).toBe(1);
    expect(harness.calls.stopProgressClock).toBe(2);
  });
});
