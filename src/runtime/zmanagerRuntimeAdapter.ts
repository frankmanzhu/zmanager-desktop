import {
  APP_TITLE,
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
} from "../app/constants";
import {
  COMMAND_DEFINITIONS,
  ARCHIVE_NOT_READY_MESSAGE,
  JOB_RUNNING_MESSAGE,
  NO_ARCHIVE_OPEN_MESSAGE,
  NO_ENTRIES_MESSAGE,
  NO_SELECTION_MESSAGE,
  SINGLE_FILE_REQUIRED_MESSAGE,
  SINGLE_FOLDER_REQUIRED_MESSAGE,
  UNSUPPORTED_OPERATION_MESSAGE,
  selectCommandState,
  type CommandId,
  type CommandStateMap,
} from "../app/classicCommands";
import {
  createCommandRouter,
  selectContextCommand,
  selectDetailsCommand,
  type CommandRouterPayload,
} from "../app/commands/commandRouter";
import {
  buildAddSourcesContextMenuItems,
  buildArchiveEntryContextMenuItems,
  buildArchiveFolderContextMenuItems,
  buildArchiveHeaderContextMenuItems,
  buildCompressRowContextMenuItems,
  buildSourceContextMenuItems,
  buildStartupContextMenuItems,
  type ContextMenuActionPayload,
} from "../app/commands/contextMenuModel";
import {
  createArchiveLoadController,
  type ArchiveLoadOptions,
} from "../app/controllers/archiveLoadController";
import {
  createArchiveOpenController,
} from "../app/controllers/archiveOpenController";
import {
  createArchivePreviewController,
  type ArchivePreviewMode,
} from "../app/controllers/archivePreviewController";
import {
  createArchiveTestController,
} from "../app/controllers/archiveTestController";
import {
  createCreatePlanController,
} from "../app/controllers/createPlanController";
import {
  createCreateStartController,
} from "../app/controllers/createStartController";
import {
  createExtractStartController,
} from "../app/controllers/extractStartController";
import {
  createJobControlController,
} from "../app/controllers/jobControlController";
import {
  createQuickActionController,
} from "../app/controllers/quickActionController";
import {
  createStartupController,
} from "../app/controllers/startupController";
import { createAccountController } from "../app/controllers/accountController";
import { createDefaultHandlerController } from "../app/controllers/defaultHandlerController";
import {
  createNativeInboundController,
} from "../app/controllers/nativeInboundController";
import {
  ARCHIVE_TABLE_COLUMNS,
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  buildArchiveBrowserRows,
  moveColumn,
  normalizeColumnSettings,
  resetColumnSettings,
  setColumnWidth,
  toggleColumnVisibility,
  visibleColumns,
  type ArchiveSortKey,
  type ArchiveTableColumn,
  type ArchiveTableColumnId,
  type ArchiveTableColumnSettings,
  type ArchiveTableRow,
} from "../app/archiveTable";
import {
  createArchiveWorkspace,
  type ArchiveWorkspacePasswordRetry,
  type ArchiveWorkspacePasswordRetryOperation,
  type ArchiveWorkspaceSnapshot,
  type SelectableArchiveWorkspaceRow,
} from "../app/workspaces/archiveWorkspace";
import {
  createCreateWorkspace,
  type CreateWorkspacePlanStatus,
  type CreateWorkspaceSnapshot,
} from "../app/workspaces/createWorkspace";
import {
  createExtractWorkspace,
  type ExtractWorkspaceDefaults,
  type ExtractWorkspaceOptionPatch,
} from "../app/workspaces/extractWorkspace";
import {
  pathsWithSameExtension,
} from "../app/selection";
import {
  applyHierarchicalRowSelectionIntent,
  clearHierarchicalTableSelection,
  ensureHierarchicalTablePathSelected,
  focusHierarchicalTablePath,
  invertVisibleHierarchicalSelection,
  replaceHierarchicalTableSelection,
  selectAllVisibleHierarchicalRows,
  setHierarchicalTablePathSelected,
  type HierarchicalTableSelectionResult,
} from "../app/hierarchicalTable";
import {
  getPathBasename,
  parseDateValue,
} from "../app/formatting";
import {
  normalizeArchivePath,
} from "../app/archiveTree";
import {
  getArchiveName,
  sourcePathForCreatePlanRow,
  type CreateArchiveFormat,
  type CreatePlanRow,
} from "../app/createFlow";
import {
  unknownErrorMessage,
  type NativeDialogOpenOptions,
} from "../app/dialogs";
import {
  type ExtractMode,
  type ExtractOverwritePolicy,
  type ExtractStartInput,
} from "../app/extractFlow";
import {
  createExtractDialogFormSnapshot,
  extractStartInputFromDialogForm,
  patchExtractDialogFormSnapshot,
  type ExtractDialogFormPatch,
  type ExtractDialogFormSnapshot,
} from "../app/extractDialogState";
import {
  ARCHIVE_OPEN_FILTER,
  getKnownArchiveSuffix,
  isSupportedArchivePath,
} from "../app/archiveFileTypes";
import {
  classifyDropIntent,
  dropSurfaceForWorkspace,
  type DroppedPath,
  type DropIntentDecision,
  type DropIntentSurface,
  type WorkspaceDropMode,
} from "../app/dropIntent";
import {
  type JobRetryContext,
} from "../app/jobs";
import { createDisposableTaskLifecycle } from "../app/shell/disposableTaskLifecycle";
import { runInboundQuickAction } from "../app/shell/quickActionLaunchDisposition";
import {
  createJobsWorkspace,
  type FocusedJobAutoCloseAction,
  type FocusedJobProgressContext,
  type JobListSnapshot,
  type JobOutputAction,
  type ProgressClockSnapshot,
} from "../app/workspaces/jobsWorkspace";
import { createAccountWorkspace } from "../app/workspaces/accountWorkspace";
import {
  createDefaultsForFormat,
  defaultCreateDirectory,
  loadAppPreferences,
  preferencesWithPatch,
  saveAppPreferences,
  type AppPreferencePatch,
  type AppPreferences,
} from "../app/preferences";
import {
  createPathHistoryStore,
} from "../app/pathHistory";
import {
  createShellWorkspace,
  type DropOverlayCopy,
  type DropOverlayMode,
  type ShellWorkspaceSnapshot,
} from "../app/shell/shellWorkspace";
import {
  type MessageKey,
  type MessageParams,
} from "../app/i18n/translator";
import {
  createDisplayContext,
  refreshDisplayContext,
  selectDisplayRefreshSurfaces,
  type DisplayRefreshWorkspace,
} from "../app/display/displayContext";
import {
  buildAboutDialogSnapshot,
  buildArchiveInfoDialogSnapshot,
  buildEntryInfoDialogSnapshot,
  buildSelectionInfoDialogSnapshot,
  serializeAboutDiagnostics,
} from "../app/display/dialogSnapshots";
import {
  createZManagerReactSnapshot,
  type ZManagerAccountIntent,
  displaySnapshotFromContext,
  type ZManagerContextMenuIntent,
  type ZManagerDesktopIntent,
  type ZManagerDialogIntent,
  type ZManagerDialogSnapshot,
  type ZManagerJobsIntent,
  type ZManagerKeyboardIntent,
  type ZManagerReactRuntimeAdapter,
  type ZManagerReactSnapshot,
} from "../ui/react/appRuntime";
import {
  uniqueQuickActionPaths,
  type QuickActionExtractMode,
} from "../app/quickActions";
import {
  asCommandError,
  applyAccountHostedCallback,
  beginAccountHostedAuth,
  acknowledgeNativeEvent,
  cancelJob as cancelJobCommand,
  dismissJob as dismissJobCommand,
  fetchHealthcheck,
  fetchAccountSnapshot,
  fetchProjectContract,
  fetchDiagnosticLogInfo,
  fetchQuickActionStartupState,
  fetchSystemFileIcons,
  generateTzapIdentity as generateTzapIdentityCommand,
  generateAccountRecipientKey,
  startArchiveIndex,
  waitArchiveIndex,
  getArchiveChildren,
  searchArchiveIndex,
  closeArchiveIndex,
  nativeFrontendReady,
  pauseJob as pauseJobCommand,
  forgetAccount,
  removeAccountContact,
  removeAccountRecipientKey,
  runPlanCreate,
  runPreviewEntry,
  resumeJob as resumeJobCommand,
  runStartCreate,
  runStartExtract,
  runTestArchive,
  validateDirectory,
  verifyTzapCertificate as verifyTzapCertificateCommand,
} from "../api/commands";
import type {
  ArchiveEntryDto,
  ArchiveListingDto,
  BrowseState,
  CreatePlanEntryDto,
  CreatePlanResponse,
  DiagnosticLogInfoDto,
  HealthcheckResponse,
  JobState,
  ListArchiveRequest,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
  SystemFileIconRequestEntry,
} from "../api/types";
import type {
  NativeInboundHostedAuthEvent,
} from "../api/generated/nativeInboundEvents.generated";
import { isNativeCapabilityAvailable } from "../api/generated/nativeCapabilities.generated";
import {
  isDesktopRuntime,
  openNativeDialog as openRuntimeDialog,
} from "../desktop/runtime";
import { chooseTzapIdentityDestination } from "../desktop/tzapIdentityDialog";
import {
  bindDesktopFileDrop,
  type DesktopFileDropEvent,
} from "../desktop/fileDrop";
import {
  openDesktopPath,
  revealInFileManager,
} from "../desktop/fileManager";
import {
  canReadClipboard,
  readClipboardText,
  writeClipboardText,
} from "../desktop/clipboard";
import {
  createAppTimers,
} from "../desktop/timers";
import { createTauriJobFeed, type JobFeedSubscription } from "../desktop/jobFeed";
import { createJobSubscriptionSet } from "../desktop/jobSubscriptionSet";
import {
  bindPreviewCleanupOnAppClose,
  cleanupPreviewRoots,
} from "../desktop/previewCleanup";
import { listenNativeInboundEvents } from "../desktop/nativeInboundEvents";
import { listenNativeMenuCommands } from "../desktop/nativeMenu";
import { defaultHandlerDesktopAdapter } from "../desktop/defaultHandlers";
import {
  listenNativeFileDragOutcomes,
  startNativeFileDrag,
} from "../desktop/nativeDrag";
import {
  createWindowController,
  type AppWindowResizeDirection,
} from "../desktop/windowController";
import { createDisposableTaskWindowManager } from "../desktop/disposableTaskWindowManager";
import {
  createDesktopDiagnosticRecorder,
  persistDiagnosticEvent,
} from "../desktop/diagnostics";
import {
  createBrowserDocumentAdapter,
} from "./browserDocumentAdapter";
import {
  createBrowserPasswordPromptAdapter,
} from "./passwordPromptAdapter";
import {
  createRuntimeContextMenu,
} from "./contextMenuRuntime";
import {
  createReactRuntimeStore,
} from "./reactRuntimeStore";
import {
  createArchiveRuntimeActions,
} from "./archiveRuntimeActions";
import {
  createCreateRuntimeActions,
} from "./createRuntimeActions";
import type {
  ArchiveFixture,
} from "./runtimeArchiveFixtures";
import {
  installRuntimeDevTools,
  loadLocalDevFixtureFromUrl as loadRuntimeLocalDevFixtureFromUrl,
} from "./runtimeDevTools";
import {
  startZManagerRuntime,
} from "./runtimeStartup";
type SelectableBrowserRow = Extract<ArchiveTableRow, { rowType: "folder" | "entry" }>;
type CompressPlanRow = CreatePlanRow;
type CommandSurfaceClassState = Partial<Record<CommandId, {
  primary?: boolean;
  secondary?: boolean;
}>>;
const QUICK_ACTION_AUTO_CLOSE_DELAY_MS = 650;

const browserDocument = createBrowserDocumentAdapter({});
const passwordPromptAdapter = createBrowserPasswordPromptAdapter();
browserDocument.initializeLayout();

let appPreferences: AppPreferences = loadAppPreferences();
const shellWorkspace = createShellWorkspace();
const pathHistoryStore = createPathHistoryStore();
const archiveWorkspace = createArchiveWorkspace({
  flatView: appPreferences.flatViewDefault,
  showParentFolderItem: appPreferences.showParentFolderItem,
  sortKey: appPreferences.tableSortKey,
  sortAscending: appPreferences.tableSortAscending,
});
const createWorkspace = createCreateWorkspace();
const extractWorkspace = createExtractWorkspace();
const accountWorkspace = createAccountWorkspace();
let displayContext = createDisplayContext(appPreferences.locale);
let preferencesDialogDraft: AppPreferences | null = null;
let systemIconDataUrls = new Map<string, string | null>();
let systemIconRequestRevision = 0;
let activeExtractMode: ExtractMode = "archive";
let activeExtractDialogForm: ExtractDialogFormSnapshot = createExtractDialogFormSnapshot();
let activeExtractDialogMessage = "";

let dropUnlisten: (() => void) | null = null;
const pendingNativeDragCounts = new Map<string, number>();

const jobsWorkspace = createJobsWorkspace();
let normalWorkspaceRendered = false;
const disposableTaskLifecycle = createDisposableTaskLifecycle();
const diagnostics = createDesktopDiagnosticRecorder();
const disposableTaskWindows = createDisposableTaskWindowManager({
  onReady: () => {},
  onAllClosed: () => {
    maybeCloseQuickActionOnlyCoordinator();
  },
  diagnostics,
});
let latestHealthcheck: HealthcheckResponse | null = null;
let latestContract: ProjectContract | null = null;
let latestDiagnosticLogInfo: DiagnosticLogInfoDto | null = null;
let reactDialogSnapshot: ZManagerDialogSnapshot = { kind: "none" };
const reactRuntimeStore = createReactRuntimeStore({
  createSnapshot: createCurrentReactSnapshot,
});
const contextMenuRuntime = createRuntimeContextMenu({
  publishSnapshot: () => reactRuntimeStore.publishSnapshot(),
});
const archiveRuntimeActions = createArchiveRuntimeActions({
  navigateToFolder,
  navigateBack,
  navigateUp,
  loadNextPage: () => archiveLoadController.loadNextPage(),
  loadPreviousPage: () => archiveLoadController.loadPreviousPage(),
  setSearchQuery: (query) => {
    publishArchiveSnapshot(archiveWorkspace.setSearchQuery(query));
    void (query.trim()
      ? archiveLoadController.loadSearch(query)
      : archiveLoadController.loadFolder(archiveCurrentFolder()));
  },
  clearSearch,
  setFlatView,
  setColumnWidth: setTableColumnWidth,
  toggleTreeFolder: (folderPath) => {
    const snapshot = archiveWorkspace.toggleTreeFolder(folderPath);
    publishArchiveSnapshot(snapshot);
    if (snapshot.view.expandedTreeFolders.includes(folderPath)) {
      void archiveLoadController.loadTreeFolder(folderPath);
    }
  },
  sortByColumn: applySortCommand,
  selectAllVisible: selectVisibleEntries,
  clearSelection: clearBrowseSelection,
  selectRow: (path, modifiers) => updateSelectionByIntent(path, modifiers),
  setRowSelected: (path, selected) => {
    applyArchiveTableSelection(setHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path,
      selected,
    }));
  },
  hasActiveJob,
  applySelection: (input) => {
    applyArchiveTableSelection({
      selectedPaths: new Set(input.selectedPaths),
      focusedPath: input.focusedPath,
      anchorPath: input.anchorPath,
    });
  },
  runEntryDefaultAction: (path) => {
    updateSelectionByIntent(path);
    runRoutedCommand("view");
  },
  startNativeDrag: startNativeDragOut,
  copyDetailsValue: copyTextToClipboard,
  setExtractDestination: (destinationPath) => {
    extractWorkspace.setOptions({ destinationPath });
    publishReactSnapshot();
  },
  browseExtractDestination: onSelectWorkspaceExtractDestination,
  setExtractOptions: (patch) => {
    extractWorkspace.setOptions(patch);
    publishReactSnapshot();
  },
  resetExtractDefaults: () => {
    extractWorkspace.resetToDefaults();
    publishReactSnapshot();
  },
  setTzapVerificationOptions: (patch) => {
    extractWorkspace.setTzapVerificationOptions(patch);
    publishReactSnapshot();
  },
  chooseTzapTrustedCAs: chooseTzapTrustedCAs,
  removeTzapTrustedCA: (path) => {
    const current = extractWorkspace.getSnapshot().tzapVerification.trustedCaCertificatePaths;
    extractWorkspace.setTzapVerificationOptions({ trustedCaCertificatePaths: current.filter((item) => item !== path) });
    publishReactSnapshot();
  },
  verifyTzapCertificate: verifyCurrentTzapCertificate,
  runExtract: (mode, password) => startExtract(mode, extractWorkspace.buildStartInput(password)),
  showEmptyContextMenu: showStartupContextMenu,
  showColumnContextMenu: (columnId, x, y) => showTableHeaderContextMenu(x, y, columnId),
  showFolderContextMenu: (path, x, y) => showFolderContextMenu(path, x, y, path),
  showEntryContextMenu,
  runDetailsAction: handleArchiveDetailsAction,
});
const createRuntimeActions = createCreateRuntimeActions({
  showWorkspace: showCreateWorkspace,
  showAddSourcesMenu: (x, y) => {
    showAddSourcesMenuAt(x, y);
  },
  clearSources: clearCreateSources,
  removeSources: (sourcePaths) => removeCreateSources([...sourcePaths]),
  showSourceContextMenu,
  setDestinationPath: (destinationPath) => {
    publishCreateWorkspaceSnapshot(createWorkspace.setDestinationPath(destinationPath).snapshot);
  },
  browseDestination: onSelectCreateDestination,
  changeFormat: (format) => {
    const defaults = createDefaultsForFormat(appPreferences, format);
    publishCreateWorkspaceSnapshot(createWorkspace.changeFormat(format, defaults).snapshot);
    queuePlanRun();
  },
  setOptions: (patch) => {
    publishCreateWorkspaceSnapshot(createWorkspace.setOptions(patch).snapshot);
    queuePlanRun();
  },
  chooseTzapCertificate: chooseCreateTzapCertificate,
  generateTzapIdentity: generateCreateTzapIdentity,
  navigateToFolder: (folderPath) => {
    const navigation = createWorkspace.navigateToFolder(folderPath);
    if (navigation.changed) {
      publishCreateWorkspaceSnapshot(navigation.snapshot);
    } else {
      publishReactSnapshot();
    }
  },
  setSearchQuery: (query) => {
    publishCreateWorkspaceSnapshot(createWorkspace.setSearchQuery(query));
  },
  clearSearch: () => {
    publishCreateWorkspaceSnapshot(createWorkspace.clearSearch());
  },
  toggleTreeFolder: (folderPath) => {
    const navigation = createWorkspace.toggleTreeFolder(folderPath);
    if (navigation.changed) {
      publishCreateWorkspaceSnapshot(navigation.snapshot);
    } else {
      publishReactSnapshot();
    }
  },
  setPathIncluded: (path, included) => {
    publishCreateWorkspaceSnapshot(createWorkspace.setPathIncluded(path, included).snapshot);
  },
  setCurrentFolderIncluded: (included) => {
    publishCreateWorkspaceSnapshot(
      createWorkspace.setCurrentFolderIncluded(
        createWorkspace.getSnapshot().view.currentFolder,
        included,
      ).snapshot,
    );
  },
  setVisibleRowsIncluded: (included) => {
    publishCreateWorkspaceSnapshot(createWorkspace.setVisibleRowsIncluded(included).snapshot);
  },
  selectRow: (intent) => {
    publishCreateWorkspaceSnapshot(createWorkspace.selectRow(intent.path, intent).snapshot);
  },
  applySelection: (input) => {
    publishCreateWorkspaceSnapshot(createWorkspace.updateSelection({
      selectedPaths: new Set(input.selectedPaths),
      focusedPath: input.focusedPath,
      anchorPath: input.anchorPath,
    }).snapshot);
  },
  toggleRowSelection: (path) => {
    publishCreateWorkspaceSnapshot(createWorkspace.toggleRowSelection(path).snapshot);
  },
  focusRow: (path) => {
    publishCreateWorkspaceSnapshot(createWorkspace.focusRow(path).snapshot);
  },
  removeSelectedSources: (fallbackSourcePath) => {
    const selectedSourcePaths = selectedCompressSourcePaths();
    const trimmedFallbackSourcePath = fallbackSourcePath?.trim();
    removeCreateSources(
      selectedSourcePaths.length > 0
        ? selectedSourcePaths
        : trimmedFallbackSourcePath
          ? [trimmedFallbackSourcePath]
          : [],
    );
    publishReactSnapshot();
  },
  showCompressRowContextMenu: (path, sourcePath, x, y) => {
    if (visibleCompressRowForPath(path)) {
      if (!createWorkspace.getSnapshot().selection.selectedPaths.includes(path)) {
        publishCreateWorkspaceSnapshot(createWorkspace.ensureRowSelected(path).snapshot);
      }
      showCompressRowContextMenuForPath(path, sourcePath ?? "", x, y);
    } else if (sourcePath) {
      showSourceContextMenu(sourcePath, x, y);
    }
    publishReactSnapshot();
  },
  runCreate: (password, passwordConfirm, signingIdentityPassword) => runCreate({
    passwordInput: {
      password,
      passwordConfirm,
      signingIdentityPassword,
    },
  }),
});

const appTimers = createAppTimers({
  quickActionAutoCloseDelayMs: QUICK_ACTION_AUTO_CLOSE_DELAY_MS,
  createPlanDebounceMs: 350,
});
const jobTimers = appTimers.jobs;
const createPlanDebounce = appTimers.createPlanDebounce;

function archiveSnapshot(): ArchiveWorkspaceSnapshot {
  return archiveWorkspace.getSnapshot();
}

function archiveCurrentPath(): string {
  return archiveSnapshot().currentArchivePath;
}

function archiveCurrentFolder(): string {
  return archiveSnapshot().view.currentFolder;
}

function archiveBrowseState(): BrowseState {
  return archiveSnapshot().browseState;
}

function archiveEntries(): readonly ArchiveEntryDto[] {
  return archiveSnapshot().entries;
}

function archiveSelectedPathSet(): Set<string> {
  return new Set(archiveSnapshot().view.selection.selectedPaths);
}

function archiveSelectedCount(): number {
  return archiveSnapshot().view.selection.selectedCount;
}

function archiveFocusedPath(): string {
  return archiveSnapshot().view.selection.focusedPath;
}

function archiveSelectionAnchorPath(): string {
  return archiveSnapshot().view.selection.anchorPath;
}

const createPlanController = createCreatePlanController({
  workspace: createWorkspace,
  debounceTimer: createPlanDebounce,
  runPlanCreate,
  publishSnapshot: publishCreateWorkspaceSnapshot,
  canUseBrowserPreview: canUseBrowserCreatePlanPreview,
  browserPreview: (sources) => browserCreatePlanPreview([...sources]),
  toCommandError: asCommandError,
});
const createStartController = createCreateStartController({
  workspace: createWorkspace,
  publishSnapshot: publishCreateWorkspaceSnapshot,
  isSubmissionInFlight: isCreateSubmissionInFlight,
  startCreate: runStartCreate,
  onCreateStarted: (response, request) => {
    recordCreateDestinationHistory(request.destinationPath);
    addJobState(response, {
      focusProgress: true,
      autoCloseAction: "returnToWorkspace",
      progressContext: createJobProgressContext(request),
      outputActions: createJobOutputActions(request),
    });
  },
  toCommandError: asCommandError,
});
const jobFeed = createTauriJobFeed();
const jobSubscriptions = createJobSubscriptionSet(
  jobFeed,
  (jobId, snapshot) => {
    jobsWorkspace.acceptRetainedSnapshot(snapshot);
    void maybePromptForJobPasswordRetry(jobId);
    renderJobs();
    maybeCloseCompletedQuickActionWindow();
  },
  (jobId) => jobsWorkspace.removeJob(jobId),
);
let catalogSubscription: JobFeedSubscription | null = null;

async function subscribeToRetainedJob(jobId: string): Promise<void> {
  return jobSubscriptions.ensure(jobId);
}

async function subscribeToJobCatalog(): Promise<void> {
  if (catalogSubscription) return;
  catalogSubscription = await jobFeed.subscribeCatalog((catalog) => {
    const retained = new Set(catalog.jobs.map((job) => job.jobId));
    jobSubscriptions.reconcile(retained);
    renderJobs();
  });
}
const archiveLoadController = createArchiveLoadController({
  workspace: archiveWorkspace,
  enterExtractWorkspace: () => setWorkspaceMode("extract"),
  startArchiveIndex,
  waitArchiveIndex,
  getArchiveChildren,
  searchArchiveIndex,
  closeArchiveIndex,
  toCommandError: asCommandError,
  renderLoading: (snapshot) => {
    publishArchiveSnapshot(snapshot);
    setOperationalMessage("status.loadingArchive");
  },
  renderPage: (snapshot) => {
    clearTrackedPreviewState();
    contextMenuRuntime.hide();
    applyExtractPreferenceDefaults(snapshot.currentArchivePath);
    publishArchiveSnapshot(snapshot);
    setOperationalMessage("archive.loaded");
  },
  renderLoadError: (snapshot, text) => {
    publishArchiveSnapshot(snapshot);
    setBrowseState("error", text);
  },
  failedListMessage: () => message("browse.failedList"),
  loadErrorMessage: (error, options) => options.includeHint && error.hint
    ? `${error.message}\n${error.hint}`
    : error.message,
  promptForPasswordRetry: promptForArchivePasswordRetry,
});
const archiveOpenController = createArchiveOpenController({
  pathHistoryStore,
  publishPathHistorySnapshot: () => renderExtractDestinationHistory(),
  openArchiveDialogOptions: () => ({
    title: displayContext.translator.t("nativeDialog.openArchive"),
    directory: false,
    multiple: false,
    filters: [ARCHIVE_OPEN_FILTER],
  }),
  openArchiveDialog: openNativeDialog,
  canReadClipboard,
  readClipboardText,
  unsupportedClipboardMessage: () => UNSUPPORTED_OPERATION_MESSAGE,
  clipboardEmptyMessage: () => setOperationalMessage("browse.noArchiveOpen"),
  nativeDialogFailedMessage: () => displayContext.translator.t("nativeDialog.failed"),
  unknownErrorMessage,
  setOperationalStatus,
  clearPreviewState: clearTrackedPreviewState,
  setCurrentArchivePath: () => {},
  loadArchive: (request) => loadArchive(request),
});
const archiveTestController = createArchiveTestController({
  workspace: archiveWorkspace,
  hasCurrentArchive: () => Boolean(archiveCurrentPath()),
  initialPassword: () => undefined,
  runTestArchive,
  addJob: addJobState,
  toCommandError: asCommandError,
  promptForPasswordRetry: promptForArchivePasswordRetry,
  unableStartMessage: () => message("test.unableStart"),
  setBrowseError: (text) => setBrowseState("error", text),
});
const archivePreviewController = createArchivePreviewController({
  workspace: archiveWorkspace,
  hasCurrentArchive: () => Boolean(archiveCurrentPath()),
  isCurrentArchive: (archivePath) => archiveCurrentPath() === archivePath,
  cleanupBeforePreview: applyPreviewCleanupPolicyBeforeNextPreview,
  previewRequestInput: (password) => ({
    overwrite: extractWorkspace.getSnapshot().overwrite,
    stripComponents: extractWorkspace.getSnapshot().stripComponents,
    ...(password ? { password } : {}),
  }),
  cachedPreviewPathForEntry: (entryPath) => shellWorkspace.getCachedPreviewPathForEntry(entryPath),
  runPreviewEntry,
  openPath: openDesktopPath,
  clearTrackedPreviewState,
  trackPreviewResult: (metadata) => {
    shellWorkspace.trackPreviewResultMetadata(metadata);
  },
  toCommandError: asCommandError,
  promptForPasswordRetry: promptForArchivePasswordRetry,
  singleFileRequired: () => setOperationalMessage("command.singleFileRequired"),
  previewUnableMessage: () => message("preview.unablePreview"),
  cachedOpenedMessage: () => message("preview.openedCached"),
  openedOutsideMessage: (writtenBytes) => message("preview.openedOutside", { size: formatBytes(writtenBytes) }),
  previewReadyMessage: (writtenBytes) => message("preview.ready", { size: formatBytes(writtenBytes) }),
  setBrowseLoaded: (text) => {
    setBrowseState("loaded", text);
  },
  setBrowseError: (text) => setBrowseState("error", text),
});
const extractStartController = createExtractStartController({
  workspace: archiveWorkspace,
  hasCurrentArchive: () => Boolean(archiveCurrentPath()),
  joinNativePath,
  startExtract: runStartExtract,
  toCommandError: asCommandError,
  requestPasswordInDialog: requestExtractPasswordInDialog,
  chooseDestinationFirst: () => {
    setOperationalStatus(message("extract.chooseDestinationFirst"));
  },
  selectEntryFirst: () => {
    setOperationalStatus(message("extract.selectEntryFirst"));
  },
  recordDestination: recordExtractDestinationHistory,
  closeExtractDialog: closeReactDialog,
  addJob: addJobState,
  progressContext: extractJobProgressContext,
  outputActions: extractJobOutputActions,
  unableStartMessage: (mode) => message(mode === "selection" ? "extract.unableSelected" : "extract.unableStart"),
  setBrowseError: (text) => setBrowseState("error", text),
});
const appWindowController = createWindowController({
  isQuickActionJobMode,
});

const appWindowEffects = {
  close(): void {
    if (!isDesktopRuntime()) {
      setOperationalMessage("status.closeInBrowser");
      return;
    }

    const hasOpenTaskWindows = disposableTaskWindows.hasOpenWindows();
    const hasActiveJobs = jobsWorkspace.hasActiveJob();
    const closeOrHide = hasOpenTaskWindows || hasActiveJobs
      ? appWindowController.hideCurrentWindow()
      : appWindowController.closeCurrentWindow();
    diagnostics.record({
      scope: "mainWindow",
      name: hasOpenTaskWindows || hasActiveJobs ? "hideRequested" : "closeRequested",
      fields: { hasOpenTaskWindows, hasActiveJobs },
    });
    if (hasOpenTaskWindows || hasActiveJobs) {
      disposableTaskLifecycle.observeMainWindowHiddenForTasks();
      shellWorkspace.setQuickActionWindowShown(false);
    }
    void closeOrHide.catch(() => {
      setOperationalMessage("quick.completed.closeWindow");
    });
  },
  minimize(): void {
    if (!isDesktopRuntime()) {
      return;
    }

    void appWindowController.minimizeCurrentWindow().catch(() => {
      setOperationalMessage("jobs.minimizeFailed");
    });
  },
  toggleMaximize(): void {
    if (!isDesktopRuntime()) {
      return;
    }

    void appWindowController.toggleMaximizeCurrentWindow().catch(() => {
      setOperationalMessage("status.windowControlFailed");
    });
  },
};

const focusedJobWindowEffects = {
  async revealNormalWindow(): Promise<void> {
    await appWindowController.revealNormalWindow();
  },
  async revealProgressWindow(): Promise<void> {
    await appWindowController.revealProgressWindow();
  },
  async minimizeProgressWindow(): Promise<void> {
    await appWindowController.minimizeProgressWindow();
  },
  async restoreNormalWindow(): Promise<void> {
    await appWindowController.restoreNormalWindowGeometryOrCenter();
  },
};

const jobPasswordPrompts = {
  promptForNewArchivePassword(): string | null {
    return promptForArchivePassword(message("create.prompt.newArchivePassword"));
  },
  promptForCommandRetry(commandCode: string): string | null {
    return promptForArchivePassword(getArchivePasswordPrompt(commandCode));
  },
};

const quickActionController = createQuickActionController({
  preferences: () => appPreferences,
  pathHelpers: { nativeParentPath, joinNativePath },
  setOperationalMessage,
  setOperationalStatus,
  message,
  openArchive: openQuickActionArchive,
  runStartCreate,
  runStartExtract,
  toCommandError: asCommandError,
  isPasswordCommandError,
  promptForNewArchivePassword: jobPasswordPrompts.promptForNewArchivePassword,
  promptForCommandRetry: jobPasswordPrompts.promptForCommandRetry,
  recordCreateDestination: recordCreateDestinationHistory,
  recordExtractDestination: recordExtractDestinationHistory,
  addJob: addJobState,
  createProgressContext: createJobProgressContext,
  createOutputActions: createJobOutputActions,
  extractProgressContext: (request) => extractJobProgressContext(request),
  extractOutputActions: extractJobOutputActions,
  showCreateWorkspace,
  readCreateSnapshot: () => createWorkspace.getSnapshot(),
  addCreateSources: (sources) => createWorkspace.addSources(sources).snapshot,
  applyCreateDefaultsForFormat,
  setCreateOptions: (patch) => createWorkspace.setOptions(patch).snapshot,
  setCreateDestinationPath: (path) => createWorkspace.setDestinationPath(path).snapshot,
  publishCreateSnapshot: publishCreateWorkspaceSnapshot,
  cancelQueuedPlanRun,
  runPlan,
  setCurrentArchivePath: () => {},
  loadArchive: (request) => loadArchive(request),
  readBrowseState: archiveBrowseState,
  setBrowseError: (text) => setBrowseState("error", text),
  openExtractDialog,
  diagnostics,
});

const startupController = createStartupController({
  fetchHealthcheck,
  fetchProjectContract,
  fetchQuickActionStartupState,
  isDesktopRuntime,
  revealWindowForStartupQuickAction,
  revealNormalWindow: revealNormalAppWindow,
  activateQuickActionJobs,
  handleQuickActionRequest: routeQuickActionRequest,
  setOperationalStatus,
  setOperationalMessage,
  setBrowseError: (text) => setBrowseState("error", text),
  unknownErrorMessage,
  toCommandError: asCommandError,
  message,
  setBootstrapState: (state) => {
    latestHealthcheck = state.healthcheck;
    latestContract = state.contract;
    
    if (state.contract) {
      const hasNativeMenu = state.contract.platformIntegration.capabilities.some(
        c => c.id === "nativeApplicationMenu" && c.availability === "available"
      );
      browserDocument.setNativeMenuBar(hasNativeMenu);
    }
    
    if (isDesktopRuntime()) {
      import("@tauri-apps/api/webviewWindow").then((module) => {
        module.getCurrentWebviewWindow().isDecorated().then((decorated) => {
          browserDocument.setCustomWindowChrome(!decorated);
        }).catch(() => {
          browserDocument.setCustomWindowChrome(false);
        });
      }).catch(() => {
        browserDocument.setCustomWindowChrome(false);
      });
    } else {
      browserDocument.setCustomWindowChrome(false);
    }
  },
  onBootstrapStateChanged: publishBootstrapStateSnapshot,
  diagnostics,
});

const nativeInboundController = createNativeInboundController({
  isDesktopRuntime,
  listen: listenNativeInboundEvents,
  markFrontendReady: nativeFrontendReady,
  acknowledge: acknowledgeNativeEvent,
  handleQuickAction: routeQuickActionRequest,
  handleHostedAuthCallback,
  revealApplication: revealNormalAppWindow,
  reportFailure: (error) => setOperationalStatus(unknownErrorMessage(
    error,
    message("desktopIntegration.initFailed"),
  )),
  diagnostics,
});

const accountController = createAccountController({
  workspace: accountWorkspace,
  fetchSnapshot: fetchAccountSnapshot,
  beginHostedAuth: beginAccountHostedAuth,
  applyHostedCallback: applyAccountHostedCallback,
  forget: forgetAccount,
  generateRecipientKey: generateAccountRecipientKey,
  removeRecipientKey: removeAccountRecipientKey,
  removeContact: removeAccountContact,
  openUrl: openDesktopPath,
  publish: publishReactSnapshot,
  errorMessage: (error) => unknownErrorMessage(error, "Account operation failed."),
});

const defaultHandlerController = createDefaultHandlerController({
  ...defaultHandlerDesktopAdapter,
  publish: publishReactSnapshot,
  errorMessage: (error) => unknownErrorMessage(error, "Unable to update macOS default handlers."),
});

const jobOutputEffects = {
  async run(outputAction: JobOutputAction): Promise<void> {
    if (outputAction.kind === "open") {
      await openDesktopPath(outputAction.path);
      return;
    }

    await revealInFileManager(outputAction.path);
  },
};

const jobControlController = createJobControlController({
  workspace: jobsWorkspace,
  quickActionAutoCloseTimer: jobTimers,
  cancelJob: cancelJobCommand,
  pauseJob: pauseJobCommand,
  resumeJob: resumeJobCommand,
  dismissJob: dismissJobCommand,
  runTestArchive,
  runStartExtract,
  addJob: addJobState,
  retryOutputActions: retryJobOutputActions,
  runOutputAction: (outputAction) => jobOutputEffects.run(outputAction),
  promptForCommandRetry: jobPasswordPrompts.promptForCommandRetry,
  toCommandError: asCommandError,
  message,
  setOperationalMessage,
  setOperationalStatus,
  renderJobs,
  renderQuickProgress,
  canEvaluateQuickActionCompletion: () => isDesktopRuntime() && isQuickActionJobMode(),
  isQuickActionWindowBackgrounded: () => shellWorkspace.isQuickActionWindowBackgrounded(),
  revealQuickActionJobWindow: () => revealQuickActionJobWindow(),
  closeFocusedJobProgress: () => closeFocusedJobProgress(),
  closeAppWindow,
  diagnostics,
});

function persistPreferencePatch(patch: AppPreferencePatch): AppPreferences {
  appPreferences = preferencesWithPatch(appPreferences, patch);
  saveAppPreferences(appPreferences);
  return appPreferences;
}

function updateCurrentTableColumnSettings(updater: (settings: ArchiveTableColumnSettings) => ArchiveTableColumnSettings) {
  const snapshot = archiveWorkspace.getSnapshot();
  const currentPath = archiveCurrentPath();
  const formatKey = (currentPath ? getKnownArchiveSuffix(currentPath) : null) ?? "default";
  const currentSettings = snapshot.view.tableColumns;
  const nextSettings = updater(currentSettings);
  const nextTableColumnsByFormat = { ...appPreferences.tableColumnsByFormat };
  nextTableColumnsByFormat[formatKey] = nextSettings;
  const sort = archiveWorkspace.getSnapshot().view.sort;
  persistPreferencePatch({
    tableColumnsByFormat: nextTableColumnsByFormat,
    tableSortKey: sort.key,
    tableSortAscending: sort.ascending,
  });
}

function savePreferencePatch(patch: AppPreferencePatch) {
  persistPreferencePatch(patch);
  publishReactSnapshot();
}

function setFlatView(nextFlatView: boolean, persistPreference: boolean) {
  publishArchiveSnapshot(archiveWorkspace.setFlatView(nextFlatView));
  void (nextFlatView
    ? archiveLoadController.loadSearch(currentSearchQuery())
    : archiveLoadController.loadFolder(archiveCurrentFolder()));
  if (persistPreference) {
    savePreferencePatch({ flatViewDefault: nextFlatView });
  }
}

function applySortCommand(nextSortKey: ArchiveSortKey) {
  publishArchiveSnapshot(archiveWorkspace.applySortCommand(nextSortKey));
  const sort = archiveWorkspace.getSnapshot().view.sort;
  savePreferencePatch({ tableSortKey: sort.key, tableSortAscending: sort.ascending });
  void reloadArchivePageForView();
}

function applySortDirection(nextSortKey: ArchiveSortKey, ascending: boolean) {
  publishArchiveSnapshot(archiveWorkspace.applySortDirection(nextSortKey, ascending));
  const sort = archiveWorkspace.getSnapshot().view.sort;
  savePreferencePatch({ tableSortKey: sort.key, tableSortAscending: sort.ascending });
  void reloadArchivePageForView();
}

function reloadArchivePageForView(): Promise<void> {
  const snapshot = archiveWorkspace.getSnapshot();
  return snapshot.view.flatView || snapshot.view.searchQuery.trim()
    ? archiveLoadController.loadSearch(snapshot.view.searchQuery)
    : archiveLoadController.loadFolder(snapshot.view.currentFolder);
}

function closeAppWindow() {
  appWindowEffects.close();
}

function minimizeAppWindow() {
  appWindowEffects.minimize();
}

function toggleAppWindowMaximize() {
  appWindowEffects.toggleMaximize();
}

function clearQuickActionAutoCloseTimer() {
  jobTimers.clearQuickActionAutoClose();
}

function isQuickActionJobMode(): boolean {
  return shellWorkspace.isQuickActionJobMode();
}

function setFocusedJobAutoCloseAction(action: FocusedJobAutoCloseAction) {
  jobsWorkspace.setFocusedJobAutoCloseAction(action);
}

function renderNormalWorkspaceOnce() {
  if (normalWorkspaceRendered) {
    return;
  }

  renderExtractDestinationHistory();
  renderBrowse();
  renderJobs();
  normalWorkspaceRendered = true;
  publishReactSnapshot();
}

async function revealNormalAppWindow() {
  diagnostics.record({
    scope: "mainWindow",
    name: "normalRevealRequested",
    fields: { alreadyShown: shellWorkspace.getSnapshot().quickActionWindow.shown },
  });
  disposableTaskLifecycle.observeNormalLaunch();
  renderNormalWorkspaceOnce();
  if (!isDesktopRuntime() || shellWorkspace.getSnapshot().quickActionWindow.shown) {
    return;
  }

  try {
    await focusedJobWindowEffects.revealNormalWindow();
  } catch {
    // Window APIs are best-effort; the app is still usable if the window was already shown.
  }
  shellWorkspace.setQuickActionWindowShown(true);
}

async function revealQuickActionJobWindow(
  autoCloseAction: FocusedJobAutoCloseAction = "closeWindow",
) {
  const wasInJobMode = isQuickActionJobMode();
  diagnostics.record({
    scope: "mainWindow",
    name: "progressRevealRequested",
    fields: { wasInJobMode, autoCloseAction },
  });
  if (!wasInJobMode || autoCloseAction === "closeWindow") {
    setFocusedJobAutoCloseAction(autoCloseAction);
  }
  if (!wasInJobMode && autoCloseAction === "returnToWorkspace") {
    void appWindowController.persistCurrentWindowGeometry();
  }
  shellWorkspace.setQuickActionWindowMode("jobOnly");
  browserDocument.setQuickActionJobMode(true);
  shellWorkspace.setJobDrawerOpen(false);
  publishReactSnapshot();
  renderQuickProgress();

  if (!isDesktopRuntime()) {
    return;
  }

  try {
    await focusedJobWindowEffects.revealProgressWindow();
  } catch {
    // Do not block job tracking on window-manager or permission failures.
  }
  shellWorkspace.setQuickActionWindowShown(true);
}

async function sendQuickActionJobsToBackground() {
  clearQuickActionAutoCloseTimer();
  if (jobsWorkspace.getFocusedJobAutoCloseAction() === "returnToWorkspace") {
    await closeFocusedJobProgress();
    setOperationalMessage("jobs.background");
    openJobDrawer();
    renderJobs();
    return;
  }

  if (isDesktopRuntime()) {
    shellWorkspace.setQuickActionWindowMode("background");
    setOperationalMessage("jobs.background");
    try {
      await focusedJobWindowEffects.minimizeProgressWindow();
      shellWorkspace.setQuickActionWindowShown(false);
      return;
    } catch {
      setOperationalMessage("jobs.minimizeFailed");
      renderQuickProgress();
      return;
    }
  }

  jobsWorkspace.resetFocusedQuickActionProgress();
  shellWorkspace.setQuickActionWindowMode("normal");
  browserDocument.setQuickActionJobMode(false);
  setOperationalMessage("jobs.background");
  openJobDrawer();
  renderJobs();
}

async function closeFocusedJobProgress() {
  clearQuickActionAutoCloseTimer();
  jobsWorkspace.resetFocusedQuickActionProgress();
  shellWorkspace.setQuickActionWindowMode("normal");
  browserDocument.setQuickActionJobMode(false);
  shellWorkspace.setJobDrawerOpen(false);
  renderNormalWorkspaceOnce();

  if (isDesktopRuntime()) {
    try {
      await focusedJobWindowEffects.restoreNormalWindow();
    } catch {
      // Window restoration is best-effort after a focused job view.
    }
  }
  shellWorkspace.setQuickActionWindowShown(true);
  renderJobs();
}

async function revealWindowForStartupQuickAction(state: QuickActionStartupStateDto) {
  const target = shellWorkspace.selectQuickActionStartupRevealTarget(state);
  diagnostics.record({
    scope: "startup",
    name: "revealTargetSelected",
    fields: {
      target,
      launchedForQuickAction: state.launchedForQuickAction,
      action: state.quickAction?.kind ?? null,
      windowDisposition: state.windowDisposition ?? null,
      jobCount: state.quickActionJobs?.length ?? 0,
      hasError: Boolean(state.error),
    },
  });

  if (target === "jobOnly") {
    disposableTaskLifecycle.observeQuickActionLaunch();
    return;
  }

  await revealNormalAppWindow();
}

function trackQuickActionJob(jobId: string, context?: FocusedJobProgressContext) {
  if (!isQuickActionJobMode()) {
    return;
  }

  clearQuickActionAutoCloseTimer();
  jobsWorkspace.trackFocusedQuickActionJob(jobId, context);
  renderQuickProgress();
}

async function toggleQuickActionPause() {
  await jobControlController.toggleQuickActionPause();
}

async function cancelFocusedQuickActionJobs() {
  await jobControlController.cancelFocusedQuickActionJobs();
}

function maybeCloseCompletedQuickActionWindow() {
  jobControlController.maybeCloseCompletedQuickActionWindow();
}

function clearTrackedPreviewState() {
  shellWorkspace.clearTrackedPreview();
}

function updateStatusBar() {
  publishReactSnapshot();
}

function applyPreferenceClasses() {
  publishReactSnapshot();
}

function formatBytes(value?: number): string {
  return displayContext.format.bytes(value);
}

function message(key: MessageKey, params?: MessageParams): string {
  return displayContext.translator.t(key, params);
}

function setOperationalMessage(key: MessageKey, params?: MessageParams): void {
  setOperationalStatus(message(key, params));
}

function formatDate(value?: string): string {
  return displayContext.format.date(value, { emptyValue: "" });
}

function renderQuickProgress() {
  if (isQuickActionJobMode()) {
    publishReactSnapshot();
  }
}

function infoReturnFocusPath(): string {
  return archiveFocusedPath() || getSelectedEntryPaths()[0] || "";
}

function previewActionHint(): string {
  return message("preview.openTempOutsideHint");
}

function formatLastTestStatusForCurrentArchive(): string | null {
  const currentPath = archiveCurrentPath();
  if (!currentPath) {
    return null;
  }

  const testJobs = Array.from(jobsWorkspace.getJobsMap().entries())
    .map(([jobId, state]) => ({ jobId, state }))
    .filter((item) => {
      const context = jobsWorkspace.getRetryContext(item.jobId);
      return context?.retryKind === "testArchive" && context.archivePath === currentPath;
    })
    .sort((lhs, rhs) => {
      const lhsTime = parseDateValue(lhs.state.snapshot.createdAt)?.getTime();
      const rhsTime = parseDateValue(rhs.state.snapshot.createdAt)?.getTime();
      if (typeof lhsTime !== "number" && typeof rhsTime !== "number") {
        return 0;
      }
      if (typeof lhsTime !== "number") {
        return 1;
      }
      if (typeof rhsTime !== "number") {
        return -1;
      }
      return rhsTime - lhsTime;
    });

  if (!testJobs.length) {
    return null;
  }

  const state = testJobs[0].state;
  const latestEvent = state.events[state.events.length - 1];
  const status = state.snapshot.status;
  const statusLabel = message(jobStatusMessageKey(status));

  if (!latestEvent?.message) {
    return message("detail.lastTest", { status: statusLabel });
  }

  if (latestEvent.message === status || latestEvent.message.length > 120) {
    return message("detail.lastTest", { status: statusLabel });
  }

  return message("detail.lastTestWithMessage", { status: statusLabel, message: latestEvent.message });
}

function jobStatusMessageKey(status: JobState["snapshot"]["status"]): MessageKey {
  switch (status) {
    case "queued":
      return "jobs.status.queued";
    case "running":
      return "jobs.status.running";
    case "paused":
      return "jobs.status.paused";
    case "cancelling":
      return "jobs.status.running";
    case "completed":
      return "jobs.status.completed";
    case "failed":
      return "jobs.status.failed";
    case "cancelled":
      return "jobs.status.cancelled";
  }
}

function normalizeEntryPath(path: string): string {
  return normalizeArchivePath(path);
}

function createJobProgressContext(request: StartCreateRequest): FocusedJobProgressContext {
  return {
    kind: "create",
    sources: [...request.sources],
    destinationPath: request.destinationPath,
    format: request.format,
    cleanSource: request.cleanSource,
    ...(request.tzapRecoveryPercentage !== undefined
      ? { tzapRecoveryPercentage: request.tzapRecoveryPercentage }
      : {}),
  };
}

function createJobOutputActions(request: StartCreateRequest): JobOutputAction[] {
  return request.destinationPath ? [{ kind: "reveal", path: request.destinationPath }] : [];
}

function extractJobProgressContext(
  request: StartExtractRequest,
  title: "archive" | "selection" = "archive",
): FocusedJobProgressContext {
  return {
    kind: "extract",
    title,
    archivePath: request.archivePath,
    destinationPath: request.destinationPath,
    overwrite: request.overwrite,
    ...(request.entryPaths?.length ? { entryPaths: [...request.entryPaths] } : {}),
  };
}

function extractJobOutputActions(request: StartExtractRequest): JobOutputAction[] {
  return request.destinationPath ? [{ kind: "open", path: request.destinationPath }] : [];
}

function retryJobOutputActions(context: JobRetryContext): JobOutputAction[] {
  if (context.retryKind === "extractArchive") {
    return context.destinationPath ? [{ kind: "open", path: context.destinationPath }] : [];
  }

  return [];
}

function getBaseName(path: string): string {
  return getPathBasename(path, path);
}

function systemIconRequestForPath(path: string, isDirectory: boolean): SystemFileIconRequestEntry {
  const lookupPath = isDirectory ? "folder" : systemIconLookupPath(path);
  return {
    key: isDirectory ? "directory" : `file:${lookupPath.toLowerCase()}`,
    path: lookupPath,
    isDirectory,
  };
}

function systemIconLookupPath(path: string): string {
  const suffix = getKnownArchiveSuffix(path);
  if (suffix) {
    return suffix;
  }

  const extension = pathExtension(path);
  return extension ? `.${extension}` : "file";
}

function pathExtension(path: string): string | null {
  const name = getBaseName(path);
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
}

function systemIconRequestForEntry(entry: ArchiveEntryDto): SystemFileIconRequestEntry | null {
  if (entry.kind === "directory") {
    return systemIconRequestForPath("folder", true);
  }
  if (entry.kind === "special") {
    return null;
  }

  return systemIconRequestForPath(entry.path, false);
}

function systemIconDataUrlForRequest(request: SystemFileIconRequestEntry | null): string | null {
  if (!appPreferences.showRealFileIcons || !request) {
    return null;
  }

  return systemIconDataUrls.get(request.key) ?? null;
}

function collectSystemIconRequests(): SystemFileIconRequestEntry[] {
  if (!appPreferences.showRealFileIcons) {
    return [];
  }

  const archive = archiveSnapshot();
  const create = createWorkspace.getSnapshot();
  const requests = new Map<string, SystemFileIconRequestEntry>();
  const add = (request: SystemFileIconRequestEntry | null) => {
    if (request && !systemIconDataUrls.has(request.key)) {
      requests.set(request.key, request);
    }
  };

  if (archive.currentArchivePath) {
    add(systemIconRequestForPath(archive.currentArchivePath, false));
    add(systemIconRequestForPath("folder", true));
    for (const entry of archive.entries) {
      add(systemIconRequestForEntry(entry));
    }
  }

  const createEntries = create.plan.current?.planEntries ?? [];
  if (createEntries.length) {
    add(systemIconRequestForPath("folder", true));
    for (const entry of createEntries) {
      add(systemIconRequestForPath(entry.sourcePath, entry.kind === "directory"));
    }
  }

  return [...requests.values()];
}

function queueSystemIconRefresh() {
  if (!isDesktopRuntime()) {
    return;
  }

  const entries = collectSystemIconRequests();
  if (!entries.length) {
    return;
  }

  const requestRevision = ++systemIconRequestRevision;
  void fetchSystemFileIcons({ entries })
    .then((response) => {
      if (requestRevision < systemIconRequestRevision) {
        return;
      }

      for (const icon of response.icons) {
        systemIconDataUrls.set(icon.key, icon.dataUrl ?? null);
      }
      publishReactSnapshot();
    })
    .catch(() => {
      for (const entry of entries) {
        systemIconDataUrls.set(entry.key, null);
      }
    });
}

function createPlanStatusText(status: CreateWorkspacePlanStatus | null): string {
  if (!status) {
    return "";
  }
  if (status.messageKey) {
    return message(status.messageKey as MessageKey);
  }
  return status.fallbackText ?? "";
}

function publishCreateWorkspaceSnapshot(
  snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot(),
): CreateWorkspaceSnapshot {
  queueSystemIconRefresh();
  publishReactSnapshot();
  return snapshot;
}

function createDestinationSuggestionOptions() {
  return {
    defaultDirectory: defaultCreateDirectory(appPreferences),
    nativeParentPath,
  };
}

function joinNativePath(parentPath: string, childName: string): string {
  const trimmedParent = parentPath.trim().replace(/[\\/]+$/, "");
  if (!trimmedParent) {
    return childName;
  }
  const separator = trimmedParent.includes("\\") ? "\\" : "/";
  return `${trimmedParent}${separator}${childName}`;
}

function suggestedCreateArchiveDefaultPath(_sources = createWorkspace.getSnapshot().sources): string {
  return createWorkspace.suggestedDestinationPath(createDestinationSuggestionOptions());
}

function createOutputFolderDefaultPath(destinationPath: string): string {
  const trimmed = destinationPath.trim();
  return nativeParentPath(trimmed || suggestedCreateArchiveDefaultPath());
}

function extractionDefaultsForArchive(archivePath: string): ExtractWorkspaceDefaults {
  const parent = nativeParentPath(archivePath);
  const configuredBase = appPreferences.customExtractFolderPath.trim() || defaultCreateDirectory(appPreferences) || parent;
  const suffix = getKnownArchiveSuffix(archivePath);
  const archiveName = getPathBasename(archivePath, APP_TITLE);
  const folderName = suffix && archiveName.toLowerCase().endsWith(suffix.toLowerCase())
    ? archiveName.slice(0, -suffix.length)
    : archiveName;
  const destinationPath = appPreferences.defaultExtractionBehavior === "extractHere"
    ? parent
    : joinNativePath(configuredBase, folderName || APP_TITLE);

  return {
    destinationPath,
    pathMode: appPreferences.defaultExtractPathMode,
    overwrite: appPreferences.defaultExtractOverwrite,
    stripComponents: appPreferences.defaultExtractStripComponents,
    deduplicateRoot: appPreferences.defaultExtractDeduplicateRoot,
    tzapRestorePolicy: appPreferences.defaultTzapRestorePolicy,
    tzapAllowDegraded: appPreferences.defaultTzapAllowDegraded,
    tzapAllowAbsoluteSymlinks: appPreferences.defaultTzapAllowAbsoluteSymlinks,
    ignoreSymlinks: appPreferences.defaultExtractIgnoreSymlinks,
  };
}

function applyExtractPreferenceDefaults(archivePath = archiveCurrentPath()) {
  extractWorkspace.applyDefaults(extractionDefaultsForArchive(archivePath));
}

function nativeParentPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash > 0 ? trimmed.slice(0, slash) : "";
}

function getEntryByPath(path: string): ArchiveEntryDto | null {
  const normalized = normalizeEntryPath(path);
  return archiveWorkspace.getSnapshot().entries
    .find((entry) => normalizeEntryPath(entry.path) === normalized) ?? null;
}

function getSelectedEntryDtos(): ArchiveEntryDto[] {
  return [...archiveWorkspace.getSnapshot().view.selection.selectedEntries];
}

function getVisibleSelectedEntryDtos(): ArchiveEntryDto[] {
  return [...archiveWorkspace.getSnapshot().view.selection.visibleSelectedEntries];
}

function getVisibleSelectedRows(): SelectableBrowserRow[] {
  return [...archiveWorkspace.getSnapshot().view.selection.visibleSelectedRows];
}

function getSelectedEntryPaths(): string[] {
  return [...archiveWorkspace.getSnapshot().view.selection.selectedEntryPaths];
}

async function startNativeDragOut(entryPath: string) {
  if (!archiveCurrentPath()) {
    return;
  }

  if (!isDesktopRuntime()) {
    setOperationalMessage("preview.nativeDragDesktopOnly");
    return;
  }

  if (!archiveSelectedPathSet().has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
  }

  let password: string | undefined;
  let requestResult = archiveWorkspace.buildNativeDragRequest({ entryPath, password });
  if (!requestResult.ok) {
    setOperationalMessage("preview.selectEntryToDrag");
    return;
  }
  let request = requestResult.request;

  setOperationalMessage("preview.preparingDrag", { count: request.entryPaths.length });

  while (true) {
    try {
      const response = await startNativeFileDrag(request);
      archiveWorkspace.clearPasswordRetry();
      if (response.outcome === "pending") {
        if (response.sessionId) {
          pendingNativeDragCounts.set(response.sessionId, response.draggedEntries.length);
        }
        setOperationalMessage("preview.dragPromiseStarted", {
          count: response.draggedEntries.length,
        });
      } else if (response.outcome === "cancelled") {
        setOperationalMessage("preview.dragCancelled");
      } else if (response.outcome === "noDrop") {
        setOperationalMessage("preview.dragNoDrop");
      } else {
        setOperationalMessage("preview.draggedOut", { count: response.draggedEntries.length });
      }
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      const retry = requestArchivePasswordRetry("nativeDragOut", commandError);
      if (retry) {
        const nextPassword = promptForArchivePasswordRetry(retry);
        if (!nextPassword) {
          archiveWorkspace.clearPasswordRetry();
          setOperationalStatus(commandError?.message ?? message("preview.unableStartDrag"));
          return;
        }
        password = nextPassword;
        requestResult = archiveWorkspace.buildNativeDragRequest({ entryPath, password });
        if (!requestResult.ok) {
          setOperationalMessage("preview.selectEntryToDrag");
          return;
        }
        request = requestResult.request;
        continue;
      }

      setOperationalStatus(commandError?.message ?? message("preview.unableStartDrag"));
      return;
    }
  }
}

function getVisibleSelectablePaths(): string[] {
  return [...archiveWorkspace.getSnapshot().view.selection.visibleSelectablePaths];
}

function currentArchiveTableSelectionState() {
  const selection = archiveWorkspace.getSnapshot().view.selection;
  return {
    selectedPaths: new Set(selection.selectedPaths),
    focusedPath: selection.focusedPath,
    anchorPath: selection.anchorPath,
  };
}

function applyArchiveTableSelection(result: HierarchicalTableSelectionResult) {
  publishArchiveSnapshot(archiveWorkspace.updateSelection(result));
}

function currentSearchQuery(): string {
  return archiveSnapshot().view.searchQuery.trim();
}

function archiveListingFromFixture(listing: ArchiveFixture): ArchiveListingDto {
  return {
    archivePath: listing.archivePath,
    entries: [...listing.entries],
    entryCount: typeof listing.entryCount === "number" ? listing.entryCount : listing.entries.length,
    ...(typeof listing.totalSize === "number" ? { totalSize: listing.totalSize } : {}),
  };
}

function publishArchiveSnapshot(
  snapshot: ArchiveWorkspaceSnapshot = archiveWorkspace.getSnapshot(),
): ArchiveWorkspaceSnapshot {
  queueSystemIconRefresh();
  publishReactSnapshot();
  return snapshot;
}

function clearSearch() {
  if (!currentSearchQuery()) {
    return;
  }
  publishArchiveSnapshot(archiveWorkspace.clearSearch());
  void archiveLoadController.loadFolder(archiveCurrentFolder());
}

function currentWorkspaceMode(): WorkspaceDropMode {
  return shellWorkspace.getSnapshot().activeMode;
}

function renderOperationalStatus() {
  publishReactSnapshot();
}

function setOperationalStatus(message: string) {
  shellWorkspace.setOperationalStatus(message);
  renderOperationalStatus();
}

function setBrowseState(next: BrowseState, message = "") {
  const snapshot = archiveWorkspace.setBrowseState(next);
  publishArchiveSnapshot(snapshot);

  if (message) {
    setOperationalStatus(message);
  } else if (next === "loading") {
    setOperationalMessage("status.loadingArchive");
  } else if (next === "error") {
    setOperationalMessage("status.failed");
  } else {
    setOperationalMessage("status.ready");
  }
}

function currentCommandClassState(hasArchive = Boolean(archiveCurrentPath())): CommandSurfaceClassState {
  const mode = currentWorkspaceMode();
  return {
    open: { primary: mode === "extract" && !hasArchive },
    refresh: { secondary: true },
  };
}

function promptForArchivePassword(promptMessage: string): string | null {
  return passwordPromptAdapter.promptForPassword(promptMessage);
}

function getArchivePasswordPrompt(commandCode: string): string {
  return commandCode === COMMAND_PASSWORD_REQUIRED
    ? displayContext.translator.t("browse.passwordRequired")
    : displayContext.translator.t("browse.passwordInvalid");
}

function requestArchivePasswordRetry(
  operation: ArchiveWorkspacePasswordRetryOperation,
  commandError: ReturnType<typeof asCommandError>,
): ArchiveWorkspacePasswordRetry | null {
  return archiveWorkspace.requestPasswordRetry({
    operation,
    error: commandError,
  });
}

function promptForArchivePasswordRetry(retry: ArchiveWorkspacePasswordRetry): string | null {
  return promptForArchivePassword(message(retry.promptKey));
}

function isPasswordCommandError(commandError: ReturnType<typeof asCommandError>): boolean {
  return (
    commandError?.code === COMMAND_PASSWORD_REQUIRED ||
    commandError?.code === COMMAND_INVALID_PASSWORD
  );
}

function canRetryJobWithPassword(jobId: string, state: JobState): boolean {
  return jobsWorkspace.canRetryJobWithPassword(jobId, state);
}

function currentCommandStateMap() {
  const snapshot = archiveWorkspace.getSnapshot();
  const commandContext = snapshot.command;

  return selectCommandState({
    ...commandContext,
    mutableOperationsSupported: false,
    jobRunning: hasActiveJob(),
  });
}

function updateCommandState() {
  publishReactSnapshot();
}

const commandRouter = createCommandRouter({
  getCommandState: currentCommandStateMap,
  effects: {
    openArchive: (source, archivePath) => {
      if (source === "clipboard") {
        void openArchiveFromClipboard();
        return;
      }
      if (source === "path" && archivePath) {
        void openArchiveFromPath(archivePath);
        return;
      }
      void onOpenArchive();
    },
    closeArchive: closeCurrentArchive,
    addSources: (anchor) => {
      if (anchor) {
        showAddSourcesMenuAt(anchor.x, anchor.y);
        return;
      }

      void addSourcePathsFromDialog("files");
    },
    selectAll: selectVisibleEntries,
    deselectAll: clearBrowseSelection,
    invertSelection: invertVisibleSelectionEntries,
    selectByType: () => selectEntriesByType("add"),
    deselectByType: () => selectEntriesByType("remove"),
    openRoot: () => navigateToFolder(""),
    upOneLevel: navigateUp,
    openInside: () => {
      const selected = getSelectedEntryPaths();
      if (selected.length !== 1) {
        setOperationalMessage("command.singleFileRequired");
        return;
      }
      navigateToFolder(selected[0]);
    },
    openOutside: () => void onOpenOutsideSelectedEntry(),
    extract: (mode, destination) => {
      if (destination === "here") {
        const parent = nativeParentPath(archiveCurrentPath());
        void startExtract(mode, {
          ...extractWorkspace.buildStartInput(),
          destinationBasePath: parent,
        });
        return;
      }
      void startExtract(mode, extractWorkspace.buildStartInput());
    },
    test: () => void onTestArchive(),
    view: () => void onPreviewSelectedEntry(),
    copySelectedPaths: () => void copySelectedEntryPathsToClipboard(),
    info: (target, entryPath) => {
      if (target === "archive") {
        showArchiveInfo();
        return;
      }
      if (target === "context") {
        const selectedRows = getVisibleSelectedRows();
        if (selectedRows.length > 1) {
          showSelectionInfo(selectedRows);
          return;
        }
        if (entryPath) {
          showEntryInfo(entryPath);
          return;
        }
        showArchiveInfo();
        return;
      }
      showCurrentInfo();
    },
    refresh: () => void onRefreshArchive(),
    exit: closeAppWindow,
    detailsView: () => setOperationalMessage("status.detailsViewActive"),
    sort: (key) => applySortCommand(key),
    toggleToolbarLabels: () => {
      savePreferencePatch({ showToolbarLabels: !appPreferences.showToolbarLabels });
    },
    options: openPreferencesDialog,
    about: openAboutDialog,
    toggleFlatView: () => setFlatView(!archiveSnapshot().view.flatView, true),
    deleteTempFiles: () => void onDeleteTemporaryFiles(),
    jobs: openJobDrawer,
    reportDisabled: (_commandId, reason) => {
      setOperationalStatus(localizedCommandStateReason(reason) ?? UNSUPPORTED_OPERATION_MESSAGE);
    },
    reportUnsupported: () => {
      setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE);
    },
  },
});

function commandPayload(commandId: CommandId): CommandRouterPayload {
  if (commandId === "extract") {
    return { extractMode: archiveSelectedCount() ? "selection" : "archive" };
  }

  return {};
}

function runRoutedCommand(commandId: CommandId, payload: CommandRouterPayload = {}): void {
  commandRouter.run(commandId, { ...commandPayload(commandId), ...payload });
}

function createCurrentReactSnapshot(): ZManagerReactSnapshot {
  const archive = archiveWorkspace.getSnapshot();
  const nowMs = Date.now();
  const commandClassState = currentCommandClassState(archive.command.hasArchive);

  return createZManagerReactSnapshot({
    account: accountWorkspace.getSnapshot(),
    defaultHandlers: defaultHandlerController.getSnapshot(),
    shell: shellWorkspace.getSnapshot(),
    archive,
    create: createWorkspace.getSnapshot(),
    extract: extractWorkspace.getSnapshot(),
    jobs: jobsWorkspace.getJobListSnapshot(nowMs),
    quickActionProgress: jobsWorkspace.getFocusedQuickActionProgressSnapshot(nowMs),
    systemIcons: Object.fromEntries(systemIconDataUrls),
    preferences: appPreferences,
    preferencesDraft: preferencesDialogDraft,
    pathHistory: pathHistoryStore.getSnapshot(),
    display: displaySnapshotFromContext(displayContext),
    commands: {
      states: currentCommandStateMap(),
      pressed: {
        flatView: archive.view.flatView,
        showButtonText: appPreferences.showToolbarLabels,
      },
      primaryCommandIds: commandIdsWithClass(commandClassState, "primary"),
      secondaryCommandIds: commandIdsWithClass(commandClassState, "secondary"),
    },
    contextMenu: contextMenuRuntime.getSnapshot(),
    runtime: { isDesktop: isDesktopRuntime() },
    dialog: reactDialogSnapshot,
  });
}

function commandIdsWithClass(
  classState: CommandSurfaceClassState,
  kind: "primary" | "secondary",
): CommandId[] {
  return (Object.keys(classState) as CommandId[])
    .filter((commandId) => Boolean(classState[commandId]?.[kind]));
}

function publishReactSnapshot() {
  reactRuntimeStore.publishSnapshot();
}

function handleReactJobsIntent(intent: ZManagerJobsIntent) {
  switch (intent.type) {
    case "openDrawer":
      openJobDrawer();
      break;
    case "closeDrawer":
      closeJobDrawer();
      break;
    case "poll":
      break;
    case "cancel":
      void onCancelJob(intent.jobId);
      break;
    case "pause":
      void onPauseJob(intent.jobId);
      break;
    case "resume":
      void onResumeJob(intent.jobId);
      break;
    case "dismiss":
      void onDismissJob(intent.jobId);
      break;
    case "retryPassword":
      void retryJobWithPasswordPrompt(intent.jobId);
      break;
    case "runOutputAction":
      void onJobOutputAction(intent.jobId, String(intent.actionIndex), intent.kind);
      break;
    case "backgroundFocused":
      void sendQuickActionJobsToBackground();
      break;
    case "toggleQuickActionPause":
      void toggleQuickActionPause();
      break;
    case "cancelFocusedQuickActionJobs":
      void cancelFocusedQuickActionJobs();
      break;
  }
}

function handleReactAccountIntent(intent: ZManagerAccountIntent) {
  switch (intent.type) {
    case "open": void accountController.open(); break;
    case "close": accountController.close(); break;
    case "refresh": void accountController.open(); break;
    case "beginHostedAuth": void accountController.beginHostedAuth(Boolean(intent.local)); break;
    case "forget": void accountController.forget(); break;
    case "generateRecipientKey": void accountController.generateRecipientKey(intent.label); break;
    case "removeRecipientKey": void accountController.removeRecipientKey(intent.id); break;
    case "removeContact": void accountController.removeContact(intent.id); break;
  }
}

function handleReactDialogIntent(intent: ZManagerDialogIntent) {
  switch (intent.type) {
    case "extract":
      openExtractDialog(intent.mode);
      break;
    case "extractHere":
      openExtractHereDialog(intent.mode);
      break;
    case "submitExtract":
      activeExtractMode = intent.mode;
      activeExtractDialogForm = extractDialogFormFromIntent(intent);
      activeExtractDialogMessage = extractDialogMessageForMode(intent.mode);
      void startExtract(
        intent.mode,
        extractStartInputFromDialogForm(activeExtractDialogForm, intent.password),
      );
      break;
    case "browseExtractDestination":
      void onSelectDestinationForExtract(extractDialogFormFromIntent(intent));
      break;
    case "preferences":
      openPreferencesDialog();
      break;
    case "about":
      openAboutDialog();
      break;
    case "info":
      if (intent.target === "archive") {
        showArchiveInfo();
      } else if (intent.entryPath) {
        showEntryInfo(intent.entryPath);
      } else {
        showCurrentInfo();
      }
      break;
    case "infoAction":
      handleInfoDialogAction(intent.action, intent.copyValue);
      break;
    case "copyAboutDiagnostics":
      void copyAboutDiagnostics();
      break;
    case "preferencesPatch":
      updateReactPreferencesDraft(intent.patch);
      break;
    case "preferencesCreateDefaultsPatch":
      updateReactCreateDefaultsDraft(intent.format, intent.patch);
      break;
    case "preferencesChooseOutput":
      void onSelectReactPreferenceOutputFolder();
      break;
    case "preferencesChooseExtractOutput":
      void onSelectReactPreferenceExtractFolder();
      break;
    case "preferencesChooseTzapSigningFile":
      void choosePreferenceTzapSigningFile(intent.target);
      break;
    case "preferencesGenerateTzapIdentity":
      void generatePreferenceTzapIdentity(intent.commonName, intent.password);
      break;
    case "defaultHandlersRefresh":
      void defaultHandlerController.refresh();
      break;
    case "defaultHandlersSet":
      void defaultHandlerController.set();
      break;
    case "defaultHandlersRestore":
      void defaultHandlerController.restore();
      break;
    case "preferencesSave":
      void saveReactPreferencesDraft();
      break;
    case "preferencesCancel":
      cancelReactPreferencesDialog();
      break;
    case "closeCurrent": {
      if (reactDialogSnapshot.kind !== "none") {
        closeReactDialog();
        break;
      }
      publishReactSnapshot();
      break;
    }
  }
}

function handleReactDesktopIntent(intent: ZManagerDesktopIntent) {
  switch (intent.type) {
    case "droppedPaths":
      handleDroppedPaths(intent.paths);
      break;
    case "dropEntered":
      if (intent.paths?.length) {
        setDropOverlayForPaths(intent.paths);
      } else {
        setDropOverlayForSurface(currentDropSurface());
      }
      break;
    case "dropLeft":
      clearDropOverlay();
      break;
    case "dropChoice":
      activatePendingDropChoice(intent.choice);
      break;
    case "windowControl":
      if (intent.control === "minimize") {
        minimizeAppWindow();
      } else if (intent.control === "toggleMaximize") {
        toggleAppWindowMaximize();
      } else {
        closeAppWindow();
      }
      break;
    case "beginWindowResize":
      if (browserDocument.usesManualWindowResize()) {
        void appWindowController.beginResizeDrag(intent.direction as AppWindowResizeDirection);
      }
      break;
  }
}

function handleReactContextMenuIntent(intent: ZManagerContextMenuIntent) {
  contextMenuRuntime.handleIntent(intent, handleContextMenuAction);
}

function handleArchiveDetailsAction(action: string) {
  if (action === "clear-search") {
    clearSearch();
    return;
  }

  const routedCommand = selectDetailsCommand(action);
  if (routedCommand) {
    runRoutedCommand(routedCommand.commandId, routedCommand.payload);
  }
}

function handleReactKeyboardIntent(intent: ZManagerKeyboardIntent) {
  switch (intent.type) {
    case "escape":
      contextMenuRuntime.hide();
      if (preferencesDialogDraft) {
        cancelReactPreferencesDialog();
      } else if (reactDialogSnapshot.kind !== "none") {
        closeReactDialog();
      } else if (shellWorkspace.getSnapshot().jobDrawerOpen) {
        closeJobDrawer();
      } else {
        clearBrowseSelection();
      }
      break;
    case "focusSearch": {
      if (!archiveSnapshot().command.canSearchEntries) {
        setOperationalMessage("browse.noArchiveOpen");
      }
      break;
    }
  }
}

export function getZManagerRuntimeAdapter(): ZManagerReactRuntimeAdapter {
  return {
    getSnapshot: reactRuntimeStore.getSnapshot,
    subscribe: reactRuntimeStore.subscribe,
    actions: {
      executeCommand: runRoutedCommand,
      setWorkspaceMode,
      handleArchiveIntent: archiveRuntimeActions.handleIntent,
      handleCreateIntent: createRuntimeActions.handleIntent,
      handleJobsIntent: handleReactJobsIntent,
      handleAccountIntent: handleReactAccountIntent,
      handleDialogIntent: handleReactDialogIntent,
      handleDesktopIntent: handleReactDesktopIntent,
      handleContextMenuIntent: handleReactContextMenuIntent,
      handleKeyboardIntent: handleReactKeyboardIntent,
    },
  };
}

function setWorkspaceMode(mode: WorkspaceDropMode) {
  if (currentWorkspaceMode() === mode) {
    publishReactSnapshot();
    return;
  }

  shellWorkspace.setWorkspaceMode(mode);
  setOperationalMessage(mode === "compress" ? "workspace.mode.compressStatus" : "workspace.mode.extractStatus");
}

function navigateToCompressFolder(folderPath: string) {
  const navigation = createWorkspace.navigateToFolder(folderPath);
  if (!navigation.accepted) {
    return;
  }
  publishCreateWorkspaceSnapshot(navigation.snapshot);
}

function renderDetails() {
  publishReactSnapshot();
}

function renderBrowse() {
  publishArchiveSnapshot();
}

function browserCreatePlanPreview(paths: string[]): CreatePlanResponse {
  const planEntries: CreatePlanEntryDto[] = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)))
    .map((path) => {
      const name = getPathBasename(path) || path;
      const looksLikeFile = Boolean(pathExtension(path)) || isSupportedArchivePath(path);
      return {
        path: name,
        kind: looksLikeFile ? "file" : "directory",
        size: looksLikeFile ? 0 : undefined,
        sourcePath: path,
      };
    });
  return {
    includedCount: planEntries.length,
    excludedCount: 0,
    totalBytes: 0,
    excludedBytes: 0,
    entries: planEntries.map((entry) => entry.path),
    planEntries,
    excludedEntries: [],
    warnings: [],
  };
}

function canUseBrowserCreatePlanPreview(): boolean {
  return !isDesktopRuntime();
}

function createPlanEntries(snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot()): CreatePlanEntryDto[] {
  return snapshot.plan.current?.planEntries ?? [];
}

function compressRowInclusionState(row: CompressPlanRow): "included" | "excluded" | "partial" {
  return createWorkspace.getRowInclusionState(row);
}

function setCompressPathIncluded(path: string, included: boolean) {
  createWorkspace.setPathIncluded(path, included);
}

function clearCreateSources() {
  const result = createWorkspace.clearSources();
  createWorkspace.clearSelection();
  publishCreateWorkspaceSnapshot(result.snapshot);
  queuePlanRun();
}

function removeCreateSources(sourcePaths: string[]) {
  const result = createWorkspace.removeSources(sourcePaths);
  if (!result.changed) {
    return;
  }
  createWorkspace.clearSelection();
  publishCreateWorkspaceSnapshot(result.snapshot);
  queuePlanRun();
}

function visibleCompressRows(): CompressPlanRow[] {
  return [...createWorkspace.getSnapshot().view.rows];
}

function visibleCompressRowForPath(path: string): CompressPlanRow | undefined {
  const normalizedPath = normalizeEntryPath(path);
  return visibleCompressRows().find((row) => normalizeEntryPath(row.path) === normalizedPath);
}

function sourcePathForCompressRow(
  row: CompressPlanRow,
  snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot(),
): string {
  return sourcePathForCreatePlanRow(row, createPlanEntries(snapshot), snapshot.sources);
}

function selectedCompressSourcePaths(): string[] {
  const snapshot = createWorkspace.getSnapshot();
  return Array.from(new Set(
    snapshot.selection.selectedPaths
      .map((rowPath) => removableSourcePathForCompressPath(rowPath, snapshot))
      .filter(Boolean),
  ));
}

function removableSourcePathForCompressPath(
  rowPath: string,
  snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot(),
): string {
  if (!rowPath || snapshot.view.currentFolder) {
    return "";
  }

  const row = visibleCompressRowForPath(rowPath);
  const sourcePath = row ? sourcePathForCompressRow(row, snapshot) : "";
  return snapshot.sources.includes(sourcePath) &&
      normalizeEntryPath(rowPath) === getPathBasename(sourcePath)
    ? sourcePath
    : "";
}

function sourcePathsForCompressMenu(rowSourcePath: string): string[] {
  const selectedSourcePaths = selectedCompressSourcePaths();
  if (!rowSourcePath) {
    return selectedSourcePaths;
  }
  return selectedSourcePaths.includes(rowSourcePath) && selectedSourcePaths.length > 1
    ? selectedSourcePaths
    : [rowSourcePath];
}

function compressPathsForContextAction(rowPath: string): string[] {
  const selection = createWorkspace.getSnapshot().selection;
  if (!rowPath) {
    return [];
  }
  if (selection.selectedPaths.includes(rowPath) && selection.selectedPaths.length > 1) {
    const visiblePaths = new Set(selection.visibleSelectablePaths);
    return selection.selectedPaths.filter((path) => visiblePaths.has(path));
  }
  return [rowPath];
}

function renderJobs() {
  const snapshot = jobsWorkspace.getJobListSnapshot(Date.now());
  renderQuickProgress();
  syncProgressClock(snapshot.progressClock);
  publishReactSnapshot();
  maybeCloseQuickActionOnlyCoordinator();
}

function maybeCloseQuickActionOnlyCoordinator(): void {
  const input = {
    desktopRuntime: isDesktopRuntime(),
    hasOpenTaskWindows: disposableTaskWindows.hasOpenWindows(),
    hasActiveJobs: jobsWorkspace.hasActiveJob(),
    mainWindowShown: shellWorkspace.getSnapshot().quickActionWindow.shown,
  };
  if (!disposableTaskLifecycle.shouldCloseCoordinator(input)) {
    return;
  }
  diagnostics.record({
    scope: "quickActionLifecycle",
    name: "coordinatorCloseRequested",
    fields: {
      ...input,
      quickActionOnlyCoordinator: disposableTaskLifecycle.getSnapshot().quickActionOnlyCoordinator,
      quickActionActivityObserved: disposableTaskLifecycle.getSnapshot().quickActionActivityObserved,
      pendingQuickActionRequests: disposableTaskLifecycle.getSnapshot().pendingQuickActionRequests,
    },
  });
  void appWindowController.closeCurrentWindow();
}

function queuePlanRun() {
  createPlanController.queuePlanRun();
}

function cancelQueuedPlanRun() {
  createPlanController.cancelQueuedPlanRun();
}

function recordExtractDestinationHistory(destination: string): void {
  archiveOpenController.recordExtractDestinationHistory(destination);
}

function renderExtractDestinationHistory() {
  if (reactDialogSnapshot.kind === "extract") {
    updateOpenExtractDialogSnapshot();
  } else {
    publishReactSnapshot();
  }
}

function recordCreateDestinationHistory(destination: string): void {
  archiveOpenController.recordCreateDestinationHistory(destination);
}

function recordRecentArchiveHistory(archivePath: string): void {
  archiveOpenController.recordRecentArchiveHistory(archivePath);
}

function extractDialogMessageForMode(mode: ExtractMode): string {
  const selectedCount = archiveSelectedCount();
  return mode === "selection"
    ? message("extract.selectedMessage", {
      count: selectedCount,
      entryLabel: message(selectedCount === 1 ? "extract.entrySingular" : "extract.entryPlural"),
    })
    : message("extract.archiveMessage");
}

function requestExtractPasswordInDialog(retry: ArchiveWorkspacePasswordRetry) {
  extractWorkspace.setOptions({ passwordPromptOpen: true });
  setOperationalStatus(message(retry.promptKey));
  publishReactSnapshot();
}

function toNumberOrUndefined(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : Math.trunc(parsed);
}

function currentExtractDialogStripComponents(): number {
  return toNumberOrUndefined(activeExtractDialogForm.stripComponents) ?? 0;
}

async function openNativeDialog(options: NativeDialogOpenOptions) {
  return openRuntimeDialog(options, setOperationalStatus, {
    unavailableInBrowser: message("nativeDialog.unavailableInBrowser"),
    failed: message("nativeDialog.failed"),
  });
}

function setReactDialogSnapshot(snapshot: ZManagerDialogSnapshot) {
  reactDialogSnapshot = snapshot;
  publishReactSnapshot();
}

function closeReactDialog() {
  const previous = reactDialogSnapshot;
  reactDialogSnapshot = { kind: "none" };
  extractWorkspace.setOptions({ passwordPromptOpen: false });
  if (previous.kind === "extract") {
    archiveWorkspace.clearPasswordRetry();
    activeExtractDialogForm = patchExtractDialogFormSnapshot(activeExtractDialogForm, {
      passwordPromptOpen: false,
    });
  }
  publishReactSnapshot();
}

function buildReactExtractDialogSnapshot(
  mode: ExtractMode,
  messageText: string,
  form: ExtractDialogFormSnapshot,
): Extract<ZManagerDialogSnapshot, { kind: "extract" }> {
  return {
    kind: "extract",
    mode,
    title: message(mode === "selection" ? "extract.selectedTitle" : "extract.archiveTitle"),
    message: messageText,
    startLabel: message(mode === "selection" ? "extract.selectedAction" : "extract.allAction"),
    destination: form.destination,
    destinationHistory: [...pathHistoryStore.getSnapshot().extractDestinationHistory],
    useSubfolder: form.useSubfolder,
    subfolder: form.subfolder,
    pathMode: form.pathMode,
    overwrite: form.overwrite,
    stripComponents: form.stripComponents,
    deduplicateRoot: form.deduplicateRoot,
    tzapRestorePolicy: form.tzapRestorePolicy,
    tzapAllowDegraded: form.tzapAllowDegraded,
    tzapAllowAbsoluteSymlinks: form.tzapAllowAbsoluteSymlinks,
    ignoreSymlinks: form.ignoreSymlinks,
    passwordPromptOpen: form.passwordPromptOpen,
  };
}

function updateOpenExtractDialogSnapshot(options: Readonly<{
  mode?: ExtractMode;
  messageText?: string;
  formPatch?: ExtractDialogFormPatch;
  form?: ExtractDialogFormSnapshot;
}> = {}) {
  if (reactDialogSnapshot.kind !== "extract") {
    return;
  }

  activeExtractMode = options.mode ?? activeExtractMode;
  activeExtractDialogForm = options.form
    ?? patchExtractDialogFormSnapshot(activeExtractDialogForm, options.formPatch ?? {});
  activeExtractDialogMessage = options.messageText
    ?? (activeExtractDialogMessage || extractDialogMessageForMode(activeExtractMode));
  setReactDialogSnapshot(buildReactExtractDialogSnapshot(
    activeExtractMode,
    activeExtractDialogMessage,
    activeExtractDialogForm,
  ));
}

function openReactExtractDialogSnapshot(
  mode: ExtractMode,
  form: ExtractDialogFormSnapshot,
  messageText: string,
) {
  activeExtractMode = mode;
  activeExtractDialogForm = form;
  activeExtractDialogMessage = messageText;
  setReactDialogSnapshot(buildReactExtractDialogSnapshot(mode, messageText, form));
}

function extractDialogFormFromIntent(
  input: Extract<ZManagerDialogIntent, { type: "submitExtract" | "browseExtractDestination" }>,
): ExtractDialogFormSnapshot {
  return createExtractDialogFormSnapshot({
    destination: input.destination,
    useSubfolder: input.useSubfolder,
    subfolder: input.subfolder,
    pathMode: input.pathMode,
    overwrite: input.overwrite as ExtractOverwritePolicy,
    stripComponents: input.stripComponents,
    deduplicateRoot: input.deduplicateRoot,
    tzapRestorePolicy: input.tzapRestorePolicy,
    tzapAllowDegraded: input.tzapAllowDegraded,
    tzapAllowAbsoluteSymlinks: input.tzapAllowAbsoluteSymlinks,
    ignoreSymlinks: input.ignoreSymlinks,
    passwordPromptOpen: activeExtractDialogForm.passwordPromptOpen,
  });
}

function isCreateSubmissionInFlight(): boolean {
  return createWorkspace.getSnapshot().options.submissionInFlight;
}

function openJobDrawer() {
  if (isQuickActionJobMode()) {
    return;
  }

  shellWorkspace.setJobDrawerOpen(true);
  publishReactSnapshot();
}

function closeJobDrawer() {
  if (isQuickActionJobMode()) {
    return;
  }

  shellWorkspace.setJobDrawerOpen(false);
  publishReactSnapshot();
}

function toggleJobDrawer() {
  if (shellWorkspace.getSnapshot().jobDrawerOpen) {
    closeJobDrawer();
  } else {
    openJobDrawer();
  }
}

function hasActiveJob(): boolean {
  return jobsWorkspace.hasActiveJob();
}

function currentDropSurface(): DropIntentSurface {
  return dropSurfaceForWorkspace({ createDialogOpen: false, mode: currentWorkspaceMode() });
}

function renderDropOverlay(snapshot: ShellWorkspaceSnapshot = shellWorkspace.getSnapshot()) {
  void snapshot;
  publishReactSnapshot();
}

function setDropOverlay(mode: DropOverlayMode, copy?: DropOverlayCopy) {
  renderDropOverlay(shellWorkspace.setDropOverlay(mode, copy));
}

function setDropOverlayChoice(decision: Extract<DropIntentDecision, { kind: "askAction" }>, copy: DropOverlayCopy) {
  renderDropOverlay(shellWorkspace.setDropOverlayChoice(decision, copy));
}

function clearDropOverlay() {
  renderDropOverlay(shellWorkspace.clearDropOverlay());
}

function dropCopyForSurface(surface: DropIntentSurface): DropOverlayCopy {
  if (surface === "create") {
    return {
      titleKey: "drop.addSources.title",
      messageKey: "drop.addSources.copyMessage",
      ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
      target: "compress",
    };
  }

  if (archiveCurrentPath()) {
    return {
      titleKey: "drop.openArchive.title",
      messageKey: "drop.openArchive.message",
      ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
      target: "extract",
    };
  }

  return {
    titleKey: "drop.chooseMode.title",
    messageKey: "drop.chooseMode.message",
    ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
    target: "choose",
  };
}

function dropCopyForDecision(decision: DropIntentDecision): DropOverlayCopy {
  if (hasActiveJob() || isCreateSubmissionInFlight()) {
    return {
      titleKey: "drop.blocked.title",
      messageKey: "drop.blocked.message",
      target: "blocked",
    };
  }

  switch (decision.kind) {
    case "openArchive":
      return {
        titleKey: "drop.openArchive.title",
        messageKey: "drop.openArchive.actionMessage",
        messageParams: { archiveName: getPathBasename(decision.archivePath) || decision.archivePath },
        ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
        target: "extract",
      };
    case "addCreateSources":
      return {
        titleKey: "drop.addSources.title",
        messageKey: "drop.addSources.copyMessage",
        ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
        target: "compress",
      };
    case "askAction":
      return {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: decision.archivePaths.length,
          sourceCount: decision.sourcePaths.length,
        },
        ...(isDesktopRuntime() ? {} : { supportKey: "drop.browserPreview" }),
        target: "choose",
        showActions: true,
      };
    case "rejectUnsupportedDrop":
      return {
        titleKey: "drop.blocked.title",
        messageKey: decision.reason === "emptyDrop" ? "drop.empty" : "drop.browseRequiresArchive",
        target: "blocked",
      };
  }
}

function setDropOverlayForSurface(surface: DropIntentSurface) {
  setDropOverlay("active", dropCopyForSurface(surface));
}

function setDropOverlayForPaths(paths: readonly DroppedPath[]) {
  const filteredPaths = paths
    .map((path) => (typeof path === "string" ? path.trim() : path.path.trim()))
    .filter(Boolean);
  if (filteredPaths.length === 0) {
    setDropOverlayForSurface(currentDropSurface());
    return;
  }

  const decision = classifyDropIntent(paths, currentDropSurface());
  setDropOverlay("active", dropCopyForDecision(decision));
}

function rejectDrop(reason: string) {
  switch (reason) {
    case "emptyDrop":
      setOperationalMessage("drop.empty");
      break;
    case "openRequiresSingleArchive":
      setOperationalMessage("drop.openRequiresSingleArchive");
      break;
    case "browseRequiresArchive":
      setOperationalMessage("drop.browseRequiresArchive");
      break;
    default:
      setOperationalMessage("drop.unsupported");
  }
}

function addDroppedSources(paths: string[]) {
  applyCreatePreferenceDefaults();
  applyExtractPreferenceDefaults();
  addSources(paths);
  setWorkspaceMode("compress");
  setOperationalMessage("drop.sourcesAdded", {
    count: paths.length,
    sourceLabel: message(paths.length === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
  });
}

function handleDropDecision(decision: DropIntentDecision, chosenAction?: "openArchive" | "addToCompress") {
  if (chosenAction === "openArchive" && "archivePaths" in decision && decision.archivePaths.length > 0) {
    void openArchiveFromPath(decision.archivePaths[0]);
    clearDropOverlay();
    return;
  }

  if (chosenAction === "addToCompress" && "sourcePaths" in decision && "archivePaths" in decision) {
    addDroppedSources([...decision.archivePaths, ...decision.sourcePaths]);
    clearDropOverlay();
    return;
  }

  switch (decision.kind) {
    case "openArchive":
      if (decision.extraArchivePaths?.length) {
        setOperationalMessage("drop.openedWithSkipped", {
          archivePath: decision.archivePath,
          count: decision.extraArchivePaths.length,
        });
      }
      void openArchiveFromPath(decision.archivePath);
      clearDropOverlay();
      break;
    case "addCreateSources":
      addDroppedSources(decision.sourcePaths);
      clearDropOverlay();
      break;
    case "askAction":
      setDropOverlayChoice(decision, dropCopyForDecision(decision));
      break;
    case "rejectUnsupportedDrop":
      rejectDrop(decision.reason);
      clearDropOverlay();
      break;
  }
}

function handleDroppedPaths(paths: readonly DroppedPath[]) {
  const trimmedPaths = paths
    .map((path) => (typeof path === "string" ? path.trim() : path.path.trim()))
    .filter(Boolean);
  if (hasActiveJob() || isCreateSubmissionInFlight()) {
    setOperationalMessage("drop.finishCurrentJob");
    setDropOverlay("active", {
      titleKey: "drop.blocked.title",
      messageKey: "drop.blocked.message",
      target: "blocked",
    });
    return;
  }

  const surface = currentDropSurface();
  const decision = classifyDropIntent(trimmedPaths, surface);
  handleDropDecision(decision);
}

function droppedPathsFromDesktopEvent(event: DesktopFileDropEvent): DroppedPath[] {
  const eventWithPaths = event as DesktopFileDropEvent & { paths?: string[] };
  return Array.isArray(eventWithPaths.paths) ? eventWithPaths.paths : [];
}

function handleTauriDropEvent(event: DesktopFileDropEvent) {
  if (event.type === "enter") {
    const paths = droppedPathsFromDesktopEvent(event);
    if (paths.length) {
      setDropOverlayForPaths(paths);
    } else {
      setDropOverlayForSurface(currentDropSurface());
    }
    return;
  }

  if (event.type === "drop") {
    handleDroppedPaths(droppedPathsFromDesktopEvent(event));
    return;
  }

  if (event.type === "leave") {
    clearDropOverlay();
  }
}

async function bindTauriFileDrop() {
  if (!isDesktopRuntime()) {
    return;
  }

  try {
    dropUnlisten = await bindDesktopFileDrop(handleTauriDropEvent);
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, "File drag/drop is unavailable."));
  }
}

function activatePendingDropChoice(action: "openArchive" | "addToCompress" | "cancel") {
  if (action === "cancel") {
    clearDropOverlay();
    return;
  }

  const pendingChoice = shellWorkspace.getSnapshot().dropOverlay.pendingChoice;
  if (!pendingChoice) {
    clearDropOverlay();
    return;
  }

  handleDropDecision(
    {
      kind: "askAction",
      surface: pendingChoice.surface,
      archivePaths: [...pendingChoice.archivePaths],
      sourcePaths: [...pendingChoice.sourcePaths],
    },
    action,
  );
}

function navigateToFolder(folderPath: string) {
  const before = archiveWorkspace.getSnapshot().view;
  const snapshot = archiveWorkspace.navigateToFolder(folderPath);
  if (
    snapshot.view.currentFolder === before.currentFolder &&
    snapshot.view.navigationHistory.length === before.navigationHistory.length &&
    snapshot.view.searchQuery === before.searchQuery
  ) {
    return;
  }

  publishArchiveSnapshot(snapshot);
  void archiveLoadController.loadFolder(snapshot.view.currentFolder);
}

function navigateBack() {
  const before = archiveWorkspace.getSnapshot().view;
  const snapshot = archiveWorkspace.navigateBack();
  if (
    snapshot.view.currentFolder === before.currentFolder &&
    snapshot.view.navigationHistory.length === before.navigationHistory.length
  ) {
    return;
  }
  publishArchiveSnapshot(snapshot);
  void archiveLoadController.loadFolder(snapshot.view.currentFolder);
}

function navigateUp() {
  if (!archiveCurrentFolder()) {
    return;
  }
  const before = archiveWorkspace.getSnapshot().view;
  const snapshot = archiveWorkspace.navigateUp();
  if (
    snapshot.view.currentFolder === before.currentFolder &&
    snapshot.view.navigationHistory.length === before.navigationHistory.length
  ) {
    return;
  }
  publishArchiveSnapshot(snapshot);
  void archiveLoadController.loadFolder(snapshot.view.currentFolder);
}

function updateSelectionByIntent(
  entryPath: string,
  options?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  const selection = currentArchiveTableSelectionState();
  applyArchiveTableSelection(applyHierarchicalRowSelectionIntent({
    path: entryPath,
    visiblePaths: getVisibleSelectablePaths(),
    currentSelection: selection.selectedPaths,
    anchorPath: selection.anchorPath,
    shiftKey: Boolean(options?.shift),
    ctrlKey: Boolean(options?.ctrl),
    metaKey: Boolean(options?.meta),
  }));
}

function selectAllVisibleEntries() {
  applyArchiveTableSelection(selectAllVisibleHierarchicalRows(getVisibleSelectablePaths()));
}

function invertVisibleSelectionEntries() {
  const selection = currentArchiveTableSelectionState();
  applyArchiveTableSelection(invertVisibleHierarchicalSelection({
    currentSelection: selection.selectedPaths,
    visiblePaths: getVisibleSelectablePaths(),
  }));
}

function selectEntriesByType(mode: "add" | "remove") {
  let selection = currentArchiveTableSelectionState();
  if (!selection.focusedPath) {
    if (selection.selectedPaths.size > 0) {
      applyArchiveTableSelection(focusHierarchicalTablePath(
        selection,
        getSelectedEntryPaths()[0] ?? "",
      ));
      selection = currentArchiveTableSelectionState();
    }
  }

  if (!selection.focusedPath) {
    return;
  }

  const sameType = pathsWithSameExtension(selection.focusedPath, getVisibleSelectablePaths());
  const nextSelection = new Set(selection.selectedPaths);

  for (const path of sameType) {
    if (mode === "add") {
      nextSelection.add(path);
    } else {
      nextSelection.delete(path);
    }
  }

  applyArchiveTableSelection(replaceHierarchicalTableSelection({
    paths: [...nextSelection],
    focusedPath: selection.focusedPath,
    anchorPath: selection.anchorPath,
  }));
}

function selectVisibleEntries() {
  selectAllVisibleEntries();
}

function clearBrowseSelection() {
  applyArchiveTableSelection(clearHierarchicalTableSelection());
}

function tableColumnById(columnId: ArchiveTableColumnId): ArchiveTableColumn | undefined {
  const snapshot = archiveWorkspace.getSnapshot();
  return visibleColumns(snapshot.view.tableColumns).find((column) => column.id === columnId)
    ?? ARCHIVE_TABLE_COLUMNS.find((column) => column.id === columnId);
}

function setTableColumnWidth(columnId: ArchiveTableColumnId, width: number) {
  archiveWorkspace.setColumnWidth(columnId, width);
  publishReactSnapshot();
}

function adjustTableColumnWidth(columnId: ArchiveTableColumnId, delta: number) {
  const column = tableColumnById(columnId);
  if (!column) {
    return;
  }
  setTableColumnWidth(columnId, column.width + delta);
}

function resetTableColumnWidth(columnId: ArchiveTableColumnId) {
  const column = ARCHIVE_TABLE_COLUMNS.find((item) => item.id === columnId);
  if (!column) {
    return;
  }
  setTableColumnWidth(columnId, column.width);
}

function showStartupContextMenu(x: number, y: number) {
  contextMenuRuntime.show(x, y, buildStartupContextMenuItems({
    translator: displayContext.translator,
    canPastePath: canReadClipboard(),
    recentArchiveHistory: pathHistoryStore.getSnapshot().recentArchiveHistory,
  }));
}

function showFolderContextMenu(folderPath: string, x: number, y: number, entryPath = "") {
  if (entryPath && !archiveSelectedPathSet().has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
  }
  contextMenuRuntime.show(x, y, buildArchiveFolderContextMenuItems({
    translator: displayContext.translator,
    folderPath,
    entryPath,
    selectedCount: getSelectedEntryPaths().length,
    hasArchive: Boolean(archiveCurrentPath()),
  }));
}

function showEntryContextMenu(entryPath: string, x: number, y: number) {
  if (!archiveSelectedPathSet().has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
  }
  const entry = getEntryByPath(entryPath);
  const selectedCount = getSelectedEntryPaths().length;
  contextMenuRuntime.show(x, y, buildArchiveEntryContextMenuItems({
    translator: displayContext.translator,
    entryPath,
    canOpenInside: entry?.kind === "directory",
    canOpenOutside: selectedCount === 1 && entry?.kind !== "directory",
    selectedCount,
    selectedEntryCount: archiveSelectedCount(),
    hasArchive: Boolean(archiveCurrentPath()),
  }));
}

function showTableHeaderContextMenu(x: number, y: number, selectedColumnId?: ArchiveTableColumnId) {
  const snapshot = archiveWorkspace.getSnapshot();
  contextMenuRuntime.show(x, y, buildArchiveHeaderContextMenuItems({
    translator: displayContext.translator,
    tableColumnSettings: snapshot.view.tableColumns,
    selectedColumnId,
  }));
}

function showCompressRowContextMenuForPath(
  rowPath: string,
  rowSourcePath: string,
  x: number,
  y: number,
) {
  const snapshot = createWorkspace.getSnapshot();
  const row = visibleCompressRowForPath(rowPath);
  if (!row) {
    return;
  }

  const folderPath = row.rowType === "folder" || (row.rowType === "entry" && row.entry.kind === "directory")
    ? row.path
    : undefined;
  const sourcePath = rowSourcePath || sourcePathForCompressRow(row, snapshot);
  const removableSourcePath = removableSourcePathForCompressPath(row.path, snapshot);
  const removableSourcePaths = removableSourcePath ? sourcePathsForCompressMenu(removableSourcePath) : [];
  const contextPaths = compressPathsForContextAction(rowPath);
  const contextRows = contextPaths
    .map((path) => visibleCompressRowForPath(path))
    .filter((candidate): candidate is CompressPlanRow => Boolean(candidate));
  const canInclude = contextRows.some((compressRow) => compressRowInclusionState(compressRow) !== "included");
  const canExclude = contextRows.some((compressRow) => compressRowInclusionState(compressRow) !== "excluded");
  contextMenuRuntime.show(x, y, buildCompressRowContextMenuItems({
    translator: displayContext.translator,
    rowPath,
    folderPath,
    sourcePath,
    contextRowCount: contextRows.length,
    removableSourceCount: removableSourcePaths.length,
    canInclude,
    canExclude,
    hasSources: snapshot.hasSources,
  }));
}

function showSourceContextMenu(sourcePath: string, x: number, y: number) {
  contextMenuRuntime.show(x, y, buildSourceContextMenuItems({
    translator: displayContext.translator,
    sourcePath,
  }));
}

function showAddSourcesMenuAt(x: number, y: number) {
  contextMenuRuntime.show(x, y, buildAddSourcesContextMenuItems(displayContext.translator));
}

function handleContextMenuAction(payload: ContextMenuActionPayload) {
  const action = payload.action;
  const folderPath = payload.folderPath;
  const columnId = payload.columnId;
  const archivePath = payload.archivePath;
  const entryPath = payload.entryPath ?? "";
  const sourcePath = payload.sourcePath ?? "";
  const routedContextCommand = selectContextCommand(action, {
    archivePath,
    entryPath,
    extractMode: archiveSelectedCount() ? "selection" : "archive",
  });
  if (routedContextCommand) {
    runRoutedCommand(routedContextCommand.commandId, routedContextCommand.payload);
    return;
  }
  if (action === "add-source-files") {
    void addSourcePathsFromDialog("files");
    return;
  }
  if (action === "add-source-folder") {
    void addSourcePathsFromDialog("folder");
    return;
  }
  if (action === "compress-open-folder" && folderPath !== undefined) {
    navigateToCompressFolder(folderPath);
    return;
  }
  if (action === "open-folder" && folderPath !== undefined) {
    navigateToFolder(folderPath);
    return;
  }
  if (action === "open-entry") {
    const selectedPath = entryPath;
    if (!selectedPath) {
      return;
    }
    const selectedEntry = getEntryByPath(selectedPath);
    if (selectedEntry?.kind === "directory") {
      navigateToFolder(selectedPath);
    } else {
      applyArchiveTableSelection(replaceHierarchicalTableSelection({
        paths: [selectedPath],
        focusedPath: selectedPath,
        anchorPath: selectedPath,
      }));
      runRoutedCommand("view");
    }
    return;
  }
  if (action === "sort-ascending" && columnId) {
    applySortDirection(columnId, true);
    return;
  }
  if (action === "sort-descending" && columnId) {
    applySortDirection(columnId, false);
    return;
  }
  if (action === "toggle-column" && columnId) {
    archiveWorkspace.toggleColumnVisibility(columnId);
    publishReactSnapshot();
    return;
  }
  if (action === "move-column-left" && columnId) {
    archiveWorkspace.moveColumn(columnId, "left");
    publishReactSnapshot();
    return;
  }
  if (action === "move-column-right" && columnId) {
    archiveWorkspace.moveColumn(columnId, "right");
    publishReactSnapshot();
    return;
  }
  if (action === "narrow-column" && columnId) {
    adjustTableColumnWidth(columnId, -24);
    return;
  }
  if (action === "widen-column" && columnId) {
    adjustTableColumnWidth(columnId, 24);
    return;
  }
  if (action === "reset-column-width" && columnId) {
    resetTableColumnWidth(columnId);
    return;
  }
  if (action === "reset-columns") {
    const currentPath = archiveCurrentPath();
    const currentFormat = (currentPath ? getKnownArchiveSuffix(currentPath) : null) ?? "default";
    const defaultTableColumns = appPreferences.tableColumnsByFormat?.[currentFormat] ?? {
      visibleColumnIds: appPreferences.tableVisibleColumnIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
      columnOrderIds: appPreferences.tableColumnOrderIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
      columnWidths: appPreferences.tableColumnWidths ?? {},
    };
    archiveWorkspace.resetColumns(defaultTableColumns);
    publishReactSnapshot();
    return;
  }
  if (action === "reveal-source" && sourcePath) {
    void revealInFileManager(sourcePath).catch((error) => {
      setOperationalStatus(unknownErrorMessage(error, message("preview.unableRevealSource")));
    });
    return;
  }
  if (action === "include-compress-path" || action === "exclude-compress-path") {
    const path = payload.compressMenuPath;
    if (path) {
      for (const compressPath of compressPathsForContextAction(path)) {
        setCompressPathIncluded(compressPath, action === "include-compress-path");
      }
      publishReactSnapshot();
    }
    return;
  }
  if (action === "remove-source") {
    removeCreateSources(sourcePathsForCompressMenu(sourcePath));
    return;
  }
  if (action === "clear-sources") {
    clearCreateSources();
  }
}

function showArchiveInfo() {
  setReactDialogSnapshot(buildArchiveInfoDialogSnapshot({
    archive: archiveWorkspace.getSnapshot(),
    display: displayContext,
    lastTestStatus: formatLastTestStatusForCurrentArchive(),
    returnFocusPath: infoReturnFocusPath(),
  }));
}

function showEntryInfo(path: string) {
  const entry = getEntryByPath(path);
  if (!entry) {
    return;
  }

  setReactDialogSnapshot(buildEntryInfoDialogSnapshot({
    entry,
    display: displayContext,
    previewActionTitle: previewActionHint(),
    returnFocusPath: infoReturnFocusPath(),
  }));
}

function showSelectionInfo(selectedRows = getVisibleSelectedRows()) {
  if (selectedRows.length === 0) {
    showArchiveInfo();
    return;
  }

  setReactDialogSnapshot(buildSelectionInfoDialogSnapshot({
    archive: archiveWorkspace.getSnapshot(),
    display: displayContext,
    selectedRows,
    returnFocusPath: infoReturnFocusPath(),
  }));
}

function showCurrentInfo() {
  const selectedRows = getVisibleSelectedRows();
  if (selectedRows.length === 1) {
    const entry = selectedRows[0].entry ?? getEntryByPath(selectedRows[0].path);
    if (entry) {
      showEntryInfo(entry.path);
      return;
    }
  }
  if (selectedRows.length > 1) {
    showSelectionInfo(selectedRows);
    return;
  }
  showArchiveInfo();
}

function currentAboutDialogSnapshot(): Extract<ZManagerDialogSnapshot, { kind: "about" }> {
  return buildAboutDialogSnapshot({
    display: displayContext,
    healthcheck: latestHealthcheck,
    contract: latestContract,
    diagnosticLogPath: latestDiagnosticLogInfo?.path ?? null,
    diagnosticLogLocation: latestDiagnosticLogInfo?.location ?? null,
  });
}

function openAboutDialog() {
  setReactDialogSnapshot(currentAboutDialogSnapshot());
}

function refreshAboutDialogSnapshot() {
  if (reactDialogSnapshot.kind === "about") {
    setReactDialogSnapshot(currentAboutDialogSnapshot());
  }
}

function publishBootstrapStateSnapshot() {
  refreshAboutDialogSnapshot();
  if (normalWorkspaceRendered && !isQuickActionJobMode()) {
    renderBrowse();
  }
}

async function copyAboutDiagnostics() {
  try {
    const snapshot = reactDialogSnapshot.kind === "about"
      ? reactDialogSnapshot
      : currentAboutDialogSnapshot();
    await writeClipboardText(serializeAboutDiagnostics(snapshot));
    setOperationalMessage("status.copied");
  } catch {
    setOperationalMessage("status.copyDiagnosticsFailed");
  }
}

async function validatePreferencesDraft(draft: AppPreferences): Promise<boolean> {
  const customOutputSelected = draft.defaultOutputLocation === "customFolder";
  const customOutputPath = draft.customOutputFolderPath.trim();
  if (!customOutputSelected) {
    return true;
  }
  if (!customOutputPath) {
    setOperationalStatus(message("preferences.validation.customOutputRequired"));
    return false;
  }
  if (!isDesktopRuntime()) {
    return true;
  }

  try {
    const validation = await validateDirectory({ path: customOutputPath });
    const messageKey: MessageKey | null =
      !validation.exists
        ? "preferences.validation.customOutputMissing"
        : !validation.isDirectory
          ? "preferences.validation.customOutputNotFolder"
          : !validation.accessible
            ? "preferences.validation.customOutputInaccessible"
            : null;
    if (messageKey) {
      setOperationalStatus(message(messageKey));
      return false;
    }
  } catch {
    setOperationalStatus(message("preferences.validation.customOutputInaccessible"));
    return false;
  }

  return true;
}

function activeDisplayWorkspace(): DisplayRefreshWorkspace {
  return currentWorkspaceMode() === "compress" ? "create" : "browse";
}

function refreshDisplayFromPreferences() {
  const refreshSurfaces = selectDisplayRefreshSurfaces({
    activeWorkspace: activeDisplayWorkspace(),
    jobsVisible: shellWorkspace.getSnapshot().jobDrawerOpen || isQuickActionJobMode(),
    preferencesVisible: Boolean(preferencesDialogDraft),
  });

  refreshDisplayContext(appPreferences.locale, {
    commitContext: (nextDisplayContext) => {
      displayContext = nextDisplayContext;
    },
  });

  browserDocument.applyDisplayMetadata(displayContext);
  for (const surface of refreshSurfaces) {
    switch (surface) {
      case "browse":
        renderBrowse();
        break;
      case "create":
      case "preferences":
        publishReactSnapshot();
        break;
      case "jobs":
        renderJobs();
        break;
    }
  }
}

function localizedCommandStateReason(reason?: string): string | undefined {
  if (reason === UNSUPPORTED_OPERATION_MESSAGE) {
    return displayContext.translator.t("command.unsupported");
  }
  if (reason === SINGLE_FILE_REQUIRED_MESSAGE) {
    return displayContext.translator.t("command.singleFileRequired");
  }
  if (reason === SINGLE_FOLDER_REQUIRED_MESSAGE) {
    return displayContext.translator.t("command.singleFolderRequired");
  }
  if (
    reason === NO_ARCHIVE_OPEN_MESSAGE ||
    reason === ARCHIVE_NOT_READY_MESSAGE ||
    reason === NO_SELECTION_MESSAGE ||
    reason === NO_ENTRIES_MESSAGE ||
    reason === JOB_RUNNING_MESSAGE
  ) {
    return reason;
  }
  return reason;
}

function currentPreferencesDraft(): AppPreferences {
  return preferencesDialogDraft ?? appPreferences;
}

function updateReactPreferencesDraft(patch: AppPreferencePatch) {
  preferencesDialogDraft = preferencesWithPatch(currentPreferencesDraft(), patch);
  publishReactSnapshot();
}

function updateReactCreateDefaultsDraft(
  format: CreateArchiveFormat,
  patch: Partial<ReturnType<typeof createDefaultsForFormat>>,
) {
  const draft = currentPreferencesDraft();
  const nextDefaultsForFormat = {
    ...createDefaultsForFormat(draft, format),
    ...patch,
  };
  if (format === "tzap" && patch.volumeSize !== undefined) {
    if (patch.volumeSize === null) {
      nextDefaultsForFormat.tzapVolumeLossTolerance = 0;
    } else if (!createDefaultsForFormat(draft, format).volumeSize && patch.tzapVolumeLossTolerance === undefined) {
      nextDefaultsForFormat.tzapVolumeLossTolerance = 1;
    }
  }
  preferencesDialogDraft = preferencesWithPatch(draft, {
    createFormatDefaults: {
      ...draft.createFormatDefaults,
      [format]: nextDefaultsForFormat,
    },
    ...(draft.defaultArchiveFormat === format
      ? { defaultCleanSourceEnabled: Boolean(nextDefaultsForFormat.cleanSource) }
      : {}),
  });
  publishReactSnapshot();
}

function applyCreatePreferenceDefaults() {
  const format = appPreferences.defaultArchiveFormat;
  applyCreateDefaultsForFormat(format, { suggestDestinationIfBlank: true });
}

function applyCreateDefaultsForFormat(
  format: CreateArchiveFormat,
  options: { suggestDestinationIfBlank?: boolean } = {},
) {
  const defaults = createDefaultsForFormat(appPreferences, format);
  const result = createWorkspace.applyFormatDefaults(
    format,
    defaults,
    options.suggestDestinationIfBlank ? createDestinationSuggestionOptions() : undefined,
  );
  publishCreateWorkspaceSnapshot(result.snapshot);
}

async function savePreferencesFromDialog() {
  const draft = currentPreferencesDraft();
  if (!(await validatePreferencesDraft(draft))) {
    return;
  }
  persistPreferencePatch(draft);
  preferencesDialogDraft = null;
  publishArchiveSnapshot(archiveWorkspace.setRowOptions({
    showParentFolderItem: appPreferences.showParentFolderItem,
  }));
  publishArchiveSnapshot(archiveWorkspace.setFlatView(appPreferences.flatViewDefault));
  applyCreatePreferenceDefaults();
  applyPreferenceClasses();
  refreshDisplayFromPreferences();
  setOperationalStatus(displayContext.translator.t("preferences.saved"));
  publishReactSnapshot();
}

function openPreferencesDialog() {
  preferencesDialogDraft = appPreferences;
  publishReactSnapshot();
  if (
    latestContract
    && isNativeCapabilityAvailable(
      latestContract.platformIntegration.capabilities,
      "defaultHandlerControl",
    )
  ) {
    void defaultHandlerController.refresh();
  }
}

async function onSelectReactPreferenceOutputFolder() {
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseDefaultOutput"),
    directory: true,
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) {
    return;
  }

  updateReactPreferencesDraft({
    customOutputFolderPath: selected,
  });
}

async function onSelectReactPreferenceExtractFolder() {
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseDefaultOutput"),
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) {
    return;
  }
  updateReactPreferencesDraft({ customExtractFolderPath: selected });
}

async function saveReactPreferencesDraft() {
  await savePreferencesFromDialog();
  publishReactSnapshot();
}

function cancelReactPreferencesDialog() {
  preferencesDialogDraft = null;
  publishReactSnapshot();
}

function openExtractDialog(mode: ExtractMode) {
  if (!archiveCurrentPath()) {
    return;
  }

  archiveWorkspace.clearPasswordRetry();
  const { extractDestinationHistory } = pathHistoryStore.getSnapshot();
  openReactExtractDialogSnapshot(
    mode,
    createExtractDialogFormSnapshot({
      destination: extractDestinationHistory[0] ?? "",
      overwrite: activeExtractDialogForm.overwrite,
      stripComponents: activeExtractDialogForm.stripComponents,
      tzapRestorePolicy: extractWorkspace.getSnapshot().tzapRestorePolicy,
      tzapAllowDegraded: extractWorkspace.getSnapshot().tzapAllowDegraded,
      tzapAllowAbsoluteSymlinks: extractWorkspace.getSnapshot().tzapAllowAbsoluteSymlinks,
      ignoreSymlinks: extractWorkspace.getSnapshot().ignoreSymlinks,
    }),
    extractDialogMessageForMode(mode),
  );
}

function openExtractHereDialog(mode: ExtractMode) {
  const archivePath = archiveCurrentPath();
  const parent = nativeParentPath(archivePath);
  openExtractDialog(mode);
  if (parent) {
    updateOpenExtractDialogSnapshot({
      mode,
      formPatch: {
        destination: parent,
      },
      messageText: mode === "selection"
        ? message("extract.hereSelected", { archiveName: getArchiveName(archivePath, APP_TITLE) })
        : message("extract.hereArchive", { archiveName: getArchiveName(archivePath, APP_TITLE) }),
    });
  }
}

function showCreateWorkspace() {
  const snapshot = createWorkspace.getSnapshot();
  if (!snapshot.hasSources) {
    applyCreatePreferenceDefaults();
  }
  const { createDestinationHistory } = pathHistoryStore.getSnapshot();
  if (!createWorkspace.getSnapshot().options.destinationPath.trim() && createDestinationHistory[0]) {
    publishCreateWorkspaceSnapshot(createWorkspace.setDestinationPathIfBlank(createDestinationHistory[0]).snapshot);
  }
  setWorkspaceMode("compress");
  publishReactSnapshot();
}

async function loadArchive(request: ListArchiveRequest, options: ArchiveLoadOptions = {}) {
  await archiveLoadController.loadArchive(request, options);
}

function loadArchiveListingIntoState(listing: ArchiveFixture, options: ArchiveLoadOptions = {}) {
  const preserveState = options.preserveState ?? false;
  const previous = archiveWorkspace.getSnapshot();
  const preservedState = preserveState
    ? {
        currentFolder: previous.view.currentFolder,
        navigationHistory: previous.view.navigationHistory,
        searchQuery: previous.view.searchQuery,
        flatView: previous.view.flatView,
        expandedTreeFolders: previous.view.expandedTreeFolders,
        selectedPaths: previous.view.selection.selectedPaths,
        focusedPath: previous.view.selection.focusedPath,
        anchorPath: previous.view.selection.anchorPath,
        showParentFolderItem: appPreferences.showParentFolderItem,
        sortKey: previous.view.sort.key,
        sortAscending: previous.view.sort.ascending,
      }
    : false;

  clearTrackedPreviewState();
  contextMenuRuntime.hide();
  shellWorkspace.setWorkspaceMode("extract");
  const currentFormat = getKnownArchiveSuffix(archiveListingFromFixture(listing).archivePath) || "default";
  const defaultTableColumns = appPreferences.tableColumnsByFormat?.[currentFormat] ?? {
    visibleColumnIds: appPreferences.tableVisibleColumnIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    columnOrderIds: appPreferences.tableColumnOrderIds ?? DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
    columnWidths: appPreferences.tableColumnWidths ?? {},
  };
  const snapshot = archiveWorkspace.loadSucceeded(archiveListingFromFixture(listing), {
    preserveState: preservedState,
    defaultTableColumns,
  });
  applyExtractPreferenceDefaults(listing.archivePath);
  publishArchiveSnapshot(snapshot);
  setOperationalMessage("archive.loaded");
}

async function runPlan(revision?: number) {
  await createPlanController.runPlan(revision);
}

function addSources(paths: string[]) {
  const previousSnapshot = createWorkspace.getSnapshot();
  const result = createWorkspace.addSources(paths);
  let sourceSnapshot = result.snapshot;
  if (!result.changed) {
    return;
  }
  if (!previousSnapshot.hasSources && sourceSnapshot.hasSources && !sourceSnapshot.options.destinationPath.trim()) {
    sourceSnapshot = createWorkspace.suggestDestinationPathIfBlank(createDestinationSuggestionOptions()).snapshot;
  }
  publishCreateWorkspaceSnapshot(sourceSnapshot);
  queuePlanRun();
}

function addJobState(
  response: StartJobResponseDto,
  options: {
    retryContext?: JobRetryContext;
    focusProgress?: boolean;
    autoCloseAction?: FocusedJobAutoCloseAction;
    progressContext?: FocusedJobProgressContext;
    outputActions?: JobOutputAction[];
  } = {},
) {
  const useDisposableWindow = Boolean(options.focusProgress && isDesktopRuntime());
  diagnostics.record({
    scope: "jobPresentation",
    name: "jobAdded",
    fields: {
      jobKind: response.kind,
      initialStatus: response.status,
      focusProgress: Boolean(options.focusProgress),
      useDisposableWindow,
      autoCloseAction: options.autoCloseAction ?? null,
      quickActionOnlyCoordinator: disposableTaskLifecycle.getSnapshot().quickActionOnlyCoordinator,
    },
  });
  if (options.focusProgress && !useDisposableWindow) {
    void revealQuickActionJobWindow(options.autoCloseAction ?? "returnToWorkspace");
  }
  jobsWorkspace.addJob(response, {
    retryContext: options.retryContext,
    outputActions: options.outputActions,
  });
  if (useDisposableWindow) {
    void disposableTaskWindows.open(response);
  } else {
    trackQuickActionJob(response.jobId, options.progressContext);
  }

  void subscribeToRetainedJob(response.jobId);
  renderJobs();
  if (!useDisposableWindow) {
    openJobDrawer();
  }
}

async function openQuickActionArchive(paths: string[]) {
  const archives = uniqueQuickActionPaths(paths);
  if (archives.length !== 1) {
    setBrowseState("error", message("archive.openSingle"));
    renderBrowse();
    return;
  }

  const archivePath = archives[0];
  if (!isSupportedArchivePath(archivePath)) {
    setBrowseState("error", message("archive.unsupported", { archivePath }));
    renderBrowse();
    return;
  }

  await loadArchive({ archivePath });
}

async function startQuickCreate(paths: string[], format: CreateArchiveFormat, cleanSource: boolean) {
  await quickActionController.startQuickCreate(paths, format, cleanSource);
}

async function openQuickCreateReview(
  paths: string[],
  format: CreateArchiveFormat,
  cleanSource: boolean,
) {
  await quickActionController.openQuickCreateReview(paths, format, cleanSource);
}

async function openQuickExtractReview(paths: string[]) {
  await quickActionController.openQuickExtractReview(paths);
}

async function startQuickExtract(paths: string[], action: QuickActionExtractMode) {
  await quickActionController.startQuickExtract(paths, action);
}

async function executeQuickActionRequest(request: QuickActionRequestDto) {
  await quickActionController.handleQuickActionRequest(request);
}

async function routeQuickActionRequest(request: QuickActionRequestDto) {
  await runInboundQuickAction(request, {
    observeDisposableTaskLaunch: disposableTaskLifecycle.observeQuickActionLaunch,
    beginDisposableTaskRequest: disposableTaskLifecycle.beginQuickActionRequest,
    endDisposableTaskRequest: disposableTaskLifecycle.endQuickActionRequest,
    revealMainWindow: revealNormalAppWindow,
    onDispositionApplied: (disposition) => {
      const lifecycle = disposableTaskLifecycle.getSnapshot();
      diagnostics.record({
        scope: "quickActionLifecycle",
        name: "requestDispositionApplied",
        fields: {
          action: request.kind,
          disposition,
          normalLaunchObserved: lifecycle.normalLaunchObserved,
          quickActionOnlyCoordinator: lifecycle.quickActionOnlyCoordinator,
          pendingQuickActionRequests: lifecycle.pendingQuickActionRequests,
        },
      });
    },
    execute: executeQuickActionRequest,
    onDisposableTaskRequestSettled: maybeCloseQuickActionOnlyCoordinator,
  });
}

async function activateQuickActionJobs(responses: StartJobResponseDto[]) {
  if (!responses.length) {
    return;
  }

  for (const response of responses) {
    addJobState(response, { focusProgress: true, autoCloseAction: "closeWindow" });
  }
  setOperationalMessage("jobs.quickActionStarted");
}

async function handleStartupQuickAction() {
  await startupController.handleStartupQuickAction();
}

async function handleQuickActionStartupState(state: QuickActionStartupStateDto) {
  await startupController.handleQuickActionStartupState(state);
}

async function initializeDesktopRuntime() {
  await persistDiagnosticEvent({
    scope: "frontend",
    name: "desktopInitializationStarted",
  }).catch(() => {});
  await nativeInboundController.initialize();
  await listenNativeMenuCommands((commandId) => runRoutedCommand(commandId));
  await listenNativeFileDragOutcomes(({ payload }) => {
    const count = pendingNativeDragCounts.get(payload.sessionId) ?? 0;
    pendingNativeDragCounts.delete(payload.sessionId);
    if (payload.outcome === "cancelled") {
      setOperationalMessage("preview.dragCancelled");
    } else {
      setOperationalMessage("preview.draggedOut", { count });
    }
  });
  await subscribeToJobCatalog();
  await startupController.initializeDesktopRuntime();
}

async function handleHostedAuthCallback(
  payload: NativeInboundHostedAuthEvent["payload"],
): Promise<void> {
  await accountController.handleHostedCallback(payload);
}

async function startPasswordRetryJob(context: JobRetryContext, password: string) {
  return jobControlController.startPasswordRetryJob(context, password);
}

async function retryJobWithPasswordPrompt(jobId: string) {
  await jobControlController.retryJobWithPasswordPrompt(jobId);
}

async function maybePromptForJobPasswordRetry(jobId: string) {
  await jobControlController.maybePromptForJobPasswordRetry(jobId);
}

function scheduleProgressClock() {
  jobTimers.startProgressClock(renderJobs);
}

function stopProgressClock() {
  jobTimers.stopProgressClock();
}

function syncProgressClock(snapshot: ProgressClockSnapshot = jobsWorkspace.getProgressClockSnapshot()) {
  if (snapshot.shouldRun) scheduleProgressClock(); else stopProgressClock();
}

async function onOpenArchive() {
  await archiveOpenController.onOpenArchive();
}

async function openArchiveFromPath(archivePath: string) {
  await archiveOpenController.openArchiveFromPath(archivePath);
}

async function openArchiveFromClipboard() {
  await archiveOpenController.openArchiveFromClipboard();
}

async function onTestArchive() {
  await archiveTestController.testArchive();
}

async function onDeleteTemporaryFiles() {
  if (!isDesktopRuntime()) {
    setOperationalMessage("preview.cleanupDesktopOnly");
    return;
  }

  if (!shellWorkspace.hasTrackedPreviewCleanup()) {
    setOperationalMessage("preview.cleanupNoneTracked");
    return;
  }

  try {
    await cleanupPreviewRoots();
    clearTrackedPreviewState();
    setOperationalMessage("preview.cleanupDeleted");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("preview.cleanupFailed"));
  }
}

async function copySelectedEntryPathsToClipboard() {
  const selectedPaths = getSelectedEntryPaths();
  if (selectedPaths.length === 0) {
    setOperationalMessage("command.singleFileRequired");
    return;
  }

  try {
    await writeClipboardText(selectedPaths.join("\n"));
    setOperationalStatus(`Copied ${selectedPaths.length} archive path${selectedPaths.length === 1 ? "" : "s"}.`);
  } catch {
    setOperationalStatus("Could not copy the selected archive paths.");
  }
}

async function copyTextToClipboard(value: string) {
  if (!value) {
    return;
  }

  try {
    await writeClipboardText(value);
    setOperationalMessage("status.copied");
  } catch {
    setOperationalStatus("Could not copy.");
  }
}

async function applyPreviewCleanupPolicyBeforeNextPreview(): Promise<void> {
  if (
    appPreferences.previewCleanupPolicy !== "beforeNextPreview" ||
    !shellWorkspace.hasPreviewCleanupRoot()
  ) {
    return;
  }

  try {
    await cleanupPreviewRoots();
  } catch {
    // Best effort cleanup only.
  }
  clearTrackedPreviewState();
}

function applyCleanupOnAppClose(): void {
  if (!isDesktopRuntime()) {
    return;
  }

  void appWindowController.persistCurrentWindowGeometry();
  if (appPreferences.previewCleanupPolicy === "whenAppCloses") {
    void cleanupPreviewRoots();
  }
}

function bindWindowLifecycleHandlers(): void {
  bindPreviewCleanupOnAppClose(applyCleanupOnAppClose);
}

function closeCurrentArchive(): void {
  clearTrackedPreviewState();
  contextMenuRuntime.hide();
  archiveWorkspace.reset();
  extractWorkspace.applyDefaults({
    ...extractionDefaultsForArchive(""),
    destinationPath: "",
  });
  publishArchiveSnapshot();
}

async function onRefreshArchive() {
  const archivePath = archiveCurrentPath();
  if (!archivePath) {
    return;
  }

  await loadArchive({
    archivePath,
  }, {
    preserveState: true,
  });
}

async function onSelectDestinationForExtract(form: ExtractDialogFormSnapshot = activeExtractDialogForm) {
  activeExtractDialogForm = form;
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseExtractDestination"),
    directory: true,
    multiple: false,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  updateOpenExtractDialogSnapshot({
    form: patchExtractDialogFormSnapshot(form, {
      destination: selected,
    }),
  });
}

async function onSelectWorkspaceExtractDestination() {
  const current = extractWorkspace.getSnapshot().destinationPath;
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseExtractDestination"),
    directory: true,
    multiple: false,
    ...(current ? { defaultPath: current } : {}),
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  extractWorkspace.setOptions({ destinationPath: selected });
  publishReactSnapshot();
}

async function chooseTzapTrustedCAs() {
  const selected = await openNativeDialog({
    title: "Choose trusted CA certificates",
    directory: false,
    multiple: true,
    filters: [{ name: "Certificates", extensions: ["pem", "cer", "crt", "der"] }],
  });
  if (!selected) {
    return;
  }
  const paths = Array.isArray(selected) ? selected : [selected];
  const current = extractWorkspace.getSnapshot().tzapVerification.trustedCaCertificatePaths;
  extractWorkspace.setTzapVerificationOptions({ trustedCaCertificatePaths: [...current, ...paths] });
  publishReactSnapshot();
}

async function chooseCreateTzapCertificate(target: "recipients" | "identity" | "signer" | "privateKey" | "chain") {
  const multiple = target === "recipients" || target === "chain";
  const selected = await openNativeDialog({
    title: target === "privateKey" ? "Choose signing private key" : "Choose certificate files",
    directory: false,
    multiple,
    filters: [{ name: target === "privateKey" ? "Private keys" : target === "identity" ? "PKCS#12 identity" : "Certificates", extensions: target === "privateKey" ? ["pem", "key"] : target === "identity" ? ["p12", "pfx"] : ["pem", "cer", "crt", "der"] }],
  });
  if (!selected) return;
  const value = (Array.isArray(selected) ? selected : [selected]).join(";");
  const patch = target === "recipients" ? { tzapRecipientCertificatePaths: value }
    : target === "identity" ? { tzapSigningIdentityPath: value, tzapSigningMode: "identity" as const }
    : target === "signer" ? { tzapSigningCertificatePath: value }
    : target === "privateKey" ? { tzapSigningPrivateKeyPath: value }
    : { tzapSigningChainPaths: value };
  publishCreateWorkspaceSnapshot(createWorkspace.setOptions(patch).snapshot);
  queuePlanRun();
}

async function generateCreateTzapIdentity(commonName: string, password: string) {
  const identityPath = await chooseTzapIdentityDestination(
    `${commonName.trim() || "TZAP Signing Identity"}.p12`,
    setOperationalStatus,
    { unavailableInBrowser: message("nativeDialog.unavailableInBrowser"), failed: message("nativeDialog.failed") },
  );
  if (!identityPath) return;
  const certificatePath = identityPath.replace(/\.(p12|pfx)$/i, "") + ".crt";
  try {
    const result = await generateTzapIdentityCommand({ identityPath, certificatePath, commonName, password });
    publishCreateWorkspaceSnapshot(createWorkspace.setOptions({
      tzapSigningMode: "identity",
      tzapSigningIdentityPath: result.identityPath,
    }).snapshot);
    setOperationalStatus(`Signing identity created. Public certificate: ${result.certificatePath}`);
  } catch (error) {
    setOperationalStatus(asCommandError(error)?.message ?? unknownErrorMessage(error, "Unable to create signing identity."));
  }
}

async function choosePreferenceTzapSigningFile(target: "identity" | "certificate" | "privateKey" | "chain") {
  const multiple = target === "chain";
  const selected = await openNativeDialog({
    title: target === "identity" ? "Choose default signing identity" : "Choose default signing file",
    multiple,
    filters: [{
      name: target === "identity" ? "PKCS#12 identity" : target === "privateKey" ? "Private keys" : "Certificates",
      extensions: target === "identity" ? ["p12", "pfx"] : target === "privateKey" ? ["pem", "key"] : ["pem", "cer", "crt", "der"],
    }],
  });
  if (!selected) return;
  const value = (Array.isArray(selected) ? selected : [selected]).join(";");
  updateReactCreateDefaultsDraft("tzap", target === "identity" ? { tzapSigningIdentityPath: value, tzapSigningMode: "identity" }
    : target === "certificate" ? { tzapSigningCertificatePath: value, tzapSigningMode: "advanced" }
    : target === "privateKey" ? { tzapSigningPrivateKeyPath: value, tzapSigningMode: "advanced" }
    : { tzapSigningChainPaths: value, tzapSigningMode: "advanced" });
}

async function generatePreferenceTzapIdentity(commonName: string, password: string) {
  const identityPath = await chooseTzapIdentityDestination(
    `${commonName.trim() || "TZAP Signing Identity"}.p12`,
    setOperationalStatus,
    { unavailableInBrowser: message("nativeDialog.unavailableInBrowser"), failed: message("nativeDialog.failed") },
  );
  if (!identityPath) return;
  const certificatePath = identityPath.replace(/\.(p12|pfx)$/i, "") + ".crt";
  try {
    const result = await generateTzapIdentityCommand({ identityPath, certificatePath, commonName, password });
    updateReactCreateDefaultsDraft("tzap", { tzapSigningMode: "identity", tzapSigningIdentityPath: result.identityPath });
    setOperationalStatus(`Default signing identity created. Public certificate: ${result.certificatePath}`);
  } catch (error) {
    setOperationalStatus(asCommandError(error)?.message ?? unknownErrorMessage(error, "Unable to create signing identity."));
  }
}

async function verifyCurrentTzapCertificate() {
  const archivePath = archiveCurrentPath();
  if (!archivePath.toLowerCase().includes(".tzap")) {
    return;
  }
  const verification = extractWorkspace.getSnapshot().tzapVerification;
  extractWorkspace.beginTzapVerification();
  publishReactSnapshot();
  try {
    const result = await verifyTzapCertificateCommand({
      archivePath,
      validateTrust: verification.validateTrust,
      trustedCaCertificatePaths: [...verification.trustedCaCertificatePaths],
      trustedSystemRoots: verification.trustedSystemRoots,
      includeOfficialTzapRoot: verification.includeOfficialTzapRoot,
    });
    extractWorkspace.acceptTzapVerification(result);
  } catch (error) {
    extractWorkspace.rejectTzapVerification(asCommandError(error)?.message ?? unknownErrorMessage(error, "Certificate verification failed."));
  }
  publishReactSnapshot();
}

async function startExtract(destinationMode: ExtractMode, input: ExtractStartInput) {
  await extractStartController.startExtract(destinationMode, input);
}

async function onPreviewSelectedEntry() {
  await runPreviewSelectedEntry("preview");
}

async function onOpenOutsideSelectedEntry() {
  await runPreviewSelectedEntry("openOutside");
}

async function runPreviewSelectedEntry(mode: ArchivePreviewMode) {
  await archivePreviewController.previewSelectedEntry(mode);
}

async function addSourcePathsFromDialog(mode: "files" | "folder") {
  const selected = await openNativeDialog({
    title: displayContext.translator.t(mode === "files" ? "nativeDialog.addSourceFiles" : "nativeDialog.addSourceFolder"),
    directory: mode === "folder",
    multiple: mode === "files",
  });

  if (!selected) {
    return;
  }

  if (Array.isArray(selected)) {
    addSources(selected);
    return;
  }

  addSources([selected]);
}

async function onSelectCreateDestination() {
  const optionSnapshot = createWorkspace.getSnapshot().options;
  const defaultPath = createOutputFolderDefaultPath(optionSnapshot.destinationPath);
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseCreateOutputFolder"),
    directory: true,
    multiple: false,
    ...(defaultPath ? { defaultPath } : {}),
  });

  if (!selected || typeof selected !== "string") {
    return;
  }
  publishCreateWorkspaceSnapshot(createWorkspace.setDestinationPath(
    createWorkspace.destinationPathForOutputFolder(selected, optionSnapshot.destinationPath),
  ).snapshot);
}

async function runCreate(
  options: {
    destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
    passwordInput: {
      password: string;
      passwordConfirm: string;
      signingIdentityPassword?: string;
    };
  },
) {
  await createStartController.runCreate(options);
}

async function onCancelJob(jobId: string) {
  await jobControlController.onCancelJob(jobId);
}

async function onPauseJob(jobId: string) {
  await jobControlController.onPauseJob(jobId);
}

async function onResumeJob(jobId: string) {
  await jobControlController.onResumeJob(jobId);
}

async function onJobOutputAction(jobId?: string, indexValue?: string, kind?: string) {
  await jobControlController.onJobOutputAction(jobId, indexValue, kind);
}

async function onDismissJob(jobId: string) {
  await jobControlController.onDismissJob(jobId);
}

async function loadBootstrapState() {
  if (isDesktopRuntime()) {
    try {
      latestDiagnosticLogInfo = await fetchDiagnosticLogInfo();
    } catch {
      latestDiagnosticLogInfo = null;
    }
  }
  await startupController.loadBootstrapState();
}

function runtimeDevToolsOptions() {
  return {
    isDev: import.meta.env.DEV,
    windowRef: window,
    normalWorkspaceRendered: () => normalWorkspaceRendered,
    isQuickActionJobMode,
    api: {
      loadArchiveFixture: loadArchiveListingIntoState,
      setSystemIconFixtures: (fixtures: Record<string, string | null>) => {
        systemIconDataUrls = new Map(Object.entries(fixtures));
        renderBrowse();
      },
      setJobFixtures: (fixtures: JobState[]) => {
        jobsWorkspace.replaceJobs(fixtures);
        renderJobs();
      },
      openSurface: (surface: "about" | "preferences" | "info" | "jobs") => {
        if (surface === "about") {
          openAboutDialog();
        } else if (surface === "preferences") {
          openPreferencesDialog();
        } else if (surface === "info") {
          showCurrentInfo();
        } else if (surface === "jobs") {
          openJobDrawer();
        }
      },
      closeModal: () => {
        if (reactDialogSnapshot.kind !== "none") {
          closeReactDialog();
        }
        if (preferencesDialogDraft) {
          cancelReactPreferencesDialog();
        }
        closeJobDrawer();
      },
    },
  };
}

function installRuntimeDevApi() {
  installRuntimeDevTools(runtimeDevToolsOptions());
}

function loadLocalDevFixtureFromUrl() {
  loadRuntimeLocalDevFixtureFromUrl(runtimeDevToolsOptions());
}

function handleInfoDialogAction(action?: string, copyValue?: string) {
  if (copyValue) {
    void copyTextToClipboard(copyValue);
    return;
  }

  const routedCommand = selectDetailsCommand(action);
  if (routedCommand) {
    runRoutedCommand(routedCommand.commandId, routedCommand.payload);
    return;
  }
  if (action === "clear-search") {
    clearSearch();
  }
}

startZManagerRuntime({
  bindWindowLifecycleHandlers,
  refreshDisplayFromPreferences,
  loadPathHistory: () => pathHistoryStore.load(),
  applyCreatePreferenceDefaults,
  setInitialBrowseState: () => setBrowseState("idle", displayContext.translator.t("browse.statusIdle")),
  installRuntimeDevTools: installRuntimeDevApi,
  bindFileDrop: bindTauriFileDrop,
  isDesktopRuntime,
  initializeDesktopRuntime,
  renderNormalWorkspaceOnce,
  loadLocalDevFixtureFromUrl,
  loadBootstrapState,
});
