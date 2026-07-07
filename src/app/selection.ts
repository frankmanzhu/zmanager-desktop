export type SelectionIntent = {
  path: string;
  visiblePaths: readonly string[];
  currentSelection: ReadonlySet<string>;
  anchorPath?: string | null;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type SelectionResult = {
  selectedPaths: Set<string>;
  anchorPath: string;
};

export function selectAllVisible(visiblePaths: readonly string[]): Set<string> {
  return new Set(visiblePaths);
}

export function invertVisibleSelection(
  currentSelection: ReadonlySet<string>,
  visiblePaths: readonly string[],
): Set<string> {
  const nextSelection = new Set(currentSelection);
  for (const path of visiblePaths) {
    if (nextSelection.has(path)) {
      nextSelection.delete(path);
    } else {
      nextSelection.add(path);
    }
  }
  return nextSelection;
}

export function applyRowSelectionIntent(intent: SelectionIntent): SelectionResult {
  const anchorPath = intent.anchorPath && intent.visiblePaths.includes(intent.anchorPath)
    ? intent.anchorPath
    : intent.path;
  const selectedPaths = new Set(intent.currentSelection);

  if (intent.shiftKey) {
    const range = visiblePathRange(intent.visiblePaths, anchorPath, intent.path);
    return {
      selectedPaths: intent.ctrlKey || intent.metaKey
        ? new Set([...selectedPaths, ...range])
        : new Set(range),
      anchorPath,
    };
  }

  if (intent.ctrlKey || intent.metaKey) {
    if (selectedPaths.has(intent.path)) {
      selectedPaths.delete(intent.path);
    } else {
      selectedPaths.add(intent.path);
    }
    return {
      selectedPaths,
      anchorPath: intent.path,
    };
  }

  return {
    selectedPaths: new Set([intent.path]),
    anchorPath: intent.path,
  };
}

export function visiblePathRange(
  visiblePaths: readonly string[],
  anchorPath: string,
  targetPath: string,
): string[] {
  const anchorIndex = visiblePaths.indexOf(anchorPath);
  const targetIndex = visiblePaths.indexOf(targetPath);

  if (anchorIndex < 0 || targetIndex < 0) {
    return [targetPath];
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return visiblePaths.slice(start, end + 1);
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
