import { Archive, File, Folder, Search } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { archiveRowIconDescriptor } from "../../../app/archiveEntryIcons";
import {
  archiveTableColumnLabel,
  formatArchiveTableValue,
  normalizeColumnSettings,
  visibleColumns,
  type ArchiveTableColumn,
  type ArchiveTableColumnId,
  type ArchiveTableRow,
} from "../../../app/archiveTable";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactActions, ZManagerReactSnapshot } from "../appRuntime";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { armTableMarqueeSelectionGesture, type ViewportRect } from "../workspace/tableMarqueeSelection";
import { nativeIconDataUrlForRow } from "./archiveNativeIcons";

const NATIVE_DRAG_THRESHOLD_PX = 6;

export function ArchiveTable() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<ViewportRect | null>(null);
  const i18n = translatorForSnapshot(snapshot);
  const archive = snapshot.archive;
  const openCommandState = snapshot.commands.states.open;
  const columns = visibleColumns(normalizeColumnSettings({
    visibleColumnIds: snapshot.preferences.tableVisibleColumnIds,
    columnOrderIds: snapshot.preferences.tableColumnOrderIds,
    columnWidths: snapshot.preferences.tableColumnWidths,
  }));
  const showStartEmpty = !archive.currentArchivePath;
  const rows = archive.view.rows;

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
          <h1 id="workspace-title">{i18n.t("extract.tableTitle")}</h1>
          <p id="browse-meta">{archiveMetaText(snapshot.archive, i18n.t("browse.statusReady"))}</p>
        </div>
        <button
          id="refresh-archive"
          className="quiet-action"
          type="button"
          data-command-id="refresh"
          disabled={!snapshot.commands.states.refresh.enabled}
          onClick={() => actions.executeCommand("refresh")}
        >
          {i18n.t("common.refresh")}
        </button>
      </div>
      <p id="browse-message" className={`status status-${archive.browseState}`}>
        {archive.status.fallbackText ?? i18n.t(archive.status.key, archive.status.values)}
      </p>
      <div
        ref={tableShellRef}
        className={`table-shell ${showStartEmpty ? "has-start-empty" : ""}`}
        tabIndex={0}
        onPointerDownCapture={(event) => {
          armMarqueeSelectionGesture({
            event,
            snapshot,
            actions,
            tableBody: tableBodyRef.current,
            setMarqueeRect,
          });
        }}
      >
        <div id="marquee-hit-surface" className="marquee-hit-surface" aria-hidden="true" />
        {marqueeRect ? <div className="marquee-selection" style={marqueeRect} /> : null}
        <div
          id="archive-empty-state"
          className="archive-empty-state"
          hidden={!showStartEmpty}
          onContextMenu={(event) => {
            event.preventDefault();
            actions.handleArchiveIntent({ type: "showEmptyContextMenu", x: event.clientX, y: event.clientY });
          }}
        >
          <div className="archive-empty-state-inner">
            <span className="archive-empty-state-icon" aria-hidden="true"><Archive /></span>
            <div className="archive-empty-copy">
              <h2>{i18n.t("browse.emptyTitle")}</h2>
              <p>{i18n.t("browse.emptyDescription")}</p>
            </div>
            <button
              className="primary-action"
              type="button"
              data-empty-action="open-archive"
              disabled={!openCommandState.enabled}
              title={openCommandState.enabled ? undefined : openCommandState.reason}
              onClick={() => actions.executeCommand("open")}
            >
              {i18n.t("browse.emptyOpenAction")}
            </button>
            <p className="archive-empty-hint">{i18n.t("browse.emptyDropHint")}</p>
          </div>
        </div>
        <table id="entry-table" className={archiveTableClassName(snapshot)}>
          <thead id="entry-table-head">
            <tr>
              <th className="selection-column">
                <SelectAllCheckbox
                  disabled={archive.browseState !== "loaded"}
                  checked={archive.view.selection.visibleSelectablePaths.length > 0
                    && archive.view.selection.visibleSelectedCount === archive.view.selection.visibleSelectablePaths.length}
                  indeterminate={archive.view.selection.visibleSelectedCount > 0
                    && archive.view.selection.visibleSelectedCount < archive.view.selection.visibleSelectablePaths.length}
                />
              </th>
              {columns.map((column) => (
                <HeaderCell
                  column={column}
                  activeSortKey={archive.view.sort.key}
                  sortAscending={archive.view.sort.ascending}
                  key={column.id}
                />
              ))}
            </tr>
          </thead>
          <tbody id="entry-table-body" ref={tableBodyRef}>
            {tableBodyRows(rows, archive.currentArchivePath, archive.browseState, columns, snapshot.archive.view.searchQuery, i18n.t("browse.statusEmpty")).map((row) =>
              typeof row === "string" ? (
                <tr className={archive.view.searchQuery ? "search-empty-row" : ""} key="empty">
                  <td colSpan={columns.length + 1} className="empty">{row}</td>
                </tr>
              ) : (
                <ArchiveTableRowView row={row} columns={columns} key={row.rowId} />
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectAllCheckbox({
  checked,
  disabled,
  indeterminate,
}: Readonly<{ checked: boolean; disabled: boolean; indeterminate: boolean }>) {
  const actions = useZManagerActions();
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      id="select-all"
      ref={ref}
      type="checkbox"
      aria-label={i18n.t("table.selectVisibleEntries")}
      disabled={disabled}
      checked={checked}
      onChange={(event) => actions.handleArchiveIntent({
        type: event.currentTarget.checked ? "selectAllVisible" : "clearSelection",
      })}
    />
  );
}

function HeaderCell({
  column,
  activeSortKey,
  sortAscending,
}: Readonly<{
  column: ArchiveTableColumn;
  activeSortKey: ArchiveTableColumnId;
  sortAscending: boolean;
}>) {
  const actions = useZManagerActions();
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const active = activeSortKey === column.id;
  const label = archiveTableColumnLabel(column, i18n);

  return (
    <th
      data-column-id={column.id}
      data-sort-key={column.id}
      className={column.align !== "left" ? `align-${column.align}` : undefined}
      style={{ width: `${column.width}px`, minWidth: `${column.minWidth ?? 64}px` }}
      aria-sort={active ? (sortAscending ? "ascending" : "descending") : "none"}
      aria-keyshortcuts="Enter Space ContextMenu Shift+F10"
      tabIndex={0}
      title={label}
      onClick={() => actions.handleArchiveIntent({ type: "sortByColumn", columnId: column.id })}
      onContextMenu={(event) => {
        event.preventDefault();
        actions.handleArchiveIntent({
          type: "showColumnContextMenu",
          columnId: column.id,
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.handleArchiveIntent({ type: "sortByColumn", columnId: column.id });
          return;
        }
        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
          event.preventDefault();
          const point = contextMenuPointForElement(event.currentTarget);
          actions.handleArchiveIntent({
            type: "showColumnContextMenu",
            columnId: column.id,
            x: point.x,
            y: point.y,
          });
        }
      }}
    >
      <span className="column-header-label">{label}</span>
      {active ? <span className="sort-indicator" aria-hidden="true">{sortAscending ? "^" : "v"}</span> : null}
      <span
        className="column-resizer"
        data-column-resizer={column.id}
        aria-hidden="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => startArchiveColumnResize(event, column, actions)}
      />
    </th>
  );
}

function startArchiveColumnResize(
  event: ReactPointerEvent<HTMLElement>,
  column: ArchiveTableColumn,
  actions: ZManagerReactActions,
) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-column");

  const startX = event.clientX;
  const startWidth = column.width;
  let latestWidth = startWidth;

  const onPointerMove = (moveEvent: PointerEvent) => {
    latestWidth = startWidth + moveEvent.clientX - startX;
    actions.handleArchiveIntent({
      type: "setColumnWidth",
      columnId: column.id,
      width: latestWidth,
      persist: false,
    });
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-column");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    actions.handleArchiveIntent({
      type: "setColumnWidth",
      columnId: column.id,
      width: latestWidth,
      persist: true,
    });
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
}

function ArchiveTableRowView({
  row,
  columns,
}: Readonly<{ row: ArchiveTableRow; columns: readonly ArchiveTableColumn[] }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const selection = snapshot.archive.view.selection;
  const selected = selection.selectedPaths.includes(row.path);
  const focused = selection.focusedPath === row.path;
  const selectable = row.rowType !== "parent";
  const isFolder = row.rowType === "folder" || row.rowType === "parent";
  const rowKind = row.rowType === "parent" ? "parent" : row.rowType === "folder" ? "folder" : "entry";
  const className = [
    isFolder ? "folder-row" : "",
    row.rowType === "parent" ? "parent-row" : "",
    selected ? "is-selected" : "",
    focused ? "is-focused-row" : "",
  ].filter(Boolean).join(" ");

  return (
    <tr
      className={className}
      data-folder-path={isFolder ? row.path : undefined}
      data-entry-path={selectable ? row.path : undefined}
      tabIndex={0}
      draggable={selectable}
      data-native-drag={selectable ? "entry" : undefined}
      aria-selected={selectable ? selected : undefined}
      aria-keyshortcuts="Space Enter ContextMenu Shift+F10"
      onClick={(event) => {
        if (!selectable) {
          return;
        }
        actions.handleArchiveIntent({
          type: "selectRow",
          path: row.path,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        });
      }}
      onDoubleClick={() => actions.handleArchiveIntent({ type: "activateRow", path: row.path, rowKind })}
      onPointerDown={(event) => {
        if (selectable) {
          armNativeDragGesture(event, row.path, actions);
        }
      }}
      onDragStart={(event) => {
        if (selectable) {
          event.preventDefault();
        }
      }}
      onContextMenu={(event) => {
        if (!selectable) {
          return;
        }
        event.preventDefault();
        actions.handleArchiveIntent({
          type: "showRowContextMenu",
          path: row.path,
          rowKind,
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onKeyDown={(event) => {
        if (!selectable) {
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          actions.handleArchiveIntent({ type: "activateRow", path: row.path, rowKind });
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          actions.handleArchiveIntent({
            type: "selectRow",
            path: row.path,
            ctrlKey: true,
          });
          return;
        }
        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
          event.preventDefault();
          const point = contextMenuPointForElement(event.currentTarget);
          actions.handleArchiveIntent({
            type: "showRowContextMenu",
            path: row.path,
            rowKind,
            x: point.x,
            y: point.y,
          });
        }
      }}
    >
      <td className="selection-column">
        {selectable ? (
          <input
            data-entry-path={row.path}
            type="checkbox"
            aria-label={i18n.t("browse.selectEntry.aria", { name: row.name })}
            checked={selected}
            onChange={(event) => actions.handleArchiveIntent({
              type: "setRowSelected",
              path: row.path,
              selected: event.currentTarget.checked,
            })}
          />
        ) : null}
      </td>
      {columns.map((column) => (
        <td className={cellClassName(column)} key={column.id}>
          {column.id === "name" ? <NameCell row={row} /> : cellValue(row, column, i18n)}
        </td>
      ))}
    </tr>
  );
}

function NameCell({ row }: Readonly<{ row: ArchiveTableRow }>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const Icon = row.rowType === "parent" ? Folder : row.rowType === "folder" ? Folder : File;
  const descriptor = archiveRowIconDescriptor(row, i18n);
  const iconDataUrl = nativeIconDataUrlForRow(snapshot, row);
  const showSecondaryPath = (snapshot.archive.view.flatView || Boolean(snapshot.archive.view.searchQuery.trim()))
    && (row.rowType === "entry" || row.rowType === "folder");
  const secondaryPath = row.rowType === "entry" ? row.entry.path : row.path;

  return (
    <>
      <span className="row-primary">
        <span
          className={`row-icon row-icon-${descriptor.kind}`}
          title={descriptor.label}
          aria-hidden="true"
          draggable={false}
        >
          {iconDataUrl ? (
            <img className="row-icon-native-image" src={iconDataUrl} alt="" draggable={false} />
          ) : (
            <Icon className="row-icon-svg" aria-hidden="true" />
          )}
        </span>
        <span className="sr-only">{descriptor.label}:</span>
        <span className="row-name">{row.name}</span>
        {row.rowType === "entry" && row.entry.encrypted ? <Search className="row-badge" aria-hidden="true" /> : null}
      </span>
      {showSecondaryPath ? <span className="row-secondary">{secondaryPath}</span> : null}
    </>
  );
}

function cellClassName(column: ArchiveTableColumn): string | undefined {
  return [
    column.id === "name" ? "name-cell" : "",
    column.align !== "left" ? `align-${column.align}` : "",
  ].filter(Boolean).join(" ") || undefined;
}

function cellValue(row: ArchiveTableRow, column: ArchiveTableColumn, i18n: ReturnType<typeof translatorForSnapshot>): string {
  if (row.rowType === "parent" || !row.entry) {
    return "";
  }
  return formatArchiveTableValue(row.entry, column.id, i18n);
}

function tableBodyRows(
  rows: readonly ArchiveTableRow[],
  archivePath: string,
  browseState: string,
  _columns: readonly ArchiveTableColumn[],
  searchQuery: string,
  emptyLabel: string,
): readonly ArchiveTableRow[] | readonly [string] {
  if (browseState === "loading") {
    return ["Loading archive entries..."];
  }
  if (!archivePath) {
    return [emptyLabel];
  }
  if (!rows.length) {
    return [searchQuery.trim() ? `No entries match "${searchQuery.trim()}".` : "This folder has no visible entries."];
  }
  return rows;
}

function archiveMetaText(archive: ReturnType<typeof useZManagerSnapshot>["archive"], emptyText: string): string {
  if (!archive.currentArchivePath) {
    return emptyText;
  }
  const folderLabel = archive.view.currentFolder ? ` > ${archive.view.currentFolder}` : "";
  return `${getPathBasename(archive.currentArchivePath, "ZManager")}${folderLabel} - ${archive.view.rows.length} entries`;
}

function archiveTableClassName(snapshot: ZManagerReactSnapshot): string {
  return [
    snapshot.preferences.showGridLines ? "show-grid" : "",
    snapshot.preferences.fullRowSelect ? "full-row-select" : "",
    snapshot.preferences.singleClickOpen ? "single-click-open" : "",
  ].filter(Boolean).join(" ");
}

function getPathBasename(path: string, fallback: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? fallback;
}

function contextMenuPointForElement(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + 24,
    y: rect.top + Math.min(rect.height - 2, 24),
  };
}

function armNativeDragGesture(
  event: ReactPointerEvent<HTMLTableRowElement>,
  entryPath: string,
  actions: ZManagerReactActions,
) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || !isNativeDragTarget(event.target)) {
    return;
  }

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;

  const onPointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId || started) {
      return;
    }

    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    if (Math.hypot(deltaX, deltaY) < NATIVE_DRAG_THRESHOLD_PX) {
      return;
    }

    started = true;
    moveEvent.preventDefault();
    document.addEventListener("click", suppressNativeDragClick, { capture: true, once: true });
    clearNativeDragListeners();
    actions.handleArchiveIntent({ type: "startNativeDrag", entryPath });
  };

  const onPointerEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) {
      clearNativeDragListeners();
    }
  };

  const clearNativeDragListeners = () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerEnd);
    document.removeEventListener("pointercancel", onPointerEnd);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerEnd);
  document.addEventListener("pointercancel", onPointerEnd);
}

function isNativeDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("button, a, input, select, textarea")) {
    return false;
  }

  return Boolean(target.closest(".row-primary"));
}

function suppressNativeDragClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function armMarqueeSelectionGesture(input: Readonly<{
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
    selectedPaths: snapshot.archive.view.selection.selectedPaths,
    visiblePaths: snapshot.archive.view.selection.visibleSelectablePaths,
    rowSelector: "tr[data-entry-path]",
    rowPath: (row) => row.dataset.entryPath,
    canStart: (candidate) => canStartMarqueeSelection(candidate, snapshot),
    setMarqueeRect,
    applySelection: (selection) => actions.handleArchiveIntent({
      type: "applySelection",
      selectedPaths: [...selection.selectedPaths],
      focusedPath: selection.focusedPath,
      anchorPath: selection.anchorPath,
    }),
  });
}

function canStartMarqueeSelection(
  event: ReactPointerEvent<HTMLElement>,
  snapshot: ZManagerReactSnapshot,
): boolean {
  if (
    event.button !== 0
    || !snapshot.archive.currentArchivePath
    || snapshot.archive.browseState !== "loaded"
  ) {
    return false;
  }

  if (!(event.target instanceof HTMLElement)) {
    return false;
  }

  if (event.target.closest("button, a, input, select, textarea, .column-resizer")) {
    return false;
  }

  return !event.target.closest(".row-primary, .row-secondary");
}
