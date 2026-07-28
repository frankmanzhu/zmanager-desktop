import { describe, expect, it } from "vitest";

import {
  resolveCompressColumns,
  resolveExtractColumns,
  resolveCompressCapabilitySet,
  resolveExtractSortKey,
  compareResolvedDefaults,
  resolveExtractFamilyFromPath,
  type CompressResolveInput,
  type ExtractResolveInput,
} from "./workspaceColumnResolver";

import { cleanInstallVisibilityPreferences } from "./tableColumnPreferences";
import { COMPRESS_SAFE_BASE_IDS } from "./tableColumnCatalogue";
import type { CompressTableColumnId, TableColumnId } from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// WP4/WP5 — Compress column resolution
// ---------------------------------------------------------------------------

describe("WP4/WP5 — Compress column resolution", () => {
  const visibilityPrefs = cleanInstallVisibilityPreferences();

  it("resolves available columns from the capability set in canonical order", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath",
    ];
    const result = resolveCompressColumns({ capabilitySet, visibilityPrefs });

    expect(result.availableColumnIds).toEqual([
      "name", "kind", "size", "modified", "sourcePath",
    ]);
  });

  it("resolves configured defaults as intersection of available and global visible", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath", "mode",
    ];
    const result = resolveCompressColumns({ capabilitySet, visibilityPrefs });

    // Clean-install visible: name, kind, size, modified, compressedSize
    // But compressedSize is not in the capability set → filtered out
    // sourcePath is available but NOT in clean-install defaults
    expect(result.configuredDefaultIds).toEqual([
      "name", "kind", "size", "modified",
    ]);
  });

  it("sourcePath is available but hidden by default in clean install", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath",
    ];
    const result = resolveCompressColumns({ capabilitySet, visibilityPrefs });

    expect(result.availableColumnIds).toContain("sourcePath");
    expect(result.configuredDefaultIds).not.toContain("sourcePath");
  });

  it("local overrides can show columns not in global defaults", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath",
    ];
    const result = resolveCompressColumns({
      capabilitySet,
      visibilityPrefs,
      localVisibleOverrides: ["name", "kind", "size", "modified", "sourcePath"],
    });

    expect(result.currentVisibleIds).toContain("sourcePath");
  });

  it("local overrides cannot show columns outside capability set", () => {
    const capabilitySet = COMPRESS_SAFE_BASE_IDS;
    const result = resolveCompressColumns({
      capabilitySet,
      visibilityPrefs,
      localVisibleOverrides: ["name", "kind", "size", "modified", "sourcePath", "mode"],
    });

    // mode is not in the safe base → filtered out
    expect(result.currentVisibleIds).not.toContain("mode");
  });

  it("name is always visible even if not in defaults or overrides", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath",
    ];
    const result = resolveCompressColumns({
      capabilitySet,
      visibilityPrefs,
      localVisibleOverrides: ["kind", "size"],
    });

    expect(result.currentVisibleIds).toContain("name");
  });

  it("menu includes all available columns except name", () => {
    const capabilitySet: readonly CompressTableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath",
    ];
    const result = resolveCompressColumns({ capabilitySet, visibilityPrefs });

    expect(result.menuColumnIds).not.toContain("name");
    expect(result.menuColumnIds).toContain("kind");
    expect(result.menuColumnIds).toContain("size");
    expect(result.menuColumnIds).toContain("modified");
    expect(result.menuColumnIds).toContain("sourcePath");
  });
});

// ---------------------------------------------------------------------------
// WP4/WP5 — Extract column resolution
// ---------------------------------------------------------------------------

describe("WP4/WP5 — Extract column resolution", () => {
  const visibilityPrefs = cleanInstallVisibilityPreferences();

  it("resolves ZIP family available columns", () => {
    const input: ExtractResolveInput = {
      familyResolution: { kind: "known", family: "zip" },
      visibilityPrefs,
    };
    const result = resolveExtractColumns(input);

    expect(result.availableColumnIds).toContain("name");
    expect(result.availableColumnIds).toContain("kind");
    expect(result.availableColumnIds).toContain("comment");
    expect(result.availableColumnIds).toContain("encrypted");
    expect(result.availableColumnIds).toContain("crc");
    // ZIP doesn't have uid/gid
    expect(result.availableColumnIds).not.toContain("uid");
  });

  it("resolves configured defaults from global visibility for ZIP", () => {
    const input: ExtractResolveInput = {
      familyResolution: { kind: "known", family: "zip" },
      visibilityPrefs,
    };
    const result = resolveExtractColumns(input);

    // Clean-install: name, kind, size, modified, compressedSize
    // All supported by ZIP
    expect(result.configuredDefaultIds).toEqual([
      "name", "kind", "size", "modified", "compressedSize",
    ]);
  });

  it("uses per-format-family override when present", () => {
    const prefsWithOverride = {
      ...visibilityPrefs,
      visibleColumnIdsByFormatFamily: {
        zip: ["name", "size", "crc", "comment"],
      } as Record<string, readonly string[]>,
    };

    const input: ExtractResolveInput = {
      familyResolution: { kind: "known", family: "zip" },
      visibilityPrefs: prefsWithOverride as typeof visibilityPrefs,
    };
    const result = resolveExtractColumns(input);

    // Global common columns remain visible; the family override controls only
    // Extract-only columns.
    expect(result.configuredDefaultIds).toContain("name");
    expect(result.configuredDefaultIds).toContain("size");
    expect(result.configuredDefaultIds).toContain("kind");
    expect(result.configuredDefaultIds).toContain("modified");
    expect(result.configuredDefaultIds).toContain("crc");
    expect(result.configuredDefaultIds).toContain("comment");
    expect(result.configuredDefaultIds).not.toContain("compressedSize");
  });

  it("resolves unknown format conservatively (name and kind only)", () => {
    const input: ExtractResolveInput = {
      familyResolution: { kind: "unknown" },
      visibilityPrefs,
    };
    const result = resolveExtractColumns(input);

    expect(result.availableColumnIds).toEqual(["name", "kind"]);
    expect(result.menuColumnIds).toEqual(["kind"]);
  });

  it("name is always visible in Extract", () => {
    const input: ExtractResolveInput = {
      familyResolution: { kind: "known", family: "gzipStream" },
      visibilityPrefs,
      localVisibleOverrides: ["compressedSize"],
    };
    const result = resolveExtractColumns(input);
    expect(result.currentVisibleIds).toContain("name");
  });
});

// ---------------------------------------------------------------------------
// WP4/WP5 — Capability set validation
// ---------------------------------------------------------------------------

describe("WP4/WP5 — resolveCompressCapabilitySet", () => {
  it("returns the safe base for undefined input", () => {
    expect(resolveCompressCapabilitySet(undefined)).toEqual(COMPRESS_SAFE_BASE_IDS);
  });

  it("returns the safe base for empty input", () => {
    expect(resolveCompressCapabilitySet([])).toEqual(COMPRESS_SAFE_BASE_IDS);
  });

  it("returns the safe base for input with unknown IDs", () => {
    expect(resolveCompressCapabilitySet(["name", "kind", "unknown"])).toEqual(COMPRESS_SAFE_BASE_IDS);
  });

  it("returns the validated set when valid", () => {
    const valid = ["name", "kind", "size", "modified", "sourcePath", "mode"];
    expect(resolveCompressCapabilitySet(valid)).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// WP4 — Sort key resolution
// ---------------------------------------------------------------------------

describe("WP4 — Extract sort key resolution", () => {
  it("returns the configured key when visible", () => {
    const result = resolveExtractSortKey("size", false, ["name", "size", "kind"]);
    expect(result).toEqual({ sortKey: "size", sortAscending: false });
  });

  it("falls back to name ascending when configured key is not visible", () => {
    const result = resolveExtractSortKey("crc", true, ["name", "size"]);
    expect(result).toEqual({ sortKey: "name", sortAscending: true });
  });

  it("falls back to name ascending when no sort key is configured", () => {
    const result = resolveExtractSortKey(undefined, true, ["name", "size"]);
    expect(result).toEqual({ sortKey: "name", sortAscending: true });
  });
});

// ---------------------------------------------------------------------------
// Gate — Before/after comparison
// ---------------------------------------------------------------------------

describe("Gate — compareResolvedDefaults", () => {
  const baseCompress = {
    scenario: "compress" as const,
    availableColumnIds: ["name", "kind", "size", "modified", "sourcePath"] as readonly TableColumnId[],
    configuredDefaultIds: ["name", "kind", "size", "modified"] as readonly TableColumnId[],
    currentVisibleIds: ["name", "kind", "size", "modified"] as readonly TableColumnId[],
    canonicalOrder: ["name", "kind", "size", "modified", "sourcePath"] as readonly TableColumnId[],
    menuColumnIds: ["kind", "size", "modified", "sourcePath"] as readonly TableColumnId[],
  };

  const baseExtract = {
    scenario: "extract" as const,
    availableColumnIds: ["name", "kind", "size", "modified", "compressedSize"] as readonly TableColumnId[],
    configuredDefaultIds: ["name", "kind", "size", "modified", "compressedSize"] as readonly TableColumnId[],
    currentVisibleIds: ["name", "kind", "size", "modified", "compressedSize"] as readonly TableColumnId[],
    canonicalOrder: ["name", "kind", "size", "modified", "compressedSize"] as readonly TableColumnId[],
    menuColumnIds: ["kind", "size", "modified", "compressedSize"] as readonly TableColumnId[],
  };

  it("detects no change when defaults are identical", () => {
    const result = compareResolvedDefaults(
      baseCompress, baseCompress,
      baseExtract, baseExtract,
    );
    expect(result).toEqual({ compressChanged: false, extractChanged: false });
  });

  it("detects compress change", () => {
    const changedCompress = {
      ...baseCompress,
      configuredDefaultIds: ["name", "kind", "size"] as readonly TableColumnId[],
    };
    const result = compareResolvedDefaults(
      baseCompress, changedCompress,
      baseExtract, baseExtract,
    );
    expect(result.compressChanged).toBe(true);
    expect(result.extractChanged).toBe(false);
  });

  it("detects extract change", () => {
    const changedExtract = {
      ...baseExtract,
      configuredDefaultIds: ["name", "size"] as readonly TableColumnId[],
    };
    const result = compareResolvedDefaults(
      baseCompress, baseCompress,
      baseExtract, changedExtract,
    );
    expect(result.compressChanged).toBe(false);
    expect(result.extractChanged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WP1 (late) — Family path resolution
// ---------------------------------------------------------------------------

describe("WP4 — resolveExtractFamilyFromPath", () => {
  it("resolves .zip to zip family", () => {
    expect(resolveExtractFamilyFromPath("archive.zip")).toEqual({ kind: "known", family: "zip" });
  });

  it("resolves .tgz to tarGzip family", () => {
    expect(resolveExtractFamilyFromPath("archive.tgz")).toEqual({ kind: "known", family: "tarGzip" });
  });

  it("returns unknown for non-archive paths", () => {
    expect(resolveExtractFamilyFromPath("readme.txt")).toEqual({ kind: "unknown" });
  });
});
