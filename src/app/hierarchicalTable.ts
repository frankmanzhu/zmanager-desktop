import {
  getArchiveEntryName,
  getArchivePathRelativeToFolder,
  getParentArchivePath,
  joinArchivePath,
  normalizeArchivePath,
  splitArchivePath,
} from "./archiveTree";

export type HierarchicalTableMode = "folder" | "flat" | "search";

export type HierarchicalTableRow<TEntry> =
  | {
      rowType: "parent";
      rowId: string;
      path: string;
      name: string;
      currentFolderPath: string;
    }
  | {
      rowType: "folder";
      rowId: string;
      path: string;
      name: string;
      entry?: TEntry;
      isSynthetic: boolean;
    }
  | {
      rowType: "entry";
      rowId: string;
      path: string;
      name: string;
      entry: TEntry;
    };

export type BuildHierarchicalRowsOptions<TEntry> = {
  entries: readonly TEntry[];
  getPath: (entry: TEntry) => string;
  isFolderEntry: (entry: TEntry) => boolean;
  currentFolder?: string | null;
  mode?: HierarchicalTableMode;
  searchQuery?: string | null;
  showParentRow?: boolean;
  parentRowName?: string;
  matchesSearch?: (entry: TEntry, normalizedPath: string, normalizedQuery: string) => boolean;
};

export type HierarchicalTableSelectionState = {
  selectedPaths: ReadonlySet<string>;
  focusedPath?: string | null;
  anchorPath?: string | null;
};

export type HierarchicalTableSelectionResult = {
  selectedPaths: Set<string>;
  focusedPath: string;
  anchorPath: string;
};

export type HierarchicalTableFocusMoveResult = {
  rowIndex: number;
  focusedPath: string;
};

const PARENT_ROW_ID_PREFIX = "parent:";
const FOLDER_ROW_ID_PREFIX = "folder:";
const ENTRY_ROW_ID_PREFIX = "entry:";
const DEFAULT_PARENT_ROW_NAME = "..";

export function parentHierarchicalRowId(currentFolderPath: string): string {
  return `${PARENT_ROW_ID_PREFIX}${normalizeArchivePath(currentFolderPath)}`;
}

export function folderHierarchicalRowId(path: string): string {
  return `${FOLDER_ROW_ID_PREFIX}${normalizeArchivePath(path)}`;
}

export function entryHierarchicalRowId(path: string): string {
  return `${ENTRY_ROW_ID_PREFIX}${normalizeArchivePath(path)}`;
}

export function buildHierarchicalRows<TEntry>(
  options: BuildHierarchicalRowsOptions<TEntry>,
): HierarchicalTableRow<TEntry>[] {
  const mode = options.mode ?? "folder";
  const query = normalizeSearchQuery(options.searchQuery);

  if (mode === "search") {
    return buildDirectRows(
      options.entries.filter((entry) => {
        const path = normalizeArchivePath(options.getPath(entry));
        return Boolean(path) && defaultMatchesSearch(options, entry, path, query);
      }),
      options,
    );
  }

  if (mode === "flat") {
    return buildDirectRows(options.entries, options);
  }

  return buildCurrentFolderRows(options);
}

export function isSelectableHierarchicalRow<TEntry>(
  row: HierarchicalTableRow<TEntry>,
): row is Extract<HierarchicalTableRow<TEntry>, { rowType: "folder" | "entry" }> {
  return row.rowType === "folder" || row.rowType === "entry";
}

export function selectableHierarchicalRowPaths<TEntry>(
  rows: readonly HierarchicalTableRow<TEntry>[],
): string[] {
  return rows
    .filter(isSelectableHierarchicalRow)
    .map((row) => row.path);
}

export function applyHierarchicalRowSelectionIntent(intent: {
  path: string;
  visiblePaths: readonly string[];
  currentSelection: ReadonlySet<string>;
  anchorPath?: string | null;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): HierarchicalTableSelectionResult {
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
      focusedPath: intent.path,
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
      focusedPath: intent.path,
      anchorPath: intent.path,
    };
  }

  return replaceHierarchicalTableSelection({ paths: [intent.path], focusedPath: intent.path });
}

export function selectAllVisibleHierarchicalRows(
  visiblePaths: readonly string[],
): HierarchicalTableSelectionResult {
  const firstPath = visiblePaths[0] ?? "";
  return {
    selectedPaths: new Set(visiblePaths),
    focusedPath: firstPath,
    anchorPath: firstPath,
  };
}

export function invertVisibleHierarchicalSelection(input: {
  currentSelection: ReadonlySet<string>;
  visiblePaths: readonly string[];
}): HierarchicalTableSelectionResult {
  const selectedPaths = new Set(input.currentSelection);
  for (const path of input.visiblePaths) {
    if (selectedPaths.has(path)) {
      selectedPaths.delete(path);
    } else {
      selectedPaths.add(path);
    }
  }

  const firstPath = input.visiblePaths[0] ?? "";
  return {
    selectedPaths,
    focusedPath: firstPath,
    anchorPath: firstPath,
  };
}

export function cleanupHierarchicalTableSelection(input: HierarchicalTableSelectionState & {
  visiblePaths: readonly string[];
  preserveHiddenSelection?: boolean;
}): HierarchicalTableSelectionResult {
  const visiblePaths = new Set(input.visiblePaths);
  const selectedPaths = input.preserveHiddenSelection
    ? new Set(input.selectedPaths)
    : new Set([...input.selectedPaths].filter((path) => visiblePaths.has(path)));
  const focusedPath = input.focusedPath && visiblePaths.has(input.focusedPath)
    ? input.focusedPath
    : "";
  const visibleSelectedPath = [...selectedPaths].find((path) => visiblePaths.has(path)) ?? "";
  const anchorPath = input.anchorPath && visiblePaths.has(input.anchorPath)
    ? input.anchorPath
    : focusedPath || visibleSelectedPath;

  return {
    selectedPaths,
    focusedPath,
    anchorPath,
  };
}

export function focusHierarchicalTablePath(
  state: HierarchicalTableSelectionState,
  focusedPath: string,
): HierarchicalTableSelectionResult {
  return {
    selectedPaths: new Set(state.selectedPaths),
    focusedPath,
    anchorPath: state.anchorPath ?? "",
  };
}

export function moveHierarchicalTableFocus<TEntry>(input: {
  rows: readonly HierarchicalTableRow<TEntry>[];
  currentIndex: number;
  direction: 1 | -1;
}): HierarchicalTableFocusMoveResult {
  if (input.rows.length === 0 || input.currentIndex < 0) {
    return {
      rowIndex: -1,
      focusedPath: "",
    };
  }

  const nextIndex = Math.max(0, Math.min(input.rows.length - 1, input.currentIndex + input.direction));
  const row = input.rows[nextIndex];
  return {
    rowIndex: nextIndex,
    focusedPath: row && isSelectableHierarchicalRow(row) ? row.path : "",
  };
}

export function toggleHierarchicalTablePathSelection(
  state: HierarchicalTableSelectionState & { path: string },
): HierarchicalTableSelectionResult {
  const selectedPaths = new Set(state.selectedPaths);
  if (selectedPaths.has(state.path)) {
    selectedPaths.delete(state.path);
  } else {
    selectedPaths.add(state.path);
  }

  return {
    selectedPaths,
    focusedPath: state.path,
    anchorPath: state.path,
  };
}

export function setHierarchicalTablePathSelected(input: HierarchicalTableSelectionState & {
  path: string;
  selected: boolean;
}): HierarchicalTableSelectionResult {
  const selectedPaths = new Set(input.selectedPaths);
  if (input.selected) {
    selectedPaths.add(input.path);
  } else {
    selectedPaths.delete(input.path);
  }

  return {
    selectedPaths,
    focusedPath: input.path,
    anchorPath: input.path,
  };
}

export function ensureHierarchicalTablePathSelected(input: HierarchicalTableSelectionState & {
  path: string;
  focusSelectedPath?: boolean;
}): HierarchicalTableSelectionResult {
  if (input.selectedPaths.has(input.path)) {
    return {
      selectedPaths: new Set(input.selectedPaths),
      focusedPath: input.focusSelectedPath ? input.path : input.focusedPath ?? "",
      anchorPath: input.anchorPath ?? "",
    };
  }

  return replaceHierarchicalTableSelection({ paths: [input.path], focusedPath: input.path });
}

export function replaceHierarchicalTableSelection(input: {
  paths: readonly string[];
  focusedPath?: string | null;
  anchorPath?: string | null;
}): HierarchicalTableSelectionResult {
  const selectedPaths = new Set(input.paths);
  const focusedPath = input.focusedPath ?? selectedPaths.values().next().value ?? "";
  return {
    selectedPaths,
    focusedPath,
    anchorPath: input.anchorPath ?? focusedPath,
  };
}

export function clearHierarchicalTableSelection(): HierarchicalTableSelectionResult {
  return {
    selectedPaths: new Set(),
    focusedPath: "",
    anchorPath: "",
  };
}

export function applyHierarchicalMarqueeSelection(input: {
  hitPaths: readonly string[];
  visiblePaths: readonly string[];
  baseSelection: ReadonlySet<string>;
  additive?: boolean;
}): HierarchicalTableSelectionResult {
  const selectedPaths = input.additive ? new Set(input.baseSelection) : new Set<string>();
  for (const path of input.hitPaths) {
    selectedPaths.add(path);
  }

  const focusedPath = [...input.visiblePaths]
    .reverse()
    .find((path) => selectedPaths.has(path)) ?? "";
  return {
    selectedPaths,
    focusedPath,
    anchorPath: focusedPath,
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

function buildDirectRows<TEntry>(
  entries: readonly TEntry[],
  options: BuildHierarchicalRowsOptions<TEntry>,
): HierarchicalTableRow<TEntry>[] {
  return entries.flatMap((entry) => {
    const path = normalizeArchivePath(options.getPath(entry));
    if (!path) {
      return [];
    }
    return [directRowForEntry(entry, path, options.isFolderEntry(entry))];
  });
}

function buildCurrentFolderRows<TEntry>(
  options: BuildHierarchicalRowsOptions<TEntry>,
): HierarchicalTableRow<TEntry>[] {
  const currentFolder = normalizeArchivePath(options.currentFolder);
  const rows: HierarchicalTableRow<TEntry>[] = [];
  const folderRows = new Map<string, Extract<HierarchicalTableRow<TEntry>, { rowType: "folder" }>>();
  const entryRows: Array<Extract<HierarchicalTableRow<TEntry>, { rowType: "entry" }>> = [];

  if (currentFolder && options.showParentRow) {
    rows.push({
      rowType: "parent",
      rowId: parentHierarchicalRowId(currentFolder),
      path: getParentArchivePath(currentFolder) ?? "",
      name: options.parentRowName ?? DEFAULT_PARENT_ROW_NAME,
      currentFolderPath: currentFolder,
    });
  }

  for (const entry of options.entries) {
    const entryPath = normalizeArchivePath(options.getPath(entry));
    if (!entryPath) {
      continue;
    }

    const relativePath = getArchivePathRelativeToFolder(entryPath, currentFolder);
    if (relativePath === null || relativePath === "") {
      continue;
    }

    const segments = splitArchivePath(relativePath);
    const childName = segments[0];
    if (!childName) {
      continue;
    }

    const isFolder = options.isFolderEntry(entry);
    if (segments.length > 1 || isFolder) {
      const childPath = joinArchivePath(currentFolder, childName);
      upsertFolderRow(folderRows, {
        path: childPath,
        name: childName,
        entry: isFolder && childPath === entryPath ? entry : undefined,
      });
      continue;
    }

    entryRows.push({
      rowType: "entry",
      rowId: entryHierarchicalRowId(entryPath),
      path: entryPath,
      name: childName,
      entry,
    });
  }

  return [...rows, ...folderRows.values(), ...entryRows];
}

function directRowForEntry<TEntry>(
  entry: TEntry,
  path: string,
  isFolder: boolean,
): Extract<HierarchicalTableRow<TEntry>, { rowType: "folder" | "entry" }> {
  const name = getArchiveEntryName(path) || path;
  if (isFolder) {
    return {
      rowType: "folder",
      rowId: folderHierarchicalRowId(path),
      path,
      name,
      entry,
      isSynthetic: false,
    };
  }

  return {
    rowType: "entry",
    rowId: entryHierarchicalRowId(path),
    path,
    name,
    entry,
  };
}

function upsertFolderRow<TEntry>(
  rows: Map<string, Extract<HierarchicalTableRow<TEntry>, { rowType: "folder" }>>,
  input: {
    path: string;
    name: string;
    entry?: TEntry;
  },
): void {
  const existing = rows.get(input.path);
  rows.set(input.path, {
    rowType: "folder",
    rowId: folderHierarchicalRowId(input.path),
    path: input.path,
    name: input.name,
    entry: input.entry ?? existing?.entry,
    isSynthetic: !input.entry && !existing?.entry,
  });
}

function defaultMatchesSearch<TEntry>(
  options: BuildHierarchicalRowsOptions<TEntry>,
  entry: TEntry,
  normalizedPath: string,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return options.matchesSearch?.(entry, normalizedPath, normalizedQuery)
    ?? normalizedPath.toLowerCase().includes(normalizedQuery);
}

function normalizeSearchQuery(query?: string | null): string {
  return query?.trim().toLowerCase() ?? "";
}
