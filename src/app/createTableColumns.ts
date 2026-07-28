import type { ArchiveEntryKind, CreatePlanEntryDto } from "../api/types";
import type { MessageKey, Translator } from "./i18n/translator";
import {
  formatBytes,
  formatDate,
  formatUnixMode,
} from "./formatting";
import {
  moveGenericColumn,
  normalizeGenericColumnSettings,
  reorderGenericColumn,
  setGenericColumnWidth,
  tableColumnLabel,
  toggleGenericColumnVisibility,
  visibleGenericColumns,
  type BaseTableColumn,
  type TableColumnSettings,
  type TableColumnWidthMap,
} from "./tableColumns";
import {
  CANONICAL_COLUMN_ORDER,
  CLEAN_INSTALL_VISIBLE_IDS,
  COMPRESS_APPLICABLE_IDS,
  getColumnDefinition,
  type CompressTableColumnId,
  type TableColumnId,
} from "./tableColumnCatalogue";
import { getCompressLayout } from "./scenarioColumnLayout";

// -- Types (backward-compatible re-exports from the unified catalogue) ----------

export type CreateSourceColumnId = CompressTableColumnId;

export type CreateSourceColumn = BaseTableColumn<CreateSourceColumnId>;

export type CreateSourceColumnWidthMap = TableColumnWidthMap<CreateSourceColumnId>;

export type CreateSourceColumnSettings = TableColumnSettings<CreateSourceColumnId>;

// -- English fallback labels (keyed by catalogue labelKey) ---------------------
// The catalogue owns the canonical labelKey; we supply the English fallback
// string that tableColumnLabel uses when no translator is available.

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
  "table.sourcePath": "Source Path",
};

// -- Column catalogue ---------------------------------------------------------
// Built from the unified catalogue + Compress-specific intrinsic widths.
// Canonical order and scope are owned by tableColumnCatalogue.

function buildColumn(id: CompressTableColumnId): CreateSourceColumn {
  const def = getColumnDefinition(id as TableColumnId);
  const layout = getCompressLayout(id as TableColumnId);
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

export const CREATE_SOURCE_TABLE_COLUMNS: CreateSourceColumn[] =
  COMPRESS_APPLICABLE_IDS.map(buildColumn);

export const DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS = CREATE_SOURCE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);

export const DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS =
  CREATE_SOURCE_TABLE_COLUMNS.map((column) => column.id);

// -- Column setting helpers (thin wrappers over generic tableColumns) ----------

export function normalizeCreateColumnSettings(
  settings?: Partial<CreateSourceColumnSettings> | null,
): CreateSourceColumnSettings {
  return normalizeGenericColumnSettings(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
  );
}

export function resetCreateColumnSettings(): CreateSourceColumnSettings {
  return normalizeCreateColumnSettings({
    visibleColumnIds: DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    columnOrderIds: DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    columnWidths: {},
  });
}

export function toggleCreateColumnVisibility(
  settings: CreateSourceColumnSettings,
  columnId: CreateSourceColumnId,
): CreateSourceColumnSettings {
  return toggleGenericColumnVisibility(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
  );
}

export function setCreateColumnWidth(
  settings: CreateSourceColumnSettings,
  columnId: CreateSourceColumnId,
  width: number,
): CreateSourceColumnSettings {
  return setGenericColumnWidth(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
    width,
  );
}

export function moveCreateColumn(
  settings: CreateSourceColumnSettings,
  columnId: CreateSourceColumnId,
  direction: "left" | "right",
): CreateSourceColumnSettings {
  return moveGenericColumn(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
    columnId,
    direction,
  );
}

export function reorderCreateColumn(
  settings: CreateSourceColumnSettings,
  sourceColumnId: CreateSourceColumnId,
  targetColumnId: CreateSourceColumnId,
): CreateSourceColumnSettings {
  return reorderGenericColumn(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
    sourceColumnId,
    targetColumnId,
  );
}

export function visibleCreateColumns(settings: CreateSourceColumnSettings): CreateSourceColumn[] {
  return visibleGenericColumns(
    CREATE_SOURCE_TABLE_COLUMNS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
    DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
    settings,
  );
}

export { tableColumnLabel as createTableColumnLabel };

// -- Value formatting (app-layer pure function, same pattern as archiveTable) --

const EMPTY = "";
const DATE_FORMAT = { emptyValue: EMPTY, dateStyle: "short", timeStyle: "short" } as const;

export function formatCreateTableValue(
  entry: CreatePlanEntryDto | undefined,
  columnId: CreateSourceColumnId,
  i18n?: Translator,
): string {
  if (!entry) return EMPTY;

  switch (columnId) {
    case "name":
      return entry.path;
    case "kind":
      return formatKind(entry.kind, i18n);
    case "size":
      return formatBytes(entry.size, { emptyValue: EMPTY, locale: i18n?.locale });
    case "modified":
      return formatDate(entry.modified, { ...DATE_FORMAT, locale: i18n?.locale });
    case "created":
      return formatDate(entry.created, { ...DATE_FORMAT, locale: i18n?.locale });
    case "accessed":
      return formatDate(entry.accessed, { ...DATE_FORMAT, locale: i18n?.locale });
    case "attributes":
      return entry.attributes?.map((attr) => attr.code).join(", ") ?? EMPTY;
    case "mode":
      return formatUnixMode(entry.mode, entry.kind);
    case "linkTarget":
      return entry.linkTarget ?? EMPTY;
    case "uid":
      return typeof entry.uid === "number" ? String(entry.uid) : EMPTY;
    case "gid":
      return typeof entry.gid === "number" ? String(entry.gid) : EMPTY;
    case "owner":
      return entry.owner ?? (typeof entry.uid === "number" ? String(entry.uid) : EMPTY);
    case "group":
      return entry.group ?? (typeof entry.gid === "number" ? String(entry.gid) : EMPTY);
    case "sourcePath":
      return entry.sourcePath;
    default:
      return EMPTY;
  }
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
