import {
  applyHierarchicalRowSelectionIntent,
  invertVisibleHierarchicalSelection,
  selectAllVisibleHierarchicalRows,
  type HierarchicalTableSelectionResult,
} from "./hierarchicalTable";

export { visiblePathRange } from "./hierarchicalTable";

export type SelectionIntent = {
  path: string;
  visiblePaths: readonly string[];
  currentSelection: ReadonlySet<string>;
  anchorPath?: string | null;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type SelectionResult = Pick<HierarchicalTableSelectionResult, "selectedPaths" | "anchorPath">;

export function selectAllVisible(visiblePaths: readonly string[]): Set<string> {
  return selectAllVisibleHierarchicalRows(visiblePaths).selectedPaths;
}

export function invertVisibleSelection(
  currentSelection: ReadonlySet<string>,
  visiblePaths: readonly string[],
): Set<string> {
  return invertVisibleHierarchicalSelection({ currentSelection, visiblePaths }).selectedPaths;
}

export function applyRowSelectionIntent(intent: SelectionIntent): SelectionResult {
  return applyHierarchicalRowSelectionIntent(intent);
}

export function pathsWithSameExtension(
  focusedPath: string,
  visiblePaths: readonly string[],
): string[] {
  const extension = getExtension(focusedPath);
  return visiblePaths.filter((path) => getExtension(path) === extension);
}

function getExtension(path: string): string {
  const name = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
}
