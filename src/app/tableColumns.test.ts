import { describe, expect, it } from "vitest";
import {
  ARCHIVE_TABLE_COLUMNS,
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
  normalizeColumnSettings,
  resetColumnSettings,
  toggleColumnVisibility,
  visibleColumns,
  setColumnWidth,
  moveColumn,
} from "./archiveTable";
import {
  CREATE_SOURCE_TABLE_COLUMNS,
  DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS,
  DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS,
  normalizeCreateColumnSettings,
  resetCreateColumnSettings,
  toggleCreateColumnVisibility,
  visibleCreateColumns,
  setCreateColumnWidth,
  moveCreateColumn,
  reorderCreateColumn,
} from "./createTableColumns";

describe("unified table columns", () => {
  describe("archive table columns integration", () => {
    it("uses default archive columns", () => {
      const defaults = resetColumnSettings();
      expect(defaults.visibleColumnIds).toEqual(DEFAULT_ARCHIVE_TABLE_COLUMN_IDS);
      expect(defaults.columnOrderIds).toEqual(DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS);
    });

    it("prevents hiding the Name column", () => {
      const settings = toggleColumnVisibility(resetColumnSettings(), "name");
      expect(settings.visibleColumnIds).toContain("name");
    });

    it("toggles optional column visibility", () => {
      const initial = resetColumnSettings();
      expect(initial.visibleColumnIds).not.toContain("mode");
      const toggled = toggleColumnVisibility(initial, "mode");
      expect(toggled.visibleColumnIds).toContain("mode");
      const toggledBack = toggleColumnVisibility(toggled, "mode");
      expect(toggledBack.visibleColumnIds).not.toContain("mode");
    });

    it("clamps column width", () => {
      const settings = setColumnWidth(resetColumnSettings(), "size", 10);
      const visible = visibleColumns(settings);
      const sizeCol = visible.find((col) => col.id === "size");
      expect(sizeCol?.width).toBeGreaterThanOrEqual(64);
    });

    it("moves column order left and right", () => {
      const initial = resetColumnSettings();
      const visibleBefore = visibleColumns(initial).map((col) => col.id);
      const secondColId = visibleBefore[1];
      const thirdColId = visibleBefore[2];

      const moved = moveColumn(initial, thirdColId, "left");
      const visibleAfter = visibleColumns(moved).map((col) => col.id);

      expect(visibleAfter[1]).toBe(thirdColId);
      expect(visibleAfter[2]).toBe(secondColId);
    });
  });

  describe("create workspace source table columns", () => {
    it("uses default create table columns", () => {
      const defaults = resetCreateColumnSettings();
      expect(defaults.visibleColumnIds).toEqual(DEFAULT_CREATE_SOURCE_TABLE_COLUMN_IDS);
      expect(defaults.columnOrderIds).toEqual(DEFAULT_CREATE_SOURCE_TABLE_COLUMN_ORDER_IDS);
      expect(defaults.visibleColumnIds).toEqual(["name", "size", "modified", "kind"]);
    });

    it("prevents hiding the Name column in create table", () => {
      const settings = toggleCreateColumnVisibility(resetCreateColumnSettings(), "name");
      expect(settings.visibleColumnIds).toContain("name");
    });

    it("offers only metadata supplied by the create-plan contract", () => {
      expect(CREATE_SOURCE_TABLE_COLUMNS.map((column) => column.id)).toEqual([
        "name",
        "size",
        "modified",
        "kind",
        "sourcePath",
        "mode",
      ]);
    });

    it("toggles optional create table columns", () => {
      const initial = resetCreateColumnSettings();
      expect(initial.visibleColumnIds).not.toContain("sourcePath");

      const toggled = toggleCreateColumnVisibility(initial, "sourcePath");
      expect(toggled.visibleColumnIds).toContain("sourcePath");

      const visible = visibleCreateColumns(toggled).map((col) => col.id);
      expect(visible).toContain("sourcePath");
    });

    it("sets custom column width for create table", () => {
      const settings = setCreateColumnWidth(resetCreateColumnSettings(), "size", 200);
      const visible = visibleCreateColumns(settings);
      const sizeCol = visible.find((col) => col.id === "size");
      expect(sizeCol?.width).toBe(200);
    });

    it("moves create column left and right", () => {
      const initial = resetCreateColumnSettings();
      const moved = moveCreateColumn(initial, "modified", "left");
      const visibleAfter = visibleCreateColumns(moved).map((col) => col.id);

      expect(visibleAfter[1]).toBe("modified");
      expect(visibleAfter[2]).toBe("size");
    });

    it("reorders create column by target column id", () => {
      const initial = resetCreateColumnSettings();
      const reordered = reorderCreateColumn(initial, "kind", "size");
      const visibleAfter = visibleCreateColumns(reordered).map((col) => col.id);

      expect(visibleAfter[1]).toBe("kind");
      expect(visibleAfter[2]).toBe("size");
    });

    it("prevents reordering name column or targeting name column", () => {
      const initial = resetCreateColumnSettings();
      const reorderedName = reorderCreateColumn(initial, "name", "size");
      expect(visibleCreateColumns(reorderedName)[0].id).toBe("name");

      const reorderedToName = reorderCreateColumn(initial, "size", "name");
      expect(visibleCreateColumns(reorderedToName)[0].id).toBe("name");
    });
  });
});
