import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  formatArchiveTableValue,
  resetColumnSettings,
  sortArchiveRows,
  toggleColumnVisibility,
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
});
