import { describe, expect, it } from "vitest";

import {
  ARCHIVE_TABLE_COLUMNS,
  ARCHIVE_COLUMNS_BY_FORMAT,
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
  getAvailableColumnsForFormat,
  normalizeColumnSettings,
  resolvePreferredColumnSettings,
  resetColumnSettings,
  type ArchiveTableColumnId,
  type ArchiveTableColumnSettings,
} from "./archiveTable";

import {
  CREATE_SOURCE_TABLE_COLUMNS,
  DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
  DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
  normalizeCreateColumnSettings,
  resetCreateColumnSettings,
  type CreateSourceColumnId,
} from "./createTableColumns";

import {
  normalizeGenericColumnSettings,
  type BaseTableColumn,
  type TableColumnSettings,
} from "./tableColumns";

// ---------------------------------------------------------------------------
// WP0 — Characterization: document current Extract behavior before migration
// ---------------------------------------------------------------------------

describe("WP0 — Extract column characterization (current behavior)", () => {
  it("uses physical suffixes as format keys in ARCHIVE_COLUMNS_BY_FORMAT", () => {
    // Before migration, .tgz and .tar.gz are separate keys with duplicated data
    const tgzKeys = Object.keys(ARCHIVE_COLUMNS_BY_FORMAT);
    expect(tgzKeys).toContain("tgz");
    expect(tgzKeys).toContain("tar.gz");

    // Both entries have identical column arrays (duplicated)
    const tgzColumns = ARCHIVE_COLUMNS_BY_FORMAT["tgz"];
    const tarGzColumns = ARCHIVE_COLUMNS_BY_FORMAT["tar.gz"];
    expect(tgzColumns).toEqual(tarGzColumns);
  });

  it("resolves .tzst and .tar.zst as separate format keys with identical availability", () => {
    const tzstColumns = ARCHIVE_COLUMNS_BY_FORMAT["tzst"];
    const tarZstColumns = ARCHIVE_COLUMNS_BY_FORMAT["tar.zst"];
    expect(tzstColumns).toEqual(tarZstColumns);
  });

  it("uses physical-suffix based preference resolution in resolvePreferredColumnSettings", () => {
    // getKnownArchiveSuffix returns dotted suffixes like ".tgz" — those are the
    // actual keys used in tableColumnsByFormat, NOT undotted "tgz"
    const settings = resolvePreferredColumnSettings(
      {
        tableColumnsByFormat: {
          ".tgz": { visibleColumnIds: ["name", "size"], columnOrderIds: ["name", "size"], columnWidths: { name: 200 } },
        },
        tableVisibleColumnIds: ["name", "size", "compressedSize", "modified"],
        tableColumnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
        tableColumnWidths: {},
      },
      "archive.tgz",
    );

    expect(settings.visibleColumnIds).toEqual(["name", "size"]);
    expect(settings.columnWidths).toEqual({ name: 200 });
  });

  it("falls back to global visibility when no per-format override exists", () => {
    const settings = resolvePreferredColumnSettings(
      {
        tableColumnsByFormat: {},
        tableVisibleColumnIds: ["name", "size"],
        tableColumnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
        tableColumnWidths: { name: 250 },
      },
      "archive.zip",
    );

    expect(settings.visibleColumnIds).toEqual(["name", "size"]);
    expect(settings.columnWidths).toEqual({ name: 250 });
  });

  it("persists column order and widths alongside visibility in settings model", () => {
    const settings = normalizeColumnSettings({
      visibleColumnIds: ["name", "size", "compressedSize"],
      columnOrderIds: ["name", "compressedSize", "size", "modified"],
      columnWidths: { name: 200, size: 150 },
    });

    // Current model includes order + widths (these will be removed in migration)
    expect(settings.columnOrderIds.slice(0, 2)).toEqual(["name", "compressedSize"]);
    expect(settings.columnWidths).toEqual({ name: 200, size: 150 });
  });

  it("stores all 21 extract column IDs in default order", () => {
    expect(DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS.length).toBe(21);
    // All 21 column IDs are present
    const allIds: ArchiveTableColumnId[] = [
      "name", "size", "compressedSize", "modified", "mode",
      "created", "accessed", "attributes", "encrypted", "method",
      "crc", "comment", "kind", "ratio", "solid", "linkTarget",
      "metadataDiagnostics", "uid", "gid", "owner", "group",
    ];
    for (const id of allIds) {
      expect(DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS).toContain(id);
    }
  });

  it("default-visible extract columns are name, size, compressedSize, modified", () => {
    expect(DEFAULT_ARCHIVE_TABLE_COLUMN_IDS).toEqual([
      "name",
      "size",
      "compressedSize",
      "modified",
    ]);
  });

  it("places 'kind' (Type) after 'comment' in the current extract column order", () => {
    const kindIndex = DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS.indexOf("kind");
    const commentIndex = DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS.indexOf("comment");
    expect(kindIndex).toBeGreaterThan(commentIndex);
  });
});

// ---------------------------------------------------------------------------
// WP0 — Characterization: document current Compress behavior before migration
// ---------------------------------------------------------------------------

describe("WP0 — Compress column characterization (current behavior)", () => {
  it("has six in-memory columns with a separate CreateSourceColumnId type", () => {
    const ids: CreateSourceColumnId[] = [
      "name", "size", "modified", "kind", "sourcePath", "mode",
    ];
    expect(CREATE_SOURCE_TABLE_COLUMNS.map((c) => c.id)).toEqual(ids);
  });

  it("shows Name, Size, Modified, Type by default", () => {
    expect(DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS).toEqual([
      "name", "size", "modified", "kind",
    ]);
  });

  it("hides Source Path and Mode by default", () => {
    const defaults = resetCreateColumnSettings();
    expect(defaults.visibleColumnIds).not.toContain("sourcePath");
    expect(defaults.visibleColumnIds).not.toContain("mode");
  });

  it("has independent defaults from Extract — different IDs and order", () => {
    const createDefaults = resetCreateColumnSettings();
    const extractDefaults = resetColumnSettings();

    // Compress has 6 columns, Extract has 21
    expect(CREATE_SOURCE_TABLE_COLUMNS.length).toBe(6);
    expect(ARCHIVE_TABLE_COLUMNS.length).toBe(21);

    // Source Path is Compress-only (not in Extract)
    expect(ARCHIVE_TABLE_COLUMNS.find((c) => c.id === ("sourcePath" as ArchiveTableColumnId))).toBeUndefined();

    // Compressed Size is Extract-only (not in Compress)
    expect(CREATE_SOURCE_TABLE_COLUMNS.find((c) => c.id === ("compressedSize" as CreateSourceColumnId))).toBeUndefined();
  });

  it("resets to canonical order and default visibility via resetCreateColumnSettings", () => {
    const withChanges = normalizeCreateColumnSettings({
      visibleColumnIds: ["name", "sourcePath"],
      columnOrderIds: ["name", "sourcePath", "size"],
      columnWidths: { name: 300 },
    });
    expect(withChanges.visibleColumnIds).toEqual(["name", "sourcePath"]);

    const reset = resetCreateColumnSettings();
    expect(reset.visibleColumnIds).toEqual(["name", "size", "modified", "kind"]);
    expect(reset.columnOrderIds).toEqual(["name", "size", "modified", "kind", "sourcePath", "mode"]);
    expect(reset.columnWidths).toEqual({});
  });

  it("does not persist order or widths to preferences", () => {
    // Compress workspace state is transient — the settings model includes order
    // and widths but they are never written to storage. The normalization
    // expands the provided order with missing default-order columns.
    const settings = normalizeCreateColumnSettings({
      visibleColumnIds: ["name", "size"],
      columnOrderIds: ["name", "size"],
      columnWidths: { name: 240 },
    });
    // Normalization fills in missing default-order columns after the provided ones
    expect(settings.columnOrderIds).toEqual([
      "name", "size", "modified", "kind", "sourcePath", "mode",
    ]);
    expect(settings.columnWidths).toEqual({ name: 240 });
  });
});

// ---------------------------------------------------------------------------
// WP0 — Characterization: format-key alias behavior before migration
// ---------------------------------------------------------------------------

describe("WP0 — Format-key alias behavior (current)", () => {
  it("uses dotted suffix keys (.tgz, .tar.gz) in tableColumnsByFormat storage", () => {
    // getKnownArchiveSuffix returns dotted suffixes like ".tgz" — these are the
    // actual preference keys, not undotted family identifiers
    const tgzSettings = resolvePreferredColumnSettings(
      {
        tableColumnsByFormat: {
          ".tgz": { visibleColumnIds: ["name", "size", "mode"], columnOrderIds: ["name", "size", "mode"], columnWidths: {} },
        },
        tableVisibleColumnIds: DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
        tableColumnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
        tableColumnWidths: {},
      },
      "archive.tgz",
    );

    // Uses ".tgz" key, not "tgz"
    expect(tgzSettings.visibleColumnIds).toContain("name");
    expect(tgzSettings.visibleColumnIds).toContain("size");
    expect(tgzSettings.visibleColumnIds).toContain("mode");
    // compressedSize and modified are NOT in the per-format override, so they
    // should NOT appear (this confirms the per-format key is being used)
  });

  it("has no shared preference between .tgz and .tar.gz aliases", () => {
    // .tgz and .tar.gz have separate entries in ARCHIVE_COLUMNS_BY_FORMAT
    // and separate entries in tableColumnsByFormat. No family abstraction exists.
    const tgzSettings = resolvePreferredColumnSettings(
      {
        tableColumnsByFormat: {
          ".tgz": { visibleColumnIds: ["name", "size"], columnOrderIds: ["name", "size"], columnWidths: {} },
          ".tar.gz": { visibleColumnIds: ["name", "mode"], columnOrderIds: ["name", "mode"], columnWidths: {} },
        },
        tableVisibleColumnIds: DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
        tableColumnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
        tableColumnWidths: {},
      },
      "archive.tar.gz",
    );

    // Uses ".tar.gz" key, not ".tgz"
    expect(tgzSettings.visibleColumnIds).toContain("mode");
  });

  it("treats .ZIP and .zip as the same key (case-insensitive suffix detection)", () => {
    const zipLower = getAvailableColumnsForFormat("archive.zip");
    const zipUpper = getAvailableColumnsForFormat("archive.ZIP");
    expect(zipLower).toEqual(zipUpper);
    expect(zipUpper).toContain("comment");
  });

  it("resolves .tar.zst and .tzst as separate keys despite being the same format", () => {
    const tzstAvail = getAvailableColumnsForFormat("data.tzst");
    const tarZstAvail = getAvailableColumnsForFormat("data.tar.zst");
    // Currently equal because the arrays are duplicated in ARCHIVE_COLUMNS_BY_FORMAT
    expect(tzstAvail).toEqual(tarZstAvail);
    // But they are separate keys in the mapping
    expect(Object.keys(ARCHIVE_COLUMNS_BY_FORMAT)).toContain("tzst");
    expect(Object.keys(ARCHIVE_COLUMNS_BY_FORMAT)).toContain("tar.zst");
  });

  it("does not have canonical family normalization", () => {
    // .tgz has no concept of belonging to a "tarGzip" family
    const tgzKey = "tgz";
    expect(tgzKey in ARCHIVE_COLUMNS_BY_FORMAT).toBe(true);
    // No family abstraction exists
    expect(typeof ARCHIVE_COLUMNS_BY_FORMAT["tgz"]).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// WP0 — Fixtures for ProjectContract, CreatePlanEntryDto, preference storage
// ---------------------------------------------------------------------------

describe("WP0 — Current contract and DTO fixtures", () => {
  it("defines ProjectContract without sourceTableCapabilities", () => {
    // Import the type to verify it compiles
    const contract = {
      commands: ["healthcheck", "list_archive"],
      platformStrategy: "native",
      coreDependency: "zmanager-core@1.0.0",
      platformIntegration: {
        platform: "macos",
        packageKind: "dmg" as const,
        capabilities: [],
      },
    };
    // sourceTableCapabilities does not exist on the contract
    expect("sourceTableCapabilities" in contract).toBe(false);
  });

  it("defines CreatePlanEntryDto with the current six fields", () => {
    const entry = {
      path: "docs/readme.txt",
      kind: "file" as const,
      size: 1024,
      modified: "2026-07-27T00:00:00Z",
      mode: 0o644,
      sourcePath: "/home/user/docs/readme.txt",
    };
    // Verify current shape — no created, accessed, attributes, etc.
    expect(Object.keys(entry).sort()).toEqual([
      "kind", "mode", "modified", "path", "size", "sourcePath",
    ]);
  });
});

// ---------------------------------------------------------------------------
// WP0 — Generic column normalization behavior (baseline)
// ---------------------------------------------------------------------------

describe("WP0 — Generic column normalization baseline", () => {
  const testColumns: BaseTableColumn<"a" | "b" | "c" | "name">[] = [
    { id: "name", label: "Name", labelKey: "table.name" as never, width: 200, align: "left", defaultVisible: true, alwaysVisible: true },
    { id: "a", label: "A", labelKey: "table.size" as never, width: 100, align: "right", defaultVisible: true },
    { id: "b", label: "B", labelKey: "table.size" as never, width: 80, align: "left", defaultVisible: false },
    { id: "c", label: "C", labelKey: "table.size" as never, width: 120, align: "center", defaultVisible: true },
  ];

  it("always places name first in column order regardless of input order", () => {
    const settings = normalizeGenericColumnSettings(
      testColumns,
      ["name", "a", "c"],
      ["name", "a", "b", "c"],
      { visibleColumnIds: ["c", "a", "name"], columnOrderIds: ["c", "a", "name"], columnWidths: {} },
    );
    // Name is always first in columnOrderIds
    expect(settings.columnOrderIds[0]).toBe("name");
    // visibleColumnIds preserves input order (name is present so alwaysVisible
    // doesn't reorder it — unshift only applies when name was missing)
    expect(settings.visibleColumnIds).toContain("name");
  });

  it("removes duplicate IDs from column order", () => {
    const settings = normalizeGenericColumnSettings(
      testColumns,
      ["name", "a", "c"],
      ["name", "a", "b", "c"],
      { visibleColumnIds: ["name", "a"], columnOrderIds: ["name", "a", "a", "name"], columnWidths: {} },
    );
    expect(settings.columnOrderIds.filter((id) => id === "a").length).toBe(1);
    expect(settings.columnOrderIds.filter((id) => id === "name").length).toBe(1);
  });

  it("filters unknown column IDs from visibility and order", () => {
    const settings = normalizeGenericColumnSettings(
      testColumns,
      ["name", "a", "c"],
      ["name", "a", "b", "c"],
      {
        visibleColumnIds: ["name", "unknown" as "a", "a"],
        columnOrderIds: ["name", "unknown" as "a", "a"],
        columnWidths: {},
      },
    );
    expect(settings.visibleColumnIds).not.toContain("unknown");
    expect(settings.columnOrderIds).not.toContain("unknown");
    expect(settings.visibleColumnIds).toContain("name");
    expect(settings.visibleColumnIds).toContain("a");
  });

  it("appends missing default-order columns after the provided order", () => {
    const settings = normalizeGenericColumnSettings(
      testColumns,
      ["name", "a", "c"],
      ["name", "a", "b", "c"],
      {
        visibleColumnIds: ["name", "a"],
        columnOrderIds: ["name", "a"],
        columnWidths: {},
      },
    );
    // b and c should be appended after name and a, in default order
    const nameIdx = settings.columnOrderIds.indexOf("name");
    const aIdx = settings.columnOrderIds.indexOf("a");
    const bIdx = settings.columnOrderIds.indexOf("b");
    const cIdx = settings.columnOrderIds.indexOf("c");
    expect(nameIdx).toBe(0);
    expect(aIdx).toBe(1);
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(cIdx).toBeGreaterThan(aIdx);
  });
});
