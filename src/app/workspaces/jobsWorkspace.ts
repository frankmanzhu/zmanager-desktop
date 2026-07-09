import type {
  JobEventDto,
  JobState,
  JobStatus,
  PollJobEventsResponseDto,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
} from "../../api/types";
import {
  canRetryJobWithPassword,
  createInitialJobState,
  deriveJobProgress,
  getLatestPasswordFailureEvent,
  isCreateJobKind,
  isLiveJobStatus,
  isTerminalJobStatus,
  mergePolledJobState,
  selectQuickActionJobCompletionDecision,
  selectJobPollingDecision,
  type JobProgressSnapshot,
  type JobPollingDecision,
  type JobRetryContext,
  type QuickActionJobCompletionDecision,
} from "../jobs";

export type JobOutputAction = {
  kind: "open" | "reveal";
  path: string;
};

export type FocusedJobAutoCloseAction = "closeWindow" | "returnToWorkspace";

export type FocusedJobProgressContext =
  | {
      kind: "create";
      sources: readonly string[];
      destinationPath: string;
      format: StartCreateRequest["format"];
      cleanSource: boolean;
      tzapRecoveryPercentage?: number;
    }
  | {
      kind: "extract";
      title: "archive" | "selection";
      archivePath: string;
      destinationPath: string;
      overwrite: StartExtractRequest["overwrite"];
      entryPaths?: readonly string[];
    };

export type AddJobStateOptions = {
  retryContext?: JobRetryContext;
  outputActions?: readonly JobOutputAction[];
};

export type JobPasswordRetryDetails = {
  state: JobState;
  context: JobRetryContext;
  failure: JobEventDto;
};

export type JobOutputActionLookup = {
  jobId?: string;
  index?: number;
  kind?: string;
};

export type JobOutputActionResolution =
  | {
      action: "ready";
      outputAction: JobOutputAction;
    }
  | {
      action: "unavailable";
    };

export type JobPollingFinish = {
  shouldPollAgain: boolean;
};

export type QuickActionCompletionOptions = {
  canEvaluate: boolean;
  autoClosePending: boolean;
};

export type ProgressClockSnapshot = {
  shouldRun: boolean;
};

export type JobListItemSnapshot = {
  jobId: string;
  kind: JobState["snapshot"]["kind"];
  status: JobState["snapshot"]["status"];
  canDismiss: boolean;
  events: readonly JobEventDto[];
  terminalSummary: JobState["snapshot"]["terminalSummary"];
  state: JobState;
  progress: JobProgressSnapshot;
  isTerminal: boolean;
  completedSizeLabelKey: "jobs.summary.archiveSize" | "jobs.summary.outputSize";
  canRetryPassword: boolean;
  readyOutputActions: readonly JobOutputAction[];
};

export type JobListSnapshot = {
  jobs: readonly JobListItemSnapshot[];
  activeJob:
    | {
        kind: JobState["snapshot"]["kind"];
        status: JobState["snapshot"]["status"];
      }
    | null;
  progressClock: ProgressClockSnapshot;
};

export type FocusedQuickActionProgressSnapshot =
  | {
      state: "empty";
      progressClock: ProgressClockSnapshot;
    }
  | {
      state: "tracking";
      jobCount: number;
      latestJob: {
        jobId: string;
        kind: JobState["snapshot"]["kind"];
        status: JobState["snapshot"]["status"];
      };
      latestContext?: FocusedJobProgressContext;
      allTerminal: boolean;
      allCompleted: boolean;
      anyActive: boolean;
      anyPaused: boolean;
      elapsedMs: number;
      remainingMs: number | null;
      processedFiles: number;
      totalFiles: number | null;
      processedBytes: number;
      totalBytes: number | null;
      compressedBytes: number | null;
      speedBytesPerSecond: number | null;
      progressPercent: number | null;
      currentFile: string;
      progressClock: ProgressClockSnapshot;
    };

export type JobsWorkspace = {
  hasJob(jobId: string): boolean;
  getJob(jobId: string): JobState | undefined;
  getJobs(): readonly JobState[];
  getJobsMap(): Map<string, JobState>;
  hasJobs(): boolean;
  hasActiveJob(): boolean;
  getProgressClockSnapshot(): ProgressClockSnapshot;
  getJobListSnapshot(nowMs: number): JobListSnapshot;
  getRetryContext(jobId: string): JobRetryContext | undefined;
  getOutputActions(jobId: string): readonly JobOutputAction[];
  getReadyOutputActions(jobId: string): readonly JobOutputAction[];
  getOutputAction(
    lookup: JobOutputActionLookup,
  ): JobOutputActionResolution;
  canRetryJobWithPassword(jobId: string, state?: JobState): boolean;
  getPasswordRetryDetails(jobId: string): JobPasswordRetryDetails | null;
  markPasswordRetryPromptedIfEligible(jobId: string): boolean;
  addJob(response: StartJobResponseDto, options?: AddJobStateOptions): JobState;
  mergePolledSnapshot(snapshot: PollJobEventsResponseDto): JobState;
  markJobFailed(jobId: string, event: JobEventDto): JobState | null;
  updateJobStatus(jobId: string, status: JobStatus): JobState | null;
  removeJob(jobId: string): boolean;
  clear(): void;
  beginPolling(): JobPollingDecision;
  finishPolling(): JobPollingFinish;
  setFocusedJobAutoCloseAction(action: FocusedJobAutoCloseAction): void;
  getFocusedJobAutoCloseAction(): FocusedJobAutoCloseAction;
  trackFocusedQuickActionJob(jobId: string, context?: FocusedJobProgressContext): void;
  clearFocusedQuickActionJobs(): void;
  resetFocusedQuickActionProgress(): void;
  getFocusedQuickActionJobIds(): readonly string[];
  getFocusedQuickActionJobs(): readonly JobState[];
  getFocusedQuickActionProgressContext(jobId: string): FocusedJobProgressContext | undefined;
  getFocusedQuickActionProgressSnapshot(nowMs: number): FocusedQuickActionProgressSnapshot;
  getControllableFocusedQuickActionJobIds(): readonly string[];
  selectFocusedQuickActionCompletion(
    options: QuickActionCompletionOptions,
  ): QuickActionJobCompletionDecision;
  replaceJobs(fixtures: readonly JobFixtureInput[]): void;
};

export type JobFixtureInput = JobState & {
  outputActions?: readonly JobOutputAction[];
  retryContext?: JobRetryContext;
};

function cloneJobEvent(event: JobEventDto): JobEventDto {
  return { ...event };
}

function cloneJobState(state: JobState): JobState {
  return {
    snapshot: {
      ...state.snapshot,
      events: state.snapshot.events.map(cloneJobEvent),
      terminalSummary: state.snapshot.terminalSummary
        ? {
            ...state.snapshot.terminalSummary,
            warnings: [...state.snapshot.terminalSummary.warnings],
          }
        : state.snapshot.terminalSummary ?? null,
    },
    events: state.events.map(cloneJobEvent),
  };
}

function cloneRetryContext(context: JobRetryContext): JobRetryContext {
  if (context.retryKind === "testArchive") {
    return {
      ...context,
      entryPaths: context.entryPaths ? [...context.entryPaths] : undefined,
    };
  }

  return {
    ...context,
    entryPaths: context.entryPaths ? [...context.entryPaths] : undefined,
  };
}

function cloneOutputAction(action: JobOutputAction): JobOutputAction {
  return { ...action };
}

function cloneFocusedProgressContext(
  context: FocusedJobProgressContext,
): FocusedJobProgressContext {
  if (context.kind === "create") {
    return {
      ...context,
      sources: [...context.sources],
    };
  }

  return {
    ...context,
    entryPaths: context.entryPaths ? [...context.entryPaths] : undefined,
  };
}

function sortedJobStates(jobs: Iterable<JobState>): JobState[] {
  return Array.from(jobs).sort((a, b) => b.snapshot.createdAt.localeCompare(a.snapshot.createdAt));
}

function activeJobFrom(jobs: readonly JobState[]): JobListSnapshot["activeJob"] {
  const active = jobs.find((state) => isLiveJobStatus(state.snapshot.status)) ?? jobs[0];

  if (!active) {
    return null;
  }

  return {
    kind: active.snapshot.kind,
    status: active.snapshot.status,
  };
}

function progressClockSnapshot(jobs: Iterable<JobState>): ProgressClockSnapshot {
  return {
    shouldRun: Array.from(jobs).some((state) => isLiveJobStatus(state.snapshot.status)),
  };
}

function readyOutputActionsFor(
  job: JobState | undefined,
  actions: readonly JobOutputAction[] | undefined,
): JobOutputAction[] {
  if (!job || job.snapshot.status !== "completed") {
    return [];
  }

  return (actions ?? [])
    .filter((action) => (action.kind === "open" || action.kind === "reveal") && Boolean(action.path))
    .map(cloneOutputAction);
}

function aggregateFocusedQuickActionProgress(
  trackedJobs: readonly JobState[],
  progressSnapshots: readonly JobProgressSnapshot[],
): Omit<Extract<FocusedQuickActionProgressSnapshot, { state: "tracking" }>, "state" | "latestJob" | "latestContext" | "progressClock" | "jobCount"> {
  const allTerminal = trackedJobs.every((job) => isTerminalJobStatus(job.snapshot.status));
  const allCompleted = trackedJobs.every((job) => job.snapshot.status === "completed");
  const anyActive = trackedJobs.some((job) => isLiveJobStatus(job.snapshot.status));
  const anyPaused = trackedJobs.some((job) => job.snapshot.status === "paused");
  const elapsedMs = Math.max(...progressSnapshots.map((progress) => progress.elapsedMs), 0);
  const processedBytes = progressSnapshots.reduce((total, progress) => total + progress.processedBytes, 0);
  const totalBytes = progressSnapshots.every((progress) => progress.totalBytes !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.totalBytes ?? 0), 0)
    : null;
  const processedFiles = progressSnapshots.reduce((total, progress) => total + progress.processedFiles, 0);
  const totalFiles = progressSnapshots.every((progress) => progress.totalFiles !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.totalFiles ?? 0), 0)
    : null;
  const compressedBytes = progressSnapshots.every((progress) => progress.compressedBytes !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.compressedBytes ?? 0), 0)
    : null;
  const remainingMs = totalBytes !== null && processedBytes > 0 && elapsedMs > 0
    ? Math.max(0, ((totalBytes - processedBytes) / (processedBytes / elapsedMs)))
    : totalFiles !== null && processedFiles > 0 && elapsedMs > 0
      ? Math.max(0, ((totalFiles - processedFiles) / (processedFiles / elapsedMs)))
      : null;
  const speedBytesPerSecond = elapsedMs > 0 && processedBytes > 0
    ? processedBytes / (elapsedMs / 1000)
    : null;
  const progressPercent = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(100, (processedBytes / totalBytes) * 100))
    : totalFiles !== null && totalFiles > 0
      ? Math.max(0, Math.min(100, (processedFiles / totalFiles) * 100))
      : allTerminal && allCompleted
        ? 100
        : null;
  const latestProgress = progressSnapshots.at(-1);

  return {
    allTerminal,
    allCompleted,
    anyActive,
    anyPaused,
    elapsedMs,
    remainingMs,
    processedFiles,
    totalFiles,
    processedBytes,
    totalBytes,
    compressedBytes,
    speedBytesPerSecond,
    progressPercent,
    currentFile: latestProgress?.currentFile || latestProgress?.latestStatusMessage || "",
  };
}

export function createJobsWorkspace(): JobsWorkspace {
  const jobs = new Map<string, JobState>();
  const retryContexts = new Map<string, JobRetryContext>();
  const outputActions = new Map<string, JobOutputAction[]>();
  const promptedPasswordRetryJobs = new Set<string>();
  const focusedQuickActionJobIds = new Set<string>();
  const focusedJobProgressContexts = new Map<string, FocusedJobProgressContext>();
  let pollInFlight = false;
  let pollAgainRequested = false;
  let focusedJobAutoCloseAction: FocusedJobAutoCloseAction = "closeWindow";

  function clearJobMetadata(jobId: string) {
    retryContexts.delete(jobId);
    outputActions.delete(jobId);
    promptedPasswordRetryJobs.delete(jobId);
    focusedQuickActionJobIds.delete(jobId);
    focusedJobProgressContexts.delete(jobId);
  }

  function setOutputActions(jobId: string, actions: readonly JobOutputAction[] | undefined) {
    if (actions?.length) {
      outputActions.set(jobId, actions.map(cloneOutputAction));
    } else {
      outputActions.delete(jobId);
    }
  }

  function canRetryJob(jobId: string, state = jobs.get(jobId)) {
    return Boolean(state && canRetryJobWithPassword(retryContexts.has(jobId), state));
  }

  function clear() {
    jobs.clear();
    retryContexts.clear();
    outputActions.clear();
    promptedPasswordRetryJobs.clear();
    focusedQuickActionJobIds.clear();
    focusedJobProgressContexts.clear();
    pollInFlight = false;
    pollAgainRequested = false;
    focusedJobAutoCloseAction = "closeWindow";
  }

  return {
    hasJob(jobId) {
      return jobs.has(jobId);
    },

    getJob(jobId) {
      const state = jobs.get(jobId);
      return state ? cloneJobState(state) : undefined;
    },

    getJobs() {
      return Array.from(jobs.values(), cloneJobState);
    },

    getJobsMap() {
      return new Map(
        Array.from(jobs, ([jobId, state]) => [jobId, cloneJobState(state)]),
      );
    },

    hasJobs() {
      return jobs.size > 0;
    },

    hasActiveJob() {
      return Array.from(jobs.values()).some((state) => isLiveJobStatus(state.snapshot.status));
    },

    getProgressClockSnapshot() {
      return progressClockSnapshot(jobs.values());
    },

    getJobListSnapshot(nowMs) {
      const sortedJobs = sortedJobStates(jobs.values());
      return {
        jobs: sortedJobs.map((state) => {
          const clonedState = cloneJobState(state);
          const snapshot = clonedState.snapshot;
          return {
            jobId: snapshot.jobId,
            kind: snapshot.kind,
            status: snapshot.status,
            canDismiss: snapshot.canDismiss,
            events: clonedState.events,
            terminalSummary: snapshot.terminalSummary,
            state: clonedState,
            progress: deriveJobProgress(state, nowMs),
            isTerminal: isTerminalJobStatus(snapshot.status),
            completedSizeLabelKey: isCreateJobKind(snapshot.kind)
              ? "jobs.summary.archiveSize"
              : "jobs.summary.outputSize",
            canRetryPassword: canRetryJob(snapshot.jobId, state),
            readyOutputActions: readyOutputActionsFor(state, outputActions.get(snapshot.jobId)),
          };
        }),
        activeJob: activeJobFrom(sortedJobs),
        progressClock: progressClockSnapshot(sortedJobs),
      };
    },

    getRetryContext(jobId) {
      const context = retryContexts.get(jobId);
      return context ? cloneRetryContext(context) : undefined;
    },

    getOutputActions(jobId) {
      return (outputActions.get(jobId) ?? []).map(cloneOutputAction);
    },

    getReadyOutputActions(jobId) {
      return readyOutputActionsFor(jobs.get(jobId), outputActions.get(jobId));
    },

    getOutputAction(lookup) {
      if (
        !lookup.jobId ||
        !Number.isInteger(lookup.index) ||
        (lookup.kind !== "open" && lookup.kind !== "reveal")
      ) {
        return { action: "unavailable" };
      }

      const readyActions = readyOutputActionsFor(jobs.get(lookup.jobId), outputActions.get(lookup.jobId));
      const outputAction = readyActions[lookup.index ?? -1];
      if (!outputAction || outputAction.kind !== lookup.kind || !outputAction.path) {
        return { action: "unavailable" };
      }

      return {
        action: "ready",
        outputAction,
      };
    },

    canRetryJobWithPassword(jobId, state = jobs.get(jobId)) {
      return canRetryJob(jobId, state);
    },

    getPasswordRetryDetails(jobId) {
      const state = jobs.get(jobId);
      const context = retryContexts.get(jobId);
      if (!state || !context) {
        return null;
      }

      const failure = getLatestPasswordFailureEvent(state);
      if (!failure) {
        return null;
      }

      return {
        state: cloneJobState(state),
        context: cloneRetryContext(context),
        failure: cloneJobEvent(failure),
      };
    },

    markPasswordRetryPromptedIfEligible(jobId) {
      if (promptedPasswordRetryJobs.has(jobId) || !canRetryJob(jobId)) {
        return false;
      }

      promptedPasswordRetryJobs.add(jobId);
      return true;
    },

    addJob(response, options = {}) {
      const state = createInitialJobState(response);
      jobs.set(response.jobId, state);

      if (options.retryContext) {
        retryContexts.set(response.jobId, cloneRetryContext(options.retryContext));
      } else {
        retryContexts.delete(response.jobId);
      }
      setOutputActions(response.jobId, options.outputActions);
      promptedPasswordRetryJobs.delete(response.jobId);

      return cloneJobState(state);
    },

    mergePolledSnapshot(snapshot) {
      const state = mergePolledJobState(jobs.get(snapshot.jobId), snapshot);
      const stored = cloneJobState(state);
      jobs.set(snapshot.jobId, stored);
      return cloneJobState(stored);
    },

    markJobFailed(jobId, event) {
      const state = jobs.get(jobId);
      if (!state) {
        return null;
      }

      const failedEvent = cloneJobEvent(event);
      const failedState: JobState = {
        snapshot: {
          ...state.snapshot,
          status: "failed",
          canDismiss: true,
          events: [failedEvent],
        },
        events: [...state.events, failedEvent],
      };
      jobs.set(jobId, failedState);
      return cloneJobState(failedState);
    },

    updateJobStatus(jobId, status) {
      const state = jobs.get(jobId);
      if (!state) {
        return null;
      }

      const updated = {
        ...state,
        snapshot: {
          ...state.snapshot,
          status,
        },
      };
      jobs.set(jobId, updated);
      return cloneJobState(updated);
    },

    removeJob(jobId) {
      const removed = jobs.delete(jobId);
      clearJobMetadata(jobId);
      return removed;
    },

    clear() {
      clear();
    },

    beginPolling() {
      if (pollInFlight) {
        pollAgainRequested = true;
        return { action: "requestAgain" };
      }

      const decision = selectJobPollingDecision(jobs.values(), false);
      if (decision.action === "poll") {
        pollInFlight = true;
      }
      return decision;
    },

    finishPolling() {
      pollInFlight = false;
      const shouldPollAgain = pollAgainRequested;
      pollAgainRequested = false;
      return { shouldPollAgain };
    },

    setFocusedJobAutoCloseAction(action) {
      focusedJobAutoCloseAction = action;
    },

    getFocusedJobAutoCloseAction() {
      return focusedJobAutoCloseAction;
    },

    trackFocusedQuickActionJob(jobId, context) {
      focusedQuickActionJobIds.add(jobId);
      if (context) {
        focusedJobProgressContexts.set(jobId, cloneFocusedProgressContext(context));
      } else {
        focusedJobProgressContexts.delete(jobId);
      }
    },

    clearFocusedQuickActionJobs() {
      focusedQuickActionJobIds.clear();
      focusedJobProgressContexts.clear();
    },

    resetFocusedQuickActionProgress() {
      focusedQuickActionJobIds.clear();
      focusedJobProgressContexts.clear();
      focusedJobAutoCloseAction = "closeWindow";
    },

    getFocusedQuickActionJobIds() {
      return [...focusedQuickActionJobIds];
    },

    getFocusedQuickActionJobs() {
      return Array.from(focusedQuickActionJobIds, (jobId) => jobs.get(jobId)).filter(
        (job): job is JobState => Boolean(job),
      ).map(cloneJobState);
    },

    getFocusedQuickActionProgressContext(jobId) {
      const context = focusedJobProgressContexts.get(jobId);
      return context ? cloneFocusedProgressContext(context) : undefined;
    },

    getFocusedQuickActionProgressSnapshot(nowMs) {
      const trackedJobs = Array.from(focusedQuickActionJobIds, (jobId) => jobs.get(jobId)).filter(
        (job): job is JobState => Boolean(job),
      );
      const clock = progressClockSnapshot(jobs.values());

      if (!trackedJobs.length) {
        return {
          state: "empty",
          progressClock: clock,
        };
      }

      const progressSnapshots = trackedJobs.map((job) => deriveJobProgress(job, nowMs));
      const latestJob = trackedJobs.at(-1)!;
      const latestContext = focusedJobProgressContexts.get(latestJob.snapshot.jobId);

      return {
        state: "tracking",
        jobCount: trackedJobs.length,
        latestJob: {
          jobId: latestJob.snapshot.jobId,
          kind: latestJob.snapshot.kind,
          status: latestJob.snapshot.status,
        },
        latestContext: latestContext ? cloneFocusedProgressContext(latestContext) : undefined,
        ...aggregateFocusedQuickActionProgress(trackedJobs, progressSnapshots),
        progressClock: clock,
      };
    },

    getControllableFocusedQuickActionJobIds() {
      return Array.from(focusedQuickActionJobIds).filter((jobId) => {
        const state = jobs.get(jobId);
        return state ? isLiveJobStatus(state.snapshot.status) : false;
      });
    },

    selectFocusedQuickActionCompletion(options) {
      return selectQuickActionJobCompletionDecision({
        canEvaluate: options.canEvaluate,
        autoClosePending: options.autoClosePending,
        trackedJobIds: [...focusedQuickActionJobIds],
        jobsById: jobs,
      });
    },

    replaceJobs(fixtures) {
      clear();
      for (const fixture of fixtures) {
        jobs.set(fixture.snapshot.jobId, cloneJobState(fixture));
        if (fixture.retryContext) {
          retryContexts.set(fixture.snapshot.jobId, cloneRetryContext(fixture.retryContext));
        }
        setOutputActions(fixture.snapshot.jobId, fixture.outputActions);
      }
    },
  };
}
