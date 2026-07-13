import { Archive, CircleCheck, CircleX, FileArchive, LoaderCircle, Pause, Play, X } from "lucide-react";
import { useMemo } from "react";

import { deriveRetainedJobProgress } from "../../../app/jobs";
import {
  isLiveDisposableTask,
  type DisposableTaskJobSnapshot,
  type DisposableTaskState,
} from "../../../app/workspaces/disposableTask";
import { formatBytes } from "../../../app/formatting";
import { Button } from "../../components/ui/button";
import { HelpTooltip } from "../../components/ui/tooltip";

export function DisposableTaskView({
  state,
  nowMs,
  onCancel,
  onClose,
  onContinueInBackground,
  onKeepOpen,
  onMinimize,
  onPause,
  onResume,
}: Readonly<{
  state: DisposableTaskState;
  nowMs: number;
  onCancel(): void;
  onClose(): void;
  onContinueInBackground(): void;
  onKeepOpen(): void;
  onMinimize(): void;
  onPause(): void;
  onResume(): void;
}>) {
  const progress = useMemo(() => deriveRetainedJobProgress(state.job), [nowMs, state.job]);
  const create = isCreateKind(state.job.kind);
  const title = create ? "Compressing with ZManager" : "Extracting with ZManager";
  const subtitle = taskKindLabel(state.job.kind);
  const failedEvent = state.job.latestFailure;

  return <main className="flex min-h-screen min-w-0 max-w-full flex-col overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <header className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm">{create ? <Archive className="size-5" /> : <FileArchive className="size-5" />}</div>
        <div className="min-w-0"><h1 className="text-base font-semibold">{title}</h1><p className="truncate text-xs opacity-60">{subtitle}</p></div>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Close task" onClick={onClose}><X className="size-4" /></Button>
    </header>

    <section className="grid min-w-0 flex-1 content-start gap-5 overflow-hidden px-5 py-5">
      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-3 flex items-center justify-between gap-3"><TaskState state={state} /><span className="text-xs tabular-nums opacity-60">{formatClock(progress.elapsedMs)}</span></div>
        {progress.currentFile
          ? <HelpTooltip content={progress.currentFile}><p className="mb-3 min-h-5 max-w-full truncate text-sm font-medium">{compactProgressPath(progress.currentFile)}</p></HelpTooltip>
          : <p className="mb-3 min-h-5 max-w-full truncate text-sm font-medium">{taskPhaseLabel(progress.phase) || statusText(state)}</p>}
        <progress className="h-2 w-full overflow-hidden rounded-full" aria-label="Task progress" value={progress.progressPercent ?? undefined} max="100" />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Files" value={progress.totalFiles === null ? String(progress.processedFiles) : `${progress.processedFiles} / ${progress.totalFiles}`} />
          <Metric label="Processed" value={formatBytes(progress.processedBytes)} />
          <Metric label="Remaining" value={formatClock(progress.remainingMs)} />
        </div>
      </div>

      {state.phase === "failed" ? <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 text-sm text-red-800 dark:text-red-200"><strong className="block">Task failed</strong><span>{failedEvent?.message || "The archive job could not be completed."}</span></div> : null}
      {state.closePromptOpen ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4"><h2 className="text-sm font-semibold">This task is still running</h2><p className="mt-1 text-xs opacity-70">Keep it running in the background, cancel it, or return to progress.</p><div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" variant="dialog" size="unset" onClick={onContinueInBackground}>Run in background</Button><Button type="button" variant="dialog" size="unset" onClick={onCancel}>Cancel task</Button><Button type="button" variant="dialogPrimary" size="unset" onClick={onKeepOpen}>Keep open</Button></div></div> : null}
    </section>

    <footer className="flex items-center justify-between border-t border-black/10 px-5 py-3 dark:border-white/10">
      <Button type="button" variant="dialog" size="unset" onClick={onMinimize}>Minimize</Button>
      <div className="flex gap-2">
        {state.phase === "running" ? <Button type="button" variant="dialog" size="unset" onClick={onPause}><Pause className="mr-1 size-3" />Pause</Button> : null}
        {state.phase === "paused" ? <Button type="button" variant="dialog" size="unset" onClick={onResume}><Play className="mr-1 size-3" />Resume</Button> : null}
        {isLiveDisposableTask(state) ? <Button type="button" variant="dialog" size="unset" onClick={onCancel}>Cancel</Button> : null}
        {state.phase === "failed" ? <Button type="button" variant="dialogPrimary" size="unset" onClick={onClose}>Close</Button> : null}
      </div>
    </footer>
  </main>;
}

function TaskState({ state }: Readonly<{ state: DisposableTaskState }>) {
  if (state.phase === "succeeded") return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CircleCheck className="size-4" />Completed</span>;
  if (state.phase === "failed") return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300"><CircleX className="size-4" />Failed</span>;
  if (state.phase === "cancelled") return <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><CircleX className="size-4" />Cancelled</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300"><LoaderCircle className="size-4 animate-spin" />{statusText(state)}</span>;
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-lg bg-black/[0.035] px-2 py-2 dark:bg-white/[0.05]"><strong className="block truncate text-sm tabular-nums">{value}</strong><span className="opacity-55">{label}</span></div>;
}

function statusText(state: DisposableTaskState): string {
  switch (state.phase) {
    case "starting": return "Starting…";
    case "running": return "Working…";
    case "paused": return "Paused";
    case "cancelling": return "Cancelling…";
    case "succeeded": return "Completed";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
    case "closing": return "Closing…";
  }
}

function isCreateKind(kind: DisposableTaskJobSnapshot["kind"]): boolean {
  return kind.endsWith("Create");
}

function taskKindLabel(kind: DisposableTaskJobSnapshot["kind"]): string {
  return kind.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());
}

function taskPhaseLabel(phase: ReturnType<typeof deriveRetainedJobProgress>["phase"]): string {
  switch (phase) {
    case "planningPayload": return "Planning archive…";
    case "planningMetadata": return "Planning archive metadata…";
    case "emittingPayload": return "Writing archive payload…";
    case "emittingMetadata": return "Writing recovery metadata…";
    case "committingOutput": return "Finalizing archive…";
    case null:
    case undefined: return "";
  }
}

function formatClock(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return "--:--";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function compactProgressPath(path: string | null, maxCharacters = 64): string {
  if (!path || path.length <= maxCharacters) return path ?? "";

  const parts = path.split(/[\\/]+/).filter(Boolean);
  const tail = parts.slice(-2).join("/");
  if (tail.length <= maxCharacters - 2) return `…/${tail}`;

  const fileName = parts.at(-1) ?? path;
  if (fileName.length <= maxCharacters - 2) return `…/${fileName}`;
  return `…${fileName.slice(-(maxCharacters - 1))}`;
}
