import { ChevronDown, File, Folder, KeyRound, LoaderCircle, Plus, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { formatBytes, getPathBasename } from "../../../app/formatting";
import { sourcePathForCreatePlanRow, type CreatePlanRow } from "../../../app/createFlow";
import { createFormatCapabilities } from "../../../app/createFormatCapabilities";
import { formatVolumeSize } from "../../../app/volumeSizePresets";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { nativeIconDataUrlForPath } from "../systemFileIcons";
import type { ZManagerReactActions, ZManagerReactSnapshot } from "../appRuntime";
import { useCreatePasswordState } from "./CreatePasswordContext";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { WorkspaceBrowserShell } from "../workspace/WorkspaceBrowserShell";
import { WorkspacePathBar } from "../workspace/WorkspacePathBar";
import { armTableMarqueeSelectionGesture, type ViewportRect } from "../workspace/tableMarqueeSelection";

const COMPRESS_SOURCE_COLUMN_IDS = ["name", "size", "modified", "kind"] as const;
const COMPRESS_SOURCE_INCLUDE_COLUMN_WIDTH_PX = 28;
const COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX = 520;
const COMPRESS_SOURCE_DEFAULT_COLUMN_WIDTHS: Record<CompressSourceColumnId, number> = {
  name: 320,
  size: 120,
  modified: 170,
  kind: 120,
};
const COMPRESS_SOURCE_MIN_COLUMN_WIDTHS: Record<CompressSourceColumnId, number> = {
  name: 140,
  size: 72,
  modified: 110,
  kind: 80,
};

type CompressSourceColumnId = typeof COMPRESS_SOURCE_COLUMN_IDS[number];

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const ADVANCED_FIELD_CLASS = "grid !grid-cols-1 !items-stretch !gap-1.5 text-[11px] font-semibold leading-4 text-slate-600 dark:text-slate-300 [&>input]:!h-9 [&>input]:!min-h-9 [&>input]:!w-full [&>input]:!text-xs [&>input]:font-normal [&>select]:!h-9 [&>select]:!min-h-9 [&>select]:!w-full [&>select]:!text-xs [&>select]:font-normal";

export function CreateWorkspace() {
  const snapshot = useZManagerSnapshot();
  const { reset: resetCreatePassword } = useCreatePasswordState();

  useBrowserLayoutEffect(() => {
    resetCreatePassword();
    return () => resetCreatePassword();
  }, [resetCreatePassword, snapshot.create.options.format, snapshot.create.options.password.visible]);

  return (
    <>
      <CreatePathBar />
      <WorkspaceBrowserShell
        ariaLabel="Create archive workspace"
        navigation={<CreateTree />}
        table={<CreateTable />}
        sidePane={<CreateOptions />}
      />
    </>
  );
}

function CreatePathBar() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const create = snapshot.create;
  const [destination, setDestination] = useState(create.options.destinationPath);

  useEffect(() => {
    setDestination(create.options.destinationPath);
  }, [create.options.destinationPath]);

  const currentFolder = create.view.currentFolder;
  const fallbackTitle = i18n.t("compress.tableTitle");
  const archiveTitle = compressArchiveDisplayName(destination, fallbackTitle);
  const breadcrumbs = createBreadcrumbs(currentFolder, archiveTitle);
  const searchResultText = create.plan.current
    ? i18n.t(
      create.view.rows.filter((row) => row.rowType !== "parent").length === 1
        ? "search.oneResult"
        : "search.results",
      { count: create.view.rows.filter((row) => row.rowType !== "parent").length },
    )
    : "";

  return (
    <WorkspacePathBar
      ariaLabel={i18n.t("workspace.archiveLocation.aria")}
      locationLabel={i18n.t("compress.destination")}
      pathAriaLabel={i18n.t("compress.destination")}
      pathInputId="create-destination"
      displayPath={destination}
      pathDisabled={false}
      pathReadOnly={false}
      pathPlaceholder={i18n.t("compress.destination.placeholder")}
      onPathChange={(path) => {
        setDestination(path);
        actions.handleCreateIntent({ type: "setDestinationPath", destinationPath: path });
      }}
      crumbs={breadcrumbs}
      crumbsHidden={!create.hasSources}
      emptyCrumbsText={archiveTitle}
      onCrumbClick={(path) => actions.handleCreateIntent({ type: "navigateToFolder", folderPath: path })}
      search={{
        query: create.view.searchQuery,
        disabled: !create.plan.current,
        clearDisabled: !create.view.searchQuery.trim(),
        resultText: searchResultText,
        entriesLabel: i18n.t("search.entries"),
        placeholder: i18n.t("search.sources.placeholder"),
        buttonLabel: i18n.t("search.button"),
        clearLabel: i18n.t("search.clear"),
        clearAriaLabel: i18n.t("search.clear.aria"),
        onChange: (query) => actions.handleCreateIntent({ type: "setSearchQuery", query }),
        onSubmit: (query) => actions.handleCreateIntent({ type: "setSearchQuery", query }),
        onClear: () => actions.handleCreateIntent({ type: "clearSearch" }),
      }}
    />
  );
}

function createBreadcrumbs(currentFolder: string, rootName: string) {
  const crumbs = [{ name: rootName, path: "" }];
  let path = "";
  for (const segment of currentFolder.split("/").filter(Boolean)) {
    path = path ? `${path}/${segment}` : segment;
    crumbs.push({ name: segment, path });
  }
  return crumbs;
}

function compressArchiveDisplayName(destinationPath: string, fallback: string): string {
  const archiveName = getPathBasename(destinationPath, "").trim();
  return archiveName || fallback;
}

function CreateTree() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const folders = snapshot.create.view.treeFolders;

  return (
    <aside id="navigation-pane" className="navigation-pane" aria-label={i18n.t("workspace.archiveNavigation.aria")}>
      <div className="pane-header"><h2>{i18n.t("pane.folders")}</h2></div>
      <div id="tree-content" className="tree-content">
        {folders.length ? folders.map((folder) => (
          <button
            className={`tree-item ${folder.path === snapshot.create.view.currentFolder ? "is-active" : ""}`}
            type="button"
            data-compress-folder-path={folder.path}
            style={{ "--depth": folder.depth } as CSSProperties}
            key={folder.path || "__root__"}
            onClick={() => actions.handleCreateIntent({ type: "navigateToFolder", folderPath: folder.path })}
          >
            <span className="tree-disclosure" aria-hidden="true">{folder.hasChildren ? (folder.isExpanded ? "v" : ">") : ""}</span>
            <Folder className="tree-icon tree-icon-folder" aria-hidden="true" />
            <span className="tree-label">{folder.name}</span>
          </button>
        )) : <div className="empty-pane"><p>{i18n.t("compress.noSources")}</p></div>}
      </div>
    </aside>
  );
}

function CreateTable() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<ViewportRect | null>(null);
  const i18n = translatorForSnapshot(snapshot);
  const rows = snapshot.create.view.rows;
  const includeAll = includeAllState(snapshot);
  const isRefreshing = snapshot.create.plan.state === "loading" && snapshot.create.plan.current !== null;
  const workspaceTitle = compressArchiveDisplayName(
    snapshot.create.options.destinationPath,
    i18n.t("compress.tableTitle"),
  );

  useEffect(() => {
    const tableShell = tableShellRef.current;
    if (!tableShell) {
      return;
    }

    const preventSelectionGesture = (event: Event) => event.preventDefault();
    tableShell.addEventListener("selectstart", preventSelectionGesture);
    tableShell.addEventListener("dragstart", preventSelectionGesture);
    return () => {
      tableShell.removeEventListener("selectstart", preventSelectionGesture);
      tableShell.removeEventListener("dragstart", preventSelectionGesture);
    };
  }, []);

  return (
    <section className="archive-table-pane" aria-label={i18n.t("workspace.archiveEntries.aria")}>
      <div className="table-pane-header">
        <div>
          <h1 id="workspace-title">{workspaceTitle}</h1>
          <p id="browse-meta">{i18n.t("compress.tableDescription")}</p>
        </div>
        {isRefreshing ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.07] px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300" role="status" aria-live="polite">
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
            <span>{i18n.t("create.plan.refreshing")}</span>
          </div>
        ) : null}
      </div>
      <p id="browse-message" className="status status-idle" hidden />
      <div id="compress-surface" className="compress-surface">
        <ul id="source-list" className="list-box" hidden>
          {snapshot.create.sources.map((source) => <li data-source-path={source} key={source}>{source}</li>)}
        </ul>
        <div
          ref={tableShellRef}
          className="compress-table-shell"
          tabIndex={0}
          onPointerDownCapture={(event) => {
            armCreateMarqueeSelectionGesture({
              event,
              snapshot,
              actions,
              tableBody: tableBodyRef.current,
              setMarqueeRect,
            });
          }}
        >
          <div id="compress-marquee-hit-surface" className="marquee-hit-surface" aria-hidden="true" />
          {marqueeRect ? <div className="marquee-selection" style={marqueeRect} /> : null}
          <table id="compress-source-table" className={createTableClassName(snapshot)}>
            {rows.length ? (
              <thead>
                <tr>
                  <th className="inclusion-column">
                    <input
                      id="compress-include-all"
                      type="checkbox"
                      aria-label={i18n.t("compress.includeAll")}
                      disabled={includeAll.disabled}
                      checked={includeAll.checked}
                      ref={(node) => {
                        if (node) node.indeterminate = includeAll.indeterminate;
                      }}
                      onChange={(event) => actions.handleCreateIntent({ type: "setCurrentFolderIncluded", included: event.currentTarget.checked })}
                    />
                  </th>
                  <CompressSourceHeader columnId="name" label={i18n.t("table.name")} />
                  <CompressSourceHeader columnId="size" label={i18n.t("table.size")} />
                  <CompressSourceHeader columnId="modified" label={i18n.t("table.modified")} />
                  <CompressSourceHeader columnId="kind" label={i18n.t("table.kind")} />
                </tr>
              </thead>
            ) : null}
            <tbody id="compress-source-body" ref={tableBodyRef}>
              {rows.length ? rows.map((row) => <CreateTableRow row={row} key={row.rowId} />) : (
                <tr><td colSpan={5} className="compress-empty-cell"><div className="compress-empty-state"><strong>{i18n.t("compress.emptyTable")}</strong><span>{i18n.t("compress.dragSourcesHint")}</span></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="table-shell" hidden />
    </section>
  );
}

function armCreateMarqueeSelectionGesture(input: Readonly<{
  event: ReactPointerEvent<HTMLElement>;
  snapshot: ZManagerReactSnapshot;
  actions: ZManagerReactActions;
  tableBody: HTMLTableSectionElement | null;
  setMarqueeRect: (rect: ViewportRect | null) => void;
}>) {
  const { event, snapshot, actions, tableBody, setMarqueeRect } = input;
  armTableMarqueeSelectionGesture({
    event,
    tableBody,
    selectedPaths: snapshot.create.selection.selectedPaths,
    visiblePaths: createVisibleSelectablePaths(snapshot),
    rowSelector: "tr[data-compress-path]",
    rowPath: (row) => row.dataset.compressPath,
    canStart: (candidate) => canStartCreateMarqueeSelection(candidate, snapshot),
    setMarqueeRect,
    applySelection: (selection) => actions.handleCreateIntent({
      type: "applySelection",
      selectedPaths: [...selection.selectedPaths],
      focusedPath: selection.focusedPath,
      anchorPath: selection.anchorPath,
    }),
  });
}

function canStartCreateMarqueeSelection(
  event: ReactPointerEvent<HTMLElement>,
  snapshot: ZManagerReactSnapshot,
): boolean {
  if (
    event.button !== 0
    || snapshot.create.plan.state === "loading"
    || createVisibleSelectablePaths(snapshot).length === 0
  ) {
    return false;
  }

  if (!(event.target instanceof HTMLElement)) {
    return false;
  }

  if (event.target.closest("button, a, input, select, textarea, .column-resizer")) {
    return false;
  }

  return !event.target.closest(".row-primary");
}

function createVisibleSelectablePaths(snapshot: ZManagerReactSnapshot): string[] {
  return snapshot.create.view.rows
    .filter((row) => row.rowType !== "parent")
    .map((row) => row.path);
}

function createTableClassName(snapshot: ZManagerReactSnapshot): string {
  return [
    snapshot.preferences.showGridLines ? "show-grid" : "",
    snapshot.preferences.fullRowSelect ? "full-row-select" : "",
    snapshot.preferences.singleClickOpen ? "single-click-open" : "",
  ].filter(Boolean).join(" ");
}

function CompressSourceHeader({
  columnId,
  label,
}: Readonly<{
  columnId: CompressSourceColumnId;
  label: string;
}>) {
  return (
    <th data-compress-column-id={columnId}>
      <span className="column-header-label">{label}</span>
      <span
        className="column-resizer"
        data-column-resizer={columnId}
        aria-hidden="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => startCompressSourceColumnResize(event, columnId)}
      />
    </th>
  );
}

function startCompressSourceColumnResize(
  event: ReactPointerEvent<HTMLElement>,
  columnId: CompressSourceColumnId,
) {
  if (event.button !== 0) {
    return;
  }

  const table = event.currentTarget.closest<HTMLTableElement>("table");
  if (!table) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-column");

  const startX = event.clientX;
  const startWidths = readCompressSourceColumnWidths(table);
  let latestWidths = startWidths;
  applyCompressSourceColumnWidths(table, latestWidths);

  const onPointerMove = (moveEvent: PointerEvent) => {
    latestWidths = {
      ...startWidths,
      [columnId]: clampCompressSourceColumnWidth(
        columnId,
        startWidths[columnId] + moveEvent.clientX - startX,
      ),
    };
    applyCompressSourceColumnWidths(table, latestWidths);
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-column");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    applyCompressSourceColumnWidths(table, latestWidths);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
}

function readCompressSourceColumnWidths(table: HTMLTableElement): Record<CompressSourceColumnId, number> {
  const widths = { ...COMPRESS_SOURCE_DEFAULT_COLUMN_WIDTHS };
  for (const columnId of COMPRESS_SOURCE_COLUMN_IDS) {
    const renderedWidth = table.querySelector<HTMLTableCellElement>(
      `th[data-compress-column-id="${columnId}"]`,
    )?.getBoundingClientRect().width;
    widths[columnId] = clampCompressSourceColumnWidth(
      columnId,
      Number.isFinite(renderedWidth) && renderedWidth ? renderedWidth : widths[columnId],
    );
  }
  return widths;
}

function applyCompressSourceColumnWidths(
  table: HTMLTableElement,
  widths: Record<CompressSourceColumnId, number>,
): void {
  for (const columnId of COMPRESS_SOURCE_COLUMN_IDS) {
    table.style.setProperty(`--compress-source-${columnId}-column-width`, `${widths[columnId]}px`);
  }
  const tableWidth = COMPRESS_SOURCE_INCLUDE_COLUMN_WIDTH_PX
    + COMPRESS_SOURCE_COLUMN_IDS.reduce((total, columnId) => total + widths[columnId], 0);
  table.style.minWidth = `${tableWidth}px`;
}

function clampCompressSourceColumnWidth(columnId: CompressSourceColumnId, width: number): number {
  return Math.min(
    COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX,
    Math.max(COMPRESS_SOURCE_MIN_COLUMN_WIDTHS[columnId], Math.round(width)),
  );
}

function CreateTableRow({ row }: Readonly<{ row: CreatePlanRow }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const sourcePath = sourcePathForCreatePlanRow(row, snapshot.create.plan.current?.planEntries ?? [], snapshot.create.sources);
  const inclusion = row.rowType === "parent" ? "included" : inclusionStateForPath(snapshot, row.path);
  const isFolder = row.rowType !== "entry" || row.entry.kind === "directory";
  const nativeIconDataUrl = sourcePath
    ? nativeIconDataUrlForPath(snapshot, sourcePath, isFolder)
    : null;
  const data = row.rowType === "entry" ? row.entry : undefined;
  const path = row.path;
  const selectable = row.rowType !== "parent";
  const selected = selectable && snapshot.create.selection.selectedPaths.includes(path);
  const focused = selectable && snapshot.create.selection.focusedPath === path;
  const rowClassName = [
    isFolder ? "folder-row" : "",
    row.rowType === "parent" ? "parent-row" : "",
    selected ? "is-selected" : "",
    focused ? "is-focused-row" : "",
    selectable && inclusion === "excluded" ? "is-excluded" : "",
    selectable && isFolder && inclusion === "partial" ? "is-partial" : "",
  ].filter(Boolean).join(" ");

  return (
    <tr
      className={rowClassName || undefined}
      tabIndex={0}
      data-compress-path={row.rowType === "parent" ? undefined : path}
      data-compress-folder-row={isFolder ? path : undefined}
      data-compress-entry-row={!isFolder ? path : undefined}
      data-compress-source-path={sourcePath || undefined}
      aria-label={row.name}
      aria-selected={selectable ? selected : undefined}
      aria-keyshortcuts={selectable ? "Space Enter Delete ContextMenu Shift+F10" : "Enter ContextMenu Shift+F10"}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-compress-include]")) {
          return;
        }
        const plainPrimaryClick = !event.ctrlKey && !event.metaKey && !event.shiftKey;
        if (selectable) {
          event.currentTarget.focus();
          actions.handleCreateIntent({
            type: "selectRow",
            path,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
          });
        }
        if (isFolder && (event.detail >= 2 || (snapshot.preferences.singleClickOpen && plainPrimaryClick))) {
          actions.handleCreateIntent({ type: "navigateToFolder", folderPath: path });
        }
      }}
      onFocus={() => {
        if (selectable) {
          actions.handleCreateIntent({ type: "focusRow", path });
        }
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-compress-include]")) {
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          focusRelativeCreateRow(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
          return;
        }
        if ((event.key === " " || event.key === "Spacebar") && selectable) {
          event.preventDefault();
          event.stopPropagation();
          actions.handleCreateIntent({ type: "toggleRowSelection", path });
          return;
        }
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const point = createRowContextMenuPoint(event.currentTarget);
          actions.handleCreateIntent({
            type: "showCompressRowContextMenu",
            path,
            sourcePath: sourcePath || undefined,
            x: point.x,
            y: point.y,
          });
          return;
        }
        if (event.key === "Delete" && selectable) {
          event.preventDefault();
          actions.handleCreateIntent({
            type: "removeSelectedSources",
            fallbackSourcePath: sourcePath || undefined,
          });
          return;
        }
        if (event.key === "Enter" && isFolder) {
          event.preventDefault();
          event.stopPropagation();
          actions.handleCreateIntent({ type: "navigateToFolder", folderPath: path });
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        actions.handleCreateIntent({
          type: "showCompressRowContextMenu",
          path,
          sourcePath: sourcePath || undefined,
          x: event.clientX,
          y: event.clientY,
        });
      }}
    >
      <td className="inclusion-column">
        {row.rowType === "parent" ? null : (
          <input
            data-compress-include
            data-compress-path={path}
            data-compress-inclusion-state={inclusion}
            type="checkbox"
            checked={inclusion !== "excluded"}
            ref={(node) => {
              if (node) node.indeterminate = inclusion === "partial";
            }}
            aria-label={i18n.t("compress.includeItem.aria", { name: row.name })}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => actions.handleCreateIntent({ type: "setPathIncluded", path, included: event.currentTarget.checked })}
          />
        )}
      </td>
      <td className="name-cell"><span className="row-primary"><span className={`row-icon row-icon-${isFolder ? "folder" : "file"}`} aria-hidden="true">{nativeIconDataUrl ? <img className="row-icon-native-image" src={nativeIconDataUrl} alt="" /> : isFolder ? <Folder className="row-icon-svg" /> : <File className="row-icon-svg" />}</span><span className="row-name">{row.name}</span>{selectable ? <span className={`source-stage-badge ${inclusion === "excluded" ? "is-excluded" : ""}`}>{compressInclusionText(inclusion, snapshot)}</span> : null}</span></td>
      <td>{data?.size === undefined ? "" : formatBytes(data.size, { locale: snapshot.display.resolvedLocale })}</td>
      <td>{data?.modified ?? ""}</td>
      <td>{isFolder ? i18n.t("entryKind.directory") : i18n.t("entryKind.file")}</td>
    </tr>
  );
}

function focusRelativeCreateRow(currentRow: HTMLTableRowElement, direction: 1 | -1): void {
  const rows = Array.from(currentRow.closest("tbody")?.querySelectorAll<HTMLTableRowElement>(
    "tr[data-compress-folder-row], tr[data-compress-entry-row]",
  ) ?? []);
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  rows[nextIndex]?.focus();
}

function createRowContextMenuPoint(row: HTMLTableRowElement): Readonly<{ x: number; y: number }> {
  const rect = row.getBoundingClientRect();
  return {
    x: rect.left + 24,
    y: rect.top + Math.min(rect.height - 2, 24),
  };
}

function compressInclusionText(
  inclusion: "included" | "excluded" | "partial",
  snapshot: ReturnType<typeof useZManagerSnapshot>,
): string {
  const i18n = translatorForSnapshot(snapshot);
  switch (inclusion) {
    case "included":
      return i18n.t("compress.inclusion.included");
    case "excluded":
      return i18n.t("compress.inclusion.excluded");
    case "partial":
      return i18n.t("compress.inclusion.partial");
  }
}

function CreateOptions() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const {
    password,
    passwordConfirm,
    showPassword,
    setPassword,
    setPasswordConfirm,
    setShowPassword,
    signingIdentityPassword,
    setSigningIdentityPassword,
  } = useCreatePasswordState();
  const i18n = translatorForSnapshot(snapshot);
  const options = snapshot.create.options;
  const capabilities = createFormatCapabilities(options.format);
  const volumeSizeChoices = options.volumeSize !== null && !snapshot.preferences.volumeSizePresets.includes(options.volumeSize)
    ? [options.volumeSize, ...snapshot.preferences.volumeSizePresets]
    : snapshot.preferences.volumeSizePresets;
  const [manualPanelOpen, setManualPanelOpen] = useState<boolean | null>(null);
  const [identityCommonName, setIdentityCommonName] = useState("TZAP Signing Identity");
  const panelOpen = manualPanelOpen ?? true;

  return (
    <aside id="details-pane" className="details-pane !min-h-0 !overflow-y-auto !bg-slate-50/70 pb-5 dark:!bg-slate-950/70 [@media(max-height:560px)]:[&_summary.compress-options-summary]:!hidden" aria-label={i18n.t("workspace.details.aria")}>
      <div className="pane-header !hidden"><h2 id="details-pane-title">{i18n.t("compress.options")}</h2></div>
      <div id="details-content" className="details-content" hidden />
      <details
        id="compress-options-panel"
        className="compress-options-panel min-w-0 !overflow-x-hidden px-3"
        open={panelOpen}
        onToggle={(event) => setManualPanelOpen(event.currentTarget.open)}
      >
        <summary className="compress-options-summary"><span className="compress-options-summary-title">{i18n.t("create.options.title")}</span></summary>
        <div className="mb-4 flex items-start gap-3 border-b border-slate-200 px-1 pb-4 pt-3 dark:border-slate-800">
          <div className="mt-0.5 rounded-lg bg-blue-600 p-2 text-white shadow-sm"><SlidersHorizontal className="size-4" /></div>
          <div className="min-w-0"><h3 className="text-sm font-semibold tracking-tight">{i18n.t("create.options.title")}</h3><p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{i18n.t("create.options.description")}</p></div>
        </div>
        <div id="create-plan-summary" className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
          {snapshot.create.inclusion.filteredPlan ? (
            <p>{i18n.t("create.status.ready", { count: snapshot.create.inclusion.filteredPlan.includedCount, size: formatBytes(snapshot.create.inclusion.filteredPlan.totalBytes, { locale: snapshot.display.resolvedLocale }) })}</p>
          ) : <p>{i18n.t("create.plan.empty")}</p>}
        </div>
        <div className="form-grid create-options-grid !gap-3">
          <label className="!grid-cols-1 !items-stretch !gap-1.5"><span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 [@media(max-height:560px)]:!hidden">{i18n.t("create.archiveFormat")}</span><select className="w-full" id="create-format" value={options.format} onChange={(event) => actions.handleCreateIntent({ type: "changeFormat", format: event.currentTarget.value as typeof options.format })}><option value="zip">ZIP</option><option value="tarZst">TZST</option><option value="tzap">TZAP</option><option value="sevenZ">7Z</option></select></label>
          <label className="!grid-cols-1 !items-stretch !gap-1.5"><span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 [@media(max-height:560px)]:!hidden">{i18n.t("create.compressionLevel")}</span><select className="w-full" id="create-compression-level" value={options.compressionLevel ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { compressionLevel: event.currentTarget.value } })}><option value="">{i18n.t("preferences.archiveDefaults.backendDefault")}</option><option value="0">0</option><option value="5">5</option><option value="9">9</option></select></label>
          <div className="col-span-full grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <label className="checkbox-row min-h-9 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><input id="create-clean-source" type="checkbox" checked={options.cleanSource} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { cleanSource: event.currentTarget.checked } })} /><span>{i18n.t("create.cleanSource")}</span></label>
            <label className="checkbox-row min-h-9 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><input id="create-respect-gitignore" type="checkbox" checked={options.respectGitignore} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { respectGitignore: event.currentTarget.checked } })} /><span>{i18n.t("create.respectGitignore")}</span></label>
            <label className="checkbox-row min-h-9 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><input id="create-preserve-metadata" type="checkbox" checked={options.preserveMetadata} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { preserveMetadata: event.currentTarget.checked } })} /><span>{i18n.t("create.preserveMetadata")}</span></label>
            <label className="checkbox-row min-h-9 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><input id="create-replace-existing" type="checkbox" checked={options.replaceExisting} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { replaceExisting: event.currentTarget.checked } })} /><span>{i18n.t("create.replaceExisting")}</span></label>
            <label className="checkbox-row min-h-9 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><input id="create-follow-symlinks" type="checkbox" checked={options.followSymlinks} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { followSymlinks: event.currentTarget.checked } })} /><span>{i18n.t("create.followSymlinks")}</span></label>
          </div>
        </div>
        <details id="create-advanced-options" className="group mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-xs font-semibold transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
            <span>{i18n.t("extract.advancedOptions")}</span>
            <ChevronDown className="size-4 opacity-55 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-4 border-t border-black/10 px-4 py-4 dark:border-white/10">
            {options.password.visible ? (
              <section className="grid gap-3 border-b border-black/10 pb-4 dark:border-white/10" aria-labelledby="create-password-title">
                <h4 id="create-password-title" className="text-xs font-semibold">{i18n.t("extract.password")}</h4>
                <div id="create-password-options" className="grid gap-2">
                  <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("extract.password")}</span><input id="create-password" type={showPassword ? "text" : "password"} value={password} disabled={options.password.disabled} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
                  <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("create.reenterPassword")}</span><input id="create-password-confirm" type={showPassword ? "text" : "password"} value={passwordConfirm} disabled={options.password.disabled} onChange={(event) => setPasswordConfirm(event.currentTarget.value)} /></label>
                  <label className="checkbox-row rounded-lg px-1 py-1"><input id="create-show-password" type="checkbox" checked={showPassword} disabled={options.password.disabled} onChange={(event) => setShowPassword(event.currentTarget.checked)} /><span>{i18n.t("extract.showPassword")}</span></label>
                </div>
              </section>
            ) : null}
            <div className="grid gap-3">
              <label className={ADVANCED_FIELD_CLASS} hidden={!capabilities.splitVolumes}><span>{i18n.t("create.splitSize")}</span><select id="create-volume" value={options.volumeSize ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { volumeSize: event.currentTarget.value } })}><option value="">{i18n.t("create.noSplit")}</option>{volumeSizeChoices.map((bytes) => <option value={bytes} key={bytes}>{formatVolumeSize(bytes)}</option>)}</select></label>
              <label className={ADVANCED_FIELD_CLASS} hidden={!capabilities.zipCompression}><span>{i18n.t("create.zipCompression")}</span><select id="create-zip-compression" value={options.zipCompression} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { zipCompression: event.currentTarget.value as "store" | "deflate" } })}><option value="deflate">Deflate</option><option value="store">{i18n.t("common.store")}</option></select></label>
              <label className={ADVANCED_FIELD_CLASS} id="create-tzap-recovery-field" hidden={!options.tzapRecovery.visible}><span>{i18n.t("create.tzapRecovery")}</span><input id="create-tzap-recovery" type="number" value={options.tzapRecoveryPercentage} disabled={options.tzapRecovery.disabled} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { tzapRecoveryPercentage: event.currentTarget.value } })} /></label>
              <label className={ADVANCED_FIELD_CLASS} hidden={!capabilities.tzapVolumeLossTolerance}><span>{i18n.t("create.tzapVolumeLossTolerance")}</span><input id="create-tzap-volume-tolerance" type="number" min="0" max="16" disabled={options.volumeSize === null} value={options.tzapVolumeLossTolerance} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { tzapVolumeLossTolerance: event.currentTarget.value } })} /></label>
            </div>
            {capabilities.sevenZAdvanced ? (
              <section className="grid gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <h4 className="text-xs font-semibold">{i18n.t("create.sevenZAdvanced")}</h4>
              <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("create.sevenZThreads")}</span><input id="create-7z-threads" type="number" min="1" max="256" value={options.sevenZThreads ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { sevenZThreads: event.currentTarget.value } })} /></label>
              <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("create.sevenZChunkSize")}</span><input id="create-7z-chunk-size" type="number" min="1" value={options.sevenZChunkSize ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { sevenZChunkSize: event.currentTarget.value } })} /></label>
              <label className="flex items-center gap-2"><input id="create-7z-solid" type="checkbox" checked={options.sevenZSolid} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { sevenZSolid: event.currentTarget.checked } })} /><span>{i18n.t("create.sevenZSolid")}</span></label>
              <label className="flex items-center gap-2"><input id="create-7z-encrypt-names" type="checkbox" checked={options.sevenZEncryptFileNames} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { sevenZEncryptFileNames: event.currentTarget.checked } })} /><span>{i18n.t("create.sevenZEncryptFileNames")}</span></label>
              </section>
            ) : null}
            {options.format === "tzap" ? (
              <section className="grid gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-black/10" aria-labelledby="create-tzap-certificates-title">
                <div>
                  <h4 id="create-tzap-certificates-title" className="text-xs font-semibold">{i18n.t("create.tzapCertificates")}</h4>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-65">{i18n.t("create.tzapCertificatesHelp")}</p>
                </div>
              <CertificatePicker title={i18n.t("create.tzapRecipientCertificates")} value={options.tzapRecipientCertificatePaths} icon={<ShieldCheck className="size-4" />} onChoose={() => actions.handleCreateIntent({ type: "chooseTzapCertificate", target: "recipients" })} onClear={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapRecipientCertificatePaths: "" } })} />
              <div className="rounded-xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><KeyRound className="size-4" />{i18n.t("create.tzapSigningIdentity")}</div>
                <div className="mb-3 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] rounded-lg bg-black/[0.06] p-1 dark:bg-white/[0.06]">
                  <button type="button" className={`min-h-8 min-w-0 truncate rounded-md !px-1 !py-1.5 !text-[10px] !font-semibold ${options.tzapSigningMode === "identity" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 opacity-80 dark:text-slate-300"}`} onClick={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningMode: "identity" } })}>{i18n.t("create.tzapIdentityFile")}</button>
                  <button type="button" className={`min-h-8 min-w-0 truncate rounded-md !px-1 !py-1.5 !text-[10px] !font-semibold ${options.tzapSigningMode === "advanced" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 opacity-80 dark:text-slate-300"}`} onClick={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningMode: "advanced" } })}>{i18n.t("create.tzapAdvancedIdentity")}</button>
                </div>
                {options.tzapSigningMode === "identity" ? <div className="grid gap-2">
                  <CertificatePicker compact title={i18n.t("create.tzapIdentityFile")} value={options.tzapSigningIdentityPath} onChoose={() => actions.handleCreateIntent({ type: "chooseTzapCertificate", target: "identity" })} onClear={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningIdentityPath: "" } })} />
                  <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("create.tzapIdentityName")}</span><input value={identityCommonName} onChange={(event) => setIdentityCommonName(event.currentTarget.value)} /></label>
                  <label className={ADVANCED_FIELD_CLASS}><span>{i18n.t("create.tzapIdentityPassword")}</span><input type="password" value={signingIdentityPassword} onChange={(event) => setSigningIdentityPassword(event.currentTarget.value)} /></label>
                  <button type="button" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 !text-[11px] !font-semibold text-blue-700 hover:bg-blue-500/15 dark:text-blue-300" onClick={() => actions.handleCreateIntent({ type: "generateTzapIdentity", commonName: identityCommonName, password: signingIdentityPassword })}><Plus className="size-3" />{i18n.t("create.tzapCreateIdentity")}</button>
                  <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">{i18n.t("create.tzapIdentityHelp")}</p>
                </div> : <div className="grid gap-2">
                  <CertificatePicker compact title={i18n.t("create.tzapSigningCertificate")} value={options.tzapSigningCertificatePath} onChoose={() => actions.handleCreateIntent({ type: "chooseTzapCertificate", target: "signer" })} onClear={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningCertificatePath: "" } })} />
                  <CertificatePicker compact title={i18n.t("create.tzapSigningPrivateKey")} value={options.tzapSigningPrivateKeyPath} onChoose={() => actions.handleCreateIntent({ type: "chooseTzapCertificate", target: "privateKey" })} onClear={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningPrivateKeyPath: "" } })} />
                  <CertificatePicker compact title={i18n.t("create.tzapSigningChain")} value={options.tzapSigningChainPaths} onChoose={() => actions.handleCreateIntent({ type: "chooseTzapCertificate", target: "chain" })} onClear={() => actions.handleCreateIntent({ type: "setOptions", patch: { tzapSigningChainPaths: "" } })} />
                  <p className="text-[10px] opacity-60">{i18n.t("create.tzapIntermediateHelp")}</p>
                </div>}
              </div>
              </section>
            ) : null}
          </div>
        </details>
      </details>
    </aside>
  );
}

function CertificatePicker({ title, value, icon, compact = false, onChoose, onClear }: { title: string; value: string; icon?: ReactNode; compact?: boolean; onChoose(): void; onClear(): void }) {
  const paths = value.split(";").map((path) => path.trim()).filter(Boolean);
  return <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-xl border border-black/10 bg-white/60 ${compact ? "p-2.5" : "p-3"} dark:border-white/10 dark:bg-black/10`}>
    <div className="col-span-full flex items-center gap-2 text-[11px] font-semibold leading-4">{icon}{title}</div>
    <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-1 overflow-hidden">{paths.length ? paths.map((path) => <span key={path} title={path} className="max-w-full truncate rounded-md bg-blue-500/10 px-2 py-1 text-[10px] text-blue-700 dark:text-blue-300">{getPathBasename(path)}</span>) : <span className="text-[11px] text-slate-500 dark:text-slate-400">{i18nFallbackNone()}</span>}</div>
    <div className="flex justify-end"><button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 py-1.5 !text-[11px] !font-medium hover:bg-black/5 dark:hover:bg-white/5" onClick={onChoose}><Plus className="size-3" />Choose</button>{paths.length ? <button type="button" aria-label={`Clear ${title}`} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5" onClick={onClear}><X className="size-3" /></button> : null}</div>
  </div>;
}

function i18nFallbackNone() { return "Not configured"; }

function includeAllState(snapshot: ReturnType<typeof useZManagerSnapshot>) {
  const rows = snapshot.create.view.rows.filter((row) => row.rowType !== "parent");
  const included = rows.filter((row) => inclusionStateForPath(snapshot, row.path) !== "excluded");
  return {
    checked: rows.length > 0 && included.length === rows.length,
    indeterminate: included.length > 0 && included.length < rows.length,
    disabled: rows.length === 0,
  };
}

function inclusionStateForPath(snapshot: ReturnType<typeof useZManagerSnapshot>, path: string): "included" | "excluded" | "partial" {
  if (snapshot.create.inclusion.excludedArchivePaths.includes(path)) {
    return "excluded";
  }
  return "included";
}
