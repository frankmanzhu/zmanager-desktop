import type { ArchiveFormatFamily } from "./archiveFormatFamily";
import type { TableColumnId, ExtractTableColumnId } from "./tableColumnCatalogue";
import {
  EXTRACT_APPLICABLE_IDS,
  COMPRESS_APPLICABLE_IDS,
  CLEAN_INSTALL_VISIBLE_IDS,
  isExtractColumn,
} from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// Unified column visibility preferences
// ---------------------------------------------------------------------------

export const TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY = "zmanager.tableColumnVisibility";

export type TableColumnVisibilityPreferences = Readonly<{
  /** Global visible column IDs (across all scenarios) */
  visibleColumnIds: readonly TableColumnId[];
  /** Per-format-family Extract visibility overrides */
  visibleColumnIdsByFormatFamily: Readonly<
    Partial<Record<ArchiveFormatFamily, readonly ExtractTableColumnId[]>>
  >;
}>;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a preferences object. Ensures Name is always visible,
 * removes unknown IDs, deduplicates, and filters per-format overrides to
 * Extract-applicable IDs only.
 */
export function normalizeTableColumnVisibilityPreferences(
  prefs: TableColumnVisibilityPreferences,
): TableColumnVisibilityPreferences {
  const allKnownIds = new Set<TableColumnId>([
    ...COMPRESS_APPLICABLE_IDS,
    ...EXTRACT_APPLICABLE_IDS,
  ]);

  // Normalize global visible IDs
  const visible = new Set<TableColumnId>();
  visible.add("name"); // Name always visible
  for (const id of prefs.visibleColumnIds) {
    if (allKnownIds.has(id)) {
      visible.add(id);
    }
  }

  // Normalize per-format overrides
  const byFormat: Record<string, readonly ExtractTableColumnId[]> = {};
  for (const [family, ids] of Object.entries(prefs.visibleColumnIdsByFormatFamily)) {
    if (!ids || ids.length === 0) continue;
    const normalized = normalizeExtractVisibleIds(ids);
    if (normalized.length > 0) {
      byFormat[family] = normalized;
    }
  }

  return {
    visibleColumnIds: Array.from(visible),
    visibleColumnIdsByFormatFamily: byFormat,
  };
}

function normalizeExtractVisibleIds(
  ids: readonly ExtractTableColumnId[],
): readonly ExtractTableColumnId[] {
  const seen = new Set<ExtractTableColumnId>();
  const result: ExtractTableColumnId[] = [];
  // Name always first
  seen.add("name");
  result.push("name");
  for (const id of ids) {
    if (id !== "name" && isExtractColumn(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Clean-install defaults
// ---------------------------------------------------------------------------

export function cleanInstallVisibilityPreferences(): TableColumnVisibilityPreferences {
  return normalizeTableColumnVisibilityPreferences({
    visibleColumnIds: CLEAN_INSTALL_VISIBLE_IDS,
    visibleColumnIdsByFormatFamily: {},
  });
}
