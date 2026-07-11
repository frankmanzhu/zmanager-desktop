import { COMMAND_INVALID_PASSWORD, COMMAND_PASSWORD_REQUIRED } from "./constants";
import { calculateCompressionRatio, parseDateValue } from "./formatting";
import type {
  JobEventDto,
  JobKind,
  JobPhase,
  JobStatus,
  JobState,
  PollJobEventsResponseDto,
  StartExtractRequest,
  StartJobResponseDto,
} from "../api/types";

export type JobRetryContext =
  | {
      retryKind: "extractArchive";
      archivePath: string;
      destinationPath: string;
      overwrite: StartExtractRequest["overwrite"];
      destinationCollisionStrategy?: StartExtractRequest["destinationCollisionStrategy"];
      entryPaths?: string[];
      stripComponents: number;
    }
  | {
      retryKind: "testArchive";
      archivePath: string;
      entryPaths?: string[];
    };

export type JobPollingDecision =
  | {
      action: "requestAgain";
    }
  | {
      action: "stop";
    }
  | {
      action: "poll";
      jobIds: string[];
    };

export type QuickActionJobCompletionDecision =
  | {
      action: "wait";
    }
  | {
      action: "needsAttention";
    }
  | {
      action: "completed";
    };

export type SelectQuickActionJobCompletionDecisionInput = {
  canEvaluate: boolean;
  autoClosePending: boolean;
  trackedJobIds: readonly string[];
  jobsById: ReadonlyMap<string, JobState>;
};

export function isPasswordErrorCode(code?: string | null): boolean {
  return code === COMMAND_PASSWORD_REQUIRED || code === COMMAND_INVALID_PASSWORD;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isLiveJobStatus(status: JobStatus): boolean {
  return status === "queued" || status === "running" || status === "paused";
}

export function isCreateJobKind(kind: JobKind): boolean {
  return (
    kind === "zipCreate" ||
    kind === "sevenZCreate" ||
    kind === "tarZstdCreate" ||
    kind === "tzapCreate"
  );
}

export function getLatestPasswordFailureEvent(state: JobState): JobEventDto | null {
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];
    if (event.eventType === "failed" && isPasswordErrorCode(event.code)) {
      return event;
    }
  }

  return null;
}

export function canRetryJobWithPassword(hasRetryContext: boolean, state: JobState): boolean {
  return Boolean(hasRetryContext && getLatestPasswordFailureEvent(state));
}

export function createInitialJobState(response: StartJobResponseDto): JobState {
  return {
    snapshot: {
      jobId: response.jobId,
      kind: response.kind,
      status: response.status,
      createdAt: response.createdAt,
      canDismiss: false,
      events: [],
      terminalSummary: null,
    },
    events: [],
  };
}

export function mergePolledJobState(
  previous: JobState | undefined,
  snapshot: PollJobEventsResponseDto,
): JobState {
  return {
    snapshot: {
      ...snapshot,
      terminalSummary: snapshot.terminalSummary ?? previous?.snapshot.terminalSummary ?? null,
    },
    events: [...(previous?.events ?? []), ...snapshot.events],
  };
}

export function selectJobPollingDecision(
  jobs: Iterable<JobState>,
  pollInFlight: boolean,
): JobPollingDecision {
  if (pollInFlight) {
    return { action: "requestAgain" };
  }

  const jobIds = Array.from(jobs)
    .filter((state) => !state.snapshot.canDismiss)
    .map((state) => state.snapshot.jobId);

  return jobIds.length ? { action: "poll", jobIds } : { action: "stop" };
}

export function selectQuickActionJobCompletionDecision(
  input: SelectQuickActionJobCompletionDecisionInput,
): QuickActionJobCompletionDecision {
  if (
    !input.canEvaluate ||
    input.autoClosePending ||
    input.trackedJobIds.length === 0
  ) {
    return { action: "wait" };
  }

  const trackedJobs: JobState[] = [];
  for (const jobId of input.trackedJobIds) {
    const job = input.jobsById.get(jobId);
    if (!job) {
      return { action: "wait" };
    }
    trackedJobs.push(job);
  }

  if (!trackedJobs.every((job) => isTerminalJobStatus(job.snapshot.status))) {
    return { action: "wait" };
  }

  if (!trackedJobs.every((job) => job.snapshot.status === "completed")) {
    return { action: "needsAttention" };
  }

  return { action: "completed" };
}

export type JobProgressSnapshot = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  elapsedMs: number;
  remainingMs: number | null;
  processedFiles: number;
  totalFiles: number | null;
  errorCount: number;
  warningCount: number;
  totalBytes: number | null;
  processedBytes: number;
  compressedBytes: number | null;
  speedBytesPerSecond: number | null;
  compressionRatio: number | null;
  currentFile: string;
  progressPercent: number | null;
  latestStatusMessage: string;
  phase?: JobPhase | null;
};

const TZAP_CREATE_PHASE_RANGES: Readonly<Record<JobPhase, Readonly<{ start: number; end: number }>>> = Object.freeze({
  planningPayload: Object.freeze({ start: 0, end: 40 }),
  planningMetadata: Object.freeze({ start: 40, end: 42 }),
  emittingPayload: Object.freeze({ start: 42, end: 94 }),
  emittingMetadata: Object.freeze({ start: 94, end: 99 }),
  committingOutput: Object.freeze({ start: 99, end: 99 }),
});
const TZAP_SINGLE_PASS_PHASE_RANGES: Readonly<Record<JobPhase, Readonly<{ start: number; end: number }>>> = Object.freeze({
  planningPayload: Object.freeze({ start: 0, end: 0 }),
  planningMetadata: Object.freeze({ start: 0, end: 0 }),
  emittingPayload: Object.freeze({ start: 0, end: 94 }),
  emittingMetadata: Object.freeze({ start: 94, end: 99 }),
  committingOutput: Object.freeze({ start: 99, end: 99 }),
});

export function deriveJobProgress(
  state: JobState,
  nowMs = Date.now(),
): JobProgressSnapshot {
  const createdAtMs = parseDateValue(state.snapshot.createdAt)?.getTime();
  const elapsedMs = typeof createdAtMs === "number" ? Math.max(0, nowMs - createdAtMs) : 0;
  const isCreateJob = isCreateJobKind(state.snapshot.kind);
  let processedBytes = 0;
  let totalBytes: number | null = null;
  let compressedBytes: number | null = null;
  let processedFiles = 0;
  let totalFiles: number | null = null;
  let errorCount = 0;
  let warningCount = 0;
  let currentFile = "";
  let latestStatusMessage = String(state.snapshot.status);
  let phase: JobPhase | null = null;
  let phaseProcessedBytes = 0;
  let phaseTotalBytes: number | null = null;
  let sawPlanningPhase = false;

  for (const event of state.events) {
    if (event.path) {
      currentFile = event.path;
    }
    if (typeof event.totalBytes === "number") {
      totalBytes = Math.max(totalBytes ?? 0, event.totalBytes);
    }
    if (event.eventType === "phaseStarted" && event.phase) {
      phase = event.phase;
      sawPlanningPhase ||= phase === "planningPayload" || phase === "planningMetadata";
      currentFile = "";
      phaseProcessedBytes = 0;
      phaseTotalBytes = typeof event.totalBytes === "number" ? event.totalBytes : null;
    } else if (event.eventType === "phaseBytesProcessed" && event.phase) {
      phase = event.phase;
      phaseProcessedBytes = typeof event.totalBytesProcessed === "number"
        ? event.totalBytesProcessed
        : phaseProcessedBytes + (event.bytes ?? 0);
      if (typeof event.totalBytes === "number") {
        phaseTotalBytes = event.totalBytes;
      }
    }
    if (event.eventType === "bytesProcessed" && typeof event.totalBytesProcessed === "number") {
      processedBytes = Math.max(processedBytes, event.totalBytesProcessed);
    } else if (event.eventType !== "phaseBytesProcessed" && typeof event.bytes === "number") {
      processedBytes += event.bytes;
    }
    if (typeof event.totalEntries === "number") {
      totalFiles = Math.max(totalFiles ?? 0, event.totalEntries);
    }
    if (typeof event.entries === "number") {
      processedFiles = Math.max(processedFiles, event.entries);
    } else if (event.eventType === "entryFinished") {
      processedFiles += 1;
    }
    if (event.eventType === "warning") {
      warningCount += 1;
    }
    if (event.eventType === "failed") {
      errorCount += 1;
    }
    latestStatusMessage = event.message ?? event.phase ?? event.eventType;
  }

  const terminalSummary = state.snapshot.terminalSummary;
  if (terminalSummary) {
    processedFiles = Math.max(processedFiles, terminalSummary.writtenEntries);
    totalFiles = Math.max(totalFiles ?? 0, terminalSummary.writtenEntries);
    if (isCreateJob) {
      compressedBytes = terminalSummary.writtenBytes;
      if (totalBytes !== null) {
        processedBytes = Math.max(processedBytes, totalBytes);
      }
    } else {
      processedBytes = Math.max(processedBytes, terminalSummary.writtenBytes);
    }
    warningCount = Math.max(warningCount, terminalSummary.warnings.length);
  }

  const speedBytesPerSecond = elapsedMs > 0 && processedBytes > 0
    ? processedBytes / (elapsedMs / 1000)
    : null;
  const filesPerSecond = elapsedMs > 0 && processedFiles > 0
    ? processedFiles / (elapsedMs / 1000)
    : null;
  const remainingBytes = totalBytes !== null ? Math.max(0, totalBytes - processedBytes) : null;
  const remainingFiles = totalFiles !== null ? Math.max(0, totalFiles - processedFiles) : null;
  const byteRemainingMs = remainingBytes !== null && speedBytesPerSecond && speedBytesPerSecond > 0
    ? (remainingBytes / speedBytesPerSecond) * 1000
    : remainingFiles !== null && filesPerSecond && filesPerSecond > 0
      ? (remainingFiles / filesPerSecond) * 1000
      : null;
  const byteProgressPercent = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(100, (processedBytes / totalBytes) * 100))
    : totalFiles !== null && totalFiles > 0
      ? Math.max(0, Math.min(100, (processedFiles / totalFiles) * 100))
    : null;
  const phaseProgressPercent = state.snapshot.kind === "tzapCreate" && phase
    ? progressPercentForTzapPhase(phase, phaseProcessedBytes, phaseTotalBytes, sawPlanningPhase)
    : null;
  const measuredProgressPercent = phaseProgressPercent ?? byteProgressPercent;
  const progressPercent = state.snapshot.status === "completed"
    ? 100
    : isTerminalJobStatus(state.snapshot.status)
      ? measuredProgressPercent ?? 0
      : measuredProgressPercent;
  const remainingMs = phaseProgressPercent !== null && progressPercent !== null && progressPercent > 0
    ? elapsedMs * ((100 - progressPercent) / progressPercent)
    : byteRemainingMs;
  const compressionRatio = isCreateJob
    ? calculateCompressionRatio(totalBytes, compressedBytes)
    : null;

  return {
    id: state.snapshot.jobId,
    kind: state.snapshot.kind,
    status: state.snapshot.status,
    elapsedMs,
    remainingMs,
    processedFiles,
    totalFiles,
    errorCount,
    warningCount,
    totalBytes,
    processedBytes,
    compressedBytes,
    speedBytesPerSecond,
    compressionRatio,
    currentFile,
    progressPercent,
    latestStatusMessage,
    phase,
  };
}

function progressPercentForTzapPhase(
  phase: JobPhase,
  processedBytes: number,
  totalBytes: number | null,
  hasPlanningPhase: boolean,
): number {
  const range = (hasPlanningPhase ? TZAP_CREATE_PHASE_RANGES : TZAP_SINGLE_PASS_PHASE_RANGES)[phase];
  const fraction = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(1, processedBytes / totalBytes))
    : 0;
  return range.start + ((range.end - range.start) * fraction);
}
