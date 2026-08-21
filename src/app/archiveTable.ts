import type { ArchiveEntryDto, ArchiveEntryKind } from "../api/types";
import type { MessageKey, Translator } from "./i18n/translator";
import {
  formatBytes,
  formatCompressionRatio,
  formatDate,
  formatUnixMode,
  getPathBasename,
  parseDateValue,
  parseEpochTimestamp,
} from "./formatting";
import {
  buildHierarchicalRows,
  type HierarchicalTableRow,
} from "./hierarchicalTable";
import {
  moveGenericColumn,
  normalizeGenericColumnSettings,
  reorderGenericColumn,
  setGenericColumnWidth,
  tableColumnLabel,
  toggleGenericColumnVisibility,
  visibleGenericColumns,
  type BaseTableColumn,
} from "./tableColumns";
import {
  CLEAN_INSTALL_VISIBLE_IDS,
  EXTRACT_APPLICABLE_IDS,
  getColumnDefinition,
  type ExtractTableColumnId,
  type TableColumnId,
} from "./tableColumnCatalogue";
import { getExtractLayout } from "./scenarioColumnLayout";

// -- Types (backward-compatible re-exports from the unified catalogue) ----------

export type ArchiveTableColumnId = ExtractTableColumnId;

export type ArchiveSortKey = ArchiveTableColumnId;

export type ArchiveTableColumn = BaseTableColumn<ArchiveTableColumnId>;

export type ArchiveTableRow = HierarchicalTableRow<ArchiveEntryDto>;

export type ArchiveTableColumnWidthMap = Partial<Record<ArchiveTableColumnId, number>>;

export type ArchiveTableColumnSettings = {
  visibleColumnIds: ArchiveTableColumnId[];
  columnOrderIds: ArchiveTableColumnId[];
  columnWidths: ArchiveTableColumnWidthMap;
};

export type BuildArchiveBrowserRowsOptions = {
  entries: readonly ArchiveEntryDto[];
  currentFolder?: string | null;
  searchQuery?: string | null;
  flatView?: boolean;
  showParentFolderItem?: boolean;
};

// -- English fallback labels (keyed by catalogue labelKey) ---------------------

const LABEL: Record<string, string> = {
  "table.name": "Name",
  "table.type": "Type",
  "table.size": "Size",
  "table.modified": "Modified",
  "table.created": "Created",
  "table.accessed": "Accessed",
  "table.attributes": "Attributes",
  "detail.mode": "Mode",
  "table.linkTarget": "Link Target",
  "table.uid": "UID",
  "table.gid": "GID",
  "table.owner": "Owner",
  "table.group": "Group",
  "table.packedSize": "Packed Size",
  "table.encrypted": "Encrypted",
  "table.method": "Method",
  "table.crc": "CRC",
  "table.comment": "Comment",
  "table.ratio": "Ratio",
  "table.solid": "Solid",
  "table.metadataDiagnostics": "Diagnostics",
};

// -- Column catalogue ---------------------------------------------------------
// Built from the unified catalogue + Extract-specific intrinsic widths.

function buildColumn(id: ExtractTableColumnId): ArchiveTableColumn {
  const def = getColumnDefinition(id as TableColumnId);
  const layout = getExtractLayout(id as TableColumnId);
  const labelKey = (def?.labelKey ?? "table.name") as MessageKey;
  return {
    id,
    label: LABEL[labelKey] ?? id,
    labelKey,
    width: layout.width,
    minWidth: layout.minWidth,
    align: def?.align ?? "left",
    defaultVisible: CLEAN_INSTALL_VISIBLE_IDS.includes(id as TableColumnId),
    alwaysVisible: def?.alwaysVisible,
  };
}

export const ARCHIVE_TABLE_COLUMNS: ArchiveTableColumn[] =
  EXTRACT_APPLICABLE_IDS.map(buildColumn);

const EMPTY_VALUE = "";
const TABLE_DATE_FORMAT = {
  emptyValue: EMPTY_VALUE,
  dateStyle: "short",
  timeStyle: "short",
} as const;
const DEFAULT_MIN_COLUMN_WIDTH = 64;
const MAX_COLUMN_WIDTH = 520;

export const DEFAULT_ARCHIVE_TABLE_COLUMN_IDS = ARCHIVE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);
export const DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS = ARCHIVE_TABLE_COLUMNS.map((column) => column.id);

export function normalizeColumnSettings(
  settings?: Partial<ArchiveTableColumnSettings> | null,
): ArchiveTableColumnSettings {
  return normalizeGenericColumnSettings(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    null,
  );
}

export function resetColumnSettings(): ArchiveTableColumnSettings {
  return normalizeColumnSettings({
    visibleColumnIds: DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    columnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    columnWidths: {},
  });
}

export function toggleColumnVisibility(
  settings: ArchiveTableColumnSettings,
  columnId: ArchiveTableColumnId,
): ArchiveTableColumnSettings {
  return toggleGenericColumnVisibility(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
  );
}

export function visibleColumns(settings: ArchiveTableColumnSettings): ArchiveTableColumn[] {
  return visibleGenericColumns(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
  );
}

export function setColumnWidth(
  settings: ArchiveTableColumnSettings,
  columnId: ArchiveTableColumnId,
  width: number,
): ArchiveTableColumnSettings {
  return setGenericColumnWidth(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
    width,
  );
}

export function moveColumn(
  settings: ArchiveTableColumnSettings,
  columnId: ArchiveTableColumnId,
  direction: "left" | "right",
): ArchiveTableColumnSettings {
  return moveGenericColumn(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
    direction,
  );
}

export function reorderColumn(
  settings: ArchiveTableColumnSettings,
  sourceColumnId: ArchiveTableColumnId,
  targetColumnId: ArchiveTableColumnId,
): ArchiveTableColumnSettings {
  return reorderGenericColumn(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    sourceColumnId,
    targetColumnId,
  );
}

function uniqueColumnIds(ids: ArchiveTableColumnId[]): ArchiveTableColumnId[] {
  return Array.from(new Set(ids));
}

function normalizeColumnWidths(
  widths: ArchiveTableColumnWidthMap | undefined,
  availableColumns: ReadonlyMap<ArchiveTableColumnId, ArchiveTableColumn>,
): ArchiveTableColumnWidthMap {
  const normalized: ArchiveTableColumnWidthMap = {};

  for (const [columnId, width] of Object.entries(widths ?? {}) as Array<[ArchiveTableColumnId, number]>) {
    const column = availableColumns.get(columnId);
    if (!column || !Number.isFinite(width)) {
      continue;
    }
    normalized[columnId] = clampColumnWidth(width, column);
  }

  return normalized;
}

function clampColumnWidth(width: number, column: ArchiveTableColumn): number {
  const minWidth = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(minWidth, Math.round(width)));
}

export function formatArchiveTableValue(
  entry: ArchiveEntryDto | undefined,
  columnId: ArchiveTableColumnId,
  i18n?: Translator,
): string {
  if (!entry) {
    return EMPTY_VALUE;
  }

  switch (columnId) {
    case "name":
      return getPathBasename(entry.path, entry.path);
    case "size":
      return formatBytes(entry.size, { emptyValue: EMPTY_VALUE, locale: i18n?.locale });
    case "compressedSize":
      return formatBytes(entry.compressedSize, { emptyValue: EMPTY_VALUE, locale: i18n?.locale });
    case "modified":
      return formatDate(entry.modified, { ...TABLE_DATE_FORMAT, locale: i18n?.locale });
    case "mode":
      return formatUnixMode(entry.mode, entry.kind);
    case "created":
      return formatDate(entry.created, { ...TABLE_DATE_FORMAT, locale: i18n?.locale });
    case "accessed":
      return formatDate(entry.accessed, { ...TABLE_DATE_FORMAT, locale: i18n?.locale });
    case "attributes":
      return entry.attributes ?? EMPTY_VALUE;
    case "encrypted":
      return entry.encrypted ? "+" : EMPTY_VALUE;
    case "method":
      return entry.method ?? EMPTY_VALUE;
    case "crc":
      return entry.crc?.toUpperCase() ?? EMPTY_VALUE;
    case "comment":
      return entry.comment ?? EMPTY_VALUE;
    case "kind":
      return formatKind(entry.kind, i18n);
    case "ratio":
      return formatCompressionRatio(entry.size, entry.compressedSize, {
        emptyValue: EMPTY_VALUE,
        fractionDigits: 0,
        locale: i18n?.locale,
      });
    case "solid":
      return entry.solid ? "+" : EMPTY_VALUE;
    case "linkTarget":
      return entry.linkTarget ?? EMPTY_VALUE;
    case "metadataDiagnostics":
      return entry.metadataDiagnostics && entry.metadataDiagnostics.length > 0
        ? String(entry.metadataDiagnostics.length)
        : EMPTY_VALUE;
    case "uid":
      return typeof entry.uid === "number" ? String(entry.uid) : EMPTY_VALUE;
    case "gid":
      return typeof entry.gid === "number" ? String(entry.gid) : EMPTY_VALUE;
    case "owner":
      return entry.owner ?? (typeof entry.uid === "number" ? String(entry.uid) : EMPTY_VALUE);
    case "group":
      return entry.group ?? (typeof entry.gid === "number" ? String(entry.gid) : EMPTY_VALUE);
  }
}

export function archiveTableColumnLabel(column: ArchiveTableColumn, i18n?: Translator): string {
  if (i18n) return tableColumnLabel(column, i18n);
  return column.label;
}

export function buildArchiveBrowserRows(options: BuildArchiveBrowserRowsOptions): ArchiveTableRow[] {
  const query = options.searchQuery?.trim().toLowerCase() ?? "";
  return buildHierarchicalRows({
    entries: options.entries,
    getPath: (entry) => entry.path,
    isFolderEntry: (entry) => entry.kind === "directory",
    currentFolder: options.currentFolder,
    mode: query ? "search" : options.flatView ? "flat" : "folder",
    searchQuery: options.searchQuery,
    showParentRow: options.showParentFolderItem,
    matchesSearch: (_entry, path, normalizedQuery) => path.toLowerCase().includes(normalizedQuery),
  });
}

export function compareOptionalNumbers(left?: number | null, right?: number | null): number {
  const leftKnown = typeof left === "number" && Number.isFinite(left);
  const rightKnown = typeof right === "number" && Number.isFinite(right);

  if (!leftKnown && !rightKnown) {
    return 0;
  }
  if (!leftKnown) {
    return 1;
  }
  if (!rightKnown) {
    return -1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareOptionalDates(left?: string | null, right?: string | null): number {
  const leftTime = parseEpochTimestamp(left);
  const rightTime = parseEpochTimestamp(right);
  const leftKnown = typeof leftTime === "number";
  const rightKnown = typeof rightTime === "number";

  if (!leftKnown && !rightKnown) {
    return 0;
  }
  if (!leftKnown) {
    return 1;
  }
  if (!rightKnown) {
    return -1;
  }
  return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
}

export function compareArchiveRows(
  left: ArchiveTableRow,
  right: ArchiveTableRow,
  sortKey: ArchiveSortKey,
  ascending: boolean,
): number {
  if (left.rowType === "parent" || right.rowType === "parent") {
    return left.rowType === right.rowType ? 0 : left.rowType === "parent" ? -1 : 1;
  }

  const direction = ascending ? 1 : -1;
  if (left.rowType !== right.rowType && sortKey === "name") {
    return left.rowType === "folder" ? -1 : 1;
  }

  if (sortKey === "name") {
    return direction * compareStrings(left.name, right.name);
  }

  if (left.rowType === "folder" || right.rowType === "folder") {
    return left.rowType === right.rowType
      ? direction * compareStrings(left.name, right.name)
      : left.rowType === "folder" ? -1 : 1;
  }

  const leftEntry = left.entry;
  const rightEntry = right.entry;
  let result = 0;

  switch (sortKey) {
    case "size":
    case "compressedSize":
    case "uid":
    case "gid":
      result = compareOptionalNumbers(leftEntry[sortKey], rightEntry[sortKey]);
      break;
    case "modified":
    case "created":
    case "accessed":
      result = compareOptionalDates(leftEntry[sortKey], rightEntry[sortKey]);
      break;
    case "ratio":
      result = compareOptionalNumbers(
        compressionRatio(leftEntry.size, leftEntry.compressedSize),
        compressionRatio(rightEntry.size, rightEntry.compressedSize),
      );
      break;
    default:
      result = compareStrings(
        archiveSortTextValue(leftEntry, sortKey),
        archiveSortTextValue(rightEntry, sortKey),
      );
      break;
  }

  return direction * (result || compareStrings(left.path, right.path));
}

function archiveSortTextValue(entry: ArchiveEntryDto, sortKey: ArchiveSortKey): string {
  switch (sortKey) {
    case "kind":
      return entry.kind;
    case "mode":
      return entry.mode != null ? entry.mode.toString(8) : "";
    case "encrypted":
      return entry.encrypted === true ? "yes" : entry.encrypted === false ? "no" : "";
    case "solid":
      return entry.solid === true ? "yes" : entry.solid === false ? "no" : "";
    case "crc":
      return entry.crc ?? "";
    case "method":
      return entry.method ?? "";
    case "comment":
      return entry.comment ?? "";
    case "linkTarget":
      return entry.linkTarget ?? "";
    case "attributes":
      return entry.attributes ?? "";
    case "owner":
      return entry.owner ?? "";
    case "group":
      return entry.group ?? "";
    case "metadataDiagnostics":
      return entry.metadataDiagnostics ? entry.metadataDiagnostics.join(", ") : "";
    default:
      return formatArchiveTableValue(entry, sortKey);
  }
}

export function sortArchiveRows(
  rows: ArchiveTableRow[],
  sortKey: ArchiveSortKey,
  ascending: boolean,
): ArchiveTableRow[] {
  return [...rows].sort((left, right) => compareArchiveRows(left, right, sortKey, ascending));
}

function compressionRatio(size?: number | null, compressedSize?: number | null): number | null {
  if (
    typeof size !== "number" ||
    typeof compressedSize !== "number" ||
    !Number.isFinite(size) ||
    !Number.isFinite(compressedSize) ||
    size < 0 ||
    compressedSize < 0 ||
    size === 0
  ) {
    return null;
  }
  return compressedSize / size;
}

const ARCHIVE_TABLE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareStrings(left: string, right: string): number {
  return ARCHIVE_TABLE_COLLATOR.compare(left, right);
}

function formatKind(kind: ArchiveEntryKind, i18n?: Translator): string {
  switch (kind) {
    case "directory":
      return i18n?.t("entryKind.directory") ?? "Folder";
    case "hardlink":
      return i18n?.t("entryKind.hardlink") ?? "Hard link";
    case "symlink":
      return i18n?.t("entryKind.symlink") ?? "Symbolic link";
    case "special":
      return i18n?.t("entryKind.special") ?? "Special";
    case "file":
      return i18n?.t("entryKind.file") ?? "File";
  }
}
