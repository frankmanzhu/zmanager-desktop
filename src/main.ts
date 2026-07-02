import "./styles.css";
import {
  APP_TITLE,
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
  BROWSE_ACTION_PASSWORD_INVALID,
  BROWSE_ACTION_PASSWORD_REQUIRED,
  BROWSE_EMPTY_STATE_DESCRIPTION,
  BROWSE_EMPTY_STATE_DROP_HINT,
  BROWSE_EMPTY_STATE_OPEN_ACTION,
  BROWSE_EMPTY_STATE_TITLE,
  BROWSE_STATUS_EMPTY,
  BROWSE_STATUS_IDLE,
  BROWSE_STATUS_LOADING,
  BROWSE_STATUS_UNKNOWN,
  BROWSE_STATUS_READY,
  JOB_POLL_INTERVAL_MS,
  APP_MIN_WINDOW_WIDTH_PX,
  APP_MIN_WINDOW_HEIGHT_PX,
  APP_MENU_BAR_HEIGHT_PX,
  APP_TOOLBAR_HEIGHT_PX,
  APP_PATH_BAR_HEIGHT_PX,
  APP_STATUS_BAR_HEIGHT_PX,
  APP_NAV_PANE_MIN_WIDTH_PX,
  APP_NAV_PANE_MAX_WIDTH_PX,
  APP_DETAILS_PANE_MIN_WIDTH_PX,
  APP_DETAILS_PANE_MAX_WIDTH_PX,
  APP_STATUS_BAR_PARTS,
  COMPRESS_EMPTY_TABLE_MESSAGE,
  COMPRESS_TABLE_DESCRIPTION,
  COMPRESS_TABLE_TITLE,
  EXTRACT_TABLE_DESCRIPTION,
  EXTRACT_TABLE_TITLE,
  MODE_COMPRESS_LABEL,
  MODE_EXTRACT_LABEL,
} from "./app/constants";
import {
  CLASSIC_MENU_GROUPS,
  CLASSIC_TOOLBAR_GROUPS,
  COMMAND_DEFINITIONS,
  SINGLE_FILE_REQUIRED_MESSAGE,
  UNSUPPORTED_OPERATION_MESSAGE,
  commandTooltip,
  selectCommandState,
  type CommandId,
  type MenuItem,
} from "./app/classicCommands";
import {
  ARCHIVE_TABLE_COLUMNS,
  formatArchiveTableValue,
  moveColumn,
  normalizeColumnSettings,
  resetColumnSettings,
  setColumnWidth,
  sortArchiveRows,
  toggleColumnVisibility,
  visibleColumns,
  type ArchiveSortKey,
  type ArchiveTableColumn,
  type ArchiveTableColumnId,
  type ArchiveTableColumnSettings,
  type ArchiveTableRow,
} from "./app/archiveTable";
import {
  archiveEntryIconDescriptor,
  archiveFileIconDescriptor,
  archiveRowIconDescriptor,
  archiveTreeIconDescriptor,
  type ArchiveEntryIconDescriptor,
} from "./app/archiveEntryIcons";
import type { IconNode } from "lucide";
import {
  applyRowSelectionIntent,
  invertVisibleSelection,
  pathsWithSameExtension,
  selectAllVisible,
} from "./app/selection";
import {
  escapeHtml as escapeHtmlValue,
  formatBytes as formatBytesValue,
  formatCompressionRatio,
  formatDate as formatDateValue,
  getPathBasename,
} from "./app/formatting";
import {
  getArchiveBreadcrumbs,
  archiveFolderExists,
  getParentArchivePath,
  normalizeArchivePath,
} from "./app/archiveTree";
import {
  CREATE_ARCHIVE_FILTERS,
  buildStartCreateRequest,
  commonSourceParentDirectory,
  createStateAfterDestinationEdit,
  getArchiveName,
  suggestedCreateArchiveName as buildSuggestedCreateArchiveName,
  withCreateArchiveExtension,
  type CreateArchiveFormat,
} from "./app/createFlow";
import {
  unknownErrorMessage,
} from "./app/dialogs";
import {
  buildStartExtractRequest,
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
  type DropIntentSurface,
  type WorkspaceDropMode,
} from "./app/dropIntent";
import {
  canRetryJobWithPassword as canRetryJobWithPasswordState,
  createInitialJobState,
  deriveJobProgress,
  getLatestPasswordFailureEvent,
  isTerminalJobStatus,
  mergePolledJobState,
  type JobRetryContext,
} from "./app/jobs";
import {
  defaultCreateDirectory,
  loadAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from "./app/preferences";
import {
  quickCreateDestination as buildQuickCreateDestination,
  quickExtractDestinationPlan,
  runQuickActionRequest,
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
  cleanupPreviewRoots,
  pollJobEvents as pollJobEventsCommand,
  runPlanCreate,
  runPreviewEntry,
  runStartNativeFileDrag,
  runStartCreate,
  runStartExtract,
  runTestArchive,
} from "./api/commands";
import {
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type {
  ArchiveEntryDto,
  BrowseState,
  CreatePlanResponse,
  CreateState,
  HealthcheckResponse,
  JobEventDto,
  JobKind,
  JobState,
  NativeFileDragRequest,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  StartCreateRequest,
  StartJobResponseDto,
  SystemFileIconRequestEntry,
} from "./api/types";
import { ListArchiveRequest, PlanCreateRequest } from "./api/types";
import {
  bindDesktopFileDrop,
  isDesktopRuntime,
  openDesktopPath,
  openNativeDialog as openRuntimeDialog,
  revealInFileManager,
  saveNativeDialog as saveRuntimeDialog,
  type DesktopFileDropEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "./desktop/runtime";
import {
  activeJobStatusText,
  renderJobsListHtml,
} from "./ui/jobsView";
import {
  collectPreferencesFromDialog as collectPreferencesFromView,
  renderPreferencesDialog as renderPreferencesView,
  syncPreferenceOutputState as syncPreferenceOutputViewState,
  type PreferencesViewElements,
} from "./ui/preferencesView";

type BrowserRow = ArchiveTableRow;
type ArchiveTreeFolder = {
  path: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
};
type QuickActionWindowMode = "normal" | "jobOnly";

const QUICK_ACTION_WINDOW_WIDTH_PX = 680;
const QUICK_ACTION_WINDOW_HEIGHT_PX = 430;
const QUICK_ACTION_WINDOW_MIN_WIDTH_PX = 560;
const QUICK_ACTION_WINDOW_MIN_HEIGHT_PX = 340;
const QUICK_ACTION_AUTO_CLOSE_DELAY_MS = 650;
type ArchiveFixture = {
  archivePath: string;
  entries: ArchiveEntryDto[];
  entryCount?: number;
  totalSize?: number;
};

const NATIVE_DRAG_THRESHOLD_PX = 6;
const MARQUEE_SELECTION_THRESHOLD_PX = 5;

type NativeDragGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  entryPath: string;
  started: boolean;
};

type MarqueeSelectionGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  additive: boolean;
  baseSelection: Set<string>;
  started: boolean;
};

type ViewportRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type DevDialogName = "about" | "preferences" | "info" | "jobs";

declare global {
  interface ImportMeta {
    readonly env: {
      readonly DEV: boolean;
    };
  }

  interface Window {
    __zmanagerDev?: {
      loadArchiveFixture: (fixture: ArchiveFixture) => void;
      setSystemIconFixtures: (fixtures: Record<string, string | null>) => void;
      setJobFixtures: (fixtures: JobState[]) => void;
      openSurface: (surface: DevDialogName) => void;
      closeModal: () => void;
    };
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("missing app root");
}
const appRoot = app;
document.documentElement.style.setProperty("--zmanager-min-window-width", `${APP_MIN_WINDOW_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-min-window-height", `${APP_MIN_WINDOW_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-menu-height", `${APP_MENU_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-toolbar-height", `${APP_TOOLBAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-pathbar-height", `${APP_PATH_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-statusbar-height", `${APP_STATUS_BAR_HEIGHT_PX}px`);
document.documentElement.style.setProperty("--zmanager-nav-pane-min", `${APP_NAV_PANE_MIN_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-nav-pane-max", `${APP_NAV_PANE_MAX_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-details-pane-min", `${APP_DETAILS_PANE_MIN_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-details-pane-max", `${APP_DETAILS_PANE_MAX_WIDTH_PX}px`);
document.documentElement.style.setProperty("--zmanager-statusbar-parts", `${APP_STATUS_BAR_PARTS}`);

function toolbarIcon(
  name: "open" | "new" | "add" | "extract" | "test" | "copy" | "move" | "delete" | "preview" | "info" | "jobs" | "settings",
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

function commandIcon(commandId: CommandId): ReturnType<typeof toolbarIcon> {
  switch (commandId) {
    case "add":
    case "createFile":
      return toolbarIcon("add");
    case "extract":
    case "copy":
    case "copyTo":
      return toolbarIcon(commandId === "copy" ? "copy" : "extract");
    case "test":
      return toolbarIcon("test");
    case "move":
    case "moveTo":
      return toolbarIcon("move");
    case "delete":
      return toolbarIcon("delete");
    case "info":
    case "properties":
      return toolbarIcon("info");
    case "options":
      return toolbarIcon("settings");
    default:
      return toolbarIcon("open");
  }
}

function renderMenuItem(item: MenuItem): string {
  if (item.kind === "separator") {
    return `<div class="menu-separator" role="separator"></div>`;
  }

  if (item.kind === "submenu") {
    return `
      <div class="menu-submenu">
        <span>${escapeHtmlValue(item.label)}</span>
        <div class="menu-submenu-popover">
          ${item.items.map(renderMenuItem).join("")}
        </div>
      </div>
    `;
  }

  const command = COMMAND_DEFINITIONS[item.id];
  return `
    <button
      id="menu-command-${command.id}"
      class="menu-item"
      type="button"
      data-command-id="${command.id}"
      title="${escapeHtmlValue(commandTooltip(command.id))}"
    >
      <span>${escapeHtmlValue(command.label)}</span>
      ${command.shortcut ? `<kbd>${escapeHtmlValue(command.shortcut)}</kbd>` : ""}
    </button>
  `;
}

function renderMenuBar(): string {
  return CLASSIC_MENU_GROUPS
    .map((group) => `
      <details class="menu">
        <summary>${escapeHtmlValue(group.label)}</summary>
        <div class="menu-popover">
          ${group.items.map(renderMenuItem).join("")}
        </div>
      </details>
    `)
    .join("");
}

function toolbarButtonId(commandId: CommandId): string {
  switch (commandId) {
    case "add":
      return "add-archive";
    case "extract":
      return "extract-toolbar";
    case "test":
      return "test-archive";
    case "copy":
      return "copy-toolbar";
    case "move":
      return "move-toolbar";
    case "delete":
      return "delete-toolbar";
    case "info":
      return "info-toolbar";
    default:
      return `toolbar-${commandId}`;
  }
}

function renderToolbar(): string {
  return CLASSIC_TOOLBAR_GROUPS
    .map((group) => `
      <div class="toolbar-group">
        ${group.map((commandId) => {
          const command = COMMAND_DEFINITIONS[commandId];
          return `
            <button
              id="${toolbarButtonId(commandId)}"
              class="tool-button"
              type="button"
              data-command-id="${commandId}"
              aria-label="${escapeHtmlValue(command.label)}"
              title="${escapeHtmlValue(commandTooltip(commandId))}"
              ${command.shortcut ? `aria-keyshortcuts="${escapeHtmlValue(command.shortcut.replace("Ctrl", "Control"))}"` : ""}
            >
              ${commandIcon(commandId)}
              <span class="tool-label">${escapeHtmlValue(command.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `)
    .join(`<div class="toolbar-separator" aria-hidden="true"></div>`);
}

appRoot.innerHTML = `
  <main class="workspace" data-job-drawer="closed">
    <nav class="app-menu" aria-label="Application menu">
      ${renderMenuBar()}
    </nav>

    <header class="command-toolbar mode-toolbar" role="toolbar" aria-label="Workspace modes">
      <div class="mode-switch" role="tablist" aria-label="Workspace mode">
        <button id="mode-compress" class="mode-button" type="button" role="tab" data-workspace-mode="compress">${MODE_COMPRESS_LABEL}</button>
        <button id="mode-extract" class="mode-button" type="button" role="tab" data-workspace-mode="extract">${MODE_EXTRACT_LABEL}</button>
      </div>
      <div class="legacy-command-buttons">
        ${renderToolbar()}
        <button id="open-archive" type="button" data-command-id="open" aria-label="Open archive">${toolbarIcon("open")}</button>
        <button id="new-archive" type="button" data-command-id="createFile" aria-label="New archive">${toolbarIcon("new")}</button>
        <button id="preferences-toolbar" type="button" data-command-id="options" aria-label="Options">${toolbarIcon("settings")}</button>
        <button id="jobs-drawer-open" type="button">${toolbarIcon("jobs")}<span class="tool-label">Jobs</span></button>
      </div>
      <div class="toolbar-spacer"></div>
      <p id="workspace-status" class="workspace-status">Ready</p>
    </header>

    <section class="path-bar" aria-label="Archive location">
      <button id="nav-back" type="button" disabled>Back</button>
      <button id="nav-up" class="icon-button" type="button" data-command-id="upOneLevel" disabled title="Up One Level (Backspace)" aria-label="Up One Level">${toolbarIcon("extract")}</button>
      <input id="path-field" class="path-field" type="text" aria-label="Archive path" value="${BROWSE_STATUS_EMPTY}" disabled />
      <div id="path-crumbs" class="path-crumbs" aria-live="polite" hidden>${BROWSE_STATUS_EMPTY}</div>
      <label class="search-field">
        <span class="sr-only">Search entries</span>
        <input id="search-entries" type="search" placeholder="Search archive" aria-keyshortcuts="Control+F" disabled />
      </label>
    </section>

    <section class="browser-shell" aria-label="Archive workspace">
      <aside class="navigation-pane" aria-label="Archive navigation">
        <div class="pane-header">
          <h2>Folders</h2>
        </div>
        <div id="tree-content" class="tree-content"></div>
      </aside>

      <section class="archive-table-pane" aria-label="Archive entries">
        <div class="table-pane-header">
          <div>
            <h1 id="workspace-title">${APP_TITLE}</h1>
            <p id="browse-meta">${BROWSE_STATUS_READY}</p>
          </div>
          <button id="refresh-archive" type="button" data-command-id="refresh" disabled>Refresh</button>
        </div>
        <p id="browse-message" class="status status-idle">${BROWSE_STATUS_IDLE}</p>
        <div id="compress-surface" class="compress-surface" hidden>
          <div class="compress-create-panel" aria-label="Create archive">
            <div class="compress-create-row">
              <label class="compress-destination-field">
                <span>Destination</span>
                <div class="inline-field">
                  <input id="create-destination" type="text" placeholder="Choose output archive" list="create-destination-history" />
                  <button id="browse-create-destination" type="button">...</button>
                </div>
                <datalist id="create-destination-history"></datalist>
              </label>
              <div class="compress-create-actions">
                <button id="add-source" class="secondary-action" type="button">Add Sources</button>
                <button id="clear-sources" class="quiet-action" type="button" hidden>Clear</button>
                <span class="compress-action-divider" aria-hidden="true"></span>
                <button id="create-options-open" class="secondary-action" type="button">Options</button>
                <button id="start-create" class="primary-action" type="button" disabled>Create Archive</button>
              </div>
            </div>
            <div class="compress-plan-row">
              <p id="create-plan-meta">Drop files or folders here, or add sources from disk.</p>
            </div>
          </div>
          <div class="compress-table-shell">
            <table id="compress-source-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Kind</th>
                  <th class="action-column">Action</th>
                </tr>
              </thead>
              <tbody id="compress-source-body">
                <tr>
                  <td colspan="4" class="compress-empty-cell">
                    <div class="compress-empty-state">
                      <strong>${COMPRESS_EMPTY_TABLE_MESSAGE}</strong>
                      <span>Drag files or folders anywhere in this window, or use Add Sources.</span>
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
                <h2>${BROWSE_EMPTY_STATE_TITLE}</h2>
                <p>${BROWSE_EMPTY_STATE_DESCRIPTION}</p>
              </div>
              <p class="archive-empty-hint">${BROWSE_EMPTY_STATE_DROP_HINT}</p>
            </div>
          </div>
          <table id="entry-table">
            <thead id="entry-table-head">
              <tr>
                <th class="selection-column">
                  <input id="select-all" type="checkbox" aria-label="Select visible entries" disabled />
                </th>
                <th data-sort-key="name">Name</th>
                <th data-sort-key="size" class="align-right">Size</th>
                <th data-sort-key="compressedSize" class="align-right">Packed Size</th>
                <th data-sort-key="modified">Modified</th>
              </tr>
            </thead>
            <tbody id="entry-table-body">
              <tr>
                <td colspan="5" class="empty">${BROWSE_STATUS_EMPTY}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="details-pane" aria-label="Details and actions">
        <div class="pane-header">
          <h2>Details</h2>
        </div>
        <div id="details-content" class="details-content"></div>
      </aside>
    </section>

    <footer class="status-bar" aria-live="polite">
      <span id="status-selection-count" class="status-part">0 / 0 object(s) selected</span>
      <span id="status-selection-size" class="status-part"></span>
      <span id="status-focused-size" class="status-part"></span>
      <span id="status-focused-modified" class="status-part"></span>
      <span id="status-text" class="sr-only">Ready.</span>
      <button id="status-job-button" type="button">
        <span id="active-job-text">No jobs</span>
      </button>
    </footer>

    <aside id="job-drawer" class="job-drawer" aria-label="Job details" aria-hidden="true">
      <div class="job-drawer-header">
        <div>
          <h2>Jobs</h2>
          <p>Live create, extract, preview, and test work.</p>
        </div>
        <div class="job-drawer-actions">
          <button id="refresh-jobs" type="button">Refresh</button>
          <button id="job-drawer-close" type="button">Close</button>
        </div>
      </div>
      <div id="jobs-list" class="jobs-list"></div>
    </aside>

    <section id="quick-progress" class="quick-progress" aria-label="Quick action progress" hidden>
      <div class="quick-progress-grid">
        <div class="quick-progress-metric"><span>Elapsed time:</span><strong id="quick-elapsed">00:00:00</strong></div>
        <div class="quick-progress-metric"><span>Total size:</span><strong id="quick-total-size"></strong></div>
        <div class="quick-progress-metric"><span>Remaining time:</span><strong id="quick-remaining">--:--:--</strong></div>
        <div class="quick-progress-metric"><span>Speed:</span><strong id="quick-speed"></strong></div>
        <div class="quick-progress-metric"><span>Files:</span><strong id="quick-files">0</strong></div>
        <div class="quick-progress-metric"><span>Processed:</span><strong id="quick-processed"></strong></div>
        <div class="quick-progress-metric"><span></span><strong id="quick-total-files"></strong></div>
        <div class="quick-progress-metric"><span>Compressed size:</span><strong id="quick-compressed-size"></strong></div>
        <div class="quick-progress-metric"><span></span><strong></strong></div>
        <div class="quick-progress-metric"><span>Compression ratio:</span><strong id="quick-ratio"></strong></div>
      </div>
      <div class="quick-progress-current">
        <p id="quick-operation">Starting</p>
        <p id="quick-current-path"></p>
      </div>
      <progress id="quick-progress-bar" aria-label="Quick action progress"></progress>
      <div class="quick-progress-actions">
        <button id="quick-background" type="button" disabled>Background</button>
        <button id="quick-continue" type="button" disabled>Continue</button>
        <button id="quick-cancel" type="button">Cancel</button>
      </div>
    </section>

    <div id="context-menu" class="context-menu" role="menu" hidden></div>
    <div id="drop-overlay" class="drop-overlay" aria-hidden="true">
      <div>
        <strong id="drop-overlay-title">Drop files</strong>
        <span id="drop-overlay-message">Open an archive or add files to a new archive.</span>
      </div>
    </div>

    <div id="extract-dialog" class="dialog-backdrop" hidden>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="extract-title">
        <div class="dialog-header">
          <div>
            <h2 id="extract-title">Extract</h2>
            <p id="extract-dialog-message">Choose a destination before starting.</p>
          </div>
          <button id="extract-dialog-close" class="icon-button" type="button" aria-label="Close extract dialog">Close</button>
        </div>
        <div class="dialog-body">
          <label class="field-row">
            <span>Extract to</span>
            <div class="inline-field">
              <input
                id="extract-destination"
                type="text"
                placeholder="Select a destination folder"
                list="extract-destination-history"
              />
              <datalist id="extract-destination-history"></datalist>
              <button id="browse-extract-destination" type="button">...</button>
            </div>
          </label>
          <div class="form-grid form-grid-compact">
            <label class="checkbox-row">
              <input id="extract-use-subfolder" type="checkbox" />
              <span>Extract to subfolder</span>
            </label>
            <label>
              <span>Subfolder</span>
              <input id="extract-subfolder" type="text" placeholder="Optional" />
            </label>
            <label>
              <span>Path mode</span>
              <select id="extract-path-mode">
                <option value="full">Full paths</option>
                <option value="current">Current folder</option>
                <option value="none">No paths</option>
              </select>
            </label>
            <label class="checkbox-row">
              <input id="extract-deduplicate-root" type="checkbox" />
              <span>Eliminate duplicated root folder</span>
            </label>
          </div>
          <div class="form-grid form-grid-compact">
            <label>
              <span>Overwrite policy</span>
              <select id="browse-overwrite">
                <option value="ask">Ask</option>
                <option value="refuse">Refuse</option>
                <option value="rename">Rename</option>
                <option value="replace">Replace</option>
              </select>
            </label>
            <label>
              <span>Password</span>
              <input id="browse-password" type="password" autocomplete="off" />
            </label>
            <label class="checkbox-row">
              <input id="browse-show-password" type="checkbox" />
              <span>Show Password</span>
            </label>
            <label class="checkbox-row">
              <input id="extract-restore-security" type="checkbox" disabled />
              <span>Restore file security</span>
            </label>
          </div>
          <details class="advanced-options">
            <summary>Advanced options</summary>
            <label>
              <span>Strip components</span>
              <input id="browse-strip-components" type="number" min="0" max="8" value="0" />
            </label>
          </details>
        </div>
        <div class="dialog-actions">
          <button id="extract-start" type="button">OK</button>
          <button type="button" data-command-id="helpContents">Help</button>
          <button id="extract-cancel" type="button">Cancel</button>
        </div>
      </section>
    </div>

    <div id="create-dialog" class="dialog-backdrop" hidden>
      <section class="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div class="dialog-header">
          <div>
            <h2 id="create-title">Archive Options</h2>
            <p>Format, compression, password, and archive safety settings.</p>
          </div>
          <button id="create-dialog-close" class="icon-button" type="button" aria-label="Close archive options">Close</button>
        </div>
        <div class="dialog-body">
          <ul id="source-list" class="list-box" hidden></ul>
          <div class="form-grid create-options-grid">
            <label>
              <span>Archive format</span>
              <select id="create-format">
                <option value="zip">ZIP</option>
                <option value="tarZst">TZST</option>
                <option value="tzap">TZAP</option>
                <option value="sevenZ">7Z</option>
              </select>
            </label>
            <label>
              <span>Compression level</span>
              <select id="create-compression-level">
                <option value="">Normal</option>
                <option value="0">Store</option>
                <option value="1">Fastest</option>
                <option value="3">Fast</option>
                <option value="9">Maximum</option>
                <option value="22">Ultra</option>
              </select>
            </label>
            <label>
              <span>Compression method</span>
              <select disabled>
                <option>Backend default</option>
              </select>
            </label>
            <label>
              <span>Dictionary size</span>
              <select disabled>
                <option>Auto</option>
              </select>
            </label>
            <label>
              <span>Word size</span>
              <select disabled>
                <option>Auto</option>
              </select>
            </label>
            <label>
              <span>Solid block size</span>
              <select disabled>
                <option>Auto</option>
              </select>
            </label>
            <label>
              <span>CPU threads</span>
              <select disabled>
                <option>Auto</option>
              </select>
            </label>
            <label>
              <span>Split to volumes, bytes</span>
              <input id="create-volume" type="number" min="0" placeholder="Optional" />
            </label>
            <label>
              <span>Update mode</span>
              <select disabled>
                <option>Add and replace files</option>
              </select>
            </label>
            <label>
              <span>Path mode</span>
              <select disabled>
                <option>Relative paths</option>
              </select>
            </label>
          </div>
          <div class="toggle-grid">
            <label class="toggle-line"><input id="create-clean-source" type="checkbox" /> Clean source</label>
            <label class="toggle-line"><input id="create-preserve-metadata" type="checkbox" checked /> Preserve metadata</label>
            <label class="toggle-line"><input id="create-replace-existing" type="checkbox" /> Replace existing</label>
            <label class="toggle-line"><input id="create-respect-gitignore" type="checkbox" /> Respect .gitignore</label>
          </div>
          <details class="advanced-options">
            <summary>Advanced options</summary>
            <div class="form-grid form-grid-compact">
              <label>
                <span>Enter password</span>
                <input id="create-password" type="password" autocomplete="off" />
              </label>
              <label>
                <span>Reenter password</span>
                <input id="create-password-confirm" type="password" autocomplete="off" />
              </label>
              <label class="checkbox-row">
                <input id="create-show-password" type="checkbox" />
                <span>Show Password</span>
              </label>
              <label>
                <span>Encryption method</span>
                <select disabled>
                  <option>Backend default</option>
                </select>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" disabled />
                <span>Encrypt file names</span>
              </label>
            </div>
          </details>
          <div class="plan-header">
            <div>
              <h3>Plan</h3>
              <p>Detailed inclusion preview for the staged sources.</p>
            </div>
          </div>
          <div id="create-plan-summary" class="summary-card">
            <p>No plan available yet.</p>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" data-command-id="helpContents">Help</button>
          <button id="create-cancel" type="button">Close</button>
        </div>
      </section>
    </div>

    <div id="about-dialog" class="dialog-backdrop" hidden>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div class="dialog-header">
          <div>
            <h2 id="about-title">About ZManager</h2>
            <p>Diagnostics for support and bug reports.</p>
          </div>
          <button id="about-dialog-close" class="icon-button" type="button" aria-label="Close about dialog">Close</button>
        </div>
        <div class="dialog-body">
          <div id="about-diagnostics" class="diagnostics"></div>
        </div>
        <div class="dialog-actions">
          <button id="copy-diagnostics" type="button">Copy Diagnostics</button>
          <button id="about-close" type="button">Close</button>
        </div>
      </section>
    </div>

    <div id="preferences-dialog" class="dialog-backdrop" hidden>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="preferences-title">
        <div class="dialog-header">
          <div>
            <h2 id="preferences-title">Options</h2>
            <p>Safe desktop preferences for archive workflows.</p>
          </div>
          <button id="preferences-dialog-close" class="icon-button" type="button" aria-label="Close preferences dialog">Close</button>
        </div>
        <div class="dialog-body">
          <div class="options-pages">
            <section class="options-page">
              <h3>Folders</h3>
              <div class="form-grid form-grid-compact">
                <label>
                  <span>Working/output folder</span>
                  <select id="pref-output-location">
                    <option value="sourceFolder">Current/source folder</option>
                    <option value="customFolder">Specified path</option>
                  </select>
                </label>
                <label class="span-2">
                  <span>Specified path</span>
                  <div class="inline-field">
                    <input id="pref-custom-output" type="text" placeholder="Optional folder for new archives" />
                    <button id="pref-choose-output" type="button">...</button>
                  </div>
                </label>
              </div>
            </section>
            <section class="options-page">
              <h3>Settings</h3>
              <div class="form-grid form-grid-compact">
                <label>
                  <span>Default archive format</span>
                  <select id="pref-default-format">
                    <option value="zip">ZIP</option>
                    <option value="tarZst">TZST</option>
                    <option value="tzap">TZAP</option>
                    <option value="sevenZ">7Z</option>
                  </select>
                </label>
                <label>
                  <span>Default extraction</span>
                  <select id="pref-default-extraction">
                    <option value="askEveryTime">Ask every time</option>
                    <option value="extractHere">Extract here</option>
                    <option value="extractToFolder">Extract to folder</option>
                  </select>
                </label>
                <label>
                  <span>Preview cleanup</span>
                  <select id="pref-preview-cleanup">
                    <option value="beforeNextPreview">Before next preview</option>
                    <option value="whenAppCloses">When app closes</option>
                  </select>
                </label>
              </div>
              <div class="toggle-grid">
                <label class="toggle-line"><input id="pref-show-parent" type="checkbox" /> Show .. item</label>
                <label class="toggle-line"><input id="pref-real-file-icons" type="checkbox" /> Show real file icons</label>
                <label class="toggle-line"><input id="pref-full-row-select" type="checkbox" /> Full row select</label>
                <label class="toggle-line"><input id="pref-show-grid" type="checkbox" /> Show grid lines</label>
                <label class="toggle-line"><input id="pref-single-click" type="checkbox" /> Single-click to open</label>
                <label class="toggle-line"><input id="pref-alternative-selection" type="checkbox" /> Alternative selection mode</label>
                <label class="toggle-line"><input id="pref-toolbar-visible" type="checkbox" /> Archive toolbar</label>
                <label class="toggle-line"><input id="pref-large-toolbar" type="checkbox" /> Large toolbar buttons</label>
                <label class="toggle-line"><input id="pref-toolbar-labels" type="checkbox" /> Show toolbar labels</label>
                <label class="toggle-line"><input id="pref-flat-view" type="checkbox" /> Flat view</label>
                <label class="toggle-line"><input id="pref-clean-source" type="checkbox" /> Clean source by default</label>
              </div>
            </section>
            <section class="options-page">
              <h3>Language</h3>
              <select disabled>
                <option>System default</option>
              </select>
            </section>
          </div>
          <p id="preferences-status" class="status status-idle">Preferences are stored locally and never include passwords.</p>
        </div>
        <div class="dialog-actions">
          <button id="preferences-save" type="button">Save</button>
          <button id="preferences-cancel" type="button">Cancel</button>
        </div>
      </section>
    </div>

    <div id="info-dialog" class="dialog-backdrop" hidden>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="info-title">
        <div class="dialog-header">
          <div>
            <h2 id="info-title">Info</h2>
            <p>Archive or entry details.</p>
          </div>
          <button id="info-dialog-close" class="icon-button" type="button" aria-label="Close info dialog">Close</button>
        </div>
        <div id="info-dialog-body" class="diagnostics"></div>
        <div class="dialog-actions">
          <button id="info-close" type="button">Close</button>
        </div>
      </section>
    </div>
  </main>
`;

const workspaceElement = document.querySelector<HTMLElement>(".workspace")!;
const commandToolbarElement = document.querySelector<HTMLDivElement>(".command-toolbar")!;
const modeCompressButton = document.querySelector<HTMLButtonElement>("#mode-compress")!;
const modeExtractButton = document.querySelector<HTMLButtonElement>("#mode-extract")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#workspace-status")!;
const statusTextElement = document.querySelector<HTMLSpanElement>("#status-text")!;
const statusSelectionCountElement = document.querySelector<HTMLSpanElement>("#status-selection-count")!;
const statusSelectionSizeElement = document.querySelector<HTMLSpanElement>("#status-selection-size")!;
const statusFocusedSizeElement = document.querySelector<HTMLSpanElement>("#status-focused-size")!;
const statusFocusedModifiedElement = document.querySelector<HTMLSpanElement>("#status-focused-modified")!;
const activeJobElement = document.querySelector<HTMLSpanElement>("#active-job-text")!;
const pathFieldInput = document.querySelector<HTMLInputElement>("#path-field")!;
const pathCrumbsElement = document.querySelector<HTMLDivElement>("#path-crumbs")!;
const treeContentElement = document.querySelector<HTMLDivElement>("#tree-content")!;
const detailsElement = document.querySelector<HTMLDivElement>("#details-content")!;

const openArchiveButton = document.querySelector<HTMLButtonElement>("#open-archive")!;
const newArchiveButton = document.querySelector<HTMLButtonElement>("#new-archive")!;
const addArchiveButton = document.querySelector<HTMLButtonElement>("#add-archive")!;
const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const testArchiveButton = document.querySelector<HTMLButtonElement>("#test-archive")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const jobsDrawerOpenButton = document.querySelector<HTMLButtonElement>("#jobs-drawer-open")!;
const preferencesToolbarButton = document.querySelector<HTMLButtonElement>("#preferences-toolbar")!;
const createOptionsOpenButton = document.querySelector<HTMLButtonElement>("#create-options-open")!;
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive")!;
const navBackButton = document.querySelector<HTMLButtonElement>("#nav-back")!;
const navUpButton = document.querySelector<HTMLButtonElement>("#nav-up")!;
const appMenuElement = document.querySelector<HTMLElement>(".app-menu")!;

const searchInput = document.querySelector<HTMLInputElement>("#search-entries")!;
const workspaceTitleElement = document.querySelector<HTMLHeadingElement>("#workspace-title")!;
const messageElement = document.querySelector<HTMLParagraphElement>("#browse-message")!;
const compressSurfaceElement = document.querySelector<HTMLDivElement>("#compress-surface")!;
const compressSourceBody = document.querySelector<HTMLTableSectionElement>("#compress-source-body")!;
const tableHead = document.querySelector<HTMLTableSectionElement>("#entry-table-head")!;
const tableBody = document.querySelector<HTMLTableSectionElement>("#entry-table-body")!;
const entryTable = document.querySelector<HTMLTableElement>("#entry-table")!;
const tableShellElement = document.querySelector<HTMLDivElement>(".table-shell")!;
const marqueeHitSurfaceElement = document.querySelector<HTMLDivElement>("#marquee-hit-surface")!;
const archiveTablePaneElement = document.querySelector<HTMLElement>(".archive-table-pane")!;
const archiveEmptyStateElement = document.querySelector<HTMLDivElement>("#archive-empty-state")!;
const metaElement = document.querySelector<HTMLParagraphElement>("#browse-meta")!;
let selectAllInput = document.querySelector<HTMLInputElement>("#select-all")!;

const extractDialog = document.querySelector<HTMLDivElement>("#extract-dialog")!;
const extractTitle = document.querySelector<HTMLHeadingElement>("#extract-title")!;
const extractDialogMessage = document.querySelector<HTMLParagraphElement>("#extract-dialog-message")!;
const extractStartButton = document.querySelector<HTMLButtonElement>("#extract-start")!;
const extractDestinationInput = document.querySelector<HTMLInputElement>("#extract-destination")!;
const extractDestinationHistoryList = document.querySelector<HTMLDataListElement>("#extract-destination-history")!;
const browseExtractDestinationButton = document.querySelector<HTMLButtonElement>("#browse-extract-destination")!;
const browsePasswordInput = document.querySelector<HTMLInputElement>("#browse-password")!;
const browseShowPasswordInput = document.querySelector<HTMLInputElement>("#browse-show-password")!;
const browseOverwriteSelect = document.querySelector<HTMLSelectElement>("#browse-overwrite")!;
const browseStripInput = document.querySelector<HTMLInputElement>("#browse-strip-components")!;
const extractUseSubfolderCheckbox = document.querySelector<HTMLInputElement>("#extract-use-subfolder")!;
const extractSubfolderInput = document.querySelector<HTMLInputElement>("#extract-subfolder")!;
const extractPathModeSelect = document.querySelector<HTMLSelectElement>("#extract-path-mode")!;
const extractDeduplicateRootCheckbox = document.querySelector<HTMLInputElement>("#extract-deduplicate-root")!;
const extractRestoreSecurityCheckbox = document.querySelector<HTMLInputElement>("#extract-restore-security")!;

const createDialog = document.querySelector<HTMLDivElement>("#create-dialog")!;
const addSourceButton = document.querySelector<HTMLButtonElement>("#add-source")!;
const clearSourcesButton = document.querySelector<HTMLButtonElement>("#clear-sources")!;
const sourceListElement = document.querySelector<HTMLUListElement>("#source-list")!;
const createFormatSelect = document.querySelector<HTMLSelectElement>("#create-format")!;
const createDestinationInput = document.querySelector<HTMLInputElement>("#create-destination")!;
const createDestinationHistoryList = document.querySelector<HTMLDataListElement>("#create-destination-history")!;
const browseCreateDestinationButton = document.querySelector<HTMLButtonElement>("#browse-create-destination")!;
const createCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#create-clean-source")!;
const createPreserveMetadataCheckbox = document.querySelector<HTMLInputElement>("#create-preserve-metadata")!;
const createReplaceExistingCheckbox = document.querySelector<HTMLInputElement>("#create-replace-existing")!;
const createRespectGitignoreCheckbox = document.querySelector<HTMLInputElement>("#create-respect-gitignore")!;
const createPasswordInput = document.querySelector<HTMLInputElement>("#create-password")!;
const createPasswordConfirmInput = document.querySelector<HTMLInputElement>("#create-password-confirm")!;
const createShowPasswordInput = document.querySelector<HTMLInputElement>("#create-show-password")!;
const createCompressionInput = document.querySelector<HTMLSelectElement>("#create-compression-level")!;
const createVolumeInput = document.querySelector<HTMLInputElement>("#create-volume")!;
const createPlanMeta = document.querySelector<HTMLParagraphElement>("#create-plan-meta")!;
const createPlanSummary = document.querySelector<HTMLDivElement>("#create-plan-summary")!;
const startCreateButton = document.querySelector<HTMLButtonElement>("#start-create")!;

const jobsListElement = document.querySelector<HTMLDivElement>("#jobs-list")!;
const refreshJobsButton = document.querySelector<HTMLButtonElement>("#refresh-jobs")!;
const jobDrawer = document.querySelector<HTMLElement>("#job-drawer")!;
const statusJobButton = document.querySelector<HTMLButtonElement>("#status-job-button")!;
const jobDrawerCloseButton = document.querySelector<HTMLButtonElement>("#job-drawer-close")!;
const quickProgressElement = document.querySelector<HTMLElement>("#quick-progress")!;
const quickElapsedElement = document.querySelector<HTMLElement>("#quick-elapsed")!;
const quickRemainingElement = document.querySelector<HTMLElement>("#quick-remaining")!;
const quickFilesElement = document.querySelector<HTMLElement>("#quick-files")!;
const quickTotalFilesElement = document.querySelector<HTMLElement>("#quick-total-files")!;
const quickTotalSizeElement = document.querySelector<HTMLElement>("#quick-total-size")!;
const quickSpeedElement = document.querySelector<HTMLElement>("#quick-speed")!;
const quickProcessedElement = document.querySelector<HTMLElement>("#quick-processed")!;
const quickCompressedSizeElement = document.querySelector<HTMLElement>("#quick-compressed-size")!;
const quickRatioElement = document.querySelector<HTMLElement>("#quick-ratio")!;
const quickOperationElement = document.querySelector<HTMLElement>("#quick-operation")!;
const quickCurrentPathElement = document.querySelector<HTMLElement>("#quick-current-path")!;
const quickProgressBar = document.querySelector<HTMLProgressElement>("#quick-progress-bar")!;
const quickCancelButton = document.querySelector<HTMLButtonElement>("#quick-cancel")!;
const contextMenu = document.querySelector<HTMLDivElement>("#context-menu")!;
const dropOverlay = document.querySelector<HTMLDivElement>("#drop-overlay")!;
const dropOverlayTitle = document.querySelector<HTMLElement>("#drop-overlay-title")!;
const dropOverlayMessage = document.querySelector<HTMLElement>("#drop-overlay-message")!;

const aboutDialog = document.querySelector<HTMLDivElement>("#about-dialog")!;
const aboutDiagnostics = document.querySelector<HTMLDivElement>("#about-diagnostics")!;
const copyDiagnosticsButton = document.querySelector<HTMLButtonElement>("#copy-diagnostics")!;
const preferencesDialog = document.querySelector<HTMLDivElement>("#preferences-dialog")!;
const preferencesDefaultFormatSelect = document.querySelector<HTMLSelectElement>("#pref-default-format")!;
const preferencesDefaultExtractionSelect = document.querySelector<HTMLSelectElement>("#pref-default-extraction")!;
const preferencesOutputLocationSelect = document.querySelector<HTMLSelectElement>("#pref-output-location")!;
const preferencesPreviewCleanupSelect = document.querySelector<HTMLSelectElement>("#pref-preview-cleanup")!;
const preferencesCustomOutputInput = document.querySelector<HTMLInputElement>("#pref-custom-output")!;
const preferencesChooseOutputButton = document.querySelector<HTMLButtonElement>("#pref-choose-output")!;
const preferencesCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#pref-clean-source")!;
const preferencesShowParentCheckbox = document.querySelector<HTMLInputElement>("#pref-show-parent")!;
const preferencesRealFileIconsCheckbox = document.querySelector<HTMLInputElement>("#pref-real-file-icons")!;
const preferencesShowGridCheckbox = document.querySelector<HTMLInputElement>("#pref-show-grid")!;
const preferencesFullRowSelectCheckbox = document.querySelector<HTMLInputElement>("#pref-full-row-select")!;
const preferencesSingleClickCheckbox = document.querySelector<HTMLInputElement>("#pref-single-click")!;
const preferencesAlternativeSelectionCheckbox = document.querySelector<HTMLInputElement>("#pref-alternative-selection")!;
const preferencesToolbarVisibleCheckbox = document.querySelector<HTMLInputElement>("#pref-toolbar-visible")!;
const preferencesLargeToolbarCheckbox = document.querySelector<HTMLInputElement>("#pref-large-toolbar")!;
const preferencesToolbarLabelsCheckbox = document.querySelector<HTMLInputElement>("#pref-toolbar-labels")!;
const preferencesFlatViewCheckbox = document.querySelector<HTMLInputElement>("#pref-flat-view")!;
const preferencesStatusElement = document.querySelector<HTMLParagraphElement>("#preferences-status")!;
const preferencesSaveButton = document.querySelector<HTMLButtonElement>("#preferences-save")!;
const preferencesViewElements: PreferencesViewElements = {
  defaultFormatSelect: preferencesDefaultFormatSelect,
  defaultExtractionSelect: preferencesDefaultExtractionSelect,
  outputLocationSelect: preferencesOutputLocationSelect,
  previewCleanupSelect: preferencesPreviewCleanupSelect,
  customOutputInput: preferencesCustomOutputInput,
  chooseOutputButton: preferencesChooseOutputButton,
  cleanSourceCheckbox: preferencesCleanSourceCheckbox,
  showParentFolderItemCheckbox: preferencesShowParentCheckbox,
  showRealFileIconsCheckbox: preferencesRealFileIconsCheckbox,
  showGridLinesCheckbox: preferencesShowGridCheckbox,
  fullRowSelectCheckbox: preferencesFullRowSelectCheckbox,
  singleClickOpenCheckbox: preferencesSingleClickCheckbox,
  alternativeSelectionModeCheckbox: preferencesAlternativeSelectionCheckbox,
  toolbarVisibleCheckbox: preferencesToolbarVisibleCheckbox,
  largeToolbarButtonsCheckbox: preferencesLargeToolbarCheckbox,
  showToolbarLabelsCheckbox: preferencesToolbarLabelsCheckbox,
  flatViewDefaultCheckbox: preferencesFlatViewCheckbox,
  statusElement: preferencesStatusElement,
};
const infoDialog = document.querySelector<HTMLDivElement>("#info-dialog")!;
const infoDialogBody = document.querySelector<HTMLDivElement>("#info-dialog-body")!;
const infoTitle = document.querySelector<HTMLHeadingElement>("#info-title")!;

let workspaceMode: WorkspaceDropMode = "compress";
let currentArchivePath = "";
let currentArchiveFolder = "";
let currentArchiveEntryCount = 0;
let currentArchiveTotalSize: number | null = null;
let browseState: BrowseState = "idle";
let browseError = "";
let browseEntries: ArchiveEntryDto[] = [];
let selectedEntries = new Set<string>();
let navigationHistory: string[] = [];
let appPreferences: AppPreferences = loadAppPreferences();
let systemIconDataUrls = new Map<string, string | null>();
let systemIconRequestRevision = 0;
let tableColumnSettings: ArchiveTableColumnSettings = normalizeColumnSettings({
  visibleColumnIds: appPreferences.tableVisibleColumnIds,
  columnOrderIds: appPreferences.tableColumnOrderIds,
  columnWidths: appPreferences.tableColumnWidths,
});
let sortKey: ArchiveSortKey = appPreferences.tableSortKey;
let sortAscending = appPreferences.tableSortAscending;
let isFlatView = appPreferences.flatViewDefault;
let focusedEntryPath = "";
let selectionAnchorPath = "";
let activeExtractMode: ExtractMode = "archive";
let contextEntryPath = "";
let contextSourcePath = "";
let extractDestinationHistory: string[] = [];
let createDestinationHistory: string[] = [];
const archiveTreeRootPath = "";
const expandedArchiveTreeFolders = new Set<string>([archiveTreeRootPath]);
let archiveTreeChildrenByParent = new Map<string, string[]>();

let createSources: string[] = [];
let createPlanState: CreateState = "idle";
let currentPlan: CreatePlanResponse | null = null;
let currentPlanError = "";
let planDebounce: number | null = null;
let createPlanRevision = 0;
let createSubmissionInFlight = false;
let currentPreviewCleanupRoot = "";
let currentPreviewPath = "";
let currentPreviewEntryPath = "";
let dropUnlisten: (() => void) | null = null;
let pendingNativeDragGesture: NativeDragGesture | null = null;
let pendingMarqueeSelection: MarqueeSelectionGesture | null = null;
let marqueeSelectionElement: HTMLDivElement | null = null;
let suppressNextTableClick = false;

const jobs = new Map<string, JobState>();
const jobRetryContexts = new Map<string, JobRetryContext>();
const promptedPasswordRetryJobs = new Set<string>();
let pollTimer: number | null = null;
let pollInFlight = false;
let pollAgainRequested = false;
let quickActionWindowMode: QuickActionWindowMode = "normal";
let quickActionWindowShown = false;
let quickActionAutoCloseTimer: number | null = null;
const quickActionJobIds = new Set<string>();
let latestHealthcheck: HealthcheckResponse | null = null;
let latestContract: ProjectContract | null = null;
let focusedBeforeDialog: HTMLElement | null = null;

function menuItemButton(commandId: CommandId): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`#menu-command-${commandId}`);
}

function saveTablePreferences() {
  appPreferences = {
    ...appPreferences,
    tableVisibleColumnIds: tableColumnSettings.visibleColumnIds,
    tableColumnOrderIds: tableColumnSettings.columnOrderIds,
    tableColumnWidths: tableColumnSettings.columnWidths,
    tableSortKey: sortKey,
    tableSortAscending: sortAscending,
  };
  saveAppPreferences(appPreferences);
}

function savePreferencePatch(patch: Partial<AppPreferences>) {
  appPreferences = {
    ...appPreferences,
    ...patch,
  };
  saveAppPreferences(appPreferences);
  applyPreferenceClasses();
  updateCommandState();
}

function setFlatView(nextFlatView: boolean, persistPreference: boolean) {
  isFlatView = nextFlatView;
  if (persistPreference) {
    savePreferencePatch({ flatViewDefault: nextFlatView });
  }
  renderBrowse();
}

function applySortCommand(nextSortKey: ArchiveSortKey) {
  if (nextSortKey === sortKey) {
    sortAscending = !sortAscending;
  } else {
    sortKey = nextSortKey;
    sortAscending = true;
  }

  saveTablePreferences();
  renderBrowse();
}

function closeAppWindow() {
  if (!isDesktopRuntime()) {
    setOperationalStatus("Use the browser window controls to close ZManager.");
    return;
  }

  void getCurrentWindow().close();
}

function isJobOnlyQuickActionRequest(request?: QuickActionRequestDto | null): boolean {
  return Boolean(request && [
    "compressZip",
    "compressTzap",
    "compressSevenZ",
    "compressTarZst",
    "compressCleanSource",
    "extractHere",
    "extractToFolder",
  ].includes(request.kind));
}

function hasQuickActionJobs(state: QuickActionStartupStateDto): boolean {
  return Boolean(state.quickActionJobs?.length);
}

function clearQuickActionAutoCloseTimer() {
  if (quickActionAutoCloseTimer === null) {
    return;
  }

  window.clearTimeout(quickActionAutoCloseTimer);
  quickActionAutoCloseTimer = null;
}

async function revealNormalAppWindow() {
  if (!isDesktopRuntime() || quickActionWindowShown) {
    return;
  }

  await restoreWindowGeometry();
  await getCurrentWindow().show();
  quickActionWindowShown = true;
}

async function revealQuickActionJobWindow() {
  if (!isDesktopRuntime()) {
    return;
  }

  quickActionWindowMode = "jobOnly";
  workspaceElement.dataset.quickActionMode = "job-only";
  quickProgressElement.hidden = false;
  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
  renderQuickProgress();

  if (quickActionWindowShown) {
    return;
  }

  const currentWindow = getCurrentWindow();
  await currentWindow.setMinSize(new LogicalSize(
    QUICK_ACTION_WINDOW_MIN_WIDTH_PX,
    QUICK_ACTION_WINDOW_MIN_HEIGHT_PX,
  ));
  await currentWindow.setSize(new LogicalSize(
    QUICK_ACTION_WINDOW_WIDTH_PX,
    QUICK_ACTION_WINDOW_HEIGHT_PX,
  ));
  await currentWindow.center();
  await currentWindow.show();
  quickActionWindowShown = true;
}

async function revealWindowForStartupQuickAction(state: QuickActionStartupStateDto) {
  if (
    state.launchedForQuickAction &&
    !state.error &&
    (hasQuickActionJobs(state) || isJobOnlyQuickActionRequest(state.quickAction))
  ) {
    await revealQuickActionJobWindow();
    return;
  }

  await revealNormalAppWindow();
}

function trackQuickActionJob(jobId: string) {
  if (quickActionWindowMode !== "jobOnly") {
    return;
  }

  clearQuickActionAutoCloseTimer();
  quickActionJobIds.add(jobId);
  renderQuickProgress();
}

function maybeCloseCompletedQuickActionWindow() {
  if (
    !isDesktopRuntime() ||
    quickActionWindowMode !== "jobOnly" ||
    quickActionAutoCloseTimer !== null ||
    quickActionJobIds.size === 0
  ) {
    return;
  }

  const trackedJobs: JobState[] = [];
  for (const jobId of quickActionJobIds) {
    const job = jobs.get(jobId);
    if (!job) {
      return;
    }
    trackedJobs.push(job);
  }

  if (!trackedJobs.every((job) => isTerminalJobStatus(job.snapshot.status))) {
    return;
  }

  if (!trackedJobs.every((job) => job.snapshot.status === "completed")) {
    setOperationalStatus("Quick action needs attention.");
    renderQuickProgress();
    return;
  }

  setOperationalStatus("Quick action completed.");
  renderQuickProgress();
  quickActionAutoCloseTimer = window.setTimeout(() => {
    closeAppWindow();
  }, QUICK_ACTION_AUTO_CLOSE_DELAY_MS);
}

function clearTrackedPreviewState() {
  currentPreviewCleanupRoot = "";
  currentPreviewPath = "";
  currentPreviewEntryPath = "";
}

function updateStatusBar() {
  const visibleEntries = getVisibleSelectablePaths();
  const selectedTotal = selectedEntries.size;
  const selectedBytes = getSelectedEntryDtos().reduce((total, entry) => total + (entry.size ?? 0), 0);
  const focusedEntry = focusedEntryPath ? getEntryByPath(focusedEntryPath) : null;

  statusSelectionCountElement.textContent = `${selectedTotal} / ${visibleEntries.length} object(s) selected`;
  statusSelectionSizeElement.textContent = selectedTotal > 0
    ? `Selected: ${formatBytes(selectedBytes)}`
    : "";

  statusFocusedSizeElement.textContent = focusedEntry ? `Focused: ${formatBytes(focusedEntry.size)}` : "";
  statusFocusedModifiedElement.textContent = focusedEntry ? `Modified: ${formatDate(focusedEntry.modified)}` : "";
}

function applyPreferenceClasses() {
  workspaceElement.classList.toggle("toolbar-hidden", !appPreferences.toolbarVisible);
  commandToolbarElement?.classList.toggle("large", appPreferences.largeToolbarButtons);
  commandToolbarElement?.classList.toggle("show-labels", appPreferences.showToolbarLabels);
  entryTable.classList.toggle("show-grid", appPreferences.showGridLines);
  entryTable.classList.toggle("full-row-select", appPreferences.fullRowSelect);
  entryTable.classList.toggle("single-click-open", appPreferences.singleClickOpen);
}

function formatBytes(value?: number): string {
  return formatBytesValue(value);
}

function escapeHtml(value: string): string {
  return escapeHtmlValue(value);
}

function formatJobKind(kind: JobKind): string {
  switch (kind) {
    case "zipCreate":
      return "ZIP create";
    case "zipExtract":
      return "ZIP extract";
    case "sevenZCreate":
      return "7Z create";
    case "sevenZExtract":
      return "7Z extract";
    case "rarExtract":
      return "RAR extract";
    case "tarZstdCreate":
      return "TZST create";
    case "tarZstdExtract":
      return "TZST extract";
    case "tzapCreate":
      return "TZAP create";
    case "tzapExtract":
      return "TZAP extract";
    case "archiveExtract":
      return "Archive extract";
    case "rawStreamExtract":
      return "Raw stream extract";
    case "testArchive":
      return "Archive test";
  }
}

function formatDate(value?: string): string {
  return formatDateValue(value, { emptyValue: "" });
}

function formatDurationClock(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "--:--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function quickActionOperationLabel(kind?: JobKind): string {
  switch (kind) {
    case "zipCreate":
    case "sevenZCreate":
    case "tarZstdCreate":
    case "tzapCreate":
      return "Adding";
    case "zipExtract":
    case "sevenZExtract":
    case "rarExtract":
    case "tarZstdExtract":
    case "tzapExtract":
    case "archiveExtract":
    case "rawStreamExtract":
      return "Extracting";
    case "testArchive":
      return "Testing";
    default:
      return "Starting";
  }
}

function renderQuickProgress() {
  if (quickActionWindowMode !== "jobOnly") {
    return;
  }

  const trackedJobs = Array.from(quickActionJobIds, (jobId) => jobs.get(jobId)).filter(
    (job): job is JobState => Boolean(job),
  );

  if (!trackedJobs.length) {
    quickElapsedElement.textContent = "00:00:00";
    quickRemainingElement.textContent = "--:--:--";
    quickFilesElement.textContent = "0";
    quickTotalFilesElement.textContent = "";
    quickTotalSizeElement.textContent = "";
    quickSpeedElement.textContent = "";
    quickProcessedElement.textContent = "";
    quickCompressedSizeElement.textContent = "";
    quickRatioElement.textContent = "";
    quickOperationElement.textContent = "Starting";
    quickCurrentPathElement.textContent = "";
    quickProgressBar.removeAttribute("value");
    quickProgressBar.removeAttribute("max");
    quickCancelButton.disabled = true;
    return;
  }

  const progressSnapshots = trackedJobs.map((job) => deriveJobProgress(job));
  const latestJob = trackedJobs.at(-1);
  const latestProgress = progressSnapshots.at(-1);
  const allTerminal = trackedJobs.every((job) => isTerminalJobStatus(job.snapshot.status));
  const anyActive = trackedJobs.some((job) =>
    job.snapshot.status === "queued" || job.snapshot.status === "running",
  );
  const elapsedMs = Math.max(...progressSnapshots.map((progress) => progress.elapsedMs), 0);
  const processedBytes = progressSnapshots.reduce((total, progress) => total + progress.processedBytes, 0);
  const totalBytes = progressSnapshots.every((progress) => progress.totalBytes !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.totalBytes ?? 0), 0)
    : null;
  const processedFiles = progressSnapshots.reduce((total, progress) => total + progress.processedFiles, 0);
  const remainingMs = totalBytes !== null && processedBytes > 0 && elapsedMs > 0
    ? Math.max(0, ((totalBytes - processedBytes) / (processedBytes / elapsedMs)))
    : null;
  const speedBytesPerSecond = elapsedMs > 0 && processedBytes > 0
    ? processedBytes / (elapsedMs / 1000)
    : null;
  const progressPercent = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(100, (processedBytes / totalBytes) * 100))
    : allTerminal && trackedJobs.every((job) => job.snapshot.status === "completed")
      ? 100
      : null;
  const currentFile = latestProgress?.currentFile || latestProgress?.latestStatusMessage || "";
  const operation = allTerminal
    ? latestJob?.snapshot.status === "completed"
      ? "Completed"
      : latestJob?.snapshot.status === "cancelled"
        ? "Cancelled"
        : "Failed"
    : quickActionOperationLabel(latestJob?.snapshot.kind);

  quickElapsedElement.textContent = formatDurationClock(elapsedMs);
  quickRemainingElement.textContent = formatDurationClock(remainingMs);
  quickFilesElement.textContent = String(processedFiles);
  quickTotalFilesElement.textContent = trackedJobs.length > 1 ? `/ ${trackedJobs.length} job(s)` : "";
  quickTotalSizeElement.textContent = totalBytes === null ? "" : formatBytes(totalBytes);
  quickSpeedElement.textContent = speedBytesPerSecond === null ? "" : `${formatBytes(speedBytesPerSecond)}/s`;
  quickProcessedElement.textContent = processedBytes > 0 ? formatBytes(processedBytes) : "";
  quickCompressedSizeElement.textContent = "";
  quickRatioElement.textContent = progressPercent === null ? "" : `${Math.round(progressPercent)}%`;
  quickOperationElement.textContent = operation;
  quickCurrentPathElement.textContent = currentFile;
  quickCancelButton.disabled = !anyActive;

  if (progressPercent === null) {
    quickProgressBar.removeAttribute("value");
    quickProgressBar.removeAttribute("max");
  } else {
    quickProgressBar.value = progressPercent;
    quickProgressBar.max = 100;
  }
}

function formatRatio(entry: ArchiveEntryDto): string {
  return formatCompressionRatio(entry.size, entry.compressedSize, { fractionDigits: 0 });
}

function addDetailRow(label: string, value?: string | null): string {
  if (!value) {
    return "";
  }
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
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
  return value ? "Yes" : "No";
}

function normalizeArchiveKindLabel(kind: ArchiveEntryDto["kind"]): string {
  return kind === "directory" ? "Directory" : kind;
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

  const testJobs = Array.from(jobs.entries())
    .map(([jobId, state]) => ({ jobId, state }))
    .filter((item) => {
      const context = jobRetryContexts.get(item.jobId);
      return context?.retryKind === "testArchive" && context.archivePath === currentArchivePath;
    })
    .sort((lhs, rhs) => {
      const lhsTime = Date.parse(lhs.state.snapshot.createdAt);
      const rhsTime = Date.parse(rhs.state.snapshot.createdAt);
      if (Number.isNaN(lhsTime) && Number.isNaN(rhsTime)) {
        return 0;
      }
      if (Number.isNaN(lhsTime)) {
        return 1;
      }
      if (Number.isNaN(rhsTime)) {
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
  const statusLabel = `${status[0].toUpperCase()}${status.slice(1)}`;

  if (!latestEvent?.message) {
    return `Last test: ${statusLabel}`;
  }

  if (latestEvent.message === status || latestEvent.message.length > 120) {
    return `Last test: ${statusLabel}`;
  }

  return `Last test: ${statusLabel} (${latestEvent.message})`;
}

function truncatedPathPreview(paths: string[], maxItems = 3, maxLength = 140): string | null {
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

  return `${preview.slice(0, maxLength - 1)}…`;
}

function normalizeEntryPath(path: string): string {
  return normalizeArchivePath(path);
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

function getParentPath(path: string): string {
  return getParentArchivePath(path) ?? "";
}

function suggestedCreateArchiveName(sources = createSources): string {
  return buildSuggestedCreateArchiveName(sources, createFormatSelect.value as CreateArchiveFormat);
}

function joinNativePath(parentPath: string, childName: string): string {
  const trimmedParent = parentPath.trim().replace(/[\\/]+$/, "");
  if (!trimmedParent) {
    return childName;
  }
  const separator = trimmedParent.includes("\\") ? "\\" : "/";
  return `${trimmedParent}${separator}${childName}`;
}

function suggestedCreateArchiveDefaultPath(sources = createSources): string {
  const directory =
    defaultCreateDirectory(appPreferences) ??
    commonSourceParentDirectory(sources, { nativeParentPath });
  const name = suggestedCreateArchiveName(sources);
  return directory ? joinNativePath(directory, name) : name;
}

function nativeParentPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash > 0 ? trimmed.slice(0, slash) : "";
}

function getEntryByPath(path: string): ArchiveEntryDto | null {
  const normalized = normalizeEntryPath(path);
  return browseEntries.find((entry) => normalizeEntryPath(entry.path) === normalized) ?? null;
}

function getSelectedEntryDtos(): ArchiveEntryDto[] {
  return [...selectedEntries]
    .map((path) => getEntryByPath(path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);
}

function getSelectedEntryPaths(): string[] {
  return getSelectedEntryDtos().map((entry) => entry.path);
}

function archiveFolderHasDescendants(folderPath: string): boolean {
  return browseEntries.some(
    (entry) => entry.kind !== "directory" && entryIsUnderFolder(entry.path, folderPath),
  );
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

function expandArchiveTreeFolderAndAncestors(folderPath: string) {
  let current = normalizeFolderPath(folderPath);
  while (current) {
    expandedArchiveTreeFolders.add(current);
    const parent = getParentPath(current);
    if (!parent) {
      break;
    }
    current = parent;
  }
}

function resetArchiveTreeState() {
  expandedArchiveTreeFolders.clear();
  expandedArchiveTreeFolders.add(archiveTreeRootPath);
}

function getSelectedExtractEntryPaths(): string[] {
  const extractPaths = new Set<string>();

  for (const selectedPath of selectedEntries) {
    const entry = getEntryByPath(selectedPath);
    if (!entry) {
      for (const candidate of browseEntries) {
        if (candidate.kind !== "directory" && entryIsUnderFolder(candidate.path, selectedPath)) {
          extractPaths.add(candidate.path);
        }
      }
      continue;
    }

    if (entry.kind !== "directory") {
      extractPaths.add(entry.path);
      continue;
    }

    const folderPath = normalizeFolderPath(entry.path);
    let addedDescendant = false;
    for (const candidate of browseEntries) {
      if (candidate.kind === "directory") {
        continue;
      }
      if (entryIsUnderFolder(candidate.path, folderPath)) {
        extractPaths.add(candidate.path);
        addedDescendant = true;
      }
    }

    if (!addedDescendant) {
      extractPaths.add(entry.path);
    }
  }

  return [...extractPaths];
}

function selectedNativeDragEntryPaths(entryPath: string): string[] {
  if (!selectedEntries.has(entryPath)) {
    const entry = getEntryByPath(entryPath);
    if (entry) {
      return [entry.path];
    }
    return archiveFolderHasDescendants(entryPath) ? [entryPath] : [];
  }

  return [...selectedEntries];
}

function nativeDragStripComponents(): number {
  if (isFlatView || searchInput.value.trim() || !currentArchiveFolder) {
    return 0;
  }

  return currentArchiveFolder.split("/").filter(Boolean).length;
}

function nativeDragRowAttributes(): string {
  return "";
}

function nativeDragRequestForEntry(entryPath: string, password?: string): NativeFileDragRequest | null {
  if (!currentArchivePath) {
    return null;
  }

  const entryPaths = selectedNativeDragEntryPaths(entryPath);
  if (!entryPaths.length) {
    return null;
  }

  return {
    archivePath: currentArchivePath,
    entryPaths,
    stripComponents: nativeDragStripComponents(),
    ...(password ? { password } : {}),
  };
}

async function startNativeDragOut(entryPath: string) {
  if (!currentArchivePath) {
    return;
  }

  if (!isDesktopRuntime()) {
    setOperationalStatus("Native drag-out is available in the desktop app.");
    return;
  }

  if (!selectedEntries.has(entryPath)) {
    selectedEntries = new Set([entryPath]);
    focusedEntryPath = entryPath;
    selectionAnchorPath = entryPath;
    renderBrowse();
  }

  let password = browsePasswordInput.value.trim() || undefined;
  const request = nativeDragRequestForEntry(entryPath, password);
  if (!request) {
    setOperationalStatus("Select at least one entry to drag out.");
    return;
  }

  setOperationalStatus(`Preparing ${request.entryPaths.length} item(s) for drag-out...`);

  while (true) {
    try {
      const response = await runStartNativeFileDrag(request);
      if (response.outcome === "cancelled") {
        setOperationalStatus("Drag-out cancelled.");
      } else if (response.outcome === "noDrop") {
        setOperationalStatus("Drag-out ended without a drop.");
      } else {
        setOperationalStatus(`Dragged out ${response.draggedEntries.length} item(s).`);
      }
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        const nextPassword = promptForArchivePassword(getArchivePasswordPrompt(commandError.code));
        if (!nextPassword) {
          setOperationalStatus(commandError.message);
          return;
        }
        password = nextPassword;
        const retryRequest = nativeDragRequestForEntry(entryPath, password);
        if (!retryRequest) {
          setOperationalStatus("Select at least one entry to drag out.");
          return;
        }
        Object.assign(request, retryRequest);
        continue;
      }

      setOperationalStatus(commandError?.message ?? "Unable to start native drag-out.");
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

  expandArchiveTreeFolderAndAncestors(currentFolder);
  addChildFolders(archiveTreeRootPath, 1);
  return folders;
}

function getVisibleSelectablePaths(): string[] {
  return visibleRows()
    .filter((row) => row.rowType === "entry" || row.rowType === "folder")
    .map((row) => row.path);
}

function setFolderRow(
  folderRows: Map<string, BrowserRow>,
  path: string,
  name: string,
  entry?: ArchiveEntryDto,
) {
  const existing = folderRows.get(path);
  folderRows.set(path, {
    rowType: "folder",
    path,
    name,
    entry: entry ?? (existing?.rowType === "folder" ? existing.entry : undefined),
  });
}

function buildBrowserRows(): BrowserRow[] {
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    return browseEntries
      .filter((entry) => normalizeEntryPath(entry.path).toLowerCase().includes(query))
      .map((entry) => ({
        rowType: "entry",
        path: normalizeEntryPath(entry.path),
        name: getBaseName(entry.path),
        entry,
      }));
  }

  if (isFlatView) {
    return browseEntries.map((entry) => ({
      rowType: "entry",
      path: normalizeEntryPath(entry.path),
      name: getBaseName(entry.path),
      entry,
    }));
  }

  const folder = normalizeFolderPath(currentArchiveFolder);
  const prefix = folder ? `${folder}/` : "";
  const folderRows = new Map<string, BrowserRow>();
  const entryRows: BrowserRow[] = [];

  if (folder && appPreferences.showParentFolderItem) {
    folderRows.set("..", {
      rowType: "parent",
      path: getParentPath(folder),
      name: "..",
    });
  }

  for (const entry of browseEntries) {
    const normalized = normalizeEntryPath(entry.path);
    if (!normalized) {
      continue;
    }
    if (folder && normalized !== folder && !normalized.startsWith(prefix)) {
      continue;
    }
    if (normalized === folder) {
      continue;
    }

    const remainder = folder ? normalized.slice(prefix.length) : normalized;
    if (!remainder) {
      continue;
    }

    const parts = remainder.split("/").filter(Boolean);
    if (parts.length > 1 || entry.kind === "directory") {
      const childPath = folder ? `${folder}/${parts[0]}` : parts[0];
      setFolderRow(
        folderRows,
        childPath,
        parts[0],
        entry.kind === "directory" && childPath === normalized ? entry : undefined,
      );
      continue;
    }

    entryRows.push({
      rowType: "entry",
      path: normalized,
      name: parts[0],
      entry,
    });
  }

  return [...folderRows.values(), ...entryRows];
}

function visibleRows(): BrowserRow[] {
  return sortArchiveRows(buildBrowserRows(), sortKey, sortAscending);
}

function setOperationalStatus(message: string) {
  statusElement.textContent = message;
  statusTextElement.textContent = message;
}

function setBrowseState(next: BrowseState, message = "") {
  browseState = next;
  browseError = message;

  messageElement.className = `status ${next === "loaded" ? "status-loaded" : `status-${next}`}`;
  if (message) {
    messageElement.textContent = message;
  }

  if (next === "loading") {
    setOperationalStatus("Loading archive.");
  } else if (next === "error") {
    setOperationalStatus("Failed.");
  } else {
    setOperationalStatus("Ready.");
  }

  updateCommandState();
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
    ? BROWSE_ACTION_PASSWORD_REQUIRED
    : BROWSE_ACTION_PASSWORD_INVALID;
}

function isPasswordCommandError(commandError: ReturnType<typeof asCommandError>): boolean {
  return (
    commandError?.code === COMMAND_PASSWORD_REQUIRED ||
    commandError?.code === COMMAND_INVALID_PASSWORD
  );
}

function formatEventCode(code: string): string {
  return code
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function canRetryJobWithPassword(jobId: string, state: JobState): boolean {
  return canRetryJobWithPasswordState(jobRetryContexts.has(jobId), state);
}

function updateCommandState() {
  const hasArchive = Boolean(currentArchivePath);
  const isLoading = browseState === "loading";
  const selectedCount = selectedEntries.size;
  const canUseArchive = hasArchive && !isLoading && (browseState === "loaded" || browseState === "empty");
  const canListEntries = hasArchive && !isLoading && browseState === "loaded";
  const visibleSelectableCount = getVisibleSelectablePaths().length;
  const selectedDtos = getSelectedEntryDtos();
  const commandState = selectCommandState({
    browseState,
    hasArchive,
    focusedRow: Boolean(focusedEntryPath),
    canNavigateUp: Boolean(currentArchiveFolder),
    canOpenInside: selectedDtos.length === 1 && selectedDtos[0].kind === "directory",
    selectedCount,
    visibleSelectableCount,
    mutableOperationsSupported: false,
    jobRunning: hasActiveJob(),
  });

  searchInput.disabled = !canUseArchive;
  selectAllInput.disabled = !canListEntries || visibleSelectableCount === 0;
  refreshArchiveButton.disabled = !hasArchive || isLoading;
  navBackButton.disabled = navigationHistory.length === 0;
  navUpButton.disabled = !currentArchiveFolder;

  addArchiveButton.disabled = !commandState.add.enabled;
  extractToolbarButton.disabled = !commandState.extract.enabled;
  testArchiveButton.disabled = !canUseArchive;
  infoToolbarButton.disabled = !commandState.info.enabled;

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-command-id]")) {
    const commandId = button.dataset.commandId as CommandId | undefined;
    if (!commandId) {
      continue;
    }
    const state = commandState[commandId];
    const command = COMMAND_DEFINITIONS[commandId];
    button.disabled = !state.enabled;
    button.title = state.reason ?? commandTooltip(commandId);
    button.setAttribute("aria-disabled", String(!state.enabled));
    if (commandId === "flatView") {
      button.setAttribute("aria-pressed", String(isFlatView));
    }
    if (commandId === "largeButtons") {
      button.setAttribute("aria-pressed", String(appPreferences.largeToolbarButtons));
    }
    if (commandId === "showButtonText") {
      button.setAttribute("aria-pressed", String(appPreferences.showToolbarLabels));
    }
    if (command.unsupported && !state.enabled) {
      button.dataset.unsupported = "true";
    } else {
      delete button.dataset.unsupported;
    }
  }

  applyPreferenceClasses();
  updateStatusBar();
}

function updateMeta() {
  if (!currentArchivePath) {
    metaElement.textContent = BROWSE_STATUS_READY;
    return;
  }

  const folderLabel = currentArchiveFolder ? ` > ${currentArchiveFolder}` : "";
  metaElement.textContent = `${getArchiveName(currentArchivePath, APP_TITLE)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderWorkspaceMode() {
  const isCompress = workspaceMode === "compress";
  if (isCompress) {
    renderCompressSources();
  }
  workspaceElement.dataset.mode = workspaceMode;
  modeCompressButton.classList.toggle("is-active", isCompress);
  modeExtractButton.classList.toggle("is-active", !isCompress);
  modeCompressButton.setAttribute("aria-selected", String(isCompress));
  modeExtractButton.setAttribute("aria-selected", String(!isCompress));
  modeCompressButton.setAttribute("aria-pressed", String(isCompress));
  modeExtractButton.setAttribute("aria-pressed", String(!isCompress));

  compressSurfaceElement.hidden = !isCompress;
  tableShellElement.hidden = isCompress;
  refreshArchiveButton.hidden = isCompress;
  messageElement.hidden = isCompress;

  if (isCompress) {
    workspaceTitleElement.textContent = COMPRESS_TABLE_TITLE;
    metaElement.textContent = COMPRESS_TABLE_DESCRIPTION;
    statusSelectionCountElement.textContent = `${createSources.length} source${createSources.length === 1 ? "" : "s"} staged`;
    statusSelectionSizeElement.textContent = "";
    statusFocusedSizeElement.textContent = "";
    statusFocusedModifiedElement.textContent = "";
  } else {
    workspaceTitleElement.textContent = EXTRACT_TABLE_TITLE;
    if (!currentArchivePath) {
      metaElement.textContent = EXTRACT_TABLE_DESCRIPTION;
    }
  }
}

function setWorkspaceMode(mode: WorkspaceDropMode) {
  if (workspaceMode === mode) {
    renderWorkspaceMode();
    return;
  }

  workspaceMode = mode;
  renderWorkspaceMode();
  setOperationalStatus(mode === "compress" ? "Compress mode." : "Extract mode.");
}

function renderPathBar() {
  if (!currentArchivePath) {
    pathFieldInput.value = BROWSE_STATUS_EMPTY;
    pathFieldInput.disabled = true;
    pathCrumbsElement.textContent = BROWSE_STATUS_EMPTY;
    document.title = APP_TITLE;
    return;
  }

  const archiveDisplayPath = currentArchiveFolder
    ? `${currentArchivePath}\\${currentArchiveFolder.replace(/\//g, "\\")}\\`
    : `${currentArchivePath}\\`;
  pathFieldInput.value = archiveDisplayPath;
  pathFieldInput.disabled = false;
  document.title = currentArchiveFolder
    ? `${getArchiveName(currentArchivePath, APP_TITLE)}\\${currentArchiveFolder.replace(/\//g, "\\")} - ${APP_TITLE}`
    : `${getArchiveName(currentArchivePath, APP_TITLE)} - ${APP_TITLE}`;

  const crumbs = getArchiveBreadcrumbs(currentArchiveFolder, {
    rootName: getArchiveName(currentArchivePath, APP_TITLE),
  }).flatMap((crumb, index) => {
    const button = `<button type="button" data-crumb-path="${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</button>`;
    return index === 0 ? [button] : [`<span aria-hidden="true">&gt;</span>`, button];
  });

  pathCrumbsElement.innerHTML = crumbs.join("");
}

function renderTree() {
  if (!currentArchivePath) {
    treeContentElement.innerHTML = `
      <div class="empty-pane">
        <p>No archive open.</p>
      </div>
    `;
    return;
  }

  const folders = getKnownFolderPaths();
  treeContentElement.innerHTML = folders
    .map((folder) => {
      const depth = folder.depth;
      const label = folder.name;
      const isRoot = folder.path === archiveTreeRootPath;
      const disclosure = folder.hasChildren && !isRoot
        ? `<span class="tree-disclosure" data-tree-toggle data-tree-path="${escapeHtml(folder.path)}" aria-label="${
          folder.isExpanded ? "Collapse" : "Expand"
        } ${escapeHtml(folder.name)}" aria-hidden="true">${folder.isExpanded ? "-" : "+"}</span>`
        : `<span class="tree-disclosure tree-disclosure-placeholder" aria-hidden="true"></span>`;
      const icon = archiveTreeIconDescriptor(isRoot, folder.path === currentArchiveFolder);
      const iconDataUrl = systemIconDataUrlForRequest(
        isRoot
          ? systemIconRequestForPath(currentArchivePath, false)
          : systemIconRequestForPath("folder", true),
      );
      return `
        <button
          class="tree-item ${folder.path === currentArchiveFolder ? "is-active" : ""}"
          type="button"
          data-tree-path="${escapeHtml(folder.path)}"
          style="--depth: ${depth}"
        >
          ${disclosure}
          ${renderEntryIcon(icon, "tree-icon", iconDataUrl)}
          <span class="tree-label">${escapeHtml(label)}</span>
        </button>
      `;
    })
    .join("");
}

function tableColspan(): number {
  return visibleColumns(tableColumnSettings).length + 1;
}

function tableMinimumWidth(columns = visibleColumns(tableColumnSettings)): number {
  const selectionWidth = 28;
  const columnWidth = columns.reduce((total, column) => total + column.width, 0);
  return Math.max(720, selectionWidth + columnWidth);
}

function renderTableHeader() {
  const columns = visibleColumns(tableColumnSettings);
  entryTable.style.minWidth = `${tableMinimumWidth(columns)}px`;
  tableHead.innerHTML = `
    <tr>
      <th class="selection-column">
        <input id="select-all" type="checkbox" aria-label="Select visible entries" ${browseState === "loaded" ? "" : "disabled"} />
      </th>
      ${columns.map((column) => `
        <th
          data-column-id="${column.id}"
          data-sort-key="${column.id}"
          class="${column.align !== "left" ? `align-${column.align}` : ""}"
          style="width: ${column.width}px; min-width: ${column.minWidth ?? 64}px"
          aria-sort="${sortKey === column.id ? (sortAscending ? "ascending" : "descending") : "none"}"
        >
          <span class="column-header-label">${escapeHtml(column.label)}</span>
          ${sortKey === column.id ? `<span class="sort-indicator" aria-hidden="true">${sortAscending ? "^" : "v"}</span>` : ""}
          <span class="column-resizer" data-column-resizer="${column.id}" aria-hidden="true"></span>
        </th>
      `).join("")}
    </tr>
  `;
  selectAllInput = document.querySelector<HTMLInputElement>("#select-all")!;
}

function setArchiveEmptyStateVisible(visible: boolean) {
  archiveEmptyStateElement.hidden = !visible;
  entryTable.hidden = visible;
  tableShellElement.classList.toggle("has-start-empty", visible);
}

function renderNameCell(row: BrowserRow, showFullPath: boolean): string {
  const secondaryPath = row.rowType === "entry" ? row.entry.path : row.path;
  const icon = archiveRowIconDescriptor(row);
  const iconDataUrl = systemIconDataUrlForRequest(systemIconRequestForRow(row));
  return `
    <span class="row-primary">
      ${renderEntryIcon(icon, "row-icon", iconDataUrl)}
      <span class="sr-only">${escapeHtml(icon.label)}:</span>
      <span class="row-name">${escapeHtml(row.name)}</span>
    </span>
    ${showFullPath && row.rowType === "entry" ? `<span class="row-secondary">${escapeHtml(secondaryPath)}</span>` : ""}
  `;
}

function renderCell(row: BrowserRow, column: ArchiveTableColumn, showFullPath: boolean): string {
  const className = [
    column.id === "name" ? "name-cell" : "",
    column.align !== "left" ? `align-${column.align}` : "",
  ].filter(Boolean).join(" ");

  if (column.id === "name") {
    return `<td class="${className}">${renderNameCell(row, showFullPath)}</td>`;
  }

  const entry = row.rowType === "entry" || row.rowType === "folder" ? row.entry : undefined;
  if (!entry) {
    return `<td class="${className}"></td>`;
  }

  return `<td class="${className}">${escapeHtml(formatArchiveTableValue(entry, column.id))}</td>`;
}

function renderBrowseRows() {
  renderTableHeader();
  setArchiveEmptyStateVisible(false);

  if (browseState === "loading") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan()}" class="empty">${BROWSE_STATUS_LOADING}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (browseState === "error") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan()}" class="empty">${escapeHtml(browseError || BROWSE_STATUS_UNKNOWN)}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (!currentArchivePath) {
    tableBody.innerHTML = "";
    setArchiveEmptyStateVisible(true);
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  const rows = visibleRows();
  if (!rows.length) {
    const emptyMessage = searchInput.value.trim()
      ? "No entries match the search."
      : "This folder has no visible entries.";
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan()}" class="empty">${emptyMessage}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  const selectableRows = rows.filter((row) => row.rowType === "entry" || row.rowType === "folder");
  const selectedVisibleCount = selectableRows.filter((row) => selectedEntries.has(row.path)).length;
  selectAllInput.checked = selectableRows.length > 0 && selectedVisibleCount === selectableRows.length;
  selectAllInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < selectableRows.length;

  const showFullPath = Boolean(searchInput.value.trim()) || isFlatView;
  const columns = visibleColumns(tableColumnSettings);
  const nativeDragAttributes = nativeDragRowAttributes();
  tableBody.innerHTML = rows
    .map((row) => {
      if (row.rowType === "parent") {
        return `
          <tr class="folder-row parent-row" data-folder-path="${escapeHtml(row.path)}" tabindex="0" aria-label="Open parent folder">
            <td class="selection-column"></td>
            ${columns.map((column) => renderCell(row, column, showFullPath)).join("")}
          </tr>
        `;
      }

      if (row.rowType === "folder") {
        const selected = selectedEntries.has(row.path);
        return `
          <tr
            class="folder-row ${selected ? "is-selected" : ""}"
            data-folder-path="${escapeHtml(row.path)}"
            data-entry-path="${escapeHtml(row.path)}"
            tabindex="0"
            ${nativeDragAttributes}
            aria-label="Open folder ${escapeHtml(row.name)}"
            aria-selected="${selected ? "true" : "false"}"
          >
            <td class="selection-column">
              <input
                data-entry-path="${escapeHtml(row.path)}"
                type="checkbox"
                aria-label="Select ${escapeHtml(row.name)}"
                ${selected ? "checked" : ""}
              />
            </td>
            ${columns.map((column) => renderCell(row, column, showFullPath)).join("")}
          </tr>
        `;
      }

      const selected = selectedEntries.has(row.path);
      return `
        <tr
          class="${selected ? "is-selected" : ""}"
          data-entry-path="${escapeHtml(row.path)}"
          tabindex="0"
          ${nativeDragAttributes}
          aria-selected="${selected ? "true" : "false"}"
        >
          <td class="selection-column">
            <input
              data-entry-path="${escapeHtml(row.path)}"
              type="checkbox"
              aria-label="Select ${escapeHtml(row.name)}"
              ${selected ? "checked" : ""}
            />
          </td>
          ${columns.map((column) => renderCell(row, column, showFullPath)).join("")}
        </tr>
      `;
    })
    .join("");
}

function renderDetails() {
  const selected = getSelectedEntryDtos();

  if (!currentArchivePath) {
    detailsElement.innerHTML = `
      <div class="details-empty">
        <h3>No selection</h3>
        <p>Details appear after an archive is open.</p>
      </div>
    `;
    return;
  }

  if (selected.length === 0) {
    const knownUnpackedSize = currentArchiveTotalSize !== null
      ? currentArchiveTotalSize
      : sumKnownBytes(browseEntries, (entry) => entry.size);
    const unpackedSize = knownUnpackedSize === null ? null : formatBytes(knownUnpackedSize);
    const packedSize = sumKnownBytes(browseEntries, (entry) => entry.compressedSize);
    const format = formatArchiveTypeFromPath(currentArchivePath);

    const list: string = [
      addDetailRow("Archive name", getArchiveName(currentArchivePath, APP_TITLE)),
      addDetailRow("Full path", currentArchivePath),
      addDetailRow("Format", format),
      addDetailRow("Entry count", String(currentArchiveEntryCount)),
      addDetailRow("Total unpacked size", unpackedSize),
      addDetailRow("Packed size", packedSize === null ? null : formatBytes(packedSize)),
      addDetailRow("Last test status", formatLastTestStatusForCurrentArchive()),
      addDetailRow("Folder", currentArchiveFolder || "/"),
    ].filter(Boolean).join("");

    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3 class="detail-title">
          ${renderEntryIcon(
            archiveFileIconDescriptor(currentArchivePath),
            "detail-icon",
            systemIconDataUrlForRequest(systemIconRequestForPath(currentArchivePath, false)),
          )}
          <span>${escapeHtml(getArchiveName(currentArchivePath, APP_TITLE))}</span>
        </h3>
        <dl class="detail-list">
          ${list}
        </dl>
      </div>
    `;
    return;
  }

  if (selected.length === 1) {
    const entry = selected[0];
    const created = formatDate(entry.created);
    const modified = formatDate(entry.modified);
    const packed = formatOptionalBytes(entry.compressedSize);
    const size = formatOptionalBytes(entry.size);
    const icon = archiveEntryIconDescriptor(entry);
    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3 class="detail-title">
          ${renderEntryIcon(icon, "detail-icon", systemIconDataUrlForRequest(systemIconRequestForEntry(entry)))}
          <span>${escapeHtml(getBaseName(entry.path))}</span>
        </h3>
        <dl class="detail-list">
          <div><dt>Name</dt><dd>${escapeHtml(getBaseName(entry.path))}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(normalizeArchiveKindLabel(entry.kind))}</dd></div>
          <div><dt>Path</dt><dd>${escapeHtml(entry.path)}</dd></div>
          ${addDetailRow("Size", size)}
          ${addDetailRow("Packed", packed)}
          ${addDetailRow("Modified", modified)}
          ${addDetailRow("Created", created)}
          ${addDetailRow("Attributes", entry.attributes)}
          ${addDetailRow("Method", entry.method)}
          ${addDetailRow("CRC", entry.crc)}
          ${addDetailRow("Encrypted", formatOptionalBoolean(entry.encrypted))}
          ${addDetailRow("Solid", formatOptionalBoolean(entry.solid))}
          ${addDetailRow("Link target", entry.linkTarget)}
        </dl>
      </div>
    `;
    return;
  }

  const selectedTotal = sumKnownBytes(selected, (entry) => entry.size);
  const selectedFiles = selected.filter((entry) => entry.kind !== "directory").length;
  const selectedFolders = selected.filter((entry) => entry.kind === "directory").length;
  const pathPreview = truncatedPathPreview(selected.map((entry) => entry.path));

  detailsElement.innerHTML = `
    <div class="detail-block">
        <h3>${selected.length} entries selected</h3>
      <dl class="detail-list">
        <div><dt>Selected files</dt><dd>${selectedFiles}</dd></div>
        <div><dt>Selected folders</dt><dd>${selectedFolders}</dd></div>
        ${addDetailRow("Total size", selectedTotal === null ? null : formatBytes(selectedTotal))}
        ${addDetailRow("Path preview", pathPreview)}
      </dl>
    </div>
  `;
}

function renderBrowse() {
  renderPathBar();
  renderTree();
  renderBrowseRows();
  renderDetails();
  updateMeta();
  updateCommandState();
  renderWorkspaceMode();

  if (browseState === "loaded" && selectedEntries.size > 0) {
    messageElement.textContent = `${selectedEntries.size} selected entries.`;
  }

  queueSystemIconRefresh();
}

function setCreatePlanState(state: CreateState, statusMessage = "") {
  createPlanState = state;
  currentPlanError = statusMessage;

  const hasReadyPlan = state === "ready" && currentPlan !== null;
  startCreateButton.disabled =
    createSubmissionInFlight ||
    createSources.length === 0 ||
    createDestinationInput.value.trim().length === 0 ||
    state === "loading" ||
    !hasReadyPlan;
}

function formatPlanSummary(plan: CreatePlanResponse): string {
  const warnings =
    plan.warnings.length > 0
      ? `<ul>${plan.warnings.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
      : "<p>No warnings.</p>";

  const sampleRows = plan.entries
    .slice(0, 8)
    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
    .join("");

  return `
    <div class="plan-grid">
      <p><strong>Included:</strong> ${plan.includedCount} entries - ${formatBytes(plan.totalBytes)}</p>
      <p><strong>Excluded:</strong> ${plan.excludedCount} entries - ${formatBytes(plan.excludedBytes)}</p>
      <p><strong>Warnings:</strong> ${plan.warnings.length}</p>
    </div>
    <div class="plan-list">
      <p>Included sample:</p>
      <ul>${sampleRows || "<li>(none)</li>"}</ul>
    </div>
    <div class="plan-warnings">
      ${warnings}
    </div>
  `;
}

function renderCreateSources() {
  clearSourcesButton.hidden = createSources.length === 0;
  clearSourcesButton.disabled = createSources.length === 0;

  createPlanMeta.textContent = createSources.length
    ? `${createSources.length} source${createSources.length === 1 ? "" : "s"} selected.`
    : "Drop files or folders here, or add sources from disk.";

  if (createSources.length === 0) {
    sourceListElement.innerHTML = `<li class="empty">No sources yet.</li>`;
  } else {
    sourceListElement.innerHTML = createSources
      .map(
        (path) => `
          <li data-source-path="${escapeHtml(path)}">
            <span>${escapeHtml(path)}</span>
            <button type="button" data-source-remove>Remove</button>
          </li>
        `,
      )
      .join("");
  }

  for (const button of sourceListElement.querySelectorAll<HTMLButtonElement>("[data-source-remove]")) {
    button.addEventListener("click", () => {
      const path = button.closest<HTMLElement>("li")?.dataset.sourcePath;
      if (!path) {
        return;
      }
      createSources = createSources.filter((item) => item !== path);
      renderCreateSources();
      renderCompressSources();
      queuePlanRun();
    });
  }

  setCreatePlanState(createPlanState, currentPlanError);
}

function sourceKindLabel(path: string): string {
  if (isSupportedArchivePath(path)) {
    return "Archive";
  }

  return "File or folder";
}

function renderCompressSources() {
  if (createSources.length === 0) {
    compressSourceBody.innerHTML = `
      <tr>
        <td colspan="4" class="compress-empty-cell">
          <div class="compress-empty-state">
            <strong>${COMPRESS_EMPTY_TABLE_MESSAGE}</strong>
            <span>Drag files or folders anywhere in this window, or use Add Sources.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  compressSourceBody.innerHTML = createSources
    .map((path) => `
      <tr data-source-path="${escapeHtml(path)}">
        <td class="name-cell">${escapeHtml(getPathBasename(path) || path)}</td>
        <td>${escapeHtml(nativeParentPath(path) || path)}</td>
        <td>${escapeHtml(sourceKindLabel(path))}</td>
        <td class="action-column">
          <button type="button" data-compress-source-remove="${escapeHtml(path)}">Remove</button>
        </td>
      </tr>
    `)
    .join("");

  for (const button of compressSourceBody.querySelectorAll<HTMLButtonElement>("[data-compress-source-remove]")) {
    button.addEventListener("click", () => {
      const path = button.dataset.compressSourceRemove;
      if (!path) {
        return;
      }
      createSources = createSources.filter((item) => item !== path);
      renderCreateSources();
      renderCompressSources();
      queuePlanRun();
    });
  }
}

function renderJobStatusBar() {
  activeJobElement.textContent = activeJobStatusText(jobs, formatJobKind);
}

function renderJobs() {
  jobsListElement.innerHTML = renderJobsListHtml(jobs, {
    escapeHtml,
    formatBytes,
    formatEventCode,
    formatJobKind,
    canRetryJobWithPassword,
  });
  renderJobStatusBar();
  renderQuickProgress();
}

function queuePlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }

  const revision = ++createPlanRevision;
  if (createSources.length === 0) {
    currentPlan = null;
    setCreatePlanState("idle");
    createPlanSummary.innerHTML = "<p>No sources selected.</p>";
    return;
  }

  currentPlan = null;
  setCreatePlanState("loading", "Planning selected sources...");
  createPlanSummary.innerHTML = "<p>Planning selected sources...</p>";

  planDebounce = window.setTimeout(() => {
    planDebounce = null;
    void runPlan(revision);
  }, 350);
}

function cancelQueuedPlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }
}

function refreshCreateStateAfterDestinationEdit() {
  const nextState = createStateAfterDestinationEdit(createPlanState, currentPlan !== null);
  setCreatePlanState(nextState, nextState === createPlanState ? currentPlanError : "");
}

const EXTRACT_DESTINATION_HISTORY_KEY = "zmanager.extractDestinationHistory";
const EXTRACT_DESTINATION_HISTORY_MAX = 10;
const CREATE_DESTINATION_HISTORY_KEY = "zmanager.createDestinationHistory";
const CREATE_DESTINATION_HISTORY_MAX = 10;

type ExtractPathMode = "full" | "current" | "none";

function loadStringListFromStorage(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveStringListToStorage(key: string, entries: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // Storage unavailable in restricted environments.
  }
}

function normalizeDestinationHistory(entries: string[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.trim()).filter(Boolean)));
}

function setExtractDestinationHistory(entries: string[]): string[] {
  extractDestinationHistory = normalizeDestinationHistory(entries).slice(0, EXTRACT_DESTINATION_HISTORY_MAX);
  saveStringListToStorage(EXTRACT_DESTINATION_HISTORY_KEY, extractDestinationHistory);
  return extractDestinationHistory;
}

function recordExtractDestinationHistory(destination: string): void {
  const normalized = destination.trim();
  if (!normalized) {
    return;
  }
  const trimmed = extractDestinationHistory.filter((entry) => entry !== normalized);
  setExtractDestinationHistory([normalized, ...trimmed]);
  renderExtractDestinationHistory();
}

function renderExtractDestinationHistory() {
  extractDestinationHistoryList.innerHTML = extractDestinationHistory
    .map((entry) => `<option value="${escapeHtml(entry)}"></option>`)
    .join("");
}

function loadExtractDestinationHistory() {
  extractDestinationHistory = normalizeDestinationHistory(loadStringListFromStorage(EXTRACT_DESTINATION_HISTORY_KEY));
}

function setCreateDestinationHistory(entries: string[]): string[] {
  createDestinationHistory = normalizeDestinationHistory(entries).slice(0, CREATE_DESTINATION_HISTORY_MAX);
  saveStringListToStorage(CREATE_DESTINATION_HISTORY_KEY, createDestinationHistory);
  return createDestinationHistory;
}

function recordCreateDestinationHistory(destination: string): void {
  const normalized = destination.trim();
  if (!normalized) {
    return;
  }
  const trimmed = createDestinationHistory.filter((entry) => entry !== normalized);
  setCreateDestinationHistory([normalized, ...trimmed]);
  renderCreateDestinationHistory();
}

function renderCreateDestinationHistory() {
  createDestinationHistoryList.innerHTML = createDestinationHistory
    .map((entry) => `<option value="${escapeHtml(entry)}"></option>`)
    .join("");
}

function loadCreateDestinationHistory() {
  createDestinationHistory = normalizeDestinationHistory(loadStringListFromStorage(CREATE_DESTINATION_HISTORY_KEY));
}

function getExtractPathMode(): ExtractPathMode {
  const value = extractPathModeSelect.value;
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

function resolveExtractDestination(baseDestination: string): string {
  if (!extractUseSubfolderCheckbox.checked) {
    return baseDestination.trim();
  }
  const subfolder = extractSubfolderInput.value.trim();
  return subfolder ? joinNativePath(baseDestination.trim(), subfolder) : baseDestination.trim();
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
  const value = browseOverwriteSelect.value;
  if (value === "replace" || value === "rename" || value === "ask") {
    return value;
  }

  return "refuse";
}

function parseNonNegativeInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (Number.isNaN(numeric) || numeric < 0) {
    return undefined;
  }

  return Math.floor(numeric);
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

async function openNativeDialog(options: OpenDialogOptions) {
  return openRuntimeDialog(options, setOperationalStatus);
}

async function saveNativeDialog(options: SaveDialogOptions) {
  return saveRuntimeDialog(options, setOperationalStatus);
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "button:not(:disabled)",
        "input:not(:disabled)",
        "select:not(:disabled)",
        "textarea:not(:disabled)",
        "a[href]",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);
}

function getOpenModal(): HTMLElement | null {
  for (const dialog of [extractDialog, createDialog, aboutDialog, preferencesDialog, infoDialog]) {
    if (!dialog.hidden) {
      return dialog;
    }
  }
  return null;
}

function trapModalFocus(event: KeyboardEvent, dialog: HTMLElement) {
  const focusable = getFocusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function openModal(dialog: HTMLElement, focusSelector = "button, input, select") {
  focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.hidden = false;
  const focusTarget = dialog.querySelector<HTMLElement>(focusSelector);
  focusTarget?.focus();
}

function closeModal(dialog: HTMLElement) {
  dialog.hidden = true;
  if (dialog === extractDialog) {
    browsePasswordInput.value = "";
  }
  if (dialog === createDialog) {
    createPasswordInput.value = "";
    createPasswordConfirmInput.value = "";
    createPasswordInput.type = "password";
    createPasswordConfirmInput.type = "password";
    createShowPasswordInput.checked = false;
  }
  focusedBeforeDialog?.focus();
  focusedBeforeDialog = null;
}

function openJobDrawer() {
  if (quickActionWindowMode === "jobOnly") {
    void pollJobs();
    return;
  }

  jobDrawer.setAttribute("aria-hidden", "false");
  workspaceElement.dataset.jobDrawer = "open";
  void pollJobs();
}

function closeJobDrawer() {
  if (quickActionWindowMode === "jobOnly") {
    return;
  }

  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
}

function toggleJobDrawer() {
  if (workspaceElement.dataset.jobDrawer === "open") {
    closeJobDrawer();
  } else {
    openJobDrawer();
  }
}

function hasActiveJob(): boolean {
  return Array.from(jobs.values()).some((state) =>
    state.snapshot.status === "queued" || state.snapshot.status === "running",
  );
}

function currentDropSurface(): DropIntentSurface {
  return dropSurfaceForWorkspace({ createDialogOpen: !createDialog.hidden, mode: workspaceMode });
}

function setDropOverlay(active: boolean, title = "Drop files", message = "Drop files into Compress or archives into Extract.") {
  workspaceElement.dataset.dropState = active ? "active" : "idle";
  dropOverlay.setAttribute("aria-hidden", active ? "false" : "true");
  dropOverlayTitle.textContent = title;
  dropOverlayMessage.textContent = message;
}

function dropCopyForSurface(surface: DropIntentSurface): { title: string; message: string } {
  if (surface === "create") {
    return {
      title: "Add sources",
      message: "Drop files or folders to add them to the Compress table.",
    };
  }

  if (currentArchivePath) {
    return {
      title: "Open archive",
      message: "Drop another archive to browse it, or drop files to create a new archive.",
    };
  }

  return {
    title: "Choose a mode",
    message: "Use Compress for files and folders, or Extract for an archive.",
  };
}

function setDropOverlayForSurface(surface: DropIntentSurface) {
  const copy = dropCopyForSurface(surface);
  setDropOverlay(true, copy.title, copy.message);
}

function rejectDrop(reason: string) {
  switch (reason) {
    case "emptyDrop":
      setOperationalStatus("No files were dropped.");
      break;
    case "openRequiresSingleArchive":
      setOperationalStatus("Drop one archive to open it, or use Create for multiple sources.");
      break;
    case "browseRequiresArchive":
      setOperationalStatus("Drop an archive to browse, or use New to create an archive from files.");
      break;
    default:
      setOperationalStatus("Unsupported drop.");
  }
}

function addDroppedSources(paths: string[]) {
  applyCreatePreferenceDefaults();
  addSources(paths);
  setWorkspaceMode("compress");
  createDestinationInput.focus();
  setOperationalStatus(`${paths.length} source${paths.length === 1 ? "" : "s"} added.`);
}

function handleDroppedPaths(paths: string[]) {
  setDropOverlay(false);
  const trimmedPaths = paths.map((path) => path.trim()).filter(Boolean);
  if (hasActiveJob() || createSubmissionInFlight) {
    setOperationalStatus("Finish the current job before dropping more files.");
    return;
  }

  const surface = currentDropSurface();
  const decision = classifyDropIntent(trimmedPaths, surface);
  switch (decision.kind) {
    case "openArchive":
      if (decision.extraArchivePaths?.length) {
        setOperationalStatus(
          `Opened ${decision.archivePath}; ${decision.extraArchivePaths.length} additional archive(s) were not opened.`,
        );
      }
      if (!createDialog.hidden) {
        closeModal(createDialog);
      }
      void loadArchive({ archivePath: decision.archivePath });
      break;
    case "addCreateSources":
      addDroppedSources(decision.sourcePaths);
      break;
    case "askAction": {
      const openArchive = window.confirm(
        "This drop includes archives and regular files. Open the first archive instead of creating a new archive?",
      );
      if (openArchive) {
        if (!createDialog.hidden) {
          closeModal(createDialog);
        }
        void loadArchive({ archivePath: decision.archivePaths[0] });
      } else {
        addDroppedSources([...decision.archivePaths, ...decision.sourcePaths]);
      }
      break;
    }
    case "rejectUnsupportedDrop":
      rejectDrop(decision.reason);
      break;
  }
}

function handleTauriDropEvent(event: DesktopFileDropEvent) {
  if (event.type === "enter") {
    setDropOverlayForSurface(currentDropSurface());
    return;
  }

  if (event.type === "drop") {
    handleDroppedPaths(event.paths);
    return;
  }

  if (event.type === "leave") {
    setDropOverlay(false);
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

function browserDroppedFilePath(file: File): string {
  const fileWithPath = file as File & { path?: string };
  return fileWithPath.path?.trim() || file.webkitRelativePath?.trim() || file.name;
}

function bindBrowserFileDropFallback() {
  appRoot.addEventListener("dragenter", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    setDropOverlayForSurface(currentDropSurface());
  });

  appRoot.addEventListener("dragover", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    setDropOverlayForSurface(currentDropSurface());
  });

  appRoot.addEventListener("dragleave", (event) => {
    if (isDesktopRuntime() || (event.relatedTarget instanceof Node && appRoot.contains(event.relatedTarget))) {
      return;
    }
    setDropOverlay(false);
  });

  appRoot.addEventListener("drop", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    const paths = Array.from(event.dataTransfer?.files ?? [])
      .map(browserDroppedFilePath)
      .filter(Boolean);
    handleDroppedPaths(paths);
  });
}

function navigateToFolder(folderPath: string, pushHistory = true) {
  const nextFolder = normalizeFolderPath(folderPath);
  if (nextFolder === currentArchiveFolder) {
    return;
  }

  if (pushHistory) {
    navigationHistory.push(currentArchiveFolder);
  }
  currentArchiveFolder = nextFolder;
  expandArchiveTreeFolderAndAncestors(nextFolder);
  selectedEntries.clear();
  focusedEntryPath = "";
  selectionAnchorPath = "";
  searchInput.value = "";
  renderBrowse();
  focusFirstVisibleRow();
}

function navigateBack() {
  const previous = navigationHistory.pop();
  if (previous === undefined) {
    return;
  }
  currentArchiveFolder = previous;
  expandArchiveTreeFolderAndAncestors(currentArchiveFolder);
  selectedEntries.clear();
  focusedEntryPath = "";
  selectionAnchorPath = "";
  renderBrowse();
  focusFirstVisibleRow();
}

function navigateUp() {
  if (!currentArchiveFolder) {
    return;
  }
  navigateToFolder(getParentPath(currentArchiveFolder));
}

function getTableRows(): HTMLTableRowElement[] {
  return Array.from(tableBody.querySelectorAll<HTMLTableRowElement>("tr[data-folder-path], tr[data-entry-path]"));
}

function updateSelectionByIntent(
  entryPath: string,
  options?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  const visiblePaths = getVisibleSelectablePaths();
  const intentResult = applyRowSelectionIntent({
    path: entryPath,
    visiblePaths,
    currentSelection: selectedEntries,
    anchorPath: selectionAnchorPath,
    shiftKey: Boolean(options?.shift),
    ctrlKey: Boolean(options?.ctrl),
    metaKey: Boolean(options?.meta),
  });

  selectedEntries = intentResult.selectedPaths;
  selectionAnchorPath = intentResult.anchorPath;
  focusedEntryPath = entryPath;
}

function syncVisibleSelectionUi() {
  const visiblePaths = getVisibleSelectablePaths();
  const selectedVisibleCount = visiblePaths.filter((path) => selectedEntries.has(path)).length;
  selectAllInput.checked = visiblePaths.length > 0 && selectedVisibleCount === visiblePaths.length;
  selectAllInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visiblePaths.length;

  for (const row of tableBody.querySelectorAll<HTMLTableRowElement>("tr[data-entry-path]")) {
    const path = row.dataset.entryPath ?? "";
    const selected = selectedEntries.has(path);
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-selected", String(selected));
    const checkbox = row.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (checkbox) {
      checkbox.checked = selected;
    }
  }

  renderDetails();
  updateCommandState();
}

function selectAllVisibleEntries() {
  const visiblePaths = getVisibleSelectablePaths();
  selectedEntries = selectAllVisible(visiblePaths);
  selectionAnchorPath = visiblePaths[0] ?? "";
  if (selectionAnchorPath) {
    focusedEntryPath = selectionAnchorPath;
  }
  renderBrowse();
}

function invertVisibleSelectionEntries() {
  selectedEntries = invertVisibleSelection(selectedEntries, getVisibleSelectablePaths());
  selectionAnchorPath = getVisibleSelectablePaths()[0] ?? "";
  if (selectionAnchorPath) {
    focusedEntryPath = selectionAnchorPath;
  }
  renderBrowse();
}

function selectEntriesByType(mode: "add" | "remove") {
  if (!focusedEntryPath) {
    if (selectedEntries.size > 0) {
      focusedEntryPath = getSelectedEntryPaths()[0] ?? "";
    }
  }

  if (!focusedEntryPath) {
    return;
  }

  const sameType = pathsWithSameExtension(focusedEntryPath, getVisibleSelectablePaths());
  const nextSelection = new Set(selectedEntries);

  for (const path of sameType) {
    if (mode === "add") {
      nextSelection.add(path);
    } else {
      nextSelection.delete(path);
    }
  }

  selectedEntries = nextSelection;
  renderBrowse();
}

function focusTableRow(row: HTMLTableRowElement | null) {
  if (!row) {
    return;
  }
  row.focus();
  focusedEntryPath = row.dataset.entryPath ?? "";
}

function focusFirstVisibleRow() {
  window.setTimeout(() => {
    focusTableRow(getTableRows()[0] ?? null);
  }, 0);
}

function focusRelativeTableRow(currentRow: HTMLTableRowElement, direction: 1 | -1) {
  const rows = getTableRows();
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  focusTableRow(rows[nextIndex]);
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

  selectedEntries = new Set([entryPath]);
  renderBrowse();
  void onPreviewSelectedEntry();
}

function toggleTableRowSelection(row: HTMLTableRowElement) {
  const entryPath = row.dataset.entryPath;
  if (!entryPath) {
    return;
  }

  if (selectedEntries.has(entryPath)) {
    selectedEntries.delete(entryPath);
  } else {
    selectedEntries.add(entryPath);
  }
  focusedEntryPath = entryPath;
  renderBrowse();
  focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));
}

function selectVisibleEntries() {
  selectAllVisibleEntries();
}

function clearBrowseSelection() {
  selectedEntries.clear();
  focusedEntryPath = "";
  selectionAnchorPath = "";
  renderBrowse();
}

function showContextMenu(x: number, y: number, html: string) {
  contextMenu.innerHTML = html;
  contextMenu.hidden = false;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  const rect = contextMenu.getBoundingClientRect();
  const clampedX = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4));
  const clampedY = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4));
  contextMenu.style.left = `${clampedX}px`;
  contextMenu.style.top = `${clampedY}px`;
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

function startColumnResize(event: PointerEvent, columnId: ArchiveTableColumnId) {
  const column = tableColumnById(columnId);
  if (!column) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-column");

  const startX = event.clientX;
  const startWidth = column.width;
  let latestWidth = startWidth;

  const onPointerMove = (moveEvent: PointerEvent) => {
    latestWidth = startWidth + moveEvent.clientX - startX;
    tableColumnSettings = setColumnWidth(tableColumnSettings, columnId, latestWidth);
    renderBrowseRows();
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-column");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    tableColumnSettings = setColumnWidth(tableColumnSettings, columnId, latestWidth);
    saveTablePreferences();
    renderBrowse();
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
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
  selectedEntries = new Set(
    descendantEntries.length > 0
      ? descendantEntries
      : folderEntry ? [folderEntry.path] : [],
  );
  renderBrowse();
}

function showStartupContextMenu(x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-archive"><span class="context-menu-label">${BROWSE_EMPTY_STATE_OPEN_ACTION}</span></button>
  `);
}

function showFolderContextMenu(folderPath: string, x: number, y: number, entryPath = "") {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-folder" data-folder-path="${escapeHtml(folderPath)}"><span class="context-menu-label">Open</span></button>
    <button type="button" role="menuitem" data-context-action="open-inside" ${entryPath ? "" : "disabled"}><span class="context-menu-label">Open Inside</span></button>
    <button type="button" role="menuitem" data-context-action="extract-folder" data-folder-path="${escapeHtml(folderPath)}"><span class="context-menu-label">Extract...</span></button>
    <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">Test</span></button>
    <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">Properties</span></button>
  `);
}

function showEntryContextMenu(entryPath: string, x: number, y: number) {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  if (!selectedEntries.has(entryPath)) {
    selectedEntries = new Set([entryPath]);
    selectionAnchorPath = entryPath;
    focusedEntryPath = entryPath;
    renderBrowse();
  }
  const entry = getEntryByPath(entryPath);
  const canOpenInside = entry?.kind === "directory";
  const hasSingleSelection = getSelectedEntryPaths().length === 1;
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-entry" ${!hasSingleSelection ? "disabled" : ""}><span class="context-menu-label">Open</span></button>
    <button type="button" role="menuitem" data-context-action="open-inside" ${!canOpenInside || !hasSingleSelection ? "disabled" : ""}><span class="context-menu-label">Open Inside</span></button>
    <button type="button" role="menuitem" data-context-action="open-outside" ${!hasSingleSelection ? "disabled" : ""}><span class="context-menu-label">Open Outside</span></button>
    <button type="button" role="menuitem" data-context-action="view-entry" ${!hasSingleSelection ? "disabled" : ""}><span class="context-menu-label">View</span></button>
    <button type="button" role="menuitem" data-context-action="extract" ${selectedEntries.size === 0 ? "disabled" : ""}><span class="context-menu-label">Extract...</span></button>
    <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">Test</span></button>
    <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">Properties</span></button>
    <div class="context-menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-context-action="select-by-type"><span class="context-menu-label">Select by Type</span></button>
    <button type="button" role="menuitem" data-context-action="deselect-by-type" ${selectedEntries.size === 0 ? "disabled" : ""}><span class="context-menu-label">Deselect by Type</span></button>
  `);
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
  const selectedColumnMenu = selectedColumn ? `
    <div class="context-menu-caption">Column: ${escapeHtml(selectedColumn.label)}</div>
    <button
      type="button"
      role="menuitem"
      data-context-action="move-column-left"
      data-column-id="${escapeHtml(selectedColumn.id)}"
      ${selectedColumn.id === "name" || selectedColumnIndex <= 1 ? "disabled" : ""}
    >
      <span class="context-menu-label">Move Left</span>
    </button>
    <button
      type="button"
      role="menuitem"
      data-context-action="move-column-right"
      data-column-id="${escapeHtml(selectedColumn.id)}"
      ${selectedColumn.id === "name" || selectedColumnIndex < 1 || selectedColumnIndex >= visibleColumnOrder.length - 1 ? "disabled" : ""}
    >
      <span class="context-menu-label">Move Right</span>
    </button>
    <button type="button" role="menuitem" data-context-action="narrow-column" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">Narrower</span>
    </button>
    <button type="button" role="menuitem" data-context-action="widen-column" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">Wider</span>
    </button>
    <button type="button" role="menuitem" data-context-action="reset-column-width" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">Reset Width</span>
    </button>
    <div class="context-menu-separator" role="separator"></div>
  ` : "";

  const menuRows = ARCHIVE_TABLE_COLUMNS.map((column) => {
    const isNameColumn = column.id === "name";
    const checked = isNameColumn || tableColumnSettings.visibleColumnIds.includes(column.id);
    return `
      <button
        type="button"
        class="context-check-item"
        role="menuitemcheckbox"
        aria-checked="${checked ? "true" : "false"}"
        data-context-action="toggle-column"
        data-column-id="${escapeHtml(column.id)}"
        ${isNameColumn ? 'disabled aria-disabled="true"' : ""}
      >
        <span class="context-check" aria-hidden="true"></span>
        <span class="context-menu-label">${escapeHtml(column.label)}</span>
      </button>
    `;
  }).join("");

  showContextMenu(
    x,
    y,
    `${selectedColumnMenu}${menuRows}
      <div class="context-menu-separator" role="separator"></div>
      <button type="button" role="menuitem" data-context-action="reset-columns">Reset columns</button>
    `,
  );
}
function showSourceContextMenu(sourcePath: string, x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = sourcePath;
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="reveal-source">Reveal in File Manager</button>
    <button type="button" role="menuitem" data-context-action="remove-source">Remove Source</button>
    <div class="context-menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-context-action="clear-sources">Clear All Sources</button>
  `);
}

function showAddSourcesMenu(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(rect.left, rect.bottom + 4, `
    <button type="button" role="menuitem" data-context-action="add-source-files"><span class="context-menu-label">Files...</span></button>
    <button type="button" role="menuitem" data-context-action="add-source-folder"><span class="context-menu-label">Folder...</span></button>
  `);
}

function hideContextMenu() {
  contextMenu.hidden = true;
  contextMenu.innerHTML = "";
  contextEntryPath = "";
  contextSourcePath = "";
}

function showArchiveInfo() {
  infoTitle.textContent = "Archive Info";
  const knownTotalSize = currentArchiveTotalSize !== null
    ? currentArchiveTotalSize
    : (sumKnownBytes(browseEntries, (entry) => entry.size) ?? null);
  const formattedTotalSize = knownTotalSize === null ? null : formatBytes(knownTotalSize);
  const packedSize = sumKnownBytes(browseEntries, (entry) => entry.compressedSize);

  const rows = [
    addDetailRow("Archive name", getArchiveName(currentArchivePath, APP_TITLE)),
    addDetailRow("Path", currentArchivePath),
    addDetailRow("Format", formatArchiveTypeFromPath(currentArchivePath)),
    addDetailRow("Entries", String(currentArchiveEntryCount)),
    addDetailRow("Total unpacked size", formattedTotalSize),
    addDetailRow("Packed size", packedSize === null ? null : formatBytes(packedSize)),
    addDetailRow("Last test status", formatLastTestStatusForCurrentArchive()),
  ].filter(Boolean).join("");

  infoDialogBody.innerHTML = `
    <dl class="detail-list">
      ${rows}
    </dl>
  `;
  openModal(infoDialog, "#info-close");
}

function showEntryInfo(path: string) {
  const entry = getEntryByPath(path);
  if (!entry) {
    return;
  }

  infoTitle.textContent = "Entry Info";
  const created = formatDate(entry.created);
  const modified = formatDate(entry.modified);
  const packed = formatOptionalBytes(entry.compressedSize);
  const size = formatOptionalBytes(entry.size);
  infoDialogBody.innerHTML = `
    <dl class="detail-list">
      <div><dt>Name</dt><dd>${escapeHtml(getBaseName(entry.path))}</dd></div>
      <div><dt>Path</dt><dd>${escapeHtml(entry.path)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(normalizeArchiveKindLabel(entry.kind))}</dd></div>
      ${addDetailRow("Size", size)}
      ${addDetailRow("Packed", packed)}
      ${addDetailRow("Modified", modified)}
      ${addDetailRow("Created", created)}
      ${addDetailRow("Attributes", entry.attributes)}
      ${addDetailRow("Method", entry.method)}
      ${addDetailRow("CRC", entry.crc)}
      ${addDetailRow("Encrypted", formatOptionalBoolean(entry.encrypted))}
      ${addDetailRow("Solid", formatOptionalBoolean(entry.solid))}
      ${addDetailRow("Link target", entry.linkTarget)}
      <div><dt>Ratio</dt><dd>${formatRatio(entry)}</dd></div>
    </dl>
  `;
  openModal(infoDialog, "#info-close");
}

function showCurrentInfo() {
  const selected = getSelectedEntryDtos();
  if (selected.length === 1) {
    showEntryInfo(selected[0].path);
    return;
  }
  showArchiveInfo();
}

function renderAboutDiagnostics() {
  const healthcheck = latestHealthcheck;
  const contract = latestContract;
  const shellActions =
    contract?.platformIntegration.shellActions
      .map((action) => `${action.label} (${action.quickAction})`)
      .join(", ") ?? "-";
  aboutDiagnostics.innerHTML = `
    <dl class="detail-list">
      <div><dt>Status</dt><dd>${escapeHtml(healthcheck?.status ?? "frontend-only")}</dd></div>
      <div><dt>Shell</dt><dd>${escapeHtml(healthcheck?.shell ?? "browser preview")}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(healthcheck ? `${healthcheck.engine} ${healthcheck.version}` : "unavailable")}</dd></div>
      <div><dt>Core dependency</dt><dd>${escapeHtml(contract?.coreDependency ?? "unavailable")}</dd></div>
      <div><dt>Platform</dt><dd>${escapeHtml(contract?.platformIntegration.platform ?? "unknown")}</dd></div>
      <div><dt>Explorer integration</dt><dd>${contract?.platformIntegration.explorerIntegrationEnabled ? "enabled" : "disabled"}</dd></div>
      <div><dt>Desktop actions</dt><dd>${contract?.platformIntegration.desktopActionsEnabled ? "enabled" : "disabled"}</dd></div>
      <div><dt>Extensions</dt><dd>${escapeHtml(contract?.platformIntegration.associatedExtensions.join(", ") ?? "-")}</dd></div>
      <div><dt>Shell actions</dt><dd>${escapeHtml(shellActions)}</dd></div>
    </dl>
  `;
}

function diagnosticsText(): string {
  return JSON.stringify(
    {
      app: APP_TITLE,
      healthcheck: latestHealthcheck,
      contract: latestContract,
      preferences: {
        ...appPreferences,
        customOutputFolderPath: appPreferences.customOutputFolderPath ? "(set)" : "",
      },
    },
    null,
    2,
  );
}

function syncPreferenceOutputState() {
  syncPreferenceOutputViewState(preferencesViewElements);
}

function renderPreferencesDialog() {
  renderPreferencesView(preferencesViewElements, appPreferences);
}

function collectPreferencesFromDialog(): AppPreferences {
  return collectPreferencesFromView(preferencesViewElements, appPreferences);
}

function applyCreatePreferenceDefaults() {
  createFormatSelect.value = appPreferences.defaultArchiveFormat;
  createCleanSourceCheckbox.checked = appPreferences.defaultCleanSourceEnabled;
  if (!createDestinationInput.value.trim() && createSources.length > 0) {
    createDestinationInput.value = suggestedCreateArchiveDefaultPath();
  }
  setCreatePlanState(createPlanState, currentPlanError);
}

function savePreferencesFromDialog() {
  appPreferences = collectPreferencesFromDialog();
  saveAppPreferences(appPreferences);
  isFlatView = appPreferences.flatViewDefault;
  preferencesStatusElement.textContent = "Preferences saved.";
  preferencesStatusElement.className = "status status-success";
  applyCreatePreferenceDefaults();
  applyPreferenceClasses();
  renderBrowse();
  window.setTimeout(() => closeModal(preferencesDialog), 240);
}

function openPreferencesDialog() {
  renderPreferencesDialog();
  openModal(preferencesDialog, "#pref-default-format");
}

async function onSelectPreferenceOutputFolder() {
  const selected = await openNativeDialog({
    title: "Choose default output folder",
    directory: true,
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) {
    return;
  }

  preferencesCustomOutputInput.value = selected;
}

function openExtractDialog(mode: ExtractMode) {
  if (!currentArchivePath) {
    return;
  }

  activeExtractMode = mode;
  const selectedCount = selectedEntries.size;
  extractTitle.textContent = mode === "selection" ? "Extract Selected" : "Extract Archive";
  extractDialogMessage.textContent = mode === "selection"
    ? `${selectedCount} selected entr${selectedCount === 1 ? "y" : "ies"} will be extracted.`
    : "Extract every entry in the archive.";
  extractStartButton.textContent = mode === "selection" ? "Extract Selected" : "Extract All";
  if (!extractDestinationInput.value.trim() && extractDestinationHistory[0]) {
    extractDestinationInput.value = extractDestinationHistory[0];
  }
  extractUseSubfolderCheckbox.checked = false;
  extractSubfolderInput.value = "";
  extractSubfolderInput.disabled = true;
  extractPathModeSelect.value = "full";
  extractDeduplicateRootCheckbox.checked = false;
  extractRestoreSecurityCheckbox.checked = false;
  browseShowPasswordInput.checked = false;
  browsePasswordInput.type = "password";
  renderExtractDestinationHistory();
  openModal(extractDialog, "#extract-destination");
}

function openExtractHereDialog(mode: ExtractMode) {
  const parent = nativeParentPath(currentArchivePath);
  openExtractDialog(mode);
  if (parent) {
    extractDestinationInput.value = parent;
    extractDialogMessage.textContent = mode === "selection"
      ? `Extract selected entries beside ${getArchiveName(currentArchivePath, APP_TITLE)}.`
      : `Extract archive beside ${getArchiveName(currentArchivePath, APP_TITLE)}.`;
  }
}

function showCreateWorkspace() {
  applyCreatePreferenceDefaults();
  if (!createDestinationInput.value.trim() && createDestinationHistory[0]) {
    createDestinationInput.value = createDestinationHistory[0];
  }
  setWorkspaceMode("compress");
  setCreatePlanState(createPlanState, currentPlanError);
  renderCreateSources();
  renderCompressSources();
  renderCreateDestinationHistory();
  createDestinationInput.focus();
}

function openCreateOptionsDialog() {
  setWorkspaceMode("compress");
  setCreatePlanState(createPlanState, currentPlanError);
  renderCreateSources();
  renderCompressSources();
  renderCreateDestinationHistory();
  createPasswordInput.value = "";
  createPasswordConfirmInput.value = "";
  createPasswordInput.type = "password";
  createPasswordConfirmInput.type = "password";
  createShowPasswordInput.checked = false;
  openModal(createDialog, "#create-format");
}

type LoadArchiveOptions = {
  preserveState?: boolean;
};

async function loadArchive(request: ListArchiveRequest, options: LoadArchiveOptions = {}) {
  let password = request.password?.trim();
  const preserveState = options.preserveState ?? false;
  setWorkspaceMode("extract");

  while (true) {
    const requestPayload: ListArchiveRequest = {
      archivePath: request.archivePath,
      ...(password ? { password } : {}),
    };

    setBrowseState("loading", BROWSE_STATUS_LOADING);
    renderBrowse();

    try {
      const listing = await listArchiveCommand(requestPayload);

      loadArchiveListingIntoState({
        archivePath: listing.archivePath,
        entries: listing.entries,
        entryCount: listing.entryCount,
        totalSize: listing.totalSize,
      }, { preserveState });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        !commandError ||
        (
          commandError.code !== COMMAND_PASSWORD_REQUIRED &&
          commandError.code !== COMMAND_INVALID_PASSWORD
        )
      ) {
        setBrowseState(
          "error",
          commandError
            ? `${commandError.message}${commandError.hint ? `\n${commandError.hint}` : ""}`
            : "Failed to list archive entries.",
        );
        renderBrowse();
        return;
      }

      const promptMessage = getArchivePasswordPrompt(commandError.code);
      const nextPassword = promptForArchivePassword(promptMessage);
      if (!nextPassword) {
        setBrowseState("error", commandError.message);
        renderBrowse();
        return;
      }
      password = nextPassword;
    }
  }
}

function loadArchiveListingIntoState(listing: ArchiveFixture, options: LoadArchiveOptions = {}) {
  const preserveState = options.preserveState ?? false;
  const preservedEntryPaths = preserveState ? new Set(selectedEntries) : new Set<string>();
  const preservedFocusPath = preserveState ? focusedEntryPath : "";
  const preservedNavigationHistory = preserveState ? [...navigationHistory] : [];
  const preservedFolder = preserveState ? normalizeFolderPath(currentArchiveFolder) : "";
  const preservedFlatView = preserveState ? isFlatView : false;
  const preservedSearchQuery = preserveState ? searchInput.value : "";

  clearTrackedPreviewState();
  currentArchivePath = listing.archivePath;
  browseEntries = listing.entries;
  archiveTreeChildrenByParent = buildArchiveTreeChildren(listing.entries);
  currentArchiveEntryCount = typeof listing.entryCount === "number" && Number.isFinite(listing.entryCount)
    ? listing.entryCount
    : listing.entries.length;
  currentArchiveTotalSize = typeof listing.totalSize === "number" ? listing.totalSize : null;

  if (preserveState) {
    navigationHistory = preservedNavigationHistory;
    currentArchiveFolder = preserveState && archiveFolderExists(listing.entries, preservedFolder)
      ? preservedFolder
      : "";
    searchInput.value = preservedSearchQuery;
    isFlatView = preservedFlatView;
    expandArchiveTreeFolderAndAncestors(currentArchiveFolder);
  } else {
    resetArchiveTreeState();
    currentArchiveFolder = "";
    searchInput.value = "";
    navigationHistory = [];
    isFlatView = false;
  }

  const nextSelection = new Set<string>();
  const listedPaths = new Set(
    listing.entries.map((entry) => normalizeEntryPath(entry.path)),
  );
  for (const path of preservedEntryPaths) {
    if (listedPaths.has(normalizeEntryPath(path))) {
      nextSelection.add(path);
    }
  }
  selectedEntries = nextSelection;

  const focusedEntryStillVisible = preserveState && preservedFocusPath
    ? visibleRows().some((row) => row.rowType === "entry" && row.path === normalizeEntryPath(preservedFocusPath))
    : false;
  if (focusedEntryStillVisible) {
    focusedEntryPath = normalizeEntryPath(preservedFocusPath);
    selectionAnchorPath = selectedEntries.has(focusedEntryPath)
      ? focusedEntryPath
      : "";
  } else {
    focusedEntryPath = "";
    selectionAnchorPath = selectedEntries.values().next().value ?? "";
  }

  setBrowseState(listing.entries.length > 0 ? "loaded" : "empty", "Archive loaded.");

  messageElement.textContent = listing.entries.length > 0
    ? `Loaded ${listing.entries.length} entries.`
    : "Archive is valid but contains no entries.";

  renderBrowse();
  if (focusedEntryPath) {
    const restoredFocus = tableBody.querySelector<HTMLTableRowElement>(
      `tr[data-entry-path="${CSS.escape(focusedEntryPath)}"]`,
    );
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
  if (!isLocalDevHost()) {
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

async function runPlan(revision = ++createPlanRevision) {
  const request: PlanCreateRequest = {
    sources: [...createSources],
    cleanSource: createCleanSourceCheckbox.checked,
    respectGitignore: createRespectGitignoreCheckbox.checked,
    excludeNames: [],
    excludeArchivePaths: [],
    includeArchivePaths: [],
    followSymlinks: false,
  };

  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }

  currentPlan = null;
  setCreatePlanState("loading", "Planning selected sources...");
  createPlanSummary.innerHTML = "<p>Planning selected sources...</p>";

  try {
    const result = await runPlanCreate(request);

    if (revision !== createPlanRevision) {
      return;
    }

    currentPlan = result;
    createPlanSummary.innerHTML = formatPlanSummary(result);
    setCreatePlanState("ready", "Plan generated.");
  } catch (error) {
    if (revision !== createPlanRevision) {
      return;
    }

    currentPlan = null;
    const commandError = asCommandError(error);
    const message = commandError?.message ?? "Could not create archive plan.";
    setCreatePlanState("error", message);
    createPlanSummary.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }
}

function addSources(paths: string[]) {
  const unique = new Set(createSources);
  for (const value of paths) {
    if (typeof value === "string" && value.trim()) {
      unique.add(value.trim());
    }
  }
  createSources = Array.from(unique);
  if (!createDestinationInput.value.trim()) {
    createDestinationInput.value = suggestedCreateArchiveDefaultPath();
  }
  renderCreateSources();
  renderCompressSources();
  queuePlanRun();
}

function addJobState(response: StartJobResponseDto, retryContext?: JobRetryContext) {
  jobs.set(response.jobId, createInitialJobState(response));
  trackQuickActionJob(response.jobId);

  if (retryContext) {
    jobRetryContexts.set(response.jobId, retryContext);
  }

  schedulePolling();
  renderJobs();
  openJobDrawer();
}

async function openQuickActionArchive(paths: string[]) {
  const archives = uniqueQuickActionPaths(paths);
  if (archives.length !== 1) {
    setBrowseState("error", "Open one archive at a time.");
    renderBrowse();
    return;
  }

  const archivePath = archives[0];
  if (!isSupportedArchivePath(archivePath)) {
    setBrowseState("error", `Unsupported archive: ${archivePath}`);
    renderBrowse();
    return;
  }

  await loadArchive({ archivePath });
}

async function startQuickCreate(paths: string[], format: CreateArchiveFormat, cleanSource: boolean) {
  const sources = uniqueQuickActionPaths(paths);
  if (!sources.length) {
    setOperationalStatus("Quick create needs at least one source.");
    return;
  }

  const destinationPath = buildQuickCreateDestination(
    sources,
    format,
    appPreferences,
    { nativeParentPath, joinNativePath },
  );

  if (!destinationPath) {
    setOperationalStatus("Quick create needs a destination archive path.");
    return;
  }

  setOperationalStatus("Starting quick create...");
  try {
    const response = await runStartCreate(buildStartCreateRequest({
      sources,
      destinationPath,
      format,
      cleanSource,
      replaceExisting: false,
      destinationCollisionStrategy: "rename",
      preserveMetadata: true,
    }));
    recordCreateDestinationHistory(destinationPath);
    addJobState(response);
    setOperationalStatus("Quick create started.");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? "Unable to start quick create.");
  }
}

async function openQuickCreateReview(
  paths: string[],
  format: CreateArchiveFormat,
  cleanSource: boolean,
) {
  const sources = uniqueQuickActionPaths(paths);
  if (!sources.length) {
    setOperationalStatus("Quick create needs at least one source.");
    return;
  }

  showCreateWorkspace();
  createSources = sources;
  createFormatSelect.value = format;
  createCleanSourceCheckbox.checked = cleanSource;
  createReplaceExistingCheckbox.checked = false;
  createDestinationInput.value = buildQuickCreateDestination(
    sources,
    format,
    appPreferences,
    { nativeParentPath, joinNativePath },
  );
  currentPlan = null;
  cancelQueuedPlanRun();
  renderCreateSources();
  renderCompressSources();

  setOperationalStatus("Planning quick create...");
  await runPlan();
  if (createPlanState === "ready" && currentPlan !== null) {
    setOperationalStatus("Review the archive options, then create the archive.");
  } else {
    setOperationalStatus("Quick create needs review before it can start.");
  }
}

async function openQuickExtractReview(paths: string[]) {
  const archives = uniqueQuickActionPaths(paths);
  if (archives.length !== 1) {
    setOperationalStatus("Open one archive at a time when extraction is set to ask every time.");
    return;
  }

  const archivePath = archives[0];
  if (!isSupportedArchivePath(archivePath)) {
    setOperationalStatus(`Unsupported archive: ${archivePath}`);
    return;
  }

  currentArchivePath = archivePath;
  await loadArchive({ archivePath });
  if (browseState !== "loaded" && browseState !== "empty") {
    return;
  }

  setOperationalStatus("Choose extraction options.");
  openExtractDialog("archive");
}

async function startQuickExtract(paths: string[], action: QuickActionExtractMode) {
  const archives = uniqueQuickActionPaths(paths);
  if (!archives.length) {
    setOperationalStatus("Quick extract needs at least one archive.");
    return;
  }

  for (const archivePath of archives) {
    if (!isSupportedArchivePath(archivePath)) {
      setOperationalStatus(`Unsupported archive: ${archivePath}`);
      continue;
    }

    let password: string | undefined;
    while (true) {
      try {
        const destinationPlan = quickExtractDestinationPlan(
          archivePath,
          action,
          { nativeParentPath, joinNativePath },
        );
        if (!destinationPlan.destinationPath) {
          setOperationalStatus(`Choose a destination before extracting ${archivePath}.`);
          break;
        }

        const response = await runStartExtract(buildStartExtractRequest({
          archivePath,
          destinationPath: destinationPlan.destinationPath,
          overwrite: "rename",
          destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
          stripComponents: destinationPlan.stripComponents,
          ...(password ? { password } : {}),
        }));
        recordExtractDestinationHistory(destinationPlan.destinationPath);
        addJobState(response, {
          retryKind: "extractArchive",
          archivePath,
          destinationPath: destinationPlan.destinationPath,
          overwrite: "rename",
          destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
          stripComponents: destinationPlan.stripComponents,
        });
        break;
      } catch (error) {
        const commandError = asCommandError(error);
        if (commandError && isPasswordCommandError(commandError)) {
          const nextPassword = promptForArchivePassword(getArchivePasswordPrompt(commandError.code));
          if (!nextPassword) {
            setOperationalStatus(commandError.message);
            break;
          }
          password = nextPassword;
          continue;
        }

        setOperationalStatus(commandError?.message ?? `Unable to extract ${archivePath}.`);
        if (commandError?.hint) {
          setBrowseState("error", `${commandError.message}\n${commandError.hint}`);
        }
        break;
      }
    }
  }
}

async function handleQuickActionRequest(request: QuickActionRequestDto) {
  await runQuickActionRequest(request, appPreferences, {
    openArchive: openQuickActionArchive,
    openCreateReview: openQuickCreateReview,
    startCreate: startQuickCreate,
    openExtractReview: openQuickExtractReview,
    startExtract: startQuickExtract,
  });
}

async function activateQuickActionJobs(responses: StartJobResponseDto[]) {
  if (!responses.length) {
    return;
  }

  await revealQuickActionJobWindow();
  for (const response of responses) {
    addJobState(response);
  }
  setOperationalStatus("Quick action started.");
}

async function handleStartupQuickAction() {
  if (!isDesktopRuntime()) {
    return;
  }

  let revealedWindow = false;
  try {
    while (true) {
      const state = await fetchQuickActionStartupState();
      if (!revealedWindow) {
        await revealWindowForStartupQuickAction(state);
        revealedWindow = true;
      }
      await handleQuickActionStartupState(state);
      if (!state.launchedForQuickAction || state.error) {
        break;
      }
    }
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, "Unable to read quick-action startup state."));
    if (!revealedWindow) {
      await revealNormalAppWindow();
    }
  }
}

async function handleQuickActionStartupState(state: QuickActionStartupStateDto) {
  if (!state.launchedForQuickAction) {
    return;
  }

  if (state.error) {
    setOperationalStatus(state.error.message);
    if (state.error.hint) {
      setBrowseState("error", `${state.error.message}\n${state.error.hint}`);
    }
    return;
  }

  if (state.quickActionJobs?.length) {
    await activateQuickActionJobs(state.quickActionJobs);
    return;
  }

  if (state.quickAction) {
    const startupStatus = state.quickAction.kind === "open"
      ? "Opening archive..."
      : "Starting quick action...";
    setOperationalStatus(startupStatus);
    await handleQuickActionRequest(state.quickAction);
  }
}

async function bindQuickActionLaunchEvents() {
  if (!isDesktopRuntime()) {
    return;
  }

  await listen<QuickActionStartupStateDto>("zmanager-quick-action", (event) => {
    void handleQuickActionStartupState(event.payload);
  });
}

async function initializeDesktopRuntime() {
  if (!isDesktopRuntime()) {
    return;
  }

  await bindQuickActionLaunchEvents();
  await handleStartupQuickAction();
}

async function startPasswordRetryJob(context: JobRetryContext, password: string) {
  if (context.retryKind === "testArchive") {
    return runTestArchive({
      archivePath: context.archivePath,
      password,
    });
  }

  return runStartExtract(buildStartExtractRequest({
    archivePath: context.archivePath,
    destinationPath: context.destinationPath,
    overwrite: context.overwrite,
    destinationCollisionStrategy: context.destinationCollisionStrategy,
    entryPaths: context.entryPaths,
    stripComponents: context.stripComponents,
    password,
  }));
}

async function retryJobWithPasswordPrompt(jobId: string) {
  const state = jobs.get(jobId);
  const context = jobRetryContexts.get(jobId);
  if (!state || !context) {
    setOperationalStatus("Retry is unavailable for this job.");
    return;
  }

  const failure = getLatestPasswordFailureEvent(state);
  if (!failure?.code) {
    setOperationalStatus("Retry is unavailable for this job.");
    return;
  }

  const password = promptForArchivePassword(getArchivePasswordPrompt(failure.code));
  if (!password) {
    setOperationalStatus("Password retry cancelled.");
    return;
  }

  try {
    const response = await startPasswordRetryJob(context, password);
    addJobState(response, context);
    setOperationalStatus("Password retry started.");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? "Unable to start password retry.");
  }
}

async function maybePromptForJobPasswordRetry(jobId: string, state: JobState) {
  if (
    promptedPasswordRetryJobs.has(jobId) ||
    !canRetryJobWithPassword(jobId, state)
  ) {
    return;
  }

  promptedPasswordRetryJobs.add(jobId);
  await retryJobWithPasswordPrompt(jobId);
}

async function pollJobs() {
  if (pollInFlight) {
    pollAgainRequested = true;
    return;
  }

  const pollableJobs = Array.from(jobs.values()).filter((state) => !state.snapshot.canDismiss);
  if (!pollableJobs.length) {
    stopPolling();
    renderJobs();
    maybeCloseCompletedQuickActionWindow();
    return;
  }

  pollInFlight = true;
  try {
    await Promise.all(
      pollableJobs.map(async (state) => {
        const jobId = state.snapshot.jobId;
        try {
          const snapshot = await pollJobEventsCommand({ jobId });

          jobs.set(jobId, mergePolledJobState(jobs.get(jobId), snapshot));

          const updated = jobs.get(jobId);
          if (updated) {
            await maybePromptForJobPasswordRetry(jobId, updated);
          }
        } catch (error) {
          const commandError = asCommandError(error);
          if (commandError?.code === "not_found") {
            jobs.delete(jobId);
            jobRetryContexts.delete(jobId);
            promptedPasswordRetryJobs.delete(jobId);
          }
        }
      }),
    );

    renderJobs();
    maybeCloseCompletedQuickActionWindow();
  } finally {
    pollInFlight = false;
    if (pollAgainRequested) {
      pollAgainRequested = false;
      void pollJobs();
    }
  }
}

function schedulePolling() {
  if (pollTimer !== null) {
    return;
  }

  pollTimer = window.setInterval(() => {
    void pollJobs();
  }, JOB_POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer === null) {
    return;
  }
  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function onOpenArchive() {
  const selected = await openNativeDialog({
    title: "Open archive",
    directory: false,
    multiple: false,
    filters: [ARCHIVE_OPEN_FILTER],
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  clearTrackedPreviewState();
  currentArchivePath = selected;
  await loadArchive({ archivePath: selected });
}

async function onTestArchive() {
  if (!currentArchivePath) {
    return;
  }

  let password = browsePasswordInput.value.trim() || undefined;

  while (true) {
    try {
      const response = await runTestArchive({
        archivePath: currentArchivePath,
        ...(password ? { password } : {}),
      });
      addJobState(response, {
        retryKind: "testArchive",
        archivePath: currentArchivePath,
      });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (!commandError) {
        setBrowseState("error", "Unable to start archive test.");
        return;
      }

      if (
        commandError.code === COMMAND_PASSWORD_REQUIRED ||
        commandError.code === COMMAND_INVALID_PASSWORD
      ) {
        const promptMessage = getArchivePasswordPrompt(commandError.code);
        const nextPassword = promptForArchivePassword(promptMessage);
        if (!nextPassword) {
          setBrowseState("error", commandError.message);
          return;
        }
        password = nextPassword;
        continue;
      }

      setBrowseState("error", `${commandError.message}${commandError.hint ? `\n${commandError.hint}` : ""}`);
      return;
    }
  }
}

async function onDeleteTemporaryFiles() {
  if (!isDesktopRuntime()) {
    setOperationalStatus("Temporary cleanup is available in desktop mode only.");
    return;
  }

  if (!currentPreviewCleanupRoot && !currentPreviewPath) {
    setOperationalStatus("No temporary preview files are currently tracked.");
    return;
  }

  try {
    await cleanupPreviewRoots();
    clearTrackedPreviewState();
    setOperationalStatus("Deleted temporary preview files.");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? "Unable to delete temporary preview files.");
  }
}

type WindowGeometry = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
};

const WINDOW_GEOMETRY_KEY = "zmanager.windowGeometry";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readJsonFromStorage<T>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJsonToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable in restricted environments.
  }
}

function loadWindowGeometryFromStorage(): WindowGeometry | null {
  const parsed = readJsonFromStorage<WindowGeometry>(WINDOW_GEOMETRY_KEY);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const rawWidth = (parsed as { width?: unknown }).width;
  const rawHeight = (parsed as { height?: unknown }).height;
  if (!isFiniteNumber(rawWidth) || !isFiniteNumber(rawHeight)) {
    return null;
  }

  const geometry: WindowGeometry = {
    width: Math.max(APP_MIN_WINDOW_WIDTH_PX, Math.floor(rawWidth)),
    height: Math.max(APP_MIN_WINDOW_HEIGHT_PX, Math.floor(rawHeight)),
  };

  const x = (parsed as { x?: unknown }).x;
  const y = (parsed as { y?: unknown }).y;
  if (isFiniteNumber(x)) {
    geometry.x = Math.floor(x);
  }
  if (isFiniteNumber(y)) {
    geometry.y = Math.floor(y);
  }

  return geometry;
}

function saveWindowGeometryToStorage(geometry: WindowGeometry): void {
  if (!isFiniteNumber(geometry.width) || !isFiniteNumber(geometry.height)) {
    return;
  }
  saveJsonToStorage(WINDOW_GEOMETRY_KEY, geometry);
}

async function restoreWindowGeometry(): Promise<void> {
  if (!isDesktopRuntime()) {
    return;
  }

  const geometry = loadWindowGeometryFromStorage();
  if (!geometry) {
    return;
  }

  const currentWindow = getCurrentWindow();
  if (geometry.width && geometry.height) {
    await currentWindow.setSize(new LogicalSize(geometry.width, geometry.height));
  }
  if (isFiniteNumber(geometry.x) && isFiniteNumber(geometry.y)) {
    await currentWindow.setPosition(new LogicalPosition(geometry.x, geometry.y));
  }
}

async function persistWindowGeometry(): Promise<void> {
  if (!isDesktopRuntime() || quickActionWindowMode === "jobOnly") {
    return;
  }

  const currentWindow = getCurrentWindow();
  const size = await currentWindow.innerSize();
  const position = await currentWindow.innerPosition();

  const width = Math.floor(size.width);
  const height = Math.floor(size.height);
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);

  saveWindowGeometryToStorage({
    width,
    height,
    x,
    y,
  });
}

async function applyPreviewCleanupPolicyBeforeNextPreview(): Promise<void> {
  if (
    appPreferences.previewCleanupPolicy !== "beforeNextPreview" ||
    !currentPreviewCleanupRoot
  ) {
    return;
  }

  try {
    await cleanupPreviewRoots();
    clearTrackedPreviewState();
  } catch {
    // Best effort cleanup only.
  }
}

function applyCleanupOnAppClose(): void {
  if (!isDesktopRuntime()) {
    return;
  }

  void persistWindowGeometry();
  if (appPreferences.previewCleanupPolicy === "whenAppCloses") {
    void cleanupPreviewRoots();
  }
}

function bindWindowLifecycleHandlers(): void {
  window.addEventListener("pagehide", applyCleanupOnAppClose);
  window.addEventListener("beforeunload", applyCleanupOnAppClose);
}

async function onRefreshArchive() {
  if (!currentArchivePath) {
    return;
  }

  await loadArchive({
    archivePath: currentArchivePath,
    ...(browsePasswordInput.value.trim() ? { password: browsePasswordInput.value.trim() } : {}),
  }, {
    preserveState: true,
  });
}

async function onSelectDestinationForExtract() {
  const selected = await openNativeDialog({
    title: "Choose extract destination",
    directory: true,
    multiple: false,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  extractDestinationInput.value = selected;
}

async function startExtract(destinationMode: ExtractMode) {
  if (!currentArchivePath) {
    return;
  }

  const destination = resolveExtractDestination(extractDestinationInput.value);
  if (!destination) {
    extractDialogMessage.textContent = "Choose an extract destination folder first.";
    extractDestinationInput.focus();
    return;
  }

  const overwrite = getOverwritePolicyValue();
  const stripComponentsBase = toNumberOrUndefined(browseStripInput.value) ?? 0;
  const pathMode = getExtractPathMode();
  const deduplicateRoot = extractDeduplicateRootCheckbox.checked;
  let password = browsePasswordInput.value.trim() || undefined;

  if (destinationMode === "archive") {
    const stripComponents = resolveExtractStripComponents(
      stripComponentsBase,
      pathMode,
      browseEntries.map((entry) => entry.path),
      deduplicateRoot,
    );

    while (true) {
      try {
        const response = await runStartExtract(buildStartExtractRequest({
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          stripComponents,
          password,
        }));
        recordExtractDestinationHistory(destination);
        closeModal(extractDialog);
        addJobState(response, {
          retryKind: "extractArchive",
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          entryPaths: undefined,
          stripComponents,
        });
        return;
      } catch (error) {
        const commandError = asCommandError(error);
        if (
          commandError?.code === COMMAND_PASSWORD_REQUIRED ||
          commandError?.code === COMMAND_INVALID_PASSWORD
        ) {
          const promptMessage = getArchivePasswordPrompt(commandError.code);
          const nextPassword = promptForArchivePassword(promptMessage);
          if (!nextPassword) {
            setBrowseState("error", commandError.message);
            return;
          }
          password = nextPassword;
          continue;
        }
        setBrowseState("error", commandError?.message ?? "Unable to start extraction.");
        return;
      }
    }
  }

  const entries = getSelectedExtractEntryPaths();
  if (!entries.length) {
    extractDialogMessage.textContent = "Select at least one entry to extract.";
    return;
  }
  const stripComponents = resolveExtractStripComponents(
    stripComponentsBase,
    pathMode,
    entries,
    deduplicateRoot,
  );

  while (true) {
    try {
      const response = await runStartExtract(buildStartExtractRequest({
        archivePath: currentArchivePath,
        destinationPath: destination,
        overwrite,
        entryPaths: entries,
        stripComponents,
          password,
      }));
      recordExtractDestinationHistory(destination);
      closeModal(extractDialog);
      addJobState(response, {
        retryKind: "extractArchive",
        archivePath: currentArchivePath,
        destinationPath: destination,
        overwrite,
        entryPaths: entries,
        stripComponents,
      });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        const promptMessage = getArchivePasswordPrompt(commandError.code);
        const nextPassword = promptForArchivePassword(promptMessage);
        if (!nextPassword) {
          setBrowseState("error", commandError.message);
          return;
        }
        password = nextPassword;
        continue;
      }
      setBrowseState("error", commandError?.message ?? "Unable to extract selected entries.");
      return;
    }
  }
}

async function onPreviewSelectedEntry() {
  await runPreviewSelectedEntry(false);
}

async function onOpenOutsideSelectedEntry() {
  await runPreviewSelectedEntry(true);
}

async function runPreviewSelectedEntry(openOutside: boolean) {
  if (!currentArchivePath) {
    return;
  }

  await applyPreviewCleanupPolicyBeforeNextPreview();

  const selected = getSelectedEntryPaths();
  if (selected.length !== 1) {
    setOperationalStatus(SINGLE_FILE_REQUIRED_MESSAGE);
    return;
  }
  const selectedEntry = getEntryByPath(selected[0]);
  if (!selectedEntry) {
    setOperationalStatus(SINGLE_FILE_REQUIRED_MESSAGE);
    return;
  }

  if (selectedEntry.kind === "directory") {
    setOperationalStatus(SINGLE_FILE_REQUIRED_MESSAGE);
    return;
  }

  if (openOutside && currentPreviewEntryPath === selected[0] && currentPreviewPath) {
    try {
      await openDesktopPath(currentPreviewPath);
      setBrowseState("loaded", "Opened outside (cached preview).");
      renderBrowse();
      return;
    } catch (error) {
      clearTrackedPreviewState();
    }
  }

  const overwrite = getOverwritePolicyValue();
  const stripComponents = toNumberOrUndefined(browseStripInput.value) ?? 0;
  let password = browsePasswordInput.value.trim() || undefined;

  while (true) {
    try {
      const response = await runPreviewEntry({
        archivePath: currentArchivePath,
        entryPath: selected[0],
        overwrite,
        stripComponents,
        ...(password ? { password } : {}),
      });

      await openDesktopPath(response.previewPath);
      currentPreviewCleanupRoot = response.cleanupRoot;
      currentPreviewPath = response.previewPath;
      currentPreviewEntryPath = selected[0];
      if (openOutside) {
        setBrowseState("loaded", `Opened outside: ${formatBytes(response.writtenBytes)}.`);
      } else {
        setBrowseState("loaded", `Preview ready: ${formatBytes(response.writtenBytes)}.`);
      }
      renderBrowse();
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        const promptMessage = getArchivePasswordPrompt(commandError.code);
        const nextPassword = promptForArchivePassword(promptMessage);
        if (!nextPassword) {
          setBrowseState("error", commandError.message);
          return;
        }
        password = nextPassword;
        continue;
      }

      setBrowseState("error", commandError?.message ?? "Unable to preview entry.");
      return;
    }
  }
}

async function addSourcePathsFromDialog(mode: "files" | "folder") {
  const selected = await openNativeDialog({
    title: mode === "files" ? "Add source files" : "Add source folder",
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
  const selected = await saveNativeDialog({
    title: "Choose destination archive",
    defaultPath: createDestinationInput.value.trim()
      ? withCreateArchiveExtension(
          createDestinationInput.value,
          createFormatSelect.value as CreateArchiveFormat,
        )
      : suggestedCreateArchiveDefaultPath(),
    filters: CREATE_ARCHIVE_FILTERS,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }
  createDestinationInput.value = withCreateArchiveExtension(
    selected,
    createFormatSelect.value as CreateArchiveFormat,
  );
  refreshCreateStateAfterDestinationEdit();
}

async function runCreate(
  options: { destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"] } = {},
) {
  if (createSubmissionInFlight) {
    return;
  }

  if (!createSources.length) {
    return;
  }

  const format = createFormatSelect.value as CreateArchiveFormat;
  const destinationPath = withCreateArchiveExtension(createDestinationInput.value, format);
  if (!destinationPath) {
    setCreatePlanState("error", "Pick a destination archive path.");
    return;
  }
  createDestinationInput.value = destinationPath;

  if (createPlanState !== "ready" || currentPlan === null) {
    setCreatePlanState("error", "Refresh the plan before creating.");
    return;
  }

  const cleanSource = createCleanSourceCheckbox.checked;
  const replaceExisting = createReplaceExistingCheckbox.checked;
  const preserveMetadata = createPreserveMetadataCheckbox.checked;
  const passwordValue = createPasswordInput.value.trim();
  const passwordConfirmValue = createPasswordConfirmInput.value.trim();
  if ((passwordValue || passwordConfirmValue) && passwordValue !== passwordConfirmValue) {
    setCreatePlanState("error", "Password confirmation does not match.");
    return;
  }
  const compressionLevel = parseNonNegativeInteger(createCompressionInput.value);
  const volumeSize = parseNonNegativeInteger(createVolumeInput.value);

  createSubmissionInFlight = true;
  setCreatePlanState(createPlanState, currentPlanError);

  try {
    const request = buildStartCreateRequest({
      sources: createSources,
      destinationPath,
      format,
      cleanSource,
      replaceExisting,
      destinationCollisionStrategy: options.destinationCollisionStrategy,
      preserveMetadata,
      password: passwordValue,
      compressionLevel,
      volumeSize,
    });

    const response = await runStartCreate(request);

    createPasswordInput.value = "";
    createPasswordConfirmInput.value = "";
    createShowPasswordInput.checked = false;
    createPasswordInput.type = "password";
    createPasswordConfirmInput.type = "password";
    recordCreateDestinationHistory(destinationPath);
    closeModal(createDialog);
    addJobState(response);
  } catch (error) {
    const commandError = asCommandError(error);
    setCreatePlanState("error", commandError?.message ?? "Unable to start create job.");
  } finally {
    createSubmissionInFlight = false;
    setCreatePlanState(createPlanState, currentPlanError);
  }
}

async function onCancelJob(jobId: string) {
  try {
    await cancelJobCommand({ jobId });
    await pollJobs();
  } catch (error) {
    const commandError = asCommandError(error);
    if (commandError) {
      setOperationalStatus(commandError.message);
    }
  }
}

async function onDismissJob(jobId: string) {
  try {
    await dismissJobCommand({ jobId });
    jobs.delete(jobId);
    jobRetryContexts.delete(jobId);
    promptedPasswordRetryJobs.delete(jobId);
    renderJobs();
    if (jobs.size === 0) {
      stopPolling();
    }
  } catch (error) {
    const commandError = asCommandError(error);
    if (commandError) {
      setOperationalStatus(commandError.message);
    }
  }
}

async function loadBootstrapState() {
  try {
    const [healthcheck, contract] = await Promise.all([
      fetchHealthcheck(),
      fetchProjectContract(),
    ]);

    latestHealthcheck = healthcheck;
    latestContract = contract;
    setOperationalStatus(healthcheck.ready ? "Ready." : "Backend unavailable.");
    renderAboutDiagnostics();
    renderBrowse();
  } catch (error) {
    latestHealthcheck = null;
    latestContract = null;
    if (isDesktopRuntime()) {
      const commandError = asCommandError(error);
      setOperationalStatus(commandError?.message ?? unknownErrorMessage(error, "Backend unavailable."));
    } else {
      setOperationalStatus("Ready in browser preview.");
    }
    renderAboutDiagnostics();
    renderBrowse();
  }
}

function onCreateFormatChange() {
  const destination = createDestinationInput.value.trim();
  if (destination) {
    createDestinationInput.value = withCreateArchiveExtension(
      destination,
      createFormatSelect.value as CreateArchiveFormat,
    );
  }

  queuePlanRun();
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function handleShortcut(event: KeyboardEvent) {
  const openDialogElement = getOpenModal();
  if (event.key === "Tab" && openDialogElement) {
    trapModalFocus(event, openDialogElement);
    return;
  }

  if (event.key === "Escape") {
    if (hasOpenMenu()) {
      closeOpenMenus();
      return;
    }

    hideContextMenu();
    if (!extractDialog.hidden) closeModal(extractDialog);
    else if (!createDialog.hidden) closeModal(createDialog);
    else if (!aboutDialog.hidden) closeModal(aboutDialog);
    else if (!preferencesDialog.hidden) closeModal(preferencesDialog);
    else if (!infoDialog.hidden) closeModal(infoDialog);
    else if (workspaceElement.dataset.jobDrawer === "open") closeJobDrawer();
    else clearBrowseSelection();
    return;
  }

  if (openDialogElement || isEditableTarget(event.target)) {
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void onOpenArchive();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    showCreateWorkspace();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllVisibleEntries();
    return;
  }

  if (event.key === "F5") {
    event.preventDefault();
    void openExtractDialog(selectedEntries.size ? "selection" : "archive");
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    void onRefreshArchive();
    return;
  }

  if (event.key === "Backspace" || (event.altKey && event.key === "ArrowUp")) {
    event.preventDefault();
    navigateUp();
    return;
  }

  if (event.key === "Enter") {
    const selected = getSelectedEntryPaths();
    if (selected.length === 1) {
      event.preventDefault();
      void onPreviewSelectedEntry();
    }
    return;
  }

  if (event.key === "F3") {
    event.preventDefault();
    void onPreviewSelectedEntry();
    return;
  }

  if (event.altKey && event.key === "Enter") {
    event.preventDefault();
    showCurrentInfo();
    return;
  }
}

function bindDialogCloseButtons() {
  document.querySelector<HTMLButtonElement>("#extract-dialog-close")!.addEventListener("click", () => closeModal(extractDialog));
  document.querySelector<HTMLButtonElement>("#extract-cancel")!.addEventListener("click", () => closeModal(extractDialog));
  document.querySelector<HTMLButtonElement>("#create-dialog-close")!.addEventListener("click", () => closeModal(createDialog));
  document.querySelector<HTMLButtonElement>("#create-cancel")!.addEventListener("click", () => closeModal(createDialog));
  document.querySelector<HTMLButtonElement>("#about-dialog-close")!.addEventListener("click", () => closeModal(aboutDialog));
  document.querySelector<HTMLButtonElement>("#about-close")!.addEventListener("click", () => closeModal(aboutDialog));
  document.querySelector<HTMLButtonElement>("#preferences-dialog-close")!.addEventListener("click", () => closeModal(preferencesDialog));
  document.querySelector<HTMLButtonElement>("#preferences-cancel")!.addEventListener("click", () => closeModal(preferencesDialog));
  document.querySelector<HTMLButtonElement>("#info-dialog-close")!.addEventListener("click", () => closeModal(infoDialog));
  document.querySelector<HTMLButtonElement>("#info-close")!.addEventListener("click", () => closeModal(infoDialog));
}

function bindActions() {
  modeCompressButton.addEventListener("click", () => setWorkspaceMode("compress"));
  modeExtractButton.addEventListener("click", () => setWorkspaceMode("extract"));
  openArchiveButton.addEventListener("click", () => void onOpenArchive());
  newArchiveButton.addEventListener("click", showCreateWorkspace);
  addArchiveButton.addEventListener("click", showCreateWorkspace);
  extractToolbarButton.addEventListener("click", () => openExtractDialog(selectedEntries.size ? "selection" : "archive"));
  testArchiveButton.addEventListener("click", () => void onTestArchive());
  infoToolbarButton.addEventListener("click", showCurrentInfo);
  createOptionsOpenButton.addEventListener("click", openCreateOptionsDialog);
  jobsDrawerOpenButton.addEventListener("click", openJobDrawer);
  preferencesToolbarButton.addEventListener("click", openPreferencesDialog);
  refreshArchiveButton.addEventListener("click", () => void onRefreshArchive());
  navBackButton.addEventListener("click", navigateBack);
  navUpButton.addEventListener("click", navigateUp);

  const bindMenuItem = (id: CommandId, handler: () => void) => {
    const button = menuItemButton(id);
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      handler();
      closeOpenMenus();
    });
  };

  bindMenuItem("open", () => void onOpenArchive());
  bindMenuItem("createFile", showCreateWorkspace);
  bindMenuItem("selectAll", selectVisibleEntries);
  bindMenuItem("deselectAll", clearBrowseSelection);
  bindMenuItem("selectByType", () => selectEntriesByType("add"));
  bindMenuItem("deselectByType", () => selectEntriesByType("remove"));
  bindMenuItem("openRoot", () => navigateToFolder(""));
  bindMenuItem("upOneLevel", navigateUp);
  bindMenuItem("extract", () => openExtractDialog(selectedEntries.size ? "selection" : "archive"));
  bindMenuItem("test", () => void onTestArchive());
  bindMenuItem("view", () => void onPreviewSelectedEntry());
  bindMenuItem("copyTo", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));
  bindMenuItem("info", showCurrentInfo);
  bindMenuItem("properties", showCurrentInfo);
  bindMenuItem("refresh", () => void onRefreshArchive());
  bindMenuItem("exit", closeAppWindow);
  bindMenuItem("detailsView", () => setOperationalStatus("Details view is active."));
  bindMenuItem("sortName", () => applySortCommand("name"));
  bindMenuItem("sortType", () => applySortCommand("kind"));
  bindMenuItem("sortDate", () => applySortCommand("modified"));
  bindMenuItem("sortSize", () => applySortCommand("size"));
  bindMenuItem("archiveToolbar", () => {
    savePreferencePatch({ toolbarVisible: !appPreferences.toolbarVisible });
  });
  bindMenuItem("standardToolbar", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));
  bindMenuItem("largeButtons", () => {
    savePreferencePatch({ largeToolbarButtons: !appPreferences.largeToolbarButtons });
  });
  bindMenuItem("showButtonText", () => {
    savePreferencePatch({ showToolbarLabels: !appPreferences.showToolbarLabels });
  });
  bindMenuItem("options", openPreferencesDialog);
  bindMenuItem("about", () => {
    renderAboutDiagnostics();
    openModal(aboutDialog, "#about-close");
  });
  bindMenuItem("flatView", () => {
    setFlatView(!isFlatView, true);
  });
  bindMenuItem("openInside", () => {
    const selected = getSelectedEntryPaths();
    if (selected.length !== 1) {
      setOperationalStatus(SINGLE_FILE_REQUIRED_MESSAGE);
      return;
    }
    navigateToFolder(selected[0]);
  });
  bindMenuItem("invertSelection", () => invertVisibleSelectionEntries());
  bindMenuItem("openOutside", () => void onOpenOutsideSelectedEntry());
  bindMenuItem("deleteTempFiles", () => void onDeleteTemporaryFiles());
  bindMenuItem("delete", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));
  bindMenuItem("moveTo", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));

  searchInput.addEventListener("input", () => {
    renderBrowse();
  });

  tableHead.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id !== "select-all") {
      return;
    }

    if (target.checked) {
      selectAllVisibleEntries();
      return;
    }
    clearBrowseSelection();
  });

  tableHead.addEventListener("contextmenu", (event) => {
    const target = (event.target as HTMLElement | null);
    const header = target?.closest<HTMLTableCellElement>("th");
    if (!header) {
      return;
    }
    event.preventDefault();
    showTableHeaderContextMenu(
      event.clientX,
      event.clientY,
      header.dataset.columnId as ArchiveTableColumnId | undefined,
    );
  });

  tableHead.addEventListener("click", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-column-resizer]")) {
      return;
    }

    const header = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>("th[data-sort-key]");
    const key = header?.dataset.sortKey as ArchiveSortKey | undefined;
    if (!key) {
      return;
    }

    applySortCommand(key);
  });

  tableHead.addEventListener("pointerdown", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-column-resizer]");
    const columnId = target?.dataset.columnResizer as ArchiveTableColumnId | undefined;
    if (!columnId) {
      return;
    }

    startColumnResize(event, columnId);
  });

  pathCrumbsElement.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-crumb-path]");
    if (!target) {
      return;
    }
    navigateToFolder(target.dataset.crumbPath ?? "");
  });

  treeContentElement.addEventListener("click", (event) => {
    const actionTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tree-action]");
    if (actionTarget?.dataset.treeAction === "open") {
      void onOpenArchive();
      return;
    }
    if (actionTarget?.dataset.treeAction === "create") {
      showCreateWorkspace();
      return;
    }

    const toggleTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-tree-toggle]");
    if (toggleTarget) {
      event.preventDefault();
      const folderPath = toggleTarget.dataset.treePath ?? "";
      if (!expandedArchiveTreeFolders.has(folderPath)) {
        expandedArchiveTreeFolders.add(folderPath);
      } else {
        expandedArchiveTreeFolders.delete(folderPath);
      }
      renderBrowse();
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tree-path]");
    if (!target) {
      return;
    }
    navigateToFolder(target.dataset.treePath ?? "");
  });

  archiveEmptyStateElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showStartupContextMenu(event.clientX, event.clientY);
  });

function hasSelectionModifier(event: PointerEvent | MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey;
}

function entryPathFromNativeDragEvent(event: PointerEvent): string {
  const target = event.target as HTMLElement;
  if (target.closest("button, a, input, select, textarea")) {
    return "";
  }

  if (!target.closest(".row-primary")) {
    return "";
  }

  const row = target.closest<HTMLTableRowElement>("tr[data-entry-path]");
  return row?.dataset.entryPath ?? "";
}

function suppressNativeDragClick(event: MouseEvent) {
  suppressNextTableClick = false;
  event.preventDefault();
  event.stopPropagation();
}

function viewportRectBetween(startX: number, startY: number, endX: number, endY: number): ViewportRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function viewportRectsIntersect(left: ViewportRect, right: DOMRect): boolean {
  return left.left <= right.right &&
    left.right >= right.left &&
    left.top <= right.bottom &&
    left.bottom >= right.top;
}

function ensureMarqueeSelectionElement(): HTMLDivElement {
  if (marqueeSelectionElement) {
    return marqueeSelectionElement;
  }

  marqueeSelectionElement = document.createElement("div");
  marqueeSelectionElement.className = "marquee-selection";
  document.body.appendChild(marqueeSelectionElement);
  return marqueeSelectionElement;
}

function removeMarqueeSelectionElement() {
  marqueeSelectionElement?.remove();
  marqueeSelectionElement = null;
  document.body.classList.remove("is-marquee-selecting");
}

function setMarqueeSelectionElementRect(rect: ViewportRect) {
  const element = ensureMarqueeSelectionElement();
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function selectedRowsInMarqueeRect(rect: ViewportRect): string[] {
  const paths: string[] = [];
  for (const row of tableBody.querySelectorAll<HTMLTableRowElement>("tr[data-entry-path]")) {
    if (viewportRectsIntersect(rect, row.getBoundingClientRect())) {
      const path = row.dataset.entryPath;
      if (path) {
        paths.push(path);
      }
    }
  }
  return paths;
}

function canStartMarqueeSelection(event: PointerEvent): boolean {
  if (event.button !== 0 || !currentArchivePath || browseState !== "loaded" || hasActiveJob()) {
    return false;
  }

  const tableShellRect = tableShellElement.getBoundingClientRect();
  const isInsideListView =
    event.clientX >= tableShellRect.left &&
    event.clientX <= tableShellRect.right &&
    event.clientY >= tableShellRect.top &&
    event.clientY <= tableShellRect.bottom;

  if (!isInsideListView) {
    return false;
  }

  const target = event.target as HTMLElement;
  if (target.closest("button, a, input, select, textarea, .column-resizer")) {
    return false;
  }

  return !target.closest(".row-primary, .row-secondary");
}

function clearPendingMarqueeSelection() {
  pendingMarqueeSelection = null;
  document.removeEventListener("pointermove", onMarqueeSelectionPointerMove);
  document.removeEventListener("pointerup", onMarqueeSelectionPointerEnd);
  document.removeEventListener("pointercancel", onMarqueeSelectionPointerEnd);
  removeMarqueeSelectionElement();
}

function updateMarqueeSelection(rect: ViewportRect, gesture: MarqueeSelectionGesture) {
  const selectedInRect = selectedRowsInMarqueeRect(rect);
  const nextSelection = gesture.additive ? new Set(gesture.baseSelection) : new Set<string>();

  for (const path of selectedInRect) {
    nextSelection.add(path);
  }

  selectedEntries = nextSelection;
  const focusedPath = [...getVisibleSelectablePaths()].reverse().find((path) => nextSelection.has(path)) ?? "";
  focusedEntryPath = focusedPath;
  selectionAnchorPath = focusedPath;
  syncVisibleSelectionUi();
}

function onMarqueeSelectionPointerMove(event: PointerEvent) {
  const gesture = pendingMarqueeSelection;
  if (!gesture || gesture.pointerId !== event.pointerId) {
    return;
  }

  const rect = viewportRectBetween(gesture.startX, gesture.startY, event.clientX, event.clientY);
  if (!gesture.started && Math.hypot(rect.width, rect.height) < MARQUEE_SELECTION_THRESHOLD_PX) {
    return;
  }

  if (!gesture.started) {
    gesture.started = true;
    suppressNextTableClick = true;
    document.addEventListener("click", suppressNativeDragClick, { capture: true, once: true });
    document.body.classList.add("is-marquee-selecting");
  }

  event.preventDefault();
  setMarqueeSelectionElementRect(rect);
  updateMarqueeSelection(rect, gesture);
}

function onMarqueeSelectionPointerEnd(event: PointerEvent) {
  if (pendingMarqueeSelection?.pointerId !== event.pointerId) {
    return;
  }

  clearPendingMarqueeSelection();
}

function clearPendingNativeDragGesture() {
  pendingNativeDragGesture = null;
  document.removeEventListener("pointermove", onNativeDragPointerMove);
  document.removeEventListener("pointerup", onNativeDragPointerEnd);
  document.removeEventListener("pointercancel", onNativeDragPointerEnd);
}

function onNativeDragPointerMove(event: PointerEvent) {
  const gesture = pendingNativeDragGesture;
  if (!gesture || gesture.pointerId !== event.pointerId || gesture.started) {
    return;
  }

  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (Math.hypot(deltaX, deltaY) < NATIVE_DRAG_THRESHOLD_PX) {
    return;
  }

  gesture.started = true;
  suppressNextTableClick = true;
  document.addEventListener("click", suppressNativeDragClick, { capture: true, once: true });
  event.preventDefault();
  const entryPath = gesture.entryPath;
  if (!selectedEntries.has(entryPath)) {
    selectEntryForNativeDragGesture(entryPath);
  }

  document.removeEventListener("pointermove", onNativeDragPointerMove);

  clearPendingNativeDragGesture();
  void startNativeDragOut(entryPath);
}

function onNativeDragPointerEnd(event: PointerEvent) {
  if (pendingNativeDragGesture?.pointerId !== event.pointerId) {
    return;
  }
  clearPendingNativeDragGesture();
}

function selectEntryForNativeDragGesture(entryPath: string) {
  focusedEntryPath = entryPath;

  if (selectedEntries.has(entryPath)) {
    return;
  }

  selectedEntries = new Set([entryPath]);
  selectionAnchorPath = entryPath;
  renderBrowse();
  focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));
}

tableBody.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !currentArchivePath || hasActiveJob() || hasSelectionModifier(event)) {
    return;
  }

  const entryPath = entryPathFromNativeDragEvent(event);
  if (!entryPath) {
    return;
  }

  pendingNativeDragGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    entryPath,
    started: false,
  };
  document.addEventListener("pointermove", onNativeDragPointerMove);
  document.addEventListener("pointerup", onNativeDragPointerEnd);
  document.addEventListener("pointercancel", onNativeDragPointerEnd);
});

function armMarqueeSelectionFromPointer(event: PointerEvent) {
  if (pendingMarqueeSelection?.pointerId === event.pointerId) {
    return;
  }

  if (!canStartMarqueeSelection(event)) {
    return;
  }

  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  pendingMarqueeSelection = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    additive: hasSelectionModifier(event),
    baseSelection: new Set(selectedEntries),
    started: false,
  };

  document.addEventListener("pointermove", onMarqueeSelectionPointerMove);
  document.addEventListener("pointerup", onMarqueeSelectionPointerEnd);
  document.addEventListener("pointercancel", onMarqueeSelectionPointerEnd);
}

marqueeHitSurfaceElement.addEventListener("pointerdown", armMarqueeSelectionFromPointer);
tableShellElement.addEventListener("pointerdown", armMarqueeSelectionFromPointer, { capture: true });
archiveTablePaneElement.addEventListener("pointerdown", armMarqueeSelectionFromPointer);

tableBody.addEventListener("dragstart", (event) => {
  if ((event.target as HTMLElement | null)?.closest("tr[data-entry-path]")) {
    event.preventDefault();
  }
});

tableShellElement.addEventListener("selectstart", (event) => {
  event.preventDefault();
});

tableShellElement.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

tableBody.addEventListener("click", (event) => {
  if (suppressNextTableClick) {
    suppressNextTableClick = false;
    event.preventDefault();
    return;
  }

  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement) {
    return;
  }

  const row = target.closest<HTMLTableRowElement>("tr");
  const folderPath = row?.dataset.folderPath;
  const entryPath = row?.dataset.entryPath;
  if (!folderPath && !entryPath) {
    return;
  }

  const plainPrimaryClick = !event.ctrlKey && !event.metaKey && !event.shiftKey;

  if (folderPath !== undefined) {
    if (event.detail >= 2 && plainPrimaryClick) {
      navigateToFolder(folderPath);
      return;
    }

    if (
      appPreferences.singleClickOpen &&
      plainPrimaryClick
    ) {
      navigateToFolder(folderPath);
      return;
    }

    if (entryPath) {
      updateSelectionByIntent(entryPath, { ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
      renderBrowse();
      focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));
    }
    return;
  }

  if (entryPath) {
    updateSelectionByIntent(entryPath, { ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
    renderBrowse();
    focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));

    if (
      appPreferences.singleClickOpen &&
      plainPrimaryClick
    ) {
      void onPreviewSelectedEntry();
    }
    return;
  }
});

  tableBody.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.type !== "checkbox" || !target.dataset.entryPath) {
      return;
    }

    const path = target.dataset.entryPath;
    if (target.checked) {
      selectedEntries.add(path);
    } else {
      selectedEntries.delete(path);
    }

    focusedEntryPath = path;
    selectionAnchorPath = path;
    renderBrowse();
  });

  tableBody.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-folder-path], tr[data-entry-path]");
    if (!row) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRelativeTableRow(row, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRelativeTableRow(row, -1);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      toggleTableRowSelection(row);
      event.stopPropagation();
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      const x = rect.left + 24;
      const y = rect.top + Math.min(rect.height - 2, 24);
      const folderPath = row.dataset.folderPath;
      if (folderPath !== undefined) {
        showFolderContextMenu(folderPath, x, y, row.dataset.entryPath);
        return;
      }
      const entryPath = row.dataset.entryPath;
      if (entryPath) {
        showEntryContextMenu(entryPath, x, y);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activateTableRow(row);
    }
  });

  tableBody.addEventListener("dblclick", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr");
    const folderPath = row?.dataset.folderPath;
    if (folderPath !== undefined) {
      navigateToFolder(folderPath);
      return;
    }

    const entryPath = row?.dataset.entryPath;
    if (entryPath) {
      selectedEntries = new Set([entryPath]);
      focusedEntryPath = entryPath;
      selectionAnchorPath = entryPath;
      renderBrowse();
      void onPreviewSelectedEntry();
    }
  });

  tableBody.addEventListener("contextmenu", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr");
    if (!row) {
      return;
    }

    const folderPath = row.dataset.folderPath;
    if (folderPath !== undefined) {
      event.preventDefault();
      const entryPath = row.dataset.entryPath;
      if (entryPath && !selectedEntries.has(entryPath)) {
        selectedEntries = new Set([entryPath]);
        selectionAnchorPath = entryPath;
        focusedEntryPath = entryPath;
        renderBrowse();
      }
      showFolderContextMenu(folderPath, event.clientX, event.clientY, entryPath);
      return;
    }

    const entryPath = row.dataset.entryPath;
    if (!entryPath) {
      return;
    }

    event.preventDefault();
    showEntryContextMenu(entryPath, event.clientX, event.clientY);
  });

  contextMenu.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-context-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.contextAction;
    const folderPath = target.dataset.folderPath;
    const columnId = target.dataset.columnId as ArchiveTableColumnId | undefined;
    const entryPath = contextEntryPath;
    const sourcePath = contextSourcePath;
    hideContextMenu();

    if (action === "open-archive") {
      void onOpenArchive();
      return;
    }
    if (action === "create-archive") {
      showCreateWorkspace();
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
        selectedEntries = new Set([selectedPath]);
        selectionAnchorPath = selectedPath;
        focusedEntryPath = selectedPath;
        renderBrowse();
        void onPreviewSelectedEntry();
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
          setOperationalStatus("You must select one folder.");
          return;
        }
        navigateToFolder(entryPath);
      }
      return;
    }
    if (action === "open-outside") {
      void onOpenOutsideSelectedEntry();
      return;
    }
    if (action === "preview" || action === "view-entry") {
      void onPreviewSelectedEntry();
      return;
    }
    if (action === "select-by-type") {
      selectEntriesByType("add");
      return;
    }
    if (action === "deselect-by-type") {
      selectEntriesByType("remove");
      return;
    }
    if (action === "extract") {
      openExtractDialog("selection");
      return;
    }
    if (action === "test") {
      void onTestArchive();
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
    if (action === "extract-here") {
      openExtractHereDialog(selectedEntries.size ? "selection" : "archive");
      return;
    }
    if (action === "extract-all") {
      openExtractDialog("archive");
      return;
    }
    if (action === "info" && entryPath) {
      showEntryInfo(entryPath);
      return;
    }
    if (action === "info") {
      showArchiveInfo();
      return;
    }
    if (action === "reveal-source" && sourcePath) {
      void revealInFileManager(sourcePath).catch((error) => {
        setOperationalStatus(unknownErrorMessage(error, "Unable to reveal source."));
      });
      return;
    }
    if (action === "remove-source" && sourcePath) {
      createSources = createSources.filter((item) => item !== sourcePath);
      renderCreateSources();
      renderCompressSources();
      queuePlanRun();
      return;
    }
    if (action === "clear-sources") {
      createSources = [];
      currentPlan = null;
      renderCreateSources();
      renderCompressSources();
      queuePlanRun();
    }
  });

  browseExtractDestinationButton.addEventListener("click", () => void onSelectDestinationForExtract());
  extractStartButton.addEventListener("click", () => void startExtract(activeExtractMode));

  addSourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showAddSourcesMenu(addSourceButton);
  });
  clearSourcesButton.addEventListener("click", () => {
    createSources = [];
    currentPlan = null;
    renderCreateSources();
    renderCompressSources();
    queuePlanRun();
  });
  sourceListElement.addEventListener("contextmenu", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("li[data-source-path]");
    if (!row?.dataset.sourcePath) {
      return;
    }
    event.preventDefault();
    showSourceContextMenu(row.dataset.sourcePath, event.clientX, event.clientY);
  });

  createFormatSelect.addEventListener("change", onCreateFormatChange);
  createDestinationInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);
  browseCreateDestinationButton.addEventListener("click", () => void onSelectCreateDestination());
  startCreateButton.addEventListener("click", () => void runCreate());
  preferencesOutputLocationSelect.addEventListener("change", syncPreferenceOutputState);
  preferencesChooseOutputButton.addEventListener("click", () => void onSelectPreferenceOutputFolder());
  preferencesSaveButton.addEventListener("click", savePreferencesFromDialog);

  for (const button of [
    createCleanSourceCheckbox,
    createPreserveMetadataCheckbox,
    createReplaceExistingCheckbox,
    createRespectGitignoreCheckbox,
  ]) {
    button.addEventListener("change", queuePlanRun);
  }

  browseShowPasswordInput.addEventListener("change", () => {
    browsePasswordInput.type = browseShowPasswordInput.checked ? "text" : "password";
  });
  createShowPasswordInput.addEventListener("change", () => {
    const type = createShowPasswordInput.checked ? "text" : "password";
    createPasswordInput.type = type;
    createPasswordConfirmInput.type = type;
  });
  extractUseSubfolderCheckbox.addEventListener("change", () => {
    extractSubfolderInput.disabled = !extractUseSubfolderCheckbox.checked;
  });

  jobsListElement.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const actionButton = target?.closest<HTMLButtonElement>(
      "[data-cancel], [data-retry-password], [data-dismiss]",
    );
    const cancelId = actionButton?.dataset.cancel;
    const retryPasswordId = actionButton?.dataset.retryPassword;
    const dismissId = actionButton?.dataset.dismiss;
    if (cancelId) {
      void onCancelJob(cancelId);
      return;
    }
    if (retryPasswordId) {
      void retryJobWithPasswordPrompt(retryPasswordId);
      return;
    }
    if (dismissId) {
      void onDismissJob(dismissId);
    }
  });

  quickCancelButton.addEventListener("click", () => {
    for (const jobId of quickActionJobIds) {
      const state = jobs.get(jobId);
      if (!state || isTerminalJobStatus(state.snapshot.status)) {
        continue;
      }
      void onCancelJob(jobId);
    }
  });

  refreshJobsButton.addEventListener("click", () => void pollJobs());
  jobsDrawerOpenButton.addEventListener("click", openJobDrawer);
  statusJobButton.addEventListener("click", openJobDrawer);
  jobDrawerCloseButton.addEventListener("click", closeJobDrawer);
  jobsListElement.addEventListener("focusin", () => void pollJobs());

  copyDiagnosticsButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText());
      copyDiagnosticsButton.textContent = "Copied";
      window.setTimeout(() => {
        copyDiagnosticsButton.textContent = "Copy Diagnostics";
      }, 1400);
    } catch {
      setOperationalStatus("Could not copy diagnostics.");
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

  appRoot.addEventListener("keydown", handleShortcut);
}

bindMenuBehavior();
bindDialogCloseButtons();
bindActions();
bindBrowserFileDropFallback();
bindWindowLifecycleHandlers();
loadExtractDestinationHistory();
renderExtractDestinationHistory();
loadCreateDestinationHistory();
renderCreateDestinationHistory();
applyCreatePreferenceDefaults();
renderCreateSources();
renderCompressSources();
setCreatePlanState("idle");
setBrowseState("idle", BROWSE_STATUS_IDLE);
renderBrowse();
renderJobs();
if (isLocalDevHost()) {
  window.__zmanagerDev = {
    loadArchiveFixture: loadArchiveListingIntoState,
    setSystemIconFixtures: (fixtures: Record<string, string | null>) => {
      systemIconDataUrls = new Map(Object.entries(fixtures));
      renderBrowse();
    },
    setJobFixtures: (fixtures: JobState[]) => {
      jobs.clear();
      jobRetryContexts.clear();
      promptedPasswordRetryJobs.clear();
      for (const fixture of fixtures) {
        jobs.set(fixture.snapshot.jobId, fixture);
      }
      renderJobs();
    },
    openSurface: (surface: DevDialogName) => {
      if (surface === "about") {
        renderAboutDiagnostics();
        openModal(aboutDialog, "#about-close");
      } else if (surface === "preferences") {
        openPreferencesDialog();
      } else if (surface === "info") {
        showCurrentInfo();
      } else if (surface === "jobs") {
        openJobDrawer();
      }
    },
    closeModal: () => {
      const openDialog = getOpenModal();
      if (openDialog) {
        closeModal(openDialog);
      }
      closeJobDrawer();
    },
  };
}
loadLocalDevFixtureFromUrl();
void loadBootstrapState();
void bindTauriFileDrop();
void initializeDesktopRuntime();
