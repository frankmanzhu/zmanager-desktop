import type { HierarchicalTableSelectionResult } from "../hierarchicalTable";

export type CreateWorkspaceSelectionSnapshot = Readonly<{
  selectedPaths: readonly string[];
  focusedPath: string;
  anchorPath: string;
}>;

export type CreateWorkspaceSelectionState = Readonly<{
  selectedPaths: Set<string>;
  focusedPath: string;
  anchorPath: string;
}>;

export type CreateWorkspaceSelection = Readonly<{
  getSnapshot(): CreateWorkspaceSelectionSnapshot;
  getState(): CreateWorkspaceSelectionState;
  apply(result: HierarchicalTableSelectionResult): CreateWorkspaceSelectionSnapshot;
  clear(): CreateWorkspaceSelectionSnapshot;
  has(path: string): boolean;
  size(): number;
}>;

export function createCreateWorkspaceSelection(): CreateWorkspaceSelection {
  let selectedPaths = new Set<string>();
  let focusedPath = "";
  let anchorPath = "";

  function snapshot(): CreateWorkspaceSelectionSnapshot {
    return {
      selectedPaths: Array.from(selectedPaths),
      focusedPath,
      anchorPath,
    };
  }

  return {
    getSnapshot: snapshot,
    getState() {
      return {
        selectedPaths: new Set(selectedPaths),
        focusedPath,
        anchorPath,
      };
    },
    apply(result) {
      selectedPaths = new Set(result.selectedPaths);
      focusedPath = result.focusedPath;
      anchorPath = result.anchorPath;
      return snapshot();
    },
    clear() {
      selectedPaths = new Set();
      focusedPath = "";
      anchorPath = "";
      return snapshot();
    },
    has(path) {
      return selectedPaths.has(path);
    },
    size() {
      return selectedPaths.size;
    },
  };
}
