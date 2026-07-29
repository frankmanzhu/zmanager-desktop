import { useEffect, useMemo, useReducer, useState } from "react";

import {
  asCommandError,
  cancelJob,
  pauseJob,
  resumeJob,
  runStartExtract,
  runTestArchive,
} from "../api/commands";
import type { JobKind, JobStatus, StartJobResponseDto } from "../api/types";
import { createDisposableTaskRecoveryController } from "../app/controllers/disposableTaskRecoveryController";
import {
  createDisposableTask,
  isLiveDisposableTask,
  reduceDisposableTask,
} from "../app/workspaces/disposableTask";
import {
  announceDisposableTaskReady,
  closeDisposableTaskWindow,
  listenDisposableTaskCloseRequested,
  minimizeDisposableTaskWindow,
  requestDisposableTaskJobHandoff,
  requestDisposableTaskOutputAction,
} from "../desktop/disposableTaskWindow";
import { createTauriJobFeed } from "../desktop/jobFeed";
import { persistDiagnosticEvent } from "../desktop/diagnostics";
import { DisposableTaskView } from "../ui/react/tasks/DisposableTaskApp";
import { createBrowserPasswordPromptAdapter } from "./passwordPromptAdapter";

const AUTO_CLOSE_SUCCESS_MS = 850;

export function DisposableTaskRuntimeApp() {
  const bootstrap = disposableTaskBootstrap(globalThis.location?.search ?? "");
  if (!bootstrap) {
    return <main className="grid min-h-screen place-items-center p-6"><p role="alert">This task could not be opened.</p></main>;
  }
  return <DisposableTaskRuntime bootstrap={bootstrap} />;
}

function DisposableTaskRuntime({ bootstrap }: Readonly<{ bootstrap: StartJobResponseDto }>) {
  const [state, dispatch] = useReducer(reduceDisposableTask, bootstrap, createDisposableTask);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const [surfaceError, setSurfaceError] = useState("");
  const recovery = useMemo(() => createDisposableTaskRecoveryController({
    promptForPassword: (commandCode) => createBrowserPasswordPromptAdapter()
      .promptForPassword(
        commandCode === "password_required"
          ? "Enter the archive password to retry."
          : "The password was not accepted. Enter another password.",
      ),
    startExtract: runStartExtract,
    startTest: runTestArchive,
    handoffAcceptedJob: requestDisposableTaskJobHandoff,
    toCommandError: asCommandError,
    reportFailure: setSurfaceError,
  }), []);

  useEffect(() => {
    void persistDiagnosticEvent({
      scope: "disposableTaskSurface",
      name: "mounted",
      fields: { jobKind: bootstrap.kind, initialStatus: bootstrap.status },
    }).catch(() => {});
  }, [bootstrap.kind, bootstrap.status]);

  useEffect(() => {
    let disposed = false;
    let unsubscribeUpdates: (() => Promise<void>) | null = null;
    let unlistenClose: (() => void) | null = null;
    void createTauriJobFeed().subscribeJob(state.job.jobId, (snapshot) => {
        if (!disposed) dispatch({ type: "jobUpdated", snapshot });
      }).then((subscription) => {
        unsubscribeUpdates = subscription.unsubscribe;
      }).catch((error) => {
        if (!disposed) {
          setSurfaceError(asCommandError(error)?.message ?? "Unable to receive task updates.");
        }
      });
    void listenDisposableTaskCloseRequested(() => dispatch({ type: "closeRequested" }))
      .then((unlisten) => {
        unlistenClose = unlisten;
      })
      .catch(() => {
        if (!disposed) setSurfaceError("Unable to register task window controls.");
      });
    void announceDisposableTaskReady().catch(() => {
      if (!disposed) setSurfaceError("Unable to connect this task window to the manager.");
    });
    return () => {
      disposed = true;
      void unsubscribeUpdates?.();
      unlistenClose?.();
    };
  }, [state.job.jobId]);

  useEffect(() => {
    if (!isLiveDisposableTask(state)) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    void persistDiagnosticEvent({
      scope: "disposableTaskSurface",
      name: "phaseChanged",
      fields: { jobKind: state.job.kind, phase: state.phase, jobStatus: state.job.status },
    }).catch(() => {});
  }, [state.job.kind, state.job.status, state.phase]);

  useEffect(() => {
    if (state.phase !== "succeeded" && state.phase !== "cancelled") return;
    const timer = window.setTimeout(() => dispatch({ type: "autoCloseElapsed" }), AUTO_CLOSE_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "closing") {
      void persistDiagnosticEvent({
        scope: "disposableTaskSurface",
        name: "closeRequested",
        fields: { jobKind: state.job.kind, jobStatus: state.job.status },
      }).catch(() => {}).finally(() => closeDisposableTaskWindow());
    }
  }, [state.phase]);

  const cancel = async () => {
    dispatch({ type: "cancelRequested" });
    try {
      await cancelJob({ jobId: state.job.jobId });
    } catch {
      dispatch({ type: "controlRejected" });
    }
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setSurfaceError("");
    const result = await recovery.retryWithPassword(state.job);
    setRetrying(false);
    if (result === "started") {
      dispatch({ type: "continueInBackground" });
    }
  };

  return <DisposableTaskView
    state={state}
    nowMs={nowMs}
    onCancel={() => { void cancel(); }}
    onClose={() => dispatch({ type: "closeRequested" })}
    onContinueInBackground={() => dispatch({ type: "continueInBackground" })}
    onKeepOpen={() => dispatch({ type: "keepOpen" })}
    onMinimize={() => { void minimizeDisposableTaskWindow(); }}
    onPause={() => { void pauseJob({ jobId: state.job.jobId }).catch(() => dispatch({ type: "controlRejected" })); }}
    onRetry={() => { void retry(); }}
    onResume={() => { void resumeJob({ jobId: state.job.jobId }).catch(() => dispatch({ type: "controlRejected" })); }}
    onRunOutputAction={(action, path) => {
      void requestDisposableTaskOutputAction({ action, path }).catch(() => {
        setSurfaceError("Unable to open the task output.");
      });
    }}
    retrying={retrying}
    surfaceError={surfaceError}
  />;
}

function disposableTaskBootstrap(search: string): StartJobResponseDto | null {
  const params = new URLSearchParams(search);
  const jobId = params.get("jobId")?.trim() ?? "";
  const kind = params.get("kind") as JobKind | null;
  const status = params.get("status") as JobStatus | null;
  const createdAt = params.get("createdAt")?.trim() ?? "";
  if (!jobId || !kind || !status || !createdAt) return null;
  return { jobId, kind, status, createdAt };
}
