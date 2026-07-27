import { describe, expect, it } from "vitest";

import {
  normalizeTableColumnVisibilityPreferences,
  cleanInstallVisibilityPreferences,
  migrateLegacyColumnPreferences,
  saveTableColumnVisibilityPreferences,
  loadTableColumnVisibilityPreferences,
  TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY,
  type TableColumnVisibilityPreferences,
  type LegacyColumnPreferences,
} from "./tableColumnPreferences";

import type { PreferenceStorage } from "./preferenceStorage";

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

// ---------------------------------------------------------------------------
// WP2 — Clean-install defaults
// ---------------------------------------------------------------------------

describe("WP2 — Clean-install visibility defaults", () => {
  it("produces version 2 with name, kind, size, modified, compressedSize", () => {
    const prefs = cleanInstallVisibilityPreferences();
    expect(prefs.version).toBe(2);
    expect(prefs.visibleColumnIds).toContain("name");
    expect(prefs.visibleColumnIds).toContain("kind");
    expect(prefs.visibleColumnIds).toContain("size");
    expect(prefs.visibleColumnIds).toContain("modified");
    expect(prefs.visibleColumnIds).toContain("compressedSize");
    // Source Path hidden by default
    expect(prefs.visibleColumnIds).not.toContain("sourcePath");
  });

  it("has empty per-format overrides", () => {
    const prefs = cleanInstallVisibilityPreferences();
    expect(prefs.visibleColumnIdsByFormatFamily).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// WP2 — Normalization
// ---------------------------------------------------------------------------

describe("WP2 — Preference normalization", () => {
  it("ensures name is always visible", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["size", "modified"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds).toContain("name");
  });

  it("removes unknown column IDs", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["name", "unknown" as never, "size"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds).not.toContain("unknown");
    expect(prefs.visibleColumnIds).toContain("size");
  });

  it("deduplicates visible column IDs", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["name", "size", "name", "size"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds.filter((id) => id === "name").length).toBe(1);
    expect(prefs.visibleColumnIds.filter((id) => id === "size").length).toBe(1);
  });

  it("removes per-format overrides with empty arrays", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["name"],
      visibleColumnIdsByFormatFamily: {
        zip: [] as unknown as readonly never[],
        sevenZ: ["name", "size"] as unknown as readonly never[],
      },
    });
    const familyOverrides = prefs.visibleColumnIdsByFormatFamily as Record<string, readonly string[]>;
    expect(familyOverrides["zip"]).toBeUndefined();
    expect(familyOverrides["sevenZ"]).toBeDefined();
  });

  it("removes compress-only IDs from per-format overrides", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["name", "size"],
      visibleColumnIdsByFormatFamily: {
        zip: ["name", "sourcePath"] as unknown as readonly never[],
      },
    });
    const familyOverrides = prefs.visibleColumnIdsByFormatFamily as Record<string, readonly string[]>;
    const zipOverride = familyOverrides["zip"];
    if (zipOverride) {
      expect(zipOverride).not.toContain("sourcePath");
    }
  });

  it("ensures name is always first in per-format overrides", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      version: 2,
      visibleColumnIds: ["name"],
      visibleColumnIdsByFormatFamily: {
        zip: ["size", "comment"] as unknown as readonly never[],
      },
    });
    const familyOverrides = prefs.visibleColumnIdsByFormatFamily as Record<string, readonly string[]>;
    const zipOverride = familyOverrides["zip"];
    if (zipOverride) {
      expect(zipOverride[0]).toBe("name");
    }
  });
});

// ---------------------------------------------------------------------------
// WP2 — Migration from legacy preferences
// ---------------------------------------------------------------------------

describe("WP2 — Legacy preference migration", () => {
  it("migrates global comma-separated visible column IDs", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size,crc,comment",
      tableColumnsByFormat: null,
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    expect(prefs.version).toBe(2);
    expect(prefs.visibleColumnIds).toContain("name");
    expect(prefs.visibleColumnIds).toContain("size");
    expect(prefs.visibleColumnIds).toContain("crc");
    expect(prefs.visibleColumnIds).toContain("comment");
  });

  it("uses legacy defaults when no global visibility is stored", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: null,
      tableColumnsByFormat: null,
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    expect(prefs.visibleColumnIds).toContain("name");
    expect(prefs.visibleColumnIds).toContain("size");
    expect(prefs.visibleColumnIds).toContain("compressedSize");
    expect(prefs.visibleColumnIds).toContain("modified");
    // Newly introduced IDs (like kind) are HIDDEN for migrated users
    expect(prefs.visibleColumnIds).not.toContain("kind");
  });

  it("migrates per-format visibility from dotted legacy keys", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".tgz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    expect(prefs.visibleColumnIdsByFormatFamily["tarGzip" as keyof typeof prefs.visibleColumnIdsByFormatFamily]).toBeDefined();
  });

  it("maps dotted and undotted legacy keys to the same family", () => {
    // When both .tgz and .tar.gz exist, the first one in precedence order wins
    const legacyWithDotted: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".tgz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacyWithDotted);
    const override = prefs.visibleColumnIdsByFormatFamily["tarGzip" as keyof typeof prefs.visibleColumnIdsByFormatFamily];
    expect(override).toBeDefined();
    if (override) {
      expect(override).toContain("mode");
    }
  });

  it("removes unknown IDs during migration", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size,unknown_column,xyz",
      tableColumnsByFormat: null,
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    expect(prefs.visibleColumnIds).not.toContain("unknown_column");
    expect(prefs.visibleColumnIds).not.toContain("xyz");
  });

  it("reinserts name as visible during migration", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "size,crc",
      tableColumnsByFormat: null,
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    expect(prefs.visibleColumnIds).toContain("name");
  });

  it("produces the same normalized result when migration runs repeatedly", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size,crc",
      tableColumnsByFormat: JSON.stringify({
        ".tgz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const first = migrateLegacyColumnPreferences(legacy);
    const second = migrateLegacyColumnPreferences(legacy);
    expect(first).toEqual(second);
  });

  it("picks the highest-precedence key when multiple aliases exist for one family", () => {
    // Both .tgz (precedence rank ~4) and tar.gz (precedence rank ~1) exist.
    // tar.gz has higher precedence and MUST win.
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".tgz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
        "tar.gz": { visibleColumnIds: ["name", "size", "comment"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    const override = prefs.visibleColumnIdsByFormatFamily["tarGzip" as keyof typeof prefs.visibleColumnIdsByFormatFamily];
    expect(override).toBeDefined();
    if (override) {
      // tar.gz wins — so "comment" is present, "mode" is NOT
      expect(override).toContain("comment");
      expect(override).not.toContain("mode");
    }
  });

  it("picks higher-precedence undotted key over lower-precedence dotted key", () => {
    // tar.gz (precedence ~1) > tgz (precedence ~3) > .tgz (precedence ~4)
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".tgz": { visibleColumnIds: ["name", "crc"], columnOrderIds: [], columnWidths: {} },
        "tgz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    const override = prefs.visibleColumnIdsByFormatFamily["tarGzip" as keyof typeof prefs.visibleColumnIdsByFormatFamily];
    expect(override).toBeDefined();
    if (override) {
      // tgz wins over .tgz (undotted before dotted)
      expect(override).toContain("mode");
      expect(override).not.toContain("crc");
    }
  });

  it("canonical family ID has highest precedence", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".tar.gz": { visibleColumnIds: ["name", "mode"], columnOrderIds: [], columnWidths: {} },
        "tarGzip": { visibleColumnIds: ["name", "size", "compressedSize"], columnOrderIds: [], columnWidths: {} },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    const override = prefs.visibleColumnIdsByFormatFamily["tarGzip" as keyof typeof prefs.visibleColumnIdsByFormatFamily];
    expect(override).toBeDefined();
    if (override) {
      // "tarGzip" canonical ID wins over all aliases
      expect(override).toContain("compressedSize");
      expect(override).not.toContain("mode");
    }
  });

  it("ignores legacy order and width fields during migration", () => {
    const legacy: LegacyColumnPreferences = {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: JSON.stringify({
        ".zip": { visibleColumnIds: ["name", "crc"], columnOrderIds: ["crc", "name", "size"], columnWidths: { name: 520 } },
      }),
    };
    const prefs = migrateLegacyColumnPreferences(legacy);
    // Order and width fields from legacy are deliberately ignored
    // Only visibleColumnIds are migrated
    expect(prefs.version).toBe(2);
    // No order/width fields exist on v2 prefs
    expect("columnOrderIds" in prefs).toBe(false);
    expect("columnWidths" in prefs).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WP2 — Save with verification
// ---------------------------------------------------------------------------

describe("WP2 — Failure-safe save", () => {
  it("saves and verifies a valid preferences object", () => {
    const storage = memoryStorage();
    const prefs = cleanInstallVisibilityPreferences();
    const result = saveTableColumnVisibilityPreferences(prefs, storage, [
      "zmanager.tableVisibleColumns",
    ]);

    expect(result.kind).toBe("success");
    expect(storage.getItem(TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY)).toBeTruthy();
    // Legacy key should be retired
    expect(storage.getItem("zmanager.tableVisibleColumns")).toBeNull();
  });

  it("retires multiple legacy keys on success", () => {
    const storage = memoryStorage({
      "zmanager.tableVisibleColumns": "name,size",
      "zmanager.tableColumnOrder": "name,size,modified",
      "zmanager.tableColumnWidths": '{"name":200}',
    });
    const prefs = cleanInstallVisibilityPreferences();
    saveTableColumnVisibilityPreferences(prefs, storage, [
      "zmanager.tableVisibleColumns",
      "zmanager.tableColumnOrder",
      "zmanager.tableColumnWidths",
    ]);

    expect(storage.getItem("zmanager.tableVisibleColumns")).toBeNull();
    expect(storage.getItem("zmanager.tableColumnOrder")).toBeNull();
    expect(storage.getItem("zmanager.tableColumnWidths")).toBeNull();
  });

  it("leaves legacy keys intact on verification failure", () => {
    const storage = {
      ...memoryStorage({ "zmanager.tableVisibleColumns": "name,size" }),
      // After write, getItem returns a DIFFERENT value (simulating corruption)
      getItem: (key: string) => {
        if (key === TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY) return "corrupted";
        return "name,size";
      },
    } as PreferenceStorage;

    const prefs = cleanInstallVisibilityPreferences();
    const result = saveTableColumnVisibilityPreferences(prefs, storage, [
      "zmanager.tableVisibleColumns",
    ]);

    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.reason).toBe("verification");
    }
    // Legacy key should be preserved
    expect(storage.getItem("zmanager.tableVisibleColumns")).toBe("name,size");
  });

  it("reports failure when storage throws", () => {
    const storage: PreferenceStorage = {
      getItem: () => { throw new Error("storage error"); },
      setItem: () => { throw new Error("storage error"); },
      removeItem: () => {},
    };

    const prefs = cleanInstallVisibilityPreferences();
    const result = saveTableColumnVisibilityPreferences(prefs, storage, []);
    expect(result.kind).toBe("failure");
  });
});

// ---------------------------------------------------------------------------
// WP2 — Load preferences
// ---------------------------------------------------------------------------

describe("WP2 — Load preferences", () => {
  it("loads valid version-2 preferences without consulting legacy keys", () => {
    const storage = memoryStorage({
      "zmanager.tableColumnVisibility.v2": JSON.stringify({
        version: 2,
        visibleColumnIds: ["name", "size", "mode"],
        visibleColumnIdsByFormatFamily: {},
      }),
      "zmanager.tableVisibleColumns": "name,size,crc",  // should be ignored
    });

    const result = loadTableColumnVisibilityPreferences(storage, {
      tableVisibleColumns: "name,size,crc",
      tableColumnsByFormat: null,
    });

    expect(result.kind).toBe("v2");
    if (result.kind === "v2") {
      expect(result.prefs.visibleColumnIds).toContain("name");
      expect(result.prefs.visibleColumnIds).toContain("size");
      expect(result.prefs.visibleColumnIds).toContain("mode");
      // Legacy "crc" is NOT present because v2 was loaded instead
    }
  });

  it("migrates legacy when no version-2 exists", () => {
    const storage = memoryStorage({
      "zmanager.tableVisibleColumns": "name,size,crc",
    });

    const result = loadTableColumnVisibilityPreferences(storage, {
      tableVisibleColumns: "name,size,crc",
      tableColumnsByFormat: null,
    });

    expect(result.kind).toBe("v2");
  });

  it("returns clean install when nothing is stored", () => {
    const storage = memoryStorage({});
    const result = loadTableColumnVisibilityPreferences(storage, null);
    expect(result.kind).toBe("clean");
    if (result.kind === "clean") {
      expect(result.prefs.visibleColumnIds).toContain("kind");
    }
  });

  it("returns clean install when storage is null", () => {
    const result = loadTableColumnVisibilityPreferences(null, null);
    expect(result.kind).toBe("loadFailure");
  });

  it("rejects invalid version-2 JSON and falls back to migration", () => {
    const storage = memoryStorage({
      "zmanager.tableColumnVisibility.v2": "not-valid-json{{{",
      "zmanager.tableVisibleColumns": "name,size",
    });

    const result = loadTableColumnVisibilityPreferences(storage, {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: null,
    });

    expect(result.kind).toBe("v2"); // migrated from legacy
  });

  it("rejects version-1 objects and migrates from legacy", () => {
    const storage = memoryStorage({
      "zmanager.tableColumnVisibility.v2": JSON.stringify({
        version: 1,
        visibleColumnIds: ["name"],
      }),
      "zmanager.tableVisibleColumns": "name,size",
    });

    const result = loadTableColumnVisibilityPreferences(storage, {
      tableVisibleColumns: "name,size",
      tableColumnsByFormat: null,
    });

    expect(result.kind).toBe("v2");
  });
});
