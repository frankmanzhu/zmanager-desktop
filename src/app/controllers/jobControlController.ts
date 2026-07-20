import type {
  CancelJobRequest,
  CommandErrorDto,
  DismissJobRequest,
  JobControlResponseDto,
  PauseJobRequest,
  ResumeJobRequest,
  StartExtractRequest,
  StartJobResponseDto,
  TestArchiveRequest,
} from "../../api/types";
import { unknownErrorMessage } from "../dialogs";
import { buildStartExtractRequest } from "../extractFlow";
import type { MessageKey, MessageParams } from "../i18n/translator";
import type { JobRetryContext } from "../jobs";
import type {
  FocusedJobAutoCloseAction,
  FocusedJobProgressContext,
  JobOutputAction,
  JobsWorkspace,
} from "../workspaces/jobsWorkspace";

export type JobControlAddJobOptions = Readonly<{
  retryContext?: JobRetryContext;
  focusProgress?: boolean;
  autoCloseAction?: FocusedJobAutoCloseAction;
  progressContext?: FocusedJobProgressContext;
  outputActions?: JobOutputAction[];
}>;

export type JobControlControllerWorkspace = Pick<
  JobsWorkspace,
  | "getControllableFocusedQuickActionJobIds"
  | "getFocusedJobAutoCloseAction"
  | "getJob"
  | "getOutputAction"
  | "getPasswordRetryDetails"
  | "hasJobs"
  | "markPasswordRetryPromptedIfEligible"
  | "removeJob"
  | "selectFocusedQuickActionCompletion"
  | "updateJobStatus"
>;

export type QuickActionAutoCloseTimer = Readonly<{
  hasQuickActionAutoClosePending(): boolean;
  scheduleQuickActionAutoClose(callback: () => void): void;
}>;

export type JobControlControllerOptions = Readonly<{
  workspace: JobControlControllerWorkspace;
  quickActionAutoCloseTimer: QuickActionAutoCloseTimer;
  cancelJob(request: CancelJobRequest): Promise<JobControlResponseDto>;
  pauseJob(request: PauseJobRequest): Promise<JobControlResponseDto>;
  resumeJob(request: ResumeJobRequest): Promise<JobControlResponseDto>;
  dismissJob(request: DismissJobRequest): Promise<void>;
  runTestArchive(request: TestArchiveRequest): Promise<StartJobResponseDto>;
  runStartExtract(request: StartExtractRequest): Promise<StartJobResponseDto>;
  addJob(response: StartJobResponseDto, options?: JobControlAddJobOptions): void;
  retryOutputActions(context: JobRetryContext): JobOutputAction[];
  runOutputAction(outputAction: JobOutputAction): Promise<void>;
  promptForCommandRetry(commandCode: string): string | null;
  toCommandError(error: unknown): CommandErrorDto | null;
  message(key: MessageKey, params?: MessageParams): string;
  setOperationalMessage(key: MessageKey, params?: MessageParams): void;
  setOperationalStatus(message: string): void;
  renderJobs(): void;
  renderQuickProgress(): void;
  canEvaluateQuickActionCompletion(): boolean;
  isQuickActionWindowBackgrounded(): boolean;
  revealQuickActionJobWindow(): Promise<void>;
  closeFocusedJobProgress(): Promise<void>;
  closeAppWindow(): void;
}>;

export type JobControlController = Readonly<{
  toggleQuickActionPause(): Promise<void>;
  cancelFocusedQuickActionJobs(): Promise<void>;
  maybeCloseCompletedQuickActionWindow(): void;
  startPasswordRetryJob(context: JobRetryContext, password: string): Promise<StartJobResponseDto>;
  retryJobWithPasswordPrompt(jobId: string): Promise<void>;
  maybePromptForJobPasswordRetry(jobId: string): Promise<void>;
  onCancelJob(jobId: string): Promise<void>;
  onPauseJob(jobId: string): Promise<void>;
  onResumeJob(jobId: string): Promise<void>;
  onDismissJob(jobId: string): Promise<void>;
  onJobOutputAction(jobId?: string, indexValue?: string, kind?: string): Promise<void>;
}>;

export function createJobControlController(
  options: JobControlControllerOptions,
): JobControlController {
  function quickActionControllableJobIds(): string[] {
    return [...options.workspace.getControllableFocusedQuickActionJobIds()];
  }

  async function closeFocusedQuickActionProgress(): Promise<void> {
    if (options.workspace.getFocusedJobAutoCloseAction() === "returnToWorkspace") {
      await options.closeFocusedJobProgress();
      return;
    }

    options.closeAppWindow();
  }

  async function toggleQuickActionPause(): Promise<void> {
    const jobIds = quickActionControllableJobIds();
    if (!jobIds.length) {
      return;
    }

    const shouldResume = jobIds.some((jobId) => options.workspace.getJob(jobId)?.snapshot.status === "paused");
    const command = shouldResume ? options.resumeJob : options.pauseJob;

    try {
      await Promise.all(
        jobIds.map(async (jobId) => {
          const response = await command({ jobId });
          options.workspace.updateJobStatus(jobId, response.status);
        }),
      );
      options.setOperationalMessage(shouldResume ? "jobs.continued" : "jobs.paused");
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(commandError?.message ?? options.message("jobs.updateFailed"));
      options.renderJobs();
    }
  }

  async function cancelFocusedQuickActionJobs(): Promise<void> {
    const jobIds = quickActionControllableJobIds();
    if (!jobIds.length) {
      return;
    }

    try {
      await Promise.all(jobIds.map((jobId) => options.cancelJob({ jobId })));
      options.setOperationalMessage("jobs.cancelled");
      await closeFocusedQuickActionProgress();
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(commandError?.message ?? options.message("jobs.cancelFailed"));
      options.renderJobs();
    }
  }

  function maybeCloseCompletedQuickActionWindow(): void {
    const decision = options.workspace.selectFocusedQuickActionCompletion({
      canEvaluate: options.canEvaluateQuickActionCompletion(),
      autoClosePending: options.quickActionAutoCloseTimer.hasQuickActionAutoClosePending(),
    });

    if (decision.action === "wait") {
      return;
    }

    if (decision.action === "needsAttention") {
      options.setOperationalMessage("jobs.needsAttention");
      if (options.isQuickActionWindowBackgrounded()) {
        void options.revealQuickActionJobWindow();
      } else {
        options.renderQuickProgress();
      }
      return;
    }

    options.setOperationalMessage("jobs.completed");
    options.renderQuickProgress();
    options.quickActionAutoCloseTimer.scheduleQuickActionAutoClose(() => {
      void closeFocusedQuickActionProgress();
    });
  }

  async function startPasswordRetryJob(
    context: JobRetryContext,
    password: string,
  ): Promise<StartJobResponseDto> {
    if (context.retryKind === "testArchive") {
      return options.runTestArchive({
        archivePath: context.archivePath,
        entryPaths: context.entryPaths,
        password,
      });
    }

    return options.runStartExtract(buildStartExtractRequest({
      archivePath: context.archivePath,
      destinationPath: context.destinationPath,
      overwrite: context.overwrite,
      destinationCollisionStrategy: context.destinationCollisionStrategy,
      entryPaths: context.entryPaths,
      stripComponents: context.stripComponents,
      tzapRestorePolicy: context.tzapRestorePolicy ?? "portable",
      tzapAllowDegraded: context.tzapAllowDegraded ?? false,
      tzapAllowAbsoluteSymlinks: context.tzapAllowAbsoluteSymlinks ?? false,
      password,
    }));
  }

  async function retryJobWithPasswordPrompt(jobId: string): Promise<void> {
    const retryDetails = options.workspace.getPasswordRetryDetails(jobId);
    if (!retryDetails?.failure.code) {
      options.setOperationalMessage("jobs.retryUnavailable");
      return;
    }

    const password = options.promptForCommandRetry(retryDetails.failure.code);
    if (!password) {
      options.setOperationalMessage("jobs.passwordRetryCancelled");
      return;
    }

    try {
      const response = await startPasswordRetryJob(retryDetails.context, password);
      options.addJob(response, {
        retryContext: retryDetails.context,
        outputActions: options.retryOutputActions(retryDetails.context),
      });
      options.setOperationalMessage("jobs.passwordRetryStarted");
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(commandError?.message ?? options.message("jobs.passwordRetryFailed"));
    }
  }

  async function maybePromptForJobPasswordRetry(jobId: string): Promise<void> {
    if (!options.workspace.markPasswordRetryPromptedIfEligible(jobId)) {
      return;
    }

    await retryJobWithPasswordPrompt(jobId);
  }

  async function onCancelJob(jobId: string): Promise<void> {
    try {
      await options.cancelJob({ jobId });
    } catch (error) {
      const commandError = options.toCommandError(error);
      if (commandError) {
        options.setOperationalStatus(commandError.message);
      }
    }
  }

  async function onPauseJob(jobId: string): Promise<void> {
    try {
      await options.pauseJob({ jobId });
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(commandError?.message ?? options.message("jobs.updateFailed"));
    }
  }

  async function onResumeJob(jobId: string): Promise<void> {
    try {
      await options.resumeJob({ jobId });
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(commandError?.message ?? options.message("jobs.updateFailed"));
    }
  }

  async function onJobOutputAction(jobId?: string, indexValue?: string, kind?: string): Promise<void> {
    const resolution = options.workspace.getOutputAction({
      jobId,
      index: Number(indexValue),
      kind,
    });
    if (resolution.action === "unavailable") {
      options.setOperationalMessage("jobs.outputUnavailable");
      return;
    }

    try {
      await options.runOutputAction(resolution.outputAction);
    } catch (error) {
      options.setOperationalStatus(unknownErrorMessage(error, options.message("jobs.outputOpenFailed")));
    }
  }

  async function onDismissJob(jobId: string): Promise<void> {
    try {
      await options.dismissJob({ jobId });
      options.workspace.removeJob(jobId);
      options.renderJobs();
    } catch (error) {
      const commandError = options.toCommandError(error);
      if (commandError) {
        options.setOperationalStatus(commandError.message);
      }
    }
  }

  return {
    toggleQuickActionPause,
    cancelFocusedQuickActionJobs,
    maybeCloseCompletedQuickActionWindow,
    startPasswordRetryJob,
    retryJobWithPasswordPrompt,
    maybePromptForJobPasswordRetry,
    onCancelJob,
    onPauseJob,
    onResumeJob,
    onDismissJob,
    onJobOutputAction,
  };
}
