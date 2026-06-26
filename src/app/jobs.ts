import { COMMAND_INVALID_PASSWORD, COMMAND_PASSWORD_REQUIRED } from "./constants";
import type {
  JobEventDto,
  JobKind,
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
      entryPaths?: string[];
      stripComponents: number;
    }
  | {
      retryKind: "testArchive";
      archivePath: string;
    };

export function isPasswordErrorCode(code?: string | null): boolean {
  return code === COMMAND_PASSWORD_REQUIRED || code === COMMAND_INVALID_PASSWORD;
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

export type JobProgressSnapshot = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  elapsedMs: number;
  remainingMs: number | null;
  processedFiles: number;
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
};

export function deriveJobProgress(
  state: JobState,
  nowMs = Date.now(),
): JobProgressSnapshot {
  const createdAtMs = Date.parse(state.snapshot.createdAt);
  const elapsedMs = Number.isNaN(createdAtMs) ? 0 : Math.max(0, nowMs - createdAtMs);
  let processedBytes = 0;
  let totalBytes: number | null = null;
  let processedFiles = 0;
  let errorCount = 0;
  let warningCount = 0;
  let currentFile = "";
  let latestStatusMessage = String(state.snapshot.status);

  for (const event of state.events) {
    if (event.path) {
      currentFile = event.path;
    }
    if (typeof event.totalBytes === "number") {
      totalBytes = Math.max(totalBytes ?? 0, event.totalBytes);
    }
    if (typeof event.totalBytesProcessed === "number") {
      processedBytes = Math.max(processedBytes, event.totalBytesProcessed);
    } else if (typeof event.bytes === "number") {
      processedBytes += event.bytes;
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
    latestStatusMessage = event.message ?? event.eventType;
  }

  const terminalSummary = state.snapshot.terminalSummary;
  if (terminalSummary) {
    processedFiles = Math.max(processedFiles, terminalSummary.writtenEntries);
    processedBytes = Math.max(processedBytes, terminalSummary.writtenBytes);
    warningCount = Math.max(warningCount, terminalSummary.warnings.length);
  }

  const speedBytesPerSecond = elapsedMs > 0 && processedBytes > 0
    ? processedBytes / (elapsedMs / 1000)
    : null;
  const remainingBytes = totalBytes !== null ? Math.max(0, totalBytes - processedBytes) : null;
  const remainingMs = remainingBytes !== null && speedBytesPerSecond && speedBytesPerSecond > 0
    ? (remainingBytes / speedBytesPerSecond) * 1000
    : null;
  const progressPercent = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(100, (processedBytes / totalBytes) * 100))
    : null;

  return {
    id: state.snapshot.jobId,
    kind: state.snapshot.kind,
    status: state.snapshot.status,
    elapsedMs,
    remainingMs,
    processedFiles,
    errorCount,
    warningCount,
    totalBytes,
    processedBytes,
    compressedBytes: null,
    speedBytesPerSecond,
    compressionRatio: null,
    currentFile,
    progressPercent,
    latestStatusMessage,
  };
}
