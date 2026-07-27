import { describe, expect, it } from "vitest";

import { getCompressLayout, getExtractLayout } from "./scenarioColumnLayout";
import type { TableColumnId } from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// WP1 — Scenario-specific intrinsic layout
// ---------------------------------------------------------------------------

describe("WP1 — Scenario column layout", () => {
  it("provides different widths for the same column in Compress vs Extract", () => {
    expect(getCompressLayout("name").width).toBe(320);
    expect(getExtractLayout("name").width).toBe(190);

    expect(getCompressLayout("size").width).toBe(120);
    expect(getExtractLayout("size").width).toBe(100);

    expect(getCompressLayout("modified").width).toBe(170);
    expect(getExtractLayout("modified").width).toBe(150);
  });

  it("returns zero width for cross-scenario columns (filtered by resolver)", () => {
    // Compressed size is Extract-only — should have zero width in Compress
    expect(getCompressLayout("compressedSize").width).toBe(0);
    // Source path is Compress-only — should have zero width in Extract
    expect(getExtractLayout("sourcePath").width).toBe(0);
  });

  it("provides non-zero minWidth for applicable columns", () => {
    expect(getCompressLayout("name").minWidth).toBeGreaterThan(0);
    expect(getExtractLayout("name").minWidth).toBeGreaterThan(0);
  });

  it("provides sensible fallback for unknown column IDs", () => {
    const fallback = getCompressLayout("unknown" as TableColumnId);
    expect(fallback.width).toBe(100);
    expect(fallback.minWidth).toBe(64);
  });

  it("all Extract-only columns have non-zero widths in Extract layout", () => {
    const extractOnlyIds: TableColumnId[] = [
      "compressedSize", "encrypted", "method", "crc",
      "comment", "ratio", "solid", "metadataDiagnostics",
    ];
    for (const id of extractOnlyIds) {
      const layout = getExtractLayout(id);
      expect(layout.width).toBeGreaterThan(0);
    }
  });

  it("all Compress-applicable columns have non-zero widths in Compress layout", () => {
    const compressIds: TableColumnId[] = [
      "name", "kind", "size", "modified", "sourcePath", "mode",
    ];
    for (const id of compressIds) {
      const layout = getCompressLayout(id);
      expect(layout.width).toBeGreaterThan(0);
    }
  });
});
