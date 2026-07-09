import {
  COMMAND_DEFINITIONS,
  selectCommandState,
  type CommandId,
  type CommandStateMap,
} from "../../app/classicCommands";
import type { CommandRouterPayload } from "../../app/commands/commandRouter";
import type {
  ContextMenuActionPayload,
  ContextMenuItem,
} from "../../app/commands/contextMenuModel";
import { createDisplayContext, type DisplayContextSnapshot } from "../../app/display/displayContext";
import type { DroppedPath, WorkspaceDropMode } from "../../app/dropIntent";
import type { ExtractMode, ExtractOverwritePolicy } from "../../app/extractFlow";
import type { ArchiveTableColumnId } from "../../app/archiveTable";
import { DEFAULT_APP_PREFERENCES, preferencesWithPatch, type AppPreferencePatch, type AppPreferences, type FormatCreateDefaults } from "../../app/preferences";
import { createPathHistoryStore, type PathHistorySnapshot } from "../../app/pathHistory";
import { createShellWorkspace, type ShellWorkspaceSnapshot } from "../../app/shell/shellWorkspace";
import { createArchiveWorkspace, type ArchiveWorkspaceSnapshot } from "../../app/workspaces/archiveWorkspace";
import { createCreateWorkspace, type CreateWorkspaceOptionPatch, type CreateWorkspaceSnapshot } from "../../app/workspaces/createWorkspace";
import {
  createJobsWorkspace,
  type FocusedQuickActionProgressSnapshot,
  type JobListSnapshot,
} from "../../app/workspaces/jobsWorkspace";
import type {
  ZManagerDialogSnapshot,
} from "../../app/display/dialogSnapshots";

export type {
  ZManagerDialogAction,
  ZManagerDialogDetailRow,
  ZManagerDialogSnapshot,
} from "../../app/display/dialogSnapshots";

export type ZManagerReactDisplaySnapshot = Readonly<{
  resolvedLocale: DisplayContextSnapshot["resolvedLocale"];
  documentLanguage: DisplayContextSnapshot["documentLanguage"];
  documentDirection: DisplayContextSnapshot["documentDirection"];
}>;

export type ZManagerReactCommandSnapshot = Readonly<{
  states: CommandStateMap;
  pressed: Readonly<Partial<Record<CommandId, boolean>>>;
  primaryCommandIds: readonly CommandId[];
  secondaryCommandIds: readonly CommandId[];
}>;

export type ZManagerRuntimeSnapshot = Readonly<{
  isDesktop: boolean;
}>;

export type ZManagerContextMenuSnapshot =
  | Readonly<{ visible: false; id: number }>
  | Readonly<{
      visible: true;
      id: number;
      x: number;
      y: number;
      items: readonly ContextMenuItem[];
    }>;

export type ZManagerContextMenuItem = ContextMenuItem;
export type ZManagerContextMenuActionPayload = ContextMenuActionPayload;

export type ZManagerReactSnapshot = Readonly<{
  shell: ShellWorkspaceSnapshot;
  archive: ArchiveWorkspaceSnapshot;
  create: CreateWorkspaceSnapshot;
  jobs: JobListSnapshot;
  quickActionProgress: FocusedQuickActionProgressSnapshot;
  systemIcons: Readonly<Record<string, string | null>>;
  preferences: AppPreferences;
  preferencesDraft: AppPreferences | null;
  pathHistory: PathHistorySnapshot;
  display: ZManagerReactDisplaySnapshot;
  commands: ZManagerReactCommandSnapshot;
  contextMenu: ZManagerContextMenuSnapshot;
  runtime: ZManagerRuntimeSnapshot;
  dialog: ZManagerDialogSnapshot;
}>;

export type ZManagerArchiveIntent =
  | Readonly<{ type: "navigateToFolder"; folderPath: string }>
  | Readonly<{ type: "navigateBack" }>
  | Readonly<{ type: "navigateUp" }>
  | Readonly<{ type: "setSearchQuery"; query: string }>
  | Readonly<{ type: "clearSearch" }>
  | Readonly<{ type: "setFlatView"; flatView: boolean; persistPreference?: boolean }>
  | Readonly<{ type: "setColumnWidth"; columnId: ArchiveTableColumnId; width: number; persist: boolean }>
  | Readonly<{ type: "toggleTreeFolder"; folderPath: string }>
  | Readonly<{ type: "sortByColumn"; columnId: ArchiveTableColumnId }>
  | Readonly<{ type: "selectAllVisible" }>
  | Readonly<{ type: "clearSelection" }>
  | Readonly<{
      type: "selectRow";
      path: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
    }>
  | Readonly<{ type: "setRowSelected"; path: string; selected: boolean }>
  | Readonly<{
      type: "applySelection";
      selectedPaths: readonly string[];
      focusedPath: string;
      anchorPath: string;
    }>
  | Readonly<{ type: "activateRow"; path: string; rowKind: "folder" | "entry" | "parent" }>
  | Readonly<{ type: "startNativeDrag"; entryPath: string }>
  | Readonly<{ type: "copyDetailsValue"; value: string }>
  | Readonly<{ type: "showEmptyContextMenu"; x: number; y: number }>
  | Readonly<{ type: "showColumnContextMenu"; columnId: ArchiveTableColumnId; x: number; y: number }>
  | Readonly<{ type: "showRowContextMenu"; path: string; rowKind: "folder" | "entry" | "parent"; x: number; y: number }>
  | Readonly<{ type: "runDetailsAction"; action: string }>;

export type ZManagerCreateIntent =
  | Readonly<{ type: "showWorkspace" }>
  | Readonly<{ type: "showAddSourcesMenu"; x: number; y: number }>
  | Readonly<{ type: "clearSources" }>
  | Readonly<{ type: "removeSources"; sourcePaths: readonly string[] }>
  | Readonly<{ type: "showSourceContextMenu"; sourcePath: string; x: number; y: number }>
  | Readonly<{ type: "setDestinationPath"; destinationPath: string }>
  | Readonly<{ type: "browseDestination" }>
  | Readonly<{ type: "changeFormat"; format: CreateWorkspaceSnapshot["options"]["format"] }>
  | Readonly<{ type: "setOptions"; patch: CreateWorkspaceOptionPatch }>
  | Readonly<{ type: "navigateToFolder"; folderPath: string }>
  | Readonly<{ type: "setSearchQuery"; query: string }>
  | Readonly<{ type: "clearSearch" }>
  | Readonly<{ type: "toggleTreeFolder"; folderPath: string }>
  | Readonly<{ type: "setPathIncluded"; path: string; included: boolean }>
  | Readonly<{ type: "setAllIncluded"; included: boolean }>
  | Readonly<{ type: "setCurrentFolderIncluded"; included: boolean }>
  | Readonly<{ type: "selectRow"; path: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }>
  | Readonly<{ type: "applySelection"; selectedPaths: readonly string[]; focusedPath: string; anchorPath: string }>
  | Readonly<{ type: "toggleRowSelection"; path: string }>
  | Readonly<{ type: "focusRow"; path: string }>
  | Readonly<{ type: "removeSelectedSources"; fallbackSourcePath?: string }>
  | Readonly<{ type: "showCompressRowContextMenu"; path: string; sourcePath?: string; x: number; y: number }>
  | Readonly<{ type: "runCreate"; password: string; passwordConfirm: string }>;

export type ZManagerJobsIntent =
  | Readonly<{ type: "openDrawer" }>
  | Readonly<{ type: "closeDrawer" }>
  | Readonly<{ type: "poll" }>
  | Readonly<{ type: "cancel"; jobId: string }>
  | Readonly<{ type: "pause"; jobId: string }>
  | Readonly<{ type: "resume"; jobId: string }>
  | Readonly<{ type: "dismiss"; jobId: string }>
  | Readonly<{ type: "retryPassword"; jobId: string }>
  | Readonly<{ type: "runOutputAction"; jobId: string; actionIndex: number; kind: "open" | "reveal" }>
  | Readonly<{ type: "backgroundFocused" }>
  | Readonly<{ type: "toggleQuickActionPause" }>
  | Readonly<{ type: "cancelFocusedQuickActionJobs" }>;

export type ZManagerDialogIntent =
  | Readonly<{ type: "extract"; mode: ExtractMode }>
  | Readonly<{ type: "extractHere"; mode: ExtractMode }>
  | Readonly<{
      type: "submitExtract";
      mode: ExtractMode;
      destination: string;
      useSubfolder: boolean;
      subfolder: string;
      pathMode: "full" | "current" | "none";
      overwrite: ExtractOverwritePolicy;
      stripComponents: string;
      deduplicateRoot: boolean;
      password: string;
    }>
  | Readonly<{
      type: "browseExtractDestination";
      destination: string;
      useSubfolder: boolean;
      subfolder: string;
      pathMode: "full" | "current" | "none";
      overwrite: ExtractOverwritePolicy;
      stripComponents: string;
      deduplicateRoot: boolean;
    }>
  | Readonly<{ type: "preferences" }>
  | Readonly<{ type: "about" }>
  | Readonly<{ type: "info"; target?: "current" | "archive"; entryPath?: string }>
  | Readonly<{ type: "infoAction"; action?: string; copyValue?: string }>
  | Readonly<{ type: "copyAboutDiagnostics" }>
  | Readonly<{ type: "preferencesPatch"; patch: AppPreferencePatch }>
  | Readonly<{
      type: "preferencesCreateDefaultsPatch";
      format: CreateWorkspaceSnapshot["options"]["format"];
      patch: Partial<FormatCreateDefaults>;
    }>
  | Readonly<{ type: "preferencesChooseOutput" }>
  | Readonly<{ type: "preferencesSave" }>
  | Readonly<{ type: "preferencesCancel" }>
  | Readonly<{ type: "closeCurrent" }>;

export type ZManagerWindowResizeDirection =
  | "North"
  | "East"
  | "South"
  | "West"
  | "NorthEast"
  | "SouthEast"
  | "SouthWest"
  | "NorthWest";

export type ZManagerDesktopIntent =
  | Readonly<{ type: "droppedPaths"; paths: readonly DroppedPath[] }>
  | Readonly<{ type: "dropEntered"; paths?: readonly DroppedPath[] }>
  | Readonly<{ type: "dropLeft" }>
  | Readonly<{ type: "dropChoice"; choice: "openArchive" | "addToCompress" | "cancel" }>
  | Readonly<{ type: "windowControl"; control: "minimize" | "toggleMaximize" | "close" }>
  | Readonly<{ type: "beginWindowResize"; direction: ZManagerWindowResizeDirection }>;

export type ZManagerContextMenuIntent =
  | Readonly<{ type: "action"; payload: ZManagerContextMenuActionPayload }>
  | Readonly<{ type: "hide" }>;

export type ZManagerKeyboardIntent =
  | Readonly<{ type: "escape" }>
  | Readonly<{ type: "focusSearch" }>;

export type ZManagerReactActions = Readonly<{
  executeCommand(commandId: CommandId, payload?: CommandRouterPayload): void;
  setWorkspaceMode(mode: WorkspaceDropMode): void;
  handleArchiveIntent(intent: ZManagerArchiveIntent): void;
  handleCreateIntent(intent: ZManagerCreateIntent): void;
  handleJobsIntent(intent: ZManagerJobsIntent): void;
  handleDialogIntent(intent: ZManagerDialogIntent): void;
  handleDesktopIntent(intent: ZManagerDesktopIntent): void;
  handleContextMenuIntent(intent: ZManagerContextMenuIntent): void;
  handleKeyboardIntent(intent: ZManagerKeyboardIntent): void;
}>;

export type ZManagerReactSnapshotListener = (snapshot: ZManagerReactSnapshot) => void;

export type ZManagerReactRuntimeAdapter = Readonly<{
  getSnapshot(): ZManagerReactSnapshot;
  subscribe(listener: ZManagerReactSnapshotListener): () => void;
  actions: ZManagerReactActions;
}>;

export type CreateZManagerReactSnapshotInput = Readonly<{
  shell: ShellWorkspaceSnapshot;
  archive: ArchiveWorkspaceSnapshot;
  create: CreateWorkspaceSnapshot;
  jobs: JobListSnapshot;
  quickActionProgress: FocusedQuickActionProgressSnapshot;
  systemIcons?: Readonly<Record<string, string | null>>;
  preferences: AppPreferences;
  preferencesDraft?: AppPreferences | null;
  pathHistory: PathHistorySnapshot;
  display: ZManagerReactDisplaySnapshot;
  commands: ZManagerReactCommandSnapshot;
  contextMenu?: ZManagerContextMenuSnapshot;
  runtime?: ZManagerRuntimeSnapshot;
  dialog?: ZManagerDialogSnapshot;
}>;

const COMMAND_IDS = Object.keys(COMMAND_DEFINITIONS) as CommandId[];

export const noopZManagerReactActions: ZManagerReactActions = Object.freeze({
  executeCommand() {},
  setWorkspaceMode() {},
  handleArchiveIntent() {},
  handleCreateIntent() {},
  handleJobsIntent() {},
  handleDialogIntent() {},
  handleDesktopIntent() {},
  handleContextMenuIntent() {},
  handleKeyboardIntent() {},
});

export function displaySnapshotFromContext(
  context: Pick<DisplayContextSnapshot, "resolvedLocale" | "documentLanguage" | "documentDirection">,
): ZManagerReactDisplaySnapshot {
  return deepFreezeValue({
    resolvedLocale: context.resolvedLocale,
    documentLanguage: context.documentLanguage,
    documentDirection: context.documentDirection,
  });
}

export function cloneAppPreferencesSnapshot(preferences: AppPreferences): AppPreferences {
  return preferencesWithPatch(preferences, {});
}

export function createZManagerReactSnapshot(
  input: CreateZManagerReactSnapshotInput,
): ZManagerReactSnapshot {
  return deepFreezeValue({
    shell: input.shell,
    archive: input.archive,
    create: input.create,
    jobs: input.jobs,
    quickActionProgress: input.quickActionProgress,
    systemIcons: { ...(input.systemIcons ?? {}) },
    preferences: cloneAppPreferencesSnapshot(input.preferences),
    preferencesDraft: input.preferencesDraft ? cloneAppPreferencesSnapshot(input.preferencesDraft) : null,
    pathHistory: {
      extractDestinationHistory: [...input.pathHistory.extractDestinationHistory],
      createDestinationHistory: [...input.pathHistory.createDestinationHistory],
      recentArchiveHistory: [...input.pathHistory.recentArchiveHistory],
    },
    display: displaySnapshotFromContext(input.display),
    commands: {
      states: cloneCommandStateMap(input.commands.states),
      pressed: { ...input.commands.pressed },
      primaryCommandIds: [...input.commands.primaryCommandIds],
      secondaryCommandIds: [...input.commands.secondaryCommandIds],
    },
    contextMenu: cloneContextMenuSnapshot(input.contextMenu ?? { visible: false, id: 0 }),
    runtime: { isDesktop: Boolean(input.runtime?.isDesktop) },
    dialog: cloneDialogSnapshot(input.dialog ?? { kind: "none" }),
  });
}

export function createInitialZManagerReactSnapshot(): ZManagerReactSnapshot {
  const shellWorkspace = createShellWorkspace();
  const archiveWorkspace = createArchiveWorkspace({
    flatView: DEFAULT_APP_PREFERENCES.flatViewDefault,
    showParentFolderItem: DEFAULT_APP_PREFERENCES.showParentFolderItem,
    sortKey: DEFAULT_APP_PREFERENCES.tableSortKey,
    sortAscending: DEFAULT_APP_PREFERENCES.tableSortAscending,
  });
  const createWorkspace = createCreateWorkspace();
  const jobsWorkspace = createJobsWorkspace();
  const archive = archiveWorkspace.getSnapshot();
  const display = createDisplayContext(DEFAULT_APP_PREFERENCES.locale);
  const nowMs = 0;

  return createZManagerReactSnapshot({
    shell: shellWorkspace.getSnapshot(),
    archive,
    create: createWorkspace.getSnapshot(),
    jobs: jobsWorkspace.getJobListSnapshot(nowMs),
    quickActionProgress: jobsWorkspace.getFocusedQuickActionProgressSnapshot(nowMs),
    preferences: DEFAULT_APP_PREFERENCES,
    pathHistory: createPathHistoryStore(null).getSnapshot(),
    display: displaySnapshotFromContext(display),
    commands: {
      states: selectCommandState({
        ...archive.command,
        mutableOperationsSupported: false,
        jobRunning: false,
      }),
      pressed: {
        flatView: archive.view.flatView,
        largeButtons: DEFAULT_APP_PREFERENCES.largeToolbarButtons,
        showButtonText: DEFAULT_APP_PREFERENCES.showToolbarLabels,
      },
      primaryCommandIds: ["open"],
      secondaryCommandIds: ["refresh"],
    },
    contextMenu: { visible: false, id: 0 },
    runtime: { isDesktop: false },
    dialog: { kind: "none" },
  });
}

function cloneContextMenuSnapshot(contextMenu: ZManagerContextMenuSnapshot): ZManagerContextMenuSnapshot {
  if (!contextMenu.visible) {
    return { visible: false, id: contextMenu.id };
  }

  return {
    ...contextMenu,
    items: contextMenu.items.map(cloneContextMenuItem),
  };
}

function cloneContextMenuItem(item: ContextMenuItem): ContextMenuItem {
  switch (item.type) {
    case "action":
      return {
        ...item,
        payload: { ...item.payload },
      };
    case "checkbox":
      return {
        ...item,
        payload: { ...item.payload },
      };
    case "caption":
      return { ...item };
    case "separator":
      return { type: "separator" };
  }
}

function cloneDialogSnapshot(dialog: ZManagerDialogSnapshot): ZManagerDialogSnapshot {
  switch (dialog.kind) {
    case "none":
      return { kind: "none" };
    case "extract":
      return {
        ...dialog,
        destinationHistory: [...dialog.destinationHistory],
      };
    case "info":
      return {
        ...dialog,
        rows: dialog.rows.map((row) => ({ ...row })),
        actions: dialog.actions.map((action) => ({ ...action })),
      };
    case "about":
      return {
        ...dialog,
        groups: dialog.groups.map((group) => ({
          title: group.title,
          rows: group.rows.map(([label, value]) => [label, value] as const),
        })),
      };
  }
}

function cloneCommandStateMap(commandState: CommandStateMap): CommandStateMap {
  return Object.fromEntries(
    COMMAND_IDS.map((commandId) => {
      const state = commandState[commandId] ?? { enabled: false };
      return [commandId, { ...state }];
    }),
  ) as CommandStateMap;
}

function deepFreezeValue<T>(value: T): T {
  return deepFreezeObject(value, new WeakSet()) as T;
}

function deepFreezeObject(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const nestedValue of Object.values(value)) {
    deepFreezeObject(nestedValue, seen);
  }
  return Object.freeze(value);
}
