import "./styles.css";
import {
  APP_TITLE,
  APP_VERSION,
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
  selectTreeCommand,
  type CommandRouterPayload,
} from "./app/commands/commandRouter";
import {
  contextMenuAction,
  contextMenuCaption,
  contextMenuCheckbox,
  contextMenuSeparator,
  type ContextMenuActionPayload,
  type ContextMenuModelItem,
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
  type ExtractStartInput,
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
  archiveTableColumnLabel,
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
} from "./app/workspaces/archiveWorkspace";
import {
  createCreateWorkspace,
  type CreateWorkspacePlanStatus,
  type CreateWorkspaceSnapshot,
} from "./app/workspaces/createWorkspace";
import {
  createCreateWorkspaceSelection,
} from "./app/workspaces/createWorkspaceSelection";
import {
  archiveEntryIconDescriptor,
  archiveFileIconDescriptor,
  archiveRowIconDescriptor,
  archiveTreeIconDescriptor,
  type ArchiveEntryIconDescriptor,
} from "./app/archiveEntryIcons";
import {
  middleTruncateDetailValue,
  renderArchiveBrowseMessage,
  renderArchiveCommandControlState,
  renderArchiveDetails,
  renderArchiveMetaText,
  renderArchiveNavigationTree,
  renderArchivePathBar,
  renderArchiveWorkspaceModeChrome,
  renderArchiveWorkspaceTable,
  renderDetailRows as renderArchiveDetailRows,
  syncArchiveVisibleSelection,
  type ArchiveDetailsModel,
  type ArchivePathBarModel,
  type ArchiveWorkspaceTreeFolder,
  type DetailRow,
} from "./ui/archiveWorkspaceView";
import {
  type IconNode,
} from "lucide";
import {
  pathsWithSameExtension,
} from "./app/selection";
import {
  applyHierarchicalRowSelectionIntent,
  cleanupHierarchicalTableSelection,
  clearHierarchicalTableSelection,
  ensureHierarchicalTablePathSelected,
  focusHierarchicalTablePath,
  invertVisibleHierarchicalSelection,
  moveHierarchicalTableFocus,
  replaceHierarchicalTableSelection,
  selectAllVisibleHierarchicalRows,
  selectableHierarchicalRowPaths,
  setHierarchicalTablePathSelected,
  toggleHierarchicalTablePathSelection,
  type HierarchicalTableSelectionResult,
} from "./app/hierarchicalTable";
import {
  escapeHtml as escapeHtmlValue,
  getPathBasename,
  parseDateValue,
} from "./app/formatting";
import {
  normalizeArchivePath,
} from "./app/archiveTree";
import {
  CREATE_ARCHIVE_FILTERS,
  getArchiveName,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
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
} from "./app/extractFlow";
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
  createZManagerReactSnapshot,
  displaySnapshotFromContext,
  type ZManagerArchiveIntent,
  type ZManagerContextMenuIntent,
  type ZManagerContextMenuSnapshot,
  type ZManagerCreateIntent,
  type ZManagerDesktopIntent,
  type ZManagerDialogAction,
  type ZManagerDialogDetailRow,
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
type BrowserRow = ArchiveTableRow;
type SelectableBrowserRow = Extract<BrowserRow, { rowType: "folder" | "entry" }>;
type ArchiveTreeFolder = {
  path: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
};
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

function toolbarIcon(
  name:
    | "open"
    | "new"
    | "add"
    | "extract"
    | "test"
    | "copy"
    | "move"
    | "delete"
    | "preview"
    | "info"
    | "jobs"
    | "settings"
    | "refresh"
    | "select"
    | "flat"
    | "help",
): string {
  const paths = {
    open: '<path d="M3 6.5h4.2l1.3 1.5H13v6H3z" /><path d="M3 6.5V4h3.8l1.3 1.5H13V8" />',
    new: '<path d="M7.5 3v9" /><path d="M3 7.5h9" /><path d="M13.5 5v9H4.5" />',
    add: '<path d="M3 5.5h4.2L8.5 7H13v6H3z" /><path d="M8 8.5v3" /><path d="M6.5 10h3" />',
    extract: '<path d="M7.5 3v7" /><path d="M4.5 7.5l3 3 3-3" /><path d="M3 13h9" />',
    test: '<path d="M3.5 8l2.5 2.5 5.5-6" /><path d="M13 8a5.5 5.5 0 1 1-2-4.2" />',
    copy: '<path d="M5 3.5h6.5v7H5z" /><path d="M3.5 5.5v6h6" />',
    move: '<path d="M3 7.5h8" /><path d="M8.5 5l2.5 2.5L8.5 10" /><path d="M3 11.5h4" />',
    delete: '<path d="M4 5h7" /><path d="M6 5V3.5h3V5" /><path d="M5 6.5l.5 6h4l.5-6" />',
    preview: '<path d="M2.5 8s2-3.5 5-3.5 5 3.5 5 3.5-2 3.5-5 3.5-5-3.5-5-3.5z" /><path d="M7.5 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />',
    info: '<path d="M7.5 13a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z" /><path d="M7.5 7v3" /><path d="M7.5 5h.01" />',
    jobs: '<path d="M3 4.5h9" /><path d="M3 7.5h9" /><path d="M3 10.5h6" />',
    settings: '<path d="M6.5 2.5h2l.4 1.5 1.3.5 1.4-.8 1 1.7-1.1 1.1.2 1.5 1.1 1.1-1 1.7-1.4-.8-1.3.5-.4 1.5h-2l-.4-1.5-1.3-.5-1.4.8-1-1.7 1.1-1.1-.2-1.5-1.1-1.1 1-1.7 1.4.8 1.3-.5z" /><path d="M7.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />',
    refresh: '<path d="M12 5.5A4.8 4.8 0 0 0 3.6 4" /><path d="M3.5 2.5V4h1.7" /><path d="M3 9.5A4.8 4.8 0 0 0 11.4 11" /><path d="M11.5 12.5V11H9.8" />',
    select: '<path d="M3.5 3.5h8v8h-8z" /><path d="M5.2 7.4l1.7 1.7 3-3.5" />',
    flat: '<path d="M3 4h9" /><path d="M3 7.5h9" /><path d="M3 11h9" />',
    help: '<path d="M7.5 13a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z" /><path d="M6 6a1.7 1.7 0 1 1 2.5 1.5c-.7.4-1 .8-1 1.5" /><path d="M7.5 10.8h.01" />',
  } satisfies Record<typeof name, string>;

  return `<svg class="tool-icon" aria-hidden="true" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function renderIconNode(iconNode: IconNode, className: string): string {
  const children = iconNode
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .map(([key, value]) => `${key}="${escapeHtmlValue(String(value))}"`)
        .join(" ");
      return `<${tag} ${attributes}></${tag}>`;
    })
    .join("");

  return `<svg class="${escapeHtmlValue(className)}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

function renderEntryIcon(
  descriptor: ArchiveEntryIconDescriptor,
  className: "row-icon" | "tree-icon" | "detail-icon",
  dataUrl?: string | null,
): string {
  return `
    <span
      class="${className} ${className}-${descriptor.kind}"
      title="${escapeHtmlValue(descriptor.label)}"
      aria-hidden="true"
      draggable="false"
    >
      ${dataUrl
        ? `<img class="${className}-native-image" src="${escapeHtmlValue(dataUrl)}" alt="" draggable="false" />`
        : renderIconNode(descriptor.icon, `${className}-svg`)}
    </span>
  `;
}

appRoot.innerHTML = `
    <section class="path-bar" data-i18n-aria-label="workspace.archiveLocation.aria" aria-label="Archive location">
      <label class="path-location">
        <span class="path-location-label" data-i18n-text="path.fileLocation">File Location</span>
        <input id="path-field" class="path-field" type="text" data-i18n-aria-label="path.archivePath.aria" aria-label="Archive path" value="Open or create an archive to begin." readonly disabled />
      </label>
      <div id="path-crumbs" class="path-crumbs" aria-live="polite" hidden data-i18n-text="browse.statusEmpty">Open or create an archive to begin.</div>
      <div class="search-box" role="search">
        <label class="search-field">
          <span class="sr-only" data-i18n-text="search.entries">Search entries</span>
          <input id="search-entries" type="search" data-i18n-placeholder="search.placeholder" placeholder="Search archive" aria-keyshortcuts="Control+F" disabled />
        </label>
        <button id="search-submit" class="search-action" type="button" data-i18n-text="search.button" disabled>Search</button>
        <button id="clear-search" class="search-action quiet-action" type="button" data-i18n-text="search.clear" data-i18n-aria-label="search.clear.aria" aria-label="Clear search" disabled>Clear</button>
        <output id="search-count" class="search-count" for="search-entries" aria-live="polite"></output>
      </div>
    </section>

    <section class="browser-shell" data-i18n-aria-label="workspace.archiveWorkspace.aria" aria-label="Archive workspace">
      <div class="compress-create-panel" data-i18n-aria-label="compress.createArchive.aria" aria-label="Create archive">
        <div class="compress-create-row">
          <label class="compress-destination-field">
            <span data-i18n-text="compress.destination">Destination</span>
            <div class="inline-field">
              <input id="create-destination" type="text" data-i18n-placeholder="compress.destination.placeholder" placeholder="Choose output archive" />
              <button id="browse-create-destination" type="button" data-i18n-text="common.browse" data-i18n-title="create.destination.browse.title" title="Browse for archive path">Browse...</button>
            </div>
          </label>
          <div class="compress-create-actions">
            <button id="add-source" class="secondary-action" type="button" data-i18n-text="compress.addSources">Add Sources</button>
            <button id="include-all-sources" class="quiet-action" type="button" data-i18n-text="compress.includeAll" hidden>Include All</button>
            <button id="exclude-all-sources" class="quiet-action" type="button" data-i18n-text="compress.excludeAll" hidden>Exclude All</button>
            <button id="clear-sources" class="quiet-action" type="button" data-i18n-text="command.clearAllSources" hidden>Clear All Sources</button>
            <span class="compress-action-divider" aria-hidden="true"></span>
            <button id="start-create" class="secondary-action" type="button" data-i18n-text="compress.createArchive" aria-describedby="create-plan-meta" disabled>Create Archive</button>
          </div>
        </div>
        <div class="compress-plan-row">
          <p id="create-plan-meta" data-i18n-text="compress.dropSourcesHint">Drop files or folders here, or add sources from disk.</p>
        </div>
      </div>

      <aside id="navigation-pane" class="navigation-pane" data-i18n-aria-label="workspace.archiveNavigation.aria" aria-label="Archive navigation">
        <div class="pane-header">
          <h2 data-i18n-text="pane.folders">Folders</h2>
        </div>
        <div id="tree-content" class="tree-content"></div>
      </aside>
      <div
        class="pane-resizer"
        data-pane-resizer="navigation"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-controls="navigation-pane"
        aria-label="Resize folder pane"
        aria-valuemin="${APP_NAV_PANE_MIN_WIDTH_PX}"
        aria-valuemax="${APP_NAV_PANE_MAX_WIDTH_PX}"
        aria-valuenow="${APP_NAV_PANE_DEFAULT_WIDTH_PX}"
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      ><span class="pane-resizer-grip" aria-hidden="true"></span></div>

      <section class="archive-table-pane" data-i18n-aria-label="workspace.archiveEntries.aria" aria-label="Archive entries">
        <div class="table-pane-header">
          <div>
            <h1 id="workspace-title">${APP_TITLE}</h1>
            <p id="browse-meta" data-i18n-text="browse.statusReady">Open an archive to browse entries.</p>
          </div>
          <button id="refresh-archive" class="quiet-action" type="button" data-command-id="refresh" data-i18n-text="common.refresh" disabled>Refresh</button>
        </div>
        <p id="browse-message" class="status status-idle" data-i18n-text="browse.statusIdle">No archive selected.</p>
        <div id="compress-surface" class="compress-surface" hidden>
          <div class="compress-table-shell">
            <table id="compress-source-table">
              <thead>
                <tr>
                  <th class="inclusion-column">
                    <input id="compress-include-all" type="checkbox" data-i18n-aria-label="compress.includeAll" aria-label="Include All" disabled />
                  </th>
                  <th data-compress-column-id="name" data-i18n-text="table.name">Name<span class="column-resizer" data-column-resizer="name" aria-hidden="true"></span></th>
                  <th data-compress-column-id="size" data-i18n-text="table.size">Size<span class="column-resizer" data-column-resizer="size" aria-hidden="true"></span></th>
                  <th data-compress-column-id="modified" data-i18n-text="table.modified">Modified<span class="column-resizer" data-column-resizer="modified" aria-hidden="true"></span></th>
                  <th data-compress-column-id="kind" data-i18n-text="table.kind">Kind<span class="column-resizer" data-column-resizer="kind" aria-hidden="true"></span></th>
                </tr>
              </thead>
              <tbody id="compress-source-body">
                <tr>
                  <td colspan="5" class="compress-empty-cell">
                    <div class="compress-empty-state">
                      <strong data-i18n-text="compress.emptyTable">Drop files or folders to build a new archive.</strong>
                      <span data-i18n-text="compress.dragSourcesHint">Drag files or folders anywhere in this window, or use Add Sources.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="table-shell" tabindex="0">
          <div id="marquee-hit-surface" class="marquee-hit-surface" aria-hidden="true"></div>
          <div id="archive-empty-state" class="archive-empty-state" hidden>
            <div class="archive-empty-state-inner">
              <span class="archive-empty-state-icon" aria-hidden="true">${toolbarIcon("open")}</span>
              <div class="archive-empty-copy">
                <h2 data-i18n-text="browse.emptyTitle">Archive contents</h2>
                <p data-i18n-text="browse.emptyDescription">Drop an archive here to inspect its files and folders.</p>
              </div>
              <button class="primary-action" type="button" data-empty-action="open-archive" data-i18n-text="browse.emptyOpenAction">Open Archive</button>
              <p class="archive-empty-hint" data-i18n-text="browse.emptyDropHint">Drag entries out of this table to extract selected items.</p>
            </div>
          </div>
          <table id="entry-table">
            <thead id="entry-table-head">
              <tr>
                <th class="selection-column">
                  <input id="select-all" type="checkbox" data-i18n-aria-label="table.selectVisibleEntries" aria-label="Select visible entries" disabled />
                </th>
                <th data-sort-key="name" data-i18n-text="table.name">Name</th>
                <th data-sort-key="size" class="align-right" data-i18n-text="table.size">Size</th>
                <th data-sort-key="compressedSize" class="align-right" data-i18n-text="table.packedSize">Packed Size</th>
                <th data-sort-key="modified" data-i18n-text="table.modified">Modified</th>
              </tr>
            </thead>
            <tbody id="entry-table-body">
              <tr>
                <td colspan="5" class="empty" data-i18n-text="browse.statusEmpty">Open or create an archive to begin.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div
        class="pane-resizer"
        data-pane-resizer="details"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-controls="details-pane"
        aria-label="Resize details pane"
        aria-valuemin="${APP_DETAILS_PANE_MIN_WIDTH_PX}"
        aria-valuemax="${APP_DETAILS_PANE_MAX_WIDTH_PX}"
        aria-valuenow="${APP_DETAILS_PANE_DEFAULT_WIDTH_PX}"
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      ><span class="pane-resizer-grip" aria-hidden="true"></span></div>

      <aside id="details-pane" class="details-pane" data-i18n-aria-label="workspace.details.aria" aria-label="Details and actions">
        <div class="pane-header">
          <h2 id="details-pane-title" data-i18n-text="pane.details">Details</h2>
        </div>
        <div id="details-content" class="details-content"></div>
        <details id="compress-options-panel" class="compress-options-panel" hidden>
          <summary class="compress-options-summary">
            <span class="compress-options-summary-title" data-i18n-text="create.options.title">Archive Options</span>
            <span class="compress-options-summary-description" data-i18n-text="create.options.description">Format, compression, password, and archive safety settings.</span>
          </summary>
          <div class="compress-options-intro">
            <h3 data-i18n-text="create.options.title">Archive Options</h3>
            <p data-i18n-text="create.options.description">Format, compression, password, and archive safety settings.</p>
          </div>
          <div class="plan-header">
            <div>
              <h3 data-i18n-text="create.plan.title">Plan</h3>
              <p data-i18n-text="create.plan.description">Detailed inclusion preview for the staged sources.</p>
            </div>
          </div>
          <div id="create-plan-summary" class="summary-card">
            <p data-i18n-text="create.plan.empty">No plan available yet.</p>
          </div>
          <ul id="source-list" class="list-box" hidden></ul>
          <div class="form-grid create-options-grid">
            <label>
              <span data-i18n-text="create.archiveFormat">Archive format</span>
              <select id="create-format">
                <option value="zip">ZIP</option>
                <option value="tarZst">TZST</option>
                <option value="tzap">TZAP</option>
                <option value="sevenZ">7Z</option>
              </select>
            </label>
            <label>
              <span data-i18n-text="create.compressionLevel">Compression level</span>
              <select id="create-compression-level">
                <option value="" data-i18n-text="create.compression.normal">Normal</option>
                <option value="0" data-i18n-text="common.store">Store</option>
                <option value="1" data-i18n-text="common.fastest">Fastest</option>
                <option value="3" data-i18n-text="common.fast">Fast</option>
                <option value="9" data-i18n-text="common.maximum">Maximum</option>
                <option value="22" data-i18n-text="common.ultra">Ultra</option>
              </select>
            </label>
            <label>
              <span data-i18n-text="create.splitVolumes">Split to volumes, bytes</span>
              <input id="create-volume" type="number" min="0" data-i18n-placeholder="common.optional" placeholder="Optional" />
            </label>
            <label id="create-tzap-recovery-field" hidden>
              <span data-i18n-text="create.tzapRecovery">TZAP recovery, %</span>
              <input id="create-tzap-recovery" type="number" min="${TZAP_RECOVERY_PERCENTAGE_MIN}" max="${TZAP_RECOVERY_PERCENTAGE_MAX}" value="${TZAP_RECOVERY_PERCENTAGE_DEFAULT}" />
            </label>
          </div>
          <div class="toggle-grid">
            <label class="toggle-line"><input id="create-clean-source" type="checkbox" /> <span data-i18n-text="create.cleanSource">Clean source</span></label>
            <label class="toggle-line"><input id="create-preserve-metadata" type="checkbox" checked /> <span data-i18n-text="create.preserveMetadata">Preserve metadata</span></label>
            <label class="toggle-line"><input id="create-replace-existing" type="checkbox" /> <span data-i18n-text="create.replaceExisting">Replace existing</span></label>
            <label class="toggle-line"><input id="create-respect-gitignore" type="checkbox" /> <span data-i18n-text="create.respectGitignore">Respect .gitignore</span></label>
          </div>
          <details class="advanced-options">
            <summary data-i18n-text="extract.advancedOptions">Advanced options</summary>
            <div id="create-password-options" class="form-grid form-grid-compact">
              <label>
                <span data-i18n-text="create.enterPassword">Enter password</span>
                <input id="create-password" type="password" autocomplete="off" />
              </label>
              <label>
                <span data-i18n-text="create.reenterPassword">Reenter password</span>
                <input id="create-password-confirm" type="password" autocomplete="off" />
              </label>
              <label class="checkbox-row">
                <input id="create-show-password" type="checkbox" />
                <span data-i18n-text="extract.showPassword">Show Password</span>
              </label>
            </div>
          </details>
        </details>
      </aside>
    </section>
    <div id="legacy-context-menu" class="context-menu" role="menu" hidden></div>

`;

const workspaceElement = document.querySelector<HTMLElement>(".workspace")!;
const modeCompressButton = document.querySelector<HTMLButtonElement>("#mode-compress")!;
const modeExtractButton = document.querySelector<HTMLButtonElement>("#mode-extract")!;
const statusSelectionCountElement = document.querySelector<HTMLSpanElement>("#status-selection-count")!;
const statusSelectionSizeElement = document.querySelector<HTMLSpanElement>("#status-selection-size")!;
const statusFocusedSizeElement = document.querySelector<HTMLSpanElement>("#status-focused-size")!;
const statusFocusedModifiedElement = document.querySelector<HTMLSpanElement>("#status-focused-modified")!;
const pathFieldInput = document.querySelector<HTMLInputElement>("#path-field")!;
const pathCrumbsElement = document.querySelector<HTMLDivElement>("#path-crumbs")!;
const browserShellElement = document.querySelector<HTMLElement>(".browser-shell")!;
const navigationPaneElement = document.querySelector<HTMLElement>(".navigation-pane")!;
const detailsPaneElement = document.querySelector<HTMLElement>(".details-pane")!;
const paneResizerElements = document.querySelectorAll<HTMLElement>("[data-pane-resizer]");
const detailsPaneTitleElement = document.querySelector<HTMLHeadingElement>("#details-pane-title")!;
const treeContentElement = document.querySelector<HTMLDivElement>("#tree-content")!;
const detailsElement = document.querySelector<HTMLDivElement>("#details-content")!;
const compressOptionsPanel = document.querySelector<HTMLDetailsElement>("#compress-options-panel")!;
const compactCompressOptionsQuery = window.matchMedia("(max-width: 1100px), (max-height: 640px)");

const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive")!;
const windowMinimizeButton = document.querySelector<HTMLButtonElement>("#window-minimize")!;
const windowMaximizeButton = document.querySelector<HTMLButtonElement>("#window-maximize")!;
const windowCloseButton = document.querySelector<HTMLButtonElement>("#window-close")!;
const windowResizeHandleElements = document.querySelectorAll<HTMLElement>("[data-window-resize-direction]");

const searchInput = document.querySelector<HTMLInputElement>("#search-entries")!;
const searchSubmitButton = document.querySelector<HTMLButtonElement>("#search-submit")!;
const clearSearchButton = document.querySelector<HTMLButtonElement>("#clear-search")!;
const searchCountElement = document.querySelector<HTMLOutputElement>("#search-count")!;
const workspaceTitleElement = document.querySelector<HTMLHeadingElement>("#workspace-title")!;
const messageElement = document.querySelector<HTMLParagraphElement>("#browse-message")!;
const compressSurfaceElement = document.querySelector<HTMLDivElement>("#compress-surface")!;
const tableHead = document.querySelector<HTMLTableSectionElement>("#entry-table-head")!;
const tableBody = document.querySelector<HTMLTableSectionElement>("#entry-table-body")!;
const entryTable = document.querySelector<HTMLTableElement>("#entry-table")!;
const tableShellElement = document.querySelector<HTMLDivElement>(".table-shell")!;
const archiveTablePaneElement = document.querySelector<HTMLElement>(".archive-table-pane")!;
const archiveEmptyStateElement = document.querySelector<HTMLDivElement>("#archive-empty-state")!;
const metaElement = document.querySelector<HTMLParagraphElement>("#browse-meta")!;
let selectAllInput = document.querySelector<HTMLInputElement>("#select-all")!;
const legacyArchivePathBarElement = pathFieldInput.closest<HTMLElement>(".path-bar")!;
const legacyArchiveSurfaceClassEntries: ReadonlyArray<readonly [HTMLElement, string]> = [
  [legacyArchivePathBarElement, "path-bar"],
  [browserShellElement, "browser-shell"],
  [navigationPaneElement, "navigation-pane"],
  [treeContentElement, "tree-content"],
  [archiveTablePaneElement, "archive-table-pane"],
  [tableShellElement, "table-shell"],
  [archiveEmptyStateElement, "archive-empty-state"],
  [detailsPaneElement, "details-pane"],
  [detailsElement, "details-content"],
];

const contextMenu = document.querySelector<HTMLDivElement>("#legacy-context-menu")!;

function privatizeLegacyArchiveSurfaceIds() {
  const publicArchiveIds = [
    "path-field",
    "path-crumbs",
    "search-entries",
    "search-submit",
    "clear-search",
    "search-count",
    "navigation-pane",
    "tree-content",
    "workspace-title",
    "browse-meta",
    "refresh-archive",
    "browse-message",
    "marquee-hit-surface",
    "archive-empty-state",
    "entry-table",
    "entry-table-head",
    "select-all",
    "entry-table-body",
    "details-pane",
    "details-pane-title",
    "details-content",
  ];

  for (const id of publicArchiveIds) {
    const element = appRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!element) {
      continue;
    }
    element.dataset.legacyId = id;
    element.removeAttribute("id");
  }

  for (const resizer of paneResizerElements) {
    if (resizer.getAttribute("aria-controls") === "navigation-pane") {
      resizer.setAttribute("aria-controls", "legacy-navigation-pane");
    } else if (resizer.getAttribute("aria-controls") === "details-pane") {
      resizer.setAttribute("aria-controls", "legacy-details-pane");
    }
  }

  navigationPaneElement.id = "legacy-navigation-pane";
  detailsPaneElement.id = "legacy-details-pane";
}

function privatizeLegacyCreateWorkspaceIds() {
  const publicCreateIds = [
    "create-destination",
    "browse-create-destination",
    "add-source",
    "include-all-sources",
    "exclude-all-sources",
    "clear-sources",
    "start-create",
    "create-plan-meta",
    "compress-surface",
    "compress-source-table",
    "compress-source-body",
    "compress-include-all",
    "source-list",
    "compress-options-panel",
    "create-plan-summary",
    "create-format",
    "create-clean-source",
    "create-preserve-metadata",
    "create-replace-existing",
    "create-respect-gitignore",
    "create-password",
    "create-password-confirm",
    "create-show-password",
    "create-password-options",
    "create-compression-level",
    "create-volume",
    "create-tzap-recovery-field",
    "create-tzap-recovery",
  ];

  for (const id of publicCreateIds) {
    const element = appRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!element) {
      continue;
    }
    element.dataset.legacyId = id;
    element.removeAttribute("id");
  }
}

function syncLegacyArchiveSurfaceOwnership() {
  const showLegacyArchiveSurface = false;

  legacyArchivePathBarElement.hidden = !showLegacyArchiveSurface;
  browserShellElement.hidden = !showLegacyArchiveSurface;
  for (const [element, className] of legacyArchiveSurfaceClassEntries) {
    element.classList.toggle(className, showLegacyArchiveSurface);
  }
  if (!showLegacyArchiveSurface) {
    privatizeLegacyArchiveRowAttributes();
  }
}

function privatizeLegacyArchiveRowAttributes() {
  for (const header of tableHead.querySelectorAll<HTMLElement>("[data-column-id], [data-sort-key]")) {
    if (header.dataset.columnId) {
      header.dataset.legacyColumnId = header.dataset.columnId;
      delete header.dataset.columnId;
    }
    if (header.dataset.sortKey) {
      header.dataset.legacySortKey = header.dataset.sortKey;
      delete header.dataset.sortKey;
    }
  }

  for (const row of tableBody.querySelectorAll<HTMLElement>("[data-entry-path], [data-folder-path]")) {
    if (row.dataset.entryPath) {
      row.dataset.legacyEntryPath = row.dataset.entryPath;
      delete row.dataset.entryPath;
    }
    if (row.dataset.folderPath) {
      row.dataset.legacyFolderPath = row.dataset.folderPath;
      delete row.dataset.folderPath;
    }
    row.removeAttribute("aria-label");
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
const createWorkspaceSelection = createCreateWorkspaceSelection();
const initialArchiveWorkspaceSnapshot = archiveWorkspace.getSnapshot();
let currentArchivePath = initialArchiveWorkspaceSnapshot.currentArchivePath;
let currentArchiveFolder = initialArchiveWorkspaceSnapshot.view.currentFolder;
let currentArchiveSearchQuery = initialArchiveWorkspaceSnapshot.view.searchQuery;
let currentArchiveEntryCount = initialArchiveWorkspaceSnapshot.entryCount;
let currentArchiveTotalSize: number | null = initialArchiveWorkspaceSnapshot.totalSize;
let browseState: BrowseState = initialArchiveWorkspaceSnapshot.browseState;
let browseError = "";
let browseEntries: ArchiveEntryDto[] = [...initialArchiveWorkspaceSnapshot.entries];
let selectedEntries = new Set<string>();
let navigationHistory: string[] = [...initialArchiveWorkspaceSnapshot.view.navigationHistory];
let displayContext = createDisplayContext(appPreferences.locale);
let preferencesDialogDraft: AppPreferences | null = null;
let systemIconDataUrls = new Map<string, string | null>();
let systemIconRequestRevision = 0;
let tableColumnSettings: ArchiveTableColumnSettings = normalizeColumnSettings({
  visibleColumnIds: appPreferences.tableVisibleColumnIds,
  columnOrderIds: appPreferences.tableColumnOrderIds,
  columnWidths: appPreferences.tableColumnWidths,
});
let sortKey: ArchiveSortKey = initialArchiveWorkspaceSnapshot.view.sort.key;
let sortAscending = initialArchiveWorkspaceSnapshot.view.sort.ascending;
let isFlatView = initialArchiveWorkspaceSnapshot.view.flatView;
let focusedEntryPath = "";
let selectionAnchorPath = "";
let activeExtractMode: ExtractMode = "archive";
let extractDialogState: ExtractDialogState = {
  messageText: "",
  form: {
    destination: "",
    useSubfolder: false,
    subfolder: "",
    pathMode: "full",
    overwrite: "ask",
    stripComponents: "0",
    deduplicateRoot: false,
  },
  passwordPromptOpen: false,
};
let contextEntryPath = "";
let contextSourcePath = "";
let reactContextMenuSnapshot: ZManagerContextMenuSnapshot = { visible: false, id: 0 };
let reactContextMenuSequence = 0;
const archiveTreeRootPath = "";
const expandedArchiveTreeFolders = new Set<string>([archiveTreeRootPath]);
let archiveTreeChildrenByParent = new Map<string, string[]>();

privatizeLegacyArchiveSurfaceIds();
syncLegacyArchiveSurfaceOwnership();

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
const uiDeferrals = appTimers.uiDeferrals;
const createPlanController = createCreatePlanController({
  workspace: createWorkspace,
  debounceTimer: createPlanDebounce,
  runPlanCreate,
  syncSources: syncCreateSourcesFromWorkspace,
  publishSnapshot: () => publishReactSnapshot(),
  canUseBrowserPreview: canUseBrowserCreatePlanPreview,
  browserPreview: (sources) => browserCreatePlanPreview([...sources]),
  toCommandError: asCommandError,
});
const createStartController = createCreateStartController({
  workspace: createWorkspace,
  syncSources: syncCreateSourcesFromWorkspace,
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
  publishSnapshot: () => publishReactSnapshot(),
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
    syncArchiveWorkspaceSnapshot(snapshot);
    syncArchiveWorkspaceViewSnapshot(snapshot);
    setBrowseState("loading", displayContext.translator.t("browse.statusLoading"));
    renderBrowse();
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
    syncArchiveWorkspaceSnapshot(snapshot);
    setBrowseState("error", text);
    renderBrowse();
  },
  failedListMessage: () => message("browse.failedList"),
  loadErrorMessage: (error, options) => options.includeHint && error.hint
    ? `${error.message}\n${error.hint}`
    : error.message,
  promptForPasswordRetry: promptForArchivePasswordRetry,
});
const archiveOpenController = createArchiveOpenController({
  pathHistoryStore,
  publishPathHistorySnapshot: () => publishReactSnapshot(),
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
  setCurrentArchivePath: (archivePath) => {
    currentArchivePath = archivePath;
  },
  loadArchive: (request) => loadArchive(request),
});
const archiveTestController = createArchiveTestController({
  workspace: archiveWorkspace,
  hasCurrentArchive: () => Boolean(currentArchivePath),
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
  hasCurrentArchive: () => Boolean(currentArchivePath),
  isCurrentArchive: (archivePath) => currentArchivePath === archivePath,
  cleanupBeforePreview: applyPreviewCleanupPolicyBeforeNextPreview,
  previewRequestInput: (password) => ({
    overwrite: getOverwritePolicyValue(),
    stripComponents: 0,
    password,
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
    renderBrowse();
  },
  setBrowseError: (text) => setBrowseState("error", text),
});
const extractStartController = createExtractStartController({
  workspace: archiveWorkspace,
  hasCurrentArchive: () => Boolean(currentArchivePath),
  startExtract: runStartExtract,
  toCommandError: asCommandError,
  requestPasswordInDialog: requestExtractPasswordInDialog,
  chooseDestinationFirst: () => {
    extractDialogState = {
      ...extractDialogState,
      messageText: message("extract.chooseDestinationFirst"),
    };
    syncReactExtractDialogSnapshot(message("extract.chooseDestinationFirst"));
  },
  selectEntryFirst: () => {
    extractDialogState = {
      ...extractDialogState,
      messageText: message("extract.selectEntryFirst"),
    };
    syncReactExtractDialogSnapshot(message("extract.selectEntryFirst"));
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
  syncCreateSources: syncCreateSourcesFromWorkspace,
  publishCreateSnapshot: () => publishReactSnapshot(),
  cancelQueuedPlanRun,
  runPlan,
  setCurrentArchivePath: (archivePath) => {
    currentArchivePath = archivePath;
  },
  loadArchive: (request) => loadArchive(request),
  readBrowseState: () => browseState,
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
  renderAboutDiagnostics,
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
  applyPreferenceClasses();
  updateCommandState();
}

function setFlatView(nextFlatView: boolean, persistPreference: boolean) {
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setFlatView(nextFlatView));
  if (persistPreference) {
    savePreferencePatch({ flatViewDefault: nextFlatView });
  }
  renderBrowse();
}

function applySortCommand(nextSortKey: ArchiveSortKey) {
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.applySortCommand(nextSortKey));
  saveTablePreferences();
  renderBrowse();
}

function applySortDirection(nextSortKey: ArchiveSortKey, ascending: boolean) {
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.applySortDirection(nextSortKey, ascending));
  saveTablePreferences();
  renderBrowse();
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

  syncCompressOptionsPanelDisclosure();
  renderExtractDestinationHistory();
  renderCreateSources();
  renderCompressBrowser();
  renderBrowse();
  renderJobs();
  normalWorkspaceRendered = true;
  publishReactSnapshot();
}

function syncCompressOptionsPanelDisclosure() {
  compressOptionsPanel.open = !compactCompressOptionsQuery.matches;
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
  workspaceElement.classList.toggle("toolbar-hidden", !appPreferences.toolbarVisible);
  entryTable.classList.toggle("show-grid", appPreferences.showGridLines);
  entryTable.classList.toggle("full-row-select", appPreferences.fullRowSelect);
  entryTable.classList.toggle("single-click-open", appPreferences.singleClickOpen);
}

function formatBytes(value?: number): string {
  return displayContext.format.bytes(value);
}

function escapeHtml(value: string): string {
  return escapeHtmlValue(value);
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

function formatRatio(entry: ArchiveEntryDto): string {
  return displayContext.format.ratio(entry.size, entry.compressedSize, { fractionDigits: 0 });
}

function detailRowsToText(rows: readonly DetailRow[]): string {
  return rows
    .filter((row): row is DetailRow & { value: string } => Boolean(row.value))
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
}

function detailRowsToReactRows(rows: readonly DetailRow[]): ZManagerDialogDetailRow[] {
  return rows
    .filter((row): row is DetailRow & { value: string } => Boolean(row.value))
    .map((row) => ({
      label: row.label,
      value: row.value,
      mode: row.mode,
    }));
}

function infoReturnFocusPath(): string {
  return focusedEntryPath || getSelectedEntryPaths()[0] || "";
}

function entryPropertyRows(entry: ArchiveEntryDto): DetailRow[] {
  return [
    { label: message("detail.name"), value: getBaseName(entry.path) },
    { label: message("detail.type"), value: normalizeArchiveKindLabel(entry.kind) },
    { label: message("detail.path"), value: entry.path },
    { label: message("detail.size"), value: formatOptionalBytes(entry.size) },
    { label: message("detail.packed"), value: formatOptionalBytes(entry.compressedSize) },
    { label: message("detail.modified"), value: formatDate(entry.modified) },
    { label: message("detail.ratio"), value: formatRatio(entry) },
    { label: message("detail.created"), value: formatDate(entry.created) },
    { label: message("detail.attributes"), value: entry.attributes },
    { label: message("detail.method"), value: entry.method },
    { label: "CRC", value: entry.crc },
    { label: message("detail.encrypted"), value: formatOptionalBoolean(entry.encrypted) },
    { label: message("detail.solid"), value: formatOptionalBoolean(entry.solid) },
    { label: message("detail.linkTarget"), value: entry.linkTarget },
  ];
}

function selectionPropertyRows(selectedRows: readonly SelectableBrowserRow[]): DetailRow[] {
  const selected = selectedRows
    .map((row) => row.entry ?? getEntryByPath(row.path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);
  const selectedTotal = sumKnownBytes(selected, (entry) => entry.size);
  const selectedPacked = sumKnownBytes(selected, (entry) => entry.compressedSize);
  const selectedFiles = selectedRows.filter((row) => row.rowType === "entry" && row.entry?.kind !== "directory").length;
  const selectedFolders = selectedRows.filter((row) => row.rowType === "folder" || row.entry?.kind === "directory").length;
  const pathPreview = truncatedPathPreview(selectedRows.map((row) => row.path));

  return [
    { label: message("detail.entries"), value: String(selectedRows.length) },
    { label: message("detail.selectedFiles"), value: String(selectedFiles) },
    { label: message("detail.selectedFolders"), value: String(selectedFolders) },
    { label: message("detail.totalSize"), value: selectedTotal === null ? null : formatBytes(selectedTotal) },
    { label: message("detail.packedSize"), value: selectedPacked === null ? null : formatBytes(selectedPacked) },
    { label: message("detail.pathPreview"), value: pathPreview },
  ];
}

function infoReturnFocusForCurrentSelection(): HTMLElement | null {
  const selectedPath = focusedEntryPath || getSelectedEntryPaths()[0] || "";
  return findActiveArchiveRow(selectedPath);
}

function findActiveArchiveRow(path: string): HTMLTableRowElement | null {
  if (!path) {
    return null;
  }

  const selector = `tr[data-entry-path="${CSS.escape(path)}"]`;
  return document.querySelector<HTMLTableRowElement>(selector)
    ?? tableBody.querySelector<HTMLTableRowElement>(selector);
}

function previewActionHint(): string {
  return message("preview.openTempOutsideHint");
}

function detailRenderHelpers() {
  return {
    copyLabel: message("command.copy"),
    copyIconHtml: toolbarIcon("copy"),
  };
}

function formatOptionalBytes(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return formatBytes(value);
}

function formatOptionalBoolean(value?: boolean): string | null {
  if (typeof value !== "boolean") {
    return null;
  }
  return value ? message("detail.booleanYes") : message("detail.booleanNo");
}

function normalizeArchiveKindLabel(kind: ArchiveEntryDto["kind"]): string {
  return kind === "directory" ? message("detail.directory") : kind;
}

function sumKnownBytes(
  entries: ArchiveEntryDto[],
  selector: (entry: ArchiveEntryDto) => number | undefined,
): number | null {
  let hasKnownValue = false;
  let total = 0;
  for (const entry of entries) {
    const value = selector(entry);
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      hasKnownValue = true;
      total += value;
    }
  }
  return hasKnownValue ? total : null;
}

function formatArchiveTypeFromPath(path: string): string | null {
  const suffix = getKnownArchiveSuffix(path);
  if (!suffix) {
    return null;
  }
  return suffix.startsWith(".") ? suffix.slice(1).toUpperCase() : suffix.toUpperCase();
}

function formatLastTestStatusForCurrentArchive(): string | null {
  if (!currentArchivePath) {
    return null;
  }

  const testJobs = Array.from(jobsWorkspace.getJobsMap().entries())
    .map(([jobId, state]) => ({ jobId, state }))
    .filter((item) => {
      const context = jobsWorkspace.getRetryContext(item.jobId);
      return context?.retryKind === "testArchive" && context.archivePath === currentArchivePath;
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

function truncatedPathPreview(paths: readonly string[], maxItems = 3, maxLength = 140): string | null {
  if (!paths.length) {
    return null;
  }

  const sortedUniquePaths = Array.from(new Set(paths)).sort();
  const shownPaths = sortedUniquePaths.slice(0, maxItems);
  const remaining = sortedUniquePaths.length - maxItems;

  let preview = shownPaths.join(", ");
  if (remaining > 0) {
    preview = `${preview} (+${remaining} more)`;
  }

  if (preview.length <= maxLength) {
    return preview;
  }

  const headLength = Math.max(8, Math.ceil((maxLength - 3) * 0.58));
  const tailLength = Math.max(8, maxLength - headLength - 3);
  return `${preview.slice(0, headLength)}...${preview.slice(-tailLength)}`;
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

function systemIconRequestForRow(row: BrowserRow): SystemFileIconRequestEntry | null {
  if (row.rowType === "parent" || row.rowType === "folder") {
    return systemIconRequestForPath("folder", true);
  }

  return systemIconRequestForEntry(row.entry);
}

function systemIconDataUrlForRequest(request: SystemFileIconRequestEntry | null): string | null {
  if (!appPreferences.showRealFileIcons || !request) {
    return null;
  }

  return systemIconDataUrls.get(request.key) ?? null;
}

function collectSystemIconRequests(): SystemFileIconRequestEntry[] {
  if (!currentArchivePath || !appPreferences.showRealFileIcons) {
    return [];
  }

  const requests = new Map<string, SystemFileIconRequestEntry>();
  const add = (request: SystemFileIconRequestEntry | null) => {
    if (request && !systemIconDataUrls.has(request.key)) {
      requests.set(request.key, request);
    }
  };

  add(systemIconRequestForPath(currentArchivePath, false));
  add(systemIconRequestForPath("folder", true));
  for (const entry of browseEntries) {
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
      renderBrowse();
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

function buildArchiveTreeChildren(entries: ArchiveEntryDto[]): Map<string, string[]> {
  const childrenByParent = new Map<string, Set<string>>();
  const addChild = (parentPath: string, childName: string) => {
    const current = childrenByParent.get(parentPath);
    if (current) {
      current.add(childName);
      return;
    }
    childrenByParent.set(parentPath, new Set([childName]));
  };

  for (const entry of entries) {
    const normalized = normalizeEntryPath(entry.path);
    if (!normalized) {
      continue;
    }

    const segments = normalized.split("/").filter(Boolean);
    if (!segments.length) {
      continue;
    }

    const folderDepth = entry.kind === "directory" ? segments.length : segments.length - 1;
    for (let i = 0; i < folderDepth; i += 1) {
      const parentPath = i === 0 ? archiveTreeRootPath : segments.slice(0, i).join("/");
      addChild(parentPath, segments[i]);
    }
  }

  const sortedChildren = new Map<string, string[]>();
  for (const [parentPath, childSet] of childrenByParent) {
    sortedChildren.set(
      parentPath,
      [...childSet].sort((left, right) => left.localeCompare(right)),
    );
  }
  return sortedChildren;
}

function nativeDragRowAttributes(): string {
  return "";
}

async function startNativeDragOut(entryPath: string) {
  if (!currentArchivePath) {
    return;
  }

  if (!isDesktopRuntime()) {
    setOperationalMessage("preview.nativeDragDesktopOnly");
    return;
  }

  if (!selectedEntries.has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
    renderBrowse();
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

function getKnownFolderPaths(): ArchiveTreeFolder[] {
  const currentFolder = normalizeFolderPath(currentArchiveFolder);
  const folders: ArchiveTreeFolder[] = [];

  folders.push({
    path: archiveTreeRootPath,
    name: getArchiveName(currentArchivePath, APP_TITLE),
    depth: 0,
    hasChildren: archiveTreeChildrenByParent.has(archiveTreeRootPath),
    isExpanded: true,
  });

  const addChildFolders = (parentPath: string, depth: number) => {
    const children = archiveTreeChildrenByParent.get(parentPath);
    if (!children?.length) {
      return;
    }

    for (const childName of children) {
      const childPath = parentPath ? `${parentPath}/${childName}` : childName;
      const childHasChildren = archiveTreeChildrenByParent.has(childPath);
      const isExpanded = expandedArchiveTreeFolders.has(childPath);
      folders.push({
        path: childPath,
        name: childName,
        depth,
        hasChildren: childHasChildren,
        isExpanded,
      });
      if (childHasChildren && isExpanded) {
        addChildFolders(childPath, depth + 1);
      }
    }
  };

  addChildFolders(archiveTreeRootPath, 1);
  return folders;
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
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.updateSelection(result));
}

function currentSearchQuery(): string {
  return currentArchiveSearchQuery.trim();
}

function archiveListingFromFixture(listing: ArchiveFixture): ArchiveListingDto {
  return {
    archivePath: listing.archivePath,
    entries: listing.entries,
    entryCount: typeof listing.entryCount === "number" ? listing.entryCount : listing.entries.length,
    ...(typeof listing.totalSize === "number" ? { totalSize: listing.totalSize } : {}),
  };
}

function archiveWorkspaceErrorText(snapshot: ArchiveWorkspaceSnapshot): string {
  if (!snapshot.error) {
    return "";
  }
  if (!snapshot.error.message) {
    return snapshot.error.messageKey ? message(snapshot.error.messageKey) : "";
  }
  return `${snapshot.error.message}${snapshot.error.hint ? `\n${snapshot.error.hint}` : ""}`;
}

function syncArchiveWorkspaceSnapshot(snapshot: ArchiveWorkspaceSnapshot) {
  currentArchivePath = snapshot.currentArchivePath;
  browseState = snapshot.browseState;
  browseError = archiveWorkspaceErrorText(snapshot);
  browseEntries = [...snapshot.entries];
  currentArchiveEntryCount = snapshot.entryCount;
  currentArchiveTotalSize = snapshot.totalSize;
}

function syncArchiveWorkspaceViewSnapshot(snapshot: ArchiveWorkspaceSnapshot) {
  currentArchiveFolder = snapshot.view.currentFolder;
  currentArchiveSearchQuery = snapshot.view.searchQuery;
  searchInput.value = snapshot.view.searchQuery;
  navigationHistory = [...snapshot.view.navigationHistory];
  isFlatView = snapshot.view.flatView;
  expandedArchiveTreeFolders.clear();
  for (const folder of snapshot.view.expandedTreeFolders) {
    expandedArchiveTreeFolders.add(folder);
  }
  sortKey = snapshot.view.sort.key;
  sortAscending = snapshot.view.sort.ascending;
  selectedEntries = new Set(snapshot.view.selection.selectedPaths);
  focusedEntryPath = snapshot.view.selection.focusedPath;
  selectionAnchorPath = snapshot.view.selection.anchorPath;
}

function formatSearchCount(count: number): string {
  return count === 1
    ? message("search.oneResult", { count })
    : message("search.results", { count });
}

function clearSearch() {
  if (!currentSearchQuery()) {
    return;
  }
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.clearSearch());
  renderBrowse();
  searchInput.focus();
}

function visibleRows(): BrowserRow[] {
  return [...archiveWorkspace.getSnapshot().view.rows];
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

function currentArchiveDisplayPath(): string {
  if (!currentArchivePath) {
    return "";
  }

  return currentArchiveFolder
    ? `${currentArchivePath}\\${currentArchiveFolder.replace(/\//g, "\\")}\\`
    : `${currentArchivePath}\\`;
}

function setBrowseState(next: BrowseState, message = "") {
  const snapshot = archiveWorkspace.setBrowseState(next);
  syncArchiveWorkspaceSnapshot(snapshot);

  renderArchiveBrowseMessage({ messageElement }, {
    browseState: next,
    ...(message ? { message } : {}),
  });
  if (message) {
    browseError = message;
  }

  if (next === "loading") {
    setOperationalMessage("status.loadingArchive");
  } else if (next === "error") {
    setOperationalMessage("status.failed");
  } else {
    setOperationalMessage("status.ready");
  }

  updateCommandState();
}

function currentCommandClassState(hasArchive = Boolean(currentArchivePath)): CommandSurfaceClassState {
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
  const snapshot = archiveWorkspace.getSnapshot();
  const commandContext = snapshot.command;
  const commandState = currentCommandStateMap();

  const searchDisabled = !commandContext.canSearchEntries;
  renderArchiveCommandControlState({
    searchInput,
    searchSubmitButton,
    clearSearchButton,
    selectAllInput,
  }, {
    searchDisabled,
    searchSubmitDisabled: searchDisabled,
    clearSearchDisabled: searchDisabled || !snapshot.view.searchQuery.trim(),
    selectAllDisabled: !commandState.selectAll.enabled,
  });

  applyPreferenceClasses();
  updateStatusBar();
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
    toggleFlatView: () => setFlatView(!isFlatView, true),
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
    return { extractMode: selectedEntries.size ? "selection" : "archive" };
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
    createSelection: {
      selectedPaths: createWorkspaceSelection.getSnapshot().selectedPaths,
      focusedPath: createWorkspaceSelection.getSnapshot().focusedPath,
    },
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

function showContextMenu(x: number, y: number, items: readonly ContextMenuModelItem[]) {
  reactContextMenuSnapshot = {
    visible: true,
    id: reactContextMenuSequence += 1,
    x,
    y,
    items: [...items],
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
      searchInput.value = intent.query;
      syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setSearchQuery(intent.query));
      renderBrowse();
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
      syncArchiveWorkspaceViewSnapshot(archiveWorkspace.toggleTreeFolder(intent.folderPath));
      renderTree();
      publishReactSnapshot();
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
      renderBrowse();
      break;
    case "setRowSelected":
      applyArchiveTableSelection(setHierarchicalTablePathSelected({
        ...currentArchiveTableSelectionState(),
        path: intent.path,
        selected: intent.selected,
      }));
      renderBrowse();
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
      publishReactSnapshot();
      break;
    case "activateRow":
      if (intent.rowKind === "folder" || intent.rowKind === "parent") {
        navigateToFolder(intent.path);
        break;
      }
      updateSelectionByIntent(intent.path);
      renderBrowse();
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
      showContextMenu(intent.x, intent.y, addSourcesContextMenuItems());
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
      syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPath(intent.destinationPath).snapshot);
      setCreatePlanState();
      publishReactSnapshot();
      break;
    case "browseDestination":
      void onSelectCreateDestination();
      break;
    case "changeFormat": {
      const defaults = createDefaultsForFormat(appPreferences, intent.format);
      syncCreateSourcesFromWorkspace(createWorkspace.changeFormat(intent.format, defaults).snapshot);
      setCreatePlanState();
      queuePlanRun();
      publishReactSnapshot();
      break;
    }
    case "setOptions":
      syncCreateSourcesFromWorkspace(createWorkspace.setOptions(intent.patch).snapshot);
      setCreatePlanState();
      queuePlanRun();
      publishReactSnapshot();
      break;
    case "navigateToFolder": {
      const navigation = createWorkspace.navigateToFolder(intent.folderPath);
      if (navigation.changed) {
        syncCreateSourcesFromWorkspace(navigation.snapshot);
        syncCompressSelectionForSnapshot(navigation.snapshot);
      }
      publishReactSnapshot();
      break;
    }
    case "setSearchQuery": {
      const snapshot = syncCreateSourcesFromWorkspace(createWorkspace.setSearchQuery(intent.query));
      syncCompressSelectionForSnapshot(snapshot);
      publishReactSnapshot();
      break;
    }
    case "clearSearch": {
      const snapshot = syncCreateSourcesFromWorkspace(createWorkspace.clearSearch());
      syncCompressSelectionForSnapshot(snapshot);
      publishReactSnapshot();
      break;
    }
    case "toggleTreeFolder": {
      const navigation = createWorkspace.toggleTreeFolder(intent.folderPath);
      if (navigation.changed) {
        syncCreateSourcesFromWorkspace(navigation.snapshot);
      }
      publishReactSnapshot();
      break;
    }
    case "setPathIncluded":
      setCompressPathIncluded(intent.path, intent.included);
      setCreatePlanState();
      publishReactSnapshot();
      break;
    case "setAllIncluded":
      setAllCompressPathsIncluded(intent.included);
      setCreatePlanState();
      publishReactSnapshot();
      break;
    case "setCurrentFolderIncluded":
      setCurrentCompressFolderIncluded(intent.included);
      setCreatePlanState();
      publishReactSnapshot();
      break;
    case "selectRow":
      updateCompressSelectionByIntent(intent.path, {
        ctrl: intent.ctrlKey,
        meta: intent.metaKey,
        shift: intent.shiftKey,
      });
      publishReactSnapshot();
      break;
    case "applySelection":
      applyCompressTableSelection({
        selectedPaths: new Set(intent.selectedPaths),
        focusedPath: intent.focusedPath,
        anchorPath: intent.anchorPath,
      });
      publishReactSnapshot();
      break;
    case "toggleRowSelection":
      applyCompressTableSelection(toggleHierarchicalTablePathSelection({
        ...currentCompressTableSelectionState(),
        path: intent.path,
      }));
      publishReactSnapshot();
      break;
    case "focusRow":
      applyCompressTableSelection(focusHierarchicalTablePath(
        currentCompressTableSelectionState(),
        intent.path,
      ));
      publishReactSnapshot();
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
      const row = visibleCompressRowForPath(intent.path);
      if (row) {
        if (!createWorkspaceSelection.has(intent.path)) {
          applyCompressTableSelection(ensureHierarchicalTablePathSelected({
            ...currentCompressTableSelectionState(),
            path: intent.path,
          }));
        }
        showCompressRowContextMenuForPath({
          rowPath: intent.path,
          folderPath: row.rowType === "folder" ? row.path : undefined,
          sourcePath: intent.sourcePath,
          x: intent.x,
          y: intent.y,
        });
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
      void extractStartController.startExtract(intent.mode, extractStartInputFromFormValues(intent.mode, {
        destination: intent.destination,
        useSubfolder: intent.useSubfolder,
        subfolder: intent.subfolder,
        pathMode: normalizeExtractPathMode(intent.pathMode),
        overwrite: normalizeOverwritePolicyValue(intent.overwrite),
        stripComponents: intent.stripComponents,
        deduplicateRoot: intent.deduplicateRoot,
        password: intent.password,
      }));
      break;
    case "browseExtractDestination":
      void onSelectDestinationForReactExtractForm(intent);
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
        if (shellWorkspace.getSnapshot().jobDrawerOpen) closeJobDrawer();
        else clearBrowseSelection();
      }
      break;
    case "focusSearch": {
      if (searchInput.disabled) {
        setOperationalMessage("browse.noArchiveOpen");
        return;
      }
      const publicSearchInput = document.querySelector<HTMLInputElement>("#search-entries") ?? searchInput;
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

function updateMeta() {
  renderArchiveMetaText({ metaElement }, {
    text: archiveMetaText(),
  });
}

function archiveMetaText(): string {
  if (!currentArchivePath) {
    return displayContext.translator.t("browse.statusReady");
  }

  const folderLabel = currentArchiveFolder ? ` > ${currentArchiveFolder}` : "";
  return `${getArchiveName(currentArchivePath, APP_TITLE)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderWorkspaceMode() {
  const mode = currentWorkspaceMode();
  const isCompress = mode === "compress";
  syncLegacyArchiveSurfaceOwnership();
  if (isCompress) {
    renderCompressBrowser();
  }

  if (isCompress) {
    const sourceSnapshot = syncCreateSourcesFromWorkspace();
    const includedCount = sourceSnapshot.plan.current ? sourceSnapshot.inclusion.includedCount : sourceSnapshot.sourceCount;
    renderArchiveWorkspaceModeChrome(workspaceChromeElements(), {
      mode,
      compressActive: true,
      extractActive: false,
      compressSurfaceHidden: false,
      tableShellHidden: true,
      refreshArchiveHidden: true,
      messageHidden: true,
      detailsHidden: true,
      compressOptionsHidden: false,
      detailsPaneTitle: displayContext.translator.t("compress.options"),
      detailsPaneTitleI18nKey: "compress.options",
      workspaceTitle: displayContext.translator.t("compress.tableTitle"),
      metaText: displayContext.translator.t("compress.tableDescription"),
      statusSelectionCountText: displayContext.translator.t("compress.sourceStaged", {
        count: includedCount,
        sourceLabel: displayContext.translator.t(includedCount === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
      }),
      statusSelectionSizeText: "",
      statusFocusedSizeText: "",
      statusFocusedModifiedText: "",
    });
  } else {
    renderArchiveWorkspaceModeChrome(workspaceChromeElements(), {
      mode,
      compressActive: false,
      extractActive: true,
      compressSurfaceHidden: true,
      tableShellHidden: false,
      refreshArchiveHidden: false,
      messageHidden: false,
      detailsHidden: false,
      compressOptionsHidden: true,
      detailsPaneTitle: displayContext.translator.t("pane.details"),
      detailsPaneTitleI18nKey: "pane.details",
      workspaceTitle: displayContext.translator.t("extract.tableTitle"),
      metaText: currentArchivePath ? undefined : displayContext.translator.t("extract.tableDescription"),
    });
    updateStatusBar();
  }
}

function workspaceChromeElements() {
  return {
    workspaceElement,
    modeCompressButton,
    modeExtractButton,
    compressSurfaceElement,
    tableShellElement,
    refreshArchiveButton,
    messageElement,
    detailsElement,
    compressOptionsPanel,
    detailsPaneTitleElement,
    workspaceTitleElement,
    metaElement,
    statusSelectionCountElement,
    statusSelectionSizeElement,
    statusFocusedSizeElement,
    statusFocusedModifiedElement,
  };
}

function setWorkspaceMode(mode: WorkspaceDropMode) {
  if (currentWorkspaceMode() === mode) {
    if (mode === "compress") {
      renderDetails();
    }
    renderWorkspaceMode();
    return;
  }

  shellWorkspace.setWorkspaceMode(mode);
  if (mode === "extract") {
    renderTree();
    renderDetails();
    updateMeta();
  } else {
    renderDetails();
  }
  renderWorkspaceMode();
  setOperationalMessage(mode === "compress" ? "workspace.mode.compressStatus" : "workspace.mode.extractStatus");
}

function renderPathBar() {
  renderArchivePathBar({
    pathFieldInput,
    pathCrumbsElement,
    document,
  }, archivePathBarModel());
}

function archivePathBarModel(): ArchivePathBarModel {
  if (!currentArchivePath) {
    return {
      kind: "empty",
      emptyLabel: displayContext.translator.t("browse.statusEmpty"),
      documentTitle: APP_TITLE,
    };
  }

  const archiveName = getArchiveName(currentArchivePath, APP_TITLE);
  return {
    kind: "archive",
    displayPath: currentArchiveDisplayPath(),
    documentTitle: currentArchiveFolder
      ? `${archiveName}\\${currentArchiveFolder.replace(/\//g, "\\")} - ${APP_TITLE}`
      : `${archiveName} - ${APP_TITLE}`,
    crumbs: archiveWorkspace.getSnapshot().view.breadcrumbs.map((crumb) => ({
      name: crumb.isRoot ? archiveName : crumb.name,
      path: crumb.path,
    })),
  };
}

function renderTree() {
  if (currentWorkspaceMode() === "compress") {
    publishReactSnapshot();
    return;
  }

  if (!currentArchivePath) {
    renderArchiveNavigationTree({ treeContentElement }, {
      kind: "empty",
      message: displayContext.translator.t("browse.noArchiveOpen"),
    });
    return;
  }

  const folders: ArchiveWorkspaceTreeFolder[] = getKnownFolderPaths()
    .map((folder) => {
      const isRoot = folder.path === archiveTreeRootPath;
      const icon = archiveTreeIconDescriptor(isRoot, folder.path === currentArchiveFolder, displayContext.translator);
      const iconDataUrl = systemIconDataUrlForRequest(
        isRoot
          ? systemIconRequestForPath(currentArchivePath, false)
          : systemIconRequestForPath("folder", true),
      );
      return {
        path: folder.path,
        label: folder.name,
        depth: folder.depth,
        canToggle: folder.hasChildren && !isRoot,
        isExpanded: folder.isExpanded,
        isActive: folder.path === currentArchiveFolder,
        iconHtml: renderEntryIcon(icon, "tree-icon", iconDataUrl),
      };
    });
  renderArchiveNavigationTree({ treeContentElement }, {
    kind: "folders",
    folders,
    collapseLabel: "Collapse",
    expandLabel: "Expand",
  });
}

function navigateToCompressFolder(folderPath: string) {
  const navigation = createWorkspace.navigateToFolder(folderPath);
  syncCreateSourcesFromWorkspace(navigation.snapshot);
  if (!navigation.accepted) {
    return;
  }
  syncCompressSelectionForSnapshot(navigation.snapshot);
  publishReactSnapshot();
}

function archiveWorkspaceRowIcon(row: BrowserRow) {
  const icon = archiveRowIconDescriptor(row, displayContext.translator);
  const iconDataUrl = systemIconDataUrlForRequest(systemIconRequestForRow(row));
  return {
    html: renderEntryIcon(icon, "row-icon", iconDataUrl),
    label: icon.label,
  };
}

function renderBrowseRows() {
  const snapshot = archiveWorkspace.getSnapshot();
  const result = renderArchiveWorkspaceTable({
    tableHead,
    tableBody,
    entryTable,
    tableShellElement,
    archiveEmptyStateElement,
    searchCountElement,
  }, {
    browseState,
    browseError,
    currentArchivePath,
    rows: [...snapshot.view.rows],
    searchQuery: snapshot.view.searchQuery,
    flatView: snapshot.view.flatView,
    selection: snapshot.view.selection,
    columns: visibleColumns(tableColumnSettings),
    sortKey,
    sortAscending,
    translator: displayContext.translator,
    formatSearchCount,
    renderRowIcon: archiveWorkspaceRowIcon,
    nativeDragAttributes: nativeDragRowAttributes(),
  });
  selectAllInput = result.selectAllInput;
}

function renderDetails() {
  if (currentWorkspaceMode() === "compress") {
    detailsElement.innerHTML = "";
    return;
  }

  const details = archiveWorkspace.getSnapshot().view.details;
  let model: ArchiveDetailsModel;

  switch (details.kind) {
    case "noArchive":
      model = {
        kind: "noArchive",
        title: "No archive open",
        message: message("detail.openArchiveFirst"),
        openArchiveLabel: message("browse.emptyOpenAction"),
      };
      break;

    case "hiddenSelection": {
      const rows: DetailRow[] = [
        { label: message("detail.selected"), value: message("detail.selectedEntries", { count: details.selectedCount }) },
        { label: message("detail.search"), value: details.searchQuery },
        ...(details.firstSelectedEntryName ? [{ label: message("detail.name"), value: details.firstSelectedEntryName }] : []),
        ...(details.firstSelectedEntryPath ? [{ label: message("detail.path"), value: details.firstSelectedEntryPath }] : []),
      ];

      model = {
        kind: "hiddenSelection",
        title: message("detail.selectionHiddenBySearch"),
        description: message("detail.selectionHiddenBySearchDescription"),
        actions: [
          { label: message("search.clear"), action: "clear-search", primary: true },
          { label: message("info.archiveTitle"), action: "archive-info" },
        ],
        rows,
      };
      break;
    }

    case "archiveSummary": {
      const unpackedSize = details.unpackedSize === null ? null : formatBytes(details.unpackedSize);
      const format = formatArchiveTypeFromPath(details.archivePath);
      const title = getArchiveName(details.archivePath, APP_TITLE);
      model = {
        kind: "archiveSummary",
        title,
        iconHtml: renderEntryIcon(
          archiveFileIconDescriptor(details.archivePath, false, displayContext.translator),
          "detail-icon",
          systemIconDataUrlForRequest(systemIconRequestForPath(details.archivePath, false)),
        ),
        rows: [
          { label: message("detail.archiveName"), value: title },
          { label: message("detail.path"), value: details.archivePath },
          { label: message("detail.size"), value: unpackedSize },
          { label: message("detail.format"), value: format },
          { label: message("detail.entryCount"), value: String(details.entryCount) },
          { label: message("detail.packedSize"), value: details.packedSize === null ? null : formatBytes(details.packedSize) },
          { label: message("detail.lastTestStatus"), value: formatLastTestStatusForCurrentArchive() },
          { label: message("detail.folder"), value: details.currentFolder || "/" },
        ],
      };
      break;
    }

    case "syntheticFolder": {
      const row = details.row;
      const icon = archiveTreeIconDescriptor(false, row.path === currentArchiveFolder, displayContext.translator);
      const rows: DetailRow[] = [
        { label: message("detail.name"), value: row.name },
        { label: message("detail.type"), value: message("detail.directory") },
        { label: message("detail.path"), value: row.path || "/" },
      ];
      model = {
        kind: "syntheticFolder",
        title: row.name,
        iconHtml: renderEntryIcon(icon, "detail-icon", systemIconDataUrlForRequest(systemIconRequestForPath("folder", true))),
        rows,
      };
      break;
    }

    case "entry": {
      const entry = details.entry;
      const icon = archiveEntryIconDescriptor(entry, displayContext.translator);
      const rows = entryPropertyRows(entry);
      const canPreview = entry.kind !== "directory";
      const previewHint = previewActionHint();
      const previewLabel = message("command.view");
      model = {
        kind: "entry",
        title: getBaseName(entry.path),
        iconHtml: renderEntryIcon(icon, "detail-icon", systemIconDataUrlForRequest(systemIconRequestForEntry(entry))),
        actions: canPreview
          ? [{
              label: previewLabel,
              action: "preview",
              primary: true,
              title: previewHint,
              ariaLabel: `${previewLabel}: ${previewHint}`,
            }]
          : [],
        rows,
      };
      break;
    }

    case "multipleSelection": {
      const rows: DetailRow[] = [
        { label: message("detail.entries"), value: String(details.selectedCount) },
        { label: message("detail.selectedFiles"), value: String(details.selectedFiles) },
        { label: message("detail.selectedFolders"), value: String(details.selectedFolders) },
        { label: message("detail.totalSize"), value: details.totalSize === null ? null : formatBytes(details.totalSize) },
        { label: message("detail.packedSize"), value: details.packedSize === null ? null : formatBytes(details.packedSize) },
        { label: message("detail.pathPreview"), value: truncatedPathPreview([...details.pathPreviewPaths]) },
      ];

      model = {
        kind: "multipleSelection",
        title: message("detail.selectedEntries", { count: details.selectedCount }),
        actions: [
          { label: message("extract.selectedAction"), action: "extract-selected", primary: true },
          { label: message("test.selectedAction"), action: "test-selected" },
          { label: message("command.properties"), action: "properties" },
          { label: message("info.archiveTitle"), action: "archive-info" },
        ],
        rows,
      };
      break;
    }
  }

  renderArchiveDetails({ detailsElement }, {
    model,
    ...detailRenderHelpers(),
  });
}

function renderBrowse() {
  renderPathBar();
  renderTree();
  renderBrowseRows();
  renderDetails();
  updateMeta();
  updateCommandState();
  renderWorkspaceMode();

  const visibleSelectedCount = archiveWorkspace.getSnapshot().view.selection.visibleSelectedCount;
  if (browseState === "loaded" && visibleSelectedCount > 0) {
    renderArchiveBrowseMessage({ messageElement }, {
      browseState,
      message: displayContext.translator.t("browse.selectedEntries", { count: visibleSelectedCount }),
    });
  }

  queueSystemIconRefresh();
  publishReactSnapshot();
}

function setCreatePlanState() {
  syncCreateSourcesFromWorkspace();
  publishReactSnapshot();
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

function filteredCreatePlan(snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace()): CreatePlanResponse | null {
  return snapshot.inclusion.filteredPlan;
}

function compressRowInclusionState(row: CompressPlanRow): "included" | "excluded" | "partial" {
  return createWorkspace.getRowInclusionState(row);
}

function setCompressPathIncluded(path: string, included: boolean) {
  syncCreateSourcesFromWorkspace(createWorkspace.setPathIncluded(path, included).snapshot);
}

function setAllCompressPathsIncluded(included: boolean) {
  syncCreateSourcesFromWorkspace(createWorkspace.setAllPathsIncluded(included).snapshot);
}

function setCurrentCompressFolderIncluded(included: boolean) {
  const snapshot = syncCreateSourcesFromWorkspace();
  syncCreateSourcesFromWorkspace(createWorkspace.setCurrentFolderIncluded(snapshot.view.currentFolder, included).snapshot);
}

function renderCreateSources() {
  setCreatePlanState();
}

function clearCreateSources() {
  syncCreateSourcesFromWorkspace(createWorkspace.clearSources().snapshot);
  applyCompressTableSelection(clearHierarchicalTableSelection());
  renderCreateSources();
  renderCompressBrowser();
  queuePlanRun();
  publishReactSnapshot();
}

function removeCreateSources(sourcePaths: string[]) {
  const result = createWorkspace.removeSources(sourcePaths);
  syncCreateSourcesFromWorkspace(result.snapshot);
  if (!result.changed) {
    return;
  }
  applyCompressTableSelection(clearHierarchicalTableSelection());
  renderCreateSources();
  renderCompressBrowser();
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

function getVisibleCompressSelectablePaths(): string[] {
  return selectableHierarchicalRowPaths(visibleCompressRows());
}

function currentCompressTableSelectionState() {
  return createWorkspaceSelection.getState();
}

function applyCompressTableSelection(result: HierarchicalTableSelectionResult) {
  createWorkspaceSelection.apply(result);
}

function selectedCompressSourcePaths(): string[] {
  const snapshot = syncCreateSourcesFromWorkspace();
  return Array.from(new Set(snapshot.view.rows
    .filter((row) => row.rowType !== "parent" && createWorkspaceSelection.has(row.path))
    .map((row) => removableSourcePathForCompressPath(row.path, sourcePathForCompressRow(row, snapshot), snapshot))
    .filter(Boolean)));
}

function removableSourcePathForCompressPath(
  rowPath: string,
  rowSourcePath?: string,
  snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace(),
): string {
  if (!rowPath || snapshot.view.currentFolder) {
    return "";
  }

  const normalizedRowPath = normalizeEntryPath(rowPath);
  const row = snapshot.view.rows.find((candidate) => normalizeEntryPath(candidate.path) === normalizedRowPath);
  const sourcePath = rowSourcePath || (row ? sourcePathForCompressRow(row, snapshot) : "");
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
  if (!rowPath) {
    return [];
  }
  if (createWorkspaceSelection.has(rowPath) && createWorkspaceSelection.size() > 1) {
    const visiblePaths = new Set(getVisibleCompressSelectablePaths());
    return createWorkspaceSelection.getSnapshot().selectedPaths.filter((path) => visiblePaths.has(path));
  }
  return [rowPath];
}

function updateCompressSelectionByIntent(
  rowPath: string,
  options?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  applyCompressTableSelection(applyHierarchicalRowSelectionIntent({
    path: rowPath,
    visiblePaths: getVisibleCompressSelectablePaths(),
    currentSelection: createWorkspaceSelection.getState().selectedPaths,
    anchorPath: createWorkspaceSelection.getSnapshot().anchorPath,
    shiftKey: Boolean(options?.shift),
    ctrlKey: Boolean(options?.ctrl),
    metaKey: Boolean(options?.meta),
  }));
}

function syncCompressSelectionForSnapshot(snapshot: CreateWorkspaceSnapshot) {
  if (snapshot.isEmpty || snapshot.plan.state === "loading" || !snapshot.plan.current || !snapshot.view.rows.length) {
    applyCompressTableSelection(clearHierarchicalTableSelection());
    return;
  }

  applyCompressTableSelection(cleanupHierarchicalTableSelection({
    ...currentCompressTableSelectionState(),
    visiblePaths: selectableHierarchicalRowPaths(snapshot.view.rows),
    preserveHiddenSelection: false,
  }));
}

function renderCompressBrowser() {
  const snapshot = syncCreateSourcesFromWorkspace();
  syncCompressSelectionForSnapshot(snapshot);
  publishReactSnapshot();
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

type ExtractPathMode = "full" | "current" | "none";
type ExtractFormValues = Readonly<{
  destination: string;
  useSubfolder: boolean;
  subfolder: string;
  pathMode: ExtractPathMode;
  overwrite: ExtractStartInput["overwrite"];
  stripComponents: string;
  deduplicateRoot: boolean;
  password?: string;
}>;
type ExtractDialogState = Readonly<{
  messageText: string;
  form: Omit<ExtractFormValues, "password">;
  passwordPromptOpen: boolean;
}>;

function recordExtractDestinationHistory(destination: string): void {
  archiveOpenController.recordExtractDestinationHistory(destination);
}

function renderExtractDestinationHistory() {
  publishReactSnapshot();
}

function recordCreateDestinationHistory(destination: string): void {
  archiveOpenController.recordCreateDestinationHistory(destination);
}

function recordRecentArchiveHistory(archivePath: string): void {
  archiveOpenController.recordRecentArchiveHistory(archivePath);
}

function normalizeExtractPathMode(value: string): ExtractPathMode {
  return value === "current" || value === "none" ? value : "full";
}

function getCurrentArchiveFolderDepth(): number {
  const normalizedFolder = normalizeFolderPath(currentArchiveFolder);
  return normalizedFolder ? normalizedFolder.split("/").filter(Boolean).length : 0;
}

function archivePathDepth(entryPath: string): number {
  return normalizeEntryPath(entryPath).split("/").filter(Boolean).length;
}

function hasSingleRootFolder(entryPaths: string[]): boolean {
  const normalized = entryPaths
    .map((entryPath) => normalizeEntryPath(entryPath).split("/").filter(Boolean))
    .filter((parts) => parts.length > 0);
  if (!normalized.length) {
    return false;
  }
  const root = normalized[0][0];
  return root ? normalized.every((parts) => parts[0] === root) : false;
}

function resolveExtractDestinationFromValues(
  baseDestination: string,
  useSubfolder: boolean,
  subfolderValue: string,
): string {
  if (!useSubfolder) {
    return baseDestination.trim();
  }
  const subfolder = subfolderValue.trim();
  return subfolder ? joinNativePath(baseDestination.trim(), subfolder) : baseDestination.trim();
}

function extractStartInputFromFormValues(mode: ExtractMode, form: ExtractFormValues): ExtractStartInput {
  const entryReferences = archiveWorkspace.getExtractReferencePaths(mode);
  const stripComponentsBase = toNumberOrUndefined(form.stripComponents) ?? 0;
  return {
    destination: resolveExtractDestinationFromValues(form.destination, form.useSubfolder, form.subfolder),
    destinationValid: form.destination.trim().length > 0,
    overwrite: form.overwrite,
    stripComponents: resolveExtractStripComponents(
      stripComponentsBase,
      form.pathMode,
      [...entryReferences],
      form.deduplicateRoot,
    ),
    password: form.password?.trim() || undefined,
    entryReferences,
  };
}

function extractDialogMessageForMode(mode: ExtractMode): string {
  const selectedCount = selectedEntries.size;
  return mode === "selection"
    ? message("extract.selectedMessage", {
      count: selectedCount,
      entryLabel: message(selectedCount === 1 ? "extract.entrySingular" : "extract.entryPlural"),
    })
    : message("extract.archiveMessage");
}

function requestExtractPasswordInDialog(retry: ArchiveWorkspacePasswordRetry) {
  extractDialogState = {
    ...extractDialogState,
    messageText: message(retry.promptKey),
    passwordPromptOpen: true,
  };
  setReactDialogSnapshot(currentReactExtractDialogSnapshot(activeExtractMode, message(retry.promptKey)));
}

function resolveExtractStripComponents(
  baseStripComponents: number,
  pathMode: ExtractPathMode,
  entryPaths: string[],
  deduplicateRoot: boolean,
): number {
  const references = entryPaths.length > 0 ? [...entryPaths] : browseEntries.map((entry) => entry.path);
  let stripComponents = Math.max(0, baseStripComponents);

  if (pathMode === "current") {
    stripComponents = Math.max(stripComponents, getCurrentArchiveFolderDepth());
  }
  if (pathMode === "none") {
    let maxDepth = 0;
    for (const path of references) {
      maxDepth = Math.max(maxDepth, archivePathDepth(path));
    }
    stripComponents = Math.max(stripComponents, maxDepth);
  }

  if (deduplicateRoot && hasSingleRootFolder(references)) {
    stripComponents += 1;
  }

  return stripComponents;
}

function getOverwritePolicyValue(): "refuse" | "replace" | "rename" | "ask" {
  return "ask";
}

function normalizeOverwritePolicyValue(value: string): "refuse" | "replace" | "rename" | "ask" {
  if (value === "replace" || value === "rename" || value === "ask") {
    return value;
  }

  return "refuse";
}

function toNumberOrUndefined(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : Math.trunc(parsed);
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

function setReactDialogSnapshot(snapshot: ZManagerDialogSnapshot) {
  reactDialogSnapshot = snapshot;
  publishReactSnapshot();
}

function closeReactDialog() {
  const previous = reactDialogSnapshot;
  reactDialogSnapshot = { kind: "none" };
  if (previous.kind === "extract") {
    archiveWorkspace.clearPasswordRetry();
  }
  publishReactSnapshot();

  if (previous.kind === "info") {
    findActiveArchiveRow(previous.returnFocusPath)?.focus();
  } else if (previous.kind === "extract") {
    findActiveArchiveRow(focusedEntryPath)?.focus();
  }
}

function currentReactExtractDialogSnapshot(
  mode: ExtractMode = activeExtractMode,
  messageText = extractDialogState.messageText || extractDialogMessageForMode(mode),
): Extract<ZManagerDialogSnapshot, { kind: "extract" }> {
  const form = extractDialogState.form;
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
    passwordPromptOpen: extractDialogState.passwordPromptOpen,
  };
}

function reactExtractDialogSnapshotFromFormValues(
  mode: ExtractMode,
  form: Omit<ExtractFormValues, "password">,
  messageText = extractDialogState.messageText || extractDialogMessageForMode(mode),
): Extract<ZManagerDialogSnapshot, { kind: "extract" }> {
  extractDialogState = {
    ...extractDialogState,
    messageText,
    form,
  };
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
    passwordPromptOpen: extractDialogState.passwordPromptOpen,
  };
}

function syncReactExtractDialogSnapshot(
  messageText = extractDialogState.messageText || extractDialogMessageForMode(activeExtractMode),
) {
  if (reactDialogSnapshot.kind !== "extract") {
    return;
  }

  setReactDialogSnapshot(currentReactExtractDialogSnapshot(activeExtractMode, messageText));
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

  if (currentArchivePath) {
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

  syncArchiveWorkspaceViewSnapshot(snapshot);
  renderBrowse();
  if (currentArchivePath) {
    renderArchiveBrowseMessage({ messageElement }, {
      browseState,
      message: displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length }),
    });
  }
  focusFirstVisibleRow();
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
  syncArchiveWorkspaceViewSnapshot(snapshot);
  renderBrowse();
  if (currentArchivePath) {
    renderArchiveBrowseMessage({ messageElement }, {
      browseState,
      message: displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length }),
    });
  }
  focusFirstVisibleRow();
}

function navigateUp() {
  if (!currentArchiveFolder) {
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
  syncArchiveWorkspaceViewSnapshot(snapshot);
  renderBrowse();
  if (currentArchivePath) {
    renderArchiveBrowseMessage({ messageElement }, {
      browseState,
      message: displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length }),
    });
  }
  focusFirstVisibleRow();
}

function getTableRows(): HTMLTableRowElement[] {
  return Array.from(tableBody.querySelectorAll<HTMLTableRowElement>("tr[data-folder-path], tr[data-entry-path]"));
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

function syncVisibleSelectionUi() {
  const selection = archiveWorkspace.getSnapshot().view.selection;
  syncArchiveVisibleSelection({ tableBody, selectAllInput }, selection);

  renderDetails();
  updateCommandState();
}

function selectAllVisibleEntries() {
  applyArchiveTableSelection(selectAllVisibleHierarchicalRows(getVisibleSelectablePaths()));
  renderBrowse();
}

function invertVisibleSelectionEntries() {
  const selection = currentArchiveTableSelectionState();
  applyArchiveTableSelection(invertVisibleHierarchicalSelection({
    currentSelection: selection.selectedPaths,
    visiblePaths: getVisibleSelectablePaths(),
  }));
  renderBrowse();
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
  renderBrowse();
}

function focusTableRow(row: HTMLTableRowElement | null, focusedPath?: string) {
  if (!row) {
    return;
  }
  row.focus();
  applyArchiveTableSelection(focusHierarchicalTablePath(
    currentArchiveTableSelectionState(),
    focusedPath ?? row.dataset.entryPath ?? "",
  ));
  syncVisibleSelectionUi();
}

function focusFirstVisibleRow() {
  uiDeferrals.schedule(() => {
    focusTableRow(getTableRows()[0] ?? null);
  }, 0);
}

function focusRelativeTableRow(currentRow: HTMLTableRowElement, direction: 1 | -1) {
  const rows = getTableRows();
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }

  const nextFocus = moveHierarchicalTableFocus({
    rows: visibleRows(),
    currentIndex,
    direction,
  });
  focusTableRow(rows[nextFocus.rowIndex] ?? null, nextFocus.focusedPath);
}

function activateTableRow(row: HTMLTableRowElement) {
  const folderPath = row.dataset.folderPath;
  if (folderPath !== undefined) {
    navigateToFolder(folderPath);
    return;
  }

  const entryPath = row.dataset.entryPath;
  if (!entryPath) {
    return;
  }

  applyArchiveTableSelection(replaceHierarchicalTableSelection({
    paths: [entryPath],
    focusedPath: focusedEntryPath,
    anchorPath: selectionAnchorPath,
  }));
  renderBrowse();
  runRoutedCommand("view");
}

function toggleTableRowSelection(row: HTMLTableRowElement) {
  const entryPath = row.dataset.entryPath;
  if (!entryPath) {
    return;
  }

  applyArchiveTableSelection(toggleHierarchicalTablePathSelection({
    ...currentArchiveTableSelectionState(),
    path: entryPath,
  }));
  renderBrowse();
  focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));
}

function selectVisibleEntries() {
  selectAllVisibleEntries();
}

function clearBrowseSelection() {
  applyArchiveTableSelection(clearHierarchicalTableSelection());
  renderBrowse();
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
  renderBrowse();
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
  const descendantEntries = browseEntries
    .filter((entry) => entry.kind !== "directory" && entryIsUnderFolder(entry.path, folderPath))
    .map((entry) => entry.path);
  const folderEntry = getEntryByPath(folderPath);
  applyArchiveTableSelection(replaceHierarchicalTableSelection({
    paths: descendantEntries.length > 0
      ? descendantEntries
      : folderEntry ? [folderEntry.path] : [],
    focusedPath: focusedEntryPath,
    anchorPath: selectionAnchorPath,
  }));
  renderBrowse();
}

function showStartupContextMenu(x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = "";
  const canPastePath = canReadClipboard();
  const { recentArchiveHistory } = pathHistoryStore.getSnapshot();
  const items: ContextMenuModelItem[] = [
    contextMenuAction(displayContext.translator.t("browse.emptyOpenAction"), { action: "open-archive" }),
  ];
  if (canPastePath) {
    items.push(contextMenuAction(message("command.pastePath"), { action: "paste-archive-path" }));
  }
  if (recentArchiveHistory.length) {
    items.push(
      contextMenuSeparator(),
      contextMenuCaption(message("command.openRecent")),
      ...recentArchiveHistory.slice(0, 4).map((archivePath) =>
        contextMenuAction(middleTruncateDetailValue(archivePath, 46), {
          action: "open-recent-archive",
          archivePath,
        }),
      ),
    );
  }
  showContextMenu(x, y, items);
}

function showFolderContextMenu(folderPath: string, x: number, y: number, entryPath = "") {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  const selectedPaths = getSelectedEntryPaths();
  if (selectedPaths.length > 1) {
    showContextMenu(x, y, [
      contextMenuAction(message("extract.selectedAction"), { action: "extract" }),
      contextMenuAction(message("command.extractHere"), { action: "extract-here" }),
      contextMenuAction(message("test.selectedAction"), { action: "test" }, { disabled: !currentArchivePath }),
      contextMenuAction(message("command.properties"), { action: "info" }),
    ]);
    return;
  }

  showContextMenu(x, y, [
    contextMenuAction(message("command.openFolder"), { action: "open-folder", folderPath }),
    ...(entryPath ? [contextMenuAction(message("command.openInside"), { action: "open-inside" })] : []),
    contextMenuAction(message("command.extractWithEllipsis"), { action: "extract" }),
    contextMenuAction(message("command.extractHere"), { action: "extract-here" }),
    contextMenuAction(message("command.test"), { action: "test" }, { disabled: !currentArchivePath }),
    contextMenuAction(message("command.properties"), { action: "info" }),
  ]);
}

function showEntryContextMenu(entryPath: string, x: number, y: number) {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  if (!selectedEntries.has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
    renderBrowse();
  }
  const entry = getEntryByPath(entryPath);
  const canOpenInside = entry?.kind === "directory";
  const hasSingleSelection = getSelectedEntryPaths().length === 1;
  const selectionItems: ContextMenuModelItem[] = hasSingleSelection
    ? [
        contextMenuAction(message("command.openFolder"), { action: "open-entry" }),
        ...(canOpenInside ? [contextMenuAction(message("command.openInside"), { action: "open-inside" })] : []),
        ...(entry?.kind !== "directory" ? [contextMenuAction(message("command.openOutside"), { action: "open-outside" })] : []),
        contextMenuAction(message("command.extractWithEllipsis"), { action: "extract" }),
        contextMenuAction(message("command.extractHere"), { action: "extract-here" }),
        contextMenuAction(message("test.selectedAction"), { action: "test" }, { disabled: !currentArchivePath }),
        contextMenuAction(message("command.properties"), { action: "info" }),
      ]
    : [
        contextMenuAction(message("extract.selectedAction"), { action: "extract" }),
        contextMenuAction(message("command.extractHere"), { action: "extract-here" }),
        contextMenuAction(message("test.selectedAction"), { action: "test" }, { disabled: !currentArchivePath }),
        contextMenuAction(message("command.properties"), { action: "info" }),
      ];
  showContextMenu(x, y, [
    ...selectionItems,
    contextMenuSeparator(),
    contextMenuAction(message("command.selectByType"), { action: "select-by-type" }),
    contextMenuAction(message("command.deselectByType"), { action: "deselect-by-type" }, { disabled: selectedEntries.size === 0 }),
  ]);
}

function showTableHeaderContextMenu(x: number, y: number, selectedColumnId?: ArchiveTableColumnId) {
  const selectedColumn = ARCHIVE_TABLE_COLUMNS.find((column) => column.id === selectedColumnId);
  const normalizedSettings = normalizeColumnSettings(tableColumnSettings);
  const visibleColumnOrder = normalizedSettings.columnOrderIds.filter((id) =>
    normalizedSettings.visibleColumnIds.includes(id),
  );
  const selectedColumnIndex = selectedColumnId
    ? visibleColumnOrder.indexOf(selectedColumnId)
    : -1;
  const selectedColumnMenu: ContextMenuModelItem[] = selectedColumn ? [
    contextMenuCaption(message("detail.columnCaption", { label: archiveTableColumnLabel(selectedColumn, displayContext.translator) })),
    contextMenuAction(message("command.sortAscending"), { action: "sort-ascending", columnId: selectedColumn.id }),
    contextMenuAction(message("command.sortDescending"), { action: "sort-descending", columnId: selectedColumn.id }),
    contextMenuSeparator(),
    contextMenuAction(message("command.moveLeft"), { action: "move-column-left", columnId: selectedColumn.id }, {
      disabled: selectedColumn.id === "name" || selectedColumnIndex <= 1,
    }),
    contextMenuAction(message("command.moveRight"), { action: "move-column-right", columnId: selectedColumn.id }, {
      disabled: selectedColumn.id === "name" || selectedColumnIndex < 1 || selectedColumnIndex >= visibleColumnOrder.length - 1,
    }),
    contextMenuAction(message("command.narrower"), { action: "narrow-column", columnId: selectedColumn.id }),
    contextMenuAction(message("command.wider"), { action: "widen-column", columnId: selectedColumn.id }),
    contextMenuAction(message("command.resetWidth"), { action: "reset-column-width", columnId: selectedColumn.id }),
    contextMenuSeparator(),
  ] : [];

  const menuRows = ARCHIVE_TABLE_COLUMNS.map((column) => {
    const isNameColumn = column.id === "name";
    const checked = isNameColumn || tableColumnSettings.visibleColumnIds.includes(column.id);
    return contextMenuCheckbox(
      archiveTableColumnLabel(column, displayContext.translator),
      { action: "toggle-column", columnId: column.id },
      checked,
      { disabled: isNameColumn },
    );
  });

  showContextMenu(
    x,
    y,
    [
      ...selectedColumnMenu,
      contextMenuAction(message("command.resetColumns"), { action: "reset-columns" }),
      contextMenuSeparator(),
      contextMenuCaption(message("command.chooseColumns")),
      ...menuRows,
    ],
  );
}

function showCompressRowContextMenuForPath(input: Readonly<{
  rowPath: string;
  folderPath?: string;
  sourcePath?: string;
  x: number;
  y: number;
}>) {
  const rowPath = input.rowPath;
  const folderPath = input.folderPath;
  const sourcePath = input.sourcePath ?? "";
  const removableSourcePath = removableSourcePathForCompressPath(rowPath, sourcePath);
  const removableSourcePaths = removableSourcePath ? sourcePathsForCompressMenu(removableSourcePath) : [];
  const contextPaths = compressPathsForContextAction(rowPath);
  const contextRows = contextPaths
    .map((path) => visibleCompressRowForPath(path))
    .filter((candidate): candidate is CompressPlanRow => Boolean(candidate));
  const canInclude = contextRows.some((compressRow) => compressRowInclusionState(compressRow) !== "included");
  const canExclude = contextRows.some((compressRow) => compressRowInclusionState(compressRow) !== "excluded");
  const removeLabel = removableSourcePaths.length > 1
    ? message("command.removeSelectedSources", { count: removableSourcePaths.length })
    : message("command.removeSource");
  const includeLabel = contextRows.length > 1
    ? message("command.includeSelectedInArchive", { count: contextRows.length })
    : message("command.includeInArchive");
  const excludeLabel = contextRows.length > 1
    ? message("command.excludeSelectedFromArchive", { count: contextRows.length })
    : message("command.excludeFromArchive");
  contextEntryPath = "";
  contextSourcePath = sourcePath;

  showContextMenu(input.x, input.y, [
    contextMenuAction(message("command.openFolder"), { action: "compress-open-folder", folderPath: folderPath ?? "" }, {
      disabled: folderPath === undefined,
    }),
    contextMenuAction(message("command.revealInFileManager"), { action: "reveal-source", sourcePath }, { disabled: !sourcePath }),
    contextMenuSeparator(),
    contextMenuAction(includeLabel, { action: "include-compress-path", compressMenuPath: rowPath }, { disabled: !canInclude }),
    contextMenuAction(excludeLabel, { action: "exclude-compress-path", compressMenuPath: rowPath }, { disabled: !canExclude }),
    contextMenuSeparator(),
    ...(removableSourcePaths.length ? [contextMenuAction(removeLabel, {
      action: "remove-source",
      sourcePath: removableSourcePath,
      sourcePaths: removableSourcePaths,
    })] : []),
    contextMenuAction(message("command.clearAllSources"), { action: "clear-sources" }, {
      disabled: !syncCreateSourcesFromWorkspace().hasSources,
    }),
  ]);
}

function showSourceContextMenu(sourcePath: string, x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = sourcePath;
  showContextMenu(x, y, [
    contextMenuAction(message("command.revealInFileManager"), { action: "reveal-source", sourcePath }),
    contextMenuAction(message("command.removeSource"), { action: "remove-source", sourcePath, sourcePaths: [sourcePath] }),
    contextMenuSeparator(),
    contextMenuAction(message("command.clearAllSources"), { action: "clear-sources" }),
  ]);
}

function addSourcesContextMenuItems(): readonly ContextMenuModelItem[] {
  return [
    contextMenuAction(message("command.filesWithEllipsis"), { action: "add-source-files" }),
    contextMenuAction(message("command.folderWithEllipsis"), { action: "add-source-folder" }),
  ];
}

function handleContextMenuAction(payload: ContextMenuActionPayload) {
  const action = payload.action;
  const folderPath = payload.folderPath;
  const columnId = payload.columnId as ArchiveTableColumnId | undefined;
  const archivePath = payload.archivePath;
  const entryPath = contextEntryPath;
  const sourcePath = payload.sourcePath ?? contextSourcePath;
  const sourcePaths = payload.sourcePaths ?? (sourcePath ? sourcePathsForCompressMenu(sourcePath) : []);
  hideContextMenu();

  const routedContextCommand = selectContextCommand(action, {
    archivePath,
    entryPath,
    extractMode: selectedEntries.size ? "selection" : "archive",
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
      renderBrowse();
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
    renderBrowse();
    return;
  }
  if (action === "move-column-left" && columnId) {
    tableColumnSettings = moveColumn(tableColumnSettings, columnId, "left");
    saveTablePreferences();
    renderBrowse();
    return;
  }
  if (action === "move-column-right" && columnId) {
    tableColumnSettings = moveColumn(tableColumnSettings, columnId, "right");
    saveTablePreferences();
    renderBrowse();
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
    renderBrowse();
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
      renderCreateSources();
      renderCompressBrowser();
    }
    return;
  }
  if (action === "remove-source") {
    removeCreateSources([...sourcePaths]);
    return;
  }
  if (action === "clear-sources") {
    clearCreateSources();
  }
}

function showArchiveInfo() {
  const knownTotalSize = currentArchiveTotalSize !== null
    ? currentArchiveTotalSize
    : (sumKnownBytes(browseEntries, (entry) => entry.size) ?? null);
  const formattedTotalSize = knownTotalSize === null ? null : formatBytes(knownTotalSize);
  const packedSize = sumKnownBytes(browseEntries, (entry) => entry.compressedSize);

  const rows: DetailRow[] = [
    { label: message("detail.archiveName"), value: getArchiveName(currentArchivePath, APP_TITLE) },
    { label: message("detail.path"), value: currentArchivePath, mode: "middle" },
    { label: message("detail.format"), value: formatArchiveTypeFromPath(currentArchivePath) },
    { label: message("detail.entries"), value: String(currentArchiveEntryCount) },
    { label: message("detail.totalUnpackedSize"), value: formattedTotalSize },
    { label: message("detail.packedSize"), value: packedSize === null ? null : formatBytes(packedSize) },
    { label: message("detail.lastTestStatus"), value: formatLastTestStatusForCurrentArchive() },
  ];
  const actions: ZManagerDialogAction[] = [
    { label: message("info.copyPath"), copyValue: currentArchivePath },
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
  ];

  setReactDialogSnapshot({
    kind: "info",
    title: message("info.archiveTitle"),
    description: message("info.archiveDescription"),
    sectionTitle: message("info.archiveTitle"),
    rows: detailRowsToReactRows(rows),
    actions,
    returnFocusPath: infoReturnFocusPath(),
  });
}

function showEntryInfo(path: string) {
  const entry = getEntryByPath(path);
  if (!entry) {
    return;
  }

  const rows = entryPropertyRows(entry);
  const canPreview = entry.kind !== "directory";
  const actions: ZManagerDialogAction[] = [
    ...(canPreview ? [{ label: message("command.view"), action: "preview", primary: true, title: previewActionHint() }] : []),
    { label: message("info.copyPath"), copyValue: entry.path },
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
    { label: message("info.archiveTitle"), action: "archive-info" },
  ];
  setReactDialogSnapshot({
    kind: "info",
    title: message("info.entryTitle"),
    description: message("info.entryDescription"),
    sectionTitle: message("info.entryTitle"),
    rows: detailRowsToReactRows(rows),
    actions,
    returnFocusPath: infoReturnFocusPath(),
  });
}

function showSelectionInfo(selectedRows = getVisibleSelectedRows()) {
  if (selectedRows.length === 0) {
    showArchiveInfo();
    return;
  }

  const rows = selectionPropertyRows(selectedRows);
  const actions: ZManagerDialogAction[] = [
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
    { label: message("info.archiveTitle"), action: "archive-info" },
  ];
  setReactDialogSnapshot({
    kind: "info",
    title: message("info.selectionTitle"),
    description: message("info.selectionDescription"),
    sectionTitle: message("info.selectionTitle"),
    rows: detailRowsToReactRows(rows),
    actions,
    returnFocusPath: infoReturnFocusPath(),
  });
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

type AboutDiagnosticsGroup = Readonly<{
  title: string;
  rows: readonly (readonly [string, string])[];
}>;

function renderAboutDiagnostics(): AboutDiagnosticsGroup[] {
  const healthcheck = latestHealthcheck;
  const contract = latestContract;
  const shellActions =
    contract?.platformIntegration.shellActions
      .map((action) => `${action.label} (${action.quickAction})`)
      .join(", ") ?? "-";
  const groups: AboutDiagnosticsGroup[] = [
    {
      title: message("about.group.product"),
      rows: [
        [message("about.diagnostics.appName"), APP_TITLE],
        [message("about.diagnostics.appVersion"), APP_VERSION],
      ],
    },
    {
      title: message("about.group.runtime"),
      rows: [
        [message("about.diagnostics.shell"), healthcheck?.shell ?? message("about.shell.browserPreview")],
        [
          message("about.diagnostics.engine"),
          healthcheck ? `${healthcheck.engine} ${healthcheck.version}` : message("about.diagnostics.unavailable"),
        ],
        [message("about.diagnostics.coreDependency"), contract?.coreDependency ?? message("about.diagnostics.unavailable")],
      ],
    },
    {
      title: message("about.group.integration"),
      rows: [
        [message("about.diagnostics.platform"), contract?.platformIntegration.platform ?? message("about.diagnostics.unknown")],
        [
          message("about.diagnostics.explorerIntegration"),
          contract?.platformIntegration.explorerIntegrationEnabled
            ? message("about.diagnostics.enabled")
            : message("about.diagnostics.disabled"),
        ],
        [
          message("about.diagnostics.desktopActions"),
          contract?.platformIntegration.desktopActionsEnabled
            ? message("about.diagnostics.enabled")
            : message("about.diagnostics.disabled"),
        ],
      ],
    },
    {
      title: message("about.group.support"),
      rows: [
        [message("about.diagnostics.status"), healthcheck?.status ?? message("about.diagnostics.frontendOnly")],
        [message("about.diagnostics.extensions"), contract?.platformIntegration.associatedExtensions.join(", ") ?? "-"],
        [message("about.diagnostics.shellActions"), shellActions],
      ],
    },
  ];

  return groups;
}

function openAboutDialog() {
  const groups = renderAboutDiagnostics();
  setReactDialogSnapshot({
    kind: "about",
    title: message("about.title"),
    groups: groups.map((group) => ({
      title: group.title,
      rows: group.rows.map(([label, value]) => [label, value] as const),
    })),
  });
}

function serializeAboutDiagnostics(groups: readonly AboutDiagnosticsGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    if (group.title.trim()) {
      lines.push(group.title.trim());
    }
    for (const [label, value] of group.rows) {
      if (label && value) {
        lines.push(`${label}: ${value}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function diagnosticsText(): string {
  if (reactDialogSnapshot.kind === "about") {
    return serializeAboutDiagnostics(reactDialogSnapshot.groups);
  }
  return serializeAboutDiagnostics(renderAboutDiagnostics());
}

async function copyAboutDiagnostics() {
  try {
    await writeClipboardText(diagnosticsText());
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
    renderCreate: renderCompressBrowser,
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
  setCreatePlanState();
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
  syncCreateSourcesFromWorkspace(result.snapshot);
}

async function savePreferencesFromDialog() {
  const draft = currentPreferencesDraft();
  if (!(await validatePreferencesDraft(draft))) {
    return;
  }
  persistPreferencePatch(draft);
  preferencesDialogDraft = null;
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setRowOptions({
    showParentFolderItem: appPreferences.showParentFolderItem,
  }));
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setFlatView(appPreferences.flatViewDefault));
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
  if (!currentArchivePath) {
    return;
  }

  archiveWorkspace.clearPasswordRetry();
  activeExtractMode = mode;
  const { extractDestinationHistory } = pathHistoryStore.getSnapshot();
  extractDialogState = {
    messageText: extractDialogMessageForMode(mode),
    form: {
      destination: extractDialogState.form.destination.trim() || extractDestinationHistory[0] || "",
      useSubfolder: false,
      subfolder: "",
      pathMode: "full",
      overwrite: "ask",
      stripComponents: "0",
      deduplicateRoot: false,
    },
    passwordPromptOpen: false,
  };
  setReactDialogSnapshot(currentReactExtractDialogSnapshot(mode));
}

function openExtractHereDialog(mode: ExtractMode) {
  const parent = nativeParentPath(currentArchivePath);
  openExtractDialog(mode);
  if (parent) {
    const messageText = mode === "selection"
      ? message("extract.hereSelected", { archiveName: getArchiveName(currentArchivePath, APP_TITLE) })
      : message("extract.hereArchive", { archiveName: getArchiveName(currentArchivePath, APP_TITLE) });
    extractDialogState = {
      ...extractDialogState,
      messageText,
      form: {
        ...extractDialogState.form,
        destination: parent,
      },
    };
    setReactDialogSnapshot(currentReactExtractDialogSnapshot(mode, messageText));
  }
}

function showCreateWorkspace() {
  applyCreatePreferenceDefaults();
  const { createDestinationHistory } = pathHistoryStore.getSnapshot();
  if (!createWorkspace.getSnapshot().options.destinationPath.trim() && createDestinationHistory[0]) {
    syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPathIfBlank(createDestinationHistory[0]).snapshot);
  }
  setWorkspaceMode("compress");
  setCreatePlanState();
  renderCreateSources();
  renderCompressBrowser();
}

async function loadArchive(request: ListArchiveRequest, options: ArchiveLoadOptions = {}) {
  await archiveLoadController.loadArchive(request, options);
}

function loadArchiveListingIntoState(listing: ArchiveFixture, options: ArchiveLoadOptions = {}) {
  const preserveState = options.preserveState ?? false;
  const preservedState = preserveState
    ? {
        currentFolder: currentArchiveFolder,
        navigationHistory,
        searchQuery: currentArchiveSearchQuery,
        flatView: isFlatView,
        expandedTreeFolders: [...expandedArchiveTreeFolders],
        selectedPaths: [...selectedEntries],
        focusedPath: focusedEntryPath,
        anchorPath: selectionAnchorPath,
        showParentFolderItem: appPreferences.showParentFolderItem,
        sortKey,
        sortAscending,
      }
    : false;

  clearTrackedPreviewState();
  hideContextMenu();
  shellWorkspace.setWorkspaceMode("extract");
  const snapshot = archiveWorkspace.loadSucceeded(archiveListingFromFixture(listing), {
    preserveState: preservedState,
  });
  syncArchiveWorkspaceSnapshot(snapshot);
  syncArchiveWorkspaceViewSnapshot(snapshot);
  archiveTreeChildrenByParent = buildArchiveTreeChildren(browseEntries);

  setBrowseState(listing.entries.length > 0 ? "loaded" : "empty", message("archive.loaded"));

  renderArchiveBrowseMessage({ messageElement }, {
    browseState,
    message: listing.entries.length > 0
      ? message("browse.loadedEntries", { count: listing.entries.length })
      : message("browse.validEmpty"),
  });

  renderBrowse();
  if (focusedEntryPath) {
    const restoredFocus = findActiveArchiveRow(focusedEntryPath);
    if (restoredFocus) {
      focusTableRow(restoredFocus);
      return;
    }
  }
  focusFirstVisibleRow();
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
  let sourceSnapshot = syncCreateSourcesFromWorkspace(result.snapshot);
  if (!result.changed) {
    return;
  }
  if (!previousSnapshot.hasSources && sourceSnapshot.hasSources && !sourceSnapshot.options.destinationPath.trim()) {
    sourceSnapshot = syncCreateSourcesFromWorkspace(
      createWorkspace.suggestDestinationPathIfBlank(createDestinationSuggestionOptions()).snapshot,
    );
  }
  renderCreateSources();
  renderCompressBrowser();
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
  if (!currentArchivePath) {
    return;
  }

  await loadArchive({
    archivePath: currentArchivePath,
  }, {
    preserveState: true,
  });
}

async function onSelectDestinationForReactExtractForm(
  input: Extract<ZManagerDialogIntent, { type: "browseExtractDestination" }>,
) {
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.chooseExtractDestination"),
    directory: true,
    multiple: false,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  setReactDialogSnapshot(reactExtractDialogSnapshotFromFormValues(activeExtractMode, {
    destination: selected,
    useSubfolder: input.useSubfolder,
    subfolder: input.subfolder,
    pathMode: normalizeExtractPathMode(input.pathMode),
    overwrite: normalizeOverwritePolicyValue(input.overwrite),
    stripComponents: input.stripComponents,
    deduplicateRoot: input.deduplicateRoot,
  }));
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
  syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPath(
    createWorkspace.destinationPathWithFormatExtension(selected),
  ).snapshot);
  setCreatePlanState();
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
  await createStartController.runCreate({
    destinationCollisionStrategy: options.destinationCollisionStrategy,
    passwordInput: options.passwordInput,
  });
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

function bindActions() {
  compactCompressOptionsQuery.addEventListener("change", syncCompressOptionsPanelDisclosure);
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

  searchSubmitButton.addEventListener("click", () => {
    if (searchInput.disabled) {
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
    syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setSearchQuery(searchInput.value));
    renderBrowse();
    searchInput.focus();
  });

  clearSearchButton.addEventListener("click", clearSearch);

  searchInput.addEventListener("input", () => {
    if (!currentArchivePath) {
      searchInput.value = "";
      syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setSearchQuery(""));
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
    syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setSearchQuery(searchInput.value));
    renderBrowse();
  });

  pathCrumbsElement.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-crumb-path]");
    if (!target) {
      return;
    }
    navigateToFolder(target.dataset.crumbPath ?? "");
  });

  pathCrumbsElement.addEventListener("keydown", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-crumb-path]");
    if (!target || (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar")) {
      return;
    }
    event.preventDefault();
    navigateToFolder(target.dataset.crumbPath ?? "");
  });

  pathFieldInput.addEventListener("focus", () => {
    if (currentArchivePath) {
      pathFieldInput.select();
    }
  });

  pathFieldInput.addEventListener("click", () => {
    if (currentArchivePath) {
      pathFieldInput.select();
    }
  });

  treeContentElement.addEventListener("click", (event) => {
    const actionTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tree-action]");
    const routedTreeCommand = selectTreeCommand(actionTarget?.dataset.treeAction);
    if (routedTreeCommand) {
      runRoutedCommand(routedTreeCommand.commandId, routedTreeCommand.payload);
      return;
    }

    const toggleTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-tree-toggle]");
    if (toggleTarget) {
      event.preventDefault();
      const folderPath = toggleTarget.dataset.treePath ?? "";
      syncArchiveWorkspaceViewSnapshot(archiveWorkspace.toggleTreeFolder(folderPath));
      renderBrowse();
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tree-path]");
    if (!target) {
      return;
    }
    navigateToFolder(target.dataset.treePath ?? "");
  });

  detailsElement.addEventListener("click", (event) => {
    const copyTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-copy-value]");
    if (copyTarget) {
      void copyTextToClipboard(copyTarget.dataset.copyValue ?? "");
      return;
    }

    const actionTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-details-action]");
    const action = actionTarget?.dataset.detailsAction;
    const routedCommand = selectDetailsCommand(action);
    if (routedCommand) {
      runRoutedCommand(routedCommand.commandId, routedCommand.payload);
    }
  });

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

}

bindMenuBehavior();
bindActions();
privatizeLegacyCreateWorkspaceIds();
bindWindowLifecycleHandlers();
refreshDisplayFromPreferences();
pathHistoryStore.load();
applyCreatePreferenceDefaults();
setCreatePlanState();
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
