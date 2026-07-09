import type { CommandErrorDto, JobEventDto, PollJobEventsResponseDto } from "../../api/types";
import type { JobPollingDecision } from "../jobs";
import type { JobsWorkspace, ProgressClockSnapshot } from "../workspaces/jobsWorkspace";

export type JobPollingTimer = Readonly<{
  startPolling(callback: () => void): void;
  stopPolling(): void;
  startProgressClock(callback: () => void): void;
  stopProgressClock(): void;
}>;

export type JobPollingControllerOptions = Readonly<{
  workspace: Pick<
    JobsWorkspace,
    | "beginPolling"
    | "finishPolling"
    | "getProgressClockSnapshot"
    | "hasJob"
    | "markJobFailed"
    | "mergePolledSnapshot"
    | "removeJob"
  >;
  timers: JobPollingTimer;
  pollJobEvents(jobId: string): Promise<PollJobEventsResponseDto>;
  maybePromptForJobPasswordRetry(jobId: string): Promise<void>;
  toCommandError(error: unknown): CommandErrorDto | null;
  readProgressFailedMessage(): string;
  setOperationalStatus(message: string): void;
  renderJobs(): void;
  maybeCloseCompletedQuickActionWindow(): void;
}>;

export type JobPollingController = Readonly<{
  pollJobs(): Promise<void>;
  schedulePolling(): void;
  stopPolling(): void;
  scheduleProgressClock(): void;
  stopProgressClock(): void;
  syncProgressClock(snapshot?: ProgressClockSnapshot): void;
}>;

function failedEventFromError(
  commandError: CommandErrorDto | null,
  fallbackMessage: string,
): JobEventDto {
  return {
    eventType: "failed",
    code: commandError?.code,
    hint: commandError?.hint,
    severity: "error",
    retryable: true,
    message: commandError?.message ?? fallbackMessage,
  };
}

export function createJobPollingController(
  options: JobPollingControllerOptions,
): JobPollingController {
  async function pollJob(jobId: string): Promise<void> {
    if (!options.workspace.hasJob(jobId)) {
      return;
    }

    try {
      const snapshot = await options.pollJobEvents(jobId);
      options.workspace.mergePolledSnapshot(snapshot);
      await options.maybePromptForJobPasswordRetry(jobId);
    } catch (error) {
      const commandError = options.toCommandError(error);
      if (commandError?.code === "not_found") {
        options.workspace.removeJob(jobId);
        return;
      }

      const messageText = commandError?.message ?? options.readProgressFailedMessage();
      options.workspace.markJobFailed(jobId, failedEventFromError(commandError, messageText));
      options.setOperationalStatus(messageText);
    }
  }

  async function runPollDecision(decision: Extract<JobPollingDecision, { action: "poll" }>): Promise<void> {
    try {
      await Promise.all(decision.jobIds.map((jobId) => pollJob(jobId)));
      options.renderJobs();
      options.maybeCloseCompletedQuickActionWindow();
    } finally {
      const finish = options.workspace.finishPolling();
      if (finish.shouldPollAgain) {
        void pollJobs();
      }
    }
  }

  async function pollJobs(): Promise<void> {
    const decision = options.workspace.beginPolling();
    if (decision.action === "requestAgain") {
      return;
    }

    if (decision.action === "stop") {
      options.timers.stopPolling();
      options.renderJobs();
      options.maybeCloseCompletedQuickActionWindow();
      return;
    }

    await runPollDecision(decision);
  }

  function schedulePolling(): void {
    options.timers.startPolling(() => {
      void pollJobs();
    });
  }

  function scheduleProgressClock(): void {
    options.timers.startProgressClock(() => {
      options.renderJobs();
    });
  }

  function stopProgressClock(): void {
    options.timers.stopProgressClock();
  }

  function syncProgressClock(snapshot: ProgressClockSnapshot = options.workspace.getProgressClockSnapshot()): void {
    if (snapshot.shouldRun) {
      scheduleProgressClock();
    } else {
      stopProgressClock();
    }
  }

  return {
    pollJobs,
    schedulePolling,
    stopPolling(): void {
      options.timers.stopPolling();
    },
    scheduleProgressClock,
    stopProgressClock,
    syncProgressClock,
  };
}
