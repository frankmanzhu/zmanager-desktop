import type {
  ArchiveEntryDto,
  ArchiveListingDto,
  BrowseState,
  CommandErrorDto,
  NativeFileDragRequest,
  PreviewEntryRequest,
  StartExtractRequest,
  TestArchiveRequest,
} from "../../api/types";
import {
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
} from "../constants";
import {
  buildStartExtractRequest,
  type ExtractMode,
} from "../extractFlow";
import {
  buildArchiveBrowserRows,
  sortArchiveRows,
  type ArchiveSortKey,
  type ArchiveTableRow,
} from "../archiveTable";
import {
  type ArchiveBreadcrumb,
  getArchiveEntryName,
  archiveFolderExists,
  getArchiveBreadcrumbs,
  getParentArchivePath,
  normalizeArchivePath,
} from "../archiveTree";
import {
  clearHierarchicalTableSelection,
  replaceHierarchicalTableSelection,
  selectableHierarchicalRowPaths,
  type HierarchicalTableSelectionResult,
} from "../hierarchicalTable";

export type ArchiveWorkspaceSortState = {
  key: ArchiveSortKey;
  ascending: boolean;
};

export type ArchiveWorkspaceRowOptions = {
  showParentFolderItem: boolean;
};

export type SelectableArchiveWorkspaceRow = Extract<
  ArchiveTableRow,
  { rowType: "folder" | "entry" }
>;

export type ArchiveWorkspaceSelectionSnapshot = {
  selectedPaths: readonly string[];
  selectedCount: number;
  focusedPath: string;
  anchorPath: string;
  visibleSelectablePaths: readonly string[];
  visibleSelectedPaths: readonly string[];
  visibleSelectedRows: readonly SelectableArchiveWorkspaceRow[];
  visibleSelectedCount: number;
  selectedEntries: readonly ArchiveEntryDto[];
  selectedEntryPaths: readonly string[];
  visibleSelectedEntries: readonly ArchiveEntryDto[];
  focusedEntry: ArchiveEntryDto | null;
  visibleSelectedSize: number;
  hiddenBySearch: boolean;
  firstSelectedEntryPath: string;
  firstSelectedEntryName: string;
};

export type ArchiveWorkspaceDetailsModel =
  | { kind: "noArchive" }
  | {
      kind: "hiddenSelection";
      selectedCount: number;
      searchQuery: string;
      firstSelectedEntryPath: string;
      firstSelectedEntryName: string;
    }
  | {
      kind: "archiveSummary";
      archivePath: string;
      entryCount: number;
      currentFolder: string;
      unpackedSize: number | null;
      packedSize: number | null;
    }
  | {
      kind: "syntheticFolder";
      row: SelectableArchiveWorkspaceRow;
    }
  | {
      kind: "entry";
      entry: ArchiveEntryDto;
    }
  | {
      kind: "multipleSelection";
      selectedCount: number;
      selectedFiles: number;
      selectedFolders: number;
      totalSize: number | null;
      packedSize: number | null;
      pathPreviewPaths: readonly string[];
      rows: readonly SelectableArchiveWorkspaceRow[];
    };

export type ArchiveWorkspaceCommandSnapshot = {
  browseState: BrowseState;
  hasArchive: boolean;
  focusedRow: boolean;
  canNavigateUp: boolean;
  canOpenInside: boolean;
  selectedCount: number;
  visibleSelectableCount: number;
  canUseArchive: boolean;
  canListEntries: boolean;
  canSearchEntries: boolean;
  canNavigateBack: boolean;
};

export type ArchiveWorkspacePasswordRetryOperation =
  | "listArchive"
  | "testArchive"
  | "previewEntry"
  | "openOutsideEntry"
  | "nativeDragOut"
  | "extractArchive"
  | "extractSelection";

export type ArchiveWorkspacePasswordPromptKey =
  | "browse.passwordRequired"
  | "browse.passwordInvalid";

export type ArchiveWorkspacePasswordRetry = {
  operation: ArchiveWorkspacePasswordRetryOperation;
  archivePath: string;
  commandCode: typeof COMMAND_PASSWORD_REQUIRED | typeof COMMAND_INVALID_PASSWORD;
  promptKey: ArchiveWorkspacePasswordPromptKey;
  attemptCount: number;
};

export type ArchiveWorkspaceExtractUnavailableReason =
  | "noArchive"
  | "noSelectedEntries";

export type ArchiveWorkspaceTestUnavailableReason = "noArchive";

export type ArchiveWorkspacePreviewUnavailableReason =
  | "noArchive"
  | "singleFileRequired"
  | "directorySelected";

export type ArchiveWorkspaceNativeDragUnavailableReason =
  | "noArchive"
  | "noEntryPaths";

export type ArchiveWorkspaceRequestResult<TRequest, TReason extends string> =
  | { ok: true; request: TRequest }
  | { ok: false; reason: TReason };

export type BuildArchiveWorkspaceExtractRequestInput = {
  mode: ExtractMode;
  destinationPath: string;
  overwrite: StartExtractRequest["overwrite"];
  destinationCollisionStrategy?: StartExtractRequest["destinationCollisionStrategy"];
  stripComponents: number;
  password?: string;
};

export type BuildArchiveWorkspaceTestRequestInput = {
  password?: string;
};

export type BuildArchiveWorkspacePreviewRequestInput = {
  overwrite: PreviewEntryRequest["overwrite"];
  stripComponents: number;
  password?: string;
};

export type BuildArchiveWorkspaceNativeDragRequestInput = {
  entryPath: string;
  password?: string;
};

export type ArchiveWorkspaceMessageKey =
  | "browse.statusIdle"
  | "browse.statusLoading"
  | "browse.loadedEntries"
  | "browse.validEmpty"
  | "browse.failedList";

export type ArchiveWorkspaceMessagePayload = {
  key: ArchiveWorkspaceMessageKey;
  values?: Record<string, number | string>;
  fallbackText?: string;
};

export type ArchiveWorkspaceError = {
  code?: string;
  message?: string;
  messageKey?: ArchiveWorkspaceMessageKey;
  hint?: string | null;
  severity: CommandErrorDto["severity"];
  retryable: boolean;
};

export type ArchiveWorkspaceListingMetadata = {
  entryCount: number;
  totalSize: number | null;
};

export type ArchiveWorkspaceViewState = {
  currentFolder: string;
  breadcrumbs: readonly ArchiveBreadcrumb[];
  navigationHistory: readonly string[];
  searchQuery: string;
  flatView: boolean;
  expandedTreeFolders: readonly string[];
  sort: ArchiveWorkspaceSortState;
  rowOptions: ArchiveWorkspaceRowOptions;
  rows: readonly ArchiveTableRow[];
  selection: ArchiveWorkspaceSelectionSnapshot;
  details: ArchiveWorkspaceDetailsModel;
};

export type ArchiveWorkspaceSnapshot = ArchiveWorkspaceListingMetadata & {
  currentArchivePath: string;
  browseState: BrowseState;
  status: ArchiveWorkspaceMessagePayload;
  error: ArchiveWorkspaceError | null;
  passwordRetry: ArchiveWorkspacePasswordRetry | null;
  entries: readonly ArchiveEntryDto[];
  listingRevision: number;
  command: ArchiveWorkspaceCommandSnapshot;
  view: ArchiveWorkspaceViewState;
};

export type BeginArchiveLoadInput = {
  archivePath: string;
  preserveListing?: boolean;
};

export type ArchiveWorkspaceUnknownLoadFailure = {
  kind: "unknown";
};

export type ArchiveWorkspacePreserveStateInput = {
  currentFolder?: string | null;
  navigationHistory?: readonly string[];
  searchQuery?: string | null;
  flatView?: boolean;
  expandedTreeFolders?: readonly string[];
  selectedPaths?: readonly string[];
  focusedPath?: string | null;
  anchorPath?: string | null;
  showParentFolderItem?: boolean;
  sortKey?: ArchiveSortKey;
  sortAscending?: boolean;
};

export type ArchiveLoadSucceededOptions = {
  preserveState?: ArchiveWorkspacePreserveStateInput | false;
};

export type ArchiveWorkspace = {
  getSnapshot(): ArchiveWorkspaceSnapshot;
  beginLoading(input: BeginArchiveLoadInput): ArchiveWorkspaceSnapshot;
  loadSucceeded(
    listing: ArchiveListingDto,
    options?: ArchiveLoadSucceededOptions,
  ): ArchiveWorkspaceSnapshot;
  loadFailed(error: CommandErrorDto | ArchiveWorkspaceUnknownLoadFailure): ArchiveWorkspaceSnapshot;
  setBrowseState(browseState: BrowseState): ArchiveWorkspaceSnapshot;
  navigateToFolder(folderPath: string): ArchiveWorkspaceSnapshot;
  navigateBack(): ArchiveWorkspaceSnapshot;
  navigateUp(): ArchiveWorkspaceSnapshot;
  setSearchQuery(query: string): ArchiveWorkspaceSnapshot;
  clearSearch(): ArchiveWorkspaceSnapshot;
  setFlatView(flatView: boolean): ArchiveWorkspaceSnapshot;
  setRowOptions(options: Partial<ArchiveWorkspaceRowOptions>): ArchiveWorkspaceSnapshot;
  applySortCommand(sortKey: ArchiveSortKey): ArchiveWorkspaceSnapshot;
  applySortDirection(sortKey: ArchiveSortKey, ascending: boolean): ArchiveWorkspaceSnapshot;
  getSelectedExtractEntryPaths(): readonly string[];
  getExtractReferencePaths(mode: ExtractMode): readonly string[];
  buildExtractRequest(
    input: BuildArchiveWorkspaceExtractRequestInput,
  ): ArchiveWorkspaceRequestResult<StartExtractRequest, ArchiveWorkspaceExtractUnavailableReason>;
  buildTestRequest(
    input?: BuildArchiveWorkspaceTestRequestInput,
  ): ArchiveWorkspaceRequestResult<TestArchiveRequest, ArchiveWorkspaceTestUnavailableReason>;
  buildPreviewRequest(
    input: BuildArchiveWorkspacePreviewRequestInput,
  ): ArchiveWorkspaceRequestResult<PreviewEntryRequest, ArchiveWorkspacePreviewUnavailableReason>;
  buildNativeDragRequest(
    input: BuildArchiveWorkspaceNativeDragRequestInput,
  ): ArchiveWorkspaceRequestResult<NativeFileDragRequest, ArchiveWorkspaceNativeDragUnavailableReason>;
  requestPasswordRetry(input: {
    operation: ArchiveWorkspacePasswordRetryOperation;
    error: CommandErrorDto | null | undefined;
  }): ArchiveWorkspacePasswordRetry | null;
  clearPasswordRetry(): ArchiveWorkspaceSnapshot;
  toggleTreeFolder(folderPath: string): ArchiveWorkspaceSnapshot;
  updateSelection(selection: HierarchicalTableSelectionResult): ArchiveWorkspaceSnapshot;
  reset(): ArchiveWorkspaceSnapshot;
};

export type CreateArchiveWorkspaceOptions = {
  flatView?: boolean;
  showParentFolderItem?: boolean;
  sortKey?: ArchiveSortKey;
  sortAscending?: boolean;
};

type MutableArchiveWorkspaceState = Omit<ArchiveWorkspaceSnapshot, "command" | "entries" | "view"> & {
  entries: ArchiveEntryDto[];
  view: {
    currentFolder: string;
    navigationHistory: string[];
    searchQuery: string;
    flatView: boolean;
    expandedTreeFolders: string[];
    sort: ArchiveWorkspaceSortState;
    rowOptions: ArchiveWorkspaceRowOptions;
    selection: {
      selectedPaths: string[];
      focusedPath: string;
      anchorPath: string;
    };
  };
};

export function createArchiveWorkspace(options: CreateArchiveWorkspaceOptions = {}): ArchiveWorkspace {
  let state = createInitialState(options);

  return {
    getSnapshot() {
      return snapshotFromState(state);
    },

    beginLoading(input) {
      const archivePath = input.archivePath.trim();
      state = {
        ...state,
        currentArchivePath: archivePath,
        browseState: "loading",
        status: { key: "browse.statusLoading" },
        error: null,
        passwordRetry: retryForArchivePath(state.passwordRetry, archivePath),
        ...(input.preserveListing
          ? {}
          : {
              entries: [],
              entryCount: 0,
              totalSize: null,
              view: resetViewState({
                flatView: state.view.flatView,
                sort: state.view.sort,
                rowOptions: state.view.rowOptions,
              }),
            }),
      };
      return snapshotFromState(state);
    },

    loadSucceeded(listing, options = {}) {
      const entries = cloneEntries(listing.entries);
      const metadata = normalizeListingMetadata(listing, entries.length);
      const view = restoreViewState(entries, options.preserveState, {
        flatView: state.view.flatView,
        sort: state.view.sort,
        rowOptions: state.view.rowOptions,
      });
      state = {
        currentArchivePath: listing.archivePath.trim(),
        browseState: entries.length > 0 ? "loaded" : "empty",
        status: entries.length > 0
          ? { key: "browse.loadedEntries", values: { count: entries.length } }
          : { key: "browse.validEmpty" },
        error: null,
        passwordRetry: null,
        entries,
        listingRevision: state.listingRevision + 1,
        ...metadata,
        view,
      };
      return snapshotFromState(state);
    },

    loadFailed(error) {
      const normalizedError = normalizeLoadError(error);
      const fallbackText = errorMessageText(normalizedError);
      state = {
        ...state,
        browseState: "error",
        status: {
          key: "browse.failedList",
          ...(fallbackText ? { fallbackText } : {}),
        },
        error: normalizedError,
        passwordRetry: null,
      };
      return snapshotFromState(state);
    },

    setBrowseState(browseState) {
      state = {
        ...state,
        browseState,
        status: statusForBrowseState(state, browseState),
        error: browseState === "error" ? state.error : null,
        passwordRetry: browseState === "error" ? null : state.passwordRetry,
      };
      return snapshotFromState(state);
    },

    navigateToFolder(folderPath) {
      state = navigateStateToFolder(state, folderPath, {
        pushHistory: true,
        clearSearch: true,
      });
      return snapshotFromState(state);
    },

    navigateBack() {
      const navigationHistory = [...state.view.navigationHistory];
      const previousFolder = navigationHistory.pop();
      if (previousFolder === undefined) {
        return snapshotFromState(state);
      }

      const currentFolder = normalizeExistingFolderPath(state.entries, previousFolder);
      state = {
        ...state,
        view: {
          ...state.view,
          currentFolder,
          navigationHistory,
          expandedTreeFolders: expandedFolderAndAncestors(
            state.view.expandedTreeFolders,
            currentFolder,
          ),
          selection: selectionFromResult(clearHierarchicalTableSelection()),
        },
      };
      return snapshotFromState(state);
    },

    navigateUp() {
      if (!state.view.currentFolder) {
        return snapshotFromState(state);
      }
      state = navigateStateToFolder(state, getParentArchivePath(state.view.currentFolder) ?? "", {
        pushHistory: true,
        clearSearch: true,
      });
      return snapshotFromState(state);
    },

    setSearchQuery(query) {
      state = {
        ...state,
        view: {
          ...state.view,
          searchQuery: query,
        },
      };
      return snapshotFromState(state);
    },

    clearSearch() {
      if (!state.view.searchQuery.trim()) {
        return snapshotFromState(state);
      }
      state = {
        ...state,
        view: {
          ...state.view,
          searchQuery: "",
        },
      };
      return snapshotFromState(state);
    },

    setFlatView(flatView) {
      state = {
        ...state,
        view: {
          ...state.view,
          flatView,
        },
      };
      return snapshotFromState(state);
    },

    setRowOptions(options) {
      state = {
        ...state,
        view: {
          ...state.view,
          rowOptions: {
            ...state.view.rowOptions,
            ...options,
          },
        },
      };
      return snapshotFromState(state);
    },

    applySortCommand(sortKey) {
      state = {
        ...state,
        view: {
          ...state.view,
          sort: sortKey === state.view.sort.key
            ? {
                key: state.view.sort.key,
                ascending: !state.view.sort.ascending,
              }
            : {
                key: sortKey,
                ascending: true,
              },
        },
      };
      return snapshotFromState(state);
    },

    applySortDirection(sortKey, ascending) {
      state = {
        ...state,
        view: {
          ...state.view,
          sort: {
            key: sortKey,
            ascending,
          },
        },
      };
      return snapshotFromState(state);
    },

    getSelectedExtractEntryPaths() {
      return selectedExtractEntryPaths(state);
    },

    getExtractReferencePaths(mode) {
      return mode === "selection"
        ? selectedExtractEntryPaths(state)
        : state.entries.map((entry) => entry.path);
    },

    buildExtractRequest(input) {
      if (!state.currentArchivePath) {
        return { ok: false, reason: "noArchive" };
      }

      const entryPaths = input.mode === "selection"
        ? selectedExtractEntryPaths(state)
        : [];
      if (input.mode === "selection" && entryPaths.length === 0) {
        return { ok: false, reason: "noSelectedEntries" };
      }

      return {
        ok: true,
        request: buildStartExtractRequest({
          archivePath: state.currentArchivePath,
          destinationPath: input.destinationPath,
          overwrite: input.overwrite,
          ...(input.destinationCollisionStrategy
            ? { destinationCollisionStrategy: input.destinationCollisionStrategy }
            : {}),
          ...(input.mode === "selection" ? { entryPaths } : {}),
          stripComponents: input.stripComponents,
          ...(input.password ? { password: input.password } : {}),
        }),
      };
    },

    buildTestRequest(input = {}) {
      if (!state.currentArchivePath) {
        return { ok: false, reason: "noArchive" };
      }

      const entryPaths = selectedExtractEntryPaths(state);
      return {
        ok: true,
        request: {
          archivePath: state.currentArchivePath,
          ...(entryPaths.length ? { entryPaths } : {}),
          ...(input.password ? { password: input.password } : {}),
        },
      };
    },

    buildPreviewRequest(input) {
      if (!state.currentArchivePath) {
        return { ok: false, reason: "noArchive" };
      }

      const selectedPaths = [...state.view.selection.selectedPaths];
      if (selectedPaths.length !== 1) {
        return { ok: false, reason: "singleFileRequired" };
      }

      const entry = entryByPath(state.entries, selectedPaths[0]);
      if (!entry || entry.kind === "directory") {
        return { ok: false, reason: "directorySelected" };
      }

      return {
        ok: true,
        request: {
          archivePath: state.currentArchivePath,
          entryPath: entry.path,
          overwrite: input.overwrite,
          stripComponents: input.stripComponents,
          ...(input.password ? { password: input.password } : {}),
        },
      };
    },

    buildNativeDragRequest(input) {
      if (!state.currentArchivePath) {
        return { ok: false, reason: "noArchive" };
      }

      const entryPaths = nativeDragEntryPaths(state, input.entryPath);
      if (entryPaths.length === 0) {
        return { ok: false, reason: "noEntryPaths" };
      }

      return {
        ok: true,
        request: {
          archivePath: state.currentArchivePath,
          entryPaths,
          stripComponents: nativeDragStripComponents(state),
          ...(input.password ? { password: input.password } : {}),
        },
      };
    },

    requestPasswordRetry(input) {
      const nextPasswordRetry = passwordRetryForCommandError({
        operation: input.operation,
        archivePath: state.currentArchivePath,
        error: input.error,
        previous: state.passwordRetry,
      });
      state = {
        ...state,
        passwordRetry: nextPasswordRetry,
      };
      return clonePasswordRetry(nextPasswordRetry);
    },

    clearPasswordRetry() {
      if (!state.passwordRetry) {
        return snapshotFromState(state);
      }
      state = {
        ...state,
        passwordRetry: null,
      };
      return snapshotFromState(state);
    },

    toggleTreeFolder(folderPath) {
      const normalizedFolder = normalizeArchivePath(folderPath);
      if (!normalizedFolder) {
        return snapshotFromState(state);
      }

      const expandedTreeFolders = new Set(state.view.expandedTreeFolders);
      if (expandedTreeFolders.has(normalizedFolder)) {
        expandedTreeFolders.delete(normalizedFolder);
      } else {
        expandedTreeFolders.add(normalizedFolder);
      }

      state = {
        ...state,
        view: {
          ...state.view,
          expandedTreeFolders: expandedFolderAndAncestors(
            [...expandedTreeFolders],
            state.view.currentFolder,
          ),
        },
      };
      return snapshotFromState(state);
    },

    updateSelection(selection) {
      state = {
        ...state,
        view: {
          ...state.view,
          selection: selectionFromResult(selection),
        },
      };
      return snapshotFromState(state);
    },

    reset() {
      state = createInitialState({
        flatView: state.view.flatView,
        showParentFolderItem: state.view.rowOptions.showParentFolderItem,
        sortKey: state.view.sort.key,
        sortAscending: state.view.sort.ascending,
      });
      return snapshotFromState(state);
    },
  };
}

function navigateStateToFolder(
  state: MutableArchiveWorkspaceState,
  folderPath: string,
  options: { pushHistory: boolean; clearSearch: boolean },
): MutableArchiveWorkspaceState {
  const nextFolder = normalizeExistingFolderPath(state.entries, folderPath);
  if (nextFolder === state.view.currentFolder) {
    return state;
  }

  return {
    ...state,
    view: {
      ...state.view,
      currentFolder: nextFolder,
      navigationHistory: options.pushHistory
        ? [...state.view.navigationHistory, state.view.currentFolder]
        : state.view.navigationHistory,
      searchQuery: options.clearSearch ? "" : state.view.searchQuery,
      expandedTreeFolders: expandedFolderAndAncestors(
        state.view.expandedTreeFolders,
        nextFolder,
      ),
      selection: selectionFromResult(clearHierarchicalTableSelection()),
    },
  };
}

function createInitialState(
  options: CreateArchiveWorkspaceOptions = {},
): MutableArchiveWorkspaceState {
  return {
    currentArchivePath: "",
    browseState: "idle",
    status: { key: "browse.statusIdle" },
    error: null,
    passwordRetry: null,
    entries: [],
    entryCount: 0,
    totalSize: null,
    listingRevision: 0,
    view: resetViewState({
      flatView: options.flatView,
      sort: normalizeSortState({
        key: options.sortKey,
        ascending: options.sortAscending,
      }),
      rowOptions: normalizeRowOptions(options),
    }),
  };
}

function resetViewState(
  options: {
    flatView?: boolean;
    sort?: ArchiveWorkspaceSortState;
    rowOptions?: Partial<ArchiveWorkspaceRowOptions>;
  } = {},
): MutableArchiveWorkspaceState["view"] {
  return {
    currentFolder: "",
    navigationHistory: [],
    searchQuery: "",
    flatView: options.flatView ?? false,
    expandedTreeFolders: [""],
    sort: normalizeSortState(options.sort),
    rowOptions: normalizeRowOptions(options.rowOptions),
    selection: {
      selectedPaths: [],
      focusedPath: "",
      anchorPath: "",
    },
  };
}

function restoreViewState(
  entries: readonly ArchiveEntryDto[],
  preserveState: ArchiveWorkspacePreserveStateInput | false | undefined,
  defaults: {
    flatView: boolean;
    sort: ArchiveWorkspaceSortState;
    rowOptions: ArchiveWorkspaceRowOptions;
  },
): MutableArchiveWorkspaceState["view"] {
  if (!preserveState) {
    return resetViewState({
      flatView: defaults.flatView,
      sort: defaults.sort,
      rowOptions: defaults.rowOptions,
    });
  }

  const currentFolder = archiveFolderExists(entries, preserveState.currentFolder)
    ? normalizeArchivePath(preserveState.currentFolder)
    : "";
  const searchQuery = preserveState.searchQuery ?? "";
  const flatView = preserveState.flatView ?? false;
  const sort = normalizeSortState({
    key: preserveState.sortKey ?? defaults.sort.key,
    ascending: preserveState.sortAscending ?? defaults.sort.ascending,
  });
  const rowOptions = normalizeRowOptions({
    showParentFolderItem: preserveState.showParentFolderItem
      ?? defaults.rowOptions.showParentFolderItem,
  });
  const navigationHistory = (preserveState.navigationHistory ?? [])
    .map((folder) => normalizeArchivePath(folder));
  const listedPaths = new Set(entries.map((entry) => normalizeArchivePath(entry.path)));
  const selectedPaths = (preserveState.selectedPaths ?? [])
    .map((path) => normalizeArchivePath(path))
    .filter((path) => Boolean(path) && (listedPaths.has(path) || archiveFolderExists(entries, path)));
  const visiblePaths = selectableHierarchicalRowPaths(buildArchiveBrowserRows({
    entries,
    currentFolder,
    searchQuery,
    flatView,
    showParentFolderItem: rowOptions.showParentFolderItem,
  }));
  const preservedFocusedPath = normalizeArchivePath(preserveState.focusedPath);
  const focusedEntryStillVisible = Boolean(
    preservedFocusedPath && visiblePaths.includes(preservedFocusedPath),
  );
  const selection = focusedEntryStillVisible
    ? replaceHierarchicalTableSelection({
        paths: selectedPaths,
        focusedPath: preservedFocusedPath,
        anchorPath: normalizeArchivePath(preserveState.anchorPath)
          || (selectedPaths.includes(preservedFocusedPath) ? preservedFocusedPath : ""),
      })
    : replaceHierarchicalTableSelection({
        paths: selectedPaths,
        focusedPath: "",
        anchorPath: normalizeArchivePath(preserveState.anchorPath) || (selectedPaths[0] ?? ""),
      });

  return {
    currentFolder,
    navigationHistory,
    searchQuery,
    flatView,
    sort,
    rowOptions,
    expandedTreeFolders: expandedFolderAndAncestors(
      preserveState.expandedTreeFolders,
      currentFolder,
    ),
    selection: {
      selectedPaths: [...selection.selectedPaths],
      focusedPath: selection.focusedPath,
      anchorPath: selection.anchorPath,
    },
  };
}

function normalizeExistingFolderPath(
  entries: readonly ArchiveEntryDto[],
  folderPath: string | null | undefined,
): string {
  const normalized = normalizeArchivePath(folderPath);
  return archiveFolderExists(entries, normalized) ? normalized : "";
}

function expandedFolderAndAncestors(
  expandedFolders: readonly string[] | undefined,
  folderPath: string,
): string[] {
  const expanded = new Set(normalizeExpandedTreeFolders(expandedFolders));
  let current = normalizeArchivePath(folderPath);
  while (current) {
    expanded.add(current);
    current = getParentArchivePath(current) ?? "";
  }
  return normalizeExpandedTreeFolders([...expanded]);
}

function normalizeExpandedTreeFolders(
  expandedFolders: readonly string[] | undefined,
): string[] {
  const normalized = new Set<string>([""]);
  for (const folder of expandedFolders ?? []) {
    normalized.add(normalizeArchivePath(folder));
  }
  return [...normalized];
}

function normalizeSortState(
  sort?: Partial<ArchiveWorkspaceSortState> | null,
): ArchiveWorkspaceSortState {
  return {
    key: sort?.key ?? "name",
    ascending: sort?.ascending ?? true,
  };
}

function normalizeRowOptions(
  options?: Partial<ArchiveWorkspaceRowOptions> | null,
): ArchiveWorkspaceRowOptions {
  return {
    showParentFolderItem: options?.showParentFolderItem ?? false,
  };
}

function selectionFromResult(
  selection: HierarchicalTableSelectionResult,
): MutableArchiveWorkspaceState["view"]["selection"] {
  return {
    selectedPaths: normalizeSelectedPaths(selection.selectedPaths),
    focusedPath: normalizeArchivePath(selection.focusedPath),
    anchorPath: normalizeArchivePath(selection.anchorPath),
  };
}

function normalizeSelectedPaths(paths: Iterable<string>): string[] {
  const normalized = new Set<string>();
  for (const path of paths) {
    const normalizedPath = normalizeArchivePath(path);
    if (normalizedPath) {
      normalized.add(normalizedPath);
    }
  }
  return [...normalized];
}

function normalizeListingMetadata(
  listing: ArchiveListingDto,
  fallbackEntryCount: number,
): ArchiveWorkspaceListingMetadata {
  return {
    entryCount: Number.isFinite(listing.entryCount)
      ? listing.entryCount
      : fallbackEntryCount,
    totalSize: typeof listing.totalSize === "number" && Number.isFinite(listing.totalSize)
      ? listing.totalSize
      : null,
  };
}

function normalizeLoadError(error: CommandErrorDto | ArchiveWorkspaceUnknownLoadFailure): ArchiveWorkspaceError {
  if (isUnknownLoadFailure(error)) {
    return {
      code: "unknown",
      messageKey: "browse.failedList",
      severity: "error",
      retryable: false,
    };
  }

  return {
    code: error.code,
    message: error.message,
    hint: error.hint,
    severity: error.severity,
    retryable: error.retryable,
  };
}

function isUnknownLoadFailure(
  error: CommandErrorDto | ArchiveWorkspaceUnknownLoadFailure,
): error is ArchiveWorkspaceUnknownLoadFailure {
  return "kind" in error && error.kind === "unknown";
}

function errorMessageText(error: ArchiveWorkspaceError): string | undefined {
  if (!error.message) {
    return undefined;
  }
  return `${error.message}${error.hint ? `\n${error.hint}` : ""}`;
}

function statusForBrowseState(
  state: MutableArchiveWorkspaceState,
  browseState: BrowseState,
): ArchiveWorkspaceMessagePayload {
  switch (browseState) {
    case "idle":
      return { key: "browse.statusIdle" };
    case "loading":
      return { key: "browse.statusLoading" };
    case "empty":
      return { key: "browse.validEmpty" };
    case "error":
      return state.status.key === "browse.failedList"
        ? cloneStatus(state.status)
        : { key: "browse.failedList" };
    case "loaded":
      return state.status.key === "browse.loadedEntries"
        ? cloneStatus(state.status)
        : { key: "browse.loadedEntries", values: { count: state.entries.length } };
  }
}

function retryForArchivePath(
  retry: ArchiveWorkspacePasswordRetry | null,
  archivePath: string,
): ArchiveWorkspacePasswordRetry | null {
  return retry?.archivePath === archivePath ? { ...retry } : null;
}

function passwordRetryForCommandError(input: {
  operation: ArchiveWorkspacePasswordRetryOperation;
  archivePath: string;
  error: CommandErrorDto | null | undefined;
  previous: ArchiveWorkspacePasswordRetry | null;
}): ArchiveWorkspacePasswordRetry | null {
  if (!input.error || !isPasswordRetryCommandCode(input.error.code)) {
    return null;
  }

  const previousAttemptCount = input.previous
    && input.previous.operation === input.operation
    && input.previous.archivePath === input.archivePath
    ? input.previous.attemptCount
    : 0;

  return {
    operation: input.operation,
    archivePath: input.archivePath,
    commandCode: input.error.code,
    promptKey: passwordPromptKeyForCommandCode(input.error.code),
    attemptCount: previousAttemptCount + 1,
  };
}

function isPasswordRetryCommandCode(
  code: string | undefined,
): code is typeof COMMAND_PASSWORD_REQUIRED | typeof COMMAND_INVALID_PASSWORD {
  return code === COMMAND_PASSWORD_REQUIRED || code === COMMAND_INVALID_PASSWORD;
}

function passwordPromptKeyForCommandCode(
  code: typeof COMMAND_PASSWORD_REQUIRED | typeof COMMAND_INVALID_PASSWORD,
): ArchiveWorkspacePasswordPromptKey {
  return code === COMMAND_PASSWORD_REQUIRED
    ? "browse.passwordRequired"
    : "browse.passwordInvalid";
}

function visibleRowsForState(state: MutableArchiveWorkspaceState): ArchiveTableRow[] {
  return sortArchiveRows(buildArchiveBrowserRows({
    entries: state.entries,
    currentFolder: state.view.currentFolder,
    searchQuery: state.view.searchQuery,
    flatView: state.view.flatView,
    showParentFolderItem: state.view.rowOptions.showParentFolderItem,
  }), state.view.sort.key, state.view.sort.ascending);
}

function entryByPath(
  entries: readonly ArchiveEntryDto[],
  path: string | null | undefined,
): ArchiveEntryDto | null {
  const normalized = normalizeArchivePath(path);
  return entries.find((entry) => normalizeArchivePath(entry.path) === normalized) ?? null;
}

function archiveEntryIsUnderFolder(entryPath: string, folderPath: string): boolean {
  const normalizedEntry = normalizeArchivePath(entryPath);
  const normalizedFolder = normalizeArchivePath(folderPath);
  if (!normalizedFolder) {
    return true;
  }
  return normalizedEntry === normalizedFolder || normalizedEntry.startsWith(`${normalizedFolder}/`);
}

function fileDescendantEntryPaths(
  entries: readonly ArchiveEntryDto[],
  folderPath: string,
): string[] {
  return entries
    .filter((entry) => entry.kind !== "directory" && archiveEntryIsUnderFolder(entry.path, folderPath))
    .map((entry) => entry.path);
}

function selectedExtractEntryPaths(state: MutableArchiveWorkspaceState): string[] {
  const extractPaths = new Set<string>();

  for (const selectedPath of state.view.selection.selectedPaths) {
    const entry = entryByPath(state.entries, selectedPath);
    if (!entry) {
      for (const descendantPath of fileDescendantEntryPaths(state.entries, selectedPath)) {
        extractPaths.add(descendantPath);
      }
      continue;
    }

    if (entry.kind !== "directory") {
      extractPaths.add(entry.path);
      continue;
    }

    const descendantPaths = fileDescendantEntryPaths(state.entries, entry.path);
    if (descendantPaths.length === 0) {
      extractPaths.add(entry.path);
      continue;
    }

    for (const descendantPath of descendantPaths) {
      extractPaths.add(descendantPath);
    }
  }

  return [...extractPaths];
}

function archiveFolderHasFileDescendants(
  entries: readonly ArchiveEntryDto[],
  folderPath: string,
): boolean {
  return fileDescendantEntryPaths(entries, folderPath).length > 0;
}

function nativeDragEntryPaths(
  state: MutableArchiveWorkspaceState,
  entryPath: string,
): string[] {
  const normalizedEntryPath = normalizeArchivePath(entryPath);
  if (!normalizedEntryPath) {
    return [];
  }

  if (state.view.selection.selectedPaths.includes(normalizedEntryPath)) {
    return [...state.view.selection.selectedPaths];
  }

  const entry = entryByPath(state.entries, normalizedEntryPath);
  if (entry) {
    return [entry.path];
  }

  return archiveFolderHasFileDescendants(state.entries, normalizedEntryPath)
    ? [normalizedEntryPath]
    : [];
}

function nativeDragStripComponents(state: MutableArchiveWorkspaceState): number {
  if (state.view.flatView || state.view.searchQuery.trim() || !state.view.currentFolder) {
    return 0;
  }

  return normalizeArchivePath(state.view.currentFolder).split("/").filter(Boolean).length;
}

function isSelectableRow(row: ArchiveTableRow): row is SelectableArchiveWorkspaceRow {
  return row.rowType === "folder" || row.rowType === "entry";
}

function selectionSnapshotFromState(
  state: MutableArchiveWorkspaceState,
  rows: readonly ArchiveTableRow[],
): ArchiveWorkspaceSelectionSnapshot {
  const selectedPaths = [...state.view.selection.selectedPaths];
  const selectedPathSet = new Set(selectedPaths);
  const visibleSelectablePaths = selectableHierarchicalRowPaths(rows);
  const visibleSelectedRows = rows.filter((row): row is SelectableArchiveWorkspaceRow =>
    isSelectableRow(row) && selectedPathSet.has(row.path)
  );
  const visibleSelectedPaths = visibleSelectedRows.map((row) => row.path);
  const selectedEntries = selectedPaths
    .map((path) => entryByPath(state.entries, path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);
  const visibleSelectedEntries = visibleSelectedRows
    .map((row) => row.entry ?? entryByPath(state.entries, row.path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);
  const focusedPath = normalizeArchivePath(state.view.selection.focusedPath);
  const focusedEntry = focusedPath && visibleSelectablePaths.includes(focusedPath)
    ? entryByPath(state.entries, focusedPath)
    : null;
  const firstSelectedEntry = selectedEntries[0] ?? null;
  const firstSelectedEntryPath = firstSelectedEntry?.path ?? "";

  return {
    selectedPaths,
    selectedCount: selectedPaths.length,
    focusedPath,
    anchorPath: normalizeArchivePath(state.view.selection.anchorPath),
    visibleSelectablePaths,
    visibleSelectedPaths,
    visibleSelectedRows,
    visibleSelectedCount: visibleSelectedRows.length,
    selectedEntries,
    selectedEntryPaths: selectedEntries.map((entry) => entry.path),
    visibleSelectedEntries,
    focusedEntry,
    visibleSelectedSize: visibleSelectedRows.reduce((total, row) => {
      const value = row.entry?.size;
      return typeof value === "number" && Number.isFinite(value) ? total + value : total;
    }, 0),
    hiddenBySearch: selectedPaths.length > 0
      && visibleSelectedRows.length === 0
      && Boolean(state.view.searchQuery.trim()),
    firstSelectedEntryPath,
    firstSelectedEntryName: firstSelectedEntryPath
      ? getArchiveEntryName(firstSelectedEntryPath) || firstSelectedEntryPath
      : "",
  };
}

function detailsModelFromState(
  state: MutableArchiveWorkspaceState,
  selection: ArchiveWorkspaceSelectionSnapshot,
): ArchiveWorkspaceDetailsModel {
  if (!state.currentArchivePath) {
    return { kind: "noArchive" };
  }

  if (selection.hiddenBySearch) {
    return {
      kind: "hiddenSelection",
      selectedCount: selection.selectedCount,
      searchQuery: state.view.searchQuery.trim(),
      firstSelectedEntryPath: selection.firstSelectedEntryPath,
      firstSelectedEntryName: selection.firstSelectedEntryName,
    };
  }

  if (selection.visibleSelectedRows.length === 0) {
    return {
      kind: "archiveSummary",
      archivePath: state.currentArchivePath,
      entryCount: state.entryCount,
      currentFolder: state.view.currentFolder,
      unpackedSize: state.totalSize ?? sumKnownEntryBytes(state.entries, (entry) => entry.size),
      packedSize: sumKnownEntryBytes(state.entries, (entry) => entry.compressedSize),
    };
  }

  if (selection.visibleSelectedRows.length === 1) {
    const row = selection.visibleSelectedRows[0];
    const entry = row.entry ?? entryByPath(state.entries, row.path);
    if (!entry) {
      return {
        kind: "syntheticFolder",
        row,
      };
    }
    return {
      kind: "entry",
      entry,
    };
  }

  const selectedEntries = selection.visibleSelectedRows
    .map((row) => row.entry ?? entryByPath(state.entries, row.path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);

  return {
    kind: "multipleSelection",
    selectedCount: selection.visibleSelectedRows.length,
    selectedFiles: selection.visibleSelectedRows.filter((row) =>
      row.rowType === "entry" && row.entry?.kind !== "directory"
    ).length,
    selectedFolders: selection.visibleSelectedRows.filter((row) =>
      row.rowType === "folder" || row.entry?.kind === "directory"
    ).length,
    totalSize: sumKnownEntryBytes(selectedEntries, (entry) => entry.size),
    packedSize: sumKnownEntryBytes(selectedEntries, (entry) => entry.compressedSize),
    pathPreviewPaths: selection.visibleSelectedRows.map((row) => row.path),
    rows: selection.visibleSelectedRows,
  };
}

function sumKnownEntryBytes(
  entries: readonly ArchiveEntryDto[],
  selector: (entry: ArchiveEntryDto) => number | undefined,
): number | null {
  let total = 0;
  let hasKnownValue = false;
  for (const entry of entries) {
    const value = selector(entry);
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      total += value;
      hasKnownValue = true;
    }
  }
  return hasKnownValue ? total : null;
}

function commandSnapshotFromState(
  state: MutableArchiveWorkspaceState,
  selection: ArchiveWorkspaceSelectionSnapshot,
): ArchiveWorkspaceCommandSnapshot {
  const hasArchive = Boolean(state.currentArchivePath);
  const canUseArchive =
    hasArchive &&
    state.browseState !== "loading" &&
    (state.browseState === "loaded" || state.browseState === "empty");
  const selectedEntry = selection.selectedEntries.length === 1
    ? selection.selectedEntries[0]
    : null;

  return {
    browseState: state.browseState,
    hasArchive,
    focusedRow: Boolean(selection.focusedPath),
    canNavigateUp: Boolean(state.view.currentFolder),
    canOpenInside: selectedEntry?.kind === "directory",
    selectedCount: selection.selectedCount,
    visibleSelectableCount: selection.visibleSelectablePaths.length,
    canUseArchive,
    canListEntries: canUseArchive && state.browseState === "loaded",
    canSearchEntries: hasArchive && state.browseState !== "loading",
    canNavigateBack: state.view.navigationHistory.length > 0,
  };
}

function snapshotFromState(state: MutableArchiveWorkspaceState): ArchiveWorkspaceSnapshot {
  const rows = visibleRowsForState(state);
  const selection = selectionSnapshotFromState(state, rows);
  const details = detailsModelFromState(state, selection);
  const command = commandSnapshotFromState(state, selection);

  return {
    currentArchivePath: state.currentArchivePath,
    browseState: state.browseState,
    status: cloneStatus(state.status),
    error: state.error ? { ...state.error } : null,
    passwordRetry: clonePasswordRetry(state.passwordRetry),
    entries: cloneEntries(state.entries),
    entryCount: state.entryCount,
    totalSize: state.totalSize,
    listingRevision: state.listingRevision,
    command: { ...command },
    view: {
      currentFolder: state.view.currentFolder,
      breadcrumbs: getArchiveBreadcrumbs(state.view.currentFolder),
      navigationHistory: [...state.view.navigationHistory],
      searchQuery: state.view.searchQuery,
      flatView: state.view.flatView,
      expandedTreeFolders: [...state.view.expandedTreeFolders],
      sort: { ...state.view.sort },
      rowOptions: { ...state.view.rowOptions },
      rows: cloneRows(rows),
      selection: cloneSelectionSnapshot(selection),
      details: cloneDetailsModel(details),
    },
  };
}

function clonePasswordRetry(
  retry: ArchiveWorkspacePasswordRetry | null,
): ArchiveWorkspacePasswordRetry | null {
  return retry ? { ...retry } : null;
}

function cloneStatus(status: ArchiveWorkspaceMessagePayload): ArchiveWorkspaceMessagePayload {
  return {
    key: status.key,
    ...(status.values ? { values: { ...status.values } } : {}),
    ...(status.fallbackText ? { fallbackText: status.fallbackText } : {}),
  };
}

function cloneEntries(entries: readonly ArchiveEntryDto[]): ArchiveEntryDto[] {
  return entries.map((entry) => ({ ...entry }));
}

function cloneRows(rows: readonly ArchiveTableRow[]): ArchiveTableRow[] {
  return rows.map((row) => cloneRow(row));
}

function cloneRow(row: ArchiveTableRow): ArchiveTableRow {
  if (row.rowType === "parent") {
    return { ...row };
  }
  if (row.rowType === "folder") {
    return {
      ...row,
      ...(row.entry ? { entry: { ...row.entry } } : {}),
    };
  }
  return {
    ...row,
    entry: { ...row.entry },
  };
}

function cloneSelectableRows(
  rows: readonly SelectableArchiveWorkspaceRow[],
): SelectableArchiveWorkspaceRow[] {
  return rows.map((row) => cloneRow(row) as SelectableArchiveWorkspaceRow);
}

function cloneSelectionSnapshot(
  selection: ArchiveWorkspaceSelectionSnapshot,
): ArchiveWorkspaceSelectionSnapshot {
  return {
    selectedPaths: [...selection.selectedPaths],
    selectedCount: selection.selectedCount,
    focusedPath: selection.focusedPath,
    anchorPath: selection.anchorPath,
    visibleSelectablePaths: [...selection.visibleSelectablePaths],
    visibleSelectedPaths: [...selection.visibleSelectedPaths],
    visibleSelectedRows: cloneSelectableRows(selection.visibleSelectedRows),
    visibleSelectedCount: selection.visibleSelectedCount,
    selectedEntries: cloneEntries(selection.selectedEntries),
    selectedEntryPaths: [...selection.selectedEntryPaths],
    visibleSelectedEntries: cloneEntries(selection.visibleSelectedEntries),
    focusedEntry: selection.focusedEntry ? { ...selection.focusedEntry } : null,
    visibleSelectedSize: selection.visibleSelectedSize,
    hiddenBySearch: selection.hiddenBySearch,
    firstSelectedEntryPath: selection.firstSelectedEntryPath,
    firstSelectedEntryName: selection.firstSelectedEntryName,
  };
}

function cloneDetailsModel(details: ArchiveWorkspaceDetailsModel): ArchiveWorkspaceDetailsModel {
  switch (details.kind) {
    case "noArchive":
      return { kind: "noArchive" };
    case "hiddenSelection":
      return { ...details };
    case "archiveSummary":
      return { ...details };
    case "syntheticFolder":
      return {
        kind: "syntheticFolder",
        row: cloneRow(details.row) as SelectableArchiveWorkspaceRow,
      };
    case "entry":
      return {
        kind: "entry",
        entry: { ...details.entry },
      };
    case "multipleSelection":
      return {
        ...details,
        pathPreviewPaths: [...details.pathPreviewPaths],
        rows: cloneSelectableRows(details.rows),
      };
  }
}
