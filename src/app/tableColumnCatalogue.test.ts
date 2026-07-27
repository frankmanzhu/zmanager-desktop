import { describe, expect, it } from "vitest";

import {
  TABLE_COLUMN_CATALOGUE,
  CANONICAL_COLUMN_ORDER,
  COMPRESS_APPLICABLE_IDS,
  EXTRACT_APPLICABLE_IDS,
  COMPRESS_SAFE_BASE_IDS,
  CLEAN_INSTALL_VISIBLE_IDS,
  LEGACY_DEFAULT_VISIBLE_COLUMN_IDS,
  isCompressColumn,
  isExtractColumn,
  getColumnDefinition,
  type TableColumnId,
  type CompressTableColumnId,
  type ExtractTableColumnId,
} from "./tableColumnCatalogue";

import {
  filterToCanonicalOrder,
  intersectVisibleColumns,
  resolveWorkspaceVisibility,
  validateCompressCapabilitySet,
  clampColumnSettingsToAvailableSet,
} from "./tableColumns";

import {
  resolveArchiveFormatFamily,
  type ArchiveFormatFamily,
} from "./archiveFormatFamily";

import {
  getExtractAvailableColumns,
  getUnknownExtractAvailableColumns,
  getAllExtractColumnIds,
} from "./extractColumnAvailability";

import { ARCHIVE_TABLE_COLUMNS, type ArchiveTableColumnId } from "./archiveTable";
import { CREATE_SOURCE_TABLE_COLUMNS, type CreateSourceColumnId } from "./createTableColumns";

// ---------------------------------------------------------------------------
// WP1 — Catalogue structure
// ---------------------------------------------------------------------------

describe("WP1 — Unified column catalogue", () => {
  it("has 22 columns in the canonical catalogue", () => {
    expect(TABLE_COLUMN_CATALOGUE.length).toBe(22);
  });

  it("has exactly the expected column IDs", () => {
    const ids = TABLE_COLUMN_CATALOGUE.map((c) => c.id);
    const expected: TableColumnId[] = [
      "name", "kind", "size", "modified",
      "created", "accessed", "attributes", "mode",
      "linkTarget", "uid", "gid", "owner", "group",
      "sourcePath",
      "compressedSize", "encrypted", "method", "crc",
      "comment", "ratio", "solid", "metadataDiagnostics",
    ];
    expect(ids).toEqual(expected);
  });

  it("has 13 common columns", () => {
    const common = TABLE_COLUMN_CATALOGUE.filter((c) => c.scope === "common");
    expect(common.length).toBe(13);
    expect(common.map((c) => c.id)).toEqual([
      "name", "kind", "size", "modified",
      "created", "accessed", "attributes", "mode",
      "linkTarget", "uid", "gid", "owner", "group",
    ]);
  });

  it("has exactly 1 compress-only column", () => {
    const compress = TABLE_COLUMN_CATALOGUE.filter((c) => c.scope === "compress");
    expect(compress.length).toBe(1);
    expect(compress[0].id).toBe("sourcePath");
  });

  it("has exactly 8 extract-only columns", () => {
    const extract = TABLE_COLUMN_CATALOGUE.filter((c) => c.scope === "extract");
    expect(extract.length).toBe(8);
    expect(extract.map((c) => c.id)).toEqual([
      "compressedSize", "encrypted", "method", "crc",
      "comment", "ratio", "solid", "metadataDiagnostics",
    ]);
  });

  it("every column ID is unique", () => {
    const ids = TABLE_COLUMN_CATALOGUE.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("every column has a valid scope", () => {
    const validScopes = new Set(["common", "compress", "extract"]);
    for (const col of TABLE_COLUMN_CATALOGUE) {
      expect(validScopes.has(col.scope)).toBe(true);
    }
  });

  it("only name has alwaysVisible: true", () => {
    const alwaysVisible = TABLE_COLUMN_CATALOGUE.filter((c) => c.alwaysVisible);
    expect(alwaysVisible.length).toBe(1);
    expect(alwaysVisible[0].id).toBe("name");
  });

  it("name is the first column in canonical order", () => {
    expect(CANONICAL_COLUMN_ORDER[0]).toBe("name");
  });

  it("kind is position 2 in canonical order (semantic reordering)", () => {
    expect(CANONICAL_COLUMN_ORDER[1]).toBe("kind");
  });

  it("getColumnDefinition returns the correct definition", () => {
    const def = getColumnDefinition("name");
    expect(def).toBeDefined();
    expect(def!.id).toBe("name");
    expect(def!.scope).toBe("common");
    expect(def!.alwaysVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WP1 — Derived ID sets
// ---------------------------------------------------------------------------

describe("WP1 — Derived ID sets", () => {
  it("COMPRESS_APPLICABLE_IDS has 14 columns (13 common + 1 compress-only)", () => {
    expect(COMPRESS_APPLICABLE_IDS.length).toBe(14);
    expect(COMPRESS_APPLICABLE_IDS).toContain("sourcePath");
    expect(COMPRESS_APPLICABLE_IDS).not.toContain("compressedSize");
  });

  it("EXTRACT_APPLICABLE_IDS has 21 columns (13 common + 8 extract-only)", () => {
    expect(EXTRACT_APPLICABLE_IDS.length).toBe(21);
    expect(EXTRACT_APPLICABLE_IDS).toContain("compressedSize");
    expect(EXTRACT_APPLICABLE_IDS).not.toContain("sourcePath");
  });

  it("COMPRESS_SAFE_BASE_IDS includes the 5 required columns", () => {
    expect(COMPRESS_SAFE_BASE_IDS).toEqual([
      "name", "kind", "size", "modified", "sourcePath",
    ]);
  });

  it("CLEAN_INSTALL_VISIBLE_IDS includes name, kind, size, modified, compressedSize", () => {
    expect(CLEAN_INSTALL_VISIBLE_IDS).toEqual([
      "name", "kind", "size", "modified", "compressedSize",
    ]);
  });

  it("LEGACY_DEFAULT_VISIBLE_COLUMN_IDS matches current extract defaults", () => {
    expect(LEGACY_DEFAULT_VISIBLE_COLUMN_IDS).toEqual([
      "name", "size", "compressedSize", "modified",
    ]);
  });

  it("isCompressColumn correctly identifies compress-applicable IDs", () => {
    expect(isCompressColumn("name")).toBe(true);
    expect(isCompressColumn("sourcePath")).toBe(true);
    expect(isCompressColumn("mode")).toBe(true);
    expect(isCompressColumn("compressedSize" as TableColumnId)).toBe(false);
    expect(isCompressColumn("ratio" as TableColumnId)).toBe(false);
  });

  it("isExtractColumn correctly identifies extract-applicable IDs", () => {
    expect(isExtractColumn("name")).toBe(true);
    expect(isExtractColumn("compressedSize")).toBe(true);
    expect(isExtractColumn("sourcePath" as TableColumnId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WP1 — Shared resolver functions
// ---------------------------------------------------------------------------

describe("WP1 — filterToCanonicalOrder", () => {
  const order = ["name", "kind", "size", "modified", "mode"] as const;

  it("preserves canonical order for a subset of IDs", () => {
    const result = filterToCanonicalOrder(order, ["mode", "name", "size"]);
    expect(result).toEqual(["name", "size", "mode"]);
  });

  it("removes IDs not in canonical order", () => {
    const result = filterToCanonicalOrder(order, ["name", "unknown", "size"]);
    expect(result).toEqual(["name", "size"]);
  });

  it("keeps stable relative order after filtering", () => {
    const ids = ["mode", "kind", "name"];
    const result = filterToCanonicalOrder(order, ids);
    expect(result).toEqual(["name", "kind", "mode"]);
  });
});

describe("WP1 — intersectVisibleColumns", () => {
  it("filters candidate IDs to allowed set", () => {
    const candidates = ["name", "size", "mode", "crc"];
    const allowed = new Set(["name", "size", "crc"]);
    expect(intersectVisibleColumns(candidates, allowed)).toEqual(["name", "size", "crc"]);
  });

  it("removes all candidates when none intersect", () => {
    const candidates = ["mode", "crc"];
    const allowed = new Set(["name"]);
    expect(intersectVisibleColumns(candidates, allowed)).toEqual([]);
  });
});

describe("WP1 — resolveWorkspaceVisibility", () => {
  const available = new Set(["name", "size", "mode", "kind"]);

  it("uses configured defaults when no local overrides", () => {
    const result = resolveWorkspaceVisibility(
      ["name", "size", "kind"],
      undefined,
      available,
      "name",
    );
    expect(result).toContain("name");
    expect(result).toContain("size");
    expect(result).toContain("kind");
  });

  it("ensures name is always visible even if missing from defaults", () => {
    const result = resolveWorkspaceVisibility(
      ["size"],
      undefined,
      available,
      "name",
    );
    expect(result).toContain("name");
    expect(result).toContain("size");
  });

  it("filters out IDs not in the available set", () => {
    const result = resolveWorkspaceVisibility(
      ["name", "size", "compressedSize" as string],
      undefined,
      new Set(["name", "size"]),
      "name",
    );
    expect(result).toEqual(["name", "size"]);
  });

  it("uses local overrides when provided", () => {
    const result = resolveWorkspaceVisibility(
      ["name", "size"],
      ["name", "kind"],
      available,
      "name",
    );
    expect(result).toContain("name");
    expect(result).toContain("kind");
  });
});

// ---------------------------------------------------------------------------
// WP1 — Compress capability validation
// ---------------------------------------------------------------------------

describe("WP1 — validateCompressCapabilitySet", () => {
  const safeBase = ["name", "kind", "size", "modified", "sourcePath"];
  const allKnown = [
    "name", "kind", "size", "modified", "created", "accessed",
    "attributes", "mode", "linkTarget", "uid", "gid", "owner", "group",
    "sourcePath",
  ];

  it("returns safe base when capability set is undefined", () => {
    expect(validateCompressCapabilitySet(undefined, safeBase, allKnown)).toEqual(safeBase);
  });

  it("returns safe base when capability set is null", () => {
    expect(validateCompressCapabilitySet(null, safeBase, allKnown)).toEqual(safeBase);
  });

  it("returns safe base when capability set is empty", () => {
    expect(validateCompressCapabilitySet([], safeBase, allKnown)).toEqual(safeBase);
  });

  it("returns safe base when capability set contains unknown IDs", () => {
    expect(validateCompressCapabilitySet(
      ["name", "kind", "size", "modified", "sourcePath", "unknown" as string],
      safeBase, allKnown,
    )).toEqual(safeBase);
  });

  it("returns safe base when capability set contains duplicates", () => {
    expect(validateCompressCapabilitySet(
      ["name", "kind", "size", "modified", "sourcePath", "name"],
      safeBase, allKnown,
    )).toEqual(safeBase);
  });

  it("returns safe base when required safe-base ID is missing", () => {
    expect(validateCompressCapabilitySet(
      ["name", "kind", "size", "modified"],  // missing sourcePath
      safeBase, allKnown,
    )).toEqual(safeBase);
  });

  it("returns the validated set unchanged when valid", () => {
    const valid = ["name", "kind", "size", "modified", "sourcePath", "mode"];
    expect(validateCompressCapabilitySet(valid, safeBase, allKnown)).toEqual(valid);
  });

  it("allows the full compress set when all columns are advertised", () => {
    const full = [...allKnown];
    expect(validateCompressCapabilitySet(full, safeBase, allKnown)).toEqual(full);
  });
});

// ---------------------------------------------------------------------------
// WP1 — Capability clamping
// ---------------------------------------------------------------------------

describe("WP1 — clampColumnSettingsToAvailableSet", () => {
  it("removes IDs no longer available while preserving remaining layout", () => {
    const result = clampColumnSettingsToAvailableSet(
      ["name", "size", "mode", "crc"],
      ["name", "size", "mode", "crc"],
      ["name", "size", "mode", "crc"],
      new Set(["name", "size", "mode"]),
    );
    expect(result.visibleColumnIds).toEqual(["name", "size", "mode"]);
    expect(result.columnOrderIds).toEqual(["name", "size", "mode"]);
    expect(result.widthKeysToKeep).toEqual(["name", "size", "mode"]);
  });

  it("preserves all IDs when available set is a superset", () => {
    const result = clampColumnSettingsToAvailableSet(
      ["name", "size"],
      ["name", "size"],
      ["name", "size"],
      new Set(["name", "size", "mode", "kind"]),
    );
    expect(result.visibleColumnIds).toEqual(["name", "size"]);
  });
});

// ---------------------------------------------------------------------------
// WP1 — Extract availability integration
// ---------------------------------------------------------------------------

describe("WP1 — Extract per-family availability", () => {
  it("always includes name and kind in every family availability set", () => {
    const families: ArchiveFormatFamily[] = ["zip", "sevenZ", "tzap", "tarZstd", "tarGzip", "appleArchive", "gzipStream"];
    for (const family of families) {
      const columns = getExtractAvailableColumns(family);
      expect(columns).toContain("name");
      expect(columns).toContain("kind");
    }
  });

  it("zip family includes comment but not uid/gid/owner/group", () => {
    const columns = getExtractAvailableColumns("zip");
    expect(columns).toContain("comment");
    expect(columns).toContain("encrypted");
    expect(columns).toContain("method");
    expect(columns).toContain("crc");
    expect(columns).not.toContain("uid");
    expect(columns).not.toContain("gid");
  });

  it("appleArchive includes uid/gid but not owner/group", () => {
    const columns = getExtractAvailableColumns("appleArchive");
    expect(columns).toContain("uid");
    expect(columns).toContain("gid");
    expect(columns).not.toContain("owner");
    expect(columns).not.toContain("group");
  });

  it("tzap includes full metadata including uid/gid/owner/group", () => {
    const columns = getExtractAvailableColumns("tzap");
    expect(columns).toContain("uid");
    expect(columns).toContain("gid");
    expect(columns).toContain("owner");
    expect(columns).toContain("group");
    expect(columns).toContain("metadataDiagnostics");
  });

  it("raw stream families only have name, kind, compressedSize", () => {
    const columns = getExtractAvailableColumns("gzipStream");
    expect(columns).toEqual(["name", "kind", "compressedSize"]);
  });

  it("unknown availability has no extra columns beyond name/kind", () => {
    const columns = getUnknownExtractAvailableColumns();
    expect(columns).toEqual([]);
  });

  it("getAllExtractColumnIds returns all 21 extract-applicable IDs", () => {
    expect(getAllExtractColumnIds().length).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// WP7 — Guardrails: every old column must exist in the new catalogue
// ---------------------------------------------------------------------------

describe("WP7 — Catalogue coverage guardrails", () => {
  it("every ArchiveTableColumnId exists in the unified catalogue", () => {
    const catalogueIds = new Set(TABLE_COLUMN_CATALOGUE.map((c) => c.id));
    for (const col of ARCHIVE_TABLE_COLUMNS) {
      const id = col.id;
      expect(catalogueIds.has(id as TableColumnId)).toBe(true);
    }
  });

  it("every CreateSourceColumnId exists in the unified catalogue", () => {
    const catalogueIds = new Set(TABLE_COLUMN_CATALOGUE.map((c) => c.id));
    for (const col of CREATE_SOURCE_TABLE_COLUMNS) {
      const id = col.id;
      expect(catalogueIds.has(id as TableColumnId)).toBe(true);
    }
  });

  it("no new product column can be added outside the catalogue", () => {
    // Every column that appears in the old catalogues must have a definition
    // in the unified catalogue. If a new column is added to ArchiveTableColumnId
    // or CreateSourceColumnId, this test will fail until it's also added to
    // TABLE_COLUMN_CATALOGUE.
    const catalogueIds = new Set(TABLE_COLUMN_CATALOGUE.map((c) => c.id));

    const allOldIds: string[] = [
      ...ARCHIVE_TABLE_COLUMNS.map((c) => c.id),
      ...CREATE_SOURCE_TABLE_COLUMNS.map((c) => c.id),
    ];

    for (const id of allOldIds) {
      expect(catalogueIds.has(id as TableColumnId)).toBe(true);
    }
  });

  it("all ArchiveTableColumnId values are covered by Extract scope", () => {
    const extractSet = new Set<string>(EXTRACT_APPLICABLE_IDS);
    for (const col of ARCHIVE_TABLE_COLUMNS) {
      expect(extractSet.has(col.id)).toBe(true);
    }
  });

  it("sourcePath is Compress-applicable but not Extract-applicable", () => {
    expect(COMPRESS_APPLICABLE_IDS as readonly string[]).toContain("sourcePath");
    expect(EXTRACT_APPLICABLE_IDS as readonly string[]).not.toContain("sourcePath");
  });
});
