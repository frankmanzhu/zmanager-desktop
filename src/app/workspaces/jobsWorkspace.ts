import type {
  JobEventDto,
  DesktopJobSnapshotDto,
  JobState,
  JobStatus,
  BaseJobSnapshotDto,
  StartJobResponseDto,
} from "../../api/types";
import {
  canRetryJobWithPassword,
  createInitialJobState,
  getLatestPasswordFailureEvent,
  isLiveJobStatus,
  applyJobSnapshot,
  type JobRetryContext,
} from "../jobs";

export type JobOutputAction = {
  kind: "open" | "reveal";
  path: string;
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

export type JobsWorkspace = {
  hasJob(jobId: string): boolean;
  getJob(jobId: string): JobState | undefined;
  getJobs(): readonly JobState[];
  getJobsMap(): Map<string, JobState>;
  hasJobs(): boolean;
  hasActiveJob(): boolean;
  getRetryContext(jobId: string): JobRetryContext | undefined;
  getOutputActions(jobId: string): readonly JobOutputAction[];
  canRetryJobWithPassword(jobId: string, state?: JobState): boolean;
  getPasswordRetryDetails(jobId: string): JobPasswordRetryDetails | null;
  markPasswordRetryPromptedIfEligible(jobId: string): boolean;
  addJob(response: StartJobResponseDto, options?: AddJobStateOptions): JobState;
  applyJobSnapshot(snapshot: BaseJobSnapshotDto): JobState;
  acceptRetainedSnapshot(snapshot: DesktopJobSnapshotDto): JobState;
  markJobFailed(jobId: string, event: JobEventDto): JobState | null;
  updateJobStatus(jobId: string, status: JobStatus): JobState | null;
  removeJob(jobId: string): boolean;
  clear(): void;
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
    retainedSnapshot: state.retainedSnapshot ? {
      ...state.retainedSnapshot,
      progressFacts: { ...state.retainedSnapshot.progressFacts, recentPaths: [...state.retainedSnapshot.progressFacts.recentPaths] },
      boundedNotices: state.retainedSnapshot.boundedNotices.map(cloneJobEvent),
      availableActions: state.retainedSnapshot.availableActions.map((action) => ({ ...action })),
      outputArtifacts: state.retainedSnapshot.outputArtifacts.map((artifact) => ({ ...artifact })),
      retryDescriptor: state.retainedSnapshot.retryDescriptor
        ? { ...state.retainedSnapshot.retryDescriptor, entryPaths: [...state.retainedSnapshot.retryDescriptor.entryPaths] }
        : state.retainedSnapshot.retryDescriptor,
    } : undefined,
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

function retainedRetryContext(snapshot: DesktopJobSnapshotDto): JobRetryContext | undefined {
  const descriptor = snapshot.retryDescriptor;
  if (!descriptor) return undefined;
  if (descriptor.retryKind === "testArchive") {
    return {
      retryKind: descriptor.retryKind,
      archivePath: descriptor.archivePath,
      ...(descriptor.entryPaths.length ? { entryPaths: [...descriptor.entryPaths] } : {}),
    };
  }
  return {
    retryKind: descriptor.retryKind,
    archivePath: descriptor.archivePath,
    destinationPath: descriptor.destinationPath,
    overwrite: descriptor.overwrite,
    destinationCollisionStrategy: descriptor.destinationCollisionStrategy,
    ...(descriptor.entryPaths.length ? { entryPaths: [...descriptor.entryPaths] } : {}),
    stripComponents: descriptor.stripComponents,
    tzapRestorePolicy: descriptor.tzapRestorePolicy ?? "portable",
    tzapAllowDegraded: descriptor.tzapAllowDegraded ?? false,
    tzapAllowAbsoluteSymlinks: descriptor.tzapAllowAbsoluteSymlinks ?? false,
    ignoreSymlinks: descriptor.ignoreSymlinks ?? false,
  };
}

function retainedOutputActions(snapshot: DesktopJobSnapshotDto): JobOutputAction[] {
  const artifacts = new Map(snapshot.outputArtifacts.map((artifact) => [artifact.artifactId, artifact]));
  return snapshot.availableActions.flatMap((action) => {
    const artifact = artifacts.get(action.artifactId);
    return artifact?.path ? [{ kind: action.kind, path: artifact.path }] : [];
  });
}

export function createJobsWorkspace(): JobsWorkspace {
  const jobs = new Map<string, JobState>();
  const retryContexts = new Map<string, JobRetryContext>();
  const outputActions = new Map<string, JobOutputAction[]>();
  const promptedPasswordRetryJobs = new Set<string>();

  function clearJobMetadata(jobId: string) {
    retryContexts.delete(jobId);
    outputActions.delete(jobId);
    promptedPasswordRetryJobs.delete(jobId);
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

    getRetryContext(jobId) {
      const context = retryContexts.get(jobId);
      return context ? cloneRetryContext(context) : undefined;
    },

    getOutputActions(jobId) {
      return (outputActions.get(jobId) ?? []).map(cloneOutputAction);
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

    applyJobSnapshot(snapshot) {
      const state = applyJobSnapshot(jobs.get(snapshot.jobId), snapshot);
      const stored = cloneJobState(state);
      jobs.set(snapshot.jobId, stored);
      return cloneJobState(stored);
    },

    acceptRetainedSnapshot(snapshot) {
      const previous = jobs.get(snapshot.jobId)?.retainedSnapshot;
      if (previous && BigInt(snapshot.revision) <= BigInt(previous.revision)) return cloneJobState(jobs.get(snapshot.jobId)!);
      const notices = snapshot.latestFailure ? [...snapshot.boundedNotices, snapshot.latestFailure] : [...snapshot.boundedNotices];
      const state: JobState = {
        snapshot: { jobId: snapshot.jobId, kind: snapshot.kind, status: snapshot.status, createdAt: snapshot.createdAt,
          canDismiss: snapshot.canDismiss, events: notices, terminalSummary: snapshot.terminalSummary ?? null },
        events: notices,
        retainedSnapshot: snapshot,
      };
      jobs.set(snapshot.jobId, state);
      const retryContext = retainedRetryContext(snapshot);
      if (retryContext) retryContexts.set(snapshot.jobId, retryContext);
      else retryContexts.delete(snapshot.jobId);
      setOutputActions(snapshot.jobId, retainedOutputActions(snapshot));
      return cloneJobState(state);
    },

    markJobFailed(jobId, event) {
      const state = jobs.get(jobId);
      if (!state) return null;
      const failedEvent = cloneJobEvent(event);
      const failedState: JobState = {
        snapshot: { ...state.snapshot, status: "failed", canDismiss: true, events: [failedEvent] },
        events: [...state.events, failedEvent],
      };
      jobs.set(jobId, failedState);
      return cloneJobState(failedState);
    },

    updateJobStatus(jobId, status) {
      const state = jobs.get(jobId);
      if (!state) return null;
      const updated = { ...state, snapshot: { ...state.snapshot, status } };
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
  };
}
