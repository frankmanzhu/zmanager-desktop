import { formatBytes, formatDate } from "../../../app/formatting";
import { useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { translatorForSnapshot } from "./shellHelpers";

export function StatusBar() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const model = statusBarModel(snapshot);

  return (
    <footer
      className="grid h-[26px] min-h-[26px] shrink-0 grid-cols-5 items-center gap-2 border-t border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      data-shell-chrome="status"
      aria-live="polite"
    >
      <span id="status-selection-count" className="truncate">
        {model.selectionCountText}
      </span>
      <span id="status-selection-size" className="truncate">
        {model.selectionSizeText}
      </span>
      <span id="status-focused-size" className="truncate">
        {model.focusedSizeText}
      </span>
      <span id="status-focused-modified" className="truncate">
        {model.focusedModifiedText}
      </span>
      <span
        id="workspace-status"
        className="truncate text-slate-700 dark:text-slate-200"
      >
        {snapshot.shell.operationalStatus ||
          i18n.t("workspace.readyWithPeriod")}
      </span>
      <span id="status-text" className="sr-only">
        {snapshot.shell.operationalStatus ||
          i18n.t("workspace.readyWithPeriod")}
      </span>
    </footer>
  );
}

type StatusBarModel = Readonly<{
  selectionCountText: string;
  selectionSizeText: string;
  focusedSizeText: string;
  focusedModifiedText: string;
}>;

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
        sourceLabel: i18n.t(
          count === 1 ? "compress.sourceSingular" : "compress.sourcePlural",
        ),
      }),
      selectionSizeText: "",
      focusedSizeText: "",
      focusedModifiedText: "",
    };
  }

  return {
    selectionCountText: i18n.t("status.selectionCount", {
      selected: selection.visibleSelectedCount,
      total: selection.visibleSelectablePaths.length,
    }),
    selectionSizeText:
      selection.visibleSelectedSize > 0
        ? i18n.t("status.selectedSize", {
            size: formatBytes(selection.visibleSelectedSize, { locale }),
          })
        : "",
    focusedSizeText:
      focusedEntry?.size !== undefined
        ? i18n.t("status.focusedSize", {
            size: formatBytes(focusedEntry.size, { locale }),
          })
        : "",
    focusedModifiedText: focusedEntry?.modified
      ? i18n.t("status.focusedModified", {
          date: formatDate(focusedEntry.modified, { locale, emptyValue: "" }),
        })
      : "",
  };
}
