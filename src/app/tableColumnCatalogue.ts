import type { MessageKey } from "./i18n/translator";

// ---------------------------------------------------------------------------
// Unified column catalogue
// ---------------------------------------------------------------------------

export type TableScenario = "compress" | "extract";

export type TableColumnScope = "common" | "compress" | "extract";

// -- Unified column ID -------------------------------------------------------

export type TableColumnId =
  // Common (IDs 1–13)
  | "name"
  | "kind"
  | "size"
  | "modified"
  | "created"
  | "accessed"
  | "attributes"
  | "mode"
  | "linkTarget"
  | "uid"
  | "gid"
  | "owner"
  | "group"
  // Compress-only (ID 14)
  | "sourcePath"
  // Extract-only (IDs 15–22)
  | "compressedSize"
  | "encrypted"
  | "method"
  | "crc"
  | "comment"
  | "ratio"
  | "solid"
  | "metadataDiagnostics";

// -- Derived scenario-specific ID types --------------------------------------

/** Columns applicable to Compress: common ∪ compress-only */
export type CompressTableColumnId =
  | "name"
  | "kind"
  | "size"
  | "modified"
  | "created"
  | "accessed"
  | "attributes"
  | "mode"
  | "linkTarget"
  | "uid"
  | "gid"
  | "owner"
  | "group"
  | "sourcePath";

/** Columns applicable to Extract: common ∪ extract-only */
export type ExtractTableColumnId =
  | "name"
  | "kind"
  | "size"
  | "modified"
  | "created"
  | "accessed"
  | "attributes"
  | "mode"
  | "linkTarget"
  | "uid"
  | "gid"
  | "owner"
  | "group"
  | "compressedSize"
  | "encrypted"
  | "method"
  | "crc"
  | "comment"
  | "ratio"
  | "solid"
  | "metadataDiagnostics";

// -- Column definition -------------------------------------------------------

export type TableColumnDefinition = Readonly<{
  id: TableColumnId;
  scope: TableColumnScope;
  labelKey: MessageKey;
  align: "left" | "right" | "center";
  /** Column cannot be hidden through header menu or preferences */
  alwaysVisible?: boolean;
}>;

// -- Canonical catalogue -----------------------------------------------------
// Order is semantic and stable. Filtering removes inapplicable IDs without
// changing the order of the remaining IDs.

export const TABLE_COLUMN_CATALOGUE: readonly TableColumnDefinition[] = [
  // Common columns (IDs 1–13)
  { id: "name",         scope: "common",   labelKey: "table.name",                  align: "left",   alwaysVisible: true },
  { id: "kind",         scope: "common",   labelKey: "table.type",                  align: "left" },
  { id: "size",         scope: "common",   labelKey: "table.size",                  align: "right" },
  { id: "modified",     scope: "common",   labelKey: "table.modified",              align: "left" },
  { id: "created",      scope: "common",   labelKey: "table.created",               align: "left" },
  { id: "accessed",     scope: "common",   labelKey: "table.accessed",              align: "left" },
  { id: "attributes",   scope: "common",   labelKey: "table.attributes",            align: "left" },
  { id: "mode",         scope: "common",   labelKey: "detail.mode",                 align: "right" },
  { id: "linkTarget",   scope: "common",   labelKey: "table.linkTarget",            align: "left" },
  { id: "uid",          scope: "common",   labelKey: "table.uid",                   align: "right" },
  { id: "gid",          scope: "common",   labelKey: "table.gid",                   align: "right" },
  { id: "owner",        scope: "common",   labelKey: "table.owner",                 align: "left" },
  { id: "group",        scope: "common",   labelKey: "table.group",                 align: "left" },
  // Compress-only (ID 14)
  { id: "sourcePath",   scope: "compress", labelKey: "table.sourcePath",            align: "left" },
  // Extract-only (IDs 15–22)
  { id: "compressedSize",     scope: "extract", labelKey: "table.packedSize",       align: "right" },
  { id: "encrypted",          scope: "extract", labelKey: "table.encrypted",        align: "center" },
  { id: "method",             scope: "extract", labelKey: "table.method",           align: "left" },
  { id: "crc",                scope: "extract", labelKey: "table.crc",              align: "right" },
  { id: "comment",            scope: "extract", labelKey: "table.comment",          align: "left" },
  { id: "ratio",              scope: "extract", labelKey: "table.ratio",            align: "right" },
  { id: "solid",              scope: "extract", labelKey: "table.solid",            align: "center" },
  { id: "metadataDiagnostics", scope: "extract", labelKey: "table.metadataDiagnostics", align: "right" },
];

// -- Derived lookup structures -----------------------------------------------

const catalogueById: ReadonlyMap<TableColumnId, TableColumnDefinition> = (() => {
  const map = new Map<TableColumnId, TableColumnDefinition>();
  for (const col of TABLE_COLUMN_CATALOGUE) {
    map.set(col.id, col);
  }
  return map;
})();

export function getColumnDefinition(id: TableColumnId): TableColumnDefinition | undefined {
  return catalogueById.get(id);
}

// -- Scope filters -----------------------------------------------------------

const COMMON_COLUMN_IDS: readonly TableColumnId[] = TABLE_COLUMN_CATALOGUE
  .filter((c) => c.scope === "common")
  .map((c) => c.id);

const COMPRESS_ONLY_COLUMN_IDS: readonly TableColumnId[] = TABLE_COLUMN_CATALOGUE
  .filter((c) => c.scope === "compress")
  .map((c) => c.id);

const EXTRACT_ONLY_COLUMN_IDS: readonly TableColumnId[] = TABLE_COLUMN_CATALOGUE
  .filter((c) => c.scope === "extract")
  .map((c) => c.id);

/** All column IDs applicable to Compress (common + compress-only) in canonical order. */
export const COMPRESS_APPLICABLE_IDS: readonly CompressTableColumnId[] = [
  ...COMMON_COLUMN_IDS,
  ...COMPRESS_ONLY_COLUMN_IDS,
] as CompressTableColumnId[];

/** All column IDs applicable to Extract (common + extract-only) in canonical order. */
export const EXTRACT_APPLICABLE_IDS: readonly ExtractTableColumnId[] = [
  ...COMMON_COLUMN_IDS,
  ...EXTRACT_ONLY_COLUMN_IDS,
] as ExtractTableColumnId[];

/** The required safe-base Compress columns (always available regardless of Rust capability). */
export const COMPRESS_SAFE_BASE_IDS: readonly CompressTableColumnId[] = [
  "name", "kind", "size", "modified", "sourcePath",
];

/** Canonical catalogue order — the reference for filtering and ordering. */
export const CANONICAL_COLUMN_ORDER: readonly TableColumnId[] =
  TABLE_COLUMN_CATALOGUE.map((c) => c.id);

// -- Clean-install defaults --------------------------------------------------

/** Global visible IDs for a clean (first-time) installation. */
export const CLEAN_INSTALL_VISIBLE_IDS: readonly TableColumnId[] = [
  "name",
  "kind",
  "size",
  "modified",
  "compressedSize",
];

// -- Scenario applicability helpers ------------------------------------------

export function isCompressColumn(id: TableColumnId): id is CompressTableColumnId {
  return (COMPRESS_APPLICABLE_IDS as readonly TableColumnId[]).includes(id);
}

export function isExtractColumn(id: TableColumnId): id is ExtractTableColumnId {
  return (EXTRACT_APPLICABLE_IDS as readonly TableColumnId[]).includes(id);
}
