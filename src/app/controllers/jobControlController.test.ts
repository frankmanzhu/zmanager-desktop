import { describe, expect, it, vi } from "vitest";

import type {
  CommandErrorDto,
  JobEventDto,
  JobStatus,
  LegacyJobSnapshotDto,
  StartJobResponseDto,
} from "../../api/types";
import type { JobRetryContext } from "../jobs";
import { createJobsWorkspace, type FocusedJobAutoCloseAction, type JobOutputAction } from "../workspaces/jobsWorkspace";
import { createJobControlController, type JobControlControllerOptions } from "./jobControlController";

const createdAt = "2026-06-11T00:00:00Z";

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "queued",
    createdAt,
    ...overrides,
  };
}

function legacySnapshot(overrides: Partial<LegacyJobSnapshotDto> = {}): LegacyJobSnapshotDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "running",
    createdAt,
    canDismiss: false,
    events: [],
    terminalSummary: null,
    ...overrides,
  };
}

function passwordFailure(code = "password_required"): JobEventDto {
  return {
    eventType: "failed",
    code,
    message: "Password required.",
    severity: "error",
    retryable: true,
  };
}

function passwordFailureWithoutCode(): JobEventDto {
  const failure = passwordFailure();
  delete failure.code;
  return failure;
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "Command failed.",
    hint: null,
    severity: "error",
    retryable: true,
    ...overrides,
  };
}

function createHarness(overrides: Partial<JobControlControllerOptions> = {}) {
  const workspace = createJobsWorkspace();
  const calls = {
    addJobs: [] as Array<{ response: StartJobResponseDto; options: unknown }>,
    closeAppWindow: 0,
    closeFocusedJobProgress: 0,
    messages: [] as string[],
    outputActions: [] as JobOutputAction[],
    renderJobs: 0,
    renderQuickProgress: 0,
    revealQuickActionJobWindow: 0,
    scheduledAutoClose: 0,
    statuses: [] as string[],
  };
  let autoClosePending = false;
  let autoCloseCallback: (() => void) | null = null;
  let backgrounded = false;
  let canEvaluateCompletion = true;
  let promptPassword: string | null = "secret";
  const cancelJob = vi.fn(async ({ jobId }: { jobId: string }) => ({ jobId, status: "cancelled" as JobStatus, revision: "1" }));
  const pauseJob = vi.fn(async ({ jobId }: { jobId: string }) => ({ jobId, status: "paused" as JobStatus, revision: "1" }));
  const resumeJob = vi.fn(async ({ jobId }: { jobId: string }) => ({ jobId, status: "running" as JobStatus, revision: "1" }));
  const dismissJob = vi.fn(async () => {});
  const runTestArchive = vi.fn(async () => startJobResponse({ jobId: "retry-test" }));
  const runStartExtract = vi.fn(async () => startJobResponse({ jobId: "retry-extract" }));
  const runOutputAction = vi.fn(async (outputAction: JobOutputAction) => {
    calls.outputActions.push(outputAction);
  });

  const controller = createJobControlController({
    workspace,
    quickActionAutoCloseTimer: {
      hasQuickActionAutoClosePending() {
        return autoClosePending;
      },
      scheduleQuickActionAutoClose(callback) {
        calls.scheduledAutoClose += 1;
        autoCloseCallback = callback;
        autoClosePending = true;
      },
    },
    cancelJob,
    pauseJob,
    resumeJob,
    dismissJob,
    runTestArchive,
    runStartExtract,
    addJob(response, options) {
      calls.addJobs.push({ response, options });
      workspace.addJob(response, options);
    },
    retryOutputActions(context) {
      return context.retryKind === "extractArchive"
        ? [{ kind: "open", path: context.destinationPath }]
        : [];
    },
    runOutputAction,
    promptForCommandRetry: vi.fn(() => promptPassword),
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    message(key) {
      return `message:${key}`;
    },
    setOperationalMessage(key) {
      calls.messages.push(key);
    },
    setOperationalStatus(message) {
      calls.statuses.push(message);
    },
    renderJobs() {
      calls.renderJobs += 1;
    },
    renderQuickProgress() {
      calls.renderQuickProgress += 1;
    },
    canEvaluateQuickActionCompletion() {
      return canEvaluateCompletion;
    },
    isQuickActionWindowBackgrounded() {
      return backgrounded;
    },
    async revealQuickActionJobWindow() {
      calls.revealQuickActionJobWindow += 1;
    },
    async closeFocusedJobProgress() {
      calls.closeFocusedJobProgress += 1;
    },
    closeAppWindow() {
      calls.closeAppWindow += 1;
    },
    ...overrides,
  });

  function addTrackedJob(jobId: string, status: JobStatus, autoCloseAction?: FocusedJobAutoCloseAction) {
    workspace.addJob(startJobResponse({ jobId, status }));
    workspace.trackFocusedQuickActionJob(jobId);
    if (autoCloseAction) {
      workspace.setFocusedJobAutoCloseAction(autoCloseAction);
    }
  }

  function markJobFailedForRetry(jobId: string, context: JobRetryContext, failure = passwordFailure()) {
    workspace.addJob(startJobResponse({ jobId }), { retryContext: context });
    workspace.replaceLegacySnapshotFixture(legacySnapshot({
      jobId,
      status: "failed",
      canDismiss: true,
      events: [failure],
    }));
  }

  return {
    addTrackedJob,
    autoCloseCallback: () => autoCloseCallback,
    calls,
    cancelJob,
    controller,
    dismissJob,
    markJobFailedForRetry,
    pauseJob,
    resumeJob,
    runOutputAction,
    runStartExtract,
    runTestArchive,
    setAutoClosePending(value: boolean) {
      autoClosePending = value;
    },
    setBackgrounded(value: boolean) {
      backgrounded = value;
    },
    setCanEvaluateCompletion(value: boolean) {
      canEvaluateCompletion = value;
    },
    setPromptPassword(value: string | null) {
      promptPassword = value;
    },
    workspace,
  };
}

describe("job control controller", () => {
  it("pauses focused quick-action jobs and updates optimistic statuses", async () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "running");
    harness.addTrackedJob("job-2", "queued");

    await harness.controller.toggleQuickActionPause();

    expect(harness.pauseJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(harness.pauseJob).toHaveBeenCalledWith({ jobId: "job-2" });
    expect(harness.workspace.getJob("job-1")?.snapshot.status).toBe("paused");
    expect(harness.workspace.getJob("job-2")?.snapshot.status).toBe("paused");
    expect(harness.calls.messages).toEqual(["jobs.paused"]);
  });

  it("resumes all controllable focused quick-action jobs when any tracked job is paused", async () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "paused");
    harness.addTrackedJob("job-2", "running");

    await harness.controller.toggleQuickActionPause();

    expect(harness.resumeJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(harness.resumeJob).toHaveBeenCalledWith({ jobId: "job-2" });
    expect(harness.calls.messages).toEqual(["jobs.continued"]);
  });

  it("maps quick-action pause command failures to the update fallback and renders jobs", async () => {
    const harness = createHarness({
      pauseJob: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    harness.addTrackedJob("job-1", "running");

    await harness.controller.toggleQuickActionPause();

    expect(harness.calls.statuses).toEqual(["message:jobs.updateFailed"]);
    expect(harness.calls.renderJobs).toBe(1);
  });

  it("cancels focused quick-action jobs and returns to workspace when configured", async () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "running", "returnToWorkspace");
    harness.addTrackedJob("job-2", "paused");

    await harness.controller.cancelFocusedQuickActionJobs();

    expect(harness.cancelJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(harness.cancelJob).toHaveBeenCalledWith({ jobId: "job-2" });
    expect(harness.calls.messages).toEqual(["jobs.cancelled"]);
    expect(harness.calls.closeFocusedJobProgress).toBe(1);
    expect(harness.calls.closeAppWindow).toBe(0);
  });

  it("cancels focused quick-action jobs and closes the app window by default", async () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "running", "closeWindow");

    await harness.controller.cancelFocusedQuickActionJobs();

    expect(harness.calls.closeAppWindow).toBe(1);
    expect(harness.calls.closeFocusedJobProgress).toBe(0);
  });

  it("maps quick-action cancel failures to the cancel fallback and renders jobs", async () => {
    const harness = createHarness({
      cancelJob: vi.fn(async () => {
        throw commandError({ message: "Nope." });
      }),
    });
    harness.addTrackedJob("job-1", "running");

    await harness.controller.cancelFocusedQuickActionJobs();

    expect(harness.calls.statuses).toEqual(["Nope."]);
    expect(harness.calls.renderJobs).toBe(1);
  });

  it("waits before closing completed quick-action windows when completion cannot be evaluated", () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "completed");
    harness.setCanEvaluateCompletion(false);

    harness.controller.maybeCloseCompletedQuickActionWindow();

    expect(harness.calls.messages).toEqual([]);
    expect(harness.calls.scheduledAutoClose).toBe(0);
  });

  it("reveals backgrounded quick-action windows when completed jobs need attention", () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "failed");
    harness.setBackgrounded(true);

    harness.controller.maybeCloseCompletedQuickActionWindow();

    expect(harness.calls.messages).toEqual(["jobs.needsAttention"]);
    expect(harness.calls.revealQuickActionJobWindow).toBe(1);
    expect(harness.calls.renderQuickProgress).toBe(0);
  });

  it("renders quick progress when foreground completed jobs need attention", () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "cancelled");

    harness.controller.maybeCloseCompletedQuickActionWindow();

    expect(harness.calls.messages).toEqual(["jobs.needsAttention"]);
    expect(harness.calls.renderQuickProgress).toBe(1);
  });

  it("schedules auto-close for completed quick-action jobs and runs the configured close action", () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "completed", "returnToWorkspace");

    harness.controller.maybeCloseCompletedQuickActionWindow();
    harness.autoCloseCallback()?.();

    expect(harness.calls.messages).toEqual(["jobs.completed"]);
    expect(harness.calls.renderQuickProgress).toBe(1);
    expect(harness.calls.scheduledAutoClose).toBe(1);
    expect(harness.calls.closeFocusedJobProgress).toBe(1);
  });

  it("does not schedule another quick-action auto-close when one is already pending", () => {
    const harness = createHarness();
    harness.addTrackedJob("job-1", "completed");
    harness.setAutoClosePending(true);

    harness.controller.maybeCloseCompletedQuickActionWindow();

    expect(harness.calls.scheduledAutoClose).toBe(0);
  });

  it("retries password-required test jobs with the prompted password", async () => {
    const harness = createHarness();
    const context: JobRetryContext = {
      retryKind: "testArchive",
      archivePath: "C:/archive.zip",
      entryPaths: ["docs/readme.txt"],
    };
    harness.markJobFailedForRetry("job-1", context);

    await harness.controller.retryJobWithPasswordPrompt("job-1");

    expect(harness.runTestArchive).toHaveBeenCalledWith({
      archivePath: "C:/archive.zip",
      entryPaths: ["docs/readme.txt"],
      password: "secret",
    });
    expect(harness.calls.addJobs[0]).toMatchObject({
      response: { jobId: "retry-test" },
      options: { retryContext: context, outputActions: [] },
    });
    expect(harness.calls.messages).toContain("jobs.passwordRetryStarted");
  });

  it("retries password-required extract jobs with a rebuilt extract request and output actions", async () => {
    const harness = createHarness();
    const context: JobRetryContext = {
      retryKind: "extractArchive",
      archivePath: "C:/archive.zip",
      destinationPath: "C:/out",
      overwrite: "rename",
      destinationCollisionStrategy: "rename",
      entryPaths: ["docs/readme.txt"],
      stripComponents: 1,
    };
    harness.markJobFailedForRetry("job-1", context);

    await harness.controller.retryJobWithPasswordPrompt("job-1");

    expect(harness.runStartExtract).toHaveBeenCalledWith({
      archivePath: "C:/archive.zip",
      destinationPath: "C:/out",
      overwrite: "rename",
      destinationCollisionStrategy: "rename",
      entryPaths: ["docs/readme.txt"],
      stripComponents: 1,
      tzapRestorePolicy: "portable",
      tzapAllowDegraded: false,
      tzapAllowAbsoluteSymlinks: false,
      password: "secret",
    });
    expect(harness.calls.addJobs[0]).toMatchObject({
      response: { jobId: "retry-extract" },
      options: {
        retryContext: context,
        outputActions: [{ kind: "open", path: "C:/out" }],
      },
    });
  });

  it("does not retry password jobs when details are unavailable, failure code is missing, or prompt is cancelled", async () => {
    const harness = createHarness();
    const context: JobRetryContext = {
      retryKind: "testArchive",
      archivePath: "C:/archive.zip",
    };

    await harness.controller.retryJobWithPasswordPrompt("missing");
    harness.markJobFailedForRetry("job-1", context, passwordFailureWithoutCode());
    await harness.controller.retryJobWithPasswordPrompt("job-1");
    harness.markJobFailedForRetry("job-2", context);
    harness.setPromptPassword(null);
    await harness.controller.retryJobWithPasswordPrompt("job-2");

    expect(harness.runTestArchive).not.toHaveBeenCalled();
    expect(harness.calls.messages).toEqual([
      "jobs.retryUnavailable",
      "jobs.retryUnavailable",
      "jobs.passwordRetryCancelled",
    ]);
  });

  it("reports password retry start failures with the fallback message", async () => {
    const harness = createHarness({
      runTestArchive: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    harness.markJobFailedForRetry("job-1", {
      retryKind: "testArchive",
      archivePath: "C:/archive.zip",
    });

    await harness.controller.retryJobWithPasswordPrompt("job-1");

    expect(harness.calls.statuses).toEqual(["message:jobs.passwordRetryFailed"]);
  });

  it("prompts for password retry at most once per eligible job", async () => {
    const harness = createHarness();
    harness.markJobFailedForRetry("job-1", {
      retryKind: "testArchive",
      archivePath: "C:/archive.zip",
    });

    await harness.controller.maybePromptForJobPasswordRetry("job-1");
    await harness.controller.maybePromptForJobPasswordRetry("job-1");

    expect(harness.runTestArchive).toHaveBeenCalledTimes(1);
  });

  it("runs row cancel, pause, and resume commands then polls", async () => {
    const harness = createHarness();

    await harness.controller.onCancelJob("job-1");
    await harness.controller.onPauseJob("job-2");
    await harness.controller.onResumeJob("job-3");

    expect(harness.cancelJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(harness.pauseJob).toHaveBeenCalledWith({ jobId: "job-2" });
    expect(harness.resumeJob).toHaveBeenCalledWith({ jobId: "job-3" });
  });

  it("reports row pause and resume failures with the update fallback", async () => {
    const harness = createHarness({
      pauseJob: vi.fn(async () => {
        throw new Error("pause failed");
      }),
      resumeJob: vi.fn(async () => {
        throw commandError({ message: "Resume denied." });
      }),
    });

    await harness.controller.onPauseJob("job-1");
    await harness.controller.onResumeJob("job-1");

    expect(harness.calls.statuses).toEqual(["message:jobs.updateFailed", "Resume denied."]);
  });

  it("dismisses jobs and renders when the last job is removed", async () => {
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse({ jobId: "job-1" }));

    await harness.controller.onDismissJob("job-1");

    expect(harness.dismissJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(harness.workspace.hasJob("job-1")).toBe(false);
    expect(harness.calls.renderJobs).toBe(1);
  });

  it("runs ready output actions and reports unavailable or failed output actions", async () => {
    const harness = createHarness();
    harness.workspace.addJob(startJobResponse({ jobId: "job-1", status: "completed" }), {
      outputActions: [{ kind: "open", path: "C:/out" }],
    });

    await harness.controller.onJobOutputAction("job-1", "0", "open");
    await harness.controller.onJobOutputAction("job-1", "1", "open");
    harness.runOutputAction.mockRejectedValueOnce(new Error("Could not open."));
    await harness.controller.onJobOutputAction("job-1", "0", "open");

    expect(harness.calls.outputActions).toEqual([{ kind: "open", path: "C:/out" }]);
    expect(harness.calls.messages).toEqual(["jobs.outputUnavailable"]);
    expect(harness.calls.statuses).toEqual(["Could not open."]);
  });
});
