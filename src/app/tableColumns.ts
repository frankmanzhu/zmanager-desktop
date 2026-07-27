import type { MessageKey, Translator } from "./i18n/translator";

export type BaseTableColumn<TColumnId extends string = string> = {
  id: TColumnId;
  label: string;
  labelKey: MessageKey;
  width: number;
  minWidth?: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
  alwaysVisible?: boolean;
};

export type TableColumnWidthMap<TColumnId extends string = string> = Partial<Record<TColumnId, number>>;

export type TableColumnSettings<TColumnId extends string = string> = {
  visibleColumnIds: TColumnId[];
  columnOrderIds: TColumnId[];
  columnWidths: TableColumnWidthMap<TColumnId>;
};

export const DEFAULT_MIN_COLUMN_WIDTH = 64;
export const DEFAULT_MAX_COLUMN_WIDTH = 520;

export function normalizeGenericColumnSettings<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings?: Partial<TableColumnSettings<TColumnId>> | null,
  availableColumnIds?: readonly TColumnId[] | null,
): TableColumnSettings<TColumnId> {
  const columnMap = new Map(columns.map((col) => [col.id, col]));
  const availableSet = availableColumnIds
    ? new Set(availableColumnIds)
    : new Set(columns.map((col) => col.id));

  const incomingVisible = settings?.visibleColumnIds ?? defaultVisibleIds;
  const visibleColumnIds = incomingVisible.filter((id) => availableSet.has(id));

  const incomingOrder = settings?.columnOrderIds ?? defaultOrderIds;
  const orderedIds = uniqueColumnIds(incomingOrder.filter((id) => availableSet.has(id)));
  const missingOrderedIds = defaultOrderIds.filter((id) => availableSet.has(id) && !orderedIds.includes(id));

  const columnOrderIds: TColumnId[] = [];
  if (columnMap.has("name" as TColumnId) && availableSet.has("name" as TColumnId)) {
    columnOrderIds.push("name" as TColumnId);
  }
  for (const id of orderedIds) {
    if (id !== ("name" as TColumnId) && !columnOrderIds.includes(id)) {
      columnOrderIds.push(id);
    }
  }
  for (const id of missingOrderedIds) {
    if (id !== ("name" as TColumnId) && !columnOrderIds.includes(id)) {
      columnOrderIds.push(id);
    }
  }

  for (const col of columns) {
    if (col.alwaysVisible && availableSet.has(col.id) && !visibleColumnIds.includes(col.id)) {
      visibleColumnIds.unshift(col.id);
    }
  }

  return {
    visibleColumnIds: uniqueColumnIds(visibleColumnIds),
    columnOrderIds,
    columnWidths: normalizeColumnWidthsMap(settings?.columnWidths, columnMap),
  };
}

export function toggleGenericColumnVisibility<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings: TableColumnSettings<TColumnId>,
  columnId: TColumnId,
  availableColumnIds?: readonly TColumnId[] | null,
): TableColumnSettings<TColumnId> {
  const colDef = columns.find((col) => col.id === columnId);
  if (columnId === "name" || colDef?.alwaysVisible) {
    return normalizeGenericColumnSettings(columns, defaultVisibleIds, defaultOrderIds, settings, availableColumnIds);
  }

  const visible = new Set(settings.visibleColumnIds);
  if (visible.has(columnId)) {
    visible.delete(columnId);
  } else {
    visible.add(columnId);
  }

  return normalizeGenericColumnSettings(
    columns,
    defaultVisibleIds,
    defaultOrderIds,
    {
      ...settings,
      visibleColumnIds: Array.from(visible),
    },
    availableColumnIds,
  );
}

export function setGenericColumnWidth<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings: TableColumnSettings<TColumnId>,
  columnId: TColumnId,
  width: number,
  availableColumnIds?: readonly TColumnId[] | null,
): TableColumnSettings<TColumnId> {
  const column = columns.find((item) => item.id === columnId);
  if (!column) {
    return normalizeGenericColumnSettings(columns, defaultVisibleIds, defaultOrderIds, settings, availableColumnIds);
  }

  return normalizeGenericColumnSettings(
    columns,
    defaultVisibleIds,
    defaultOrderIds,
    {
      ...settings,
      columnWidths: {
        ...settings.columnWidths,
        [columnId]: clampColumnWidth(width, column),
      },
    },
    availableColumnIds,
  );
}

export function moveGenericColumn<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings: TableColumnSettings<TColumnId>,
  columnId: TColumnId,
  direction: "left" | "right",
  availableColumnIds?: readonly TColumnId[] | null,
): TableColumnSettings<TColumnId> {
  if (columnId === "name") {
    return normalizeGenericColumnSettings(columns, defaultVisibleIds, defaultOrderIds, settings, availableColumnIds);
  }

  const normalized = normalizeGenericColumnSettings(columns, defaultVisibleIds, defaultOrderIds, settings, availableColumnIds);
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

  return normalizeGenericColumnSettings(
    columns,
    defaultVisibleIds,
    defaultOrderIds,
    {
      ...normalized,
      columnOrderIds: order,
    },
    availableColumnIds,
  );
}

export function reorderGenericColumn<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings: TableColumnSettings<TColumnId>,
  sourceColumnId: TColumnId,
  targetColumnId: TColumnId,
  availableColumnIds?: readonly TColumnId[] | null,
): TableColumnSettings<TColumnId> {
  if (
    sourceColumnId === "name" ||
    targetColumnId === "name" ||
    sourceColumnId === targetColumnId
  ) {
    return normalizeGenericColumnSettings(
      columns,
      defaultVisibleIds,
      defaultOrderIds,
      settings,
      availableColumnIds,
    );
  }

  const normalized = normalizeGenericColumnSettings(
    columns,
    defaultVisibleIds,
    defaultOrderIds,
    settings,
    availableColumnIds,
  );
  const order = [...normalized.columnOrderIds];
  const sourceIndex = order.indexOf(sourceColumnId);
  const targetIndex = order.indexOf(targetColumnId);

  if (sourceIndex <= 0 || targetIndex <= 0) {
    return normalized;
  }

  order.splice(sourceIndex, 1);
  order.splice(targetIndex, 0, sourceColumnId);

  return normalizeGenericColumnSettings(
    columns,
    defaultVisibleIds,
    defaultOrderIds,
    {
      ...normalized,
      columnOrderIds: order,
    },
    availableColumnIds,
  );
}

export function visibleGenericColumns<TColumnId extends string>(
  columns: readonly BaseTableColumn<TColumnId>[],
  defaultVisibleIds: readonly TColumnId[],
  defaultOrderIds: readonly TColumnId[],
  settings: TableColumnSettings<TColumnId>,
  availableColumnIds?: readonly TColumnId[] | null,
): BaseTableColumn<TColumnId>[] {
  const normalized = normalizeGenericColumnSettings(columns, defaultVisibleIds, defaultOrderIds, settings, availableColumnIds);
  const visible = new Set(normalized.visibleColumnIds);
  const columnsById = new Map(columns.map((column) => [column.id, column]));
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

export function tableColumnLabel<TColumnId extends string>(
  column: BaseTableColumn<TColumnId>,
  translator: Translator,
): string {
  return translator.t(column.labelKey) ?? column.label;
}

function normalizeColumnWidthsMap<TColumnId extends string>(
  columnWidths: TableColumnWidthMap<TColumnId> | undefined,
  availableColumns: Map<TColumnId, BaseTableColumn<TColumnId>>,
): TableColumnWidthMap<TColumnId> {
  if (!columnWidths) return {};
  const normalized: TableColumnWidthMap<TColumnId> = {};
  for (const [key, value] of Object.entries(columnWidths)) {
    const column = availableColumns.get(key as TColumnId);
    if (!column || typeof value !== "number" || !Number.isFinite(value)) continue;
    normalized[key as TColumnId] = clampColumnWidth(value, column);
  }
  return normalized;
}

function clampColumnWidth<TColumnId extends string>(
  width: number,
  column: BaseTableColumn<TColumnId>,
): number {
  const min = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  return Math.min(DEFAULT_MAX_COLUMN_WIDTH, Math.max(min, Math.round(width)));
}

function uniqueColumnIds<TColumnId extends string>(ids: TColumnId[]): TColumnId[] {
  const result: TColumnId[] = [];
  for (const id of ids) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared visibility resolver — used by both Compress and Extract workspaces
// ---------------------------------------------------------------------------

/**
 * Filter a list of column IDs to canonical catalogue order.
 * Inapplicable IDs are removed; remaining IDs keep their relative catalogue order.
 */
export function filterToCanonicalOrder<TColumnId extends string>(
  canonicalOrder: readonly TColumnId[],
  ids: readonly TColumnId[],
): TColumnId[] {
  const idSet = new Set(ids);
  return canonicalOrder.filter((id) => idSet.has(id));
}

/**
 * Intersect candidate IDs with an allowed set, preserving candidate order.
 */
export function intersectVisibleColumns<TColumnId extends string>(
  candidates: readonly TColumnId[],
  allowed: ReadonlySet<TColumnId>,
): TColumnId[] {
  return candidates.filter((id) => allowed.has(id));
}

/**
 * Resolve workspace-current visible columns: start from configured defaults,
 * apply any local visibility additions/removals within the available set,
 * ensure Name is always visible.
 */
export function resolveWorkspaceVisibility<TColumnId extends string>(
  configuredDefaults: readonly TColumnId[],
  localOverrides: readonly TColumnId[] | undefined,
  availableSet: ReadonlySet<TColumnId>,
  nameId: TColumnId,
): TColumnId[] {
  const source = localOverrides ?? configuredDefaults;
  const visible = new Set<TColumnId>();

  // Name always visible if available
  if (availableSet.has(nameId)) {
    visible.add(nameId);
  }

  for (const id of source) {
    if (availableSet.has(id)) {
      visible.add(id);
    }
  }

  return Array.from(visible);
}

/**
 * Validate a Compress capability set. Returns the safe base if the set is
 * invalid (missing, unknown IDs, duplicates, omitting required safe-base IDs).
 * Returns the validated set unchanged otherwise.
 */
export function validateCompressCapabilitySet<TColumnId extends string>(
  capabilitySet: readonly TColumnId[] | undefined | null,
  safeBaseIds: readonly TColumnId[],
  allKnownCompressIds: readonly TColumnId[],
): readonly TColumnId[] {
  // Missing or empty → fallback to safe base
  if (!capabilitySet || capabilitySet.length === 0) {
    return safeBaseIds;
  }

  const knownSet = new Set(allKnownCompressIds);
  const deduped: TColumnId[] = [];

  for (const id of capabilitySet) {
    // Unknown ID → invalid
    if (!knownSet.has(id)) return safeBaseIds;
    // Duplicate → invalid
    if (deduped.includes(id)) return safeBaseIds;
    deduped.push(id);
  }

  // Must contain every required safe-base ID
  for (const requiredId of safeBaseIds) {
    if (!deduped.includes(requiredId)) return safeBaseIds;
  }

  return deduped;
}

/**
 * Clamp workspace column settings to an updated available set.
 * Removes IDs no longer available, preserves remaining layout, does NOT add
 * newly available optional columns.
 */
export function clampColumnSettingsToAvailableSet<TColumnId extends string>(
  visibleIds: readonly TColumnId[],
  orderIds: readonly TColumnId[],
  widthKeys: readonly TColumnId[],
  availableSet: ReadonlySet<TColumnId>,
): {
  visibleColumnIds: TColumnId[];
  columnOrderIds: TColumnId[];
  widthKeysToKeep: TColumnId[];
} {
  return {
    visibleColumnIds: visibleIds.filter((id) => availableSet.has(id)),
    columnOrderIds: orderIds.filter((id) => availableSet.has(id)),
    widthKeysToKeep: widthKeys.filter((id) => availableSet.has(id)),
  };
}
