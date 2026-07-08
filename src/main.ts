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
  CLASSIC_MENU_GROUPS,
  CLASSIC_TOOLBAR_GROUPS,
  COMMAND_DEFINITIONS,
  ARCHIVE_NOT_READY_MESSAGE,
  JOB_RUNNING_MESSAGE,
  NO_ARCHIVE_OPEN_MESSAGE,
  NO_ENTRIES_MESSAGE,
  NO_SELECTION_MESSAGE,
  SINGLE_FILE_REQUIRED_MESSAGE,
  SINGLE_FOLDER_REQUIRED_MESSAGE,
  UNSUPPORTED_OPERATION_MESSAGE,
  commandLabel,
  commandTooltip,
  commandTooltipText,
  menuGroupLabel,
  selectCommandState,
  type CommandId,
  type MenuItem,
} from "./app/classicCommands";
import {
  ARCHIVE_TABLE_COLUMNS,
  archiveTableColumnLabel,
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
import {
  Minus,
  Square,
  X,
  type IconNode,
} from "lucide";
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
  parseDateValue,
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
  createArchiveUnavailableReason,
  createFormatSupportsPassword,
  createStateAfterDestinationEdit,
  getArchiveName,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
  suggestedCreateArchiveName as buildSuggestedCreateArchiveName,
  withCreateArchiveExtension,
  type CreateArchiveUnavailableReason,
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
  type DroppedPath,
  type DropIntentDecision,
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
  createDefaultsForFormat,
  defaultCreateDirectory,
  loadAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from "./app/preferences";
import {
  localeDirection,
  resolveLocalePreference,
  type SupportedLocale,
} from "./app/i18n/locale";
import {
  applyTranslations,
  createTranslator,
  type MessageKey,
  type Translator,
} from "./app/i18n/translator";
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
  pauseJob as pauseJobCommand,
  runPlanCreate,
  runPreviewEntry,
  resumeJob as resumeJobCommand,
  runStartNativeFileDrag,
  runStartCreate,
  runStartExtract,
  runTestArchive,
  validateDirectory,
} from "./api/commands";
import {
  availableMonitors,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type {
  ArchiveEntryDto,
  BrowseState,
  CreatePlanEntryDto,
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
  StartExtractRequest,
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
  type JobOutputAction,
} from "./ui/jobsView";
import {
  isFiniteNumber,
  normalizeStoredWindowGeometry,
  restorableWindowGeometry,
  type WindowGeometry,
} from "./app/windowGeometry";
import {
  collectPreferencesFromDialog as collectPreferencesFromView,
  fullCustomOutputPath,
  renderCustomOutputPathDisplay,
  renderCreateDefaultsForSelectedFormat,
  renderPreferencesDialog as renderPreferencesView,
  restoreFullCustomOutputPathForEdit,
  syncCustomOutputPathFromInput,
  syncPreferenceOutputState as syncPreferenceOutputViewState,
  type PreferencesViewElements,
} from "./ui/preferencesView";

type BrowserRow = ArchiveTableRow;
type SelectableBrowserRow = Extract<BrowserRow, { rowType: "folder" | "entry" }>;
type ArchiveTreeFolder = {
  path: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
};
type CompressPlanRow =
  | {
    rowType: "parent";
    path: string;
    name: string;
  }
  | {
    rowType: "folder";
    path: string;
    name: string;
    entry?: CreatePlanEntryDto;
  }
  | {
    rowType: "entry";
    path: string;
    name: string;
    entry: CreatePlanEntryDto;
  };
type CompressSourceColumnId = "name" | "size" | "modified" | "kind";
type QuickActionWindowMode = "normal" | "jobOnly" | "background";
type FocusedJobAutoCloseAction = "closeWindow" | "returnToWorkspace";
type AppWindowResizeDirection =
  | "North"
  | "East"
  | "South"
  | "West"
  | "NorthEast"
  | "SouthEast"
  | "SouthWest"
  | "NorthWest";
type FocusedJobProgressContext = {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string }[];
};

const QUICK_ACTION_WINDOW_WIDTH_PX = 620;
const QUICK_ACTION_WINDOW_HEIGHT_PX = 420;
const QUICK_ACTION_WINDOW_MIN_WIDTH_PX = 540;
const QUICK_ACTION_WINDOW_MIN_HEIGHT_PX = 360;
const QUICK_ACTION_AUTO_CLOSE_DELAY_MS = 650;
type ArchiveFixture = {
  archivePath: string;
  entries: ArchiveEntryDto[];
  entryCount?: number;
  totalSize?: number;
};

const NATIVE_DRAG_THRESHOLD_PX = 6;
const MARQUEE_SELECTION_THRESHOLD_PX = 5;
const COMPRESS_SOURCE_COLUMN_IDS = ["name", "size", "modified", "kind"] as const;
const COMPRESS_SOURCE_INCLUDE_COLUMN_WIDTH_PX = 28;
const COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX = 520;
const COMPRESS_SOURCE_DEFAULT_COLUMN_WIDTHS: Record<CompressSourceColumnId, number> = {
  name: 320,
  size: 120,
  modified: 170,
  kind: 120,
};
const COMPRESS_SOURCE_MIN_COLUMN_WIDTHS: Record<CompressSourceColumnId, number> = {
  name: 140,
  size: 72,
  modified: 110,
  kind: 80,
};

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
type DevJobFixture = JobState & {
  outputActions?: JobOutputAction[];
};

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
      setJobFixtures: (fixtures: DevJobFixture[]) => void;
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
    case "deleteTempFiles":
      return toolbarIcon("settings");
    case "jobs":
      return toolbarIcon("jobs");
    case "refresh":
      return toolbarIcon("refresh");
    case "selectAll":
      return toolbarIcon("select");
    case "flatView":
      return toolbarIcon("flat");
    case "helpContents":
    case "about":
      return toolbarIcon("help");
    default:
      return toolbarIcon("open");
  }
}

function menuGroupAccessKey(label: Parameters<typeof menuGroupLabel>[0]): string {
  switch (label) {
    case "File":
      return "f";
    case "Edit":
      return "e";
    case "View":
      return "v";
    case "Favorites":
      return "a";
    case "Tools":
      return "t";
    case "Help":
      return "h";
  }
}

function renderMenuItem(item: MenuItem): string {
  if (item.kind === "separator") {
    return `<div class="menu-separator" role="separator"></div>`;
  }

  if (item.kind === "submenu") {
    return `
      <div class="menu-submenu">
        <span ${item.labelKey ? `data-command-submenu-label="${escapeHtmlValue(item.labelKey)}"` : ""}>${escapeHtmlValue(item.label)}</span>
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
        <summary
          data-menu-group-label="${escapeHtmlValue(group.label)}"
          accesskey="${menuGroupAccessKey(group.label)}"
          aria-keyshortcuts="Alt+${menuGroupAccessKey(group.label).toUpperCase()}"
        >${escapeHtmlValue(group.label)}</summary>
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
    case "open":
      return "open-archive";
    case "createFile":
      return "new-archive";
    case "options":
      return "preferences-toolbar";
    case "jobs":
      return "jobs-drawer-open";
    default:
      return `toolbar-${commandId}`;
  }
}

function renderToolbar(): string {
  return CLASSIC_TOOLBAR_GROUPS
    .map((group) => `
      <div class="toolbar-group" role="group" aria-label="${escapeHtmlValue(group.label)}" data-command-group="${group.id}">
        <span class="toolbar-group-label">${escapeHtmlValue(group.label)}</span>
        ${group.items.map((commandId) => {
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

function renderWindowTitlebar(): string {
  return `
    <header class="window-titlebar" data-tauri-drag-region>
      <div class="window-titlebar-brand" data-tauri-drag-region>
        <span class="window-titlebar-title" data-tauri-drag-region>${APP_TITLE}</span>
      </div>
      <div class="window-titlebar-controls">
        <button id="window-minimize" class="window-control" type="button" aria-label="Minimize window" title="Minimize">
          ${renderIconNode(Minus, "window-control-icon")}
        </button>
        <button id="window-maximize" class="window-control" type="button" aria-label="Maximize or restore window" title="Maximize or restore">
          ${renderIconNode(Square, "window-control-icon")}
        </button>
        <button id="window-close" class="window-control window-control-close" type="button" aria-label="Close window" title="Close">
          ${renderIconNode(X, "window-control-icon")}
        </button>
      </div>
    </header>
  `;
}

function renderWindowResizeHandles(): string {
  const directions: AppWindowResizeDirection[] = [
    "North",
    "East",
    "South",
    "West",
    "NorthEast",
    "SouthEast",
    "SouthWest",
    "NorthWest",
  ];

  return directions
    .map((direction) => `<div class="window-resize-handle window-resize-handle-${direction.toLowerCase()}" data-window-resize-direction="${direction}" aria-hidden="true"></div>`)
    .join("");
}

appRoot.innerHTML = `
  <main class="workspace" data-job-drawer="closed">
    ${renderWindowTitlebar()}
    ${renderWindowResizeHandles()}

    <nav class="app-menu" data-i18n-aria-label="workspace.menu.aria" aria-label="Application menu">
      ${renderMenuBar()}
    </nav>

    <header class="command-toolbar mode-toolbar" role="toolbar" data-i18n-aria-label="workspace.toolbar.aria" aria-label="Workspace modes">
      <div class="mode-switch" role="tablist" data-i18n-aria-label="workspace.mode.aria" aria-label="Workspace mode">
        <button id="mode-compress" class="mode-button" type="button" role="tab" data-workspace-mode="compress" data-i18n-text="workspace.mode.compress">Compress</button>
        <button id="mode-extract" class="mode-button" type="button" role="tab" data-workspace-mode="extract" data-i18n-text="workspace.mode.extract">Extract</button>
      </div>
      <div class="command-strip">
        ${renderToolbar()}
      </div>
      <div class="toolbar-spacer"></div>
    </header>

    <section class="path-bar" data-i18n-aria-label="workspace.archiveLocation.aria" aria-label="Archive location">
      <button id="nav-back" type="button" data-i18n-text="navigation.back" disabled>Back</button>
      <button id="nav-up" class="icon-button" type="button" data-command-id="upOneLevel" data-i18n-title="commands.upOneLevel.tooltip" data-i18n-aria-label="commands.upOneLevel" disabled title="Up One Level (Backspace)" aria-label="Up One Level">${toolbarIcon("extract")}</button>
      <input id="path-field" class="path-field" type="text" data-i18n-aria-label="path.archivePath.aria" aria-label="Archive path" value="Open or create an archive to begin." readonly disabled />
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
              <input id="create-destination" type="text" data-i18n-placeholder="compress.destination.placeholder" placeholder="Choose output archive" list="create-destination-history" />
              <button id="browse-create-destination" type="button" data-i18n-text="common.browse" data-i18n-title="create.destination.browse.title" title="Browse for archive path">Browse...</button>
              <select id="create-destination-recent" class="recent-location-select" data-i18n-aria-label="create.destination.recent.aria" data-i18n-title="create.destination.recent.title" aria-label="Recent destinations" title="Recent destinations" disabled>
                <option value="" data-i18n-text="create.destination.recent">Recent</option>
              </select>
            </div>
            <datalist id="create-destination-history"></datalist>
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

    <footer class="status-bar" aria-live="polite">
      <span id="status-selection-count" class="status-part" data-i18n-text="status.initialSelection">0 / 0 object(s) selected</span>
      <span id="status-selection-size" class="status-part"></span>
      <span id="status-focused-size" class="status-part"></span>
      <span id="status-focused-modified" class="status-part"></span>
      <span id="workspace-status" class="status-part workspace-status" data-i18n-text="workspace.readyWithPeriod">Ready.</span>
      <span id="status-text" class="sr-only" data-i18n-text="workspace.readyWithPeriod">Ready.</span>
      <button id="status-job-button" type="button">
        <span id="active-job-text" data-i18n-text="status.noJobs">No jobs</span>
      </button>
    </footer>

    <aside id="job-drawer" class="job-drawer" data-i18n-aria-label="jobs.drawer.aria" aria-label="Job details" aria-hidden="true">
      <div class="job-drawer-header">
        <div>
          <h2 data-i18n-text="jobs.title">Jobs</h2>
          <p data-i18n-text="jobs.description">Live create, extract, preview, and test work.</p>
        </div>
        <div class="job-drawer-actions">
          <button id="refresh-jobs" type="button" data-i18n-text="common.refresh">Refresh</button>
          <button id="job-drawer-close" type="button" data-i18n-text="common.close">Close</button>
        </div>
      </div>
      <div id="jobs-list" class="jobs-list"></div>
    </aside>

    <section id="quick-progress" class="quick-progress" data-i18n-aria-label="quick.progress.aria" aria-label="Job progress" hidden>
      <div class="quick-progress-heading">
        <div>
          <h2 id="quick-title" data-i18n-text="quick.progress.title">Preparing job</h2>
          <p id="quick-subtitle"></p>
        </div>
      </div>
      <dl id="quick-context" class="quick-progress-context" hidden></dl>
      <div class="quick-progress-grid">
        <div class="quick-progress-metric"><span data-i18n-text="quick.elapsedTime">Elapsed time:</span><strong id="quick-elapsed">00:00:00</strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.totalSize">Total size:</span><strong id="quick-total-size"></strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.remainingTime">Remaining time:</span><strong id="quick-remaining">--:--:--</strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.speed">Speed:</span><strong id="quick-speed"></strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.files">Files:</span><strong id="quick-files">0</strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.processed">Processed:</span><strong id="quick-processed"></strong></div>
        <div class="quick-progress-metric"><span></span><strong id="quick-total-files"></strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.compressedSize">Compressed size:</span><strong id="quick-compressed-size"></strong></div>
        <div class="quick-progress-metric"><span></span><strong></strong></div>
        <div class="quick-progress-metric"><span data-i18n-text="quick.compressionRatio">Compression ratio:</span><strong id="quick-ratio"></strong></div>
      </div>
      <div class="quick-progress-current">
        <p id="quick-operation" data-i18n-text="quick.operation.starting">Starting</p>
        <p id="quick-current-path"></p>
      </div>
      <progress id="quick-progress-bar" data-i18n-aria-label="quick.progressBar.aria" aria-label="Quick action progress"></progress>
      <div class="quick-progress-actions">
        <button id="quick-background" type="button" data-i18n-text="quick.background" disabled>Background</button>
        <button id="quick-continue" type="button" data-i18n-text="quick.pause" disabled>Pause</button>
        <button id="quick-cancel" type="button" data-i18n-text="common.cancel">Cancel</button>
      </div>
    </section>

    <div id="context-menu" class="context-menu" role="menu" hidden></div>
    <div id="drop-overlay" class="drop-overlay" aria-hidden="true">
      <div class="drop-overlay-card" role="status" aria-live="polite">
        <strong id="drop-overlay-title" data-i18n-text="drop.title">Drop files</strong>
        <span id="drop-overlay-message" data-i18n-text="drop.message">Open an archive or add files to a new archive.</span>
        <span id="drop-overlay-support" class="drop-overlay-support"></span>
        <div id="drop-overlay-actions" class="drop-overlay-actions" hidden>
          <button id="drop-open-archive" type="button" data-drop-choice="open-archive" data-i18n-text="drop.action.openArchive">Open Archive</button>
          <button id="drop-add-compress" type="button" data-drop-choice="add-compress" data-i18n-text="drop.action.addCompress">Add to Compress</button>
          <button id="drop-cancel" type="button" data-drop-choice="cancel" data-i18n-text="common.cancel">Cancel</button>
        </div>
      </div>
    </div>

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

    <div id="about-dialog" class="dialog-backdrop" hidden>
      <section class="dialog property-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" tabindex="-1" data-dialog-default="#about-close" data-dialog-cancel="#about-close">
        <div class="dialog-header">
          <div>
            <h2 id="about-title" data-i18n-text="about.title">About ZManager</h2>
            <p data-i18n-text="about.description">Diagnostics for support and bug reports.</p>
          </div>
          <button id="about-dialog-close" class="icon-button" type="button" data-i18n-aria-label="about.close.aria" data-i18n-text="common.close" aria-label="Close about dialog">Close</button>
        </div>
        <div class="dialog-body property-dialog-body about-property-body">
          <div id="about-diagnostics" class="diagnostics diagnostics-groups"></div>
        </div>
        <div class="dialog-actions">
          <button id="copy-diagnostics" type="button" data-i18n-text="about.copyDiagnostics">Copy Diagnostics</button>
          <button id="about-close" type="button" data-dialog-default-button data-dialog-cancel-button data-i18n-text="common.close">Close</button>
        </div>
      </section>
    </div>

    <div id="preferences-dialog" class="dialog-backdrop" hidden>
      <section class="dialog property-dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="preferences-title" tabindex="-1" data-dialog-default="#preferences-save" data-dialog-cancel="#preferences-cancel">
        <div class="dialog-header">
          <div>
            <h2 id="preferences-title" data-i18n-text="preferences.title">Options</h2>
            <p data-i18n-text="preferences.description">Safe desktop preferences for archive workflows.</p>
          </div>
          <button id="preferences-dialog-close" class="icon-button" type="button" data-i18n-aria-label="preferences.close.aria" data-i18n-text="common.close" aria-label="Close preferences dialog">Close</button>
        </div>
        <div class="dialog-body property-dialog-body preferences-property-body">
          <div class="property-sheet">
            <nav class="property-nav" aria-label="Preference categories">
              <button type="button" class="property-nav-item" data-pref-page-target="folders" aria-selected="true" data-i18n-text="preferences.folders.title">Folders</button>
              <button type="button" class="property-nav-item" data-pref-page-target="archive" aria-selected="false" data-i18n-text="preferences.archiveDefaults.title">Archive Defaults</button>
              <button type="button" class="property-nav-item" data-pref-page-target="extraction" aria-selected="false" data-i18n-text="preferences.extraction.title">Extraction Defaults</button>
              <button type="button" class="property-nav-item" data-pref-page-target="interface" aria-selected="false" data-i18n-text="preferences.interface.title">Interface</button>
              <button type="button" class="property-nav-item" data-pref-page-target="safety" aria-selected="false" data-i18n-text="preferences.safety.title">Safety</button>
            </nav>
            <div class="options-pages">
              <section class="options-page property-section" data-pref-page="folders">
                <h3 data-i18n-text="preferences.folders.title">Folders</h3>
                <p class="section-description" data-i18n-text="preferences.folders.description">Choose where quick create actions and new archives start.</p>
                <div class="setting-row">
                  <label for="pref-output-location" data-i18n-text="preferences.folders.workingOutput">Working/output folder</label>
                  <div class="setting-control">
                    <select id="pref-output-location">
                      <option value="sourceFolder" data-i18n-text="preferences.folders.sourceFolder">Current/source folder</option>
                      <option value="customFolder" data-i18n-text="preferences.folders.customFolder">Specified path</option>
                    </select>
                    <p class="setting-description"><span class="quick-action-badge" data-i18n-text="preferences.quickActions.badge">Quick actions</span> <span data-i18n-text="preferences.folders.quickDescription">Used by Compress quick actions and suggested create destinations.</span></p>
                  </div>
                </div>
                <div class="setting-row">
                  <label for="pref-custom-output" data-i18n-text="preferences.folders.customFolder">Specified path</label>
                  <div class="setting-control">
                    <div class="inline-field">
                      <input id="pref-custom-output" class="path-input" type="text" aria-describedby="pref-custom-output-help pref-custom-output-validation" data-i18n-placeholder="preferences.folders.customPlaceholder" placeholder="Optional folder for new archives" />
                      <button id="pref-choose-output" type="button" data-i18n-text="common.browse">Browse...</button>
                    </div>
                    <p id="pref-custom-output-help" class="setting-description" data-i18n-text="preferences.folders.customHelp">Choose an existing folder with the native folder picker, or paste a full local path.</p>
                    <p id="pref-custom-output-validation" class="setting-validation" aria-live="polite" hidden></p>
                  </div>
                </div>
              </section>
              <section class="options-page property-section" data-pref-page="archive" hidden>
                <h3 data-i18n-text="preferences.archiveDefaults.title">Archive Defaults</h3>
                <p class="section-description" data-i18n-text="preferences.archiveDefaults.description">Defaults used when creating archives from the workspace or quick actions.</p>
                <div class="setting-grid">
                  <div class="setting-row">
                    <label for="pref-default-format" data-i18n-text="preferences.archiveDefaults.defaultFormat">Default archive format</label>
                    <div class="setting-control">
                      <select id="pref-default-format">
                        <option value="zip">ZIP</option>
                        <option value="tarZst">TZST</option>
                        <option value="tzap">TZAP</option>
                        <option value="sevenZ">7Z</option>
                      </select>
                      <p class="setting-description"><span class="quick-action-badge" data-i18n-text="preferences.quickActions.badge">Quick actions</span> <span data-i18n-text="preferences.archiveDefaults.formatQuickDescription">Used when Compress quick actions need a default format.</span></p>
                    </div>
                  </div>
                  <div class="setting-row">
                    <label for="pref-create-format" data-i18n-text="preferences.archiveDefaults.editFormat">Edit defaults for</label>
                    <div class="setting-control">
                      <select id="pref-create-format">
                        <option value="zip">ZIP</option>
                        <option value="tarZst">TZST</option>
                        <option value="tzap">TZAP</option>
                        <option value="sevenZ">7Z</option>
                      </select>
                    </div>
                  </div>
                  <div class="setting-row">
                    <label for="pref-create-compression-level" data-i18n-text="preferences.archiveDefaults.compressionLevel">Compression level</label>
                    <div class="setting-control">
                      <select id="pref-create-compression-level">
                        <option value="" data-i18n-text="preferences.archiveDefaults.backendDefault">Backend default</option>
                        <option value="0" data-i18n-text="common.store">Store</option>
                        <option value="1" data-i18n-text="common.fastest">Fastest</option>
                        <option value="3" data-i18n-text="common.fast">Fast</option>
                        <option value="9" data-i18n-text="common.maximum">Maximum</option>
                        <option value="22" data-i18n-text="common.ultra">Ultra</option>
                      </select>
                    </div>
                  </div>
                  <div class="setting-row">
                    <label for="pref-create-volume" data-i18n-text="preferences.archiveDefaults.splitVolumes">Split to volumes, bytes</label>
                    <div class="setting-control">
                      <input id="pref-create-volume" type="number" min="0" data-i18n-placeholder="preferences.archiveDefaults.noSplit" placeholder="No split" />
                    </div>
                  </div>
                  <div id="pref-create-tzap-recovery-field" class="setting-row" hidden>
                    <label for="pref-create-tzap-recovery" data-i18n-text="create.tzapRecovery">TZAP recovery, %</label>
                    <div class="setting-control">
                      <input id="pref-create-tzap-recovery" type="number" min="${TZAP_RECOVERY_PERCENTAGE_MIN}" max="${TZAP_RECOVERY_PERCENTAGE_MAX}" />
                    </div>
                  </div>
                </div>
              </section>
              <section class="options-page property-section" data-pref-page="extraction" hidden>
                <h3 data-i18n-text="preferences.extraction.title">Extraction Defaults</h3>
                <p class="section-description" data-i18n-text="preferences.extraction.description">Defaults used by Extract commands and Explorer quick extract actions.</p>
                <div class="setting-row">
                  <label for="pref-default-extraction" data-i18n-text="preferences.archiveDefaults.defaultExtraction">Default extraction</label>
                  <div class="setting-control">
                    <select id="pref-default-extraction">
                      <option value="askEveryTime" data-i18n-text="preferences.extraction.askEveryTime">Ask every time</option>
                      <option value="extractHere" data-i18n-text="preferences.extraction.extractHere">Extract here</option>
                      <option value="extractToFolder" data-i18n-text="preferences.extraction.extractToFolder">Extract to folder</option>
                    </select>
                    <p class="setting-description"><span class="quick-action-badge" data-i18n-text="preferences.quickActions.badge">Quick actions</span> <span data-i18n-text="preferences.extraction.quickDescription">Controls default Explorer quick extract behavior.</span></p>
                  </div>
                </div>
              </section>
              <section class="options-page property-section" data-pref-page="interface" hidden>
                <h3 data-i18n-text="preferences.interface.title">Interface</h3>
                <p class="section-description" data-i18n-text="preferences.interface.description">File list, toolbar, and language preferences for the desktop shell.</p>
                <div class="toggle-grid settings-toggle-grid">
                  <label class="toggle-line"><input id="pref-show-parent" type="checkbox" /> <span data-i18n-text="preferences.interface.showParent">Show .. item</span></label>
                  <label class="toggle-line"><input id="pref-real-file-icons" type="checkbox" /> <span data-i18n-text="preferences.interface.realFileIcons">Show real file icons</span></label>
                  <label class="toggle-line"><input id="pref-full-row-select" type="checkbox" /> <span data-i18n-text="preferences.interface.fullRowSelect">Full row select</span></label>
                  <label class="toggle-line"><input id="pref-show-grid" type="checkbox" /> <span data-i18n-text="preferences.interface.showGrid">Show grid lines</span></label>
                  <label class="toggle-line"><input id="pref-single-click" type="checkbox" /> <span data-i18n-text="preferences.interface.singleClick">Single-click to open</span></label>
                  <label class="toggle-line"><input id="pref-alternative-selection" type="checkbox" /> <span data-i18n-text="preferences.interface.alternativeSelection">Alternative selection mode</span></label>
                  <label class="toggle-line"><input id="pref-toolbar-visible" type="checkbox" /> <span data-i18n-text="preferences.interface.toolbarVisible">Archive toolbar</span></label>
                  <label class="toggle-line"><input id="pref-large-toolbar" type="checkbox" /> <span data-i18n-text="preferences.interface.largeToolbar">Large toolbar buttons</span></label>
                  <label class="toggle-line"><input id="pref-toolbar-labels" type="checkbox" /> <span data-i18n-text="preferences.interface.toolbarLabels">Show toolbar labels</span></label>
                  <label class="toggle-line"><input id="pref-flat-view" type="checkbox" /> <span data-i18n-text="preferences.interface.flatView">Flat view</span></label>
                </div>
                <div class="setting-row">
                  <label for="pref-language" data-i18n-text="preferences.language.title">Language</label>
                  <div class="setting-control">
                    <select id="pref-language">
                      <option value="system" data-i18n-text="preferences.language.systemDefault">System default</option>
                      <option value="en" data-i18n-text="preferences.language.english">English</option>
                      <option value="zh-CN" data-i18n-text="preferences.language.chineseSimplified">Simplified Chinese</option>
                    </select>
                  </div>
                </div>
              </section>
              <section class="options-page property-section" data-pref-page="safety" hidden>
                <h3 data-i18n-text="preferences.safety.title">Safety</h3>
                <p class="section-description" data-i18n-text="preferences.safety.description">Defaults that affect cleanup, overwrite, metadata, and password prompts.</p>
                <div class="toggle-grid settings-toggle-grid">
                  <label class="toggle-line"><input id="pref-create-clean-source" type="checkbox" /> <span data-i18n-text="create.cleanSource">Clean source</span></label>
                  <label class="toggle-line"><input id="pref-create-preserve-metadata" type="checkbox" /> <span data-i18n-text="create.preserveMetadata">Preserve metadata</span></label>
                  <label class="toggle-line"><input id="pref-create-replace-existing" type="checkbox" /> <span data-i18n-text="create.replaceExisting">Replace existing</span></label>
                  <label class="toggle-line"><input id="pref-create-prompt-password" type="checkbox" /> <span data-i18n-text="create.promptForPassword">Prompt for password</span></label>
                </div>
                <p class="setting-description"><span class="quick-action-badge" data-i18n-text="preferences.quickActions.badge">Quick actions</span> <span data-i18n-text="preferences.safety.quickDescription">Clean source applies to Compress clean-source quick actions.</span></p>
                <div class="setting-row">
                  <label for="pref-preview-cleanup" data-i18n-text="preferences.archiveDefaults.previewCleanup">Preview cleanup</label>
                  <div class="setting-control">
                    <select id="pref-preview-cleanup">
                      <option value="beforeNextPreview" data-i18n-text="preferences.previewCleanup.beforeNextPreview">Before next preview</option>
                      <option value="whenAppCloses" data-i18n-text="preferences.previewCleanup.whenAppCloses">When app closes</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <p id="preferences-status" class="status status-idle" data-i18n-text="preferences.status.localOnly">Preferences are stored locally and never include passwords.</p>
        </div>
        <div class="dialog-actions">
          <button id="preferences-save" type="button" data-dialog-default-button data-i18n-text="common.save">Save</button>
          <button id="preferences-cancel" type="button" data-dialog-cancel-button data-i18n-text="common.cancel">Cancel</button>
        </div>
      </section>
    </div>

    <div id="info-dialog" class="dialog-backdrop" hidden>
      <section class="dialog property-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title" tabindex="-1" data-dialog-default="#info-close" data-dialog-cancel="#info-close">
        <div class="dialog-header">
          <div>
            <h2 id="info-title" data-i18n-text="info.title">Info</h2>
            <p id="info-description" data-i18n-text="info.description">Archive or entry details.</p>
          </div>
        </div>
        <div class="dialog-body property-dialog-body">
          <div id="info-dialog-body" class="diagnostics"></div>
        </div>
        <div class="dialog-actions">
          <div id="info-action-group" class="dialog-action-group"></div>
          <button id="info-close" type="button" data-dialog-default-button data-dialog-cancel-button data-i18n-text="common.close">Close</button>
        </div>
      </section>
    </div>
  </main>
`;

const workspaceElement = document.querySelector<HTMLElement>(".workspace")!;
const commandToolbarElement = document.querySelector<HTMLDivElement>(".command-toolbar")!;
const modeCompressButton = document.querySelector<HTMLButtonElement>("#mode-compress")!;
const modeExtractButton = document.querySelector<HTMLButtonElement>("#mode-extract")!;
const statusElement = document.querySelector<HTMLElement>("#workspace-status")!;
const statusTextElement = document.querySelector<HTMLSpanElement>("#status-text")!;
const statusSelectionCountElement = document.querySelector<HTMLSpanElement>("#status-selection-count")!;
const statusSelectionSizeElement = document.querySelector<HTMLSpanElement>("#status-selection-size")!;
const statusFocusedSizeElement = document.querySelector<HTMLSpanElement>("#status-focused-size")!;
const statusFocusedModifiedElement = document.querySelector<HTMLSpanElement>("#status-focused-modified")!;
const activeJobElement = document.querySelector<HTMLSpanElement>("#active-job-text")!;
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

const openArchiveButton = document.querySelector<HTMLButtonElement>("#open-archive")!;
const newArchiveButton = document.querySelector<HTMLButtonElement>("#new-archive")!;
const addArchiveButton = document.querySelector<HTMLButtonElement>("#add-archive")!;
const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const testArchiveButton = document.querySelector<HTMLButtonElement>("#test-archive")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const jobsDrawerOpenButton = document.querySelector<HTMLButtonElement>("#jobs-drawer-open")!;
const preferencesToolbarButton = document.querySelector<HTMLButtonElement>("#preferences-toolbar")!;
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive")!;
const navBackButton = document.querySelector<HTMLButtonElement>("#nav-back")!;
const navUpButton = document.querySelector<HTMLButtonElement>("#nav-up")!;
const appMenuElement = document.querySelector<HTMLElement>(".app-menu")!;
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
const compressSourceBody = document.querySelector<HTMLTableSectionElement>("#compress-source-body")!;
const compressSourceTable = document.querySelector<HTMLTableElement>("#compress-source-table")!;
const compressIncludeAllInput = document.querySelector<HTMLInputElement>("#compress-include-all")!;
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
const extractPasswordOptions = document.querySelector<HTMLDetailsElement>(".extract-password-options")!;
const browseOverwriteSelect = document.querySelector<HTMLSelectElement>("#browse-overwrite")!;
const browseStripInput = document.querySelector<HTMLInputElement>("#browse-strip-components")!;
const extractUseSubfolderCheckbox = document.querySelector<HTMLInputElement>("#extract-use-subfolder")!;
const extractSubfolderInput = document.querySelector<HTMLInputElement>("#extract-subfolder")!;
const extractPathModeSelect = document.querySelector<HTMLSelectElement>("#extract-path-mode")!;
const extractDeduplicateRootCheckbox = document.querySelector<HTMLInputElement>("#extract-deduplicate-root")!;

const addSourceButton = document.querySelector<HTMLButtonElement>("#add-source")!;
const includeAllSourcesButton = document.querySelector<HTMLButtonElement>("#include-all-sources")!;
const excludeAllSourcesButton = document.querySelector<HTMLButtonElement>("#exclude-all-sources")!;
const clearSourcesButton = document.querySelector<HTMLButtonElement>("#clear-sources")!;
const sourceListElement = document.querySelector<HTMLUListElement>("#source-list")!;
const createFormatSelect = document.querySelector<HTMLSelectElement>("#create-format")!;
const createDestinationInput = document.querySelector<HTMLInputElement>("#create-destination")!;
const createDestinationHistoryList = document.querySelector<HTMLDataListElement>("#create-destination-history")!;
const createDestinationRecentSelect = document.querySelector<HTMLSelectElement>("#create-destination-recent")!;
const browseCreateDestinationButton = document.querySelector<HTMLButtonElement>("#browse-create-destination")!;
const createCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#create-clean-source")!;
const createPreserveMetadataCheckbox = document.querySelector<HTMLInputElement>("#create-preserve-metadata")!;
const createReplaceExistingCheckbox = document.querySelector<HTMLInputElement>("#create-replace-existing")!;
const createRespectGitignoreCheckbox = document.querySelector<HTMLInputElement>("#create-respect-gitignore")!;
const createPasswordInput = document.querySelector<HTMLInputElement>("#create-password")!;
const createPasswordConfirmInput = document.querySelector<HTMLInputElement>("#create-password-confirm")!;
const createShowPasswordInput = document.querySelector<HTMLInputElement>("#create-show-password")!;
const createPasswordOptions = document.querySelector<HTMLDivElement>("#create-password-options")!;
const createCompressionInput = document.querySelector<HTMLSelectElement>("#create-compression-level")!;
const createVolumeInput = document.querySelector<HTMLInputElement>("#create-volume")!;
const createTzapRecoveryField = document.querySelector<HTMLLabelElement>("#create-tzap-recovery-field")!;
const createTzapRecoveryInput = document.querySelector<HTMLInputElement>("#create-tzap-recovery")!;
const createPlanMeta = document.querySelector<HTMLParagraphElement>("#create-plan-meta")!;
const createPlanSummary = document.querySelector<HTMLDivElement>("#create-plan-summary")!;
const startCreateButton = document.querySelector<HTMLButtonElement>("#start-create")!;

const jobsListElement = document.querySelector<HTMLDivElement>("#jobs-list")!;
const refreshJobsButton = document.querySelector<HTMLButtonElement>("#refresh-jobs")!;
const jobDrawer = document.querySelector<HTMLElement>("#job-drawer")!;
const statusJobButton = document.querySelector<HTMLButtonElement>("#status-job-button")!;
const jobDrawerCloseButton = document.querySelector<HTMLButtonElement>("#job-drawer-close")!;
const quickProgressElement = document.querySelector<HTMLElement>("#quick-progress")!;
const quickTitleElement = document.querySelector<HTMLHeadingElement>("#quick-title")!;
const quickSubtitleElement = document.querySelector<HTMLParagraphElement>("#quick-subtitle")!;
const quickContextElement = document.querySelector<HTMLDListElement>("#quick-context")!;
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
const quickBackgroundButton = document.querySelector<HTMLButtonElement>("#quick-background")!;
const quickContinueButton = document.querySelector<HTMLButtonElement>("#quick-continue")!;
const quickCancelButton = document.querySelector<HTMLButtonElement>("#quick-cancel")!;
const contextMenu = document.querySelector<HTMLDivElement>("#context-menu")!;
const dropOverlay = document.querySelector<HTMLDivElement>("#drop-overlay")!;
const dropOverlayTitle = document.querySelector<HTMLElement>("#drop-overlay-title")!;
const dropOverlayMessage = document.querySelector<HTMLElement>("#drop-overlay-message")!;
const dropOverlaySupport = document.querySelector<HTMLElement>("#drop-overlay-support")!;
const dropOverlayActions = document.querySelector<HTMLDivElement>("#drop-overlay-actions")!;
const dropOpenArchiveButton = document.querySelector<HTMLButtonElement>("#drop-open-archive")!;
const dropAddCompressButton = document.querySelector<HTMLButtonElement>("#drop-add-compress")!;
const dropCancelButton = document.querySelector<HTMLButtonElement>("#drop-cancel")!;

const aboutDialog = document.querySelector<HTMLDivElement>("#about-dialog")!;
const aboutDiagnostics = document.querySelector<HTMLDivElement>("#about-diagnostics")!;
const copyDiagnosticsButton = document.querySelector<HTMLButtonElement>("#copy-diagnostics")!;
const preferencesDialog = document.querySelector<HTMLDivElement>("#preferences-dialog")!;
const preferencesLocaleSelect = document.querySelector<HTMLSelectElement>("#pref-language")!;
const preferencesDefaultFormatSelect = document.querySelector<HTMLSelectElement>("#pref-default-format")!;
const preferencesDefaultExtractionSelect = document.querySelector<HTMLSelectElement>("#pref-default-extraction")!;
const preferencesOutputLocationSelect = document.querySelector<HTMLSelectElement>("#pref-output-location")!;
const preferencesPreviewCleanupSelect = document.querySelector<HTMLSelectElement>("#pref-preview-cleanup")!;
const preferencesCustomOutputInput = document.querySelector<HTMLInputElement>("#pref-custom-output")!;
const preferencesChooseOutputButton = document.querySelector<HTMLButtonElement>("#pref-choose-output")!;
const preferencesCustomOutputValidation = document.querySelector<HTMLElement>("#pref-custom-output-validation")!;
const preferencesPageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-pref-page-target]"));
const preferencesPages = Array.from(document.querySelectorAll<HTMLElement>("[data-pref-page]"));
const preferencesCreateFormatSelect = document.querySelector<HTMLSelectElement>("#pref-create-format")!;
const preferencesCreateCompressionSelect = document.querySelector<HTMLSelectElement>("#pref-create-compression-level")!;
const preferencesCreateVolumeInput = document.querySelector<HTMLInputElement>("#pref-create-volume")!;
const preferencesCreateTzapRecoveryField = document.querySelector<HTMLLabelElement>("#pref-create-tzap-recovery-field")!;
const preferencesCreateTzapRecoveryInput = document.querySelector<HTMLInputElement>("#pref-create-tzap-recovery")!;
const preferencesCreateCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#pref-create-clean-source")!;
const preferencesCreatePreserveMetadataCheckbox = document.querySelector<HTMLInputElement>("#pref-create-preserve-metadata")!;
const preferencesCreateReplaceExistingCheckbox = document.querySelector<HTMLInputElement>("#pref-create-replace-existing")!;
const preferencesCreatePromptPasswordCheckbox = document.querySelector<HTMLInputElement>("#pref-create-prompt-password")!;
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
  localeSelect: preferencesLocaleSelect,
  defaultFormatSelect: preferencesDefaultFormatSelect,
  defaultExtractionSelect: preferencesDefaultExtractionSelect,
  outputLocationSelect: preferencesOutputLocationSelect,
  previewCleanupSelect: preferencesPreviewCleanupSelect,
  customOutputInput: preferencesCustomOutputInput,
  chooseOutputButton: preferencesChooseOutputButton,
  customOutputValidation: preferencesCustomOutputValidation,
  createFormatSelect: preferencesCreateFormatSelect,
  createCompressionLevelSelect: preferencesCreateCompressionSelect,
  createVolumeInput: preferencesCreateVolumeInput,
  createTzapRecoveryField: preferencesCreateTzapRecoveryField,
  createTzapRecoveryInput: preferencesCreateTzapRecoveryInput,
  createCleanSourceCheckbox: preferencesCreateCleanSourceCheckbox,
  createPreserveMetadataCheckbox: preferencesCreatePreserveMetadataCheckbox,
  createReplaceExistingCheckbox: preferencesCreateReplaceExistingCheckbox,
  createPromptPasswordCheckbox: preferencesCreatePromptPasswordCheckbox,
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
const infoDescription = document.querySelector<HTMLParagraphElement>("#info-description")!;
const infoActionGroup = document.querySelector<HTMLDivElement>("#info-action-group")!;

let workspaceMode: WorkspaceDropMode = "compress";
let pendingDropChoice: Extract<DropIntentDecision, { kind: "askAction" }> | null = null;
let currentArchivePath = "";
let currentArchiveFolder = "";
let currentArchiveEntryCount = 0;
let currentArchiveTotalSize: number | null = null;
let browseState: BrowseState = "idle";
let browseError = "";
let browseEntries: ArchiveEntryDto[] = [];
let selectedEntries = new Set<string>();
let selectedCompressRows = new Set<string>();
let navigationHistory: string[] = [];
let appPreferences: AppPreferences = loadAppPreferences();
let resolvedLocale: SupportedLocale = resolveLocalePreference(appPreferences.locale);
let i18n: Translator = createTranslator(resolvedLocale);
let preferencesDialogDraft: AppPreferences | null = null;
let systemIconDataUrls = new Map<string, string | null>();
let systemIconRequestRevision = 0;
let tableColumnSettings: ArchiveTableColumnSettings = normalizeColumnSettings({
  visibleColumnIds: appPreferences.tableVisibleColumnIds,
  columnOrderIds: appPreferences.tableColumnOrderIds,
  columnWidths: appPreferences.tableColumnWidths,
});
let compressSourceColumnWidths: Record<CompressSourceColumnId, number> | null = null;
let sortKey: ArchiveSortKey = appPreferences.tableSortKey;
let sortAscending = appPreferences.tableSortAscending;
let isFlatView = appPreferences.flatViewDefault;
let focusedEntryPath = "";
let selectionAnchorPath = "";
let focusedCompressRowPath = "";
let compressSelectionAnchorPath = "";
let activeExtractMode: ExtractMode = "archive";
let contextEntryPath = "";
let contextSourcePath = "";
let contextMenuReturnFocus: HTMLElement | null = null;
let extractDestinationHistory: string[] = [];
let createDestinationHistory: string[] = [];
let recentArchiveHistory: string[] = [];
const archiveTreeRootPath = "";
const expandedArchiveTreeFolders = new Set<string>([archiveTreeRootPath]);
let archiveTreeChildrenByParent = new Map<string, string[]>();

let createSources: string[] = [];
let createPlanState: CreateState = "idle";
let currentPlan: CreatePlanResponse | null = null;
let currentCompressFolder = "";
let excludedCreateArchivePaths = new Set<string>();
const expandedCompressTreeFolders = new Set<string>([archiveTreeRootPath]);
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
const jobOutputActions = new Map<string, JobOutputAction[]>();
const promptedPasswordRetryJobs = new Set<string>();
let pollTimer: number | null = null;
let progressClockTimer: number | null = null;
let pollInFlight = false;
let pollAgainRequested = false;
let quickActionWindowMode: QuickActionWindowMode = "normal";
let quickActionWindowShown = false;
let quickActionAutoCloseTimer: number | null = null;
let quickActionAutoCloseAction: FocusedJobAutoCloseAction = "closeWindow";
const quickActionJobIds = new Set<string>();
const focusedJobProgressContexts = new Map<string, FocusedJobProgressContext>();
let normalWorkspaceRendered = false;
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

function applySortDirection(nextSortKey: ArchiveSortKey, ascending: boolean) {
  sortKey = nextSortKey;
  sortAscending = ascending;
  saveTablePreferences();
  renderBrowse();
}

function closeAppWindow() {
  if (!isDesktopRuntime()) {
    setOperationalMessage("status.closeInBrowser");
    return;
  }

  void getCurrentWindow().close().catch(() => {
    setOperationalMessage("quick.completed.closeWindow");
  });
}

function minimizeAppWindow() {
  if (!isDesktopRuntime()) {
    return;
  }

  void getCurrentWindow().minimize().catch(() => {
    setOperationalMessage("jobs.minimizeFailed");
  });
}

function toggleAppWindowMaximize() {
  if (!isDesktopRuntime()) {
    return;
  }

  void getCurrentWindow().toggleMaximize().catch(() => {
    setOperationalMessage("status.windowControlFailed");
  });
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

function isQuickActionJobMode(): boolean {
  return quickActionWindowMode === "jobOnly" || quickActionWindowMode === "background";
}

function setFocusedJobAutoCloseAction(action: FocusedJobAutoCloseAction) {
  quickActionAutoCloseAction = action;
}

function renderNormalWorkspaceOnce() {
  if (normalWorkspaceRendered) {
    return;
  }

  syncCompressOptionsPanelDisclosure();
  renderExtractDestinationHistory();
  renderCreateDestinationHistory();
  renderCreateSources();
  renderCompressBrowser();
  renderBrowse();
  renderJobs();
  normalWorkspaceRendered = true;
}

function syncCompressOptionsPanelDisclosure() {
  compressOptionsPanel.open = !compactCompressOptionsQuery.matches;
}

async function revealNormalAppWindow() {
  renderNormalWorkspaceOnce();
  if (!isDesktopRuntime() || quickActionWindowShown) {
    return;
  }

  try {
    await placeNormalAppWindowBeforeShow();
    await getCurrentWindow().show();
  } catch {
    // Window APIs are best-effort; the app is still usable if the window was already shown.
  }
  quickActionWindowShown = true;
}

async function revealQuickActionJobWindow(
  autoCloseAction: FocusedJobAutoCloseAction = "closeWindow",
) {
  const wasInJobMode = isQuickActionJobMode();
  if (!wasInJobMode || autoCloseAction === "closeWindow") {
    setFocusedJobAutoCloseAction(autoCloseAction);
  }
  if (!wasInJobMode && autoCloseAction === "returnToWorkspace") {
    void persistWindowGeometry();
  }
  quickActionWindowMode = "jobOnly";
  workspaceElement.dataset.quickActionMode = "job-only";
  document.body.classList.add("quick-action-job-mode");
  quickProgressElement.hidden = false;
  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
  renderQuickProgress();

  if (!isDesktopRuntime()) {
    return;
  }

  const currentWindow = getCurrentWindow();
  try {
    await currentWindow.unminimize();
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
  } catch {
    // Do not block job tracking on window-manager or permission failures.
  }
  quickActionWindowShown = true;
}

async function sendQuickActionJobsToBackground() {
  clearQuickActionAutoCloseTimer();
  if (quickActionAutoCloseAction === "returnToWorkspace") {
    await closeFocusedJobProgress();
    setOperationalMessage("jobs.background");
    openJobDrawer();
    renderJobs();
    return;
  }

  if (isDesktopRuntime()) {
    const currentWindow = getCurrentWindow();
    quickActionWindowMode = "background";
    quickBackgroundButton.disabled = true;
    setOperationalMessage("jobs.background");
    try {
      await currentWindow.minimize();
      quickActionWindowShown = false;
      return;
    } catch {
      setOperationalMessage("jobs.minimizeFailed");
      renderQuickProgress();
      return;
    }
  }

  quickActionJobIds.clear();
  focusedJobProgressContexts.clear();
  quickActionWindowMode = "normal";
  quickActionAutoCloseAction = "closeWindow";
  document.body.classList.remove("quick-action-job-mode");
  delete workspaceElement.dataset.quickActionMode;
  quickProgressElement.hidden = true;
  setOperationalMessage("jobs.background");
  openJobDrawer();
  renderJobs();
}

async function closeFocusedJobProgress() {
  clearQuickActionAutoCloseTimer();
  quickActionJobIds.clear();
  focusedJobProgressContexts.clear();
  quickActionWindowMode = "normal";
  quickActionAutoCloseAction = "closeWindow";
  document.body.classList.remove("quick-action-job-mode");
  delete workspaceElement.dataset.quickActionMode;
  quickProgressElement.hidden = true;
  quickBackgroundButton.disabled = true;
  quickContinueButton.disabled = true;
  quickCancelButton.disabled = true;
  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
  renderNormalWorkspaceOnce();

  if (isDesktopRuntime()) {
    try {
      await placeNormalAppWindowBeforeShow();
    } catch {
      // Window restoration is best-effort after a focused job view.
    }
  }
  quickActionWindowShown = true;
  renderJobs();
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

function trackQuickActionJob(jobId: string, context?: FocusedJobProgressContext) {
  if (!isQuickActionJobMode()) {
    return;
  }

  clearQuickActionAutoCloseTimer();
  quickActionJobIds.add(jobId);
  if (context) {
    focusedJobProgressContexts.set(jobId, context);
  }
  renderQuickProgress();
}

function quickActionControllableJobIds(): string[] {
  return Array.from(quickActionJobIds).filter((jobId) => {
    const state = jobs.get(jobId);
    return state ? isLiveJobStatus(state.snapshot.status) : false;
  });
}

async function toggleQuickActionPause() {
  const jobIds = quickActionControllableJobIds();
  if (!jobIds.length) {
    return;
  }

  const shouldResume = jobIds.some((jobId) => jobs.get(jobId)?.snapshot.status === "paused");
  const command = shouldResume ? resumeJobCommand : pauseJobCommand;
  quickContinueButton.disabled = true;

  try {
    await Promise.all(
      jobIds.map(async (jobId) => {
        const response = await command({ jobId });
        const state = jobs.get(jobId);
        if (state) {
          jobs.set(jobId, {
            ...state,
            snapshot: {
              ...state.snapshot,
              status: response.status,
            },
          });
        }
      }),
    );
    setOperationalMessage(shouldResume ? "jobs.continued" : "jobs.paused");
    await pollJobs();
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.updateFailed"));
    renderJobs();
  }
}

async function cancelFocusedQuickActionJobs() {
  const jobIds = quickActionControllableJobIds();
  if (!jobIds.length) {
    return;
  }

  quickCancelButton.disabled = true;
  quickContinueButton.disabled = true;
  quickBackgroundButton.disabled = true;

  try {
    await Promise.all(jobIds.map((jobId) => cancelJobCommand({ jobId })));
    await pollJobs();
    setOperationalMessage("jobs.cancelled");
    if (quickActionAutoCloseAction === "returnToWorkspace") {
      await closeFocusedJobProgress();
    } else {
      closeAppWindow();
    }
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.cancelFailed"));
    renderJobs();
  }
}

function maybeCloseCompletedQuickActionWindow() {
  if (
    !isDesktopRuntime() ||
    !isQuickActionJobMode() ||
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
    setOperationalMessage("jobs.needsAttention");
    if (quickActionWindowMode === "background") {
      void revealQuickActionJobWindow();
    } else {
      renderQuickProgress();
    }
    return;
  }

  setOperationalMessage("jobs.completed");
  renderQuickProgress();
  quickActionAutoCloseTimer = window.setTimeout(() => {
    if (quickActionAutoCloseAction === "returnToWorkspace") {
      void closeFocusedJobProgress();
    } else {
      closeAppWindow();
    }
  }, QUICK_ACTION_AUTO_CLOSE_DELAY_MS);
}

function clearTrackedPreviewState() {
  currentPreviewCleanupRoot = "";
  currentPreviewPath = "";
  currentPreviewEntryPath = "";
}

function updateStatusBar() {
  const visibleEntries = getVisibleSelectablePaths();
  const visibleSelectedRows = getVisibleSelectedRows();
  const selectedTotal = visibleSelectedRows.length;
  const selectedBytes = visibleSelectedRows.reduce((total, row) => total + (row.entry?.size ?? 0), 0);
  const focusedEntry = focusedEntryPath && visibleEntries.includes(focusedEntryPath)
    ? getEntryByPath(focusedEntryPath)
    : null;

  statusSelectionCountElement.textContent = message("status.selectionCount", {
    selected: selectedTotal,
    total: visibleEntries.length,
  });
  statusSelectionSizeElement.textContent = selectedTotal > 0
    ? message("status.selectedSize", { size: formatBytes(selectedBytes) })
    : "";

  statusFocusedSizeElement.textContent = focusedEntry
    ? message("status.focusedSize", { size: formatBytes(focusedEntry.size) })
    : "";
  statusFocusedModifiedElement.textContent = focusedEntry
    ? message("status.focusedModified", { date: formatDate(focusedEntry.modified) })
    : "";
}

function applyPreferenceClasses() {
  workspaceElement.classList.toggle("toolbar-hidden", !appPreferences.toolbarVisible);
  commandToolbarElement?.classList.toggle("large", appPreferences.largeToolbarButtons);
  commandToolbarElement?.classList.toggle("show-labels", appPreferences.showToolbarLabels);
  entryTable.classList.toggle("show-grid", appPreferences.showGridLines);
  entryTable.classList.toggle("full-row-select", appPreferences.fullRowSelect);
  entryTable.classList.toggle("single-click-open", appPreferences.singleClickOpen);
  compressSourceTable.classList.toggle("show-grid", appPreferences.showGridLines);
  compressSourceTable.classList.toggle("full-row-select", appPreferences.fullRowSelect);
  compressSourceTable.classList.toggle("single-click-open", appPreferences.singleClickOpen);
}

function formatBytes(value?: number): string {
  return formatBytesValue(value, { locale: resolvedLocale });
}

function escapeHtml(value: string): string {
  return escapeHtmlValue(value);
}

function message(key: MessageKey, params?: Parameters<Translator["t"]>[1]): string {
  return i18n.t(key, params);
}

function setOperationalMessage(key: MessageKey, params?: Parameters<Translator["t"]>[1]): void {
  setOperationalStatus(message(key, params));
}

function formatJobKind(kind: JobKind): string {
  switch (kind) {
    case "zipCreate":
      return i18n.t("jobs.kind.zipCreate");
    case "zipExtract":
      return i18n.t("jobs.kind.zipExtract");
    case "sevenZCreate":
      return i18n.t("jobs.kind.sevenZCreate");
    case "sevenZExtract":
      return i18n.t("jobs.kind.sevenZExtract");
    case "rarExtract":
      return i18n.t("jobs.kind.rarExtract");
    case "tarZstdCreate":
      return i18n.t("jobs.kind.tarZstdCreate");
    case "tarZstdExtract":
      return i18n.t("jobs.kind.tarZstdExtract");
    case "tzapCreate":
      return i18n.t("jobs.kind.tzapCreate");
    case "tzapExtract":
      return i18n.t("jobs.kind.tzapExtract");
    case "appleArchiveCreate":
      return i18n.t("jobs.kind.appleArchiveCreate");
    case "appleArchiveExtract":
      return i18n.t("jobs.kind.appleArchiveExtract");
    case "archiveExtract":
      return i18n.t("jobs.kind.archiveExtract");
    case "rawStreamExtract":
      return i18n.t("jobs.kind.rawStreamExtract");
    case "testArchive":
      return i18n.t("jobs.kind.testArchive");
    default:
      return String(kind);
  }
}

function formatDate(value?: string): string {
  return formatDateValue(value, { emptyValue: "", locale: resolvedLocale });
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
    case "appleArchiveCreate":
      return message("quick.operation.adding");
    case "zipExtract":
    case "sevenZExtract":
    case "rarExtract":
    case "tarZstdExtract":
    case "tzapExtract":
    case "appleArchiveExtract":
    case "archiveExtract":
    case "rawStreamExtract":
      return message("quick.operation.extracting");
    case "testArchive":
      return message("quick.operation.testing");
    default:
      return message("quick.operation.starting");
  }
}

function renderFocusedJobContext(context?: FocusedJobProgressContext) {
  if (!context || context.rows.length === 0) {
    quickContextElement.hidden = true;
    quickContextElement.innerHTML = "";
    return;
  }

  quickContextElement.hidden = false;
  quickContextElement.innerHTML = context.rows
    .map((row) => `
      <div>
        <dt>${escapeHtml(row.label)}</dt>
        <dd>${escapeHtml(row.value)}</dd>
      </div>
    `)
    .join("");
}

function renderQuickProgress() {
  if (!isQuickActionJobMode()) {
    return;
  }

  const trackedJobs = Array.from(quickActionJobIds, (jobId) => jobs.get(jobId)).filter(
    (job): job is JobState => Boolean(job),
  );

  if (!trackedJobs.length) {
    quickTitleElement.textContent = message("quick.progress.title");
    quickSubtitleElement.textContent = "";
    renderFocusedJobContext();
    quickElapsedElement.textContent = "00:00:00";
    quickRemainingElement.textContent = "--:--:--";
    quickFilesElement.textContent = "0";
    quickTotalFilesElement.textContent = "";
    quickTotalSizeElement.textContent = "";
    quickSpeedElement.textContent = "";
    quickProcessedElement.textContent = "";
    quickCompressedSizeElement.textContent = "";
    quickRatioElement.textContent = "";
    quickOperationElement.textContent = message("quick.operation.starting");
    quickCurrentPathElement.textContent = "";
    quickProgressBar.removeAttribute("value");
    quickProgressBar.removeAttribute("max");
    quickBackgroundButton.disabled = true;
    quickContinueButton.disabled = true;
    quickContinueButton.textContent = message("quick.pause");
    quickCancelButton.disabled = true;
    return;
  }

  const nowMs = Date.now();
  const progressSnapshots = trackedJobs.map((job) => deriveJobProgress(job, nowMs));
  const latestJob = trackedJobs.at(-1);
  const latestProgress = progressSnapshots.at(-1);
  const latestContext = latestJob ? focusedJobProgressContexts.get(latestJob.snapshot.jobId) : undefined;
  const allTerminal = trackedJobs.every((job) => isTerminalJobStatus(job.snapshot.status));
  const anyActive = trackedJobs.some((job) => isLiveJobStatus(job.snapshot.status));
  const anyPaused = trackedJobs.some((job) => job.snapshot.status === "paused");
  const elapsedMs = Math.max(...progressSnapshots.map((progress) => progress.elapsedMs), 0);
  const processedBytes = progressSnapshots.reduce((total, progress) => total + progress.processedBytes, 0);
  const totalBytes = progressSnapshots.every((progress) => progress.totalBytes !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.totalBytes ?? 0), 0)
    : null;
  const processedFiles = progressSnapshots.reduce((total, progress) => total + progress.processedFiles, 0);
  const totalFiles = progressSnapshots.every((progress) => progress.totalFiles !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.totalFiles ?? 0), 0)
    : null;
  const compressedBytes = progressSnapshots.every((progress) => progress.compressedBytes !== null)
    ? progressSnapshots.reduce((total, progress) => total + (progress.compressedBytes ?? 0), 0)
    : null;
  const remainingMs = totalBytes !== null && processedBytes > 0 && elapsedMs > 0
    ? Math.max(0, ((totalBytes - processedBytes) / (processedBytes / elapsedMs)))
    : totalFiles !== null && processedFiles > 0 && elapsedMs > 0
      ? Math.max(0, ((totalFiles - processedFiles) / (processedFiles / elapsedMs)))
    : null;
  const speedBytesPerSecond = elapsedMs > 0 && processedBytes > 0
    ? processedBytes / (elapsedMs / 1000)
    : null;
  const progressPercent = totalBytes !== null && totalBytes > 0
    ? Math.max(0, Math.min(100, (processedBytes / totalBytes) * 100))
    : totalFiles !== null && totalFiles > 0
      ? Math.max(0, Math.min(100, (processedFiles / totalFiles) * 100))
    : allTerminal && trackedJobs.every((job) => job.snapshot.status === "completed")
      ? 100
      : null;
  const currentFile = latestProgress?.currentFile || latestProgress?.latestStatusMessage || "";
  const operation = allTerminal
    ? latestJob?.snapshot.status === "completed"
      ? message("quick.operation.completed")
      : latestJob?.snapshot.status === "cancelled"
        ? message("quick.operation.cancelled")
        : message("quick.operation.failed")
    : anyPaused
      ? message("quick.operation.paused")
    : quickActionOperationLabel(latestJob?.snapshot.kind);

  quickTitleElement.textContent = trackedJobs.length > 1
    ? message("quick.progress.multipleJobs", { count: trackedJobs.length })
    : latestContext?.title ?? (latestJob ? formatJobKind(latestJob.snapshot.kind) : message("quick.progress.jobTitle"));
  quickSubtitleElement.textContent = latestContext?.subtitle ?? "";
  renderFocusedJobContext(latestContext);
  quickElapsedElement.textContent = formatDurationClock(elapsedMs);
  quickRemainingElement.textContent = formatDurationClock(remainingMs);
  quickFilesElement.textContent = totalFiles === null ? String(processedFiles) : `${processedFiles} / ${totalFiles}`;
  quickTotalFilesElement.textContent = trackedJobs.length > 1
    ? message("quick.progress.totalJobs", { count: trackedJobs.length })
    : "";
  quickTotalSizeElement.textContent = totalBytes === null ? "" : formatBytes(totalBytes);
  quickSpeedElement.textContent = speedBytesPerSecond === null ? "" : `${formatBytes(speedBytesPerSecond)}/s`;
  quickProcessedElement.textContent = processedBytes > 0 ? formatBytes(processedBytes) : "";
  quickCompressedSizeElement.textContent = compressedBytes === null ? "" : formatBytes(compressedBytes);
  quickRatioElement.textContent = compressedBytes === null || totalBytes === null
    ? ""
    : formatCompressionRatio(totalBytes, compressedBytes, { emptyValue: "", fractionDigits: 0, locale: resolvedLocale });
  quickOperationElement.textContent = operation;
  quickCurrentPathElement.textContent = currentFile;
  quickBackgroundButton.disabled = allTerminal || anyPaused || quickActionWindowMode === "background";
  quickContinueButton.disabled = !anyActive;
  quickContinueButton.textContent = anyPaused ? message("common.continue") : message("quick.pause");
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
  return formatCompressionRatio(entry.size, entry.compressedSize, { fractionDigits: 0, locale: resolvedLocale });
}

type DetailValueMode = "wrap" | "middle";

type DetailRow = {
  label: string;
  value?: string | null;
  mode?: DetailValueMode;
};

type InfoAction = {
  label: string;
  action?: string;
  copyValue?: string;
  primary?: boolean;
  title?: string;
};

function middleTruncateDetailValue(value: string, maxLength = 88): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.max(12, Math.ceil((maxLength - 3) * 0.52));
  const tailLength = Math.max(12, maxLength - headLength - 3);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

function detailValueMode(value: string): DetailValueMode {
  return /[\\/]/.test(value) && value.length > 48 ? "middle" : "wrap";
}

function renderDetailDefinition(label: string, value?: string | null, mode?: DetailValueMode): string {
  if (!value) {
    return "";
  }

  const valueMode = mode ?? detailValueMode(value);
  const displayValue = valueMode === "middle" ? middleTruncateDetailValue(value) : value;
  const visibleValue = valueMode === "middle"
    ? `<span class="detail-value detail-value-${valueMode}" aria-hidden="true">${escapeHtml(displayValue)}</span><span class="sr-only">${escapeHtml(value)}</span>`
    : `<span class="detail-value detail-value-${valueMode}">${escapeHtml(displayValue)}</span>`;
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd class="detail-copyable" title="${escapeHtmlValue(value)}" aria-label="${escapeHtmlValue(`${label}: ${value}`)}">
        ${visibleValue}
        <button class="detail-copy-button" type="button" data-copy-value="${escapeHtmlValue(value)}" aria-label="${escapeHtmlValue(`${message("command.copy")} ${label}`)}" title="${escapeHtmlValue(message("command.copy"))}">
          ${toolbarIcon("copy")}
        </button>
      </dd>
    </div>
  `;
}

function addDetailRow(label: string, value?: string | null): string {
  return renderDetailDefinition(label, value);
}

function addDetailMessageRow(key: MessageKey, value?: string | null): string {
  return addDetailRow(message(key), value);
}

function renderDetailRows(rows: readonly DetailRow[]): string {
  return rows
    .map((row) => renderDetailDefinition(row.label, row.value, row.mode))
    .filter(Boolean)
    .join("");
}

function detailRowsToText(rows: readonly DetailRow[]): string {
  return rows
    .filter((row): row is DetailRow & { value: string } => Boolean(row.value))
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
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

function infoActionButton(action: InfoAction): string {
  const actionAttribute = action.action ? ` data-info-action="${escapeHtmlValue(action.action)}"` : "";
  const copyAttribute = action.copyValue ? ` data-copy-value="${escapeHtmlValue(action.copyValue)}"` : "";
  const titleAttribute = action.title ? ` title="${escapeHtmlValue(action.title)}" aria-label="${escapeHtmlValue(`${action.label}: ${action.title}`)}"` : "";
  return `<button type="button" class="${action.primary ? "primary-action" : ""}"${actionAttribute}${copyAttribute}${titleAttribute}>${escapeHtml(action.label)}</button>`;
}

function setInfoActions(actions: readonly InfoAction[]) {
  infoActionGroup.innerHTML = actions.map(infoActionButton).join("");
}

function infoReturnFocusForCurrentSelection(): HTMLElement | null {
  const selectedPath = focusedEntryPath || getSelectedEntryPaths()[0] || "";
  if (!selectedPath) {
    return null;
  }
  return tableBody.querySelector<HTMLElement>(`tr[data-entry-path="${CSS.escape(selectedPath)}"]`);
}

function previewActionHint(): string {
  return message("preview.openTempOutsideHint");
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

  const testJobs = Array.from(jobs.entries())
    .map(([jobId, state]) => ({ jobId, state }))
    .filter((item) => {
      const context = jobRetryContexts.get(item.jobId);
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

  const headLength = Math.max(8, Math.ceil((maxLength - 3) * 0.58));
  const tailLength = Math.max(8, maxLength - headLength - 3);
  return `${preview.slice(0, headLength)}...${preview.slice(-tailLength)}`;
}

function normalizeEntryPath(path: string): string {
  return normalizeArchivePath(path);
}

function progressContextRows(rows: Array<{ label: string; value?: string | null }>): FocusedJobProgressContext["rows"] {
  return rows
    .filter((row): row is { label: string; value: string } => Boolean(row.value))
    .map((row) => ({ label: row.label, value: row.value }));
}

function createJobProgressContext(request: StartCreateRequest): FocusedJobProgressContext {
  const sourcePreview = truncatedPathPreview(request.sources, 3, 180);
  const sourceLabel = request.sources.length === 1 ? "Source" : "Sources";
  return {
    title: "Create archive",
    subtitle: getPathBasename(request.destinationPath) || request.destinationPath,
    rows: progressContextRows([
      { label: sourceLabel, value: sourcePreview },
      { label: "Destination", value: request.destinationPath },
      { label: "Format", value: request.format },
      { label: "Clean source", value: request.cleanSource ? "Yes" : "No" },
      {
        label: "Recovery",
        value: request.format === "tzap" && request.tzapRecoveryPercentage !== undefined
          ? `${request.tzapRecoveryPercentage}%`
          : null,
      },
    ]),
  };
}

function createJobOutputActions(request: StartCreateRequest): JobOutputAction[] {
  return request.destinationPath ? [{ kind: "reveal", path: request.destinationPath }] : [];
}

function extractJobProgressContext(
  request: StartExtractRequest,
  label = "Extract archive",
): FocusedJobProgressContext {
  const entryCount = request.entryPaths?.length ?? 0;
  const entryPreview = request.entryPaths ? truncatedPathPreview(request.entryPaths, 3, 180) : null;
  return {
    title: label,
    subtitle: getPathBasename(request.archivePath) || request.archivePath,
    rows: progressContextRows([
      { label: "Archive", value: request.archivePath },
      { label: "Destination", value: request.destinationPath },
      { label: "Entries", value: entryCount > 0 ? `${entryCount} selected${entryPreview ? `: ${entryPreview}` : ""}` : "All entries" },
      { label: "Overwrite", value: request.overwrite },
    ]),
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

function getVisibleSelectedEntryDtos(): ArchiveEntryDto[] {
  return getVisibleSelectedRows()
    .map((row) => row.entry ?? getEntryByPath(row.path))
    .filter((entry): entry is ArchiveEntryDto => entry !== null);
}

function getVisibleSelectedRows(): SelectableBrowserRow[] {
  return visibleRows().filter((row): row is SelectableBrowserRow => {
    if (row.rowType !== "entry" && row.rowType !== "folder") {
      return false;
    }
    return selectedEntries.has(row.path);
  });
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
    setOperationalMessage("preview.nativeDragDesktopOnly");
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
    setOperationalMessage("preview.selectEntryToDrag");
    return;
  }

  setOperationalMessage("preview.preparingDrag", { count: request.entryPaths.length });

  while (true) {
    try {
      const response = await runStartNativeFileDrag(request);
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
          setOperationalMessage("preview.selectEntryToDrag");
          return;
        }
        Object.assign(request, retryRequest);
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
  const query = currentSearchQuery().toLowerCase();
  if (query) {
    return browseEntries
      .filter((entry) => normalizeEntryPath(entry.path).toLowerCase().includes(query))
      .map(browserRowForEntry);
  }

  if (isFlatView) {
    return browseEntries.map(browserRowForEntry);
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

function browserRowForEntry(entry: ArchiveEntryDto): SelectableBrowserRow {
  return {
    rowType: entry.kind === "directory" ? "folder" : "entry",
    path: normalizeEntryPath(entry.path),
    name: getBaseName(entry.path),
    entry,
  };
}

function currentSearchQuery(): string {
  return searchInput.value.trim();
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
  searchInput.value = "";
  renderBrowse();
  searchInput.focus();
}

function visibleRows(): BrowserRow[] {
  return sortArchiveRows(buildBrowserRows(), sortKey, sortAscending);
}

function setOperationalStatus(message: string) {
  statusElement.textContent = message;
  statusTextElement.textContent = message;
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
  browseState = next;
  browseError = message;

  messageElement.className = `status ${next === "loaded" ? "status-loaded" : `status-${next}`}`;
  if (message) {
    messageElement.textContent = message;
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

function updateCommandVisualClasses(hasArchive = Boolean(currentArchivePath)) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-command-id]")) {
    const commandId = button.dataset.commandId as CommandId | undefined;
    button.classList.toggle("is-primary-command", commandId === "open" && workspaceMode === "extract" && !hasArchive);
    button.classList.toggle("is-secondary-command", commandId === "refresh");
  }
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
    ? i18n.t("browse.passwordRequired")
    : i18n.t("browse.passwordInvalid");
}

function isPasswordCommandError(commandError: ReturnType<typeof asCommandError>): boolean {
  return (
    commandError?.code === COMMAND_PASSWORD_REQUIRED ||
    commandError?.code === COMMAND_INVALID_PASSWORD
  );
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

  searchInput.disabled = !hasArchive || isLoading;
  searchInput.setAttribute("aria-disabled", String(searchInput.disabled));
  searchSubmitButton.disabled = searchInput.disabled;
  searchSubmitButton.setAttribute("aria-disabled", String(searchSubmitButton.disabled));
  clearSearchButton.disabled = searchInput.disabled || !currentSearchQuery();
  clearSearchButton.setAttribute("aria-disabled", String(clearSearchButton.disabled));
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
    button.title = localizedCommandStateReason(state.reason) ?? commandTooltipText(commandId, i18n);
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
  updateCommandVisualClasses(hasArchive);
  updateStatusBar();
}

function updateMeta() {
  if (!currentArchivePath) {
    metaElement.textContent = i18n.t("browse.statusReady");
    return;
  }

  const folderLabel = currentArchiveFolder ? ` > ${currentArchiveFolder}` : "";
  metaElement.textContent = `${getArchiveName(currentArchivePath, APP_TITLE)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderWorkspaceMode() {
  const isCompress = workspaceMode === "compress";
  if (isCompress) {
    renderCompressBrowser();
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
  detailsElement.hidden = isCompress;
  compressOptionsPanel.hidden = !isCompress;
  detailsPaneTitleElement.textContent = i18n.t(isCompress ? "compress.options" : "pane.details");
  detailsPaneTitleElement.dataset.i18nText = isCompress ? "compress.options" : "pane.details";

  if (isCompress) {
    workspaceTitleElement.textContent = i18n.t("compress.tableTitle");
    metaElement.textContent = i18n.t("compress.tableDescription");
    const includedCount = currentPlan ? includedCreatePlanEntries().length : createSources.length;
    statusSelectionCountElement.textContent = i18n.t("compress.sourceStaged", {
      count: includedCount,
      sourceLabel: i18n.t(includedCount === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
    });
    statusSelectionSizeElement.textContent = "";
    statusFocusedSizeElement.textContent = "";
    statusFocusedModifiedElement.textContent = "";
  } else {
    workspaceTitleElement.textContent = i18n.t("extract.tableTitle");
    if (!currentArchivePath) {
      metaElement.textContent = i18n.t("extract.tableDescription");
    }
    updateStatusBar();
  }
  updateCommandVisualClasses();
}

function setWorkspaceMode(mode: WorkspaceDropMode) {
  if (workspaceMode === mode) {
    renderWorkspaceMode();
    return;
  }

  workspaceMode = mode;
  if (mode === "extract") {
    renderTree();
    renderDetails();
    updateMeta();
  }
  renderWorkspaceMode();
  setOperationalMessage(mode === "compress" ? "workspace.mode.compressStatus" : "workspace.mode.extractStatus");
}

function renderPathBar() {
  if (!currentArchivePath) {
    pathFieldInput.value = i18n.t("browse.statusEmpty");
    pathFieldInput.disabled = true;
    pathFieldInput.readOnly = true;
    pathCrumbsElement.textContent = i18n.t("browse.statusEmpty");
    pathCrumbsElement.hidden = true;
    document.title = APP_TITLE;
    return;
  }

  pathFieldInput.value = currentArchiveDisplayPath();
  pathFieldInput.disabled = false;
  pathFieldInput.readOnly = true;
  pathCrumbsElement.hidden = false;
  document.title = currentArchiveFolder
    ? `${getArchiveName(currentArchivePath, APP_TITLE)}\\${currentArchiveFolder.replace(/\//g, "\\")} - ${APP_TITLE}`
    : `${getArchiveName(currentArchivePath, APP_TITLE)} - ${APP_TITLE}`;

  const crumbs = getArchiveBreadcrumbs(currentArchiveFolder, {
    rootName: getArchiveName(currentArchivePath, APP_TITLE),
  }).flatMap((crumb, index) => {
    const button = `<button type="button" data-crumb-path="${escapeHtml(crumb.path)}" aria-keyshortcuts="Enter Space">${escapeHtml(crumb.name)}</button>`;
    return index === 0 ? [button] : [`<span aria-hidden="true">&gt;</span>`, button];
  });

  pathCrumbsElement.innerHTML = crumbs.join("");
}

function renderTree() {
  if (workspaceMode === "compress") {
    renderCompressSourceTree();
    return;
  }

  if (!currentArchivePath) {
    treeContentElement.innerHTML = `
      <div class="empty-pane">
        <p>${escapeHtml(i18n.t("browse.noArchiveOpen"))}</p>
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
      const icon = archiveTreeIconDescriptor(isRoot, folder.path === currentArchiveFolder, i18n);
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

function renderCompressSourceTree() {
  if (createSources.length === 0) {
    treeContentElement.innerHTML = `
      <div class="empty-pane">
        <p>${escapeHtml(i18n.t("compress.noSources"))}</p>
      </div>
    `;
    return;
  }

  const planEntries = currentPlan?.planEntries ?? [];
  if (createPlanState === "loading" || !currentPlan) {
    treeContentElement.innerHTML = `
      <div class="empty-pane">
        <p>${escapeHtml(currentPlanError || i18n.t("create.plan.planning"))}</p>
      </div>
    `;
    return;
  }

  if (!planEntries.length) {
    treeContentElement.innerHTML = `
      <div class="empty-pane">
        <p>${escapeHtml(i18n.t("create.plan.none"))}</p>
      </div>
    `;
    return;
  }

  const folders = getKnownCompressFolderPaths(planEntries);
  treeContentElement.innerHTML = folders
    .map((folder) => {
      const isRoot = folder.path === archiveTreeRootPath;
      const disclosure = folder.hasChildren && !isRoot
        ? `<span class="tree-disclosure" data-compress-tree-toggle data-compress-folder-path="${escapeHtml(folder.path)}" aria-label="${
          folder.isExpanded ? "Collapse" : "Expand"
        } ${escapeHtml(folder.name)}" aria-hidden="true">${folder.isExpanded ? "-" : "+"}</span>`
        : `<span class="tree-disclosure tree-disclosure-placeholder" aria-hidden="true"></span>`;
      const icon = archiveTreeIconDescriptor(isRoot, folder.path === currentCompressFolder, i18n);
      const iconDataUrl = systemIconDataUrlForRequest(
        isRoot
          ? systemIconRequestForPath(createSources[0] ?? "folder", true)
          : systemIconRequestForPath("folder", true),
      );
      return `
        <button
          class="tree-item ${folder.path === currentCompressFolder ? "is-active" : ""}"
          type="button"
          data-compress-folder-path="${escapeHtml(folder.path)}"
          style="--depth: ${folder.depth}"
        >
          ${disclosure}
          ${renderEntryIcon(icon, "tree-icon", iconDataUrl)}
          <span class="tree-label">${escapeHtml(folder.name)}</span>
        </button>
      `;
    })
    .join("");
}

function getKnownCompressFolderPaths(entries: CreatePlanEntryDto[]): ArchiveTreeFolder[] {
  const childrenByParent = buildArchiveTreeChildren(entries);
  const currentFolder = normalizeFolderPath(currentCompressFolder);
  const folders: ArchiveTreeFolder[] = [{
    path: archiveTreeRootPath,
    name: suggestedCreateArchiveName() || APP_TITLE,
    depth: 0,
    hasChildren: childrenByParent.has(archiveTreeRootPath),
    isExpanded: true,
  }];

  const addChildFolders = (parentPath: string, depth: number) => {
    const children = childrenByParent.get(parentPath);
    if (!children?.length) {
      return;
    }

    for (const childName of children) {
      const childPath = parentPath ? `${parentPath}/${childName}` : childName;
      const childHasChildren = childrenByParent.has(childPath);
      const isExpanded = expandedCompressTreeFolders.has(childPath);
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

  expandCompressTreeFolderAndAncestors(currentFolder);
  addChildFolders(archiveTreeRootPath, 1);
  return folders;
}

function expandCompressTreeFolderAndAncestors(folderPath: string) {
  let current = normalizeFolderPath(folderPath);
  while (current) {
    expandedCompressTreeFolders.add(current);
    const parent = getParentPath(current);
    if (!parent) {
      break;
    }
    current = parent;
  }
}

function compressFolderExists(entries: CreatePlanEntryDto[], folderPath: string): boolean {
  const normalizedFolder = normalizeFolderPath(folderPath);
  if (!normalizedFolder) {
    return true;
  }
  return entries.some((entry) => {
    const path = normalizeEntryPath(entry.path);
    return path === normalizedFolder || path.startsWith(`${normalizedFolder}/`);
  });
}

function navigateToCompressFolder(folderPath: string) {
  const entries = currentPlan?.planEntries ?? [];
  const nextFolder = normalizeFolderPath(folderPath);
  if (!compressFolderExists(entries, nextFolder)) {
    return;
  }
  currentCompressFolder = nextFolder;
  expandCompressTreeFolderAndAncestors(nextFolder);
  renderCompressSourceTree();
  renderCompressSources();
  focusFirstCompressRow();
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
        <input id="select-all" type="checkbox" aria-label="${escapeHtml(i18n.t("table.selectVisibleEntries"))}" ${browseState === "loaded" ? "" : "disabled"} />
      </th>
      ${columns.map((column) => `
        <th
          data-column-id="${column.id}"
          data-sort-key="${column.id}"
          class="${column.align !== "left" ? `align-${column.align}` : ""}"
          style="width: ${column.width}px; min-width: ${column.minWidth ?? 64}px"
          aria-sort="${sortKey === column.id ? (sortAscending ? "ascending" : "descending") : "none"}"
          aria-keyshortcuts="Enter Space ContextMenu Shift+F10"
          tabindex="0"
          title="${escapeHtmlValue(archiveTableColumnLabel(column, i18n))}"
        >
          <span class="column-header-label">${escapeHtml(archiveTableColumnLabel(column, i18n))}</span>
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
  entryTable.hidden = false;
  tableShellElement.classList.toggle("has-start-empty", visible);
}

function renderNameCell(row: BrowserRow, showFullPath: boolean): string {
  const secondaryPath = row.rowType === "entry" ? row.entry.path : row.path;
  const icon = archiveRowIconDescriptor(row, i18n);
  const iconDataUrl = systemIconDataUrlForRequest(systemIconRequestForRow(row));
  const showSecondaryPath = showFullPath && (row.rowType === "entry" || row.rowType === "folder");
  return `
    <span class="row-primary">
      ${renderEntryIcon(icon, "row-icon", iconDataUrl)}
      <span class="sr-only">${escapeHtml(icon.label)}:</span>
      <span class="row-name">${escapeHtml(row.name)}</span>
    </span>
    ${showSecondaryPath ? `<span class="row-secondary">${escapeHtml(secondaryPath)}</span>` : ""}
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

  return `<td class="${className}">${escapeHtml(formatArchiveTableValue(entry, column.id, i18n))}</td>`;
}

function renderBrowseRows() {
  renderTableHeader();
  setArchiveEmptyStateVisible(false);
  const query = currentSearchQuery();
  searchCountElement.textContent = "";

  if (browseState === "loading") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan()}" class="empty">${escapeHtml(i18n.t("browse.statusLoading"))}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (browseState === "error") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColspan()}" class="empty">${escapeHtml(browseError || i18n.t("browse.statusUnknown"))}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (!currentArchivePath) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="${tableColspan()}" class="empty">${escapeHtml(i18n.t("browse.statusEmpty"))}</td>
      </tr>
    `;
    setArchiveEmptyStateVisible(true);
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  const rows = visibleRows();
  const resultCount = rows.filter((row) => row.rowType === "entry" || row.rowType === "folder").length;
  searchCountElement.textContent = formatSearchCount(resultCount);
  if (!rows.length) {
    const emptyMessage = query
      ? i18n.t("browse.noEntriesMatchSearch", { query })
      : i18n.t("browse.folderEmpty");
    tableBody.innerHTML = `
      <tr class="${query ? "search-empty-row" : ""}">
        <td colspan="${tableColspan()}" class="empty">${escapeHtml(emptyMessage)}</td>
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

  const showFullPath = Boolean(query) || isFlatView;
  const columns = visibleColumns(tableColumnSettings);
  const nativeDragAttributes = nativeDragRowAttributes();
  tableBody.innerHTML = rows
    .map((row) => {
      if (row.rowType === "parent") {
        return `
          <tr class="folder-row parent-row" data-folder-path="${escapeHtml(row.path)}" tabindex="0" aria-label="${escapeHtml(i18n.t("browse.parentFolder.aria"))}" aria-keyshortcuts="Enter ContextMenu Shift+F10">
            <td class="selection-column"></td>
            ${columns.map((column) => renderCell(row, column, showFullPath)).join("")}
          </tr>
        `;
      }

      if (row.rowType === "folder") {
        const selected = selectedEntries.has(row.path);
        const focused = focusedEntryPath === row.path;
        return `
          <tr
            class="folder-row ${selected ? "is-selected" : ""} ${focused ? "is-focused-row" : ""}"
            data-folder-path="${escapeHtml(row.path)}"
            data-entry-path="${escapeHtml(row.path)}"
            tabindex="0"
            ${nativeDragAttributes}
            aria-label="${escapeHtml(i18n.t("browse.openFolder.aria", { name: row.name }))}"
            aria-selected="${selected ? "true" : "false"}"
            aria-keyshortcuts="Space Enter ContextMenu Shift+F10"
          >
            <td class="selection-column">
              <input
                data-entry-path="${escapeHtml(row.path)}"
                type="checkbox"
                aria-label="${escapeHtml(i18n.t("browse.selectEntry.aria", { name: row.name }))}"
                ${selected ? "checked" : ""}
              />
            </td>
            ${columns.map((column) => renderCell(row, column, showFullPath)).join("")}
          </tr>
        `;
      }

      const selected = selectedEntries.has(row.path);
      const focused = focusedEntryPath === row.path;
      return `
        <tr
          class="${selected ? "is-selected" : ""} ${focused ? "is-focused-row" : ""}"
          data-entry-path="${escapeHtml(row.path)}"
          tabindex="0"
          ${nativeDragAttributes}
          aria-selected="${selected ? "true" : "false"}"
          aria-keyshortcuts="Space Enter ContextMenu Shift+F10"
        >
          <td class="selection-column">
            <input
              data-entry-path="${escapeHtml(row.path)}"
              type="checkbox"
              aria-label="${escapeHtml(i18n.t("browse.selectEntry.aria", { name: row.name }))}"
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
  if (workspaceMode === "compress") {
    detailsElement.innerHTML = "";
    return;
  }

  const selectedRows = getVisibleSelectedRows();

  if (!currentArchivePath) {
    detailsElement.innerHTML = `
      <div class="details-empty">
        <h3>No archive open</h3>
        <p>${escapeHtml(message("detail.openArchiveFirst"))}</p>
        <button class="primary-action" type="button" data-details-action="open-archive">${escapeHtml(message("browse.emptyOpenAction"))}</button>
      </div>
    `;
    return;
  }

  if (selectedRows.length === 0 && selectedEntries.size > 0 && currentSearchQuery()) {
    const selectedCount = selectedEntries.size;
    const firstSelectedPath = getSelectedEntryPaths()[0] ?? "";
    const firstSelectedEntry = firstSelectedPath ? getEntryByPath(firstSelectedPath) : null;
    const selectedName = firstSelectedEntry ? getBaseName(firstSelectedEntry.path) : firstSelectedPath;
    const rows: DetailRow[] = [
      { label: message("detail.selected"), value: message("detail.selectedEntries", { count: selectedCount }) },
      { label: message("detail.search"), value: currentSearchQuery() },
      ...(selectedName ? [{ label: message("detail.name"), value: selectedName }] : []),
      ...(firstSelectedPath ? [{ label: message("detail.path"), value: firstSelectedPath }] : []),
    ];

    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3>${escapeHtml(message("detail.selectionHiddenBySearch"))}</h3>
        <p>${escapeHtml(message("detail.selectionHiddenBySearchDescription"))}</p>
        <div class="detail-actions">
          <button type="button" class="primary-action" data-details-action="clear-search">${escapeHtml(message("search.clear"))}</button>
          <button type="button" data-details-action="archive-info">${escapeHtml(message("info.archiveTitle"))}</button>
        </div>
        <dl class="detail-list">
          ${renderDetailRows(rows)}
        </dl>
      </div>
    `;
    return;
  }

  if (selectedRows.length === 0) {
    const knownUnpackedSize = currentArchiveTotalSize !== null
      ? currentArchiveTotalSize
      : sumKnownBytes(browseEntries, (entry) => entry.size);
    const unpackedSize = knownUnpackedSize === null ? null : formatBytes(knownUnpackedSize);
    const packedSize = sumKnownBytes(browseEntries, (entry) => entry.compressedSize);
    const format = formatArchiveTypeFromPath(currentArchivePath);

    const list: string = [
      addDetailMessageRow("detail.archiveName", getArchiveName(currentArchivePath, APP_TITLE)),
      addDetailMessageRow("detail.path", currentArchivePath),
      addDetailMessageRow("detail.size", unpackedSize),
      addDetailMessageRow("detail.format", format),
      addDetailMessageRow("detail.entryCount", String(currentArchiveEntryCount)),
      addDetailMessageRow("detail.packedSize", packedSize === null ? null : formatBytes(packedSize)),
      addDetailMessageRow("detail.lastTestStatus", formatLastTestStatusForCurrentArchive()),
      addDetailMessageRow("detail.folder", currentArchiveFolder || "/"),
    ].filter(Boolean).join("");

    detailsElement.innerHTML = `
      <div class="detail-block archive-detail-block">
        <h3 class="detail-title">
          ${renderEntryIcon(
            archiveFileIconDescriptor(currentArchivePath, false, i18n),
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

  if (selectedRows.length === 1) {
    const row = selectedRows[0];
    const entry = row.entry ?? getEntryByPath(row.path);
    if (!entry) {
      const icon = archiveTreeIconDescriptor(false, row.path === currentArchiveFolder, i18n);
      const rows: DetailRow[] = [
        { label: message("detail.name"), value: row.name },
        { label: message("detail.type"), value: message("detail.directory") },
        { label: message("detail.path"), value: row.path || "/" },
      ];
      detailsElement.innerHTML = `
        <div class="detail-block">
          <h3 class="detail-title">
            ${renderEntryIcon(icon, "detail-icon", systemIconDataUrlForRequest(systemIconRequestForPath("folder", true)))}
            <span>${escapeHtml(row.name)}</span>
          </h3>
          <dl class="detail-list">
            ${renderDetailRows(rows)}
          </dl>
        </div>
      `;
      return;
    }
    const icon = archiveEntryIconDescriptor(entry, i18n);
    const rows = entryPropertyRows(entry);
    const canPreview = entry.kind !== "directory";
    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3 class="detail-title">
          ${renderEntryIcon(icon, "detail-icon", systemIconDataUrlForRequest(systemIconRequestForEntry(entry)))}
          <span>${escapeHtml(getBaseName(entry.path))}</span>
        </h3>
        ${canPreview ? `
          <div class="detail-actions">
            <button type="button" class="primary-action" data-details-action="preview" title="${escapeHtmlValue(previewActionHint())}" aria-label="${escapeHtmlValue(`${message("command.view")}: ${previewActionHint()}`)}">${escapeHtml(message("command.view"))}</button>
          </div>
        ` : ""}
        <dl class="detail-list">
          ${renderDetailRows(rows)}
        </dl>
      </div>
    `;
    return;
  }

  const rows = selectionPropertyRows(selectedRows);

  detailsElement.innerHTML = `
    <div class="detail-block">
      <h3>${escapeHtml(message("detail.selectedEntries", { count: selectedRows.length }))}</h3>
      <div class="detail-actions">
        <button type="button" class="primary-action" data-details-action="extract-selected">${escapeHtml(message("extract.selectedAction"))}</button>
        <button type="button" data-details-action="test-selected">${escapeHtml(message("test.selectedAction"))}</button>
        <button type="button" data-details-action="properties">${escapeHtml(message("command.properties"))}</button>
        <button type="button" data-details-action="archive-info">${escapeHtml(message("info.archiveTitle"))}</button>
      </div>
      <dl class="detail-list">
        ${renderDetailRows(rows)}
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

  const visibleSelectedCount = getVisibleSelectedRows().length;
  if (browseState === "loaded" && visibleSelectedCount > 0) {
    messageElement.textContent = i18n.t("browse.selectedEntries", { count: visibleSelectedCount });
  }

  queueSystemIconRefresh();
}

function createUnavailableReasonText(reason: CreateArchiveUnavailableReason): string {
  switch (reason) {
    case "needsSources":
      return message("create.status.needsSources");
    case "needsIncludedEntries":
      return message("create.status.needsIncludedEntries");
    case "needsDestination":
      return message("create.status.needsDestination");
    case "planning":
      return message("create.status.planning");
    case "needsPlan":
      return currentPlanError || message("create.status.needsPlan");
    case "starting":
      return message("create.status.starting");
  }
}

function createReadyStatusText(): string {
  const includedCount = currentPlan?.includedCount ?? 0;
  const filteredPlan = filteredCreatePlan();
  const totalBytes = filteredPlan ? formatBytes(filteredPlan.totalBytes) : "";
  return message("create.status.ready", {
    count: filteredPlan?.includedCount ?? includedCount,
    size: totalBytes,
  });
}

function setCreatePlanState(state: CreateState, statusMessage = "") {
  createPlanState = state;
  currentPlanError = statusMessage;

  const unavailableReason = createArchiveUnavailableReason({
    sourceCount: createSources.length,
    includedEntryCount: currentPlan ? includedCreatePlanEntries().length : undefined,
    destinationPath: createDestinationInput.value,
    planState: state,
    hasPlan: currentPlan !== null,
    submissionInFlight: createSubmissionInFlight,
  });
  const canCreate = unavailableReason === null;
  const statusText = unavailableReason
    ? createUnavailableReasonText(unavailableReason)
    : createReadyStatusText();

  startCreateButton.disabled = !canCreate;
  startCreateButton.title = statusText;
  startCreateButton.setAttribute("aria-label", canCreate
    ? message("compress.createArchive")
    : `${message("compress.createArchive")}: ${statusText}`);
  addSourceButton.classList.toggle("primary-action", createSources.length === 0);
  addSourceButton.classList.toggle("secondary-action", createSources.length > 0);
  startCreateButton.classList.toggle("primary-action", canCreate);
  startCreateButton.classList.toggle("secondary-action", !canCreate);
  createPlanMeta.textContent = statusText;
  createPlanMeta.classList.toggle("is-ready", canCreate);
  createPlanMeta.classList.toggle("is-warning", unavailableReason !== null && unavailableReason !== "needsSources");
}

function formatPlanSummary(plan: CreatePlanResponse): string {
  const hasWarnings = plan.warnings.length > 0;
  const warnings =
    hasWarnings
      ? `<ul>${plan.warnings.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
      : `<p>${escapeHtml(i18n.t("create.plan.noWarnings"))}</p>`;

  const sampleRows = plan.entries
    .slice(0, 8)
    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
    .join("");

  const summaryText = i18n.t("create.plan.summary", {
    count: plan.includedCount,
    size: formatBytes(plan.totalBytes),
    warnings: plan.warnings.length,
  });

  return `
    <div class="plan-validation ${hasWarnings ? "has-warnings" : "is-ready"}">
      <strong>${escapeHtml(summaryText)}</strong>
    </div>
    <details class="plan-details" ${hasWarnings ? "open" : ""}>
      <summary>${escapeHtml(i18n.t("create.plan.details"))}</summary>
      <div class="plan-grid">
        <p><strong>${escapeHtml(i18n.t("create.plan.included"))}</strong> ${plan.includedCount} entries - ${formatBytes(plan.totalBytes)}</p>
        <p><strong>${escapeHtml(i18n.t("create.plan.excluded"))}</strong> ${plan.excludedCount} entries - ${formatBytes(plan.excludedBytes)}</p>
        <p><strong>${escapeHtml(i18n.t("create.plan.warnings"))}</strong> ${plan.warnings.length}</p>
      </div>
      <div class="plan-list">
        <p>${escapeHtml(i18n.t("create.plan.includedSample"))}</p>
        <ul>${sampleRows || `<li>${escapeHtml(i18n.t("create.plan.none"))}</li>`}</ul>
      </div>
      <div class="plan-warnings">
        ${warnings}
      </div>
    </details>
  `;
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

function createPlanEntries(): CreatePlanEntryDto[] {
  return currentPlan?.planEntries ?? [];
}

function entriesForCompressPath(path: string): CreatePlanEntryDto[] {
  const normalizedPath = normalizeEntryPath(path);
  if (!normalizedPath) {
    return createPlanEntries();
  }
  return createPlanEntries().filter((entry) => entryIsUnderFolder(entry.path, normalizedPath));
}

function sortedExcludedCreateArchivePaths(): string[] {
  return Array.from(excludedCreateArchivePaths).sort((left, right) => left.localeCompare(right));
}

function isCreateArchivePathIncluded(path: string): boolean {
  return !excludedCreateArchivePaths.has(normalizeEntryPath(path));
}

function includedCreatePlanEntries(): CreatePlanEntryDto[] {
  return createPlanEntries().filter((entry) => isCreateArchivePathIncluded(entry.path));
}

function filteredCreatePlan(): CreatePlanResponse | null {
  if (!currentPlan) {
    return null;
  }

  const includedEntries = includedCreatePlanEntries();
  const excludedByUser = createPlanEntries().filter((entry) => !isCreateArchivePathIncluded(entry.path));
  const excludedBytes = excludedByUser.reduce((total, entry) => total + (entry.size ?? 0), 0);
  return {
    ...currentPlan,
    includedCount: includedEntries.length,
    excludedCount: currentPlan.excludedCount + excludedByUser.length,
    totalBytes: includedEntries.reduce((total, entry) => total + (entry.size ?? 0), 0),
    excludedBytes: currentPlan.excludedBytes + excludedBytes,
    entries: includedEntries.map((entry) => entry.path),
    planEntries: includedEntries,
    excludedEntries: [
      ...currentPlan.excludedEntries,
      ...excludedByUser.map((entry) => entry.path),
    ],
  };
}

function compressRowInclusionState(row: CompressPlanRow): "included" | "excluded" | "partial" {
  if (row.rowType === "parent") {
    return "included";
  }

  const entries = entriesForCompressPath(row.path);
  if (entries.length === 0) {
    return isCreateArchivePathIncluded(row.path) ? "included" : "excluded";
  }

  const includedCount = entries.filter((entry) => isCreateArchivePathIncluded(entry.path)).length;
  if (includedCount === 0) {
    return "excluded";
  }
  if (includedCount === entries.length) {
    return "included";
  }
  return "partial";
}

function compressInclusionLabel(state: "included" | "excluded" | "partial"): string {
  switch (state) {
    case "included":
      return message("compress.inclusion.included");
    case "excluded":
      return message("compress.inclusion.excluded");
    case "partial":
      return message("compress.inclusion.partial");
  }
}

function setCompressPathIncluded(path: string, included: boolean) {
  const affectedEntries = entriesForCompressPath(path);
  const paths = affectedEntries.length
    ? affectedEntries.map((entry) => normalizeEntryPath(entry.path))
    : [normalizeEntryPath(path)];

  for (const entryPath of paths) {
    if (!entryPath) {
      continue;
    }
    if (included) {
      excludedCreateArchivePaths.delete(entryPath);
      let parent = getParentPath(entryPath);
      while (parent) {
        excludedCreateArchivePaths.delete(parent);
        parent = getParentPath(parent);
      }
    } else {
      excludedCreateArchivePaths.add(entryPath);
    }
  }
}

function setAllCompressPathsIncluded(included: boolean) {
  if (included) {
    excludedCreateArchivePaths.clear();
    return;
  }
  excludedCreateArchivePaths = new Set(createPlanEntries().map((entry) => normalizeEntryPath(entry.path)));
}

function setCurrentCompressFolderIncluded(included: boolean) {
  const folderPath = normalizeFolderPath(currentCompressFolder);
  if (folderPath) {
    setCompressPathIncluded(folderPath, included);
    return;
  }

  setAllCompressPathsIncluded(included);
}

function syncCompressIncludeAllControl() {
  if (createSources.length === 0 || createPlanState === "loading" || !currentPlan) {
    compressIncludeAllInput.checked = false;
    compressIncludeAllInput.indeterminate = false;
    compressIncludeAllInput.disabled = true;
    return;
  }

  const entries = entriesForCompressPath(currentCompressFolder);
  if (entries.length === 0) {
    compressIncludeAllInput.checked = false;
    compressIncludeAllInput.indeterminate = false;
    compressIncludeAllInput.disabled = true;
    return;
  }

  const includedCount = entries.filter((entry) => isCreateArchivePathIncluded(entry.path)).length;
  compressIncludeAllInput.checked = includedCount === entries.length;
  compressIncludeAllInput.indeterminate = includedCount > 0 && includedCount < entries.length;
  compressIncludeAllInput.disabled = false;
}

function syncCompressInclusionControls() {
  for (const input of compressSourceBody.querySelectorAll<HTMLInputElement>("[data-compress-include]")) {
    input.indeterminate = input.dataset.compressInclusionState === "partial";
  }
  syncCompressIncludeAllControl();
}

function refreshCreatePlanSummary() {
  const plan = filteredCreatePlan();
  if (!plan) {
    return;
  }
  createPlanSummary.innerHTML = formatPlanSummary(plan);
}

function renderCreateSources() {
  clearSourcesButton.hidden = createSources.length === 0;
  clearSourcesButton.disabled = createSources.length === 0;
  includeAllSourcesButton.hidden = createSources.length === 0;
  excludeAllSourcesButton.hidden = createSources.length === 0;
  includeAllSourcesButton.disabled = createSources.length === 0 || excludedCreateArchivePaths.size === 0;
  excludeAllSourcesButton.disabled = createSources.length === 0 || includedCreatePlanEntries().length === 0;

  createPlanMeta.textContent = createSources.length
    ? i18n.t("compress.sourceSelected", {
      count: createSources.length,
      sourceLabel: i18n.t(createSources.length === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
    })
    : i18n.t("compress.dropSourcesHint");

  if (createSources.length === 0) {
    sourceListElement.innerHTML = `<li class="empty">${escapeHtml(i18n.t("compress.noSources"))}</li>`;
  } else {
    sourceListElement.innerHTML = createSources
      .map(
        (path) => `
          <li data-source-path="${escapeHtml(path)}">
            <span>${escapeHtml(path)}</span>
            <button type="button" data-source-remove>${escapeHtml(i18n.t("compress.removeSource"))}</button>
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
      removeCreateSources([path]);
    });
  }

  setCreatePlanState(createPlanState, currentPlanError);
}

function clearCreateSources() {
  createSources = [];
  excludedCreateArchivePaths.clear();
  selectedCompressRows.clear();
  focusedCompressRowPath = "";
  compressSelectionAnchorPath = "";
  currentPlan = null;
  currentCompressFolder = "";
  renderCreateSources();
  renderCompressBrowser();
  queuePlanRun();
}

function removeCreateSources(sourcePaths: string[]) {
  const removals = new Set(sourcePaths.filter(Boolean));
  if (removals.size === 0) {
    return;
  }
  createSources = createSources.filter((item) => !removals.has(item));
  excludedCreateArchivePaths.clear();
  selectedCompressRows.clear();
  focusedCompressRowPath = "";
  compressSelectionAnchorPath = "";
  currentPlan = null;
  if (!createSources.length) {
    currentCompressFolder = "";
  }
  renderCreateSources();
  renderCompressBrowser();
  queuePlanRun();
}

function renderCompressSources() {
  if (createSources.length === 0) {
    selectedCompressRows.clear();
    focusedCompressRowPath = "";
    compressSelectionAnchorPath = "";
    compressSourceBody.innerHTML = `
      <tr>
        <td colspan="5" class="compress-empty-cell">
          <div class="compress-empty-state">
            <strong>${escapeHtml(i18n.t("compress.emptyTable"))}</strong>
            <span>${escapeHtml(i18n.t("compress.dragSourcesHint"))}</span>
          </div>
        </td>
      </tr>
    `;
    if (workspaceMode === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  if (createPlanState === "loading" || !currentPlan) {
    selectedCompressRows.clear();
    focusedCompressRowPath = "";
    compressSelectionAnchorPath = "";
    compressSourceBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">${escapeHtml(currentPlanError || i18n.t("create.plan.planning"))}</td>
      </tr>
    `;
    if (workspaceMode === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  const rows = visibleCompressRows();
  if (!rows.length) {
    selectedCompressRows.clear();
    focusedCompressRowPath = "";
    compressSelectionAnchorPath = "";
    compressSourceBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">${escapeHtml(i18n.t("browse.folderEmpty"))}</td>
      </tr>
    `;
    if (workspaceMode === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  const visibleSelectablePaths = new Set(rows
    .filter((row) => row.rowType === "entry" || row.rowType === "folder")
    .map((row) => row.path));
  selectedCompressRows = new Set([...selectedCompressRows].filter((path) => visibleSelectablePaths.has(path)));
  if (focusedCompressRowPath && !visibleSelectablePaths.has(focusedCompressRowPath)) {
    focusedCompressRowPath = "";
  }
  if (compressSelectionAnchorPath && !visibleSelectablePaths.has(compressSelectionAnchorPath)) {
    compressSelectionAnchorPath = focusedCompressRowPath || selectedCompressRows.values().next().value || "";
  }

  compressSourceBody.innerHTML = rows
    .map((row) => renderCompressPlanRow(row))
    .join("");
  syncCompressInclusionControls();

  if (workspaceMode === "compress") {
    renderCompressSourceTree();
  }
}

function visibleCompressRows(): CompressPlanRow[] {
  const entries = currentPlan?.planEntries ?? [];
  const currentFolder = normalizeFolderPath(currentCompressFolder);
  const rows: CompressPlanRow[] = [];
  const folderRows = new Map<string, CompressPlanRow>();
  const entryRows: CompressPlanRow[] = [];

  if (currentFolder) {
    rows.push({
      rowType: "parent",
      path: getParentPath(currentFolder),
      name: "..",
    });
  }

  for (const entry of entries) {
    const entryPath = normalizeEntryPath(entry.path);
    if (!entryPath || !entryIsUnderFolder(entryPath, currentFolder)) {
      continue;
    }

    const relativePath = currentFolder
      ? entryPath.slice(currentFolder.length).replace(/^\/+/, "")
      : entryPath;
    if (!relativePath) {
      continue;
    }

    const segments = relativePath.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    if (segments.length > 1) {
      const folderPath = currentFolder ? `${currentFolder}/${segments[0]}` : segments[0];
      if (!folderRows.has(folderPath)) {
        folderRows.set(folderPath, {
          rowType: "folder",
          path: folderPath,
          name: segments[0],
        });
      }
      continue;
    }

    if (entry.kind === "directory") {
      folderRows.set(entryPath, {
        rowType: "folder",
        path: entryPath,
        name: segments[0],
        entry,
      });
      continue;
    }

    entryRows.push({
      rowType: "entry",
      path: entryPath,
      name: segments[0],
      entry,
    });
  }

  const sortedFolders = Array.from(folderRows.values())
    .sort((left, right) => left.name.localeCompare(right.name));
  const sortedEntries = entryRows
    .sort((left, right) => left.name.localeCompare(right.name));
  return [...rows, ...sortedFolders, ...sortedEntries];
}

function renderCompressInclusionCheckbox(
  row: Extract<CompressPlanRow, { rowType: "folder" | "entry" }>,
  state: "included" | "excluded" | "partial",
): string {
  const label = message(
    state === "excluded"
      ? "compress.includeItem.aria"
      : "compress.excludeItem.aria",
    { name: row.name },
  );
  return `
    <input
      data-compress-include
      data-compress-path="${escapeHtml(row.path)}"
      data-compress-inclusion-state="${state}"
      type="checkbox"
      aria-label="${escapeHtml(label)}"
      ${state === "included" ? "checked" : ""}
    />
  `;
}

function visibleCompressRowForPath(path: string): CompressPlanRow | undefined {
  const normalizedPath = normalizeEntryPath(path);
  return visibleCompressRows().find((row) => normalizeEntryPath(row.path) === normalizedPath);
}

function renderCompressPlanRow(row: CompressPlanRow): string {
  if (row.rowType === "parent") {
    return `
      <tr class="folder-row parent-row" data-compress-folder-row="${escapeHtml(row.path)}" tabindex="0" aria-label="${escapeHtml(i18n.t("browse.parentFolder.aria"))}" aria-keyshortcuts="Enter ContextMenu Shift+F10">
        <td class="inclusion-cell"></td>
        <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
        <td></td>
        <td></td>
        <td>${escapeHtml(i18n.t("icon.parentFolder"))}</td>
      </tr>
    `;
  }

  if (row.rowType === "folder") {
    const selected = selectedCompressRows.has(row.path);
    const focused = focusedCompressRowPath === row.path;
    const sourcePath = sourcePathForCompressRow(row);
    const inclusionState = compressRowInclusionState(row);
    return `
      <tr
        class="folder-row ${selected ? "is-selected" : ""} ${focused ? "is-focused-row" : ""} ${inclusionState === "excluded" ? "is-excluded" : ""} ${inclusionState === "partial" ? "is-partial" : ""}"
        data-compress-folder-row="${escapeHtml(row.path)}"
        data-compress-path="${escapeHtml(row.path)}"
        ${sourcePath ? `data-compress-source-path="${escapeHtml(sourcePath)}"` : ""}
        tabindex="0"
        aria-label="${escapeHtml(i18n.t("browse.openFolder.aria", { name: row.name }))}"
        aria-selected="${selected ? "true" : "false"}"
        aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"
      >
        <td class="inclusion-cell">${renderCompressInclusionCheckbox(row, inclusionState)}</td>
        <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
        <td>${row.entry?.size === undefined ? "" : escapeHtml(formatBytes(row.entry.size))}</td>
        <td>${row.entry?.modified ? escapeHtml(formatDate(row.entry.modified)) : ""}</td>
        <td>${escapeHtml(i18n.t("detail.directory"))}</td>
      </tr>
    `;
  }

  const selected = selectedCompressRows.has(row.path);
  const focused = focusedCompressRowPath === row.path;
  const sourcePath = sourcePathForCompressRow(row);
  const inclusionState = compressRowInclusionState(row);
  return `
    <tr
      class="${selected ? "is-selected" : ""} ${focused ? "is-focused-row" : ""} ${inclusionState === "excluded" ? "is-excluded" : ""}"
      data-compress-entry-row="${escapeHtml(row.path)}"
      data-compress-path="${escapeHtml(row.path)}"
      ${sourcePath ? `data-compress-source-path="${escapeHtml(sourcePath)}"` : ""}
      tabindex="0"
      aria-selected="${selected ? "true" : "false"}"
      aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"
    >
      <td class="inclusion-cell">${renderCompressInclusionCheckbox(row, inclusionState)}</td>
      <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
      <td>${row.entry.size === undefined ? "" : escapeHtml(formatBytes(row.entry.size))}</td>
      <td>${row.entry.modified ? escapeHtml(formatDate(row.entry.modified)) : ""}</td>
      <td>${escapeHtml(normalizeArchiveKindLabel(row.entry.kind))}</td>
    </tr>
  `;
}

function sourcePathForCompressRow(row: CompressPlanRow): string {
  if (row.rowType === "parent") {
    return "";
  }

  const sourceFromArchivePath = sourcePathForCompressArchivePath(row.path);
  if (sourceFromArchivePath) {
    return sourceFromArchivePath;
  }

  if (row.entry?.sourcePath) {
    const sourceFromNativePath = sourcePathForNativePath(row.entry.sourcePath);
    if (sourceFromNativePath) {
      return sourceFromNativePath;
    }
  }

  const descendantSources = new Set(
    entriesForCompressPath(row.path)
      .map((entry) => sourcePathForNativePath(entry.sourcePath))
      .filter(Boolean),
  );
  if (descendantSources.size === 1) {
    return descendantSources.values().next().value ?? "";
  }

  const basenameMatch = createSources.find((sourcePath) => getPathBasename(sourcePath) === row.path);
  return basenameMatch ?? "";
}

function sourcePathForCompressArchivePath(archivePath: string): string {
  const normalizedArchivePath = normalizeEntryPath(archivePath);
  if (!normalizedArchivePath) {
    return "";
  }

  const rootEntries = createPlanEntries()
    .filter((entry) => createSources.includes(entry.sourcePath))
    .sort((left, right) => normalizeEntryPath(right.path).length - normalizeEntryPath(left.path).length);
  const rootEntry = rootEntries.find((entry) => entryIsUnderFolder(normalizedArchivePath, entry.path));
  return rootEntry?.sourcePath ?? "";
}

function normalizedNativePathForCompare(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")
    ? normalized.toLowerCase()
    : normalized;
}

function sourcePathForNativePath(nativePath: string): string {
  const normalizedNativePath = normalizedNativePathForCompare(nativePath);
  if (!normalizedNativePath) {
    return "";
  }

  return createSources.find((sourcePath) => {
    const normalizedSourcePath = normalizedNativePathForCompare(sourcePath);
    return normalizedNativePath === normalizedSourcePath
      || normalizedNativePath.startsWith(`${normalizedSourcePath}/`);
  }) ?? "";
}

function renderCompressPlanNameCell(row: CompressPlanRow): string {
  const icon = row.rowType === "parent"
    ? archiveRowIconDescriptor({ rowType: "parent", path: row.path, name: ".." }, i18n)
    : row.rowType === "folder"
      ? archiveTreeIconDescriptor(false, row.path === currentCompressFolder, i18n)
      : archiveEntryIconDescriptor(row.entry, i18n);
  const iconDataUrl = row.rowType === "folder" || row.rowType === "parent"
    ? systemIconDataUrlForRequest(systemIconRequestForPath("folder", true))
    : systemIconDataUrlForRequest(systemIconRequestForPath(row.entry.sourcePath || row.entry.path, false));
  const inclusionBadge = row.rowType === "parent"
    ? ""
    : `<span class="source-stage-badge ${compressRowInclusionState(row) === "excluded" ? "is-excluded" : ""}">${escapeHtml(compressInclusionLabel(compressRowInclusionState(row)))}</span>`;
  return `
    <span class="row-primary">
      ${renderEntryIcon(icon, "row-icon", iconDataUrl)}
      <span class="sr-only">${escapeHtml(icon.label)}:</span>
      <span class="row-name">${escapeHtml(row.name)}</span>
      ${inclusionBadge}
    </span>
  `;
}

function focusFirstCompressRow() {
  compressSourceBody.querySelector<HTMLTableRowElement>("tr[tabindex='0']")?.focus();
}

function getVisibleCompressSelectablePaths(): string[] {
  return visibleCompressRows()
    .filter((row) => row.rowType === "entry" || row.rowType === "folder")
    .map((row) => row.path);
}

function getCompressRows(): HTMLTableRowElement[] {
  return Array.from(compressSourceBody.querySelectorAll<HTMLTableRowElement>(
    "tr[data-compress-folder-row], tr[data-compress-entry-row]",
  ));
}

function getCompressSelectableRows(): HTMLTableRowElement[] {
  return Array.from(compressSourceBody.querySelectorAll<HTMLTableRowElement>("tr[data-compress-path]"));
}

function selectedCompressSourcePaths(): string[] {
  return Array.from(new Set(getCompressSelectableRows()
    .filter((row) => selectedCompressRows.has(row.dataset.compressPath ?? ""))
    .map((row) => removableSourcePathForCompressRow(row))
    .filter(Boolean)));
}

function removableSourcePathForCompressRow(row: HTMLTableRowElement): string {
  const rowPath = row.dataset.compressPath ?? "";
  if (!rowPath || currentCompressFolder) {
    return "";
  }

  const sourcePath = row.dataset.compressSourcePath ?? "";
  return createSources.includes(sourcePath) && normalizeEntryPath(rowPath) === getPathBasename(sourcePath)
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
  if (selectedCompressRows.has(rowPath) && selectedCompressRows.size > 1) {
    const visiblePaths = new Set(getVisibleCompressSelectablePaths());
    return Array.from(selectedCompressRows).filter((path) => visiblePaths.has(path));
  }
  return [rowPath];
}

function updateCompressSelectionByIntent(
  rowPath: string,
  options?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  const intentResult = applyRowSelectionIntent({
    path: rowPath,
    visiblePaths: getVisibleCompressSelectablePaths(),
    currentSelection: selectedCompressRows,
    anchorPath: compressSelectionAnchorPath,
    shiftKey: Boolean(options?.shift),
    ctrlKey: Boolean(options?.ctrl),
    metaKey: Boolean(options?.meta),
  });

  selectedCompressRows = intentResult.selectedPaths;
  compressSelectionAnchorPath = intentResult.anchorPath;
  focusedCompressRowPath = rowPath;
}

function syncCompressSelectionUi() {
  for (const row of getCompressSelectableRows()) {
    const rowPath = row.dataset.compressPath ?? "";
    const selected = selectedCompressRows.has(rowPath);
    const focused = focusedCompressRowPath === rowPath;
    row.classList.toggle("is-selected", selected);
    row.classList.toggle("is-focused-row", focused);
    row.setAttribute("aria-selected", String(selected));
  }
}

function focusCompressRow(row: HTMLTableRowElement | null) {
  if (!row) {
    return;
  }
  row.focus();
  focusedCompressRowPath = row.dataset.compressPath ?? "";
  syncCompressSelectionUi();
}

function focusRelativeCompressRow(currentRow: HTMLTableRowElement, direction: 1 | -1) {
  const rows = getCompressRows();
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  focusCompressRow(rows[nextIndex]);
}

function toggleCompressRowSelection(row: HTMLTableRowElement) {
  const rowPath = row.dataset.compressPath;
  if (!rowPath) {
    return;
  }

  if (selectedCompressRows.has(rowPath)) {
    selectedCompressRows.delete(rowPath);
  } else {
    selectedCompressRows.add(rowPath);
  }
  focusedCompressRowPath = rowPath;
  compressSelectionAnchorPath = rowPath;
  syncCompressSelectionUi();
}

function activateCompressRow(row: HTMLTableRowElement) {
  const folderPath = row.dataset.compressFolderRow;
  if (folderPath !== undefined) {
    navigateToCompressFolder(folderPath);
  }
}

function renderCompressBrowser() {
  if (currentPlan && !compressFolderExists(currentPlan.planEntries, currentCompressFolder)) {
    currentCompressFolder = "";
  }
  if (workspaceMode === "compress") {
    renderCompressSourceTree();
    renderCompressSources();
  }
  setCreatePlanState(createPlanState, currentPlanError);
}

function renderJobStatusBar() {
  activeJobElement.textContent = activeJobStatusText(jobs, formatJobKind, i18n);
}

function renderJobs() {
  jobsListElement.innerHTML = renderJobsListHtml(jobs, {
    i18n,
    escapeHtml,
    formatBytes,
    formatJobKind,
    canRetryJobWithPassword,
    getOutputActions: (jobId) => jobOutputActions.get(jobId) ?? [],
  });
  renderJobStatusBar();
  renderQuickProgress();
  syncProgressClock();
}

function queuePlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }

  const revision = ++createPlanRevision;
  if (createSources.length === 0) {
    currentPlan = null;
    currentCompressFolder = "";
    setCreatePlanState("idle");
    createPlanSummary.innerHTML = `<p>${escapeHtml(i18n.t("create.plan.noSources"))}</p>`;
    renderCompressBrowser();
    return;
  }

  currentPlan = null;
  setCreatePlanState("loading", i18n.t("create.plan.planning"));
  createPlanSummary.innerHTML = `<p>${escapeHtml(i18n.t("create.plan.planning"))}</p>`;
  renderCompressBrowser();

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
const RECENT_ARCHIVE_HISTORY_KEY = "zmanager.recentArchiveHistory";
const RECENT_ARCHIVE_HISTORY_MAX = 8;

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
  createDestinationRecentSelect.disabled = createDestinationHistory.length === 0;
  createDestinationRecentSelect.innerHTML = `
    <option value="">${escapeHtml(message("create.destination.recent"))}</option>
    ${createDestinationHistory
      .map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(middleTruncateDetailValue(entry, 54))}</option>`)
      .join("")}
  `;
}

function loadCreateDestinationHistory() {
  createDestinationHistory = normalizeDestinationHistory(loadStringListFromStorage(CREATE_DESTINATION_HISTORY_KEY));
}

function setRecentArchiveHistory(entries: string[]): string[] {
  recentArchiveHistory = normalizeDestinationHistory(entries).slice(0, RECENT_ARCHIVE_HISTORY_MAX);
  saveStringListToStorage(RECENT_ARCHIVE_HISTORY_KEY, recentArchiveHistory);
  return recentArchiveHistory;
}

function recordRecentArchiveHistory(archivePath: string): void {
  const normalized = archivePath.trim();
  if (!normalized) {
    return;
  }
  const trimmed = recentArchiveHistory.filter((entry) => entry !== normalized);
  setRecentArchiveHistory([normalized, ...trimmed]);
}

function loadRecentArchiveHistory() {
  recentArchiveHistory = normalizeDestinationHistory(loadStringListFromStorage(RECENT_ARCHIVE_HISTORY_KEY));
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

function isExtractDestinationValid(): boolean {
  return extractDestinationInput.value.trim().length > 0;
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

function syncExtractDialogState() {
  const canExtract = isExtractDestinationValid();
  extractStartButton.disabled = !canExtract;
  extractStartButton.classList.toggle("primary-action", canExtract);
  extractStartButton.setAttribute("aria-disabled", String(!canExtract));
  if (canExtract && extractDialogMessage.textContent === message("extract.chooseDestinationFirst")) {
    extractDialogMessage.textContent = extractDialogMessageForMode(activeExtractMode);
  }
}

function requestExtractPasswordInDialog(commandCode: string) {
  extractDialogMessage.textContent = getArchivePasswordPrompt(commandCode);
  extractPasswordOptions.open = true;
  browsePasswordInput.value = "";
  browsePasswordInput.type = "password";
  browseShowPasswordInput.checked = false;
  syncExtractDialogState();
  browsePasswordInput.focus();
}

function handleExtractDialogEnter(event: KeyboardEvent) {
  if (
    event.key !== "Enter" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (
    target?.closest("button, a, summary") ||
    target instanceof HTMLSelectElement ||
    !(target instanceof HTMLInputElement)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (!isExtractDestinationValid()) {
    extractDialogMessage.textContent = message("extract.chooseDestinationFirst");
    syncExtractDialogState();
    extractDestinationInput.focus();
    return;
  }

  void startExtract(activeExtractMode);
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
  return openRuntimeDialog(options, setOperationalStatus, {
    unavailableInBrowser: message("nativeDialog.unavailableInBrowser"),
    failed: message("nativeDialog.failed"),
  });
}

async function saveNativeDialog(options: SaveDialogOptions) {
  return saveRuntimeDialog(options, setOperationalStatus, {
    unavailableInBrowser: message("nativeDialog.unavailableInBrowser"),
    failed: message("nativeDialog.failed"),
  });
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
        "summary",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => isVisibleElement(element) || element === document.activeElement);
}

function isVisibleElement(element: HTMLElement): boolean {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function getOpenModal(): HTMLElement | null {
  for (const dialog of [extractDialog, aboutDialog, preferencesDialog, infoDialog]) {
    if (!dialog.hidden) {
      return dialog;
    }
  }
  return null;
}

function getDialogSurface(dialog: HTMLElement): HTMLElement {
  return dialog.querySelector<HTMLElement>("[role='dialog']") ?? dialog;
}

function trapModalFocus(event: KeyboardEvent, dialog: HTMLElement) {
  const surface = getDialogSurface(dialog);
  const focusable = getFocusableElements(surface);
  if (!focusable.length) {
    event.preventDefault();
    surface.focus();
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

function fallbackFocusForDialog(dialog: HTMLElement): HTMLElement | null {
  if (dialog === extractDialog) {
    const row = focusedEntryPath
      ? tableBody.querySelector<HTMLElement>(`tr[data-entry-path="${CSS.escape(focusedEntryPath)}"]`)
      : null;
    return row ?? extractToolbarButton;
  }

  if (dialog === infoDialog) {
    const row = focusedEntryPath
      ? tableBody.querySelector<HTMLElement>(`tr[data-entry-path="${CSS.escape(focusedEntryPath)}"]`)
      : null;
    return row ?? infoToolbarButton;
  }

  if (dialog === preferencesDialog) {
    return preferencesToolbarButton;
  }

  return document.querySelector<HTMLButtonElement>("#toolbar-about") ?? null;
}

function resolveDialogReturnFocus(dialog: HTMLElement): HTMLElement | null {
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    !dialog.contains(active) &&
    !contextMenu.contains(active) &&
    isVisibleElement(active)
  ) {
    return active;
  }
  return fallbackFocusForDialog(dialog);
}

function openModal(dialog: HTMLElement, focusSelector = "button, input, select", returnFocusOverride: HTMLElement | null = null) {
  focusedBeforeDialog = returnFocusOverride ?? resolveDialogReturnFocus(dialog);
  dialog.hidden = false;
  const surface = getDialogSurface(dialog);
  const focusTarget = surface.querySelector<HTMLElement>(focusSelector)
    ?? getFocusableElements(surface)[0]
    ?? surface;
  focusTarget.focus();
  focusTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function closeModal(dialog: HTMLElement) {
  dialog.hidden = true;
  if (dialog === extractDialog) {
    browsePasswordInput.value = "";
    browsePasswordInput.type = "password";
    browseShowPasswordInput.checked = false;
  }
  const restoreTarget = focusedBeforeDialog && isVisibleElement(focusedBeforeDialog)
    ? focusedBeforeDialog
    : fallbackFocusForDialog(dialog);
  restoreTarget?.focus();
  focusedBeforeDialog = null;
}

function isTextEntryElement(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
    return true;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
    return true;
  }
  return false;
}

function dialogButtonFromSelector(dialog: HTMLElement, selectorAttribute: "dialogDefault" | "dialogCancel"): HTMLButtonElement | null {
  const surface = getDialogSurface(dialog);
  const selector = surface.dataset[selectorAttribute];
  if (selector) {
    return surface.querySelector<HTMLButtonElement>(selector);
  }

  const dataAttribute = selectorAttribute === "dialogDefault"
    ? "[data-dialog-default-button]"
    : "[data-dialog-cancel-button]";
  return surface.querySelector<HTMLButtonElement>(dataAttribute);
}

function activateDialogDefault(event: KeyboardEvent, dialog: HTMLElement): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  const defaultSafeTextInput = dialog === extractDialog &&
    target instanceof HTMLInputElement &&
    !["button", "checkbox", "radio", "reset", "submit"].includes(target.type);
  if (target?.closest("button, a, summary") || (target && isTextEntryElement(target) && !defaultSafeTextInput)) {
    return false;
  }

  const button = dialogButtonFromSelector(dialog, "dialogDefault");
  if (!button || button.disabled || !isVisibleElement(button)) {
    return false;
  }

  event.preventDefault();
  button.click();
  return true;
}

function cancelDialog(event: KeyboardEvent, dialog: HTMLElement): boolean {
  const button = dialogButtonFromSelector(dialog, "dialogCancel");
  event.preventDefault();
  if (button && !button.disabled && isVisibleElement(button)) {
    button.click();
  } else {
    closeModal(dialog);
  }
  return true;
}

function keepFocusInsideOpenModal(event: FocusEvent) {
  const openDialogElement = getOpenModal();
  if (!openDialogElement || !(event.target instanceof HTMLElement)) {
    return;
  }

  if (openDialogElement.contains(event.target)) {
    return;
  }

  const surface = getDialogSurface(openDialogElement);
  const focusTarget = getFocusableElements(surface)[0] ?? surface;
  focusTarget.focus();
}

function clearCreatePasswordFields() {
  createPasswordInput.value = "";
  createPasswordConfirmInput.value = "";
  createPasswordInput.type = "password";
  createPasswordConfirmInput.type = "password";
  createShowPasswordInput.checked = false;
}

function openJobDrawer() {
  if (isQuickActionJobMode()) {
    void pollJobs();
    return;
  }

  jobDrawer.setAttribute("aria-hidden", "false");
  workspaceElement.dataset.jobDrawer = "open";
  void pollJobs();
}

function closeJobDrawer() {
  if (isQuickActionJobMode()) {
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

function isLiveJobStatus(status: JobState["snapshot"]["status"]): boolean {
  return status === "queued" || status === "running" || status === "paused";
}

function hasActiveJob(): boolean {
  return Array.from(jobs.values()).some((state) => isLiveJobStatus(state.snapshot.status));
}

function currentDropSurface(): DropIntentSurface {
  return dropSurfaceForWorkspace({ createDialogOpen: false, mode: workspaceMode });
}

type DropOverlayMode = "idle" | "active" | "choosing";
type DropOverlayTarget = "compress" | "extract" | "choose" | "blocked" | "unknown";

type DropOverlayCopy = {
  title: string;
  message: string;
  support?: string;
  target: DropOverlayTarget;
  showActions?: boolean;
};

function setDropOverlay(mode: DropOverlayMode, copy?: DropOverlayCopy) {
  workspaceElement.dataset.dropState = mode;
  if (copy?.target) {
    workspaceElement.dataset.dropTarget = copy.target;
  } else {
    delete workspaceElement.dataset.dropTarget;
  }

  const visible = mode !== "idle";
  dropOverlay.setAttribute("aria-hidden", visible ? "false" : "true");
  dropOverlayTitle.textContent = copy?.title ?? message("drop.title");
  dropOverlayMessage.textContent = copy?.message ?? message("drop.defaultMessage");
  dropOverlaySupport.textContent = copy?.support ?? "";
  dropOverlaySupport.hidden = !copy?.support;
  dropOverlayActions.hidden = !copy?.showActions;
  dropOverlay.querySelector<HTMLElement>(".drop-overlay-card")?.setAttribute(
    "role",
    copy?.showActions ? "dialog" : "status",
  );
  if (copy?.showActions) {
    dropOverlay.querySelector<HTMLElement>(".drop-overlay-card")?.setAttribute("aria-modal", "false");
  } else {
    dropOverlay.querySelector<HTMLElement>(".drop-overlay-card")?.removeAttribute("aria-modal");
  }

  if (!visible) {
    pendingDropChoice = null;
  }
}

function clearDropOverlay() {
  setDropOverlay("idle");
}

function dropCopyForSurface(surface: DropIntentSurface): DropOverlayCopy {
  if (surface === "create") {
    return {
      title: message("drop.addSources.title"),
      message: message("drop.addSources.copyMessage"),
      support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
      target: "compress",
    };
  }

  if (currentArchivePath) {
    return {
      title: message("drop.openArchive.title"),
      message: message("drop.openArchive.message"),
      support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
      target: "extract",
    };
  }

  return {
    title: message("drop.chooseMode.title"),
    message: message("drop.chooseMode.message"),
    support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
    target: "choose",
  };
}

function dropCopyForDecision(decision: DropIntentDecision): DropOverlayCopy {
  if (hasActiveJob() || createSubmissionInFlight) {
    return {
      title: message("drop.blocked.title"),
      message: message("drop.blocked.message"),
      target: "blocked",
    };
  }

  switch (decision.kind) {
    case "openArchive":
      return {
        title: message("drop.openArchive.title"),
        message: message("drop.openArchive.actionMessage", { archiveName: getPathBasename(decision.archivePath) || decision.archivePath }),
        support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
        target: "extract",
      };
    case "addCreateSources":
      return {
        title: message("drop.addSources.title"),
        message: message("drop.addSources.copyMessage"),
        support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
        target: "compress",
      };
    case "askAction":
      return {
        title: message("drop.chooseMode.title"),
        message: message("drop.chooseMode.mixedMessage", {
          archiveCount: decision.archivePaths.length,
          sourceCount: decision.sourcePaths.length,
        }),
        support: isDesktopRuntime() ? "" : message("drop.browserPreview"),
        target: "choose",
        showActions: true,
      };
    case "rejectUnsupportedDrop":
      return {
        title: message("drop.blocked.title"),
        message: message(decision.reason === "emptyDrop" ? "drop.empty" : "drop.browseRequiresArchive"),
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
  createDestinationInput.focus();
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
      pendingDropChoice = decision;
      setDropOverlay("choosing", dropCopyForDecision(decision));
      dropOpenArchiveButton.focus();
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
  if (hasActiveJob() || createSubmissionInFlight) {
    setOperationalMessage("drop.finishCurrentJob");
    setDropOverlay("active", {
      title: message("drop.blocked.title"),
      message: message("drop.blocked.message"),
      target: "blocked",
    });
    return;
  }

  const surface = currentDropSurface();
  const decision = classifyDropIntent(trimmedPaths, surface);
  handleDropDecision(decision);
}

function droppedPathsFromDataTransfer(dataTransfer: DataTransfer | null): DroppedPath[] {
  const paths: DroppedPath[] = [];
  for (const file of Array.from(dataTransfer?.files ?? [])) {
    const fileWithPath = file as File & { path?: string };
    const path = fileWithPath.path?.trim() || file.webkitRelativePath?.trim() || file.name.trim();
    if (path) {
      paths.push({ path, kind: "unknown" });
    }
  }
  return paths;
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

function bindBrowserFileDropFallback() {
  appRoot.addEventListener("dragenter", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    setDropOverlayForPaths(droppedPathsFromDataTransfer(event.dataTransfer));
  });

  appRoot.addEventListener("dragover", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    setDropOverlayForPaths(droppedPathsFromDataTransfer(event.dataTransfer));
  });

  appRoot.addEventListener("dragleave", (event) => {
    if (isDesktopRuntime() || (event.relatedTarget instanceof Node && appRoot.contains(event.relatedTarget))) {
      return;
    }
    clearDropOverlay();
  });

  appRoot.addEventListener("drop", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    handleDroppedPaths(droppedPathsFromDataTransfer(event.dataTransfer));
  });
}

function activatePendingDropChoice(action: "openArchive" | "addToCompress" | "cancel") {
  if (action === "cancel") {
    clearDropOverlay();
    return;
  }

  if (!pendingDropChoice) {
    clearDropOverlay();
    return;
  }

  handleDropDecision(pendingDropChoice, action);
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
  if (currentArchivePath) {
    messageElement.textContent = i18n.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length });
  }
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
  if (currentArchivePath) {
    messageElement.textContent = i18n.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length });
  }
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
    const focused = focusedEntryPath === path;
    row.classList.toggle("is-selected", selected);
    row.classList.toggle("is-focused-row", focused);
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
  syncVisibleSelectionUi();
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
  selectionAnchorPath = entryPath;
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

function contextMenuItems(): HTMLElement[] {
  return Array.from(
    contextMenu.querySelectorAll<HTMLElement>(
      "button:not(:disabled), [role='menuitem']:not(:disabled):not([aria-disabled='true']), [role='menuitemcheckbox']:not(:disabled):not([aria-disabled='true'])",
    ),
  ).filter(isVisibleElement);
}

function showContextMenu(x: number, y: number, html: string, returnFocus: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
  contextMenuReturnFocus = returnFocus;
  contextMenu.innerHTML = html;
  contextMenu.hidden = false;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  const rect = contextMenu.getBoundingClientRect();
  const clampedX = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4));
  const clampedY = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4));
  contextMenu.style.left = `${clampedX}px`;
  contextMenu.style.top = `${clampedY}px`;
  contextMenuItems()[0]?.focus();
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

function isCompressSourceColumnId(value: string | undefined): value is CompressSourceColumnId {
  return COMPRESS_SOURCE_COLUMN_IDS.includes(value as CompressSourceColumnId);
}

function compressSourceColumnHeader(columnId: CompressSourceColumnId): HTMLTableCellElement | null {
  return compressSourceTable.querySelector<HTMLTableCellElement>(
    `th[data-compress-column-id="${CSS.escape(columnId)}"]`,
  );
}

function clampCompressSourceColumnWidth(columnId: CompressSourceColumnId, width: number): number {
  const minWidth = COMPRESS_SOURCE_MIN_COLUMN_WIDTHS[columnId];
  return Math.min(COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX, Math.max(minWidth, Math.round(width)));
}

function currentCompressSourceColumnWidths(): Record<CompressSourceColumnId, number> {
  const widths = { ...COMPRESS_SOURCE_DEFAULT_COLUMN_WIDTHS };
  for (const columnId of COMPRESS_SOURCE_COLUMN_IDS) {
    const renderedWidth = compressSourceColumnHeader(columnId)?.getBoundingClientRect().width;
    widths[columnId] = clampCompressSourceColumnWidth(
      columnId,
      Number.isFinite(renderedWidth) && renderedWidth ? renderedWidth : widths[columnId],
    );
  }
  return widths;
}

function applyCompressSourceColumnWidths(widths: Record<CompressSourceColumnId, number>) {
  compressSourceColumnWidths = widths;
  for (const columnId of COMPRESS_SOURCE_COLUMN_IDS) {
    compressSourceTable.style.setProperty(
      `--compress-source-${columnId}-column-width`,
      `${widths[columnId]}px`,
    );
  }
  const tableWidth = COMPRESS_SOURCE_INCLUDE_COLUMN_WIDTH_PX
    + COMPRESS_SOURCE_COLUMN_IDS.reduce((total, columnId) => total + widths[columnId], 0);
  compressSourceTable.style.minWidth = `${tableWidth}px`;
}

function startCompressSourceColumnResize(event: PointerEvent, columnId: CompressSourceColumnId) {
  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-column");

  const startX = event.clientX;
  const startWidths = compressSourceColumnWidths ?? currentCompressSourceColumnWidths();
  let latestWidths = startWidths;
  applyCompressSourceColumnWidths(startWidths);

  const onPointerMove = (moveEvent: PointerEvent) => {
    latestWidths = {
      ...startWidths,
      [columnId]: clampCompressSourceColumnWidth(
        columnId,
        startWidths[columnId] + moveEvent.clientX - startX,
      ),
    };
    applyCompressSourceColumnWidths(latestWidths);
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-column");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    applyCompressSourceColumnWidths(latestWidths);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
}

type ResizablePane = "navigation" | "details";

const PANE_RESIZE_CENTER_MIN_WIDTH_PX = 360;
const PANE_RESIZE_GUTTER_TOTAL_PX = 10;
const PANE_RESIZE_KEYBOARD_STEP_PX = 16;
const PANE_RESIZE_KEYBOARD_LARGE_STEP_PX = 48;

function paneWidthBounds(pane: ResizablePane): { min: number; max: number } {
  return pane === "navigation"
    ? { min: APP_NAV_PANE_MIN_WIDTH_PX, max: APP_NAV_PANE_MAX_WIDTH_PX }
    : { min: APP_DETAILS_PANE_MIN_WIDTH_PX, max: APP_DETAILS_PANE_MAX_WIDTH_PX };
}

function paneElementForResize(pane: ResizablePane): HTMLElement {
  return pane === "navigation" ? navigationPaneElement : detailsPaneElement;
}

function paneResizerForResize(pane: ResizablePane): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-pane-resizer="${pane}"]`);
}

function updatePaneResizerAttributes(pane: ResizablePane, width: number) {
  const resizer = paneResizerForResize(pane);
  if (!resizer) {
    return;
  }

  const { min, max } = paneWidthBounds(pane);
  resizer.setAttribute("aria-valuemin", String(min));
  resizer.setAttribute("aria-valuemax", String(max));
  resizer.setAttribute("aria-valuenow", String(Math.round(width)));
}

function currentResizablePaneWidth(pane: ResizablePane): number {
  const width = paneElementForResize(pane).getBoundingClientRect().width;
  if (width > 0) {
    return width;
  }

  return pane === "navigation" ? APP_NAV_PANE_DEFAULT_WIDTH_PX : APP_DETAILS_PANE_DEFAULT_WIDTH_PX;
}

function setResizablePaneWidth(pane: ResizablePane, width: number): number {
  const { min, max } = paneWidthBounds(pane);
  const shellWidth = browserShellElement.getBoundingClientRect().width;
  const otherPaneWidth = pane === "navigation"
    ? detailsPaneElement.getBoundingClientRect().width
    : navigationPaneElement.getBoundingClientRect().width;
  const maxWidthFromShell = shellWidth - otherPaneWidth - PANE_RESIZE_CENTER_MIN_WIDTH_PX - PANE_RESIZE_GUTTER_TOTAL_PX;
  const nextWidth = Math.max(min, Math.min(width, max, Math.max(min, maxWidthFromShell)));
  const variableName = pane === "navigation" ? "--zmanager-nav-pane-width" : "--zmanager-details-pane-width";
  document.documentElement.style.setProperty(variableName, `${Math.round(nextWidth)}px`);
  updatePaneResizerAttributes(pane, nextWidth);
  return nextWidth;
}

function startPaneResize(event: PointerEvent, pane: ResizablePane) {
  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-pane");

  const startX = event.clientX;
  const startWidth = currentResizablePaneWidth(pane);

  const onPointerMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX;
    setResizablePaneWidth(pane, pane === "navigation" ? startWidth + delta : startWidth - delta);
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-pane");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
}

function resizePaneByKeyboard(event: KeyboardEvent, pane: ResizablePane) {
  const { min, max } = paneWidthBounds(pane);
  const currentWidth = currentResizablePaneWidth(pane);
  const step = event.shiftKey ? PANE_RESIZE_KEYBOARD_LARGE_STEP_PX : PANE_RESIZE_KEYBOARD_STEP_PX;
  let nextWidth: number | null = null;

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    nextWidth = pane === "navigation" ? currentWidth - step : currentWidth + step;
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    nextWidth = pane === "navigation" ? currentWidth + step : currentWidth - step;
  } else if (event.key === "Home") {
    nextWidth = min;
  } else if (event.key === "End") {
    nextWidth = max;
  }

  if (nextWidth === null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  setResizablePaneWidth(pane, nextWidth);
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
  const canPastePath = Boolean(navigator.clipboard?.readText);
  const pastePath = canPastePath
    ? `<button type="button" role="menuitem" data-context-action="paste-archive-path"><span class="context-menu-label">${escapeHtml(message("command.pastePath"))}</span></button>`
    : "";
  const recentRows = recentArchiveHistory.length
    ? `
      <div class="context-menu-separator" role="separator"></div>
      <div class="context-menu-caption">${escapeHtml(message("command.openRecent"))}</div>
      ${recentArchiveHistory.slice(0, 4).map((archivePath) => `
        <button type="button" role="menuitem" data-context-action="open-recent-archive" data-archive-path="${escapeHtml(archivePath)}">
          <span class="context-menu-label">${escapeHtml(middleTruncateDetailValue(archivePath, 46))}</span>
        </button>
      `).join("")}
    `
    : "";
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-archive"><span class="context-menu-label">${escapeHtml(i18n.t("browse.emptyOpenAction"))}</span></button>
    ${pastePath}
    ${recentRows}
  `);
}

function showFolderContextMenu(folderPath: string, x: number, y: number, entryPath = "") {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  const selectedPaths = getSelectedEntryPaths();
  if (selectedPaths.length > 1) {
    showContextMenu(x, y, `
      <button type="button" role="menuitem" data-context-action="extract"><span class="context-menu-label">${escapeHtml(message("extract.selectedAction"))}</span></button>
      <button type="button" role="menuitem" data-context-action="extract-here"><span class="context-menu-label">${escapeHtml(message("command.extractHere"))}</span></button>
      <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">${escapeHtml(message("test.selectedAction"))}</span></button>
      <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">${escapeHtml(message("command.properties"))}</span></button>
    `);
    return;
  }

  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-folder" data-folder-path="${escapeHtml(folderPath)}"><span class="context-menu-label">${escapeHtml(message("command.openFolder"))}</span></button>
    ${entryPath ? `<button type="button" role="menuitem" data-context-action="open-inside"><span class="context-menu-label">${escapeHtml(message("command.openInside"))}</span></button>` : ""}
    <button type="button" role="menuitem" data-context-action="extract"><span class="context-menu-label">${escapeHtml(message("command.extractWithEllipsis"))}</span></button>
    <button type="button" role="menuitem" data-context-action="extract-here"><span class="context-menu-label">${escapeHtml(message("command.extractHere"))}</span></button>
    <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">${escapeHtml(message("command.test"))}</span></button>
    <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">${escapeHtml(message("command.properties"))}</span></button>
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
  const optionalOpenOutside = hasSingleSelection && entry?.kind !== "directory"
    ? `<button type="button" role="menuitem" data-context-action="open-outside"><span class="context-menu-label">${escapeHtml(message("command.openOutside"))}</span></button>`
    : "";
  const singleSelectionMenu = `
    <button type="button" role="menuitem" data-context-action="open-entry"><span class="context-menu-label">${escapeHtml(message("command.openFolder"))}</span></button>
    ${canOpenInside ? `<button type="button" role="menuitem" data-context-action="open-inside"><span class="context-menu-label">${escapeHtml(message("command.openInside"))}</span></button>` : ""}
    ${optionalOpenOutside}
    <button type="button" role="menuitem" data-context-action="extract"><span class="context-menu-label">${escapeHtml(message("command.extractWithEllipsis"))}</span></button>
    <button type="button" role="menuitem" data-context-action="extract-here"><span class="context-menu-label">${escapeHtml(message("command.extractHere"))}</span></button>
    <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">${escapeHtml(message("test.selectedAction"))}</span></button>
    <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">${escapeHtml(message("command.properties"))}</span></button>
  `;
  const multiSelectionMenu = `
    <button type="button" role="menuitem" data-context-action="extract"><span class="context-menu-label">${escapeHtml(message("extract.selectedAction"))}</span></button>
    <button type="button" role="menuitem" data-context-action="extract-here"><span class="context-menu-label">${escapeHtml(message("command.extractHere"))}</span></button>
    <button type="button" role="menuitem" data-context-action="test" ${!currentArchivePath ? "disabled" : ""}><span class="context-menu-label">${escapeHtml(message("test.selectedAction"))}</span></button>
    <button type="button" role="menuitem" data-context-action="info"><span class="context-menu-label">${escapeHtml(message("command.properties"))}</span></button>
  `;
  showContextMenu(x, y, `
    ${hasSingleSelection ? singleSelectionMenu : multiSelectionMenu}
    <div class="context-menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-context-action="select-by-type"><span class="context-menu-label">${escapeHtml(message("command.selectByType"))}</span></button>
    <button type="button" role="menuitem" data-context-action="deselect-by-type" ${selectedEntries.size === 0 ? "disabled" : ""}><span class="context-menu-label">${escapeHtml(message("command.deselectByType"))}</span></button>
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
    <div class="context-menu-caption">${escapeHtml(message("detail.columnCaption", { label: archiveTableColumnLabel(selectedColumn, i18n) }))}</div>
    <button type="button" role="menuitem" data-context-action="sort-ascending" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">${escapeHtml(message("command.sortAscending"))}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="sort-descending" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">${escapeHtml(message("command.sortDescending"))}</span>
    </button>
    <div class="context-menu-separator" role="separator"></div>
    <button
      type="button"
      role="menuitem"
      data-context-action="move-column-left"
      data-column-id="${escapeHtml(selectedColumn.id)}"
      ${selectedColumn.id === "name" || selectedColumnIndex <= 1 ? "disabled" : ""}
    >
      <span class="context-menu-label">${escapeHtml(message("command.moveLeft"))}</span>
    </button>
    <button
      type="button"
      role="menuitem"
      data-context-action="move-column-right"
      data-column-id="${escapeHtml(selectedColumn.id)}"
      ${selectedColumn.id === "name" || selectedColumnIndex < 1 || selectedColumnIndex >= visibleColumnOrder.length - 1 ? "disabled" : ""}
    >
      <span class="context-menu-label">${escapeHtml(message("command.moveRight"))}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="narrow-column" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">${escapeHtml(message("command.narrower"))}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="widen-column" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">${escapeHtml(message("command.wider"))}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="reset-column-width" data-column-id="${escapeHtml(selectedColumn.id)}">
      <span class="context-menu-label">${escapeHtml(message("command.resetWidth"))}</span>
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
        <span class="context-menu-label">${escapeHtml(archiveTableColumnLabel(column, i18n))}</span>
      </button>
    `;
  }).join("");

  showContextMenu(
    x,
    y,
    `${selectedColumnMenu}
      <button type="button" role="menuitem" data-context-action="reset-columns"><span class="context-menu-label">${escapeHtml(message("command.resetColumns"))}</span></button>
      <div class="context-menu-separator" role="separator"></div>
      <div class="context-menu-caption">${escapeHtml(message("command.chooseColumns"))}</div>${menuRows}
    `,
  );
}

function showCompressRowContextMenu(row: HTMLTableRowElement, x: number, y: number) {
  const rowPath = row.dataset.compressPath ?? "";
  const folderPath = row.dataset.compressFolderRow;
  const sourcePath = row.dataset.compressSourcePath ?? "";
  const removableSourcePath = removableSourcePathForCompressRow(row);
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

  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="compress-open-folder" data-folder-path="${escapeHtml(folderPath ?? "")}" ${folderPath === undefined ? "disabled" : ""}>
      <span class="context-menu-label">${escapeHtml(message("command.openFolder"))}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="reveal-source" ${sourcePath ? "" : "disabled"}>
      <span class="context-menu-label">${escapeHtml(message("command.revealInFileManager"))}</span>
    </button>
    <div class="context-menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-context-action="include-compress-path" data-compress-menu-path="${escapeHtml(rowPath)}" ${canInclude ? "" : "disabled"}>
      <span class="context-menu-label">${escapeHtml(includeLabel)}</span>
    </button>
    <button type="button" role="menuitem" data-context-action="exclude-compress-path" data-compress-menu-path="${escapeHtml(rowPath)}" ${canExclude ? "" : "disabled"}>
      <span class="context-menu-label">${escapeHtml(excludeLabel)}</span>
    </button>
    <div class="context-menu-separator" role="separator"></div>
    ${removableSourcePaths.length ? `<button type="button" role="menuitem" data-context-action="remove-source">
      <span class="context-menu-label">${escapeHtml(removeLabel)}</span>
    </button>` : ""}
    <button type="button" role="menuitem" data-context-action="clear-sources" ${createSources.length ? "" : "disabled"}>
      <span class="context-menu-label">${escapeHtml(message("command.clearAllSources"))}</span>
    </button>
  `);
}

function showSourceContextMenu(sourcePath: string, x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = sourcePath;
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="reveal-source">${escapeHtml(message("command.revealInFileManager"))}</button>
    <button type="button" role="menuitem" data-context-action="remove-source">${escapeHtml(message("command.removeSource"))}</button>
    <div class="context-menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-context-action="clear-sources">${escapeHtml(message("command.clearAllSources"))}</button>
  `);
}

function showAddSourcesMenu(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(rect.left, rect.bottom + 4, `
    <button type="button" role="menuitem" data-context-action="add-source-files"><span class="context-menu-label">${escapeHtml(message("command.filesWithEllipsis"))}</span></button>
    <button type="button" role="menuitem" data-context-action="add-source-folder"><span class="context-menu-label">${escapeHtml(message("command.folderWithEllipsis"))}</span></button>
  `);
}

function hideContextMenu() {
  const restoreTarget = contextMenuReturnFocus;
  const active = document.activeElement;
  const shouldRestoreFocus = active instanceof HTMLElement && contextMenu.contains(active);
  contextMenu.hidden = true;
  contextMenu.innerHTML = "";
  contextEntryPath = "";
  contextSourcePath = "";
  contextMenuReturnFocus = null;
  if (
    restoreTarget &&
    shouldRestoreFocus &&
    isVisibleElement(restoreTarget)
  ) {
    restoreTarget.focus();
  }
}

function showArchiveInfo() {
  infoTitle.textContent = message("info.archiveTitle");
  infoDescription.textContent = message("info.archiveDescription");
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
  setInfoActions([
    { label: message("info.copyPath"), copyValue: currentArchivePath },
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
  ]);

  infoDialogBody.innerHTML = `
    <section class="dialog-section property-section">
      <h3>${escapeHtml(message("info.archiveTitle"))}</h3>
      <dl class="detail-list">
        ${renderDetailRows(rows)}
      </dl>
    </section>
  `;
  openModal(infoDialog, "#info-close", infoReturnFocusForCurrentSelection());
}

function showEntryInfo(path: string) {
  const entry = getEntryByPath(path);
  if (!entry) {
    return;
  }

  infoTitle.textContent = message("info.entryTitle");
  infoDescription.textContent = message("info.entryDescription");
  const rows = entryPropertyRows(entry);
  const canPreview = entry.kind !== "directory";
  setInfoActions([
    ...(canPreview ? [{ label: message("command.view"), action: "preview", primary: true, title: previewActionHint() }] : []),
    { label: message("info.copyPath"), copyValue: entry.path },
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
    { label: message("info.archiveTitle"), action: "archive-info" },
  ]);
  infoDialogBody.innerHTML = `
    <section class="dialog-section property-section">
      <h3>${escapeHtml(message("info.entryTitle"))}</h3>
      <dl class="detail-list">
        ${renderDetailRows(rows)}
      </dl>
    </section>
  `;
  openModal(infoDialog, "#info-close", infoReturnFocusForCurrentSelection());
}

function showSelectionInfo(selectedRows = getVisibleSelectedRows()) {
  if (selectedRows.length === 0) {
    showArchiveInfo();
    return;
  }

  const rows = selectionPropertyRows(selectedRows);
  infoTitle.textContent = message("info.selectionTitle");
  infoDescription.textContent = message("info.selectionDescription");
  setInfoActions([
    { label: message("info.copyDetails"), copyValue: detailRowsToText(rows) },
    { label: message("info.archiveTitle"), action: "archive-info" },
  ]);
  infoDialogBody.innerHTML = `
    <section class="dialog-section property-section">
      <h3>${escapeHtml(message("info.selectionTitle"))}</h3>
      <dl class="detail-list">
        ${renderDetailRows(rows)}
      </dl>
    </section>
  `;
  openModal(infoDialog, "#info-close", infoReturnFocusForCurrentSelection());
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

function renderAboutDiagnostics() {
  const healthcheck = latestHealthcheck;
  const contract = latestContract;
  const shellActions =
    contract?.platformIntegration.shellActions
      .map((action) => `${action.label} (${action.quickAction})`)
      .join(", ") ?? "-";
  const groups = [
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

  aboutDiagnostics.innerHTML = groups.map((group) => `
    <section class="diagnostic-group" data-diagnostics-group>
      <h3>${escapeHtml(group.title)}</h3>
      <dl class="detail-list">
        ${group.rows.map(([label, value]) => `
          <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
        `).join("")}
      </dl>
    </section>
  `).join("");
}

function diagnosticsText(): string {
  const lines: string[] = [];
  for (const group of aboutDiagnostics.querySelectorAll<HTMLElement>("[data-diagnostics-group]")) {
    const title = group.querySelector("h3")?.textContent?.trim();
    if (title) {
      lines.push(title);
    }
    for (const row of group.querySelectorAll("dl > div")) {
      const label = row.querySelector("dt")?.textContent?.trim();
      const value = row.querySelector("dd")?.textContent?.trim();
      if (label && value) {
        lines.push(`${label}: ${value}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function syncPreferenceOutputState() {
  syncPreferenceOutputViewState(preferencesViewElements);
  syncPreferenceSaveState();
}

function showPreferencePage(pageName: string) {
  for (const button of preferencesPageButtons) {
    const selected = button.dataset.prefPageTarget === pageName;
    button.setAttribute("aria-selected", String(selected));
  }

  for (const page of preferencesPages) {
    page.hidden = page.dataset.prefPage !== pageName;
  }
}

function setPreferenceCustomOutputMessage(kind: "idle" | "error", text = "") {
  preferencesCustomOutputValidation.textContent = text;
  preferencesCustomOutputValidation.hidden = !text;
  preferencesCustomOutputValidation.className = kind === "error"
    ? "setting-validation status-error"
    : "setting-validation";
}

function syncPreferenceSaveState() {
  const customOutputSelected = preferencesOutputLocationSelect.value === "customFolder";
  const customOutputPath = fullCustomOutputPath(preferencesCustomOutputInput).trim();
  const missingCustomOutput = customOutputSelected && !customOutputPath;
  preferencesSaveButton.disabled = missingCustomOutput;
  preferencesCustomOutputInput.setAttribute("aria-invalid", String(missingCustomOutput));
  if (missingCustomOutput) {
    setPreferenceCustomOutputMessage("error", message("preferences.validation.customOutputRequired"));
  } else if (!customOutputSelected) {
    setPreferenceCustomOutputMessage("idle");
    preferencesCustomOutputInput.removeAttribute("aria-invalid");
  } else if (preferencesCustomOutputValidation.textContent === message("preferences.validation.customOutputRequired")) {
    setPreferenceCustomOutputMessage("idle");
    preferencesCustomOutputInput.removeAttribute("aria-invalid");
  }
}

async function validatePreferenceCustomOutputFolder(): Promise<boolean> {
  const customOutputSelected = preferencesOutputLocationSelect.value === "customFolder";
  const customOutputPath = fullCustomOutputPath(preferencesCustomOutputInput).trim();
  if (!customOutputSelected) {
    return true;
  }
  if (!customOutputPath) {
    syncPreferenceSaveState();
    return false;
  }
  if (!isDesktopRuntime()) {
    setPreferenceCustomOutputMessage("idle");
    preferencesCustomOutputInput.removeAttribute("aria-invalid");
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
      preferencesSaveButton.disabled = true;
      preferencesCustomOutputInput.setAttribute("aria-invalid", "true");
      setPreferenceCustomOutputMessage("error", message(messageKey));
      return false;
    }
  } catch {
    preferencesCustomOutputInput.setAttribute("aria-invalid", "true");
    setPreferenceCustomOutputMessage("error", message("preferences.validation.customOutputInaccessible"));
    return false;
  }

  preferencesSaveButton.disabled = false;
  preferencesCustomOutputInput.removeAttribute("aria-invalid");
  setPreferenceCustomOutputMessage("idle");
  return true;
}

function applyLocaleFromPreferences() {
  resolvedLocale = resolveLocalePreference(appPreferences.locale);
  i18n = createTranslator(resolvedLocale);
  document.documentElement.lang = resolvedLocale;
  document.documentElement.dir = localeDirection(resolvedLocale);
  applyTranslations(document.body, i18n);
  refreshCommandDisplayText();
}

function refreshCommandDisplayText() {
  for (const summary of document.querySelectorAll<HTMLElement>("[data-menu-group-label]")) {
    const label = summary.dataset.menuGroupLabel as Parameters<typeof menuGroupLabel>[0] | undefined;
    if (label) {
      summary.textContent = menuGroupLabel(label, i18n);
    }
  }

  for (const submenu of document.querySelectorAll<HTMLElement>("[data-command-submenu-label]")) {
    const key = submenu.dataset.commandSubmenuLabel as Parameters<Translator["t"]>[0] | undefined;
    if (key) {
      submenu.textContent = i18n.t(key);
    }
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-command-id]")) {
    const commandId = button.dataset.commandId as CommandId | undefined;
    if (!commandId) {
      continue;
    }
    const label = commandLabel(commandId, i18n);
    const textElement = button.querySelector<HTMLElement>(".tool-label, .context-menu-label")
      ?? button.querySelector<HTMLElement>("span:not(.sort-indicator)");
    if (textElement) {
      textElement.textContent = label;
    } else if (!button.querySelector("svg")) {
      button.textContent = label;
    }
    button.setAttribute("aria-label", label);
    button.title = commandTooltipText(commandId, i18n);
  }
}

function localizedCommandStateReason(reason?: string): string | undefined {
  if (reason === UNSUPPORTED_OPERATION_MESSAGE) {
    return i18n.t("command.unsupported");
  }
  if (reason === SINGLE_FILE_REQUIRED_MESSAGE) {
    return i18n.t("command.singleFileRequired");
  }
  if (reason === SINGLE_FOLDER_REQUIRED_MESSAGE) {
    return i18n.t("command.singleFolderRequired");
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

function onPreferencesCreateFormatChange() {
  const draft = preferencesDialogDraft ?? appPreferences;
  renderCreateDefaultsForSelectedFormat(preferencesViewElements, draft);
}

function onPreferencesDefaultFormatChange() {
  updatePreferencesDialogDraft();
  preferencesCreateFormatSelect.value = preferencesDefaultFormatSelect.value;
  onPreferencesCreateFormatChange();
}

function renderPreferencesDialog() {
  renderPreferencesView(preferencesViewElements, preferencesDialogDraft ?? appPreferences, i18n);
  syncPreferenceSaveState();
}

function collectPreferencesFromDialog(): AppPreferences {
  return collectPreferencesFromView(preferencesViewElements, preferencesDialogDraft ?? appPreferences);
}

function applyCreatePreferenceDefaults() {
  const format = appPreferences.defaultArchiveFormat;
  createFormatSelect.value = format;
  applyCreateDefaultsForFormat(format);
  if (!createDestinationInput.value.trim() && createSources.length > 0) {
    createDestinationInput.value = suggestedCreateArchiveDefaultPath();
  }
  setCreatePlanState(createPlanState, currentPlanError);
}

function applyCreateDefaultsForFormat(format: CreateArchiveFormat) {
  const defaults = createDefaultsForFormat(appPreferences, format);
  createCleanSourceCheckbox.checked = defaults.cleanSource;
  createPreserveMetadataCheckbox.checked = defaults.preserveMetadata;
  createReplaceExistingCheckbox.checked = defaults.replaceExisting;
  createCompressionInput.value = defaults.compressionLevel === null
    ? ""
    : String(defaults.compressionLevel);
  createVolumeInput.value = defaults.volumeSize === null ? "" : String(defaults.volumeSize);
  createTzapRecoveryInput.value = String(defaults.tzapRecoveryPercentage ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT);
  createPasswordInput.value = "";
  createPasswordConfirmInput.value = "";
  createShowPasswordInput.checked = false;
  createPasswordInput.type = "password";
  createPasswordConfirmInput.type = "password";
  syncCreateFormatOptions(format);
}

function syncCreateFormatOptions(format: CreateArchiveFormat) {
  const supportsPassword = createFormatSupportsPassword(format);
  createPasswordOptions.hidden = !supportsPassword;
  createPasswordInput.disabled = !supportsPassword;
  createPasswordConfirmInput.disabled = !supportsPassword;
  createShowPasswordInput.disabled = !supportsPassword;
  if (!supportsPassword) {
    createPasswordInput.value = "";
    createPasswordConfirmInput.value = "";
    createShowPasswordInput.checked = false;
    createPasswordInput.type = "password";
    createPasswordConfirmInput.type = "password";
  }

  const supportsTzapRecovery = format === "tzap";
  createTzapRecoveryField.hidden = !supportsTzapRecovery;
  createTzapRecoveryInput.disabled = !supportsTzapRecovery;
  if (!supportsTzapRecovery) {
    createTzapRecoveryInput.value = String(TZAP_RECOVERY_PERCENTAGE_DEFAULT);
  }
}

function updatePreferencesDialogDraft() {
  preferencesDialogDraft = collectPreferencesFromView(
    preferencesViewElements,
    preferencesDialogDraft ?? appPreferences,
  );
}

async function savePreferencesFromDialog() {
  updatePreferencesDialogDraft();
  if (!(await validatePreferenceCustomOutputFolder())) {
    return;
  }
  appPreferences = preferencesDialogDraft ?? collectPreferencesFromDialog();
  preferencesDialogDraft = null;
  saveAppPreferences(appPreferences);
  applyLocaleFromPreferences();
  isFlatView = appPreferences.flatViewDefault;
  preferencesStatusElement.textContent = i18n.t("preferences.saved");
  preferencesStatusElement.className = "status status-success";
  applyCreatePreferenceDefaults();
  applyPreferenceClasses();
  renderBrowse();
  window.setTimeout(() => closeModal(preferencesDialog), 240);
}

function openPreferencesDialog() {
  preferencesDialogDraft = appPreferences;
  showPreferencePage("folders");
  renderPreferencesDialog();
  openModal(preferencesDialog, "#pref-output-location");
}

async function onSelectPreferenceOutputFolder() {
  const selected = await openNativeDialog({
    title: i18n.t("nativeDialog.chooseDefaultOutput"),
    directory: true,
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) {
    return;
  }

  preferencesCustomOutputInput.value = selected;
  syncCustomOutputPathFromInput(preferencesCustomOutputInput);
  renderCustomOutputPathDisplay(preferencesCustomOutputInput);
  syncPreferenceSaveState();
  void validatePreferenceCustomOutputFolder();
}

function openExtractDialog(mode: ExtractMode) {
  if (!currentArchivePath) {
    return;
  }

  activeExtractMode = mode;
  extractTitle.textContent = message(mode === "selection" ? "extract.selectedTitle" : "extract.archiveTitle");
  extractDialogMessage.textContent = extractDialogMessageForMode(mode);
  extractStartButton.textContent = message(mode === "selection" ? "extract.selectedAction" : "extract.allAction");
  if (!extractDestinationInput.value.trim() && extractDestinationHistory[0]) {
    extractDestinationInput.value = extractDestinationHistory[0];
  }
  extractUseSubfolderCheckbox.checked = false;
  extractSubfolderInput.value = "";
  extractSubfolderInput.disabled = true;
  extractPathModeSelect.value = "full";
  extractDeduplicateRootCheckbox.checked = false;
  browseShowPasswordInput.checked = false;
  browsePasswordInput.type = "password";
  extractPasswordOptions.open = false;
  renderExtractDestinationHistory();
  syncExtractDialogState();
  openModal(extractDialog, "#extract-destination");
}

function openExtractHereDialog(mode: ExtractMode) {
  const parent = nativeParentPath(currentArchivePath);
  openExtractDialog(mode);
  if (parent) {
    extractDestinationInput.value = parent;
    extractDialogMessage.textContent = mode === "selection"
      ? message("extract.hereSelected", { archiveName: getArchiveName(currentArchivePath, APP_TITLE) })
      : message("extract.hereArchive", { archiveName: getArchiveName(currentArchivePath, APP_TITLE) });
    syncExtractDialogState();
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
  renderCompressBrowser();
  renderCreateDestinationHistory();
  createDestinationInput.focus();
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

    setBrowseState("loading", i18n.t("browse.statusLoading"));
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
            : message("browse.failedList"),
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
  hideContextMenu();
  workspaceMode = "extract";
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
    ? visibleRows().some((row) => row.path === normalizeEntryPath(preservedFocusPath))
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

  setBrowseState(listing.entries.length > 0 ? "loaded" : "empty", message("archive.loaded"));

  messageElement.textContent = listing.entries.length > 0
    ? message("browse.loadedEntries", { count: listing.entries.length })
    : message("browse.validEmpty");

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
  setCreatePlanState("loading", i18n.t("create.plan.planning"));
  createPlanSummary.innerHTML = `<p>${escapeHtml(i18n.t("create.plan.planning"))}</p>`;
  renderCompressBrowser();

  if (canUseBrowserCreatePlanPreview()) {
    const result = browserCreatePlanPreview(createSources);
    currentPlan = result;
    const plannedPaths = new Set(result.planEntries.map((entry) => normalizeEntryPath(entry.path)));
    excludedCreateArchivePaths = new Set([...excludedCreateArchivePaths].filter((path) => plannedPaths.has(path)));
    if (!compressFolderExists(result.planEntries, currentCompressFolder)) {
      currentCompressFolder = "";
    }
    refreshCreatePlanSummary();
    setCreatePlanState("ready", "Plan generated.");
    renderCompressBrowser();
    return;
  }

  try {
    const result = await runPlanCreate(request);

    if (revision !== createPlanRevision) {
      return;
    }

    currentPlan = result;
    const plannedPaths = new Set(result.planEntries.map((entry) => normalizeEntryPath(entry.path)));
    excludedCreateArchivePaths = new Set([...excludedCreateArchivePaths].filter((path) => plannedPaths.has(path)));
    if (!compressFolderExists(result.planEntries, currentCompressFolder)) {
      currentCompressFolder = "";
    }
    refreshCreatePlanSummary();
    setCreatePlanState("ready", "Plan generated.");
    renderCompressBrowser();
  } catch (error) {
    if (revision !== createPlanRevision) {
      return;
    }

    currentPlan = null;
    const commandError = asCommandError(error);
    const message = commandError?.message ?? "Could not create archive plan.";
    setCreatePlanState("error", message);
    createPlanSummary.innerHTML = `<p>${escapeHtml(message)}</p>`;
    renderCompressBrowser();
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
  jobs.set(response.jobId, createInitialJobState(response));
  trackQuickActionJob(response.jobId, options.progressContext);

  if (options.retryContext) {
    jobRetryContexts.set(response.jobId, options.retryContext);
  }
  if (options.outputActions?.length) {
    jobOutputActions.set(response.jobId, options.outputActions);
  }

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
  const sources = uniqueQuickActionPaths(paths);
  if (!sources.length) {
    setOperationalMessage("quickCreate.needsSource");
    return;
  }

  const destinationPath = buildQuickCreateDestination(
    sources,
    format,
    appPreferences,
    { nativeParentPath, joinNativePath },
  );

  if (!destinationPath) {
    setOperationalMessage("quickCreate.needsDestination");
    return;
  }

  setOperationalMessage("quickCreate.starting");
  try {
    const defaults = createDefaultsForFormat(appPreferences, format);
    let password: string | undefined;
    if (defaults.promptForPassword && createFormatSupportsPassword(format)) {
      const promptedPassword = promptForArchivePassword(message("create.prompt.newArchivePassword"));
      if (!promptedPassword) {
        setOperationalMessage("quickCreate.cancelled");
        return;
      }
      password = promptedPassword;
    }
    const request = buildStartCreateRequest({
      sources,
      destinationPath,
      format,
      cleanSource,
      replaceExisting: defaults.replaceExisting,
      destinationCollisionStrategy: "rename",
      preserveMetadata: defaults.preserveMetadata,
      password,
      compressionLevel: defaults.compressionLevel ?? undefined,
      volumeSize: defaults.volumeSize ?? undefined,
    });
    const response = await runStartCreate(request);
    recordCreateDestinationHistory(destinationPath);
    addJobState(response, {
      focusProgress: true,
      autoCloseAction: "closeWindow",
      progressContext: createJobProgressContext(request),
      outputActions: createJobOutputActions(request),
    });
    setOperationalMessage("quickCreate.started");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("quickCreate.unableStart"));
  }
}

async function openQuickCreateReview(
  paths: string[],
  format: CreateArchiveFormat,
  cleanSource: boolean,
) {
  const sources = uniqueQuickActionPaths(paths);
  if (!sources.length) {
    setOperationalMessage("quickCreate.needsSource");
    return;
  }

  showCreateWorkspace();
  createSources = sources;
  createFormatSelect.value = format;
  applyCreateDefaultsForFormat(format);
  createCleanSourceCheckbox.checked = cleanSource;
  createDestinationInput.value = buildQuickCreateDestination(
    sources,
    format,
    appPreferences,
    { nativeParentPath, joinNativePath },
  );
  currentPlan = null;
  cancelQueuedPlanRun();
  renderCreateSources();
  renderCompressBrowser();

  setOperationalMessage("quickCreate.planning");
  await runPlan();
  if (createPlanState === "ready" && currentPlan !== null) {
    setOperationalMessage("quickCreate.review");
  } else {
    setOperationalMessage("quickCreate.needsReview");
  }
}

async function openQuickExtractReview(paths: string[]) {
  const archives = uniqueQuickActionPaths(paths);
  if (archives.length !== 1) {
    setOperationalMessage("quickExtract.oneArchiveAtATime");
    return;
  }

  const archivePath = archives[0];
  if (!isSupportedArchivePath(archivePath)) {
    setOperationalMessage("archive.unsupported", { archivePath });
    return;
  }

  currentArchivePath = archivePath;
  await loadArchive({ archivePath });
  if (browseState !== "loaded" && browseState !== "empty") {
    return;
  }

  setOperationalMessage("quickExtract.chooseOptions");
  openExtractDialog("archive");
}

async function startQuickExtract(paths: string[], action: QuickActionExtractMode) {
  const archives = uniqueQuickActionPaths(paths);
  if (!archives.length) {
    setOperationalMessage("quickExtract.needsArchive");
    return;
  }

  for (const archivePath of archives) {
    if (!isSupportedArchivePath(archivePath)) {
      setOperationalMessage("archive.unsupported", { archivePath });
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
          setOperationalMessage("quickExtract.chooseDestination", { archivePath });
          break;
        }

        const request = buildStartExtractRequest({
          archivePath,
          destinationPath: destinationPlan.destinationPath,
          overwrite: "rename",
          destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
          stripComponents: destinationPlan.stripComponents,
          ...(password ? { password } : {}),
        });
        const response = await runStartExtract(request);
        recordExtractDestinationHistory(destinationPlan.destinationPath);
        addJobState(response, {
          retryContext: {
            retryKind: "extractArchive",
            archivePath,
            destinationPath: destinationPlan.destinationPath,
            overwrite: "rename",
            destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
            stripComponents: destinationPlan.stripComponents,
          },
          focusProgress: true,
          autoCloseAction: "closeWindow",
          progressContext: extractJobProgressContext(request),
          outputActions: extractJobOutputActions(request),
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

        setOperationalStatus(commandError?.message ?? message("quickExtract.unableExtract", { archivePath }));
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
  setOperationalMessage("jobs.quickActionStarted");
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
    setOperationalStatus(unknownErrorMessage(error, message("jobs.quickActionStartupReadFailed")));
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
      ? message("quickAction.openingArchive")
      : message("quickAction.starting");
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

  try {
    await bindQuickActionLaunchEvents();
    await handleStartupQuickAction();
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, message("desktopIntegration.initFailed")));
    await revealNormalAppWindow();
  }
}

async function startPasswordRetryJob(context: JobRetryContext, password: string) {
  if (context.retryKind === "testArchive") {
    return runTestArchive({
      archivePath: context.archivePath,
      entryPaths: context.entryPaths,
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
    setOperationalMessage("jobs.retryUnavailable");
    return;
  }

  const failure = getLatestPasswordFailureEvent(state);
  if (!failure?.code) {
    setOperationalMessage("jobs.retryUnavailable");
    return;
  }

  const password = promptForArchivePassword(getArchivePasswordPrompt(failure.code));
  if (!password) {
    setOperationalMessage("jobs.passwordRetryCancelled");
    return;
  }

  try {
    const response = await startPasswordRetryJob(context, password);
    addJobState(response, {
      retryContext: context,
      outputActions: retryJobOutputActions(context),
    });
    setOperationalMessage("jobs.passwordRetryStarted");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.passwordRetryFailed"));
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
            focusedJobProgressContexts.delete(jobId);
            quickActionJobIds.delete(jobId);
            promptedPasswordRetryJobs.delete(jobId);
            return;
          }

          const messageText = commandError?.message ?? message("jobs.readProgressFailed");
          const failedEvent = {
            eventType: "failed" as const,
            code: commandError?.code,
            hint: commandError?.hint,
            severity: "error" as const,
            retryable: true,
            message: messageText,
          };
          jobs.set(jobId, {
            snapshot: {
              ...state.snapshot,
              status: "failed",
              canDismiss: true,
              events: [failedEvent],
            },
            events: [...state.events, failedEvent],
          });
          setOperationalStatus(messageText);
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

function scheduleProgressClock() {
  if (progressClockTimer !== null) {
    return;
  }

  progressClockTimer = window.setInterval(() => {
    renderJobs();
  }, 1000);
}

function stopProgressClock() {
  if (progressClockTimer === null) {
    return;
  }

  window.clearInterval(progressClockTimer);
  progressClockTimer = null;
}

function syncProgressClock() {
  if (hasActiveJob()) {
    scheduleProgressClock();
  } else {
    stopProgressClock();
  }
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
    title: i18n.t("nativeDialog.openArchive"),
    directory: false,
    multiple: false,
    filters: [ARCHIVE_OPEN_FILTER],
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  clearTrackedPreviewState();
  currentArchivePath = selected;
  recordRecentArchiveHistory(selected);
  await loadArchive({ archivePath: selected });
}

async function openArchiveFromPath(archivePath: string) {
  const selected = archivePath.trim();
  if (!selected) {
    return;
  }

  clearTrackedPreviewState();
  currentArchivePath = selected;
  recordRecentArchiveHistory(selected);
  await loadArchive({ archivePath: selected });
}

async function openArchiveFromClipboard() {
  if (!navigator.clipboard?.readText) {
    setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE);
    return;
  }

  try {
    const pastedPath = (await navigator.clipboard.readText()).trim().replace(/^["']|["']$/g, "");
    if (!pastedPath) {
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
    await openArchiveFromPath(pastedPath);
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, i18n.t("nativeDialog.failed")));
  }
}

async function onTestArchive() {
  if (!currentArchivePath) {
    return;
  }

  const entryPaths = getSelectedExtractEntryPaths();
  let password = browsePasswordInput.value.trim() || undefined;

  while (true) {
    try {
      const response = await runTestArchive({
        archivePath: currentArchivePath,
        ...(entryPaths.length ? { entryPaths } : {}),
        ...(password ? { password } : {}),
      });
      addJobState(response, {
        retryContext: {
          retryKind: "testArchive",
          archivePath: currentArchivePath,
          ...(entryPaths.length ? { entryPaths } : {}),
        },
      });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (!commandError) {
        setBrowseState("error", message("test.unableStart"));
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
    setOperationalMessage("preview.cleanupDesktopOnly");
    return;
  }

  if (!currentPreviewCleanupRoot && !currentPreviewPath) {
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
    await navigator.clipboard.writeText(selectedPaths.join("\n"));
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
    await navigator.clipboard.writeText(value);
    setOperationalMessage("status.copied");
  } catch {
    setOperationalStatus("Could not copy.");
  }
}

const WINDOW_GEOMETRY_KEY = "zmanager.windowGeometry";

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
  return normalizeStoredWindowGeometry(readJsonFromStorage<WindowGeometry>(WINDOW_GEOMETRY_KEY));
}

function saveWindowGeometryToStorage(geometry: WindowGeometry): void {
  if (!isFiniteNumber(geometry.width) || !isFiniteNumber(geometry.height)) {
    return;
  }
  saveJsonToStorage(WINDOW_GEOMETRY_KEY, geometry);
}

async function restoreWindowGeometry(): Promise<boolean> {
  if (!isDesktopRuntime()) {
    return false;
  }

  const storedGeometry = loadWindowGeometryFromStorage();
  if (!storedGeometry) {
    return false;
  }

  const currentWindow = getCurrentWindow();
  const scaleFactor = await currentWindow.scaleFactor();
  let monitors: Awaited<ReturnType<typeof availableMonitors>>;
  try {
    monitors = await availableMonitors();
  } catch {
    return false;
  }
  const geometry = restorableWindowGeometry(storedGeometry, monitors, scaleFactor);
  if (!geometry) {
    return false;
  }
  if (geometry.width && geometry.height) {
    await currentWindow.setSize(new LogicalSize(geometry.width, geometry.height));
  }
  if (isFiniteNumber(geometry.x) && isFiniteNumber(geometry.y)) {
    await currentWindow.setPosition(new LogicalPosition(geometry.x, geometry.y));
  }
  return true;
}

async function placeNormalAppWindowBeforeShow(): Promise<void> {
  const restored = await restoreWindowGeometry();
  if (!restored) {
    await getCurrentWindow().center();
  }
}

async function persistWindowGeometry(): Promise<void> {
  if (!isDesktopRuntime() || isQuickActionJobMode()) {
    return;
  }

  const currentWindow = getCurrentWindow();
  const scaleFactor = await currentWindow.scaleFactor();
  const size = (await currentWindow.innerSize()).toLogical(scaleFactor);
  const position = (await currentWindow.innerPosition()).toLogical(scaleFactor);

  const width = Math.floor(size.width);
  const height = Math.floor(size.height);
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);

  saveWindowGeometryToStorage({
    width,
    height,
    x,
    y,
    unit: "logical",
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
    title: i18n.t("nativeDialog.chooseExtractDestination"),
    directory: true,
    multiple: false,
  });

  if (!selected || typeof selected !== "string") {
    return;
  }

  extractDestinationInput.value = selected;
  syncExtractDialogState();
  extractDestinationInput.focus();
}

async function startExtract(destinationMode: ExtractMode) {
  if (!currentArchivePath) {
    return;
  }

  const destination = resolveExtractDestination(extractDestinationInput.value);
  if (!isExtractDestinationValid() || !destination) {
    extractDialogMessage.textContent = message("extract.chooseDestinationFirst");
    syncExtractDialogState();
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
        const request = buildStartExtractRequest({
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          stripComponents,
          password,
        });
        const response = await runStartExtract(request);
        recordExtractDestinationHistory(destination);
        closeModal(extractDialog);
        addJobState(response, {
          retryContext: {
            retryKind: "extractArchive",
            archivePath: currentArchivePath,
            destinationPath: destination,
            overwrite,
            entryPaths: undefined,
            stripComponents,
          },
          focusProgress: true,
          autoCloseAction: "returnToWorkspace",
          progressContext: extractJobProgressContext(request),
          outputActions: extractJobOutputActions(request),
        });
        return;
      } catch (error) {
        const commandError = asCommandError(error);
        if (
          commandError?.code === COMMAND_PASSWORD_REQUIRED ||
          commandError?.code === COMMAND_INVALID_PASSWORD
        ) {
          requestExtractPasswordInDialog(commandError.code);
          return;
        }
        setBrowseState("error", commandError?.message ?? message("extract.unableStart"));
        return;
      }
    }
  }

  const entries = getSelectedExtractEntryPaths();
  if (!entries.length) {
    extractDialogMessage.textContent = message("extract.selectEntryFirst");
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
      const request = buildStartExtractRequest({
        archivePath: currentArchivePath,
        destinationPath: destination,
        overwrite,
        entryPaths: entries,
        stripComponents,
        password,
      });
      const response = await runStartExtract(request);
      recordExtractDestinationHistory(destination);
      closeModal(extractDialog);
      addJobState(response, {
        retryContext: {
          retryKind: "extractArchive",
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          entryPaths: entries,
          stripComponents,
        },
        focusProgress: true,
        autoCloseAction: "returnToWorkspace",
        progressContext: extractJobProgressContext(request, message("extract.selectedProgressTitle")),
        outputActions: extractJobOutputActions(request),
      });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        requestExtractPasswordInDialog(commandError.code);
        return;
      }
      setBrowseState("error", commandError?.message ?? message("extract.unableSelected"));
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
    setOperationalMessage("command.singleFileRequired");
    return;
  }
  const selectedEntry = getEntryByPath(selected[0]);
  if (!selectedEntry) {
    setOperationalMessage("command.singleFileRequired");
    return;
  }

  if (selectedEntry.kind === "directory") {
    setOperationalMessage("command.singleFileRequired");
    return;
  }

  if (openOutside && currentPreviewEntryPath === selected[0] && currentPreviewPath) {
    try {
      await openDesktopPath(currentPreviewPath);
      setBrowseState("loaded", message("preview.openedCached"));
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
        setBrowseState("loaded", message("preview.openedOutside", { size: formatBytes(response.writtenBytes) }));
      } else {
        setBrowseState("loaded", message("preview.ready", { size: formatBytes(response.writtenBytes) }));
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

      setBrowseState("error", commandError?.message ?? message("preview.unablePreview"));
      return;
    }
  }
}

async function addSourcePathsFromDialog(mode: "files" | "folder") {
  const selected = await openNativeDialog({
    title: i18n.t(mode === "files" ? "nativeDialog.addSourceFiles" : "nativeDialog.addSourceFolder"),
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
    title: i18n.t("nativeDialog.chooseDestinationArchive"),
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
    setCreatePlanState("error", message("create.error.pickDestination"));
    return;
  }
  createDestinationInput.value = destinationPath;

  if (createPlanState !== "ready" || currentPlan === null) {
    setCreatePlanState("error", message("create.error.refreshPlan"));
    return;
  }

  const cleanSource = createCleanSourceCheckbox.checked;
  const replaceExisting = createReplaceExistingCheckbox.checked;
  const preserveMetadata = createPreserveMetadataCheckbox.checked;
  const passwordValue = createPasswordInput.value.trim();
  const passwordConfirmValue = createPasswordConfirmInput.value.trim();
  if ((passwordValue || passwordConfirmValue) && passwordValue !== passwordConfirmValue) {
    setCreatePlanState("error", message("create.error.passwordMismatch"));
    return;
  }
  const compressionLevel = parseNonNegativeInteger(createCompressionInput.value);
  const volumeSize = parseNonNegativeInteger(createVolumeInput.value);
  const tzapRecoveryPercentage = format === "tzap"
    ? parseNonNegativeInteger(createTzapRecoveryInput.value) ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT
    : undefined;

  createSubmissionInFlight = true;
  setCreatePlanState(createPlanState, currentPlanError);

  try {
    const request = buildStartCreateRequest({
      sources: createSources,
      destinationPath,
      format,
      cleanSource,
      excludeArchivePaths: sortedExcludedCreateArchivePaths(),
      respectGitignore: createRespectGitignoreCheckbox.checked,
      followSymlinks: false,
      replaceExisting,
      destinationCollisionStrategy: options.destinationCollisionStrategy,
      preserveMetadata,
      password: passwordValue,
      compressionLevel,
      volumeSize,
      tzapRecoveryPercentage,
    });

    const response = await runStartCreate(request);

    clearCreatePasswordFields();
    recordCreateDestinationHistory(destinationPath);
    addJobState(response, {
      focusProgress: true,
      autoCloseAction: "returnToWorkspace",
      progressContext: createJobProgressContext(request),
      outputActions: createJobOutputActions(request),
    });
  } catch (error) {
    const commandError = asCommandError(error);
    setCreatePlanState("error", commandError?.message ?? message("create.error.unableStart"));
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

async function onPauseJob(jobId: string) {
  try {
    await pauseJobCommand({ jobId });
    await pollJobs();
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.updateFailed"));
  }
}

async function onResumeJob(jobId: string) {
  try {
    await resumeJobCommand({ jobId });
    await pollJobs();
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.updateFailed"));
  }
}

async function onJobOutputAction(jobId: string, index: number, kind: JobOutputAction["kind"]) {
  const action = jobOutputActions.get(jobId)?.[index];
  if (!action || action.kind !== kind || !action.path) {
    setOperationalMessage("jobs.outputUnavailable");
    return;
  }

  try {
    if (kind === "open") {
      await openDesktopPath(action.path);
    } else {
      await revealInFileManager(action.path);
    }
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, message("jobs.outputOpenFailed")));
  }
}

async function onDismissJob(jobId: string) {
  try {
    await dismissJobCommand({ jobId });
    jobs.delete(jobId);
    jobRetryContexts.delete(jobId);
    jobOutputActions.delete(jobId);
    focusedJobProgressContexts.delete(jobId);
    quickActionJobIds.delete(jobId);
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
    setOperationalStatus(healthcheck.ready ? message("status.ready") : message("status.backendUnavailable"));
    renderAboutDiagnostics();
    if (normalWorkspaceRendered && !isQuickActionJobMode()) {
      renderBrowse();
    }
  } catch (error) {
    latestHealthcheck = null;
    latestContract = null;
    if (isDesktopRuntime()) {
      const commandError = asCommandError(error);
      setOperationalStatus(commandError?.message ?? unknownErrorMessage(error, message("status.backendUnavailable")));
    } else {
      setOperationalMessage("status.readyBrowserPreview");
    }
    renderAboutDiagnostics();
    if (normalWorkspaceRendered && !isQuickActionJobMode()) {
      renderBrowse();
    }
  }
}

function onCreateFormatChange() {
  const format = createFormatSelect.value as CreateArchiveFormat;
  const destination = createDestinationInput.value.trim();
  if (destination) {
    createDestinationInput.value = withCreateArchiveExtension(
      destination,
      format,
    );
  }
  applyCreateDefaultsForFormat(format);

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

  if (event.key === "Enter" && openDialogElement) {
    if (activateDialogDefault(event, openDialogElement)) {
      return;
    }
  }

  if (event.key === "Escape") {
    if (hasOpenMenu()) {
      closeOpenMenus();
      return;
    }

    hideContextMenu();
    if (openDialogElement) cancelDialog(event, openDialogElement);
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
    if (searchInput.disabled) {
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
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
  document.querySelector<HTMLButtonElement>("#about-dialog-close")!.addEventListener("click", () => closeModal(aboutDialog));
  document.querySelector<HTMLButtonElement>("#about-close")!.addEventListener("click", () => closeModal(aboutDialog));
  document.querySelector<HTMLButtonElement>("#preferences-dialog-close")!.addEventListener("click", () => closeModal(preferencesDialog));
  document.querySelector<HTMLButtonElement>("#preferences-cancel")!.addEventListener("click", () => closeModal(preferencesDialog));
  document.querySelector<HTMLButtonElement>("#info-close")!.addEventListener("click", () => closeModal(infoDialog));
}

function bindActions() {
  compactCompressOptionsQuery.addEventListener("change", syncCompressOptionsPanelDisclosure);
  modeCompressButton.addEventListener("click", () => setWorkspaceMode("compress"));
  modeExtractButton.addEventListener("click", () => setWorkspaceMode("extract"));
  dropOpenArchiveButton.addEventListener("click", () => activatePendingDropChoice("openArchive"));
  dropAddCompressButton.addEventListener("click", () => activatePendingDropChoice("addToCompress"));
  dropCancelButton.addEventListener("click", () => activatePendingDropChoice("cancel"));
  dropOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      activatePendingDropChoice("cancel");
    }
  });
  openArchiveButton.addEventListener("click", () => void onOpenArchive());
  newArchiveButton.addEventListener("click", showCreateWorkspace);
  addArchiveButton.addEventListener("click", showCreateWorkspace);
  extractToolbarButton.addEventListener("click", () => openExtractDialog(selectedEntries.size ? "selection" : "archive"));
  testArchiveButton.addEventListener("click", () => void onTestArchive());
  infoToolbarButton.addEventListener("click", showCurrentInfo);
  jobsDrawerOpenButton.addEventListener("click", openJobDrawer);
  preferencesToolbarButton.addEventListener("click", openPreferencesDialog);
  document.querySelector<HTMLButtonElement>("#toolbar-view")?.addEventListener("click", () => void onPreviewSelectedEntry());
  document.querySelector<HTMLButtonElement>("#copy-toolbar")?.addEventListener("click", () => void copySelectedEntryPathsToClipboard());
  document.querySelector<HTMLButtonElement>("#toolbar-refresh")?.addEventListener("click", () => void onRefreshArchive());
  document.querySelector<HTMLButtonElement>("#toolbar-selectAll")?.addEventListener("click", selectVisibleEntries);
  document.querySelector<HTMLButtonElement>("#toolbar-flatView")?.addEventListener("click", () => setFlatView(!isFlatView, true));
  document.querySelector<HTMLButtonElement>("#toolbar-deleteTempFiles")?.addEventListener("click", () => void onDeleteTemporaryFiles());
  document.querySelector<HTMLButtonElement>("#toolbar-helpContents")?.addEventListener("click", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));
  document.querySelector<HTMLButtonElement>("#toolbar-about")?.addEventListener("click", () => {
    renderAboutDiagnostics();
    openModal(aboutDialog, "#about-close");
  });
  infoActionGroup.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }

    const copyValue = button.dataset.copyValue;
    if (copyValue) {
      void copyTextToClipboard(copyValue);
      return;
    }

    const action = button.dataset.infoAction;
    if (action === "preview") {
      void onPreviewSelectedEntry();
      return;
    }
    if (action === "archive-info") {
      showArchiveInfo();
      return;
    }
    if (action === "clear-search") {
      clearSearch();
    }
  });
  refreshArchiveButton.addEventListener("click", () => void onRefreshArchive());
  navBackButton.addEventListener("click", navigateBack);
  navUpButton.addEventListener("click", navigateUp);
  for (const resizer of paneResizerElements) {
    resizer.addEventListener("pointerdown", (event) => {
      const pane = resizer.dataset.paneResizer as ResizablePane | undefined;
      if (pane === "navigation" || pane === "details") {
        startPaneResize(event, pane);
      }
    });
    resizer.addEventListener("keydown", (event) => {
      const pane = resizer.dataset.paneResizer as ResizablePane | undefined;
      if (pane === "navigation" || pane === "details") {
        resizePaneByKeyboard(event, pane);
      }
    });
  }
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
        void getCurrentWindow().startResizeDragging(direction);
      });
    }
  }

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
  bindMenuItem("detailsView", () => setOperationalMessage("status.detailsViewActive"));
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
      setOperationalMessage("command.singleFileRequired");
      return;
    }
    navigateToFolder(selected[0]);
  });
  bindMenuItem("invertSelection", () => invertVisibleSelectionEntries());
  bindMenuItem("openOutside", () => void onOpenOutsideSelectedEntry());
  bindMenuItem("deleteTempFiles", () => void onDeleteTemporaryFiles());
  bindMenuItem("delete", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));
  bindMenuItem("moveTo", () => setOperationalStatus(UNSUPPORTED_OPERATION_MESSAGE));

  searchSubmitButton.addEventListener("click", () => {
    if (searchInput.disabled) {
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
    renderBrowse();
    searchInput.focus();
  });

  clearSearchButton.addEventListener("click", clearSearch);

  searchInput.addEventListener("input", () => {
    if (!currentArchivePath) {
      searchInput.value = "";
      setOperationalMessage("browse.noArchiveOpen");
      return;
    }
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

  tableHead.addEventListener("keydown", (event) => {
    const header = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>("th[data-sort-key]");
    const key = header?.dataset.sortKey as ArchiveSortKey | undefined;
    if (!header || !key) {
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      applySortCommand(key);
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = header.getBoundingClientRect();
      showTableHeaderContextMenu(
        rect.left + 12,
        rect.bottom + 2,
        header.dataset.columnId as ArchiveTableColumnId | undefined,
      );
    }
  });

  tableHead.addEventListener("pointerdown", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-column-resizer]");
    const columnId = target?.dataset.columnResizer as ArchiveTableColumnId | undefined;
    if (!columnId) {
      return;
    }

    startColumnResize(event, columnId);
  });

  compressSourceTable.addEventListener("pointerdown", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-column-resizer]");
    const columnId = target?.dataset.columnResizer;
    if (!isCompressSourceColumnId(columnId)) {
      return;
    }

    startCompressSourceColumnResize(event, columnId);
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
    const compressToggleTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-compress-tree-toggle]");
    if (compressToggleTarget) {
      event.preventDefault();
      const folderPath = compressToggleTarget.dataset.compressFolderPath ?? "";
      if (!expandedCompressTreeFolders.has(folderPath)) {
        expandedCompressTreeFolders.add(folderPath);
      } else {
        expandedCompressTreeFolders.delete(folderPath);
      }
      renderCompressSourceTree();
      return;
    }

    const compressFolderTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-compress-folder-path]");
    if (compressFolderTarget) {
      navigateToCompressFolder(compressFolderTarget.dataset.compressFolderPath ?? "");
      return;
    }

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

  archiveEmptyStateElement.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-empty-action='open-archive']");
    if (!target) {
      return;
    }
    void onOpenArchive();
  });

  detailsElement.addEventListener("click", (event) => {
    const copyTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-copy-value]");
    if (copyTarget) {
      void copyTextToClipboard(copyTarget.dataset.copyValue ?? "");
      return;
    }

    const actionTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-details-action]");
    const action = actionTarget?.dataset.detailsAction;
    if (action === "open-archive") {
      void onOpenArchive();
      return;
    }
    if (action === "preview") {
      void onPreviewSelectedEntry();
      return;
    }
    if (action === "extract-selected") {
      openExtractDialog("selection");
      return;
    }
    if (action === "test-selected") {
      void onTestArchive();
      return;
    }
    if (action === "properties") {
      showCurrentInfo();
      return;
    }
    if (action === "archive-info") {
      showArchiveInfo();
    }
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
        const entryPath = row.dataset.entryPath;
        if (entryPath && !selectedEntries.has(entryPath)) {
          selectedEntries = new Set([entryPath]);
          selectionAnchorPath = entryPath;
          focusedEntryPath = entryPath;
          renderBrowse();
        }
        showFolderContextMenu(folderPath, x, y, entryPath);
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
    const archivePath = target.dataset.archivePath;
    const entryPath = contextEntryPath;
    const sourcePath = contextSourcePath;
    hideContextMenu();

    if (action === "open-archive") {
      void onOpenArchive();
      return;
    }
    if (action === "paste-archive-path") {
      void openArchiveFromClipboard();
      return;
    }
    if (action === "open-recent-archive" && archivePath) {
      void openArchiveFromPath(archivePath);
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
          setOperationalMessage("command.singleFolderRequired");
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
    if (action === "extract-here") {
      openExtractHereDialog(selectedEntries.size ? "selection" : "archive");
      return;
    }
    if (action === "extract-all") {
      openExtractDialog("archive");
      return;
    }
    if (action === "info" && getVisibleSelectedRows().length > 1) {
      showSelectionInfo();
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
        setOperationalStatus(unknownErrorMessage(error, message("preview.unableRevealSource")));
      });
      return;
    }
    if (action === "include-compress-path" || action === "exclude-compress-path") {
      const path = target.dataset.compressMenuPath;
      if (path) {
        for (const compressPath of compressPathsForContextAction(path)) {
          setCompressPathIncluded(compressPath, action === "include-compress-path");
        }
        refreshCreatePlanSummary();
        renderCreateSources();
        renderCompressBrowser();
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
  });

  contextMenu.addEventListener("keydown", (event) => {
    const items = contextMenuItems();
    if (items.length === 0) {
      return;
    }

    const activeIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hideContextMenu();
      return;
    } else if (event.key === "Tab") {
      event.stopPropagation();
      hideContextMenu();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  });

  contextMenu.addEventListener("focusout", () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !contextMenu.hidden && !contextMenu.contains(active)) {
        hideContextMenu();
      }
    }, 0);
  });

  browseExtractDestinationButton.addEventListener("click", () => void onSelectDestinationForExtract());
  extractStartButton.addEventListener("click", () => void startExtract(activeExtractMode));
  extractDialog.addEventListener("keydown", handleExtractDialogEnter);
  extractDestinationInput.addEventListener("input", syncExtractDialogState);
  extractDestinationInput.addEventListener("change", syncExtractDialogState);

  addSourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showAddSourcesMenu(addSourceButton);
  });
  clearSourcesButton.addEventListener("click", () => {
    clearCreateSources();
  });
  includeAllSourcesButton.addEventListener("click", () => {
    setAllCompressPathsIncluded(true);
    refreshCreatePlanSummary();
    renderCreateSources();
    renderCompressBrowser();
  });
  excludeAllSourcesButton.addEventListener("click", () => {
    setAllCompressPathsIncluded(false);
    refreshCreatePlanSummary();
    renderCreateSources();
    renderCompressBrowser();
  });
  compressIncludeAllInput.addEventListener("change", () => {
    setCurrentCompressFolderIncluded(compressIncludeAllInput.checked);
    refreshCreatePlanSummary();
    renderCreateSources();
    renderCompressBrowser();
  });
  sourceListElement.addEventListener("contextmenu", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("li[data-source-path]");
    if (!row?.dataset.sourcePath) {
      return;
    }
    event.preventDefault();
    showSourceContextMenu(row.dataset.sourcePath, event.clientX, event.clientY);
  });

  compressSourceBody.addEventListener("click", (event) => {
    const includeControl = (event.target as HTMLElement).closest<HTMLInputElement>("[data-compress-include]");
    if (includeControl) {
      event.stopPropagation();
      const rowPath = includeControl.dataset.compressPath;
      if (rowPath) {
        const nextIncluded = includeControl.checked;
        setCompressPathIncluded(rowPath, nextIncluded);
        refreshCreatePlanSummary();
        renderCreateSources();
        renderCompressBrowser();
        focusCompressRow(compressSourceBody.querySelector<HTMLTableRowElement>(`tr[data-compress-path="${CSS.escape(rowPath)}"]`));
      }
      return;
    }

    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-compress-folder-row], tr[data-compress-entry-row]");
    if (!row) {
      return;
    }

    const folderPath = row.dataset.compressFolderRow;
    const rowPath = row.dataset.compressPath;
    const plainPrimaryClick = !event.ctrlKey && !event.metaKey && !event.shiftKey;

    if (rowPath) {
      updateCompressSelectionByIntent(rowPath, { ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
      renderCompressSources();
      focusCompressRow(compressSourceBody.querySelector<HTMLTableRowElement>(`tr[data-compress-path="${CSS.escape(rowPath)}"]`));
    }

    if (folderPath !== undefined && (event.detail >= 2 || (appPreferences.singleClickOpen && plainPrimaryClick))) {
      navigateToCompressFolder(folderPath);
    }
  });

  compressSourceBody.addEventListener("keydown", (event) => {
    if ((event.target as HTMLElement).closest("[data-compress-include]")) {
      return;
    }

    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-compress-folder-row], tr[data-compress-entry-row]");
    if (!row) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRelativeCompressRow(row, event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      toggleCompressRowSelection(row);
      event.stopPropagation();
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rowPath = row.dataset.compressPath;
      if (rowPath && !selectedCompressRows.has(rowPath)) {
        selectedCompressRows = new Set([rowPath]);
        focusedCompressRowPath = rowPath;
        compressSelectionAnchorPath = rowPath;
        syncCompressSelectionUi();
      }
      const rect = row.getBoundingClientRect();
      showCompressRowContextMenu(row, rect.left + 24, rect.top + Math.min(rect.height - 2, 24));
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      const sourcePaths = selectedCompressSourcePaths();
      const fallbackSourcePath = removableSourcePathForCompressRow(row);
      removeCreateSources(sourcePaths.length > 0 ? sourcePaths : fallbackSourcePath ? [fallbackSourcePath] : []);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activateCompressRow(row);
    }
  });

  compressSourceBody.addEventListener("contextmenu", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-compress-folder-row], tr[data-compress-entry-row]");
    if (!row) {
      return;
    }

    event.preventDefault();
    const rowPath = row.dataset.compressPath;
    if (rowPath && !selectedCompressRows.has(rowPath)) {
      selectedCompressRows = new Set([rowPath]);
      focusedCompressRowPath = rowPath;
      compressSelectionAnchorPath = rowPath;
      syncCompressSelectionUi();
    }
    showCompressRowContextMenu(row, event.clientX, event.clientY);
  });

  createFormatSelect.addEventListener("change", onCreateFormatChange);
  createDestinationInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);
  createDestinationRecentSelect.addEventListener("change", () => {
    const destination = createDestinationRecentSelect.value;
    if (destination) {
      createDestinationInput.value = destination;
      refreshCreateStateAfterDestinationEdit();
    }
    createDestinationRecentSelect.value = "";
  });
  browseCreateDestinationButton.addEventListener("click", () => void onSelectCreateDestination());
  startCreateButton.addEventListener("click", () => void runCreate());
  createPasswordInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);
  createPasswordConfirmInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);
  preferencesOutputLocationSelect.addEventListener("change", () => {
    syncPreferenceOutputState();
    updatePreferencesDialogDraft();
  });
  preferencesCustomOutputInput.addEventListener("focus", () => {
    restoreFullCustomOutputPathForEdit(preferencesCustomOutputInput);
  });
  preferencesCustomOutputInput.addEventListener("input", () => {
    syncCustomOutputPathFromInput(preferencesCustomOutputInput);
    setPreferenceCustomOutputMessage("idle");
    syncPreferenceSaveState();
    updatePreferencesDialogDraft();
  });
  preferencesCustomOutputInput.addEventListener("blur", () => {
    syncCustomOutputPathFromInput(preferencesCustomOutputInput);
    renderCustomOutputPathDisplay(preferencesCustomOutputInput);
    syncPreferenceSaveState();
  });
  for (const button of preferencesPageButtons) {
    button.addEventListener("click", () => {
      const pageName = button.dataset.prefPageTarget;
      if (pageName) {
        showPreferencePage(pageName);
      }
    });
  }
  preferencesCreateFormatSelect.addEventListener("change", onPreferencesCreateFormatChange);
  preferencesDefaultFormatSelect.addEventListener("change", onPreferencesDefaultFormatChange);
  for (const input of [
    preferencesCreateCompressionSelect,
    preferencesCreateVolumeInput,
    preferencesCreateTzapRecoveryInput,
    preferencesCreateCleanSourceCheckbox,
    preferencesCreatePreserveMetadataCheckbox,
    preferencesCreateReplaceExistingCheckbox,
    preferencesCreatePromptPasswordCheckbox,
    preferencesLocaleSelect,
    preferencesDefaultExtractionSelect,
    preferencesPreviewCleanupSelect,
    preferencesShowParentCheckbox,
    preferencesRealFileIconsCheckbox,
    preferencesShowGridCheckbox,
    preferencesFullRowSelectCheckbox,
    preferencesSingleClickCheckbox,
    preferencesAlternativeSelectionCheckbox,
    preferencesToolbarVisibleCheckbox,
    preferencesLargeToolbarCheckbox,
    preferencesToolbarLabelsCheckbox,
    preferencesFlatViewCheckbox,
  ]) {
    input.addEventListener("change", updatePreferencesDialogDraft);
  }
  preferencesChooseOutputButton.addEventListener("click", () => void onSelectPreferenceOutputFolder());
  preferencesSaveButton.addEventListener("click", () => void savePreferencesFromDialog());

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
    syncExtractDialogState();
  });

  jobsListElement.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const actionButton = target?.closest<HTMLButtonElement>(
      "[data-cancel], [data-pause], [data-resume], [data-retry-password], [data-dismiss], [data-output-action]",
    );
    const cancelId = actionButton?.dataset.cancel;
    const pauseId = actionButton?.dataset.pause;
    const resumeId = actionButton?.dataset.resume;
    const retryPasswordId = actionButton?.dataset.retryPassword;
    const dismissId = actionButton?.dataset.dismiss;
    const outputAction = actionButton?.dataset.outputAction as JobOutputAction["kind"] | undefined;
    const outputJobId = actionButton?.dataset.outputJob;
    const outputIndex = Number(actionButton?.dataset.outputIndex);
    if (cancelId) {
      void onCancelJob(cancelId);
      return;
    }
    if (pauseId) {
      void onPauseJob(pauseId);
      return;
    }
    if (resumeId) {
      void onResumeJob(resumeId);
      return;
    }
    if (retryPasswordId) {
      void retryJobWithPasswordPrompt(retryPasswordId);
      return;
    }
    if (
      outputJobId &&
      (outputAction === "open" || outputAction === "reveal") &&
      Number.isInteger(outputIndex)
    ) {
      void onJobOutputAction(outputJobId, outputIndex, outputAction);
      return;
    }
    if (dismissId) {
      void onDismissJob(dismissId);
    }
  });

  quickBackgroundButton.addEventListener("click", () => {
    void sendQuickActionJobsToBackground();
  });
  quickContinueButton.addEventListener("click", () => {
    void toggleQuickActionPause();
  });
  quickCancelButton.addEventListener("click", () => {
    void cancelFocusedQuickActionJobs();
  });

  refreshJobsButton.addEventListener("click", () => void pollJobs());
  jobsDrawerOpenButton.addEventListener("click", openJobDrawer);
  statusJobButton.addEventListener("click", openJobDrawer);
  jobDrawerCloseButton.addEventListener("click", closeJobDrawer);
  jobsListElement.addEventListener("focusin", () => void pollJobs());

  copyDiagnosticsButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText());
      copyDiagnosticsButton.textContent = message("status.copied");
      window.setTimeout(() => {
        copyDiagnosticsButton.textContent = message("about.copyDiagnostics");
      }, 1400);
    } catch {
      setOperationalMessage("status.copyDiagnosticsFailed");
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

  document.addEventListener("focusin", keepFocusInsideOpenModal);
  appRoot.addEventListener("keydown", handleShortcut);
}

bindMenuBehavior();
bindDialogCloseButtons();
bindActions();
bindBrowserFileDropFallback();
bindWindowLifecycleHandlers();
applyLocaleFromPreferences();
loadExtractDestinationHistory();
loadCreateDestinationHistory();
loadRecentArchiveHistory();
applyCreatePreferenceDefaults();
setCreatePlanState("idle");
setBrowseState("idle", i18n.t("browse.statusIdle"));
if (isLocalDevHost()) {
  window.__zmanagerDev = {
    loadArchiveFixture: loadArchiveListingIntoState,
    setSystemIconFixtures: (fixtures: Record<string, string | null>) => {
      systemIconDataUrls = new Map(Object.entries(fixtures));
      renderBrowse();
    },
    setJobFixtures: (fixtures: DevJobFixture[]) => {
      jobs.clear();
      jobRetryContexts.clear();
      jobOutputActions.clear();
      promptedPasswordRetryJobs.clear();
      for (const fixture of fixtures) {
        jobs.set(fixture.snapshot.jobId, fixture);
        if (fixture.outputActions?.length) {
          jobOutputActions.set(fixture.snapshot.jobId, fixture.outputActions);
        }
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
