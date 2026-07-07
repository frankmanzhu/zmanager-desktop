import { describe, expect, it } from "vitest";

import {
  applyRowSelectionIntent,
  invertVisibleSelection,
  pathsWithSameExtension,
  selectAllVisible,
} from "./selection";

describe("archive selection helpers", () => {
  const visible = ["alpha.txt", "bravo.txt", "charlie.md", "delta.txt"];

  it("selects all visible paths", () => {
    expect(Array.from(selectAllVisible(visible))).toEqual(visible);
  });

  it("inverts visible selection without touching hidden selections", () => {
    const inverted = invertVisibleSelection(new Set(["alpha.txt", "hidden.bin"]), visible);

    expect(Array.from(inverted).sort()).toEqual(["bravo.txt", "charlie.md", "delta.txt", "hidden.bin"]);
  });

  it("supports ctrl toggles and shift ranges", () => {
    const ctrl = applyRowSelectionIntent({
      path: "alpha.txt",
      visiblePaths: visible,
      currentSelection: new Set(),
      ctrlKey: true,
    });
    const shift = applyRowSelectionIntent({
      path: "charlie.md",
      visiblePaths: visible,
      currentSelection: ctrl.selectedPaths,
      anchorPath: ctrl.anchorPath,
      shiftKey: true,
    });

    expect(Array.from(shift.selectedPaths)).toEqual(["alpha.txt", "bravo.txt", "charlie.md"]);
  });

  it("replaces the visible selection on plain shift range and extends it on ctrl shift", () => {
    const plainShift = applyRowSelectionIntent({
      path: "charlie.md",
      visiblePaths: visible,
      currentSelection: new Set(["delta.txt"]),
      anchorPath: "alpha.txt",
      shiftKey: true,
    });
    const ctrlShift = applyRowSelectionIntent({
      path: "charlie.md",
      visiblePaths: visible,
      currentSelection: new Set(["delta.txt"]),
      anchorPath: "alpha.txt",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(Array.from(plainShift.selectedPaths)).toEqual(["alpha.txt", "bravo.txt", "charlie.md"]);
    expect(Array.from(ctrlShift.selectedPaths)).toEqual(["delta.txt", "alpha.txt", "bravo.txt", "charlie.md"]);
  });

  it("finds visible paths with the focused extension", () => {
    expect(pathsWithSameExtension("alpha.txt", visible)).toEqual([
      "alpha.txt",
      "bravo.txt",
      "delta.txt",
    ]);
  });
});
