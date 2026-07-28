import type { ArchiveFormatFamily, ArchiveFormatFamilyResolution } from "./archiveFormatFamily";
import { resolveArchiveFormatFamily } from "./archiveFormatFamily";
import { getExtractAvailableColumns, getUnknownExtractAvailableColumns } from "./extractColumnAvailability";
import type { TableColumnVisibilityPreferences } from "./tableColumnPreferences";
import type {
  TableColumnId,
  CompressTableColumnId,
  ExtractTableColumnId,
  TableScenario,
} from "./tableColumnCatalogue";
import {
  CANONICAL_COLUMN_ORDER,
  COMPRESS_APPLICABLE_IDS,
  EXTRACT_APPLICABLE_IDS,
  COMPRESS_SAFE_BASE_IDS,
  COMMON_COLUMN_IDS,
  EXTRACT_ONLY_COLUMN_IDS,
  isExtractColumn,
} from "./tableColumnCatalogue";
import {
  filterToCanonicalOrder,
  intersectVisibleColumns,
  resolveWorkspaceVisibility,
  validateCompressCapabilitySet,
} from "./tableColumns";

// ---------------------------------------------------------------------------
// Resolved workspace column state (shared shape, scenario-tagged)
// ---------------------------------------------------------------------------

export type ResolvedWorkspaceColumns = Readonly<{
  scenario: TableScenario;
  /** All columns available for this scenario + current capabilities */
  availableColumnIds: readonly TableColumnId[];
  /** Configured default visible columns (from preferences ∩ capabilities) */
  configuredDefaultIds: readonly TableColumnId[];
  /** Current workspace visible columns (defaults + local overrides, within available) */
  currentVisibleIds: readonly TableColumnId[];
  /** Canonical order filtered to available */
  canonicalOrder: readonly TableColumnId[];
  /** Columns offered in the header context menu */
  menuColumnIds: readonly TableColumnId[];
}>;

// ---------------------------------------------------------------------------
// Compress resolution
// ---------------------------------------------------------------------------

export type CompressResolveInput = Readonly<{
  /** Validated Rust capability set (or safe base fallback) */
  capabilitySet: readonly CompressTableColumnId[];
  /** Global visibility preferences */
  visibilityPrefs: TableColumnVisibilityPreferences;
  /** Optional workspace-local overrides (undefined = use configured defaults) */
  localVisibleOverrides?: readonly CompressTableColumnId[] | undefined;
}>;

export function resolveCompressColumns(
  input: CompressResolveInput,
): ResolvedWorkspaceColumns {
  const availableSet = new Set<TableColumnId>(input.capabilitySet);

  // Available columns = canonical order ∩ capability set
  const availableIds = CANONICAL_COLUMN_ORDER.filter(
    (id) => availableSet.has(id),
  );

  // Menu = same as available (all capability columns are toggleable except name)
  const menuIds = availableIds.filter((id) => id !== "name");

  // Configured default = available ∩ global visible IDs
  const configuredDefaults = intersectVisibleColumns(
    availableIds,
    new Set(input.visibilityPrefs.visibleColumnIds),
  );

  // Current workspace visibility = configured defaults + local overrides
  const currentVisible = resolveWorkspaceVisibility(
    configuredDefaults,
    input.localVisibleOverrides as readonly TableColumnId[] | undefined,
    availableSet,
    "name",
  );

  return {
    scenario: "compress",
    availableColumnIds: availableIds,
    configuredDefaultIds: configuredDefaults,
    currentVisibleIds: currentVisible,
    canonicalOrder: availableIds,
    menuColumnIds: menuIds,
  };
}

/**
 * Validate and normalize a capability set from the ProjectContract.
 * Returns the validated set or the safe-base fallback.
 */
export function resolveCompressCapabilitySet(
  rawIds: readonly string[] | undefined | null,
): readonly CompressTableColumnId[] {
  return validateCompressCapabilitySet(
    rawIds as readonly CompressTableColumnId[] | undefined | null,
    COMPRESS_SAFE_BASE_IDS,
    COMPRESS_APPLICABLE_IDS,
  );
}

// ---------------------------------------------------------------------------
// Extract resolution
// ---------------------------------------------------------------------------

export type ExtractResolveInput = Readonly<{
  /** The resolved format family (or unknown) */
  familyResolution: ArchiveFormatFamilyResolution;
  /** Global visibility preferences */
  visibilityPrefs: TableColumnVisibilityPreferences;
  /** Optional workspace-local overrides */
  localVisibleOverrides?: readonly ExtractTableColumnId[] | undefined;
}>;

export function resolveExtractColumns(
  input: ExtractResolveInput,
): ResolvedWorkspaceColumns {
  if (input.familyResolution.kind === "unknown") {
    return resolveUnknownExtractColumns(input);
  }
  return resolveKnownExtractColumns(input.familyResolution.family, input);
}

function resolveKnownExtractColumns(
  family: ArchiveFormatFamily,
  input: ExtractResolveInput,
): ResolvedWorkspaceColumns {
  // Available = canonical order ∩ family-supported Extract columns
  const familyAvailable = new Set<TableColumnId>(
    getExtractAvailableColumns(family),
  );
  const availableIds = CANONICAL_COLUMN_ORDER.filter(
    (id) => familyAvailable.has(id),
  );

  // Menu = all available Extract columns (name always visible but still in menu)
  const menuIds = availableIds.filter((id) => id !== "name");

  // Check for per-format-family override
  const familyOverride = input.visibilityPrefs.visibleColumnIdsByFormatFamily[
    family as keyof typeof input.visibilityPrefs.visibleColumnIdsByFormatFamily
  ];
  const configuredVisible = familyOverride
    ? new Set<TableColumnId>([
        ...input.visibilityPrefs.visibleColumnIds.filter((id) =>
          COMMON_COLUMN_IDS.includes(id),
        ),
        ...familyOverride.filter((id) => EXTRACT_ONLY_COLUMN_IDS.includes(id)),
      ])
    : new Set(input.visibilityPrefs.visibleColumnIds);

  // Common columns remain global. A family override replaces only the
  // Extract-only portion of the global selection.
  const configuredDefaults = intersectVisibleColumns(
    availableIds,
    configuredVisible,
  );

  // Current = configured defaults + local overrides
  const availableSet = new Set<TableColumnId>(availableIds);
  const currentVisible = resolveWorkspaceVisibility(
    configuredDefaults,
    input.localVisibleOverrides as readonly TableColumnId[] | undefined,
    availableSet,
    "name",
  );

  return {
    scenario: "extract",
    availableColumnIds: availableIds,
    configuredDefaultIds: configuredDefaults,
    currentVisibleIds: currentVisible,
    canonicalOrder: availableIds,
    menuColumnIds: menuIds,
  };
}

function resolveUnknownExtractColumns(
  input: ExtractResolveInput,
): ResolvedWorkspaceColumns {
  // Conservative: use the declared unknown-format availability set
  const availableIds: TableColumnId[] = [...getUnknownExtractAvailableColumns()];

  const configuredDefaults = intersectVisibleColumns(
    availableIds,
    new Set(input.visibilityPrefs.visibleColumnIds),
  );

  const currentVisible = resolveWorkspaceVisibility(
    configuredDefaults,
    input.localVisibleOverrides as readonly TableColumnId[] | undefined,
    new Set(availableIds),
    "name",
  );

  return {
    scenario: "extract",
    availableColumnIds: availableIds,
    configuredDefaultIds: configuredDefaults,
    currentVisibleIds: currentVisible,
    canonicalOrder: availableIds,
    menuColumnIds: availableIds.filter((id) => id !== "name"),
  };
}

// ---------------------------------------------------------------------------
// Sort key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a configured sort key against current visible Extract columns.
 * Returns Name ascending as fallback when the configured key is unavailable
 * or hidden. Does NOT persist the fallback.
 */
export function resolveExtractSortKey(
  configuredSortKey: string | undefined,
  configuredSortAscending: boolean,
  visibleColumnIds: readonly TableColumnId[],
): { sortKey: string; sortAscending: boolean } {
  if (configuredSortKey && visibleColumnIds.includes(configuredSortKey as TableColumnId)) {
    return { sortKey: configuredSortKey, sortAscending: configuredSortAscending };
  }
  return { sortKey: "name", sortAscending: true };
}

// ---------------------------------------------------------------------------
// Before/after comparison for preference save
// ---------------------------------------------------------------------------

export type ColumnDefaultComparison = Readonly<{
  compressChanged: boolean;
  extractChanged: boolean;
}>;

/**
 * Compare before/after configured defaults for both scenarios.
 * Determines which workspaces need a reset after Global Column Options save.
 */
export function compareResolvedDefaults(
  compressBefore: ResolvedWorkspaceColumns,
  compressAfter: ResolvedWorkspaceColumns,
  extractBefore: ResolvedWorkspaceColumns,
  extractAfter: ResolvedWorkspaceColumns,
): ColumnDefaultComparison {
  return {
    compressChanged: !arraysEqual(
      compressBefore.configuredDefaultIds,
      compressAfter.configuredDefaultIds,
    ),
    extractChanged: !arraysEqual(
      extractBefore.configuredDefaultIds,
      extractAfter.configuredDefaultIds,
    ),
  };
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

// ---------------------------------------------------------------------------
// Convenience: resolve columns for an archive path
// ---------------------------------------------------------------------------

export function resolveExtractFamilyFromPath(
  archivePath: string,
): ArchiveFormatFamilyResolution {
  return resolveArchiveFormatFamily(archivePath);
}
