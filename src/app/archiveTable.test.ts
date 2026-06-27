import { describe, expect, it } from "vitest";

import {
  compareOptionalDates,
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  formatArchiveTableValue,
  moveColumn,
  normalizeColumnSettings,
  resetColumnSettings,
  setColumnWidth,
  sortArchiveRows,
  toggleColumnVisibility,
  visibleColumns,
} from "./archiveTable";
import type { ArchiveTableRow } from "./archiveTable";

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
});

describe("archive table sorting", () => {
  const rows: ArchiveTableRow[] = [
    {
      rowType: "entry",
      path: "b.bin",
      name: "b.bin",
      entry: { path: "b.bin", kind: "file", size: 20, modified: "2026-06-12T00:00:00Z" },
    },
    {
      rowType: "entry",
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
