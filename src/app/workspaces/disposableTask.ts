import type {
  JobEventDto,
  JobKind,
  JobStatus,
  JobTerminalSummaryDto,
  PollJobEventsResponseDto,
  StartJobResponseDto,
} from "../../api/types";

export type DisposableTaskPhase =
  | "starting"
  | "running"
  | "paused"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "closing";

export type DisposableTaskJobSnapshot = Readonly<{
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  canDismiss: boolean;
  events: readonly JobEventDto[];
  terminalSummary: JobTerminalSummaryDto | null;
}>;

export type DisposableTaskState = Readonly<{
  phase: DisposableTaskPhase;
  job: DisposableTaskJobSnapshot;
  closePromptOpen: boolean;
}>;

export type DisposableTaskEvent =
  | Readonly<{ type: "jobUpdated"; snapshot: PollJobEventsResponseDto }>
  | Readonly<{ type: "closeRequested" }>
  | Readonly<{ type: "keepOpen" }>
  | Readonly<{ type: "continueInBackground" }>
  | Readonly<{ type: "cancelRequested" }>
  | Readonly<{ type: "controlRejected" }>
  | Readonly<{ type: "autoCloseElapsed" }>;

const TERMINAL_PHASES = new Set<DisposableTaskPhase>([
  "succeeded",
  "failed",
  "cancelled",
  "closing",
]);

export function createDisposableTask(response: StartJobResponseDto): DisposableTaskState {
  return freezeState({
    phase: phaseForStatus(response.status),
    closePromptOpen: false,
    job: {
      ...response,
      canDismiss: false,
      events: [],
      terminalSummary: null,
    },
  });
}

export function reduceDisposableTask(
  state: DisposableTaskState,
  event: DisposableTaskEvent,
): DisposableTaskState {
  switch (event.type) {
    case "jobUpdated": {
      if (event.snapshot.jobId !== state.job.jobId || TERMINAL_PHASES.has(state.phase)) {
        return state;
      }
      return freezeState({
        phase: phaseForStatus(event.snapshot.status),
        closePromptOpen: false,
        job: {
          ...event.snapshot,
          events: [...event.snapshot.events],
          terminalSummary: event.snapshot.terminalSummary ?? null,
        },
      });
    }
    case "closeRequested":
      return isLivePhase(state.phase)
        ? freezeState({ ...state, closePromptOpen: true })
        : freezeState({ ...state, phase: "closing", closePromptOpen: false });
    case "keepOpen":
      return freezeState({ ...state, closePromptOpen: false });
    case "continueInBackground":
      return freezeState({ ...state, phase: "closing", closePromptOpen: false });
    case "cancelRequested":
      return isLivePhase(state.phase)
        ? freezeState({ ...state, phase: "cancelling", closePromptOpen: false })
        : state;
    case "controlRejected":
      return isLivePhase(state.phase)
        ? freezeState({ ...state, phase: phaseForStatus(state.job.status), closePromptOpen: false })
        : state;
    case "autoCloseElapsed":
      return state.phase === "succeeded" || state.phase === "cancelled"
        ? freezeState({ ...state, phase: "closing", closePromptOpen: false })
        : state;
  }
}

export function isLiveDisposableTask(state: DisposableTaskState): boolean {
  return isLivePhase(state.phase);
}

function isLivePhase(phase: DisposableTaskPhase): boolean {
  return phase === "starting" || phase === "running" || phase === "paused" || phase === "cancelling";
}

function phaseForStatus(status: JobStatus): DisposableTaskPhase {
  switch (status) {
    case "queued":
      return "starting";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

function freezeState(state: {
  phase: DisposableTaskPhase;
  job: DisposableTaskJobSnapshot;
  closePromptOpen: boolean;
}): DisposableTaskState {
  const job = Object.freeze({
    ...state.job,
    events: Object.freeze([...state.job.events]),
    terminalSummary: state.job.terminalSummary
      ? Object.freeze({
          ...state.job.terminalSummary,
          warnings: Object.freeze([...state.job.terminalSummary.warnings]) as unknown as string[],
        })
      : null,
  });
  return Object.freeze({ ...state, job });
}
