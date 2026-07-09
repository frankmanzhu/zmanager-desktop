import "./styles.css";
import {
  APP_TITLE,
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
  JOB_POLL_INTERVAL_MS,
  APP_MIN_WINDOW_WIDTH_PX,
  APP_MIN_WINDOW_HEIGHT_PX,
  APP_MENU_BAR_HEIGHT_PX,
  APP_TOOLBAR_HEIGHT_PX,
  APP_PATH_BAR_HEIGHT_PX,
  APP_STATUS_BAR_HEIGHT_PX,
  APP_NAV_PANE_MIN_WIDTH_PX,
  APP_NAV_PANE_DEFAULT_WIDTH_PX,
  APP_NAV_PANE_MAX_WIDTH_PX,
  APP_DETAILS_PANE_MIN_WIDTH_PX,
  APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  APP_DETAILS_PANE_MAX_WIDTH_PX,
  APP_STATUS_BAR_PARTS,
} from "./app/constants";
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
} from "./app/classicCommands";
import {
  createCommandRouter,
  selectContextCommand,
  selectDetailsCommand,
  type CommandRouterPayload,
} from "./app/commands/commandRouter";
import {
  buildAddSourcesContextMenuItems,
  buildArchiveEntryContextMenuItems,
  buildArchiveFolderContextMenuItems,
  buildArchiveHeaderContextMenuItems,
  buildCompressRowContextMenuItems,
  buildSourceContextMenuItems,
  buildStartupContextMenuItems,
  type ContextMenuActionPayload,
  type ContextMenuItem,
} from "./app/commands/contextMenuModel";
import {
  createArchiveLoadController,
  type ArchiveLoadOptions,
} from "./app/controllers/archiveLoadController";
import {
  createArchiveOpenController,
} from "./app/controllers/archiveOpenController";
import {
  createArchivePreviewController,
  type ArchivePreviewMode,
} from "./app/controllers/archivePreviewController";
import {
  createArchiveTestController,
} from "./app/controllers/archiveTestController";
import {
  createCreatePlanController,
} from "./app/controllers/createPlanController";
import {
  createCreateStartController,
} from "./app/controllers/createStartController";
import {
  createExtractStartController,
} from "./app/controllers/extractStartController";
import {
  createJobControlController,
} from "./app/controllers/jobControlController";
import {
  createJobPollingController,
} from "./app/controllers/jobPollingController";
import {
  createQuickActionController,
} from "./app/controllers/quickActionController";
import {
  createStartupController,
} from "./app/controllers/startupController";
import {
  ARCHIVE_TABLE_COLUMNS,
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
} from "./app/archiveTable";
import {
  createArchiveWorkspace,
  type ArchiveWorkspacePasswordRetry,
  type ArchiveWorkspacePasswordRetryOperation,
  type ArchiveWorkspaceSnapshot,
  type SelectableArchiveWorkspaceRow,
} from "./app/workspaces/archiveWorkspace";
import {
  createCreateWorkspace,
  type CreateWorkspacePlanStatus,
  type CreateWorkspaceSnapshot,
} from "./app/workspaces/createWorkspace";
import {
  pathsWithSameExtension,
} from "./app/selection";
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
} from "./app/hierarchicalTable";
import {
  getPathBasename,
  parseDateValue,
} from "./app/formatting";
import {
  normalizeArchivePath,
} from "./app/archiveTree";
import {
  CREATE_ARCHIVE_FILTERS,
  getArchiveName,
  sourcePathForCreatePlanRow,
  type CreateArchiveFormat,
  type CreatePlanRow,
} from "./app/createFlow";
import {
  unknownErrorMessage,
  type NativeDialogOpenOptions,
  type NativeDialogSaveOptions,
} from "./app/dialogs";
import {
  type ExtractMode,
  type ExtractOverwritePolicy,
  type ExtractStartInput,
} from "./app/extractFlow";
import {
  createExtractDialogFormSnapshot,
  extractStartInputFromDialogForm,
  patchExtractDialogFormSnapshot,
  type ExtractDialogFormPatch,
  type ExtractDialogFormSnapshot,
} from "./app/extractDialogState";
import {
  ARCHIVE_OPEN_FILTER,
  getKnownArchiveSuffix,
  isSupportedArchivePath,
} from "./app/archiveFileTypes";
import {
  classifyDropIntent,
  dropSurfaceForWorkspace,
  type DroppedPath,
  type DropIntentDecision,
  type DropIntentSurface,
  type WorkspaceDropMode,
} from "./app/dropIntent";
import {
  type JobRetryContext,
} from "./app/jobs";
import {
  createJobsWorkspace,
  type FocusedJobAutoCloseAction,
  type FocusedJobProgressContext,
  type JobListSnapshot,
  type JobOutputAction,
  type ProgressClockSnapshot,
} from "./app/workspaces/jobsWorkspace";
import {
  createDefaultsForFormat,
  defaultCreateDirectory,
  loadAppPreferences,
  preferencesWithPatch,
  saveAppPreferences,
  type AppPreferencePatch,
  type AppPreferences,
} from "./app/preferences";
import {
  createPathHistoryStore,
} from "./app/pathHistory";
import {
  createShellWorkspace,
  type DropOverlayCopy,
  type DropOverlayMode,
  type ShellWorkspaceSnapshot,
} from "./app/shell/shellWorkspace";
import {
  type MessageKey,
  type MessageParams,
} from "./app/i18n/translator";
import {
  createDisplayContext,
  refreshDisplayContext,
  type DisplayRefreshWorkspace,
} from "./app/display/displayContext";
import {
  buildAboutDialogSnapshot,
  buildArchiveInfoDialogSnapshot,
  buildEntryInfoDialogSnapshot,
  buildSelectionInfoDialogSnapshot,
  serializeAboutDiagnostics,
} from "./app/display/dialogSnapshots";
import {
  createZManagerReactSnapshot,
  displaySnapshotFromContext,
  type ZManagerArchiveIntent,
  type ZManagerContextMenuIntent,
  type ZManagerContextMenuSnapshot,
  type ZManagerCreateIntent,
  type ZManagerDesktopIntent,
  type ZManagerDialogIntent,
  type ZManagerDialogSnapshot,
  type ZManagerJobsIntent,
  type ZManagerKeyboardIntent,
  type ZManagerReactRuntimeAdapter,
  type ZManagerReactSnapshot,
  type ZManagerReactSnapshotListener,
} from "./ui/react/appRuntime";
import {
  uniqueQuickActionPaths,
  type QuickActionExtractMode,
} from "./app/quickActions";
import {
  asCommandError,
  cancelJob as cancelJobCommand,
  dismissJob as dismissJobCommand,
  fetchHealthcheck,
  fetchProjectContract,
  fetchQuickActionStartupState,
  fetchSystemFileIcons,
  listArchive as listArchiveCommand,
  pollJobEvents as pollJobEventsCommand,
  pauseJob as pauseJobCommand,
  runPlanCreate,
  runPreviewEntry,
  resumeJob as resumeJobCommand,
  runStartCreate,
  runStartExtract,
  runTestArchive,
  validateDirectory,
} from "./api/commands";
import type {
  ArchiveEntryDto,
  ArchiveListingDto,
  BrowseState,
  CreatePlanEntryDto,
  CreatePlanResponse,
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
} from "./api/types";
import {
  isDesktopRuntime,
  openNativeDialog as openRuntimeDialog,
  saveNativeDialog as saveRuntimeDialog,
} from "./desktop/runtime";
import {
  bindDesktopFileDrop,
  type DesktopFileDropEvent,
} from "./desktop/fileDrop";
import {
  openDesktopPath,
  revealInFileManager,
} from "./desktop/fileManager";
import {
  canReadClipboard,
  readClipboardText,
  writeClipboardText,
} from "./desktop/clipboard";
import {
  createAppTimers,
} from "./desktop/timers";
import {
  bindPreviewCleanupOnAppClose,
  cleanupPreviewRoots,
} from "./desktop/previewCleanup";
import {
  listenQuickActionLaunch,
} from "./desktop/quickActionEvents";
import {
  startNativeFileDrag,
} from "./desktop/nativeDrag";
import {
  createWindowController,
  type AppWindowResizeDirection,
} from "./desktop/windowController";
import {
  createModalController,
} from "./ui/modalController";
type SelectableBrowserRow = Extract<ArchiveTableRow, { rowType: "folder" | "entry" }>;
type CompressPlanRow = CreatePlanRow;
type CommandSurfaceClassState = Partial<Record<CommandId, {
  primary?: boolean;
  secondary?: boolean;
}>>;
const QUICK_ACTION_AUTO_CLOSE_DELAY_MS = 650;
type ArchiveFixture = {
  archivePath: string;
  entries: ArchiveEntryDto[];
  entryCount?: number;
  totalSize?: number;
};

type DevDialogName = "about" | "preferences" | "info" | "jobs";
type DevJobFixture = JobState & {
  outputActions?: JobOutputAction[];
};

declare global {
  interface Window {
    __zmanagerDev?: {
      loadArchiveFixture: (fixture: ArchiveFixture) => void;
      setSystemIconFixtures: (fixtures: Record<string, string | null>) => void;
      setJobFixtures: (fixtures: DevJobFixture[]) => void;
      openSurface: (surface: DevDialogName) => void;
      closeModal: () => void;
    };
  }
}

const app = document.querySelector<HTMLElement>("#zmanager-runtime-bridge-root");
if (!app) {
  throw new Error("missing runtime bridge root");
}
const appRoot = app;
const useLinuxWindowChrome = isDesktopRuntime() && /\bLinux\b/i.test(navigator.userAgent);
if (useLinuxWindowChrome) {
  document.body.classList.add("linux-window-chrome");
}
document.documentElement.style.setProperty("--zmanager-min-window-width", `${APP_MIN_WINDOW_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-min-window-height", `${APP_MIN_WINDOW_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-menu-height", `${APP_MENU_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-toolbar-height", `${APP_TOOLBAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-pathbar-height", `${APP_PATH_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-statusbar-height", `${APP_STATUS_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-nav-pane-min", `${APP_NAV_PANE_MIN_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-nav-pane-width", `${APP_NAV_PANE_DEFAULT_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-nav-pane-max", `${APP_NAV_PANE_MAX_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-details-pane-min", `${APP_DETAILS_PANE_MIN_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-details-pane-width", `${APP_DETAILS_PANE_DEFAULT_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-details-pane-max", `${APP_DETAILS_PANE_MAX_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-statusbar-parts", `${APP_STATUS_BAR_PARTS}`);

appRoot.innerHTML = `
    <div id="legacy-context-menu" class="context-menu" role="menu" hidden></div>

    <div id="extract-dialog" class="dialog-backdrop" hidden>
      <section class="dialog task-dialog" role="dialog" aria-modal="true" aria-labelledby="extract-title" tabindex="-1" data-dialog-default="#extract-start" data-dialog-cancel="#extract-cancel">
        <div class="dialog-header">
          <div>
            <h2 id="extract-title" data-i18n-text="extract.title">Extract</h2>
            <p id="extract-dialog-message" data-i18n-text="extract.description">Choose a destination before starting.</p>
          </div>
          <button id="extract-dialog-close" class="icon-button" type="button" data-i18n-aria-label="extract.close.aria" data-i18n-text="common.close" aria-label="Close extract dialog">Close</button>
        </div>
        <div class="dialog-body">
          <section class="dialog-section">
            <h3 data-i18n-text="extract.destination">Extract to</h3>
            <label class="field-row">
              <span data-i18n-text="extract.destination">Extract to</span>
              <div class="inline-field">
                <input
                  id="extract-destination"
                  type="text"
                  data-i18n-placeholder="extract.destination.placeholder"
                  placeholder="Select a destination folder"
                  list="extract-destination-history"
                />
                <datalist id="extract-destination-history"></datalist>
                <button id="browse-extract-destination" type="button" data-i18n-text="common.browse" data-i18n-title="nativeDialog.chooseExtractDestination" title="Choose extract destination">Browse...</button>
              </div>
            </label>
            <div class="form-grid form-grid-compact">
              <label class="checkbox-row">
                <input id="extract-use-subfolder" type="checkbox" />
                <span data-i18n-text="extract.toSubfolder">Extract to subfolder</span>
              </label>
              <label>
                <span data-i18n-text="extract.subfolder">Subfolder</span>
                <input id="extract-subfolder" type="text" data-i18n-placeholder="common.optional" placeholder="Optional" />
              </label>
            </div>
          </section>
          <section class="dialog-section extract-options-section">
            <h3 data-i18n-text="extract.advancedOptions">Advanced options</h3>
            <div class="form-grid form-grid-compact">
              <label>
                <span data-i18n-text="extract.pathMode">Path mode</span>
                <select id="extract-path-mode">
                  <option value="full" data-i18n-text="extract.pathMode.full">Full paths</option>
                  <option value="current" data-i18n-text="extract.pathMode.current">Current folder</option>
                  <option value="none" data-i18n-text="extract.pathMode.none">No paths</option>
                </select>
              </label>
              <label>
                <span data-i18n-text="extract.overwritePolicy">Overwrite policy</span>
                <select id="browse-overwrite">
                  <option value="ask" data-i18n-text="extract.overwrite.ask">Ask</option>
                  <option value="refuse" data-i18n-text="extract.overwrite.refuse">Refuse</option>
                  <option value="rename" data-i18n-text="extract.overwrite.rename">Rename</option>
                  <option value="replace" data-i18n-text="extract.overwrite.replace">Replace</option>
                </select>
              </label>
            </div>
            <details class="advanced-options">
              <summary data-i18n-text="extract.advancedOptions">Advanced options</summary>
              <div class="form-grid form-grid-compact">
                <label>
                  <span data-i18n-text="extract.stripComponents">Strip components</span>
                  <input id="browse-strip-components" type="number" min="0" max="8" value="0" />
                </label>
                <label class="checkbox-row">
                  <input id="extract-deduplicate-root" type="checkbox" />
                  <span data-i18n-text="extract.deduplicateRoot">Eliminate duplicated root folder</span>
                </label>
              </div>
            </details>
            <details class="advanced-options extract-password-options">
              <summary data-i18n-text="extract.password">Password</summary>
              <div class="form-grid form-grid-compact">
                <label>
                  <span data-i18n-text="extract.password">Password</span>
                  <input id="browse-password" type="password" autocomplete="off" />
                </label>
              <label class="checkbox-row">
                <input id="browse-show-password" type="checkbox" />
                <span data-i18n-text="extract.showPassword">Show Password</span>
              </label>
              </div>
            </details>
          </section>
        </div>
        <div class="dialog-actions">
          <button id="extract-start" type="button" data-dialog-default-button data-i18n-text="command.extract" disabled>Extract</button>
          <button id="extract-cancel" type="button" data-dialog-cancel-button data-i18n-text="common.cancel">Cancel</button>
        </div>
      </section>
    </div>

`;

const workspaceElement = document.querySelector<HTMLElement>(".workspace")!;
const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const windowMinimizeButton = document.querySelector<HTMLButtonElement>("#window-minimize")!;
const windowMaximizeButton = document.querySelector<HTMLButtonElement>("#window-maximize")!;
const windowCloseButton = document.querySelector<HTMLButtonElement>("#window-close")!;
const windowResizeHandleElements = document.querySelectorAll<HTMLElement>("[data-window-resize-direction]");

const extractDialog = document.querySelector<HTMLDivElement>("#extract-dialog")!;

const contextMenu = document.querySelector<HTMLDivElement>("#legacy-context-menu")!;

function privatizeLegacyExtractDialogIds() {
  const publicExtractIds = [
    "extract-dialog-close",
    "extract-title",
    "extract-dialog-message",
    "extract-destination",
    "extract-destination-history",
    "browse-extract-destination",
    "extract-use-subfolder",
    "extract-subfolder",
    "extract-path-mode",
    "browse-overwrite",
    "browse-strip-components",
    "extract-deduplicate-root",
    "browse-password",
    "browse-show-password",
    "extract-start",
    "extract-cancel",
  ];

  for (const id of publicExtractIds) {
    const element = extractDialog.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!element) {
      continue;
    }
    element.dataset.legacyId = id;
    element.removeAttribute("id");
  }
}


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
let displayContext = createDisplayContext(appPreferences.locale);
let preferencesDialogDraft: AppPreferences | null = null;
let systemIconDataUrls = new Map<string, string | null>();
let systemIconRequestRevision = 0;
let tableColumnSettings: ArchiveTableColumnSettings = normalizeColumnSettings({
  visibleColumnIds: appPreferences.tableVisibleColumnIds,
  columnOrderIds: appPreferences.tableColumnOrderIds,
  columnWidths: appPreferences.tableColumnWidths,
});
let activeExtractMode: ExtractMode = "archive";
let activeExtractDialogForm: ExtractDialogFormSnapshot = createExtractDialogFormSnapshot();
let activeExtractDialogMessage = "";
let contextEntryPath = "";
let contextSourcePath = "";
let reactContextMenuSnapshot: ZManagerContextMenuSnapshot = { visible: false, id: 0 };
let reactContextMenuSequence = 0;

let dropUnlisten: (() => void) | null = null;

const jobsWorkspace = createJobsWorkspace();
let normalWorkspaceRendered = false;
let latestHealthcheck: HealthcheckResponse | null = null;
let latestContract: ProjectContract | null = null;
let reactDialogSnapshot: ZManagerDialogSnapshot = { kind: "none" };
const reactRuntimeSubscribers = new Set<ZManagerReactSnapshotListener>();

const appTimers = createAppTimers({
  jobPollIntervalMs: JOB_POLL_INTERVAL_MS,
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
const jobPollingController = createJobPollingController({
  workspace: jobsWorkspace,
  timers: jobTimers,
  pollJobEvents: (jobId) => pollJobEventsCommand({ jobId }),
  maybePromptForJobPasswordRetry,
  toCommandError: asCommandError,
  readProgressFailedMessage: () => message("jobs.readProgressFailed"),
  setOperationalStatus,
  renderJobs,
  maybeCloseCompletedQuickActionWindow,
});
const archiveLoadController = createArchiveLoadController({
  workspace: archiveWorkspace,
  enterExtractWorkspace: () => setWorkspaceMode("extract"),
  listArchive: listArchiveCommand,
  toCommandError: asCommandError,
  renderLoading: (snapshot) => {
    publishArchiveSnapshot(snapshot);
    setOperationalMessage("status.loadingArchive");
  },
  acceptListing: (listing, options) => {
    loadArchiveListingIntoState({
      archivePath: listing.archivePath,
      entries: listing.entries,
      entryCount: listing.entryCount,
      totalSize: listing.totalSize,
    }, options);
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
  renderExtractDestinationHistory: () => renderExtractDestinationHistory(),
  renderCreateDestinationHistory: () => publishReactSnapshot(),
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
    overwrite: activeExtractDialogForm.overwrite,
    stripComponents: currentExtractDialogStripComponents(),
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
    updateOpenExtractDialogSnapshot({
      messageText: message("extract.chooseDestinationFirst"),
    });
  },
  selectEntryFirst: () => {
    updateOpenExtractDialogSnapshot({
      messageText: message("extract.selectEntryFirst"),
    });
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

    void appWindowController.closeCurrentWindow().catch(() => {
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
  setCreateSources: (sources) => createWorkspace.setSources(sources).snapshot,
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
});

const startupController = createStartupController({
  fetchHealthcheck,
  fetchProjectContract,
  fetchQuickActionStartupState,
  listenQuickActionLaunch,
  isDesktopRuntime,
  revealWindowForStartupQuickAction,
  revealNormalWindow: revealNormalAppWindow,
  activateQuickActionJobs,
  handleQuickActionRequest,
  setOperationalStatus,
  setOperationalMessage,
  setBrowseError: (text) => setBrowseState("error", text),
  unknownErrorMessage,
  toCommandError: asCommandError,
  message,
  setBootstrapState: (state) => {
    latestHealthcheck = state.healthcheck;
    latestContract = state.contract;
  },
  refreshAboutDialogSnapshot,
  shouldRenderBrowseAfterBootstrap: () => normalWorkspaceRendered && !isQuickActionJobMode(),
  renderBrowse,
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
  pollJobs: () => pollJobs(),
  renderJobs,
  renderQuickProgress,
  stopPolling: () => stopPolling(),
  canEvaluateQuickActionCompletion: () => isDesktopRuntime() && isQuickActionJobMode(),
  isQuickActionWindowBackgrounded: () => shellWorkspace.isQuickActionWindowBackgrounded(),
  revealQuickActionJobWindow: () => revealQuickActionJobWindow(),
  closeFocusedJobProgress: () => closeFocusedJobProgress(),
  closeAppWindow,
});

function persistPreferencePatch(patch: AppPreferencePatch): AppPreferences {
  appPreferences = preferencesWithPatch(appPreferences, patch);
  saveAppPreferences(appPreferences);
  return appPreferences;
}

function saveTablePreferences() {
  const sort = archiveWorkspace.getSnapshot().view.sort;
  const preferences = persistPreferencePatch({
    tableVisibleColumnIds: tableColumnSettings.visibleColumnIds,
    tableColumnOrderIds: tableColumnSettings.columnOrderIds,
    tableColumnWidths: tableColumnSettings.columnWidths,
    tableSortKey: sort.key,
    tableSortAscending: sort.ascending,
  });
  tableColumnSettings = normalizeColumnSettings({
    visibleColumnIds: preferences.tableVisibleColumnIds,
    columnOrderIds: preferences.tableColumnOrderIds,
    columnWidths: preferences.tableColumnWidths,
  });
}

function savePreferencePatch(patch: AppPreferencePatch) {
  persistPreferencePatch(patch);
  publishReactSnapshot();
}

function setFlatView(nextFlatView: boolean, persistPreference: boolean) {
  publishArchiveSnapshot(archiveWorkspace.setFlatView(nextFlatView));
  if (persistPreference) {
    savePreferencePatch({ flatViewDefault: nextFlatView });
  }
}

function applySortCommand(nextSortKey: ArchiveSortKey) {
  publishArchiveSnapshot(archiveWorkspace.applySortCommand(nextSortKey));
  saveTablePreferences();
}

function applySortDirection(nextSortKey: ArchiveSortKey, ascending: boolean) {
  publishArchiveSnapshot(archiveWorkspace.applySortDirection(nextSortKey, ascending));
  saveTablePreferences();
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
  if (!wasInJobMode || autoCloseAction === "closeWindow") {
    setFocusedJobAutoCloseAction(autoCloseAction);
  }
  if (!wasInJobMode && autoCloseAction === "returnToWorkspace") {
    void appWindowController.persistCurrentWindowGeometry();
  }
  shellWorkspace.setQuickActionWindowMode("jobOnly");
  workspaceElement.dataset.quickActionMode = "job-only";
  document.body.classList.add("quick-action-job-mode");
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
  document.body.classList.remove("quick-action-job-mode");
  delete workspaceElement.dataset.quickActionMode;
  setOperationalMessage("jobs.background");
  openJobDrawer();
  renderJobs();
}

async function closeFocusedJobProgress() {
  clearQuickActionAutoCloseTimer();
  jobsWorkspace.resetFocusedQuickActionProgress();
  shellWorkspace.setQuickActionWindowMode("normal");
  document.body.classList.remove("quick-action-job-mode");
  delete workspaceElement.dataset.quickActionMode;
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
  if (shellWorkspace.selectQuickActionStartupRevealTarget(state) === "jobOnly") {
    await revealQuickActionJobWindow();
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

function findActiveArchiveRow(path: string): HTMLTableRowElement | null {
  if (!path) {
    return null;
  }

  const selector = `tr[data-entry-path="${CSS.escape(path)}"]`;
  return document.querySelector<HTMLTableRowElement>(selector);
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

function normalizeFolderPath(path: string): string {
  return normalizeEntryPath(path);
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
  const snapshot = archiveSnapshot();
  if (!snapshot.currentArchivePath || !appPreferences.showRealFileIcons) {
    return [];
  }

  const requests = new Map<string, SystemFileIconRequestEntry>();
  const add = (request: SystemFileIconRequestEntry | null) => {
    if (request && !systemIconDataUrls.has(request.key)) {
      requests.set(request.key, request);
    }
  };

  add(systemIconRequestForPath(snapshot.currentArchivePath, false));
  add(systemIconRequestForPath("folder", true));
  for (const entry of snapshot.entries) {
    add(systemIconRequestForEntry(entry));
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

function syncCreateSourcesFromWorkspace(
  snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot(),
): CreateWorkspaceSnapshot {
  return snapshot;
}

function publishCreateWorkspaceSnapshot(
  snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot(),
): CreateWorkspaceSnapshot {
  publishReactSnapshot();
  return snapshot;
}

function suggestedCreateArchiveName(sources = createWorkspace.getSnapshot().sources): string {
  return createWorkspace.suggestedArchiveName(sources);
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
    findActiveArchiveRow(entryPath)?.focus();
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
      if (response.outcome === "cancelled") {
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
    entries: listing.entries,
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
  const value = window.prompt(promptMessage);
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
    createArchive: showCreateWorkspace,
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
        openExtractHereDialog(mode);
        return;
      }
      openExtractDialog(mode);
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
    toggleArchiveToolbar: () => {
      savePreferencePatch({ toolbarVisible: !appPreferences.toolbarVisible });
    },
    toggleLargeButtons: () => {
      savePreferencePatch({ largeToolbarButtons: !appPreferences.largeToolbarButtons });
    },
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
    shell: shellWorkspace.getSnapshot(),
    archive,
    create: createWorkspace.getSnapshot(),
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
        largeButtons: appPreferences.largeToolbarButtons,
        showButtonText: appPreferences.showToolbarLabels,
      },
      primaryCommandIds: commandIdsWithClass(commandClassState, "primary"),
      secondaryCommandIds: commandIdsWithClass(commandClassState, "secondary"),
    },
    contextMenu: reactContextMenuSnapshot,
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
  if (reactRuntimeSubscribers.size === 0) {
    return;
  }

  const snapshot = createCurrentReactSnapshot();
  for (const subscriber of reactRuntimeSubscribers) {
    subscriber(snapshot);
  }
}

function showContextMenu(x: number, y: number, items: readonly ContextMenuItem[]) {
  reactContextMenuSnapshot = {
    visible: true,
    id: reactContextMenuSequence += 1,
    x,
    y,
    items,
  };
  publishReactSnapshot();
}

function hideContextMenu() {
  contextEntryPath = "";
  contextSourcePath = "";
  if (!reactContextMenuSnapshot.visible) {
    return;
  }

  reactContextMenuSnapshot = {
    visible: false,
    id: reactContextMenuSnapshot.id,
  };
  publishReactSnapshot();
}

function handleReactArchiveIntent(intent: ZManagerArchiveIntent) {
  switch (intent.type) {
    case "navigateToFolder":
      navigateToFolder(intent.folderPath);
      break;
    case "navigateBack":
      navigateBack();
      break;
    case "navigateUp":
      navigateUp();
      break;
    case "setSearchQuery":
      publishArchiveSnapshot(archiveWorkspace.setSearchQuery(intent.query));
      break;
    case "clearSearch":
      clearSearch();
      break;
    case "setFlatView":
      setFlatView(intent.flatView, Boolean(intent.persistPreference));
      break;
    case "setColumnWidth":
      setTableColumnWidth(intent.columnId, intent.width, intent.persist);
      break;
    case "toggleTreeFolder":
      publishArchiveSnapshot(archiveWorkspace.toggleTreeFolder(intent.folderPath));
      break;
    case "sortByColumn":
      applySortCommand(intent.columnId);
      break;
    case "selectAllVisible":
      selectVisibleEntries();
      break;
    case "clearSelection":
      clearBrowseSelection();
      break;
    case "selectRow":
      updateSelectionByIntent(intent.path, {
        ctrl: intent.ctrlKey,
        meta: intent.metaKey,
        shift: intent.shiftKey,
      });
      break;
    case "setRowSelected":
      applyArchiveTableSelection(setHierarchicalTablePathSelected({
        ...currentArchiveTableSelectionState(),
        path: intent.path,
        selected: intent.selected,
      }));
      break;
    case "applySelection":
      if (hasActiveJob()) {
        break;
      }
      applyArchiveTableSelection({
        selectedPaths: new Set(intent.selectedPaths),
        focusedPath: intent.focusedPath,
        anchorPath: intent.anchorPath,
      });
      break;
    case "activateRow":
      if (intent.rowKind === "folder" || intent.rowKind === "parent") {
        navigateToFolder(intent.path);
        break;
      }
      updateSelectionByIntent(intent.path);
      runRoutedCommand("view");
      break;
    case "startNativeDrag":
      if (!hasActiveJob()) {
        void startNativeDragOut(intent.entryPath);
      }
      break;
    case "copyDetailsValue":
      void copyTextToClipboard(intent.value);
      break;
    case "showEmptyContextMenu":
      showStartupContextMenu(intent.x, intent.y);
      break;
    case "showColumnContextMenu":
      showTableHeaderContextMenu(intent.x, intent.y, intent.columnId);
      break;
    case "showRowContextMenu":
      if (intent.rowKind === "folder" || intent.rowKind === "parent") {
        showFolderContextMenu(intent.path, intent.x, intent.y, intent.path);
      } else {
        showEntryContextMenu(intent.path, intent.x, intent.y);
      }
      break;
    case "runDetailsAction": {
      if (intent.action === "clear-search") {
        clearSearch();
        break;
      }
      const routedCommand = selectDetailsCommand(intent.action);
      if (routedCommand) {
        runRoutedCommand(routedCommand.commandId, routedCommand.payload);
      }
      break;
    }
  }
}

function handleReactCreateIntent(intent: ZManagerCreateIntent) {
  switch (intent.type) {
    case "showWorkspace":
      showCreateWorkspace();
      break;
    case "showAddSourcesMenu":
      contextEntryPath = "";
      contextSourcePath = "";
      showContextMenu(intent.x, intent.y, buildAddSourcesContextMenuItems(displayContext.translator));
      break;
    case "clearSources":
      clearCreateSources();
      break;
    case "removeSources":
      removeCreateSources([...intent.sourcePaths]);
      break;
    case "showSourceContextMenu":
      showSourceContextMenu(intent.sourcePath, intent.x, intent.y);
      break;
    case "setDestinationPath":
      publishCreateWorkspaceSnapshot(createWorkspace.setDestinationPath(intent.destinationPath).snapshot);
      break;
    case "browseDestination":
      void onSelectCreateDestination();
      break;
    case "changeFormat": {
      const defaults = createDefaultsForFormat(appPreferences, intent.format);
      publishCreateWorkspaceSnapshot(createWorkspace.changeFormat(intent.format, defaults).snapshot);
      queuePlanRun();
      break;
    }
    case "setOptions":
      publishCreateWorkspaceSnapshot(createWorkspace.setOptions(intent.patch).snapshot);
      queuePlanRun();
      break;
    case "navigateToFolder": {
      const navigation = createWorkspace.navigateToFolder(intent.folderPath);
      if (navigation.changed) {
        publishCreateWorkspaceSnapshot(navigation.snapshot);
      } else {
        publishReactSnapshot();
      }
      break;
    }
    case "setSearchQuery":
      publishCreateWorkspaceSnapshot(createWorkspace.setSearchQuery(intent.query));
      break;
    case "clearSearch":
      publishCreateWorkspaceSnapshot(createWorkspace.clearSearch());
      break;
    case "toggleTreeFolder": {
      const navigation = createWorkspace.toggleTreeFolder(intent.folderPath);
      if (navigation.changed) {
        publishCreateWorkspaceSnapshot(navigation.snapshot);
      } else {
        publishReactSnapshot();
      }
      break;
    }
    case "setPathIncluded":
      publishCreateWorkspaceSnapshot(createWorkspace.setPathIncluded(intent.path, intent.included).snapshot);
      break;
    case "setAllIncluded":
      publishCreateWorkspaceSnapshot(createWorkspace.setAllPathsIncluded(intent.included).snapshot);
      break;
    case "setCurrentFolderIncluded":
      publishCreateWorkspaceSnapshot(
        createWorkspace.setCurrentFolderIncluded(
          createWorkspace.getSnapshot().view.currentFolder,
          intent.included,
        ).snapshot,
      );
      break;
    case "selectRow":
      publishCreateWorkspaceSnapshot(createWorkspace.selectRow(intent.path, intent).snapshot);
      break;
    case "applySelection":
      publishCreateWorkspaceSnapshot(createWorkspace.updateSelection({
        selectedPaths: new Set(intent.selectedPaths),
        focusedPath: intent.focusedPath,
        anchorPath: intent.anchorPath,
      }).snapshot);
      break;
    case "toggleRowSelection":
      publishCreateWorkspaceSnapshot(createWorkspace.toggleRowSelection(intent.path).snapshot);
      break;
    case "focusRow":
      publishCreateWorkspaceSnapshot(createWorkspace.focusRow(intent.path).snapshot);
      break;
    case "removeSelectedSources": {
      const selectedSourcePaths = selectedCompressSourcePaths();
      const fallbackSourcePath = intent.fallbackSourcePath?.trim();
      removeCreateSources(
        selectedSourcePaths.length > 0
          ? selectedSourcePaths
          : fallbackSourcePath
            ? [fallbackSourcePath]
            : [],
      );
      publishReactSnapshot();
      break;
    }
    case "showCompressRowContextMenu": {
      if (visibleCompressRowForPath(intent.path)) {
        if (!createWorkspace.getSnapshot().selection.selectedPaths.includes(intent.path)) {
          publishCreateWorkspaceSnapshot(createWorkspace.ensureRowSelected(intent.path).snapshot);
        }
        showCompressRowContextMenuForPath(intent.path, intent.sourcePath ?? "", intent.x, intent.y);
      } else if (intent.sourcePath) {
        showSourceContextMenu(intent.sourcePath, intent.x, intent.y);
      }
      publishReactSnapshot();
      break;
    }
    case "runCreate":
      void runCreate({
        passwordInput: {
          password: intent.password,
          passwordConfirm: intent.passwordConfirm,
        },
      });
      break;
  }
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
      void pollJobs();
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
      const modal = getOpenModal();
      if (modal) {
        closeModal(modal);
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
  }
}

function handleReactContextMenuIntent(intent: ZManagerContextMenuIntent) {
  switch (intent.type) {
    case "action":
      handleContextMenuAction(intent.payload);
      break;
    case "hide":
      hideContextMenu();
      break;
  }
}

function handleReactKeyboardIntent(intent: ZManagerKeyboardIntent) {
  switch (intent.type) {
    case "escape":
      if (hasOpenMenu()) {
        closeOpenMenus();
        return;
      }

      hideContextMenu();
      if (preferencesDialogDraft) {
        cancelReactPreferencesDialog();
      } else if (reactDialogSnapshot.kind !== "none") {
        closeReactDialog();
      } else {
        const openDialogElement = getOpenModal();
        if (openDialogElement) closeModal(openDialogElement);
        else if (shellWorkspace.getSnapshot().jobDrawerOpen) closeJobDrawer();
        else clearBrowseSelection();
      }
      break;
    case "focusSearch": {
      if (!archiveSnapshot().command.canSearchEntries) {
        setOperationalMessage("browse.noArchiveOpen");
        return;
      }
      const publicSearchInput = document.querySelector<HTMLInputElement>("#search-entries");
      if (!publicSearchInput) {
        return;
      }
      publicSearchInput.focus();
      publicSearchInput.select();
      break;
    }
  }
}

export function getZManagerRuntimeAdapter(): ZManagerReactRuntimeAdapter {
  return {
    getSnapshot: createCurrentReactSnapshot,
    subscribe(listener) {
      reactRuntimeSubscribers.add(listener);
      listener(createCurrentReactSnapshot());
      return () => {
        reactRuntimeSubscribers.delete(listener);
      };
    },
    actions: {
      executeCommand: runRoutedCommand,
      setWorkspaceMode,
      handleArchiveIntent: handleReactArchiveIntent,
      handleCreateIntent: handleReactCreateIntent,
      handleJobsIntent: handleReactJobsIntent,
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

function createPlanEntries(snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace()): CreatePlanEntryDto[] {
  return snapshot.plan.current?.planEntries ?? [];
}

function compressRowInclusionState(row: CompressPlanRow): "included" | "excluded" | "partial" {
  return createWorkspace.getRowInclusionState(row);
}

function setCompressPathIncluded(path: string, included: boolean) {
  syncCreateSourcesFromWorkspace(createWorkspace.setPathIncluded(path, included).snapshot);
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
  return [...syncCreateSourcesFromWorkspace().view.rows];
}

function visibleCompressRowForPath(path: string): CompressPlanRow | undefined {
  const normalizedPath = normalizeEntryPath(path);
  return visibleCompressRows().find((row) => normalizeEntryPath(row.path) === normalizedPath);
}

function sourcePathForCompressRow(
  row: CompressPlanRow,
  snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace(),
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
  updateOpenExtractDialogSnapshot({
    messageText: message(retry.promptKey),
    formPatch: {
      passwordPromptOpen: true,
    },
  });
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

function closeOpenMenus(exceptMenu?: HTMLDetailsElement) {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(".menu[open]")) {
    if (menu === exceptMenu) {
      continue;
    }
    menu.open = false;
  }
}

function hasOpenMenu(): boolean {
  return document.querySelector(".menu[open]") !== null;
}

function openMenu(menu: HTMLDetailsElement) {
  closeOpenMenus(menu);
  menu.open = true;
}

function bindMenuBehavior() {
  const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".menu"));

  function focusAdjacentMenu(currentMenu: HTMLDetailsElement, offset: -1 | 1) {
    const index = menus.indexOf(currentMenu);
    if (index === -1) {
      return;
    }

    const nextMenu = menus[(index + offset + menus.length) % menus.length];
    openMenu(nextMenu);
    nextMenu.querySelector<HTMLElement>("summary")?.focus();
  }

  for (const menu of menus) {
    const summary = menu.querySelector<HTMLElement>("summary");
    if (!summary) {
      continue;
    }

    menu.addEventListener("pointerenter", () => openMenu(menu));
    menu.addEventListener("focusin", () => openMenu(menu));

    menu.addEventListener("pointerleave", () => {
      if (!menu.matches(":focus-within")) {
        menu.open = false;
      }
    });

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      openMenu(menu);
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        menu.open = false;
        summary.focus();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        focusAdjacentMenu(menu, 1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusAdjacentMenu(menu, -1);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        openMenu(menu);
        menu.querySelector<HTMLButtonElement>(".menu-popover button:not(:disabled)")?.focus();
      }
    });

    menu.addEventListener("toggle", () => {
      if (menu.open) {
        closeOpenMenus(menu);
      }
    });
  }
}

async function openNativeDialog(options: NativeDialogOpenOptions) {
  return openRuntimeDialog(options, setOperationalStatus, {
    unavailableInBrowser: message("nativeDialog.unavailableInBrowser"),
    failed: message("nativeDialog.failed"),
  });
}

async function saveNativeDialog(options: NativeDialogSaveOptions) {
  return saveRuntimeDialog(options, setOperationalStatus, {
    unavailableInBrowser: message("nativeDialog.unavailableInBrowser"),
    failed: message("nativeDialog.failed"),
  });
}

function fallbackFocusForDialog(dialog: HTMLElement): HTMLElement | null {
  if (dialog === extractDialog) {
    const row = findActiveArchiveRow(archiveFocusedPath());
    return row ?? extractToolbarButton;
  }

  return null;
}

function onModalClosed(dialog: HTMLElement) {
  if (dialog === extractDialog) {
    archiveWorkspace.clearPasswordRetry();
  }
}

const modalController = createModalController({
  dialogs: () => [extractDialog],
  fallbackFocus: fallbackFocusForDialog,
  ignoredReturnFocusRoots: () => [
    contextMenu,
    ...Array.from(document.querySelectorAll<HTMLElement>("#context-menu")),
  ],
  onClose: onModalClosed,
});

function getOpenModal(): HTMLElement | null {
  return modalController.getOpenModal();
}

function isDefaultSafeDialogTextEntry(dialog: HTMLElement, target: HTMLElement): boolean {
  return dialog === extractDialog &&
    target instanceof HTMLInputElement &&
    !["button", "checkbox", "radio", "reset", "submit"].includes(target.type);
}

const openModal = (dialog: HTMLElement, focusSelector = "button, input, select", returnFocusOverride: HTMLElement | null = null) => {
  modalController.open(dialog, focusSelector, returnFocusOverride);
};

const closeModal = (dialog: HTMLElement) => {
  modalController.close(dialog);
};

function setReactDialogSnapshot(snapshot: ZManagerDialogSnapshot) {
  reactDialogSnapshot = snapshot;
  publishReactSnapshot();
}

function closeReactDialog() {
  const previous = reactDialogSnapshot;
  reactDialogSnapshot = { kind: "none" };
  if (previous.kind === "extract") {
    archiveWorkspace.clearPasswordRetry();
    activeExtractDialogForm = patchExtractDialogFormSnapshot(activeExtractDialogForm, {
      passwordPromptOpen: false,
    });
  }
  publishReactSnapshot();

  if (previous.kind === "info") {
    (findActiveArchiveRow(previous.returnFocusPath) ?? infoToolbarButton).focus();
  } else if (previous.kind === "extract") {
    findActiveArchiveRow(archiveFocusedPath())?.focus();
  }
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
    passwordPromptOpen: activeExtractDialogForm.passwordPromptOpen,
  });
}

function activateDialogDefault(event: KeyboardEvent, dialog: HTMLElement): boolean {
  return modalController.activateDefault(event, dialog, {
    isDefaultSafeTextEntry: isDefaultSafeDialogTextEntry,
  });
}

function cancelDialog(event: KeyboardEvent, dialog: HTMLElement): boolean {
  return modalController.cancel(event, dialog);
}

function isCreateSubmissionInFlight(): boolean {
  return createWorkspace.getSnapshot().options.submissionInFlight;
}

function openJobDrawer() {
  if (isQuickActionJobMode()) {
    void pollJobs();
    return;
  }

  shellWorkspace.setJobDrawerOpen(true);
  publishReactSnapshot();
  void pollJobs();
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
      document.querySelector<HTMLButtonElement>("#drop-open-archive")?.focus();
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
  return visibleColumns(tableColumnSettings).find((column) => column.id === columnId)
    ?? ARCHIVE_TABLE_COLUMNS.find((column) => column.id === columnId);
}

function setTableColumnWidth(columnId: ArchiveTableColumnId, width: number, persist: boolean) {
  tableColumnSettings = setColumnWidth(tableColumnSettings, columnId, width);
  if (persist) {
    saveTablePreferences();
  }
  publishReactSnapshot();
}

function adjustTableColumnWidth(columnId: ArchiveTableColumnId, delta: number) {
  const column = tableColumnById(columnId);
  if (!column) {
    return;
  }
  setTableColumnWidth(columnId, column.width + delta, true);
}

function resetTableColumnWidth(columnId: ArchiveTableColumnId) {
  const column = ARCHIVE_TABLE_COLUMNS.find((item) => item.id === columnId);
  if (!column) {
    return;
  }
  setTableColumnWidth(columnId, column.width, true);
}

function entryIsUnderFolder(entryPath: string, folderPath: string): boolean {
  const normalizedEntry = normalizeEntryPath(entryPath);
  const normalizedFolder = normalizeFolderPath(folderPath).replace(/\/+$/, "");
  if (!normalizedFolder) {
    return true;
  }
  return normalizedEntry === normalizedFolder || normalizedEntry.startsWith(`${normalizedFolder}/`);
}

function selectFolderEntries(folderPath: string) {
  const descendantEntries = archiveEntries()
    .filter((entry) => entry.kind !== "directory" && entryIsUnderFolder(entry.path, folderPath))
    .map((entry) => entry.path);
  const folderEntry = getEntryByPath(folderPath);
  applyArchiveTableSelection(replaceHierarchicalTableSelection({
    paths: descendantEntries.length > 0
      ? descendantEntries
      : folderEntry ? [folderEntry.path] : [],
    focusedPath: archiveFocusedPath(),
    anchorPath: archiveSelectionAnchorPath(),
  }));
}

function showStartupContextMenu(x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(x, y, buildStartupContextMenuItems({
    translator: displayContext.translator,
    canPastePath: canReadClipboard(),
    recentArchiveHistory: pathHistoryStore.getSnapshot().recentArchiveHistory,
  }));
}

function showFolderContextMenu(folderPath: string, x: number, y: number, entryPath = "") {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  showContextMenu(x, y, buildArchiveFolderContextMenuItems({
    translator: displayContext.translator,
    folderPath,
    entryPath,
    selectedCount: getSelectedEntryPaths().length,
    hasArchive: Boolean(archiveCurrentPath()),
  }));
}

function showEntryContextMenu(entryPath: string, x: number, y: number) {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  if (!archiveSelectedPathSet().has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
  }
  const entry = getEntryByPath(entryPath);
  const selectedCount = getSelectedEntryPaths().length;
  showContextMenu(x, y, buildArchiveEntryContextMenuItems({
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
  showContextMenu(x, y, buildArchiveHeaderContextMenuItems({
    translator: displayContext.translator,
    tableColumnSettings,
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
  contextEntryPath = "";
  contextSourcePath = sourcePath;

  showContextMenu(x, y, buildCompressRowContextMenuItems({
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
  contextEntryPath = "";
  contextSourcePath = sourcePath;
  showContextMenu(x, y, buildSourceContextMenuItems({
    translator: displayContext.translator,
    sourcePath,
  }));
}

function showAddSourcesMenu(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(rect.left, rect.bottom + 4, buildAddSourcesContextMenuItems(displayContext.translator));
}

function handleContextMenuAction(payload: ContextMenuActionPayload) {
  const action = payload.action;
  const folderPath = payload.folderPath;
  const columnId = payload.columnId;
  const archivePath = payload.archivePath;
  const entryPath = payload.entryPath ?? contextEntryPath;
  const sourcePath = payload.sourcePath ?? contextSourcePath;
  hideContextMenu();

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
  if (action === "extract-folder" && folderPath !== undefined) {
    selectFolderEntries(folderPath);
    openExtractDialog("selection");
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
  if (action === "open-inside") {
    if (entryPath) {
      const entry = getEntryByPath(entryPath);
      if (!entry) {
        return;
      }
      if (entry.kind !== "directory") {
        setOperationalMessage("command.singleFolderRequired");
        return;
      }
      navigateToFolder(entryPath);
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
    tableColumnSettings = toggleColumnVisibility(tableColumnSettings, columnId);
    saveTablePreferences();
    publishReactSnapshot();
    return;
  }
  if (action === "move-column-left" && columnId) {
    tableColumnSettings = moveColumn(tableColumnSettings, columnId, "left");
    saveTablePreferences();
    publishReactSnapshot();
    return;
  }
  if (action === "move-column-right" && columnId) {
    tableColumnSettings = moveColumn(tableColumnSettings, columnId, "right");
    saveTablePreferences();
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
    tableColumnSettings = resetColumnSettings();
    saveTablePreferences();
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
  refreshDisplayContext(appPreferences.locale, {
    activeWorkspace: activeDisplayWorkspace(),
    jobsVisible: shellWorkspace.getSnapshot().jobDrawerOpen || isQuickActionJobMode(),
    preferencesVisible: Boolean(preferencesDialogDraft),
  }, {
    commitContext: (nextDisplayContext) => {
      displayContext = nextDisplayContext;
    },
    documentElement: document.documentElement,
    translationRoot: document.body,
    renderBrowse,
    renderCreate: publishReactSnapshot,
    renderJobs,
  });
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
  applyCreatePreferenceDefaults();
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
  hideContextMenu();
  shellWorkspace.setWorkspaceMode("extract");
  const snapshot = archiveWorkspace.loadSucceeded(archiveListingFromFixture(listing), {
    preserveState: preservedState,
  });
  publishArchiveSnapshot(snapshot);
  setOperationalMessage("archive.loaded");
}

function isLocalDevHost() {
  return import.meta.env.DEV && (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost");
}

function loadLocalDevFixtureFromUrl() {
  if (!isLocalDevHost() || !normalWorkspaceRendered || isQuickActionJobMode()) {
    return;
  }

  const fixtureName = new URLSearchParams(window.location.search).get("fixture");
  if (fixtureName !== "archive") {
    return;
  }

  loadArchiveListingIntoState({
    archivePath: "C:/Users/Frank/Downloads/photos.zip",
    entries: [
      {
        path: "wedding/",
        kind: "directory",
        size: 0,
        compressedSize: 0,
        modified: "1781085600",
      },
      {
        path: "wedding/raw/photo01.jpg",
        kind: "file",
        size: 5_242_880,
        compressedSize: 3_145_728,
        modified: "1781085660",
      },
      {
        path: "wedding/raw/photo02.jpg",
        kind: "file",
        size: 6_291_456,
        compressedSize: 4_194_304,
        modified: "1781085720",
      },
      {
        path: "docs/readme.txt",
        kind: "file",
        size: 1_200,
        compressedSize: 600,
        modified: "1780995600",
      },
    ],
  });
}

async function runPlan(revision?: number) {
  await createPlanController.runPlan(revision);
}

function addSources(paths: string[]) {
  const previousSnapshot = syncCreateSourcesFromWorkspace();
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
  if (options.focusProgress) {
    void revealQuickActionJobWindow(options.autoCloseAction ?? "returnToWorkspace");
  }
  jobsWorkspace.addJob(response, {
    retryContext: options.retryContext,
    outputActions: options.outputActions,
  });
  trackQuickActionJob(response.jobId, options.progressContext);

  schedulePolling();
  renderJobs();
  openJobDrawer();
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

async function handleQuickActionRequest(request: QuickActionRequestDto) {
  await quickActionController.handleQuickActionRequest(request);
}

async function activateQuickActionJobs(responses: StartJobResponseDto[]) {
  if (!responses.length) {
    return;
  }

  await revealQuickActionJobWindow();
  for (const response of responses) {
    addJobState(response);
  }
  setOperationalMessage("jobs.quickActionStarted");
}

async function handleStartupQuickAction() {
  await startupController.handleStartupQuickAction();
}

async function handleQuickActionStartupState(state: QuickActionStartupStateDto) {
  await startupController.handleQuickActionStartupState(state);
}

async function bindQuickActionLaunchEvents() {
  await startupController.bindQuickActionLaunchEvents();
}

async function initializeDesktopRuntime() {
  await startupController.initializeDesktopRuntime();
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

async function pollJobs() {
  await jobPollingController.pollJobs();
}

function schedulePolling() {
  jobPollingController.schedulePolling();
}

function scheduleProgressClock() {
  jobPollingController.scheduleProgressClock();
}

function stopProgressClock() {
  jobPollingController.stopProgressClock();
}

function syncProgressClock(snapshot: ProgressClockSnapshot = jobsWorkspace.getProgressClockSnapshot()) {
  jobPollingController.syncProgressClock(snapshot);
}

function stopPolling() {
  jobPollingController.stopPolling();
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
  const optionSnapshot = syncCreateSourcesFromWorkspace().options;
  const selected = await saveNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseDestinationArchive"),
    defaultPath: optionSnapshot.destinationPath.trim()
      ? createWorkspace.destinationPathWithFormatExtension(optionSnapshot.destinationPath)
      : suggestedCreateArchiveDefaultPath(),
    filters: CREATE_ARCHIVE_FILTERS,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }
  publishCreateWorkspaceSnapshot(createWorkspace.setDestinationPath(
    createWorkspace.destinationPathWithFormatExtension(selected),
  ).snapshot);
}

async function runCreate(
  options: {
    destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
    passwordInput: {
      password: string;
      passwordConfirm: string;
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
  await startupController.loadBootstrapState();
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

function bindDialogCloseButtons() {
  document.querySelector<HTMLButtonElement>("#extract-dialog-close")!.addEventListener("click", () => closeModal(extractDialog));
  document.querySelector<HTMLButtonElement>("#extract-cancel")!.addEventListener("click", () => closeModal(extractDialog));
}

function bindActions() {
  windowMinimizeButton.addEventListener("click", minimizeAppWindow);
  windowMaximizeButton.addEventListener("click", toggleAppWindowMaximize);
  windowCloseButton.addEventListener("click", closeAppWindow);
  if (useLinuxWindowChrome) {
    for (const handle of windowResizeHandleElements) {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        const direction = handle.dataset.windowResizeDirection as AppWindowResizeDirection | undefined;
        if (!direction) {
          return;
        }

        event.preventDefault();
        void appWindowController.beginResizeDrag(direction);
      });
    }
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (!event.target.closest(".context-menu")) {
      hideContextMenu();
    }
    if (!event.target.closest(".menu")) {
      closeOpenMenus();
    }
  });

  document.addEventListener("focusin", (event) => modalController.keepFocusInsideOpenModal(event));
}

bindMenuBehavior();
bindDialogCloseButtons();
bindActions();
privatizeLegacyExtractDialogIds();
bindWindowLifecycleHandlers();
refreshDisplayFromPreferences();
pathHistoryStore.load();
applyCreatePreferenceDefaults();
setBrowseState("idle", displayContext.translator.t("browse.statusIdle"));
if (isLocalDevHost()) {
  window.__zmanagerDev = {
    loadArchiveFixture: loadArchiveListingIntoState,
    setSystemIconFixtures: (fixtures: Record<string, string | null>) => {
      systemIconDataUrls = new Map(Object.entries(fixtures));
      renderBrowse();
    },
    setJobFixtures: (fixtures: DevJobFixture[]) => {
      jobsWorkspace.replaceJobs(fixtures);
      renderJobs();
    },
    openSurface: (surface: DevDialogName) => {
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
      const openDialog = getOpenModal();
      if (openDialog) {
        closeModal(openDialog);
      }
      closeJobDrawer();
    },
  };
}
void bindTauriFileDrop();
if (isDesktopRuntime()) {
  void initializeDesktopRuntime().finally(() => {
    loadLocalDevFixtureFromUrl();
    void loadBootstrapState();
  });
} else {
  renderNormalWorkspaceOnce();
  loadLocalDevFixtureFromUrl();
  void loadBootstrapState();
}
