import { describe, expect, it } from "vitest";

import {
  ARCHIVE_TABLE_COLUMNS,
  archiveTableColumnLabel,
  buildArchiveBrowserRows,
  compareOptionalDates,
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  formatArchiveTableValue,
  moveColumn,
  normalizeColumnSettings,
  reorderColumn,
  resetColumnSettings,
  setColumnWidth,
  sortArchiveRows,
  toggleColumnVisibility,
  visibleColumns,
} from "./archiveTable";
import type { ArchiveTableRow } from "./archiveTable";
import type { ArchiveEntryDto } from "../api/types";
import { entryHierarchicalRowId } from "./hierarchicalTable";
import { createTranslatorFromCatalog } from "./i18n/translator";
import { zhCnMessages } from "./i18n/messages.zh-CN";

describe("archive table columns and formatters", () => {
  it("uses the required default details columns", () => {
    expect(DEFAULT_ARCHIVE_TABLE_COLUMN_IDS).toEqual([
      "name",
      "size",
      "compressedSize",
      "modified",
    ]);
  });

  it("renders unknown table values blank", () => {
    const entry = {
      path: "docs/readme.txt",
      kind: "file" as const,
    };

    expect(formatArchiveTableValue(entry, "size")).toBe("");
    expect(formatArchiveTableValue(entry, "modified")).toBe("");
    expect(formatArchiveTableValue(entry, "crc")).toBe("");
  });

  it("keeps zero-like unknown timestamps blank", () => {
    const entry = {
      path: "docs/readme.txt",
      kind: "file" as const,
      modified: "0",
      created: "0000-00-00T00:00:00Z",
    };

    expect(formatArchiveTableValue(entry, "modified")).toBe("");
    expect(formatArchiveTableValue(entry, "created")).toBe("");
  });

  it("formats unix timestamp strings from archive listings as dates", () => {
    const entry = {
      path: "docs/readme.txt",
      kind: "file" as const,
      modified: "1718000000",
    };

    expect(formatArchiveTableValue(entry, "modified")).not.toBe("");
  });

  it("formats portable archive modes as four-digit octal", () => {
    const entry = {
      path: "docs/readme.txt",
      kind: "file" as const,
      mode: 0o640,
    };

    expect(formatArchiveTableValue(entry, "mode")).toBe("0640");
  });

  it("localizes labels and kind display without changing sort order", () => {
    const zhCn = createTranslatorFromCatalog("zh-CN", zhCnMessages);
    const kindColumn = ARCHIVE_TABLE_COLUMNS.find((column) => column.id === "kind")!;
    const rows: ArchiveTableRow[] = [
      {
        rowType: "entry",
        rowId: entryHierarchicalRowId("file.txt"),
        path: "file.txt",
        name: "file.txt",
        entry: { path: "file.txt", kind: "file" },
      },
      {
        rowType: "entry",
        rowId: entryHierarchicalRowId("folder"),
        path: "folder",
        name: "folder",
        entry: { path: "folder", kind: "directory" },
      },
    ];

    expect(archiveTableColumnLabel(kindColumn, zhCn)).toBe("类型");
    const fileRow = rows[0];
    expect(fileRow.rowType).toBe("entry");
    expect(formatArchiveTableValue(fileRow.rowType === "entry" ? fileRow.entry : undefined, "kind", zhCn)).toBe("文件");
    expect(sortArchiveRows(rows, "kind", true).map((row) => row.path)).toEqual(["folder", "file.txt"]);
  });

  it("uppercases checksums and marks encrypted entries", () => {
    const entry = {
      path: "secret.txt",
      kind: "file" as const,
      crc: "deadbeef",
      encrypted: true,
    };

    expect(formatArchiveTableValue(entry, "crc")).toBe("DEADBEEF");
    expect(formatArchiveTableValue(entry, "encrypted")).toBe("+");
  });

  it("does not allow the Name column to be hidden", () => {
    const settings = toggleColumnVisibility(resetColumnSettings(), "name");

    expect(settings.visibleColumnIds).toContain("name");
  });

  it("persists column order and width settings", () => {
    const settings = setColumnWidth(
      moveColumn(normalizeColumnSettings({
        visibleColumnIds: ["name", "size", "compressedSize", "modified"],
      }), "compressedSize", "left"),
      "name",
      260,
    );

    expect(settings.columnOrderIds.slice(0, 4)).toEqual([
      "name",
      "compressedSize",
      "size",
      "modified",
    ]);
    expect(visibleColumns(settings).map((column) => [column.id, column.width])).toContainEqual([
      "name",
      260,
    ]);
  });

  it("reorders columns by inserting source before target", () => {
    const initial = resetColumnSettings();
    const visibleBefore = visibleColumns(initial).map((col) => col.id);
    const reordered = reorderColumn(initial, visibleBefore[3], visibleBefore[1]);
    const visibleAfter = visibleColumns(reordered).map((col) => col.id);

    expect(visibleAfter[0]).toBe("name");
    expect(visibleAfter[1]).toBe(visibleBefore[3]);
    expect(visibleAfter[2]).toBe(visibleBefore[1]);
  });

  it("prevents reordering the name column", () => {
    const initial = resetColumnSettings();
    const reordered = reorderColumn(initial, "name", "size");
    expect(visibleColumns(reordered)[0].id).toBe("name");

    const reorderedToName = reorderColumn(initial, "size", "name");
    expect(visibleColumns(reorderedToName)[0].id).toBe("name");
  });
});

describe("archive table sorting", () => {
  const rows: ArchiveTableRow[] = [
    {
      rowType: "entry",
      rowId: entryHierarchicalRowId("b.bin"),
      path: "b.bin",
      name: "b.bin",
      entry: { path: "b.bin", kind: "file", size: 20, modified: "2026-06-12T00:00:00Z" },
    },
    {
      rowType: "entry",
      rowId: entryHierarchicalRowId("a.bin"),
      path: "a.bin",
      name: "a.bin",
      entry: { path: "a.bin", kind: "file", size: 100, modified: "2026-06-10T00:00:00Z" },
    },
  ];

  it("sorts sizes numerically", () => {
    expect(sortArchiveRows(rows, "size", true).map((row) => row.path)).toEqual(["b.bin", "a.bin"]);
  });

  it("sorts dates chronologically", () => {
    expect(sortArchiveRows(rows, "modified", true).map((row) => row.path)).toEqual(["a.bin", "b.bin"]);
  });

  it("sorts unix timestamp strings chronologically", () => {
    expect(compareOptionalDates("1718000000", "1718003600")).toBeLessThan(0);
    expect(compareOptionalDates("0", "1718003600")).toBeGreaterThan(0);
  });
});

describe("archive browser rows", () => {
  const entries: ArchiveEntryDto[] = [
    { path: "docs/readme.txt", kind: "file", size: 12 },
    { path: "docs/images/logo.png", kind: "file", size: 20 },
    { path: "docs", kind: "directory" },
    { path: "src/readme.txt", kind: "file", size: 8 },
    { path: "root.txt", kind: "file", size: 1 },
    { path: "empty", kind: "directory" },
  ];

  function rowSummary(row: ArchiveTableRow): [ArchiveTableRow["rowType"], string, string, string | undefined] {
    return [
      row.rowType,
      row.path,
      row.name,
      row.rowType === "folder" || row.rowType === "entry" ? row.entry?.path : undefined,
    ];
  }

  it("builds root rows with explicit directories, synthetic folders, and entries", () => {
    const rows = sortArchiveRows(buildArchiveBrowserRows({ entries }), "name", true);

    expect(rows.map(rowSummary)).toEqual([
      ["folder", "docs", "docs", "docs"],
      ["folder", "empty", "empty", "empty"],
      ["folder", "src", "src", undefined],
      ["entry", "root.txt", "root.txt", "root.txt"],
    ]);
  });

  it("builds nested rows with a parent row when configured", () => {
    const rows = sortArchiveRows(
      buildArchiveBrowserRows({
        entries,
        currentFolder: "docs",
        showParentFolderItem: true,
      }),
      "name",
      true,
    );

    expect(rows.map(rowSummary)).toEqual([
      ["parent", "", "..", undefined],
      ["folder", "docs/images", "images", undefined],
      ["entry", "docs/readme.txt", "readme.txt", "docs/readme.txt"],
    ]);
  });

  it("omits the parent row when parent folder items are disabled", () => {
    const rows = buildArchiveBrowserRows({
      entries,
      currentFolder: "docs",
      showParentFolderItem: false,
    });

    expect(rows.some((row) => row.rowType === "parent")).toBe(false);
  });

  it("uses entry rows directly in flat view and preserves duplicate basenames as distinct paths", () => {
    const rows = sortArchiveRows(buildArchiveBrowserRows({ entries, flatView: true }), "name", true);
    const readmeRows = rows.filter((row) => row.name === "readme.txt");

    expect(readmeRows.map((row) => row.path)).toEqual(["docs/readme.txt", "src/readme.txt"]);
    expect(rows.find((row) => row.path === "docs")?.rowType).toBe("folder");
    expect(rows.find((row) => row.path === "docs/images/logo.png")?.rowType).toBe("entry");
  });

  it("searches normalized archive paths and leaves nonmatching selected paths hidden", () => {
    const rows = sortArchiveRows(
      buildArchiveBrowserRows({ entries, searchQuery: "readme" }),
      "name",
      true,
    );
    const hiddenSelection = new Set(["root.txt"]);
    const visibleSelectedRows = rows.filter(
      (row) => (row.rowType === "entry" || row.rowType === "folder") && hiddenSelection.has(row.path),
    );

    expect(rows.map((row) => row.path)).toEqual(["docs/readme.txt", "src/readme.txt"]);
    expect(visibleSelectedRows).toEqual([]);
  });

});
