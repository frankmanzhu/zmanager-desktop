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
  | "block"
  | "comment"
  | "kind"
  | "ratio"
  | "solid"
  | "linkTarget"
  | "metadataDiagnostics";

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
  { id: "block", label: "Block", labelKey: "table.block", width: 70, align: "right", defaultVisible: false },
  { id: "comment", label: "Comment", labelKey: "table.comment", width: 120, align: "left", defaultVisible: false },
  { id: "kind", label: "Type", labelKey: "table.type", width: 90, align: "left", defaultVisible: false },
  { id: "ratio", label: "Ratio", labelKey: "table.ratio", width: 70, align: "right", defaultVisible: false },
  { id: "solid", label: "Solid", labelKey: "table.solid" as any, width: 60, align: "center", defaultVisible: false },
  { id: "linkTarget", label: "Link Target", labelKey: "table.linkTarget" as any, width: 160, align: "left", defaultVisible: false },
  { id: "metadataDiagnostics", label: "Diagnostics", labelKey: "table.metadataDiagnostics" as any, width: 100, align: "right", defaultVisible: false },
];

export const DEFAULT_ARCHIVE_TABLE_COLUMN_IDS = ARCHIVE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);
export const DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS = ARCHIVE_TABLE_COLUMNS.map((column) => column.id);

export function normalizeColumnSettings(
  settings?: Partial<ArchiveTableColumnSettings> | null,
): ArchiveTableColumnSettings {
  const availableColumns = new Map(ARCHIVE_TABLE_COLUMNS.map((column) => [column.id, column]));
  const available = new Set(availableColumns.keys());
  const incoming = settings?.visibleColumnIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS;
  const visibleColumnIds = incoming.filter((id) => available.has(id));
  const incomingOrder = settings?.columnOrderIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS;
  const orderedIds = uniqueColumnIds(incomingOrder.filter((id) => available.has(id)));
  const missingOrderedIds = DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS.filter((id) => !orderedIds.includes(id));
  const columnOrderIds: ArchiveTableColumnId[] = [
    "name",
    ...orderedIds.filter((id) => id !== "name"),
    ...missingOrderedIds.filter((id) => id !== "name"),
  ];

  if (!visibleColumnIds.includes("name")) {
    visibleColumnIds.unshift("name");
  }

  return {
    visibleColumnIds: uniqueColumnIds(visibleColumnIds),
    columnOrderIds,
    columnWidths: normalizeColumnWidths(settings?.columnWidths, availableColumns),
  };
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
  if (columnId === "name") {
    return normalizeColumnSettings(settings);
  }

  const visible = new Set(settings.visibleColumnIds);
  if (visible.has(columnId)) {
    visible.delete(columnId);
  } else {
    visible.add(columnId);
  }

  return normalizeColumnSettings({
    ...settings,
    visibleColumnIds: Array.from(visible),
  });
}

export function visibleColumns(settings: ArchiveTableColumnSettings): ArchiveTableColumn[] {
  const normalized = normalizeColumnSettings(settings);
  const visible = new Set(normalized.visibleColumnIds);
  const columnsById = new Map(ARCHIVE_TABLE_COLUMNS.map((column) => [column.id, column]));
  return normalized.columnOrderIds
    .filter((id) => visible.has(id))
    .map((id) => {
      const column = columnsById.get(id)!;
      return {
        ...column,
        width: normalized.columnWidths[id] ?? column.width,
      };
    });
}

export function setColumnWidth(
  settings: ArchiveTableColumnSettings,
  columnId: ArchiveTableColumnId,
  width: number,
): ArchiveTableColumnSettings {
  const column = ARCHIVE_TABLE_COLUMNS.find((item) => item.id === columnId);
  if (!column) {
    return normalizeColumnSettings(settings);
  }

  return normalizeColumnSettings({
    ...settings,
    columnWidths: {
      ...settings.columnWidths,
      [columnId]: clampColumnWidth(width, column),
    },
  });
}

export function moveColumn(
  settings: ArchiveTableColumnSettings,
  columnId: ArchiveTableColumnId,
  direction: "left" | "right",
): ArchiveTableColumnSettings {
  if (columnId === "name") {
    return normalizeColumnSettings(settings);
  }

  const normalized = normalizeColumnSettings(settings);
  const order = [...normalized.columnOrderIds];
  const visible = new Set(normalized.visibleColumnIds);
  const visibleOrder = order.filter((id) => visible.has(id));
  const currentVisibleIndex = visibleOrder.indexOf(columnId);
  const nextVisibleIndex = direction === "left" ? currentVisibleIndex - 1 : currentVisibleIndex + 1;

  if (currentVisibleIndex <= 0 || nextVisibleIndex <= 0 || nextVisibleIndex >= visibleOrder.length) {
    return normalized;
  }

  const targetColumnId = visibleOrder[nextVisibleIndex];
  const currentIndex = order.indexOf(columnId);
  const nextIndex = order.indexOf(targetColumnId);
  [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
  return normalizeColumnSettings({
    ...normalized,
    columnOrderIds: order,
  });
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
    case "block":
      return typeof entry.block === "number" ? String(entry.block) : EMPTY_VALUE;
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
  }
}

export function archiveTableColumnLabel(column: ArchiveTableColumn, i18n?: Translator): string {
  return i18n?.t(column.labelKey) ?? column.label;
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
    case "block":
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
