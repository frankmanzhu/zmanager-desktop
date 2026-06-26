import type { ArchiveEntryDto, ArchiveEntryKind } from "../api/types";
import {
  formatBytes,
  formatCompressionRatio,
  formatDate,
  getPathBasename,
} from "./formatting";

export type ArchiveTableColumnId =
  | "name"
  | "size"
  | "compressedSize"
  | "modified"
  | "created"
  | "accessed"
  | "attributes"
  | "encrypted"
  | "method"
  | "crc"
  | "block"
  | "comment"
  | "kind"
  | "ratio";

export type ArchiveSortKey = ArchiveTableColumnId;

export type ArchiveTableColumn = {
  id: ArchiveTableColumnId;
  label: string;
  width: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
  alwaysVisible?: boolean;
};

export type ArchiveTableRow =
  | {
      rowType: "parent";
      path: string;
      name: "..";
    }
  | {
      rowType: "folder";
      path: string;
      name: string;
      entry?: ArchiveEntryDto;
    }
  | {
      rowType: "entry";
      path: string;
      name: string;
      entry: ArchiveEntryDto;
    };

export type ArchiveTableColumnSettings = {
  visibleColumnIds: ArchiveTableColumnId[];
};

const EMPTY_VALUE = "";
const TABLE_DATE_FORMAT = {
  emptyValue: EMPTY_VALUE,
  dateStyle: "short",
  timeStyle: "short",
} as const;

export const ARCHIVE_TABLE_COLUMNS: ArchiveTableColumn[] = [
  { id: "name", label: "Name", width: 160, align: "left", defaultVisible: true, alwaysVisible: true },
  { id: "size", label: "Size", width: 100, align: "right", defaultVisible: true },
  { id: "compressedSize", label: "Packed Size", width: 100, align: "right", defaultVisible: true },
  { id: "modified", label: "Modified", width: 140, align: "left", defaultVisible: true },
  { id: "created", label: "Created", width: 140, align: "left", defaultVisible: false },
  { id: "accessed", label: "Accessed", width: 140, align: "left", defaultVisible: false },
  { id: "attributes", label: "Attributes", width: 90, align: "left", defaultVisible: false },
  { id: "encrypted", label: "Encrypted", width: 80, align: "center", defaultVisible: false },
  { id: "method", label: "Method", width: 120, align: "left", defaultVisible: false },
  { id: "crc", label: "CRC", width: 90, align: "right", defaultVisible: false },
  { id: "block", label: "Block", width: 70, align: "right", defaultVisible: false },
  { id: "comment", label: "Comment", width: 120, align: "left", defaultVisible: false },
  { id: "kind", label: "Type", width: 90, align: "left", defaultVisible: false },
  { id: "ratio", label: "Ratio", width: 70, align: "right", defaultVisible: false },
];

export const DEFAULT_ARCHIVE_TABLE_COLUMN_IDS = ARCHIVE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);

export function normalizeColumnSettings(
  settings?: Partial<ArchiveTableColumnSettings> | null,
): ArchiveTableColumnSettings {
  const available = new Set(ARCHIVE_TABLE_COLUMNS.map((column) => column.id));
  const incoming = settings?.visibleColumnIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS;
  const visibleColumnIds = incoming.filter((id) => available.has(id));

  if (!visibleColumnIds.includes("name")) {
    visibleColumnIds.unshift("name");
  }

  return {
    visibleColumnIds: Array.from(new Set(visibleColumnIds)),
  };
}

export function resetColumnSettings(): ArchiveTableColumnSettings {
  return normalizeColumnSettings({ visibleColumnIds: DEFAULT_ARCHIVE_TABLE_COLUMN_IDS });
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

  return normalizeColumnSettings({ visibleColumnIds: Array.from(visible) });
}

export function visibleColumns(settings: ArchiveTableColumnSettings): ArchiveTableColumn[] {
  const visible = new Set(normalizeColumnSettings(settings).visibleColumnIds);
  return ARCHIVE_TABLE_COLUMNS.filter((column) => visible.has(column.id));
}

export function formatArchiveTableValue(
  entry: ArchiveEntryDto | undefined,
  columnId: ArchiveTableColumnId,
): string {
  if (!entry) {
    return EMPTY_VALUE;
  }

  switch (columnId) {
    case "name":
      return getPathBasename(entry.path, entry.path);
    case "size":
      return formatBytes(entry.size, { emptyValue: EMPTY_VALUE });
    case "compressedSize":
      return formatBytes(entry.compressedSize, { emptyValue: EMPTY_VALUE });
    case "modified":
      return formatDate(entry.modified, TABLE_DATE_FORMAT);
    case "created":
      return formatDate(entry.created, TABLE_DATE_FORMAT);
    case "accessed":
      return formatDate(entry.accessed, TABLE_DATE_FORMAT);
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
      return formatKind(entry.kind);
    case "ratio":
      return formatCompressionRatio(entry.size, entry.compressedSize, {
        emptyValue: EMPTY_VALUE,
        fractionDigits: 0,
      });
  }
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
  const leftTime = Date.parse(left ?? "");
  const rightTime = Date.parse(right ?? "");
  const leftKnown = !Number.isNaN(leftTime);
  const rightKnown = !Number.isNaN(rightTime);

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
        formatArchiveTableValue(leftEntry, sortKey),
        formatArchiveTableValue(rightEntry, sortKey),
      );
      break;
  }

  return direction * (result || compareStrings(left.path, right.path));
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

function formatKind(kind: ArchiveEntryKind): string {
  switch (kind) {
    case "directory":
      return "Folder";
    case "hardlink":
      return "Hard link";
    case "symlink":
      return "Symbolic link";
    case "special":
      return "Special";
    case "file":
      return "File";
  }
}
