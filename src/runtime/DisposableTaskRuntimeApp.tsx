import { useEffect, useReducer, useState } from "react";

import { cancelJob, pauseJob, resumeJob } from "../api/commands";
import type { JobKind, JobStatus, StartJobResponseDto } from "../api/types";
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
} from "../desktop/disposableTaskWindow";
import { createTauriJobFeed } from "../desktop/jobFeed";
import { DisposableTaskView } from "../ui/react/tasks/DisposableTaskApp";

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

  useEffect(() => {
    let disposed = false;
    let unsubscribeUpdates: (() => Promise<void>) | null = null;
    let unlistenClose: (() => void) | null = null;
    void Promise.all([
      createTauriJobFeed().subscribeJob(state.job.jobId, (snapshot) => {
        if (!disposed) dispatch({ type: "jobUpdated", snapshot });
      }).then((subscription) => { unsubscribeUpdates = subscription.unsubscribe; }),
      listenDisposableTaskCloseRequested(() => dispatch({ type: "closeRequested" }))
        .then((unlisten) => { unlistenClose = unlisten; }),
      announceDisposableTaskReady(),
    ]);
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
    if (state.phase !== "succeeded" && state.phase !== "cancelled") return;
    const timer = window.setTimeout(() => dispatch({ type: "autoCloseElapsed" }), AUTO_CLOSE_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "closing") void closeDisposableTaskWindow();
  }, [state.phase]);

  const cancel = async () => {
    dispatch({ type: "cancelRequested" });
    try {
      await cancelJob({ jobId: state.job.jobId });
    } catch {
      dispatch({ type: "controlRejected" });
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
    onResume={() => { void resumeJob({ jobId: state.job.jobId }).catch(() => dispatch({ type: "controlRejected" })); }}
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
