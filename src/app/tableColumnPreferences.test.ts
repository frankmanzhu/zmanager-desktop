import { describe, expect, it } from "vitest";

import {
  normalizeTableColumnVisibilityPreferences,
  cleanInstallVisibilityPreferences,
  TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY,
} from "./tableColumnPreferences";

// ---------------------------------------------------------------------------
// Clean-install defaults
// ---------------------------------------------------------------------------

describe("Clean-install visibility defaults", () => {
  it("produces defaults with name, kind, size, modified, compressedSize", () => {
    const prefs = cleanInstallVisibilityPreferences();
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
// Normalization
// ---------------------------------------------------------------------------

describe("Preference normalization", () => {
  it("ensures name is always visible", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      visibleColumnIds: ["size", "modified"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds).toContain("name");
  });

  it("removes unknown column IDs", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      visibleColumnIds: ["name", "unknown" as never, "size"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds).not.toContain("unknown");
    expect(prefs.visibleColumnIds).toContain("size");
  });

  it("deduplicates visible column IDs", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
      visibleColumnIds: ["name", "size", "name", "size"],
      visibleColumnIdsByFormatFamily: {},
    });
    expect(prefs.visibleColumnIds.filter((id) => id === "name").length).toBe(1);
    expect(prefs.visibleColumnIds.filter((id) => id === "size").length).toBe(1);
  });

  it("removes per-format overrides with empty arrays", () => {
    const prefs = normalizeTableColumnVisibilityPreferences({
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
// Storage key
// ---------------------------------------------------------------------------

describe("Storage key", () => {
  it("uses the correct key", () => {
    expect(TABLE_COLUMN_VISIBILITY_PREFERENCE_KEY).toBe("zmanager.tableColumnVisibility");
  });
});
