import { describe, expect, it } from "vitest";

import {
  applyHierarchicalMarqueeSelection,
  applyHierarchicalRowSelectionIntent,
  buildHierarchicalRows,
  cleanupHierarchicalTableSelection,
  entryHierarchicalRowId,
  folderHierarchicalRowId,
  invertVisibleHierarchicalSelection,
  moveHierarchicalTableFocus,
  parentHierarchicalRowId,
  selectAllVisibleHierarchicalRows,
  selectableHierarchicalRowPaths,
  setHierarchicalTablePathSelected,
  toggleHierarchicalTablePathSelection,
  type BuildHierarchicalRowsOptions,
} from "./hierarchicalTable";

type TestEntry = {
  path: string;
  kind: "directory" | "file";
};

const entries: TestEntry[] = [
  { path: "docs", kind: "directory" },
  { path: "docs/readme.txt", kind: "file" },
  { path: "docs/images/logo.png", kind: "file" },
  { path: "src/readme.txt", kind: "file" },
  { path: "root.txt", kind: "file" },
  { path: "empty", kind: "directory" },
];

function rows(options: Omit<BuildHierarchicalRowsOptions<TestEntry>, "getPath" | "isFolderEntry">) {
  return buildHierarchicalRows({
    ...options,
    getPath: (entry) => entry.path,
    isFolderEntry: (entry) => entry.kind === "directory",
  });
}

function summary(row: ReturnType<typeof rows>[number]) {
  return [
    row.rowType,
    row.rowId,
    row.path,
    row.name,
    row.rowType === "folder" ? row.entry?.path : row.rowType === "entry" ? row.entry.path : undefined,
    row.rowType === "folder" ? row.isSynthetic : undefined,
  ];
}

describe("hierarchical table rows", () => {
  it("builds root folder rows with explicit directories, synthetic folders, and entries", () => {
    expect(rows({ entries }).map(summary)).toEqual([
      ["folder", folderHierarchicalRowId("docs"), "docs", "docs", "docs", false],
      ["folder", folderHierarchicalRowId("src"), "src", "src", undefined, true],
      ["folder", folderHierarchicalRowId("empty"), "empty", "empty", "empty", false],
      ["entry", entryHierarchicalRowId("root.txt"), "root.txt", "root.txt", "root.txt", undefined],
    ]);
  });

  it("builds current-folder rows with a parent row and immediate children", () => {
    expect(rows({ entries, currentFolder: "docs", showParentRow: true }).map(summary)).toEqual([
      ["parent", parentHierarchicalRowId("docs"), "", "..", undefined, undefined],
      ["folder", folderHierarchicalRowId("docs/images"), "docs/images", "images", undefined, true],
      ["entry", entryHierarchicalRowId("docs/readme.txt"), "docs/readme.txt", "readme.txt", "docs/readme.txt", undefined],
    ]);
  });

  it("uses a parent row ID that cannot collide with the parent path", () => {
    const [parentRow] = rows({ entries, currentFolder: "docs", showParentRow: true });

    expect(parentRow.rowType).toBe("parent");
    expect(parentRow.path).toBe("");
    expect(parentRow.rowId).toBe("parent:docs");
    expect(parentRow.rowId).not.toBe(parentRow.path);
    expect(parentRow.rowId).not.toBe(folderHierarchicalRowId(parentRow.path));
    expect(parentRow.rowId).not.toBe(entryHierarchicalRowId(parentRow.path));
  });

  it("omits the parent row when configured off", () => {
    expect(rows({ entries, currentFolder: "docs", showParentRow: false })
      .some((row) => row.rowType === "parent")).toBe(false);
  });

  it("uses direct entry rows in flat mode and keeps duplicate basenames distinct", () => {
    const flatRows = rows({ entries, mode: "flat" });
    const readmeRows = flatRows.filter((row) => row.name === "readme.txt");

    expect(readmeRows.map((row) => [row.rowId, row.path])).toEqual([
      [entryHierarchicalRowId("docs/readme.txt"), "docs/readme.txt"],
      [entryHierarchicalRowId("src/readme.txt"), "src/readme.txt"],
    ]);
    expect(flatRows.find((row) => row.path === "docs")?.rowType).toBe("folder");
    expect(flatRows.find((row) => row.path === "docs/images/logo.png")?.rowType).toBe("entry");
  });

  it("searches normalized paths in direct-row mode", () => {
    expect(rows({ entries, mode: "search", searchQuery: "READme" }).map(summary)).toEqual([
      ["entry", entryHierarchicalRowId("docs/readme.txt"), "docs/readme.txt", "readme.txt", "docs/readme.txt", undefined],
      ["entry", entryHierarchicalRowId("src/readme.txt"), "src/readme.txt", "readme.txt", "src/readme.txt", undefined],
    ]);
  });
});

describe("hierarchical table selection and focus", () => {
  const visible = ["alpha.txt", "bravo.txt", "charlie.md", "delta.txt"];

  it("calculates selectable paths from hierarchical rows", () => {
    expect(selectableHierarchicalRowPaths(rows({ entries, currentFolder: "docs", showParentRow: true }))).toEqual([
      "docs/images",
      "docs/readme.txt",
    ]);
  });

  it("replaces selection on plain row clicks", () => {
    const result = applyHierarchicalRowSelectionIntent({
      path: "bravo.txt",
      visiblePaths: visible,
      currentSelection: new Set(["alpha.txt", "hidden.bin"]),
      anchorPath: "alpha.txt",
    });

    expect(Array.from(result.selectedPaths)).toEqual(["bravo.txt"]);
    expect(result.focusedPath).toBe("bravo.txt");
    expect(result.anchorPath).toBe("bravo.txt");
  });

  it("toggles selection with ctrl or meta", () => {
    const ctrlResult = applyHierarchicalRowSelectionIntent({
      path: "bravo.txt",
      visiblePaths: visible,
      currentSelection: new Set(["alpha.txt", "bravo.txt", "hidden.bin"]),
      ctrlKey: true,
    });
    const metaResult = applyHierarchicalRowSelectionIntent({
      path: "charlie.md",
      visiblePaths: visible,
      currentSelection: ctrlResult.selectedPaths,
      metaKey: true,
    });

    expect(Array.from(ctrlResult.selectedPaths).sort()).toEqual(["alpha.txt", "hidden.bin"]);
    expect(Array.from(metaResult.selectedPaths).sort()).toEqual(["alpha.txt", "charlie.md", "hidden.bin"]);
    expect(metaResult.focusedPath).toBe("charlie.md");
    expect(metaResult.anchorPath).toBe("charlie.md");
  });

  it("selects shift ranges from the visible anchor", () => {
    const result = applyHierarchicalRowSelectionIntent({
      path: "delta.txt",
      visiblePaths: visible,
      currentSelection: new Set(["hidden.bin"]),
      anchorPath: "bravo.txt",
      shiftKey: true,
    });

    expect(Array.from(result.selectedPaths)).toEqual(["bravo.txt", "charlie.md", "delta.txt"]);
    expect(result.focusedPath).toBe("delta.txt");
    expect(result.anchorPath).toBe("bravo.txt");
  });

  it("extends shift ranges with ctrl without dropping hidden selections", () => {
    const result = applyHierarchicalRowSelectionIntent({
      path: "delta.txt",
      visiblePaths: visible,
      currentSelection: new Set(["alpha.txt", "hidden.bin"]),
      anchorPath: "bravo.txt",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(Array.from(result.selectedPaths).sort()).toEqual([
      "alpha.txt",
      "bravo.txt",
      "charlie.md",
      "delta.txt",
      "hidden.bin",
    ]);
  });

  it("selects all visible paths and anchors the first visible path", () => {
    const result = selectAllVisibleHierarchicalRows(visible);

    expect(Array.from(result.selectedPaths)).toEqual(visible);
    expect(result.focusedPath).toBe("alpha.txt");
    expect(result.anchorPath).toBe("alpha.txt");
  });

  it("inverts visible selection without touching hidden selections", () => {
    const result = invertVisibleHierarchicalSelection({
      currentSelection: new Set(["alpha.txt", "hidden.bin"]),
      visiblePaths: visible,
    });

    expect(Array.from(result.selectedPaths).sort()).toEqual(["bravo.txt", "charlie.md", "delta.txt", "hidden.bin"]);
    expect(result.focusedPath).toBe("alpha.txt");
    expect(result.anchorPath).toBe("alpha.txt");
  });

  it("cleans focus and optionally hidden selections when visible rows change", () => {
    const preserveHidden = cleanupHierarchicalTableSelection({
      selectedPaths: new Set(["bravo.txt", "hidden.bin"]),
      focusedPath: "hidden.bin",
      anchorPath: "hidden.bin",
      visiblePaths: visible,
      preserveHiddenSelection: true,
    });
    const dropHidden = cleanupHierarchicalTableSelection({
      selectedPaths: new Set(["bravo.txt", "hidden.bin"]),
      focusedPath: "hidden.bin",
      anchorPath: "hidden.bin",
      visiblePaths: visible,
      preserveHiddenSelection: false,
    });

    expect(Array.from(preserveHidden.selectedPaths).sort()).toEqual(["bravo.txt", "hidden.bin"]);
    expect(preserveHidden.focusedPath).toBe("");
    expect(preserveHidden.anchorPath).toBe("bravo.txt");
    expect(Array.from(dropHidden.selectedPaths)).toEqual(["bravo.txt"]);
  });

  it("moves focus by visible row index and skips parent rows as focused paths", () => {
    const tableRows = rows({ entries, currentFolder: "docs", showParentRow: true });
    const parentMove = moveHierarchicalTableFocus({ rows: tableRows, currentIndex: 1, direction: -1 });
    const childMove = moveHierarchicalTableFocus({ rows: tableRows, currentIndex: 0, direction: 1 });

    expect(parentMove).toEqual({ rowIndex: 0, focusedPath: "" });
    expect(childMove).toEqual({ rowIndex: 1, focusedPath: "docs/images" });
  });

  it("toggles a focused path through the shared helper", () => {
    const result = toggleHierarchicalTablePathSelection({
      selectedPaths: new Set(["alpha.txt"]),
      focusedPath: "alpha.txt",
      anchorPath: "alpha.txt",
      path: "alpha.txt",
    });

    expect(Array.from(result.selectedPaths)).toEqual([]);
    expect(result.focusedPath).toBe("alpha.txt");
    expect(result.anchorPath).toBe("alpha.txt");
  });

  it("sets checkbox selection state without inferring from stale DOM state", () => {
    const result = setHierarchicalTablePathSelected({
      selectedPaths: new Set(["alpha.txt"]),
      focusedPath: "",
      anchorPath: "",
      path: "bravo.txt",
      selected: true,
    });

    expect(Array.from(result.selectedPaths).sort()).toEqual(["alpha.txt", "bravo.txt"]);
    expect(result.focusedPath).toBe("bravo.txt");
    expect(result.anchorPath).toBe("bravo.txt");
  });

  it("applies marquee hit-test results while keeping DOM hit testing outside the helper", () => {
    const replacement = applyHierarchicalMarqueeSelection({
      hitPaths: ["bravo.txt", "delta.txt"],
      visiblePaths: visible,
      baseSelection: new Set(["hidden.bin"]),
    });
    const additive = applyHierarchicalMarqueeSelection({
      hitPaths: ["charlie.md"],
      visiblePaths: visible,
      baseSelection: new Set(["hidden.bin"]),
      additive: true,
    });

    expect(Array.from(replacement.selectedPaths)).toEqual(["bravo.txt", "delta.txt"]);
    expect(replacement.focusedPath).toBe("delta.txt");
    expect(replacement.anchorPath).toBe("delta.txt");
    expect(Array.from(additive.selectedPaths).sort()).toEqual(["charlie.md", "hidden.bin"]);
    expect(additive.focusedPath).toBe("charlie.md");
  });
});
