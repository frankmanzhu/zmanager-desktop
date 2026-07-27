import type { PreferenceStorage } from "./preferenceStorage";
import type { ArchiveFormatFamily } from "./archiveFormatFamily";
import { migrationPrecedenceKeys, ALL_ARCHIVE_FORMAT_FAMILIES } from "./archiveFormatFamily";
import type { TableColumnId, ExtractTableColumnId } from "./tableColumnCatalogue";
import {
  EXTRACT_APPLICABLE_IDS,
  COMPRESS_APPLICABLE_IDS,
  CLEAN_INSTALL_VISIBLE_IDS,
  LEGACY_DEFAULT_VISIBLE_COLUMN_IDS,
  isExtractColumn,
} from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// Version-2 visibility-only column preferences
//
// Activation Gate: the production loader/writer MUST NOT switch to this model
// until WP2–WP5 pass and the Migration Activation Gate is triggered.
// ---------------------------------------------------------------------------

export const TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY = "zmanager.tableColumnVisibility.v2";

export type TableColumnVisibilityPreferences = Readonly<{
  version: 2;
  /** Global visible column IDs (across all scenarios) */
  visibleColumnIds: readonly TableColumnId[];
  /** Per-format-family Extract visibility overrides */
  visibleColumnIdsByFormatFamily: Readonly<
    Partial<Record<ArchiveFormatFamily, readonly ExtractTableColumnId[]>>
  >;
}>;

// ---------------------------------------------------------------------------
// Save result
// ---------------------------------------------------------------------------

export type ColumnPreferenceSaveResult =
  | Readonly<{ kind: "success" }>
  | Readonly<{ kind: "failure"; reason: "storage" | "verification" | "parse" }>;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a version-2 preferences object. Ensures Name is always visible,
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
    version: 2,
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
  if (ids.includes("name")) {
    seen.add("name");
    result.push("name");
  } else {
    seen.add("name");
    result.push("name");
  }
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
    version: 2,
    visibleColumnIds: CLEAN_INSTALL_VISIBLE_IDS,
    visibleColumnIdsByFormatFamily: {},
  });
}

// ---------------------------------------------------------------------------
// Migration from legacy preferences
// ---------------------------------------------------------------------------

export type LegacyColumnPreferences = Readonly<{
  /** Comma-separated visible column IDs, e.g. "name,size,crc" */
  tableVisibleColumns: string | null;
  /** JSON-encoded per-format settings: {".tgz": {...}, ".zip": {...}} */
  tableColumnsByFormat: string | null;
}>;

/**
 * Migrate legacy preferences to the version-2 model.
 *
 * Migration precedence for per-format overrides:
 * For each ArchiveFormatFamily, check stored legacy keys in order:
 * 1. canonical family ID
 * 2. preferred undotted key
 * 3. preferred dotted key
 * 4. each remaining alias: undotted before dotted
 *
 * The first present legacy key wins. Lower-precedence values are ignored.
 * Unknown IDs and Compress-only IDs are removed.
 */
export function migrateLegacyColumnPreferences(
  legacy: LegacyColumnPreferences,
): TableColumnVisibilityPreferences {
  // Parse global visible IDs
  const globalVisible = parseLegacyVisibleIds(legacy.tableVisibleColumns);

  // Parse per-format settings
  const byFormatLegacy = parseLegacyColumnsByFormat(legacy.tableColumnsByFormat);

  // Migrate per-format overrides using alias precedence.
  // For each family, the HIGHEST-PRECEDENCE present legacy key wins.
  // Lower-precedence keys for the same family are silently ignored.
  // This is a two-pass approach: first group by family, then pick the
  // key with the lowest precedence rank for each family.
  const visibleColumnIdsByFormatFamily: Record<string, readonly ExtractTableColumnId[]> = {};

  // Map: family → { rank: number, visibleColumnIds: string[] }
  // Lower rank = higher precedence (0 = canonical family ID)
  const bestKeyPerFamily = new Map<string, { rank: number; visibleColumnIds: string[] }>();

  for (const [legacyKey, settings] of Object.entries(byFormatLegacy)) {
    const family = resolveLegacyKeyToFamily(legacyKey);
    if (!family) continue;

    // Determine this key's precedence rank for this family
    const precedence = migrationPrecedenceKeys(family);
    const rank = precedence.indexOf(legacyKey);
    if (rank < 0) continue;

    const existing = bestKeyPerFamily.get(family);
    if (!existing || rank < existing.rank) {
      bestKeyPerFamily.set(family, { rank, visibleColumnIds: settings.visibleColumnIds });
    }
  }

  // Process each family with its highest-precedence legacy settings
  for (const [family, entry] of bestKeyPerFamily) {
    const extractIds = entry.visibleColumnIds
      .filter((id): id is ExtractTableColumnId => isExtractColumn(id as TableColumnId));

    if (extractIds.length > 0) {
      const normalized = normalizeExtractVisibleIds(
        [...new Set([...extractIds])] as ExtractTableColumnId[],
      );
      if (normalized.length > 1) {
        // More than just "name"
        visibleColumnIdsByFormatFamily[family] = normalized;
      }
    }
  }

  return normalizeTableColumnVisibilityPreferences({
    version: 2,
    visibleColumnIds: globalVisible.length > 0 ? globalVisible : LEGACY_DEFAULT_VISIBLE_COLUMN_IDS,
    visibleColumnIdsByFormatFamily,
  });
}

function parseLegacyVisibleIds(raw: string | null): TableColumnId[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TableColumnId => s.length > 0);
}

function parseLegacyColumnsByFormat(
  raw: string | null,
): Record<string, { visibleColumnIds: string[] }> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, { visibleColumnIds: string[] }>;
  } catch {
    return {};
  }
}

/**
 * Resolve a legacy preference key (dotted or undotted) to its canonical
 * ArchiveFormatFamily using the documented alias precedence.
 *
 * Returns undefined if the key cannot be resolved.
 */
function resolveLegacyKeyToFamily(key: string): ArchiveFormatFamily | undefined {
  for (const family of ALL_ARCHIVE_FORMAT_FAMILIES) {
    const precedence = migrationPrecedenceKeys(family);
    if (precedence.includes(key)) {
      return family;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Failure-safe save
// ---------------------------------------------------------------------------

/**
 * Save version-2 preferences with write-then-read-back verification.
 *
 * On success, the legacy keys can be retired. On failure, legacy keys are
 * preserved and a failure result is returned.
 */
export function saveTableColumnVisibilityPreferences(
  prefs: TableColumnVisibilityPreferences,
  storage: PreferenceStorage,
  legacyKeysToRetire: readonly string[],
): ColumnPreferenceSaveResult {
  const normalized = normalizeTableColumnVisibilityPreferences(prefs);
  const json = JSON.stringify(normalized);

  try {
    // 1. Write the new version-2 object
    storage.setItem(TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY, json);

    // 2. Read back and verify
    const readBack = storage.getItem(TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY);
    if (readBack !== json) {
      // Verification failed — leave legacy keys intact
      return { kind: "failure", reason: "verification" };
    }

    // 3. Parse to ensure validity
    try {
      const parsed = JSON.parse(readBack);
      if (parsed?.version !== 2) {
        return { kind: "failure", reason: "parse" };
      }
    } catch {
      return { kind: "failure", reason: "parse" };
    }

    // 4. Success — retire legacy keys
    for (const key of legacyKeysToRetire) {
      storage.removeItem(key);
    }

    return { kind: "success" };
  } catch {
    return { kind: "failure", reason: "storage" };
  }
}

// ---------------------------------------------------------------------------
// Load (with migration)
// ---------------------------------------------------------------------------

export type ColumnPreferenceLoadResult =
  | Readonly<{ kind: "v2"; prefs: TableColumnVisibilityPreferences }>
  | Readonly<{ kind: "clean"; prefs: TableColumnVisibilityPreferences }>
  | Readonly<{ kind: "loadFailure"; prefs: TableColumnVisibilityPreferences }>;

/**
 * Load column visibility preferences.
 *
 * Loading order:
 * 1. If valid version-2 object exists, use it (ignore legacy keys).
 * 2. If no version-2 but legacy keys exist, migrate.
 * 3. If neither, use clean-install defaults.
 */
export function loadTableColumnVisibilityPreferences(
  storage: PreferenceStorage | null,
  legacy: LegacyColumnPreferences | null,
): ColumnPreferenceLoadResult {
  if (!storage) {
    return { kind: "loadFailure", prefs: cleanInstallVisibilityPreferences() };
  }

  try {
    const raw = storage.getItem(TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 2 && Array.isArray(parsed.visibleColumnIds)) {
        const normalized = normalizeTableColumnVisibilityPreferences(parsed as TableColumnVisibilityPreferences);
        return { kind: "v2", prefs: normalized };
      }
    }
  } catch {
    // Fall through to legacy migration
  }

  // Try legacy migration
  if (legacy?.tableVisibleColumns || legacy?.tableColumnsByFormat) {
    try {
      const migrated = migrateLegacyColumnPreferences(legacy);
      return { kind: "v2", prefs: migrated };
    } catch {
      // Fall through to clean install
    }
  }

  // Clean install
  return { kind: "clean", prefs: cleanInstallVisibilityPreferences() };
}
