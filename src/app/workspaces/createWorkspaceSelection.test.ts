import { describe, expect, it } from "vitest";

import { createCreateWorkspaceSelection } from "./createWorkspaceSelection";

describe("createCreateWorkspaceSelection", () => {
  it("applies hierarchical selection results and exposes plain snapshots", () => {
    const selection = createCreateWorkspaceSelection();

    selection.apply({
      selectedPaths: new Set(["folder/a.txt", "folder/b.txt"]),
      focusedPath: "folder/b.txt",
      anchorPath: "folder/a.txt",
    });

    expect(selection.getSnapshot()).toEqual({
      selectedPaths: ["folder/a.txt", "folder/b.txt"],
      focusedPath: "folder/b.txt",
      anchorPath: "folder/a.txt",
    });
    expect(selection.has("folder/a.txt")).toBe(true);
    expect(selection.size()).toBe(2);
  });

  it("copies mutable Sets across the module boundary", () => {
    const selection = createCreateWorkspaceSelection();
    const selectedPaths = new Set(["a.txt"]);

    selection.apply({
      selectedPaths,
      focusedPath: "a.txt",
      anchorPath: "a.txt",
    });
    selectedPaths.add("b.txt");

    const state = selection.getState();
    state.selectedPaths.add("c.txt");

    expect(selection.getSnapshot().selectedPaths).toEqual(["a.txt"]);
  });

  it("clears selection state", () => {
    const selection = createCreateWorkspaceSelection();
    selection.apply({
      selectedPaths: new Set(["a.txt"]),
      focusedPath: "a.txt",
      anchorPath: "a.txt",
    });

    expect(selection.clear()).toEqual({
      selectedPaths: [],
      focusedPath: "",
      anchorPath: "",
    });
    expect(selection.size()).toBe(0);
  });
});
