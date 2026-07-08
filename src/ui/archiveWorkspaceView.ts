import type { BrowseState } from "../api/types";
import {
  archiveTableColumnLabel,
  formatArchiveTableValue,
  type ArchiveSortKey,
  type ArchiveTableColumn,
  type ArchiveTableRow,
} from "../app/archiveTable";
import { escapeHtml } from "../app/formatting";
import type { Translator } from "../app/i18n/translator";

export type ArchiveWorkspaceTableElements = {
  tableHead: HTMLTableSectionElement;
  tableBody: HTMLTableSectionElement;
  entryTable: HTMLTableElement;
  tableShellElement: HTMLElement;
  archiveEmptyStateElement: HTMLElement;
  searchCountElement: HTMLElement;
  findSelectAllInput?: () => HTMLInputElement;
};

export type ArchiveWorkspaceTableSelection = {
  selectedPaths: readonly string[];
  focusedPath?: string | null;
  visibleSelectablePaths: readonly string[];
  visibleSelectedCount: number;
};

export type ArchiveWorkspaceTableRenderOptions = {
  browseState: BrowseState;
  browseError: string;
  currentArchivePath?: string | null;
  rows: readonly ArchiveTableRow[];
  searchQuery: string;
  flatView: boolean;
  selection: ArchiveWorkspaceTableSelection;
  columns: readonly ArchiveTableColumn[];
  sortKey: ArchiveSortKey;
  sortAscending: boolean;
  translator: Translator;
  formatSearchCount: (count: number) => string;
  renderRowIcon: (row: ArchiveTableRow) => ArchiveWorkspaceRowIcon;
  nativeDragAttributes: string;
};

export type ArchiveWorkspaceTableRenderResult = {
  selectAllInput: HTMLInputElement;
};

export type ArchiveWorkspaceRowIcon = {
  html: string;
  label: string;
};

export type DetailValueMode = "wrap" | "middle";

export type DetailRow = {
  label: string;
  value?: string | null;
  mode?: DetailValueMode;
};

export type ArchiveDetailAction = {
  label: string;
  action: string;
  primary?: boolean;
  title?: string;
  ariaLabel?: string;
};

export type ArchiveDetailsModel =
  | {
      kind: "noArchive";
      title: string;
      message: string;
      openArchiveLabel: string;
    }
  | {
      kind: "hiddenSelection";
      title: string;
      description: string;
      actions: readonly ArchiveDetailAction[];
      rows: readonly DetailRow[];
    }
  | {
      kind: "archiveSummary";
      title: string;
      iconHtml: string;
      rows: readonly DetailRow[];
    }
  | {
      kind: "syntheticFolder";
      title: string;
      iconHtml: string;
      rows: readonly DetailRow[];
    }
  | {
      kind: "entry";
      title: string;
      iconHtml: string;
      actions: readonly ArchiveDetailAction[];
      rows: readonly DetailRow[];
    }
  | {
      kind: "multipleSelection";
      title: string;
      actions: readonly ArchiveDetailAction[];
      rows: readonly DetailRow[];
    };

export type ArchiveDetailsElements = {
  detailsElement: HTMLElement;
};

export type ArchiveDetailsRenderOptions = {
  model: ArchiveDetailsModel;
  copyLabel: string;
  copyIconHtml: string;
};

export type ArchiveWorkspaceTreeElements = {
  treeContentElement: HTMLElement;
};

export type ArchiveWorkspaceTreeFolder = {
  path: string;
  label: string;
  depth: number;
  canToggle: boolean;
  isExpanded: boolean;
  isActive: boolean;
  iconHtml: string;
};

export type ArchiveWorkspaceTreeRenderOptions =
  | {
      kind: "empty";
      message: string;
    }
  | {
      kind: "folders";
      folders: readonly ArchiveWorkspaceTreeFolder[];
      collapseLabel: string;
      expandLabel: string;
    };

type TreeRenderConfig = {
  buttonPathAttribute: "data-tree-path" | "data-compress-folder-path";
  toggleAttribute: "data-tree-toggle" | "data-compress-tree-toggle";
  togglePathAttribute: "data-tree-path" | "data-compress-folder-path";
};

const SELECTION_COLUMN_WIDTH = 28;
const TABLE_MIN_WIDTH = 720;

const ARCHIVE_TREE_CONFIG: TreeRenderConfig = {
  buttonPathAttribute: "data-tree-path",
  toggleAttribute: "data-tree-toggle",
  togglePathAttribute: "data-tree-path",
};

const CREATE_TREE_CONFIG: TreeRenderConfig = {
  buttonPathAttribute: "data-compress-folder-path",
  toggleAttribute: "data-compress-tree-toggle",
  togglePathAttribute: "data-compress-folder-path",
};

export function middleTruncateDetailValue(value: string, maxLength = 88): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.max(12, Math.ceil((maxLength - 3) * 0.52));
  const tailLength = Math.max(12, maxLength - headLength - 3);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

export function renderArchiveDetails(
  elements: ArchiveDetailsElements,
  options: ArchiveDetailsRenderOptions,
): void {
  elements.detailsElement.innerHTML = renderArchiveDetailsHtml(options.model, {
    copyIconHtml: options.copyIconHtml,
    copyLabel: options.copyLabel,
  });
}

export function renderArchiveNavigationTree(
  elements: ArchiveWorkspaceTreeElements,
  options: ArchiveWorkspaceTreeRenderOptions,
): void {
  elements.treeContentElement.innerHTML = renderArchiveWorkspaceTreeHtml(options, ARCHIVE_TREE_CONFIG);
}

export function renderCreateNavigationTree(
  elements: ArchiveWorkspaceTreeElements,
  options: ArchiveWorkspaceTreeRenderOptions,
): void {
  elements.treeContentElement.innerHTML = renderArchiveWorkspaceTreeHtml(options, CREATE_TREE_CONFIG);
}

function renderArchiveWorkspaceTreeHtml(
  options: ArchiveWorkspaceTreeRenderOptions,
  config: TreeRenderConfig = ARCHIVE_TREE_CONFIG,
): string {
  if (options.kind === "empty") {
    return `
      <div class="empty-pane">
        <p>${escapeHtml(options.message)}</p>
      </div>
    `;
  }

  return options.folders.map((folder) => renderTreeFolder(folder, options, config)).join("");
}

export function renderArchiveDetailsHtml(
  model: ArchiveDetailsModel,
  helpers: { copyLabel: string; copyIconHtml: string },
): string {
  switch (model.kind) {
    case "noArchive":
      return `
        <div class="details-empty">
          <h3>${escapeHtml(model.title)}</h3>
          <p>${escapeHtml(model.message)}</p>
          <button class="primary-action" type="button" data-details-action="open-archive">${escapeHtml(model.openArchiveLabel)}</button>
        </div>
      `;

    case "hiddenSelection":
      return `
        <div class="detail-block">
          <h3>${escapeHtml(model.title)}</h3>
          <p>${escapeHtml(model.description)}</p>
          ${renderDetailActions(model.actions)}
          <dl class="detail-list">
            ${renderDetailRows(model.rows, helpers)}
          </dl>
        </div>
      `;

    case "archiveSummary":
      return `
        <div class="detail-block archive-detail-block">
          <h3 class="detail-title">
            ${model.iconHtml}
            <span>${escapeHtml(model.title)}</span>
          </h3>
          <dl class="detail-list">
            ${renderDetailRows(model.rows, helpers)}
          </dl>
        </div>
      `;

    case "syntheticFolder":
    case "entry":
      return `
        <div class="detail-block">
          <h3 class="detail-title">
            ${model.iconHtml}
            <span>${escapeHtml(model.title)}</span>
          </h3>
          ${model.kind === "entry" ? renderDetailActions(model.actions) : ""}
          <dl class="detail-list">
            ${renderDetailRows(model.rows, helpers)}
          </dl>
        </div>
      `;

    case "multipleSelection":
      return `
        <div class="detail-block">
          <h3>${escapeHtml(model.title)}</h3>
          ${renderDetailActions(model.actions)}
          <dl class="detail-list">
            ${renderDetailRows(model.rows, helpers)}
          </dl>
        </div>
      `;
  }
}

export function renderDetailRows(
  rows: readonly DetailRow[],
  helpers: { copyLabel: string; copyIconHtml: string },
): string {
  return rows
    .map((row) => renderDetailDefinition(row.label, row.value, helpers, row.mode))
    .filter(Boolean)
    .join("");
}

function detailValueMode(value: string): DetailValueMode {
  return /[\\/]/.test(value) && value.length > 48 ? "middle" : "wrap";
}

function renderDetailDefinition(
  label: string,
  value: string | null | undefined,
  helpers: { copyLabel: string; copyIconHtml: string },
  mode?: DetailValueMode,
): string {
  if (!value) {
    return "";
  }

  const valueMode = mode ?? detailValueMode(value);
  const displayValue = valueMode === "middle" ? middleTruncateDetailValue(value) : value;
  const visibleValue = valueMode === "middle"
    ? `<span class="detail-value detail-value-${valueMode}" aria-hidden="true">${escapeHtml(displayValue)}</span><span class="sr-only">${escapeHtml(value)}</span>`
    : `<span class="detail-value detail-value-${valueMode}">${escapeHtml(displayValue)}</span>`;
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd class="detail-copyable" title="${escapeHtml(value)}" aria-label="${escapeHtml(`${label}: ${value}`)}">
        ${visibleValue}
        <button class="detail-copy-button" type="button" data-copy-value="${escapeHtml(value)}" aria-label="${escapeHtml(`${helpers.copyLabel} ${label}`)}" title="${escapeHtml(helpers.copyLabel)}">
          ${helpers.copyIconHtml}
        </button>
      </dd>
    </div>
  `;
}

function renderTreeFolder(
  folder: ArchiveWorkspaceTreeFolder,
  options: Extract<ArchiveWorkspaceTreeRenderOptions, { kind: "folders" }>,
  config: TreeRenderConfig,
): string {
  const disclosure = folder.canToggle
    ? `<span class="tree-disclosure" ${config.toggleAttribute} ${config.togglePathAttribute}="${escapeHtml(folder.path)}" aria-label="${escapeHtml(`${folder.isExpanded ? options.collapseLabel : options.expandLabel} ${folder.label}`)}" aria-hidden="true">${folder.isExpanded ? "-" : "+"}</span>`
    : `<span class="tree-disclosure tree-disclosure-placeholder" aria-hidden="true"></span>`;

  return `
    <button
      class="tree-item ${folder.isActive ? "is-active" : ""}"
      type="button"
      ${config.buttonPathAttribute}="${escapeHtml(folder.path)}"
      style="--depth: ${folder.depth}"
    >
      ${disclosure}
      ${folder.iconHtml}
      <span class="tree-label">${escapeHtml(folder.label)}</span>
    </button>
  `;
}

function renderDetailActions(actions: readonly ArchiveDetailAction[]): string {
  if (!actions.length) {
    return "";
  }

  return `
    <div class="detail-actions">
      ${actions.map(renderDetailActionButton).join("")}
    </div>
  `;
}

function renderDetailActionButton(action: ArchiveDetailAction): string {
  const classAttribute = action.primary ? ` class="primary-action"` : "";
  const titleAttribute = action.title
    ? ` title="${escapeHtml(action.title)}" aria-label="${escapeHtml(action.ariaLabel ?? `${action.label}: ${action.title}`)}"`
    : "";
  return `<button type="button"${classAttribute} data-details-action="${escapeHtml(action.action)}"${titleAttribute}>${escapeHtml(action.label)}</button>`;
}

export function tableColspan(columns: readonly ArchiveTableColumn[]): number {
  return columns.length + 1;
}

export function tableMinimumWidth(columns: readonly ArchiveTableColumn[]): number {
  const columnWidth = columns.reduce((total, column) => total + column.width, 0);
  return Math.max(TABLE_MIN_WIDTH, SELECTION_COLUMN_WIDTH + columnWidth);
}

export function renderArchiveWorkspaceTable(
  elements: ArchiveWorkspaceTableElements,
  options: ArchiveWorkspaceTableRenderOptions,
): ArchiveWorkspaceTableRenderResult {
  const selectAllInput = renderTableHeader(elements, options);
  setArchiveEmptyStateVisible(elements, false);
  elements.searchCountElement.textContent = "";

  if (options.browseState === "loading") {
    renderEmptyRow(elements, options.columns, options.translator.t("browse.statusLoading"));
    resetSelectAll(selectAllInput);
    return { selectAllInput };
  }

  if (options.browseState === "error") {
    renderEmptyRow(
      elements,
      options.columns,
      options.browseError || options.translator.t("browse.statusUnknown"),
    );
    resetSelectAll(selectAllInput);
    return { selectAllInput };
  }

  if (!options.currentArchivePath) {
    elements.tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="${tableColspan(options.columns)}" class="empty">${escapeHtml(options.translator.t("browse.statusEmpty"))}</td>
      </tr>
    `;
    setArchiveEmptyStateVisible(elements, true);
    resetSelectAll(selectAllInput);
    return { selectAllInput };
  }

  const query = options.searchQuery.trim();
  const resultCount = options.selection.visibleSelectablePaths.length;
  elements.searchCountElement.textContent = options.formatSearchCount(resultCount);

  if (!options.rows.length) {
    const emptyMessage = query
      ? options.translator.t("browse.noEntriesMatchSearch", { query })
      : options.translator.t("browse.folderEmpty");
    elements.tableBody.innerHTML = `
      <tr class="${query ? "search-empty-row" : ""}">
        <td colspan="${tableColspan(options.columns)}" class="empty">${escapeHtml(emptyMessage)}</td>
      </tr>
    `;
    resetSelectAll(selectAllInput);
    return { selectAllInput };
  }

  const selectedPaths = new Set(options.selection.selectedPaths);
  selectAllInput.checked = options.selection.visibleSelectablePaths.length > 0
    && options.selection.visibleSelectedCount === options.selection.visibleSelectablePaths.length;
  selectAllInput.indeterminate = options.selection.visibleSelectedCount > 0
    && options.selection.visibleSelectedCount < options.selection.visibleSelectablePaths.length;

  const showFullPath = Boolean(query) || options.flatView;
  elements.tableBody.innerHTML = options.rows
    .map((row) => renderBrowseRow(row, {
      columns: options.columns,
      nativeDragAttributes: options.nativeDragAttributes,
      renderRowIcon: options.renderRowIcon,
      selected: selectedPaths.has(row.path),
      focused: options.selection.focusedPath === row.path,
      showFullPath,
      translator: options.translator,
    }))
    .join("");

  return { selectAllInput };
}

function renderTableHeader(
  elements: ArchiveWorkspaceTableElements,
  options: ArchiveWorkspaceTableRenderOptions,
): HTMLInputElement {
  elements.entryTable.style.minWidth = `${tableMinimumWidth(options.columns)}px`;
  elements.tableHead.innerHTML = `
    <tr>
      <th class="selection-column">
        <input id="select-all" type="checkbox" aria-label="${escapeHtml(options.translator.t("table.selectVisibleEntries"))}" ${options.browseState === "loaded" ? "" : "disabled"} />
      </th>
      ${options.columns.map((column) => renderTableHeaderCell(column, options)).join("")}
    </tr>
  `;
  return elements.findSelectAllInput?.()
    ?? elements.tableHead.querySelector<HTMLInputElement>("#select-all")!;
}

function renderTableHeaderCell(
  column: ArchiveTableColumn,
  options: ArchiveWorkspaceTableRenderOptions,
): string {
  const label = archiveTableColumnLabel(column, options.translator);
  return `
    <th
      data-column-id="${column.id}"
      data-sort-key="${column.id}"
      class="${column.align !== "left" ? `align-${column.align}` : ""}"
      style="width: ${column.width}px; min-width: ${column.minWidth ?? 64}px"
      aria-sort="${options.sortKey === column.id ? (options.sortAscending ? "ascending" : "descending") : "none"}"
      aria-keyshortcuts="Enter Space ContextMenu Shift+F10"
      tabindex="0"
      title="${escapeHtml(label)}"
    >
      <span class="column-header-label">${escapeHtml(label)}</span>
      ${options.sortKey === column.id ? `<span class="sort-indicator" aria-hidden="true">${options.sortAscending ? "^" : "v"}</span>` : ""}
      <span class="column-resizer" data-column-resizer="${column.id}" aria-hidden="true"></span>
    </th>
  `;
}

function setArchiveEmptyStateVisible(
  elements: ArchiveWorkspaceTableElements,
  visible: boolean,
): void {
  elements.archiveEmptyStateElement.hidden = !visible;
  elements.entryTable.hidden = false;
  elements.tableShellElement.classList.toggle("has-start-empty", visible);
}

function renderNameCell(
  row: ArchiveTableRow,
  showFullPath: boolean,
  renderRowIcon: (row: ArchiveTableRow) => ArchiveWorkspaceRowIcon,
): string {
  const secondaryPath = row.rowType === "entry" ? row.entry.path : row.path;
  const showSecondaryPath = showFullPath && (row.rowType === "entry" || row.rowType === "folder");
  const icon = renderRowIcon(row);
  return `
    <span class="row-primary">
      ${icon.html}
      <span class="sr-only">${escapeHtml(icon.label)}:</span>
      <span class="row-name">${escapeHtml(row.name)}</span>
    </span>
    ${showSecondaryPath ? `<span class="row-secondary">${escapeHtml(secondaryPath)}</span>` : ""}
  `;
}

function renderCell(
  row: ArchiveTableRow,
  column: ArchiveTableColumn,
  showFullPath: boolean,
  renderRowIcon: (row: ArchiveTableRow) => ArchiveWorkspaceRowIcon,
  translator: Translator,
): string {
  const className = [
    column.id === "name" ? "name-cell" : "",
    column.align !== "left" ? `align-${column.align}` : "",
  ].filter(Boolean).join(" ");

  if (column.id === "name") {
    return `<td class="${className}">${renderNameCell(row, showFullPath, renderRowIcon)}</td>`;
  }

  const entry = row.rowType === "entry" || row.rowType === "folder" ? row.entry : undefined;
  if (!entry) {
    return `<td class="${className}"></td>`;
  }

  return `<td class="${className}">${escapeHtml(formatArchiveTableValue(entry, column.id, translator))}</td>`;
}

type RenderBrowseRowOptions = {
  columns: readonly ArchiveTableColumn[];
  focused: boolean;
  nativeDragAttributes: string;
  renderRowIcon: (row: ArchiveTableRow) => ArchiveWorkspaceRowIcon;
  selected: boolean;
  showFullPath: boolean;
  translator: Translator;
};

function renderBrowseRow(row: ArchiveTableRow, options: RenderBrowseRowOptions): string {
  if (row.rowType === "parent") {
    return `
      <tr class="folder-row parent-row" data-folder-path="${escapeHtml(row.path)}" tabindex="0" aria-label="${escapeHtml(options.translator.t("browse.parentFolder.aria"))}" aria-keyshortcuts="Enter ContextMenu Shift+F10">
        <td class="selection-column"></td>
        ${options.columns.map((column) =>
          renderCell(row, column, options.showFullPath, options.renderRowIcon, options.translator)
        ).join("")}
      </tr>
    `;
  }

  if (row.rowType === "folder") {
    return `
      <tr
        class="folder-row ${options.selected ? "is-selected" : ""} ${options.focused ? "is-focused-row" : ""}"
        data-folder-path="${escapeHtml(row.path)}"
        data-entry-path="${escapeHtml(row.path)}"
        tabindex="0"
        ${options.nativeDragAttributes}
        aria-label="${escapeHtml(options.translator.t("browse.openFolder.aria", { name: row.name }))}"
        aria-selected="${options.selected ? "true" : "false"}"
        aria-keyshortcuts="Space Enter ContextMenu Shift+F10"
      >
        <td class="selection-column">
          <input
            data-entry-path="${escapeHtml(row.path)}"
            type="checkbox"
            aria-label="${escapeHtml(options.translator.t("browse.selectEntry.aria", { name: row.name }))}"
            ${options.selected ? "checked" : ""}
          />
        </td>
        ${options.columns.map((column) =>
          renderCell(row, column, options.showFullPath, options.renderRowIcon, options.translator)
        ).join("")}
      </tr>
    `;
  }

  return `
    <tr
      class="${options.selected ? "is-selected" : ""} ${options.focused ? "is-focused-row" : ""}"
      data-entry-path="${escapeHtml(row.path)}"
      tabindex="0"
      ${options.nativeDragAttributes}
      aria-selected="${options.selected ? "true" : "false"}"
      aria-keyshortcuts="Space Enter ContextMenu Shift+F10"
    >
      <td class="selection-column">
        <input
          data-entry-path="${escapeHtml(row.path)}"
          type="checkbox"
          aria-label="${escapeHtml(options.translator.t("browse.selectEntry.aria", { name: row.name }))}"
          ${options.selected ? "checked" : ""}
        />
      </td>
      ${options.columns.map((column) =>
        renderCell(row, column, options.showFullPath, options.renderRowIcon, options.translator)
      ).join("")}
    </tr>
  `;
}

function renderEmptyRow(
  elements: ArchiveWorkspaceTableElements,
  columns: readonly ArchiveTableColumn[],
  message: string,
): void {
  elements.tableBody.innerHTML = `
    <tr>
      <td colspan="${tableColspan(columns)}" class="empty">${escapeHtml(message)}</td>
    </tr>
  `;
}

function resetSelectAll(selectAllInput: HTMLInputElement): void {
  selectAllInput.checked = false;
  selectAllInput.indeterminate = false;
}
