import { COMMAND_INVALID_PASSWORD, COMMAND_PASSWORD_REQUIRED } from "./constants";
import type {
  JobEventDto,
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
