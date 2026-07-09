import { File, Folder } from "lucide-react";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { formatBytes, getPathBasename } from "../../../app/formatting";
import { sourcePathForCreatePlanRow, type CreatePlanRow } from "../../../app/createFlow";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { PaneResizer } from "../interaction/PaneResizer";
import { translatorForSnapshot } from "../shell/shellHelpers";

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
const COMPACT_COMPRESS_OPTIONS_QUERY = "(max-width: 1100px), (max-height: 640px)";

type CompressSourceColumnId = typeof COMPRESS_SOURCE_COLUMN_IDS[number];

export function CreateWorkspace() {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  return (
    <>
      <CreatePathBar />
      <section className="browser-shell" aria-label="Create archive workspace">
        <CreatePanel password={password} passwordConfirm={passwordConfirm} />
        <CreateTree />
        <PaneResizer pane="navigation" controls="navigation-pane" label="Resize folder pane" />
        <CreateTable />
        <PaneResizer pane="details" controls="details-pane" label="Resize details pane" />
        <CreateOptions
          password={password}
          passwordConfirm={passwordConfirm}
          setPassword={setPassword}
          setPasswordConfirm={setPasswordConfirm}
        />
      </section>
    </>
  );
}

function CreatePathBar() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);

  return (
    <section className="path-bar" aria-label={i18n.t("workspace.archiveLocation.aria")}>
      <button id="nav-back" type="button" disabled>{i18n.t("navigation.back")}</button>
      <button id="nav-up" className="icon-button" type="button" disabled aria-label={i18n.t("commands.upOneLevel")}>^</button>
      <input id="path-field" className="path-field" type="text" aria-label={i18n.t("path.archivePath.aria")} value={i18n.t("compress.tableTitle")} readOnly disabled />
      <div id="path-crumbs" className="path-crumbs" aria-live="polite" hidden>{i18n.t("compress.tableTitle")}</div>
      <div className="search-box" role="search">
        <label className="search-field">
          <span className="sr-only">{i18n.t("search.entries")}</span>
          <input id="search-entries" type="search" placeholder={i18n.t("search.placeholder")} disabled />
        </label>
        <button id="search-submit" className="search-action" type="button" disabled>{i18n.t("search.button")}</button>
        <button id="clear-search" className="search-action quiet-action" type="button" disabled>{i18n.t("search.clear")}</button>
        <output id="search-count" className="search-count" htmlFor="search-entries" aria-live="polite" />
      </div>
    </section>
  );
}

function CreatePanel({
  password,
  passwordConfirm,
}: Readonly<{
  password: string;
  passwordConfirm: string;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const create = snapshot.create;
  const [destination, setDestination] = useState(create.options.destinationPath);

  useEffect(() => {
    setDestination(create.options.destinationPath);
  }, [create.options.destinationPath]);

  const includedCount = create.plan.current ? create.inclusion.includedCount : create.sourceCount;
  const statusText = create.options.readiness.unavailableReason
    ? createUnavailableText(create.options.readiness.unavailableReason, snapshot)
    : i18n.t("create.status.ready", {
      count: create.inclusion.filteredPlan?.includedCount ?? create.plan.current?.includedCount ?? 0,
      size: formatBytes(create.inclusion.filteredPlan?.totalBytes, { locale: snapshot.display.resolvedLocale }),
    });

  return (
    <div className="compress-create-panel" aria-label={i18n.t("compress.createArchive.aria")}>
      <div className="compress-create-row">
        <label className="compress-destination-field">
          <span>{i18n.t("compress.destination")}</span>
          <div className="inline-field">
            <input
              id="create-destination"
              type="text"
              list="create-destination-history"
              placeholder={i18n.t("compress.destination.placeholder")}
              value={destination}
              onChange={(event) => {
                setDestination(event.currentTarget.value);
                actions.handleCreateIntent({ type: "setDestinationPath", destinationPath: event.currentTarget.value });
              }}
            />
            <button id="browse-create-destination" type="button" onClick={() => actions.handleCreateIntent({ type: "browseDestination" })}>
              {i18n.t("common.browse")}
            </button>
            <select id="create-destination-recent" className="recent-location-select" aria-label={i18n.t("create.destination.recent.aria")} disabled={!snapshot.pathHistory.createDestinationHistory.length}>
              <option value="">{i18n.t("create.destination.recent")}</option>
            </select>
          </div>
          <datalist id="create-destination-history">
            {snapshot.pathHistory.createDestinationHistory.map((entry) => <option value={entry} key={entry} />)}
          </datalist>
        </label>
        <div className="compress-create-actions">
          <button
            id="add-source"
            className="secondary-action"
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              actions.handleCreateIntent({ type: "showAddSourcesMenu", x: rect.left, y: rect.bottom + 4 });
            }}
          >
            {i18n.t("compress.addSources")}
          </button>
          <button id="include-all-sources" className="quiet-action" type="button" hidden={create.isEmpty} disabled={create.isEmpty || create.inclusion.excludedArchivePaths.length === 0} onClick={() => actions.handleCreateIntent({ type: "setAllIncluded", included: true })}>{i18n.t("compress.includeAll")}</button>
          <button id="exclude-all-sources" className="quiet-action" type="button" hidden={create.isEmpty} disabled={create.isEmpty || create.inclusion.includedCount === 0} onClick={() => actions.handleCreateIntent({ type: "setAllIncluded", included: false })}>{i18n.t("compress.excludeAll")}</button>
          <button id="clear-sources" className="quiet-action" type="button" hidden={create.isEmpty} onClick={() => actions.handleCreateIntent({ type: "clearSources" })}>{i18n.t("command.clearAllSources")}</button>
          <span className="compress-action-divider" aria-hidden="true" />
          <button id="start-create" className={create.options.readiness.canCreate ? "primary-action" : "secondary-action"} type="button" disabled={!create.options.readiness.canCreate} onClick={() => actions.handleCreateIntent({ type: "runCreate", password, passwordConfirm })}>
            {i18n.t("compress.createArchive")}
          </button>
        </div>
      </div>
      <div className="compress-plan-row">
        <p id="create-plan-meta" className={create.options.readiness.unavailableReason && create.options.readiness.unavailableReason !== "needsSources" ? "status status-warning" : undefined}>
          {create.isEmpty ? i18n.t("compress.dropSourcesHint") : statusText}
        </p>
        <span className="sr-only">{i18n.t("compress.sourceStaged", { count: includedCount, sourceLabel: i18n.t(includedCount === 1 ? "compress.sourceSingular" : "compress.sourcePlural") })}</span>
      </div>
    </div>
  );
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
  const i18n = translatorForSnapshot(snapshot);
  const rows = snapshot.create.view.rows;
  const includeAll = includeAllState(snapshot);

  return (
    <section className="archive-table-pane" aria-label={i18n.t("workspace.archiveEntries.aria")}>
      <div className="table-pane-header">
        <div>
          <h1 id="workspace-title">{i18n.t("compress.tableTitle")}</h1>
          <p id="browse-meta">{i18n.t("compress.tableDescription")}</p>
        </div>
      </div>
      <p id="browse-message" className="status status-idle" hidden />
      <div id="compress-surface" className="compress-surface">
        <ul id="source-list" className="list-box" hidden>
          {snapshot.create.sources.map((source) => <li data-source-path={source} key={source}>{source}</li>)}
        </ul>
        <div className="compress-table-shell">
          <table id="compress-source-table">
            {rows.length ? (
              <thead>
                <tr>
                  <th className="inclusion-column">
                    <span className="column-header-label" aria-hidden="true" />
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
            <tbody id="compress-source-body">
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
  const data = row.rowType === "entry" ? row.entry : undefined;
  const path = row.path;
  const selectable = row.rowType !== "parent";
  const selected = selectable && snapshot.createSelection.selectedPaths.includes(path);
  const focused = selectable && snapshot.createSelection.focusedPath === path;
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
      <td className="name-cell"><span className="row-primary"><span className={`row-icon row-icon-${isFolder ? "folder" : "file"}`} aria-hidden="true">{isFolder ? <Folder className="row-icon-svg" /> : <File className="row-icon-svg" />}</span><span className="row-name">{row.name}</span>{selectable ? <span className={`source-stage-badge ${inclusion === "excluded" ? "is-excluded" : ""}`}>{compressInclusionText(inclusion, snapshot)}</span> : null}</span></td>
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

function CreateOptions({
  password,
  passwordConfirm,
  setPassword,
  setPasswordConfirm,
}: Readonly<{
  password: string;
  passwordConfirm: string;
  setPassword(value: string): void;
  setPasswordConfirm(value: string): void;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const options = snapshot.create.options;
  const [showPassword, setShowPassword] = useState(false);
  const compactOptions = useCompactCompressOptions();
  const [manualPanelOpen, setManualPanelOpen] = useState<boolean | null>(null);
  const panelOpen = manualPanelOpen ?? !compactOptions;

  useEffect(() => {
    setManualPanelOpen(null);
  }, [compactOptions]);

  return (
    <aside id="details-pane" className="details-pane" aria-label={i18n.t("workspace.details.aria")}>
      <div className="pane-header"><h2 id="details-pane-title">{i18n.t("compress.options")}</h2></div>
      <div id="details-content" className="details-content" hidden />
      <details
        id="compress-options-panel"
        className="compress-options-panel"
        open={panelOpen}
        onToggle={(event) => setManualPanelOpen(event.currentTarget.open)}
      >
        <summary className="compress-options-summary"><span className="compress-options-summary-title">{i18n.t("create.options.title")}</span></summary>
        <div className="compress-options-intro"><h3>{i18n.t("create.options.title")}</h3><p>{i18n.t("create.options.description")}</p></div>
        <div id="create-plan-summary" className="summary-card">
          {snapshot.create.inclusion.filteredPlan ? (
            <p>{i18n.t("create.status.ready", { count: snapshot.create.inclusion.filteredPlan.includedCount, size: formatBytes(snapshot.create.inclusion.filteredPlan.totalBytes, { locale: snapshot.display.resolvedLocale }) })}</p>
          ) : <p>{i18n.t("create.plan.empty")}</p>}
        </div>
        <div className="form-grid create-options-grid">
          <label><span>{i18n.t("create.archiveFormat")}</span><select id="create-format" value={options.format} onChange={(event) => actions.handleCreateIntent({ type: "changeFormat", format: event.currentTarget.value as typeof options.format })}><option value="zip">ZIP</option><option value="tarZst">TZST</option><option value="tzap">TZAP</option><option value="sevenZ">7Z</option></select></label>
          <label><span>{i18n.t("create.compressionLevel")}</span><select id="create-compression-level" value={options.compressionLevel ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { compressionLevel: event.currentTarget.value } })}><option value="">{i18n.t("preferences.archiveDefaults.backendDefault")}</option><option value="0">0</option><option value="5">5</option><option value="9">9</option></select></label>
          <label><span>{i18n.t("create.splitVolumes")}</span><input id="create-volume" type="text" value={options.volumeSize ?? ""} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { volumeSize: event.currentTarget.value } })} /></label>
          <label id="create-tzap-recovery-field" hidden={!options.tzapRecovery.visible}><span>{i18n.t("create.tzapRecovery")}</span><input id="create-tzap-recovery" type="number" value={options.tzapRecoveryPercentage} disabled={options.tzapRecovery.disabled} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { tzapRecoveryPercentage: event.currentTarget.value } })} /></label>
          <label className="checkbox-row"><input id="create-clean-source" type="checkbox" checked={options.cleanSource} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { cleanSource: event.currentTarget.checked } })} /><span>{i18n.t("create.cleanSource")}</span></label>
          <label className="checkbox-row"><input id="create-preserve-metadata" type="checkbox" checked={options.preserveMetadata} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { preserveMetadata: event.currentTarget.checked } })} /><span>{i18n.t("create.preserveMetadata")}</span></label>
          <label className="checkbox-row"><input id="create-replace-existing" type="checkbox" checked={options.replaceExisting} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { replaceExisting: event.currentTarget.checked } })} /><span>{i18n.t("create.replaceExisting")}</span></label>
          <label className="checkbox-row"><input id="create-respect-gitignore" type="checkbox" checked={options.respectGitignore} onChange={(event) => actions.handleCreateIntent({ type: "setOptions", patch: { respectGitignore: event.currentTarget.checked } })} /><span>{i18n.t("create.respectGitignore")}</span></label>
        </div>
        <details className="advanced-options">
          <summary>{i18n.t("extract.advancedOptions")}</summary>
          <div id="create-password-options" className="form-grid form-grid-compact" hidden={!options.password.visible}>
            <label><span>{i18n.t("extract.password")}</span><input id="create-password" type={showPassword ? "text" : "password"} value={password} disabled={options.password.disabled} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
            <label><span>{i18n.t("create.reenterPassword")}</span><input id="create-password-confirm" type={showPassword ? "text" : "password"} value={passwordConfirm} disabled={options.password.disabled} onChange={(event) => setPasswordConfirm(event.currentTarget.value)} /></label>
            <label className="checkbox-row"><input id="create-show-password" type="checkbox" checked={showPassword} disabled={options.password.disabled} onChange={(event) => setShowPassword(event.currentTarget.checked)} /><span>{i18n.t("extract.showPassword")}</span></label>
          </div>
        </details>
      </details>
    </aside>
  );
}

function useCompactCompressOptions(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_COMPRESS_OPTIONS_QUERY);
    const sync = () => setCompact(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return compact;
}

function createUnavailableText(reason: string, snapshot: ReturnType<typeof useZManagerSnapshot>): string {
  const i18n = translatorForSnapshot(snapshot);
  switch (reason) {
    case "needsSources": return i18n.t("create.status.needsSources");
    case "needsIncludedEntries": return i18n.t("create.status.needsIncludedEntries");
    case "needsDestination": return i18n.t("create.status.needsDestination");
    case "planning": return i18n.t("create.status.planning");
    case "starting": return i18n.t("create.status.starting");
    default: return snapshot.create.plan.status?.fallbackText ?? i18n.t("create.status.needsPlan");
  }
}

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
