import { formatBytes, formatDate } from "../../../app/formatting";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { translatorForSnapshot } from "./shellHelpers";

export function StatusBar() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const model = statusBarModel(snapshot);

  return (
    <footer className="status-bar" aria-live="polite">
      <span id="status-selection-count" className="status-part">{model.selectionCountText}</span>
      <span id="status-selection-size" className="status-part">{model.selectionSizeText}</span>
      <span id="status-focused-size" className="status-part">{model.focusedSizeText}</span>
      <span id="status-focused-modified" className="status-part">{model.focusedModifiedText}</span>
      <span id="workspace-status" className="status-part workspace-status">{snapshot.shell.operationalStatus || i18n.t("workspace.readyWithPeriod")}</span>
      <span id="status-text" className="sr-only">{snapshot.shell.operationalStatus || i18n.t("workspace.readyWithPeriod")}</span>
      <button id="status-job-button" type="button" onClick={() => actions.handleJobsIntent({ type: "openDrawer" })}>
        <span id="active-job-text">{model.activeJobText}</span>
      </button>
    </footer>
  );
}

type StatusBarModel = Readonly<{
  selectionCountText: string;
  selectionSizeText: string;
  focusedSizeText: string;
  focusedModifiedText: string;
  activeJobText: string;
}>;

type ActiveJob = NonNullable<ZManagerReactSnapshot["jobs"]["activeJob"]>;
type SnapshotJobKind = ActiveJob["kind"];
type SnapshotJobStatus = ActiveJob["status"];

function statusBarModel(snapshot: ZManagerReactSnapshot): StatusBarModel {
  const i18n = translatorForSnapshot(snapshot);
  const selection = snapshot.archive.view.selection;
  const locale = snapshot.display.resolvedLocale;
  const focusedEntry = selection.focusedEntry;

  if (snapshot.shell.activeMode === "compress") {
    const count = snapshot.create.plan.current
      ? snapshot.create.inclusion.includedCount
      : snapshot.create.sourceCount;
    return {
      selectionCountText: i18n.t("compress.sourceStaged", {
        count,
        sourceLabel: i18n.t(count === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
      }),
      selectionSizeText: "",
      focusedSizeText: "",
      focusedModifiedText: "",
      activeJobText: activeJobText(snapshot),
    };
  }

  return {
    selectionCountText: `${selection.visibleSelectedCount} / ${selection.visibleSelectablePaths.length} object(s) selected`,
    selectionSizeText: selection.visibleSelectedSize > 0
      ? formatBytes(selection.visibleSelectedSize, { locale })
      : "",
    focusedSizeText: focusedEntry?.size !== undefined
      ? formatBytes(focusedEntry.size, { locale })
      : "",
    focusedModifiedText: focusedEntry?.modified
      ? formatDate(focusedEntry.modified, { locale, emptyValue: "" })
      : "",
    activeJobText: activeJobText(snapshot),
  };
}

function activeJobText(snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);
  const activeJob = snapshot.jobs.activeJob;
  if (!activeJob) {
    return i18n.t("status.noJobs");
  }

  return `${formatJobKind(activeJob.kind, snapshot)}: ${i18n.t(jobStatusMessageKey(activeJob.status))}`;
}

function formatJobKind(kind: SnapshotJobKind, snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);
  const key = `jobs.kind.${kind}` as const;
  return i18n.t(key);
}

function jobStatusMessageKey(status: SnapshotJobStatus) {
  switch (status) {
    case "queued":
      return "jobs.status.queued";
    case "running":
      return "jobs.status.running";
    case "paused":
      return "jobs.status.paused";
    case "completed":
      return "jobs.status.completed";
    case "failed":
      return "jobs.status.failed";
    case "cancelled":
      return "jobs.status.cancelled";
  }
}
