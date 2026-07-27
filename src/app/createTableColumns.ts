import type { MessageKey } from "./i18n/translator";
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

export type CreateSourceColumnId =
  | "name"
  | "size"
  | "modified"
  | "kind"
  | "sourcePath"
  | "mode";

export type CreateSourceColumn = BaseTableColumn<CreateSourceColumnId>;

export type CreateSourceColumnWidthMap = TableColumnWidthMap<CreateSourceColumnId>;

export type CreateSourceColumnSettings = TableColumnSettings<CreateSourceColumnId>;

export const CREATE_SOURCE_TABLE_COLUMNS: CreateSourceColumn[] = [
  { id: "name", label: "Name", labelKey: "table.name", width: 320, minWidth: 140, align: "left", defaultVisible: true, alwaysVisible: true },
  { id: "size", label: "Size", labelKey: "table.size", width: 120, minWidth: 72, align: "right", defaultVisible: true },
  { id: "modified", label: "Modified", labelKey: "table.modified", width: 170, minWidth: 110, align: "left", defaultVisible: true },
  { id: "kind", label: "Type", labelKey: "table.type", width: 120, minWidth: 80, align: "left", defaultVisible: true },
  { id: "sourcePath", label: "Source Path", labelKey: "table.sourcePath", width: 220, minWidth: 120, align: "left", defaultVisible: false },
  { id: "mode", label: "Mode", labelKey: "detail.mode", width: 82, minWidth: 64, align: "right", defaultVisible: false },
];

export const DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS = CREATE_SOURCE_TABLE_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);

export const DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS = CREATE_SOURCE_TABLE_COLUMNS.map((column) => column.id);

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
