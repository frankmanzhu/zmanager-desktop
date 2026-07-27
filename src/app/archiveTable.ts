import type { ArchiveEntryDto, ArchiveEntryKind } from "../api/types";
import type { MessageKey, Translator } from "./i18n/translator";
import {
  formatBytes,
  formatCompressionRatio,
  formatDate,
  getPathBasename,
  parseDateValue,
} from "./formatting";
import {
  buildHierarchicalRows,
  type HierarchicalTableRow,
} from "./hierarchicalTable";
import { getKnownArchiveSuffix } from "./archiveFileTypes";
import {
  moveGenericColumn,
  normalizeGenericColumnSettings,
  reorderGenericColumn,
  setGenericColumnWidth,
  tableColumnLabel,
  toggleGenericColumnVisibility,
  visibleGenericColumns,
} from "./tableColumns";

export type ArchiveTableColumnId =
  | "name"
  | "size"
  | "compressedSize"
  | "modified"
  | "mode"
  | "created"
  | "accessed"
  | "attributes"
  | "encrypted"
  | "method"
  | "crc"
  | "comment"
  | "kind"
  | "ratio"
  | "solid"
  | "linkTarget"
  | "metadataDiagnostics"
  | "uid"
  | "gid"
  | "owner"
  | "group";

export type ArchiveSortKey = ArchiveTableColumnId;

export type ArchiveTableColumn = {
  id: ArchiveTableColumnId;
  label: string;
  labelKey: MessageKey;
  width: number;
  minWidth?: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
  alwaysVisible?: boolean;
};

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

const EMPTY_VALUE = "";
const TABLE_DATE_FORMAT = {
  emptyValue: EMPTY_VALUE,
  dateStyle: "short",
  timeStyle: "short",
} as const;
const DEFAULT_MIN_COLUMN_WIDTH = 64;
const MAX_COLUMN_WIDTH = 520;

export const ARCHIVE_TABLE_COLUMNS: ArchiveTableColumn[] = [
  { id: "name", label: "Name", labelKey: "table.name", width: 190, minWidth: 140, align: "left", defaultVisible: true, alwaysVisible: true },
  { id: "size", label: "Size", labelKey: "table.size", width: 100, align: "right", defaultVisible: true },
  { id: "compressedSize", label: "Packed Size", labelKey: "table.packedSize", width: 110, align: "right", defaultVisible: true },
  { id: "modified", label: "Modified", labelKey: "table.modified", width: 150, align: "left", defaultVisible: true },
  { id: "mode", label: "Mode", labelKey: "detail.mode", width: 82, align: "right", defaultVisible: false },
  { id: "created", label: "Created", labelKey: "table.created", width: 140, align: "left", defaultVisible: false },
  { id: "accessed", label: "Accessed", labelKey: "table.accessed", width: 140, align: "left", defaultVisible: false },
  { id: "attributes", label: "Attributes", labelKey: "table.attributes", width: 90, align: "left", defaultVisible: false },
  { id: "encrypted", label: "Encrypted", labelKey: "table.encrypted", width: 80, align: "center", defaultVisible: false },
  { id: "method", label: "Method", labelKey: "table.method", width: 120, align: "left", defaultVisible: false },
  { id: "crc", label: "CRC", labelKey: "table.crc", width: 90, align: "right", defaultVisible: false },
  { id: "comment", label: "Comment", labelKey: "table.comment", width: 120, align: "left", defaultVisible: false },
  { id: "kind", label: "Type", labelKey: "table.type", width: 90, align: "left", defaultVisible: false },
  { id: "ratio", label: "Ratio", labelKey: "table.ratio", width: 70, align: "right", defaultVisible: false },
  { id: "solid", label: "Solid", labelKey: "table.solid", width: 60, align: "center", defaultVisible: false },
  { id: "linkTarget", label: "Link Target", labelKey: "table.linkTarget", width: 160, align: "left", defaultVisible: false },
  { id: "metadataDiagnostics", label: "Diagnostics", labelKey: "table.metadataDiagnostics", width: 100, align: "right", defaultVisible: false },
  { id: "uid", label: "UID", labelKey: "table.uid", width: 70, align: "right", defaultVisible: false },
  { id: "gid", label: "GID", labelKey: "table.gid", width: 70, align: "right", defaultVisible: false },
  { id: "owner", label: "Owner", labelKey: "table.owner", width: 100, align: "left", defaultVisible: false },
  { id: "group", label: "Group", labelKey: "table.group", width: 100, align: "left", defaultVisible: false },
];

export const ARCHIVE_COLUMNS_BY_FORMAT: Record<string, ArchiveTableColumnId[]> = {
  zip: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  jar: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  war: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  ipa: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  apk: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  xpi: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "comment", "kind", "ratio"],
  "7z": ["name", "size", "compressedSize", "modified", "mode", "crc", "created", "accessed", "solid", "attributes", "kind", "ratio"],
  tzap: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "solid", "kind", "ratio", "metadataDiagnostics", "linkTarget", "created", "accessed", "attributes", "uid", "gid", "owner", "group"],
  "tar.zst": ["name", "size", "compressedSize", "modified", "mode", "solid", "linkTarget", "uid", "gid", "owner", "group", "kind", "ratio"],
  tzst: ["name", "size", "compressedSize", "modified", "mode", "solid", "linkTarget", "uid", "gid", "owner", "group", "kind", "ratio"],
  "tar.gz": ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  tgz: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  "tar.bz2": ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  "tar.xz": ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  "tar.br": ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  tar: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "solid", "uid", "gid", "owner", "group", "kind", "ratio"],
  aar: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "created", "linkTarget", "attributes", "uid", "gid", "kind", "ratio"],
  aea: ["name", "size", "compressedSize", "modified", "mode", "encrypted", "method", "crc", "created", "linkTarget", "attributes", "uid", "gid", "kind", "ratio"],
  gz: ["name", "compressedSize", "kind"],
  bz2: ["name", "compressedSize", "kind"],
  xz: ["name", "compressedSize", "kind"],
  zst: ["name", "compressedSize", "kind"],
};

export const DEFAULT_ARCHIVE_TABLE_COLUMN_IDS = ARCHIVE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);
export const DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS = ARCHIVE_TABLE_COLUMNS.map((column) => column.id);

export const DEFAULT_AVAILABLE_COLUMN_IDS: ArchiveTableColumnId[] = [
  "name", "size", "compressedSize", "modified", "mode",
  "encrypted", "method", "crc", "comment", "kind", "ratio",
  "created", "accessed", "solid", "linkTarget", "attributes",
  "metadataDiagnostics", "uid", "gid", "owner", "group",
];

export function getAvailableColumnsForFormat(archivePath?: string): ArchiveTableColumnId[] {
  if (!archivePath) return DEFAULT_AVAILABLE_COLUMN_IDS;
  const suffix = getKnownArchiveSuffix(archivePath);
  if (!suffix) return DEFAULT_AVAILABLE_COLUMN_IDS;
  const key = suffix.toLowerCase();
  if (key in ARCHIVE_COLUMNS_BY_FORMAT) {
    return ARCHIVE_COLUMNS_BY_FORMAT[key];
  }
  for (const [fmtKey, columns] of Object.entries(ARCHIVE_COLUMNS_BY_FORMAT)) {
    if (key.endsWith(fmtKey)) return columns;
  }
  return DEFAULT_AVAILABLE_COLUMN_IDS;
}

export function normalizeColumnSettings(
  settings?: Partial<ArchiveTableColumnSettings> | null,
  archivePath?: string,
): ArchiveTableColumnSettings {
  const availableColumnIds = archivePath ? getAvailableColumnsForFormat(archivePath) : null;
  return normalizeGenericColumnSettings(
    ARCHIVE_TABLE_COLUMNS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
    settings,
    availableColumnIds,
  );
}

export type ResolveColumnPreferences = {
  tableColumnsByFormat: Record<string, ArchiveTableColumnSettings>;
  tableVisibleColumnIds: ArchiveTableColumnId[];
  tableColumnOrderIds: ArchiveTableColumnId[];
  tableColumnWidths: ArchiveTableColumnWidthMap;
};

export function resolvePreferredColumnSettings(
  prefs: ResolveColumnPreferences,
  archivePath?: string,
): ArchiveTableColumnSettings {
  const formatKey = archivePath
    ? (getKnownArchiveSuffix(archivePath) ?? "default")
    : "default";
  return normalizeColumnSettings(
    prefs.tableColumnsByFormat[formatKey] ?? {
      visibleColumnIds: prefs.tableVisibleColumnIds,
      columnOrderIds: prefs.tableColumnOrderIds,
      columnWidths: prefs.tableColumnWidths,
    },
    archivePath,
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
      return typeof entry.mode === "number" ? entry.mode.toString(8).padStart(4, "0") : EMPTY_VALUE;
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
  const leftTime = parseDateValue(left)?.getTime();
  const rightTime = parseDateValue(right)?.getTime();
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
  if (sortKey === "kind") {
    return entry.kind;
  }

  return formatArchiveTableValue(entry, sortKey);
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
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
