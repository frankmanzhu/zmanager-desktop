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
  type CommandStateMap,
  type MenuItem,
} from "./app/classicCommands";
import {
  createCommandRouter,
  selectContextCommand,
  selectDetailsCommand,
  selectKeyboardCommand,
  selectTreeCommand,
  type CommandRouterPayload,
} from "./app/commands/commandRouter";
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
  buildQuickCreateStartRequest,
  createCreateWorkspace,
  type CreateWorkspacePlanStatus,
  type CreateWorkspaceSnapshot,
} from "./app/workspaces/createWorkspace";
import {
  archiveEntryIconDescriptor,
  archiveFileIconDescriptor,
  archiveRowIconDescriptor,
  archiveTreeIconDescriptor,
  type ArchiveEntryIconDescriptor,
} from "./app/archiveEntryIcons";
import {
  middleTruncateDetailValue,
  renderArchiveDetails,
  renderArchiveNavigationTree,
  renderArchiveWorkspaceTable,
  renderCreateNavigationTree,
  renderDetailRows as renderArchiveDetailRows,
  type ArchiveDetailsModel,
  type ArchiveWorkspaceTreeFolder,
  type DetailRow,
} from "./ui/archiveWorkspaceView";
import {
  Minus,
  Square,
  X,
  type IconNode,
} from "lucide";
import {
  pathsWithSameExtension,
} from "./app/selection";
import {
  applyHierarchicalMarqueeSelection,
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
  createFormatSupportsPassword,
  getArchiveName,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
  sourcePathForCreatePlanRow,
  type CreateArchiveUnavailableReason,
  type CreateArchiveFormat,
  type CreatePlanRow,
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
  ArchiveListingDto,
  BrowseState,
  CreatePlanEntryDto,
  CreatePlanResponse,
  HealthcheckResponse,
  JobKind,
  JobState,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
  SystemFileIconRequestEntry,
} from "./api/types";
import { ListArchiveRequest } from "./api/types";
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
  renderJobsListHtml,
} from "./ui/jobsView";
import {
  bindDropOverlayActions,
  focusDropOverlayPrimaryAction,
  renderDropOverlay as renderShellDropOverlay,
  type ShellViewElements,
} from "./ui/shellView";
import {
  applyCompressSourceColumnWidths as applyCompressSourceColumnWidthStyles,
  bindCreateSourceListActions,
  clampCompressSourceColumnWidth as clampCompressSourceColumnWidthValue,
  findCompressSourceRowByPath,
  focusFirstCompressSourceRow,
  getCompressSourceRows,
  getCompressSourceSelectableRows,
  readCompressIncludeAllChecked,
  readCompressSourceColumnWidths,
  readCreateOptionControlPatch,
  renderCompressIncludeAllControl,
  renderCreateActionState,
  renderCompressSourceTable,
  renderCreateDestinationHistory as renderCreateDestinationHistoryView,
  renderCreateOptionControls,
  renderCreatePlanStatus,
  renderCreatePlanSummary,
  renderCreateSourceList,
  syncCompressSourceInclusionControls,
  syncCompressSourceSelectionUi,
  type CompressSourceTableRowModel,
} from "./ui/createWorkspaceView";
import {
  applyCommandSurfaceState,
  bindCommandSurface,
  refreshCommandSurfaceText,
  type CommandSurfaceClassState,
} from "./ui/commandSurfaceView";
import {
  createModalController,
} from "./ui/modalController";
import {
  bindContextMenu,
  type ContextMenuActionPayload,
} from "./ui/contextMenuView";
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
type CompressPlanRow = CreatePlanRow;
type CompressSourceColumnId = "name" | "size" | "modified" | "kind";
type AppWindowResizeDirection =
  | "North"
  | "East"
  | "South"
  | "West"
  | "NorthEast"
  | "SouthEast"
  | "SouthWest"
  | "NorthWest";
type FocusedJobProgressContextDisplay = {
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

const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const preferencesToolbarButton = document.querySelector<HTMLButtonElement>("#preferences-toolbar")!;
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive")!;
const navBackButton = document.querySelector<HTMLButtonElement>("#nav-back")!;
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
const createSourceListViewElements = {
  sourceListElement,
  clearSourcesButton,
  includeAllSourcesButton,
  excludeAllSourcesButton,
};
const createActionStateViewElements = {
  addSourceButton,
  startCreateButton,
  createPlanMeta,
};
const createPlanSummaryViewElements = {
  createPlanSummary,
};
const createDestinationHistoryViewElements = {
  createDestinationHistoryList,
  createDestinationRecentSelect,
};
const compressIncludeAllControlViewElements = {
  compressIncludeAllInput,
};
const compressSourceTableViewElements = {
  compressSourceBody,
};
const createOptionControlViewElements = {
  createFormatSelect,
  createCleanSourceCheckbox,
  createPreserveMetadataCheckbox,
  createReplaceExistingCheckbox,
  createRespectGitignoreCheckbox,
  createCompressionInput,
  createVolumeInput,
  createTzapRecoveryField,
  createTzapRecoveryInput,
  createPasswordOptions,
};

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
const shellViewElements: ShellViewElements = {
  workspace: workspaceElement,
  dropOverlay,
  dropOverlayCard: dropOverlay.querySelector<HTMLElement>(".drop-overlay-card")!,
  dropOverlayTitle: document.querySelector<HTMLElement>("#drop-overlay-title")!,
  dropOverlayMessage: document.querySelector<HTMLElement>("#drop-overlay-message")!,
  dropOverlaySupport: document.querySelector<HTMLElement>("#drop-overlay-support")!,
  dropOverlayActions: document.querySelector<HTMLDivElement>("#drop-overlay-actions")!,
  dropOpenArchiveButton: document.querySelector<HTMLButtonElement>("#drop-open-archive")!,
};

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
let selectedCompressRows = new Set<string>();
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
let compressSourceColumnWidths: Record<CompressSourceColumnId, number> | null = null;
let sortKey: ArchiveSortKey = initialArchiveWorkspaceSnapshot.view.sort.key;
let sortAscending = initialArchiveWorkspaceSnapshot.view.sort.ascending;
let isFlatView = initialArchiveWorkspaceSnapshot.view.flatView;
let focusedEntryPath = "";
let selectionAnchorPath = "";
let focusedCompressRowPath = "";
let compressSelectionAnchorPath = "";
let activeExtractMode: ExtractMode = "archive";
let contextEntryPath = "";
let contextSourcePath = "";
const contextMenuView = bindContextMenu(contextMenu, {
  onAction: handleContextMenuAction,
  onHide: () => {
    contextEntryPath = "";
    contextSourcePath = "";
  },
});
const showContextMenu = contextMenuView.showContextMenu;
const hideContextMenu = contextMenuView.hideContextMenu;
const archiveTreeRootPath = "";
const expandedArchiveTreeFolders = new Set<string>([archiveTreeRootPath]);
let archiveTreeChildrenByParent = new Map<string, string[]>();

let planDebounce: number | null = null;
let dropUnlisten: (() => void) | null = null;
let pendingNativeDragGesture: NativeDragGesture | null = null;
let pendingMarqueeSelection: MarqueeSelectionGesture | null = null;
let marqueeSelectionElement: HTMLDivElement | null = null;
let suppressNextTableClick = false;

const jobsWorkspace = createJobsWorkspace();
let normalWorkspaceRendered = false;
let latestHealthcheck: HealthcheckResponse | null = null;
let latestContract: ProjectContract | null = null;

const jobTimers = (() => {
  let pollTimer: number | null = null;
  let progressClockTimer: number | null = null;
  let quickActionAutoCloseTimer: number | null = null;

  return {
    hasQuickActionAutoClosePending(): boolean {
      return quickActionAutoCloseTimer !== null;
    },
    clearQuickActionAutoClose(): void {
      if (quickActionAutoCloseTimer === null) {
        return;
      }

      window.clearTimeout(quickActionAutoCloseTimer);
      quickActionAutoCloseTimer = null;
    },
    scheduleQuickActionAutoClose(callback: () => void): void {
      quickActionAutoCloseTimer = window.setTimeout(callback, QUICK_ACTION_AUTO_CLOSE_DELAY_MS);
    },
    startPolling(callback: () => void): void {
      if (pollTimer !== null) {
        return;
      }

      pollTimer = window.setInterval(callback, JOB_POLL_INTERVAL_MS);
    },
    stopPolling(): void {
      if (pollTimer === null) {
        return;
      }

      window.clearInterval(pollTimer);
      pollTimer = null;
    },
    startProgressClock(callback: () => void): void {
      if (progressClockTimer !== null) {
        return;
      }

      progressClockTimer = window.setInterval(callback, 1000);
    },
    stopProgressClock(): void {
      if (progressClockTimer === null) {
        return;
      }

      window.clearInterval(progressClockTimer);
      progressClockTimer = null;
    },
  };
})();

const appWindowEffects = {
  close(): void {
    if (!isDesktopRuntime()) {
      setOperationalMessage("status.closeInBrowser");
      return;
    }

    void getCurrentWindow().close().catch(() => {
      setOperationalMessage("quick.completed.closeWindow");
    });
  },
  minimize(): void {
    if (!isDesktopRuntime()) {
      return;
    }

    void getCurrentWindow().minimize().catch(() => {
      setOperationalMessage("jobs.minimizeFailed");
    });
  },
  toggleMaximize(): void {
    if (!isDesktopRuntime()) {
      return;
    }

    void getCurrentWindow().toggleMaximize().catch(() => {
      setOperationalMessage("status.windowControlFailed");
    });
  },
};

const focusedJobWindowEffects = {
  async revealNormalWindow(): Promise<void> {
    await placeNormalAppWindowBeforeShow();
    await getCurrentWindow().show();
  },
  async revealProgressWindow(): Promise<void> {
    const currentWindow = getCurrentWindow();
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
  },
  async minimizeProgressWindow(): Promise<void> {
    await getCurrentWindow().minimize();
  },
  async restoreNormalWindow(): Promise<void> {
    await placeNormalAppWindowBeforeShow();
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

const jobOutputEffects = {
  async run(outputAction: JobOutputAction): Promise<void> {
    if (outputAction.kind === "open") {
      await openDesktopPath(outputAction.path);
      return;
    }

    await revealInFileManager(outputAction.path);
  },
};

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
    void persistWindowGeometry();
  }
  shellWorkspace.setQuickActionWindowMode("jobOnly");
  workspaceElement.dataset.quickActionMode = "job-only";
  document.body.classList.add("quick-action-job-mode");
  quickProgressElement.hidden = false;
  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
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
    quickBackgroundButton.disabled = true;
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
  quickProgressElement.hidden = true;
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
  quickProgressElement.hidden = true;
  quickBackgroundButton.disabled = true;
  quickContinueButton.disabled = true;
  quickCancelButton.disabled = true;
  jobDrawer.setAttribute("aria-hidden", "true");
  workspaceElement.dataset.jobDrawer = "closed";
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

function quickActionControllableJobIds(): string[] {
  return [...jobsWorkspace.getControllableFocusedQuickActionJobIds()];
}

async function toggleQuickActionPause() {
  const jobIds = quickActionControllableJobIds();
  if (!jobIds.length) {
    return;
  }

  const shouldResume = jobIds.some((jobId) => jobsWorkspace.getJob(jobId)?.snapshot.status === "paused");
  const command = shouldResume ? resumeJobCommand : pauseJobCommand;
  quickContinueButton.disabled = true;

  try {
    await Promise.all(
      jobIds.map(async (jobId) => {
        const response = await command({ jobId });
        jobsWorkspace.updateJobStatus(jobId, response.status);
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
    if (jobsWorkspace.getFocusedJobAutoCloseAction() === "returnToWorkspace") {
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
  const decision = jobsWorkspace.selectFocusedQuickActionCompletion({
    canEvaluate: isDesktopRuntime() && isQuickActionJobMode(),
    autoClosePending: jobTimers.hasQuickActionAutoClosePending(),
  });

  if (decision.action === "wait") {
    return;
  }

  if (decision.action === "needsAttention") {
    setOperationalMessage("jobs.needsAttention");
    if (shellWorkspace.isQuickActionWindowBackgrounded()) {
      void revealQuickActionJobWindow();
    } else {
      renderQuickProgress();
    }
    return;
  }

  setOperationalMessage("jobs.completed");
  renderQuickProgress();
  jobTimers.scheduleQuickActionAutoClose(() => {
    if (jobsWorkspace.getFocusedJobAutoCloseAction() === "returnToWorkspace") {
      void closeFocusedJobProgress();
    } else {
      closeAppWindow();
    }
  });
}

function clearTrackedPreviewState() {
  shellWorkspace.clearTrackedPreview();
}

function updateStatusBar() {
  const selection = archiveWorkspace.getSnapshot().view.selection;
  const selectedTotal = selection.visibleSelectedCount;
  const focusedEntry = selection.focusedEntry;

  statusSelectionCountElement.textContent = message("status.selectionCount", {
    selected: selectedTotal,
    total: selection.visibleSelectablePaths.length,
  });
  statusSelectionSizeElement.textContent = selectedTotal > 0
    ? message("status.selectedSize", { size: formatBytes(selection.visibleSelectedSize) })
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

function formatJobKind(kind: JobKind): string {
  switch (kind) {
    case "zipCreate":
      return displayContext.translator.t("jobs.kind.zipCreate");
    case "zipExtract":
      return displayContext.translator.t("jobs.kind.zipExtract");
    case "sevenZCreate":
      return displayContext.translator.t("jobs.kind.sevenZCreate");
    case "sevenZExtract":
      return displayContext.translator.t("jobs.kind.sevenZExtract");
    case "rarExtract":
      return displayContext.translator.t("jobs.kind.rarExtract");
    case "tarZstdCreate":
      return displayContext.translator.t("jobs.kind.tarZstdCreate");
    case "tarZstdExtract":
      return displayContext.translator.t("jobs.kind.tarZstdExtract");
    case "tzapCreate":
      return displayContext.translator.t("jobs.kind.tzapCreate");
    case "tzapExtract":
      return displayContext.translator.t("jobs.kind.tzapExtract");
    case "appleArchiveCreate":
      return displayContext.translator.t("jobs.kind.appleArchiveCreate");
    case "appleArchiveExtract":
      return displayContext.translator.t("jobs.kind.appleArchiveExtract");
    case "archiveExtract":
      return displayContext.translator.t("jobs.kind.archiveExtract");
    case "rawStreamExtract":
      return displayContext.translator.t("jobs.kind.rawStreamExtract");
    case "testArchive":
      return displayContext.translator.t("jobs.kind.testArchive");
    default:
      return String(kind);
  }
}

function formatDate(value?: string): string {
  return displayContext.format.date(value, { emptyValue: "" });
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

function renderFocusedJobContext(context?: FocusedJobProgressContextDisplay) {
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

function renderQuickProgress(nowMs = Date.now()) {
  if (!isQuickActionJobMode()) {
    return;
  }

  const progressSnapshot = jobsWorkspace.getFocusedQuickActionProgressSnapshot(nowMs);

  if (progressSnapshot.state === "empty") {
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

  const latestContext = focusedJobProgressContextDisplay(progressSnapshot.latestContext);
  const operation = progressSnapshot.allTerminal
    ? progressSnapshot.latestJob.status === "completed"
      ? message("quick.operation.completed")
      : progressSnapshot.latestJob.status === "cancelled"
        ? message("quick.operation.cancelled")
        : message("quick.operation.failed")
    : progressSnapshot.anyPaused
      ? message("quick.operation.paused")
    : quickActionOperationLabel(progressSnapshot.latestJob.kind);

  quickTitleElement.textContent = progressSnapshot.jobCount > 1
    ? message("quick.progress.multipleJobs", { count: progressSnapshot.jobCount })
    : latestContext?.title ?? formatJobKind(progressSnapshot.latestJob.kind);
  quickSubtitleElement.textContent = latestContext?.subtitle ?? "";
  renderFocusedJobContext(latestContext);
  quickElapsedElement.textContent = formatDurationClock(progressSnapshot.elapsedMs);
  quickRemainingElement.textContent = formatDurationClock(progressSnapshot.remainingMs);
  quickFilesElement.textContent = progressSnapshot.totalFiles === null
    ? String(progressSnapshot.processedFiles)
    : `${progressSnapshot.processedFiles} / ${progressSnapshot.totalFiles}`;
  quickTotalFilesElement.textContent = progressSnapshot.jobCount > 1
    ? message("quick.progress.totalJobs", { count: progressSnapshot.jobCount })
    : "";
  quickTotalSizeElement.textContent = progressSnapshot.totalBytes === null ? "" : formatBytes(progressSnapshot.totalBytes);
  quickSpeedElement.textContent = progressSnapshot.speedBytesPerSecond === null ? "" : `${formatBytes(progressSnapshot.speedBytesPerSecond)}/s`;
  quickProcessedElement.textContent = progressSnapshot.processedBytes > 0 ? formatBytes(progressSnapshot.processedBytes) : "";
  quickCompressedSizeElement.textContent = progressSnapshot.compressedBytes === null ? "" : formatBytes(progressSnapshot.compressedBytes);
  quickRatioElement.textContent = progressSnapshot.compressedBytes === null || progressSnapshot.totalBytes === null
    ? ""
    : displayContext.format.ratio(progressSnapshot.totalBytes, progressSnapshot.compressedBytes, {
        emptyValue: "",
        fractionDigits: 0,
      });
  quickOperationElement.textContent = operation;
  quickCurrentPathElement.textContent = progressSnapshot.currentFile;
  quickBackgroundButton.disabled = progressSnapshot.allTerminal || progressSnapshot.anyPaused || shellWorkspace.isQuickActionWindowBackgrounded();
  quickContinueButton.disabled = !progressSnapshot.anyActive;
  quickContinueButton.textContent = progressSnapshot.anyPaused ? message("common.continue") : message("quick.pause");
  quickCancelButton.disabled = !progressSnapshot.anyActive;

  if (progressSnapshot.progressPercent === null) {
    quickProgressBar.removeAttribute("value");
    quickProgressBar.removeAttribute("max");
  } else {
    quickProgressBar.value = progressSnapshot.progressPercent;
    quickProgressBar.max = 100;
  }
}

function formatRatio(entry: ArchiveEntryDto): string {
  return displayContext.format.ratio(entry.size, entry.compressedSize, { fractionDigits: 0 });
}

type InfoAction = {
  label: string;
  action?: string;
  copyValue?: string;
  primary?: boolean;
  title?: string;
};

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

function detailRenderHelpers() {
  return {
    copyLabel: message("command.copy"),
    copyIconHtml: toolbarIcon("copy"),
  };
}

function renderInfoDetailRows(rows: readonly DetailRow[]): string {
  return renderArchiveDetailRows(rows, detailRenderHelpers());
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

function progressContextRows(rows: Array<{ label: string; value?: string | null }>): FocusedJobProgressContextDisplay["rows"] {
  return rows
    .filter((row): row is { label: string; value: string } => Boolean(row.value))
    .map((row) => ({ label: row.label, value: row.value }));
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

function focusedJobProgressContextDisplay(
  context?: FocusedJobProgressContext,
): FocusedJobProgressContextDisplay | undefined {
  if (!context) {
    return undefined;
  }

  if (context.kind === "create") {
    const sourcePreview = truncatedPathPreview(context.sources, 3, 180);
    const sourceLabel = context.sources.length === 1 ? "Source" : "Sources";
    return {
      title: "Create archive",
      subtitle: getPathBasename(context.destinationPath) || context.destinationPath,
      rows: progressContextRows([
        { label: sourceLabel, value: sourcePreview },
        { label: "Destination", value: context.destinationPath },
        { label: "Format", value: context.format },
        { label: "Clean source", value: context.cleanSource ? "Yes" : "No" },
        {
          label: "Recovery",
          value: context.format === "tzap" && context.tzapRecoveryPercentage !== undefined
            ? `${context.tzapRecoveryPercentage}%`
            : null,
        },
      ]),
    };
  }

  const entryCount = context.entryPaths?.length ?? 0;
  const entryPreview = context.entryPaths ? truncatedPathPreview(context.entryPaths, 3, 180) : null;
  return {
    title: context.title === "selection" ? message("extract.selectedProgressTitle") : "Extract archive",
    subtitle: getPathBasename(context.archivePath) || context.archivePath,
    rows: progressContextRows([
      { label: "Archive", value: context.archivePath },
      { label: "Destination", value: context.destinationPath },
      { label: "Entries", value: entryCount > 0 ? `${entryCount} selected${entryPreview ? `: ${entryPreview}` : ""}` : "All entries" },
      { label: "Overwrite", value: context.overwrite },
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
  syncCreateOptionControls(snapshot);
  return snapshot;
}

function suggestedCreateArchiveName(sources = createWorkspace.getSnapshot().sources): string {
  return createWorkspace.suggestedArchiveName(sources);
}

function syncCreateOptionControls(snapshot: CreateWorkspaceSnapshot = createWorkspace.getSnapshot()) {
  const options = snapshot.options;
  if (createDestinationInput.value !== options.destinationPath) {
    createDestinationInput.value = options.destinationPath;
  }
  renderCreateOptionControls(createOptionControlViewElements, {
    format: options.format,
    cleanSource: options.cleanSource,
    preserveMetadata: options.preserveMetadata,
    replaceExisting: options.replaceExisting,
    respectGitignore: options.respectGitignore,
    compressionLevel: options.compressionLevel,
    volumeSize: options.volumeSize,
    tzapRecoveryPercentage: options.tzapRecoveryPercentage,
    tzapRecoveryVisible: options.tzapRecovery.visible,
    tzapRecoveryDisabled: options.tzapRecovery.disabled,
    passwordVisible: options.password.visible,
  });
  createPasswordInput.disabled = options.password.disabled;
  createPasswordConfirmInput.disabled = options.password.disabled;
  createShowPasswordInput.disabled = options.password.disabled;
  if (!options.password.supportsPassword) {
    clearCreatePasswordFields();
  }
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
  }

  let password = browsePasswordInput.value.trim() || undefined;
  let requestResult = archiveWorkspace.buildNativeDragRequest({ entryPath, password });
  if (!requestResult.ok) {
    setOperationalMessage("preview.selectEntryToDrag");
    return;
  }
  let request = requestResult.request;

  setOperationalMessage("preview.preparingDrag", { count: request.entryPaths.length });

  while (true) {
    try {
      const response = await runStartNativeFileDrag(request);
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
  const { operationalStatus } = shellWorkspace.getSnapshot();
  statusElement.textContent = operationalStatus;
  statusTextElement.textContent = operationalStatus;
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

  messageElement.className = `status ${next === "loaded" ? "status-loaded" : `status-${next}`}`;
  if (message) {
    browseError = message;
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

function currentCommandClassState(hasArchive = Boolean(currentArchivePath)): CommandSurfaceClassState {
  const mode = currentWorkspaceMode();
  return {
    open: { primary: mode === "extract" && !hasArchive },
    refresh: { secondary: true },
  };
}

function applyCurrentCommandSurfaceState(
  commandState: CommandStateMap,
  hasArchive = Boolean(currentArchivePath),
) {
  applyCommandSurfaceState(document, {
    commandDefinitions: COMMAND_DEFINITIONS,
    commandState,
    commandTooltip: (commandId) => commandTooltipText(commandId, displayContext.translator),
    commandStateReason: localizedCommandStateReason,
    pressedState: {
      flatView: isFlatView,
      largeButtons: appPreferences.largeToolbarButtons,
      showButtonText: appPreferences.showToolbarLabels,
    },
    classState: currentCommandClassState(hasArchive),
  });
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

  searchInput.disabled = !commandContext.canSearchEntries;
  searchInput.setAttribute("aria-disabled", String(searchInput.disabled));
  searchSubmitButton.disabled = searchInput.disabled;
  searchSubmitButton.setAttribute("aria-disabled", String(searchSubmitButton.disabled));
  clearSearchButton.disabled = searchInput.disabled || !snapshot.view.searchQuery.trim();
  clearSearchButton.setAttribute("aria-disabled", String(clearSearchButton.disabled));
  selectAllInput.disabled = !commandState.selectAll.enabled;
  navBackButton.disabled = !commandContext.canNavigateBack;

  applyCurrentCommandSurfaceState(commandState, commandContext.hasArchive);

  applyPreferenceClasses();
  updateStatusBar();
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
    about: () => {
      renderAboutDiagnostics();
      openModal(aboutDialog, "#about-close");
    },
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

function updateMeta() {
  if (!currentArchivePath) {
    metaElement.textContent = displayContext.translator.t("browse.statusReady");
    return;
  }

  const folderLabel = currentArchiveFolder ? ` > ${currentArchiveFolder}` : "";
  metaElement.textContent = `${getArchiveName(currentArchivePath, APP_TITLE)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderWorkspaceMode() {
  const mode = currentWorkspaceMode();
  const isCompress = mode === "compress";
  if (isCompress) {
    renderCompressBrowser();
  }
  workspaceElement.dataset.mode = mode;
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
  detailsPaneTitleElement.textContent = displayContext.translator.t(isCompress ? "compress.options" : "pane.details");
  detailsPaneTitleElement.dataset.i18nText = isCompress ? "compress.options" : "pane.details";

  if (isCompress) {
    workspaceTitleElement.textContent = displayContext.translator.t("compress.tableTitle");
    metaElement.textContent = displayContext.translator.t("compress.tableDescription");
    const sourceSnapshot = syncCreateSourcesFromWorkspace();
    const includedCount = sourceSnapshot.plan.current ? sourceSnapshot.inclusion.includedCount : sourceSnapshot.sourceCount;
    statusSelectionCountElement.textContent = displayContext.translator.t("compress.sourceStaged", {
      count: includedCount,
      sourceLabel: displayContext.translator.t(includedCount === 1 ? "compress.sourceSingular" : "compress.sourcePlural"),
    });
    statusSelectionSizeElement.textContent = "";
    statusFocusedSizeElement.textContent = "";
    statusFocusedModifiedElement.textContent = "";
  } else {
    workspaceTitleElement.textContent = displayContext.translator.t("extract.tableTitle");
    if (!currentArchivePath) {
      metaElement.textContent = displayContext.translator.t("extract.tableDescription");
    }
    updateStatusBar();
  }
  applyCurrentCommandSurfaceState(currentCommandStateMap());
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
  if (!currentArchivePath) {
    pathFieldInput.value = displayContext.translator.t("browse.statusEmpty");
    pathFieldInput.disabled = true;
    pathFieldInput.readOnly = true;
    pathCrumbsElement.textContent = displayContext.translator.t("browse.statusEmpty");
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

  const crumbs = archiveWorkspace.getSnapshot().view.breadcrumbs.flatMap((crumb, index) => {
    const name = crumb.isRoot ? getArchiveName(currentArchivePath, APP_TITLE) : crumb.name;
    const button = `<button type="button" data-crumb-path="${escapeHtml(crumb.path)}" aria-keyshortcuts="Enter Space">${escapeHtml(name)}</button>`;
    return index === 0 ? [button] : [`<span aria-hidden="true">&gt;</span>`, button];
  });

  pathCrumbsElement.innerHTML = crumbs.join("");
}

function renderTree() {
  if (currentWorkspaceMode() === "compress") {
    renderCompressSourceTree();
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

function renderCompressSourceTree() {
  const sourceSnapshot = syncCreateSourcesFromWorkspace();
  if (!sourceSnapshot.hasSources) {
    renderCreateNavigationTree({ treeContentElement }, {
      kind: "empty",
      message: displayContext.translator.t("compress.noSources"),
    });
    return;
  }

  const plan = sourceSnapshot.plan.current;
  const planEntries = plan?.planEntries ?? [];
  if (sourceSnapshot.plan.state === "loading" || !plan) {
    const planStatusText = createPlanStatusText(sourceSnapshot.plan.status);
    renderCreateNavigationTree({ treeContentElement }, {
      kind: "empty",
      message: planStatusText || displayContext.translator.t("create.plan.planning"),
    });
    return;
  }

  if (!planEntries.length) {
    renderCreateNavigationTree({ treeContentElement }, {
      kind: "empty",
      message: displayContext.translator.t("create.plan.none"),
    });
    return;
  }

  const currentFolder = sourceSnapshot.view.currentFolder;
  const folders: ArchiveWorkspaceTreeFolder[] = sourceSnapshot.view.treeFolders
    .map((folder) => {
      const isRoot = folder.path === archiveTreeRootPath;
      const label = isRoot ? suggestedCreateArchiveName() || APP_TITLE : folder.name;
      const icon = archiveTreeIconDescriptor(isRoot, folder.path === currentFolder, displayContext.translator);
      const iconDataUrl = systemIconDataUrlForRequest(
        isRoot
          ? systemIconRequestForPath(sourceSnapshot.sources[0] ?? "folder", true)
          : systemIconRequestForPath("folder", true),
      );
      return {
        path: folder.path,
        label,
        depth: folder.depth,
        canToggle: folder.hasChildren && !isRoot,
        isExpanded: folder.isExpanded,
        isActive: folder.path === currentFolder,
        iconHtml: renderEntryIcon(icon, "tree-icon", iconDataUrl),
      };
    });
  renderCreateNavigationTree({ treeContentElement }, {
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
  renderCompressSourceTree();
  renderCompressSources();
  focusFirstCompressRow();
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
    messageElement.textContent = displayContext.translator.t("browse.selectedEntries", { count: visibleSelectedCount });
  }

  queueSystemIconRefresh();
}

function createUnavailableReasonText(
  reason: CreateArchiveUnavailableReason,
  snapshot: CreateWorkspaceSnapshot,
): string {
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
      return createPlanStatusText(snapshot.plan.status) || message("create.status.needsPlan");
    case "starting":
      return message("create.status.starting");
  }
}

function createReadyStatusText(snapshot: CreateWorkspaceSnapshot): string {
  const plan = snapshot.plan.current;
  const includedCount = plan?.includedCount ?? 0;
  const filteredPlan = filteredCreatePlan(snapshot);
  const totalBytes = filteredPlan ? formatBytes(filteredPlan.totalBytes) : "";
  return message("create.status.ready", {
    count: filteredPlan?.includedCount ?? includedCount,
    size: totalBytes,
  });
}

function setCreatePlanState() {
  const sourceSnapshot = syncCreateSourcesFromWorkspace();
  const unavailableReason = sourceSnapshot.options.readiness.unavailableReason;
  const canCreate = sourceSnapshot.options.readiness.canCreate;
  const statusText = unavailableReason
    ? createUnavailableReasonText(unavailableReason, sourceSnapshot)
    : createReadyStatusText(sourceSnapshot);

  renderCreateActionState(createActionStateViewElements, {
    canCreate,
    hasSources: sourceSnapshot.hasSources,
    isEmpty: sourceSnapshot.isEmpty,
    statusText,
    createArchiveLabel: message("compress.createArchive"),
    isWarning: unavailableReason !== null && unavailableReason !== "needsSources",
  });
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
  syncCreateSourcesFromWorkspace(createWorkspace.setPathIncluded(path, included).snapshot);
}

function setAllCompressPathsIncluded(included: boolean) {
  syncCreateSourcesFromWorkspace(createWorkspace.setAllPathsIncluded(included).snapshot);
}

function setCurrentCompressFolderIncluded(included: boolean) {
  const snapshot = syncCreateSourcesFromWorkspace();
  syncCreateSourcesFromWorkspace(createWorkspace.setCurrentFolderIncluded(snapshot.view.currentFolder, included).snapshot);
}

function syncCompressIncludeAllControl() {
  const snapshot = syncCreateSourcesFromWorkspace();
  const state = createWorkspace.getIncludeAllControlState(snapshot.view.currentFolder);
  renderCompressIncludeAllControl(compressIncludeAllControlViewElements, state);
}

function syncCompressInclusionControls() {
  syncCompressSourceInclusionControls(compressSourceTableViewElements);
  syncCompressIncludeAllControl();
}

function refreshCreatePlanSummary() {
  const plan = filteredCreatePlan();
  if (!plan) {
    return;
  }
  renderCreatePlanSummary(createPlanSummaryViewElements, {
    plan,
    translator: displayContext.translator,
    formatBytes,
  });
}

function renderCreateSources() {
  const sourceSnapshot = syncCreateSourcesFromWorkspace();

  renderCreateSourceList(createSourceListViewElements, {
    sources: sourceSnapshot.sources,
    isEmpty: sourceSnapshot.isEmpty,
    includeAllDisabled: sourceSnapshot.isEmpty || sourceSnapshot.inclusion.excludedArchivePaths.length === 0,
    excludeAllDisabled: sourceSnapshot.isEmpty || sourceSnapshot.inclusion.includedCount === 0,
    noSourcesLabel: displayContext.translator.t("compress.noSources"),
    removeSourceLabel: displayContext.translator.t("compress.removeSource"),
  });

  setCreatePlanState();
}

function clearCreateSources() {
  syncCreateSourcesFromWorkspace(createWorkspace.clearSources().snapshot);
  applyCompressTableSelection(clearHierarchicalTableSelection());
  renderCreateSources();
  renderCompressBrowser();
  queuePlanRun();
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

function renderCompressSources() {
  const sourceSnapshot = syncCreateSourcesFromWorkspace();
  if (sourceSnapshot.isEmpty) {
    applyCompressTableSelection(clearHierarchicalTableSelection());
    renderCompressSourceTable(compressSourceTableViewElements, {
      state: "emptySources",
      emptyTitle: displayContext.translator.t("compress.emptyTable"),
      emptyHint: displayContext.translator.t("compress.dragSourcesHint"),
    });
    if (currentWorkspaceMode() === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  if (sourceSnapshot.plan.state === "loading" || !sourceSnapshot.plan.current) {
    const planStatusText = createPlanStatusText(sourceSnapshot.plan.status);
    applyCompressTableSelection(clearHierarchicalTableSelection());
    renderCompressSourceTable(compressSourceTableViewElements, {
      state: "planning",
      message: planStatusText || displayContext.translator.t("create.plan.planning"),
    });
    if (currentWorkspaceMode() === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  const rows = [...sourceSnapshot.view.rows];
  if (!rows.length) {
    applyCompressTableSelection(clearHierarchicalTableSelection());
    renderCompressSourceTable(compressSourceTableViewElements, {
      state: "folderEmpty",
      message: displayContext.translator.t("browse.folderEmpty"),
    });
    if (currentWorkspaceMode() === "compress") {
      renderCompressSourceTree();
    }
    syncCompressIncludeAllControl();
    return;
  }

  applyCompressTableSelection(cleanupHierarchicalTableSelection({
    ...currentCompressTableSelectionState(),
    visiblePaths: selectableHierarchicalRowPaths(rows),
    preserveHiddenSelection: false,
  }));

  renderCompressSourceTable(compressSourceTableViewElements, {
    state: "rows",
    rows: compressSourceTableRowModels(rows, sourceSnapshot),
  });
  syncCompressInclusionControls();

  if (currentWorkspaceMode() === "compress") {
    renderCompressSourceTree();
  }
}

function visibleCompressRows(): CompressPlanRow[] {
  return [...syncCreateSourcesFromWorkspace().view.rows];
}

function visibleCompressRowForPath(path: string): CompressPlanRow | undefined {
  const normalizedPath = normalizeEntryPath(path);
  return visibleCompressRows().find((row) => normalizeEntryPath(row.path) === normalizedPath);
}

function compressSourceTableRowModels(
  rows: readonly CompressPlanRow[],
  snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace(),
): CompressSourceTableRowModel[] {
  return rows.map((row) => compressSourceTableRowModel(row, snapshot));
}

function compressSourceTableRowModel(
  row: CompressPlanRow,
  snapshot: CreateWorkspaceSnapshot,
): CompressSourceTableRowModel {
  if (row.rowType === "parent") {
    const icon = compressSourceTableRowIcon(row, snapshot);
    return {
      rowType: "parent",
      path: row.path,
      name: row.name,
      iconHtml: icon.html,
      iconLabel: icon.label,
      ariaLabel: displayContext.translator.t("browse.parentFolder.aria"),
      kindText: displayContext.translator.t("icon.parentFolder"),
    };
  }

  if (row.rowType === "folder") {
    const inclusionState = compressRowInclusionState(row);
    const icon = compressSourceTableRowIcon(row, snapshot);
    return {
      rowType: "folder",
      path: row.path,
      sourcePath: sourcePathForCompressRow(row, snapshot) || null,
      name: row.name,
      selected: selectedCompressRows.has(row.path),
      focused: focusedCompressRowPath === row.path,
      inclusionState,
      inclusionLabel: compressInclusionLabel(inclusionState),
      includeAriaLabel: compressInclusionAriaLabel(row, inclusionState),
      iconHtml: icon.html,
      iconLabel: icon.label,
      ariaLabel: displayContext.translator.t("browse.openFolder.aria", { name: row.name }),
      sizeText: row.entry?.size === undefined ? "" : formatBytes(row.entry.size),
      modifiedText: row.entry?.modified ? formatDate(row.entry.modified) : "",
      kindText: displayContext.translator.t("detail.directory"),
    };
  }

  const inclusionState = compressRowInclusionState(row);
  const icon = compressSourceTableRowIcon(row, snapshot);
  return {
    rowType: "entry",
    path: row.path,
    sourcePath: sourcePathForCompressRow(row, snapshot) || null,
    name: row.name,
    selected: selectedCompressRows.has(row.path),
    focused: focusedCompressRowPath === row.path,
    inclusionState,
    inclusionLabel: compressInclusionLabel(inclusionState),
    includeAriaLabel: compressInclusionAriaLabel(row, inclusionState),
    iconHtml: icon.html,
    iconLabel: icon.label,
    sizeText: row.entry.size === undefined ? "" : formatBytes(row.entry.size),
    modifiedText: row.entry.modified ? formatDate(row.entry.modified) : "",
    kindText: normalizeArchiveKindLabel(row.entry.kind),
  };
}

function sourcePathForCompressRow(
  row: CompressPlanRow,
  snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace(),
): string {
  return sourcePathForCreatePlanRow(row, createPlanEntries(snapshot), snapshot.sources);
}

function compressSourceTableRowIcon(
  row: CompressPlanRow,
  snapshot: CreateWorkspaceSnapshot = syncCreateSourcesFromWorkspace(),
): { html: string; label: string } {
  const icon = row.rowType === "parent"
    ? archiveRowIconDescriptor(row, displayContext.translator)
    : row.rowType === "folder"
      ? archiveTreeIconDescriptor(false, row.path === snapshot.view.currentFolder, displayContext.translator)
      : archiveEntryIconDescriptor(row.entry, displayContext.translator);
  const iconDataUrl = row.rowType === "folder" || row.rowType === "parent"
    ? systemIconDataUrlForRequest(systemIconRequestForPath("folder", true))
    : systemIconDataUrlForRequest(systemIconRequestForPath(row.entry.sourcePath || row.entry.path, false));
  return {
    html: renderEntryIcon(icon, "row-icon", iconDataUrl),
    label: icon.label,
  };
}

function compressInclusionAriaLabel(
  row: Extract<CompressPlanRow, { rowType: "folder" | "entry" }>,
  state: "included" | "excluded" | "partial",
): string {
  return message(
    state === "excluded"
      ? "compress.includeItem.aria"
      : "compress.excludeItem.aria",
    { name: row.name },
  );
}

function focusFirstCompressRow() {
  focusFirstCompressSourceRow(compressSourceTableViewElements);
}

function getVisibleCompressSelectablePaths(): string[] {
  return selectableHierarchicalRowPaths(visibleCompressRows());
}

function currentCompressTableSelectionState() {
  return {
    selectedPaths: selectedCompressRows,
    focusedPath: focusedCompressRowPath,
    anchorPath: compressSelectionAnchorPath,
  };
}

function applyCompressTableSelection(result: HierarchicalTableSelectionResult) {
  selectedCompressRows = new Set(result.selectedPaths);
  focusedCompressRowPath = result.focusedPath;
  compressSelectionAnchorPath = result.anchorPath;
}

function getCompressRows(): HTMLTableRowElement[] {
  return getCompressSourceRows(compressSourceTableViewElements);
}

function getCompressSelectableRows(): HTMLTableRowElement[] {
  return getCompressSourceSelectableRows(compressSourceTableViewElements);
}

function selectedCompressSourcePaths(): string[] {
  return Array.from(new Set(getCompressSelectableRows()
    .filter((row) => selectedCompressRows.has(row.dataset.compressPath ?? ""))
    .map((row) => removableSourcePathForCompressRow(row))
    .filter(Boolean)));
}

function removableSourcePathForCompressRow(row: HTMLTableRowElement): string {
  const snapshot = syncCreateSourcesFromWorkspace();
  const rowPath = row.dataset.compressPath ?? "";
  if (!rowPath || snapshot.view.currentFolder) {
    return "";
  }

  const sourcePath = row.dataset.compressSourcePath ?? "";
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
  applyCompressTableSelection(applyHierarchicalRowSelectionIntent({
    path: rowPath,
    visiblePaths: getVisibleCompressSelectablePaths(),
    currentSelection: selectedCompressRows,
    anchorPath: compressSelectionAnchorPath,
    shiftKey: Boolean(options?.shift),
    ctrlKey: Boolean(options?.ctrl),
    metaKey: Boolean(options?.meta),
  }));
}

function syncCompressSelectionUi() {
  syncCompressSourceSelectionUi(compressSourceTableViewElements, {
    selectedPaths: Array.from(selectedCompressRows),
    focusedPath: focusedCompressRowPath,
  });
}

function focusCompressRow(row: HTMLTableRowElement | null, focusedPath?: string) {
  if (!row) {
    return;
  }
  row.focus();
  applyCompressTableSelection(focusHierarchicalTablePath(
    currentCompressTableSelectionState(),
    focusedPath ?? row.dataset.compressPath ?? "",
  ));
  syncCompressSelectionUi();
}

function focusRelativeCompressRow(currentRow: HTMLTableRowElement, direction: 1 | -1) {
  const rows = getCompressRows();
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }

  const nextFocus = moveHierarchicalTableFocus({
    rows: visibleCompressRows(),
    currentIndex,
    direction,
  });
  focusCompressRow(rows[nextFocus.rowIndex] ?? null, nextFocus.focusedPath);
}

function toggleCompressRowSelection(row: HTMLTableRowElement) {
  const rowPath = row.dataset.compressPath;
  if (!rowPath) {
    return;
  }

  applyCompressTableSelection(toggleHierarchicalTablePathSelection({
    ...currentCompressTableSelectionState(),
    path: rowPath,
  }));
  syncCompressSelectionUi();
}

function activateCompressRow(row: HTMLTableRowElement) {
  const folderPath = row.dataset.compressFolderRow;
  if (folderPath !== undefined) {
    navigateToCompressFolder(folderPath);
  }
}

function renderCompressBrowser() {
  if (currentWorkspaceMode() === "compress") {
    renderCompressSourceTree();
    renderCompressSources();
  }
  setCreatePlanState();
}

function renderJobStatusBar(snapshot: JobListSnapshot) {
  activeJobElement.textContent = snapshot.activeJob
    ? `${formatJobKind(snapshot.activeJob.kind)}: ${message(jobStatusMessageKey(snapshot.activeJob.status))}`
    : message("status.noJobs");
}

function renderJobs() {
  const nowMs = Date.now();
  const snapshot = jobsWorkspace.getJobListSnapshot(nowMs);
  jobsListElement.innerHTML = renderJobsListHtml(jobsWorkspace.getJobsMap(), {
    i18n: displayContext.translator,
    escapeHtml,
    formatBytes,
    formatJobKind,
    canRetryJobWithPassword,
    getOutputActions: (jobId) => [...jobsWorkspace.getReadyOutputActions(jobId)],
  });
  renderJobStatusBar(snapshot);
  renderQuickProgress(nowMs);
  syncProgressClock(snapshot.progressClock);
}

function queuePlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }

  const queuedPlan = createWorkspace.queuePlan();
  const revision = queuedPlan.revision;
  const sourceSnapshot = syncCreateSourcesFromWorkspace(queuedPlan.snapshot);
  if (sourceSnapshot.isEmpty) {
    setCreatePlanState();
    renderCreatePlanStatus(createPlanSummaryViewElements, {
      message: displayContext.translator.t("create.plan.noSources"),
    });
    renderCompressBrowser();
    return;
  }

  setCreatePlanState();
  renderCreatePlanStatus(createPlanSummaryViewElements, {
    message: displayContext.translator.t("create.plan.planning"),
  });
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
  syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPath(createDestinationInput.value).snapshot);
  setCreatePlanState();
}

function setCreateOptionsFromControls() {
  syncCreateSourcesFromWorkspace(createWorkspace.setOptions(
    readCreateOptionControlPatch(createOptionControlViewElements),
  ).snapshot);
}

function updateCreateOptionsFromControls() {
  setCreateOptionsFromControls();
  setCreatePlanState();
}

function updateCreatePlanOptionsFromControls() {
  setCreateOptionsFromControls();
  queuePlanRun();
}

type ExtractPathMode = "full" | "current" | "none";

function recordExtractDestinationHistory(destination: string): void {
  if (!pathHistoryStore.recordExtractDestinationHistory(destination)) {
    return;
  }
  renderExtractDestinationHistory();
}

function renderExtractDestinationHistory() {
  const { extractDestinationHistory } = pathHistoryStore.getSnapshot();
  extractDestinationHistoryList.innerHTML = extractDestinationHistory
    .map((entry) => `<option value="${escapeHtml(entry)}"></option>`)
    .join("");
}

function recordCreateDestinationHistory(destination: string): void {
  if (!pathHistoryStore.recordCreateDestinationHistory(destination)) {
    return;
  }
  renderCreateDestinationHistory();
}

function renderCreateDestinationHistory() {
  const { createDestinationHistory } = pathHistoryStore.getSnapshot();
  renderCreateDestinationHistoryView(createDestinationHistoryViewElements, {
    entries: createDestinationHistory.map((entry) => ({
      value: entry,
      label: middleTruncateDetailValue(entry, 54),
    })),
    recentLabel: message("create.destination.recent"),
  });
}

function recordRecentArchiveHistory(archivePath: string): void {
  pathHistoryStore.recordRecentArchiveHistory(archivePath);
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

function requestExtractPasswordInDialog(retry: ArchiveWorkspacePasswordRetry) {
  extractDialogMessage.textContent = message(retry.promptKey);
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

function onModalClosed(dialog: HTMLElement) {
  if (dialog === extractDialog) {
    archiveWorkspace.clearPasswordRetry();
    browsePasswordInput.value = "";
    browsePasswordInput.type = "password";
    browseShowPasswordInput.checked = false;
  }
}

const modalController = createModalController({
  dialogs: () => [extractDialog, aboutDialog, preferencesDialog, infoDialog],
  fallbackFocus: fallbackFocusForDialog,
  ignoredReturnFocusRoots: () => [contextMenu],
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

function activateDialogDefault(event: KeyboardEvent, dialog: HTMLElement): boolean {
  return modalController.activateDefault(event, dialog, {
    isDefaultSafeTextEntry: isDefaultSafeDialogTextEntry,
  });
}

function cancelDialog(event: KeyboardEvent, dialog: HTMLElement): boolean {
  return modalController.cancel(event, dialog);
}

function clearCreatePasswordFields() {
  createPasswordInput.value = "";
  createPasswordConfirmInput.value = "";
  createPasswordInput.type = "password";
  createPasswordConfirmInput.type = "password";
  createShowPasswordInput.checked = false;
}

function isCreateSubmissionInFlight(): boolean {
  return createWorkspace.getSnapshot().options.submissionInFlight;
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

function hasActiveJob(): boolean {
  return jobsWorkspace.hasActiveJob();
}

function currentDropSurface(): DropIntentSurface {
  return dropSurfaceForWorkspace({ createDialogOpen: false, mode: currentWorkspaceMode() });
}

function renderDropOverlay(snapshot: ShellWorkspaceSnapshot = shellWorkspace.getSnapshot()) {
  renderShellDropOverlay(shellViewElements, snapshot.dropOverlay, message);
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
      setDropOverlayChoice(decision, dropCopyForDecision(decision));
      focusDropOverlayPrimaryAction(shellViewElements);
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
    messageElement.textContent = displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length });
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
    messageElement.textContent = displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length });
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
    messageElement.textContent = displayContext.translator.t("browse.loadedEntries", { count: getVisibleSelectablePaths().length });
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
  const selectedPaths = new Set(selection.selectedPaths);
  selectAllInput.checked = selection.visibleSelectablePaths.length > 0
    && selection.visibleSelectedCount === selection.visibleSelectablePaths.length;
  selectAllInput.indeterminate = selection.visibleSelectedCount > 0
    && selection.visibleSelectedCount < selection.visibleSelectablePaths.length;

  for (const row of tableBody.querySelectorAll<HTMLTableRowElement>("tr[data-entry-path]")) {
    const path = row.dataset.entryPath ?? "";
    const selected = selectedPaths.has(path);
    const focused = selection.focusedPath === path;
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

function clampCompressSourceColumnWidth(columnId: CompressSourceColumnId, width: number): number {
  return clampCompressSourceColumnWidthValue(width, {
    minWidth: COMPRESS_SOURCE_MIN_COLUMN_WIDTHS[columnId],
    maxWidth: COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX,
  });
}

function currentCompressSourceColumnWidths(): Record<CompressSourceColumnId, number> {
  return readCompressSourceColumnWidths(compressSourceTable, {
    columnIds: COMPRESS_SOURCE_COLUMN_IDS,
    defaultWidths: COMPRESS_SOURCE_DEFAULT_COLUMN_WIDTHS,
    minWidths: COMPRESS_SOURCE_MIN_COLUMN_WIDTHS,
    maxWidth: COMPRESS_SOURCE_MAX_COLUMN_WIDTH_PX,
  });
}

function applyCompressSourceColumnWidths(widths: Record<CompressSourceColumnId, number>) {
  compressSourceColumnWidths = widths;
  applyCompressSourceColumnWidthStyles(compressSourceTable, {
    columnIds: COMPRESS_SOURCE_COLUMN_IDS,
    includeColumnWidth: COMPRESS_SOURCE_INCLUDE_COLUMN_WIDTH_PX,
    widths,
  });
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
  const canPastePath = Boolean(navigator.clipboard?.readText);
  const { recentArchiveHistory } = pathHistoryStore.getSnapshot();
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
    <button type="button" role="menuitem" data-context-action="open-archive"><span class="context-menu-label">${escapeHtml(displayContext.translator.t("browse.emptyOpenAction"))}</span></button>
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
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
    }));
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
    <div class="context-menu-caption">${escapeHtml(message("detail.columnCaption", { label: archiveTableColumnLabel(selectedColumn, displayContext.translator) }))}</div>
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
        <span class="context-menu-label">${escapeHtml(archiveTableColumnLabel(column, displayContext.translator))}</span>
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
    <button type="button" role="menuitem" data-context-action="clear-sources" ${syncCreateSourcesFromWorkspace().hasSources ? "" : "disabled"}>
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

function handleContextMenuAction(payload: ContextMenuActionPayload) {
  const action = payload.action;
  const folderPath = payload.folderPath;
  const columnId = payload.columnId as ArchiveTableColumnId | undefined;
  const archivePath = payload.archivePath;
  const entryPath = contextEntryPath;
  const sourcePath = contextSourcePath;
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
        ${renderInfoDetailRows(rows)}
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
        ${renderInfoDetailRows(rows)}
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
        ${renderInfoDetailRows(rows)}
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

function activeDisplayWorkspace(): DisplayRefreshWorkspace {
  return currentWorkspaceMode() === "compress" ? "create" : "browse";
}

function refreshDisplayFromPreferences() {
  refreshDisplayContext(appPreferences.locale, {
    activeWorkspace: activeDisplayWorkspace(),
    jobsVisible: workspaceElement.dataset.jobDrawer === "open" || isQuickActionJobMode(),
    preferencesVisible: !preferencesDialog.hidden,
  }, {
    commitContext: (nextDisplayContext) => {
      displayContext = nextDisplayContext;
    },
    documentElement: document.documentElement,
    translationRoot: document.body,
    refreshCommands: refreshCommandDisplayText,
    renderBrowse,
    renderCreate: renderCompressBrowser,
    renderJobs,
    renderPreferences: renderPreferencesDialog,
  });
}

function refreshCommandDisplayText() {
  refreshCommandSurfaceText(document, {
    commandDefinitions: COMMAND_DEFINITIONS,
    commandLabel: (commandId) => commandLabel(commandId, displayContext.translator),
    commandTooltip: (commandId) => commandTooltipText(commandId, displayContext.translator),
    menuGroupLabel: (label) => menuGroupLabel(label, displayContext.translator),
    submenuLabel: (key) => displayContext.translator.t(key),
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
  renderPreferencesView(preferencesViewElements, preferencesDialogDraft ?? appPreferences, displayContext.translator);
  syncPreferenceSaveState();
}

function collectPreferencesFromDialog(): AppPreferences {
  return collectPreferencesFromView(preferencesViewElements, preferencesDialogDraft ?? appPreferences);
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
  clearCreatePasswordFields();
  syncCreateSourcesFromWorkspace(result.snapshot);
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
  persistPreferencePatch(preferencesDialogDraft ?? collectPreferencesFromDialog());
  preferencesDialogDraft = null;
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setRowOptions({
    showParentFolderItem: appPreferences.showParentFolderItem,
  }));
  syncArchiveWorkspaceViewSnapshot(archiveWorkspace.setFlatView(appPreferences.flatViewDefault));
  applyCreatePreferenceDefaults();
  applyPreferenceClasses();
  refreshDisplayFromPreferences();
  preferencesStatusElement.textContent = displayContext.translator.t("preferences.saved");
  preferencesStatusElement.className = "status status-success";
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
    title: displayContext.translator.t("nativeDialog.chooseDefaultOutput"),
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

  archiveWorkspace.clearPasswordRetry();
  activeExtractMode = mode;
  extractTitle.textContent = message(mode === "selection" ? "extract.selectedTitle" : "extract.archiveTitle");
  extractDialogMessage.textContent = extractDialogMessageForMode(mode);
  extractStartButton.textContent = message(mode === "selection" ? "extract.selectedAction" : "extract.allAction");
  const { extractDestinationHistory } = pathHistoryStore.getSnapshot();
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
  const { createDestinationHistory } = pathHistoryStore.getSnapshot();
  if (!createWorkspace.getSnapshot().options.destinationPath.trim() && createDestinationHistory[0]) {
    syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPathIfBlank(createDestinationHistory[0]).snapshot);
  }
  setWorkspaceMode("compress");
  setCreatePlanState();
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

    const loadingSnapshot = archiveWorkspace.beginLoading({
      archivePath: request.archivePath,
      preserveListing: preserveState,
    });
    syncArchiveWorkspaceSnapshot(loadingSnapshot);
    syncArchiveWorkspaceViewSnapshot(loadingSnapshot);
    setBrowseState("loading", displayContext.translator.t("browse.statusLoading"));
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
      const retry = requestArchivePasswordRetry("listArchive", commandError);
      if (!retry) {
        syncArchiveWorkspaceSnapshot(archiveWorkspace.loadFailed(
          commandError ?? { kind: "unknown" },
        ));
        setBrowseState(
          "error",
          commandError
            ? `${commandError.message}${commandError.hint ? `\n${commandError.hint}` : ""}`
            : message("browse.failedList"),
        );
        renderBrowse();
        return;
      }

      const nextPassword = promptForArchivePasswordRetry(retry);
      if (!nextPassword) {
        syncArchiveWorkspaceSnapshot(archiveWorkspace.loadFailed(
          commandError ?? { kind: "unknown" },
        ));
        setBrowseState("error", commandError?.message ?? message("browse.failedList"));
        renderBrowse();
        return;
      }
      password = nextPassword;
    }
  }
}

function loadArchiveListingIntoState(listing: ArchiveFixture, options: LoadArchiveOptions = {}) {
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

async function runPlan(revision?: number) {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
    planDebounce = null;
  }

  const planStart = createWorkspace.beginPlan({
    excludeNames: [],
    excludeArchivePaths: [],
    includeArchivePaths: [],
    followSymlinks: false,
  }, revision);
  const planStartSnapshot = syncCreateSourcesFromWorkspace(planStart.snapshot);

  if (!planStart.ready) {
    if (planStart.reason === "needsSources") {
      setCreatePlanState();
      renderCreatePlanStatus(createPlanSummaryViewElements, {
        message: displayContext.translator.t("create.plan.noSources"),
      });
      renderCompressBrowser();
    }
    return;
  }

  setCreatePlanState();
  renderCreatePlanStatus(createPlanSummaryViewElements, {
    message: createPlanStatusText(planStartSnapshot.plan.status) || displayContext.translator.t("create.plan.planning"),
  });
  renderCompressBrowser();

  if (canUseBrowserCreatePlanPreview()) {
    const result = browserCreatePlanPreview([...planStart.request.sources]);
    const acceptedPlan = createWorkspace.acceptPlanResult(planStart.revision, result);
    if (!acceptedPlan.accepted) {
      return;
    }
    const snapshot = syncCreateSourcesFromWorkspace(acceptedPlan.snapshot);
    const plan = snapshot.plan.current;
    if (!plan) {
      return;
    }
    refreshCreatePlanSummary();
    setCreatePlanState();
    renderCompressBrowser();
    return;
  }

  try {
    const result = await runPlanCreate(planStart.request);
    const acceptedPlan = createWorkspace.acceptPlanResult(planStart.revision, result);
    if (!acceptedPlan.accepted) {
      return;
    }

    const snapshot = syncCreateSourcesFromWorkspace(acceptedPlan.snapshot);
    const plan = snapshot.plan.current;
    if (!plan) {
      return;
    }
    refreshCreatePlanSummary();
    setCreatePlanState();
    renderCompressBrowser();
  } catch (error) {
    const commandError = asCommandError(error);
    const acceptedError = createWorkspace.acceptPlanError(planStart.revision, {
      fallbackText: commandError?.message ?? "Could not create archive plan.",
    });
    if (!acceptedError.accepted) {
      return;
    }

    const errorSnapshot = syncCreateSourcesFromWorkspace(acceptedError.snapshot);
    setCreatePlanState();
    renderCreatePlanStatus(createPlanSummaryViewElements, {
      message: createPlanStatusText(errorSnapshot.plan.status),
    });
    renderCompressBrowser();
  }
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
      const promptedPassword = jobPasswordPrompts.promptForNewArchivePassword();
      if (!promptedPassword) {
        setOperationalMessage("quickCreate.cancelled");
        return;
      }
      password = promptedPassword;
    }
    const requestResult = buildQuickCreateStartRequest({
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
    if (!requestResult.ok) {
      setOperationalMessage(
        requestResult.reason === "needsSources"
          ? "quickCreate.needsSource"
          : "quickCreate.needsDestination",
      );
      return;
    }

    const request = requestResult.request;
    const response = await runStartCreate(request);
    recordCreateDestinationHistory(request.destinationPath);
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
  const sourceSnapshot = syncCreateSourcesFromWorkspace(createWorkspace.setSources(sources).snapshot);
  applyCreateDefaultsForFormat(format);
  syncCreateSourcesFromWorkspace(createWorkspace.setOptions({ cleanSource }).snapshot);
  syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPath(buildQuickCreateDestination(
    [...sourceSnapshot.sources],
    format,
    appPreferences,
    { nativeParentPath, joinNativePath },
  )).snapshot);
  cancelQueuedPlanRun();
  renderCreateSources();
  renderCompressBrowser();

  setOperationalMessage("quickCreate.planning");
  await runPlan();
  const reviewSnapshot = syncCreateSourcesFromWorkspace();
  if (reviewSnapshot.plan.state === "ready" && reviewSnapshot.plan.current !== null) {
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
          const nextPassword = jobPasswordPrompts.promptForCommandRetry(commandError.code);
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
  const retryDetails = jobsWorkspace.getPasswordRetryDetails(jobId);
  if (!retryDetails) {
    setOperationalMessage("jobs.retryUnavailable");
    return;
  }

  if (!retryDetails.failure.code) {
    setOperationalMessage("jobs.retryUnavailable");
    return;
  }

  const password = jobPasswordPrompts.promptForCommandRetry(retryDetails.failure.code);
  if (!password) {
    setOperationalMessage("jobs.passwordRetryCancelled");
    return;
  }

  try {
    const response = await startPasswordRetryJob(retryDetails.context, password);
    addJobState(response, {
      retryContext: retryDetails.context,
      outputActions: retryJobOutputActions(retryDetails.context),
    });
    setOperationalMessage("jobs.passwordRetryStarted");
  } catch (error) {
    const commandError = asCommandError(error);
    setOperationalStatus(commandError?.message ?? message("jobs.passwordRetryFailed"));
  }
}

async function maybePromptForJobPasswordRetry(jobId: string) {
  if (!jobsWorkspace.markPasswordRetryPromptedIfEligible(jobId)) {
    return;
  }

  await retryJobWithPasswordPrompt(jobId);
}

async function pollJobs() {
  const decision = jobsWorkspace.beginPolling();
  if (decision.action === "requestAgain") {
    return;
  }

  if (decision.action === "stop") {
    stopPolling();
    renderJobs();
    maybeCloseCompletedQuickActionWindow();
    return;
  }

  try {
    await Promise.all(
      decision.jobIds.map(async (jobId) => {
        if (!jobsWorkspace.hasJob(jobId)) {
          return;
        }
        try {
          const snapshot = await pollJobEventsCommand({ jobId });

          jobsWorkspace.mergePolledSnapshot(snapshot);
          await maybePromptForJobPasswordRetry(jobId);
        } catch (error) {
          const commandError = asCommandError(error);
          if (commandError?.code === "not_found") {
            jobsWorkspace.removeJob(jobId);
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
          jobsWorkspace.markJobFailed(jobId, failedEvent);
          setOperationalStatus(messageText);
        }
      }),
    );

    renderJobs();
    maybeCloseCompletedQuickActionWindow();
  } finally {
    const finish = jobsWorkspace.finishPolling();
    if (finish.shouldPollAgain) {
      void pollJobs();
    }
  }
}

function schedulePolling() {
  jobTimers.startPolling(() => {
    void pollJobs();
  });
}

function scheduleProgressClock() {
  jobTimers.startProgressClock(() => {
    renderJobs();
  });
}

function stopProgressClock() {
  jobTimers.stopProgressClock();
}

function syncProgressClock(snapshot: ProgressClockSnapshot = jobsWorkspace.getProgressClockSnapshot()) {
  if (snapshot.shouldRun) {
    scheduleProgressClock();
  } else {
    stopProgressClock();
  }
}

function stopPolling() {
  jobTimers.stopPolling();
}

async function onOpenArchive() {
  const selected = await openNativeDialog({
    title: displayContext.translator.t("nativeDialog.openArchive"),
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
    setOperationalStatus(unknownErrorMessage(error, displayContext.translator.t("nativeDialog.failed")));
  }
}

async function onTestArchive() {
  if (!currentArchivePath) {
    return;
  }

  let password = browsePasswordInput.value.trim() || undefined;
  let requestResult = archiveWorkspace.buildTestRequest({ password });
  if (!requestResult.ok) {
    return;
  }
  let request = requestResult.request;

  while (true) {
    try {
      const response = await runTestArchive(request);
      addJobState(response, {
        retryContext: {
          retryKind: "testArchive",
          archivePath: request.archivePath,
          ...(request.entryPaths?.length ? { entryPaths: request.entryPaths } : {}),
        },
      });
      archiveWorkspace.clearPasswordRetry();
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      const retry = requestArchivePasswordRetry("testArchive", commandError);
      if (retry) {
        const nextPassword = promptForArchivePasswordRetry(retry);
        if (!nextPassword) {
          archiveWorkspace.clearPasswordRetry();
          setBrowseState("error", commandError?.message ?? message("test.unableStart"));
          return;
        }
        password = nextPassword;
        requestResult = archiveWorkspace.buildTestRequest({ password });
        if (!requestResult.ok) {
          return;
        }
        request = requestResult.request;
        continue;
      }

      if (!commandError) {
        setBrowseState("error", message("test.unableStart"));
        return;
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
    title: displayContext.translator.t("nativeDialog.chooseExtractDestination"),
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
  const entryReferences = archiveWorkspace.getExtractReferencePaths(destinationMode);

  if (destinationMode === "archive") {
    const stripComponents = resolveExtractStripComponents(
      stripComponentsBase,
      pathMode,
      [...entryReferences],
      deduplicateRoot,
    );

    while (true) {
      try {
        const requestResult = archiveWorkspace.buildExtractRequest({
          mode: "archive",
          destinationPath: destination,
          overwrite,
          stripComponents,
          password,
        });
        if (!requestResult.ok) {
          return;
        }
        const request = requestResult.request;
        const response = await runStartExtract(request);
        recordExtractDestinationHistory(destination);
        closeModal(extractDialog);
        archiveWorkspace.clearPasswordRetry();
        addJobState(response, {
          retryContext: {
            retryKind: "extractArchive",
            archivePath: request.archivePath,
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
        const retry = requestArchivePasswordRetry("extractArchive", commandError);
        if (retry) {
          requestExtractPasswordInDialog(retry);
          return;
        }
        setBrowseState("error", commandError?.message ?? message("extract.unableStart"));
        return;
      }
    }
  }

  if (!entryReferences.length) {
    extractDialogMessage.textContent = message("extract.selectEntryFirst");
    return;
  }
  const stripComponents = resolveExtractStripComponents(
    stripComponentsBase,
    pathMode,
    [...entryReferences],
    deduplicateRoot,
  );

  while (true) {
    try {
      const requestResult = archiveWorkspace.buildExtractRequest({
        mode: "selection",
        destinationPath: destination,
        overwrite,
        stripComponents,
        password,
      });
      if (!requestResult.ok) {
        extractDialogMessage.textContent = message("extract.selectEntryFirst");
        return;
      }
      const request = requestResult.request;
      const response = await runStartExtract(request);
      recordExtractDestinationHistory(destination);
      closeModal(extractDialog);
      archiveWorkspace.clearPasswordRetry();
      addJobState(response, {
        retryContext: {
          retryKind: "extractArchive",
          archivePath: request.archivePath,
          destinationPath: destination,
          overwrite,
          entryPaths: request.entryPaths,
          stripComponents,
        },
        focusProgress: true,
        autoCloseAction: "returnToWorkspace",
        progressContext: extractJobProgressContext(request, "selection"),
        outputActions: extractJobOutputActions(request),
      });
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      const retry = requestArchivePasswordRetry("extractSelection", commandError);
      if (retry) {
        requestExtractPasswordInDialog(retry);
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

  const overwrite = getOverwritePolicyValue();
  const stripComponents = toNumberOrUndefined(browseStripInput.value) ?? 0;
  let password = browsePasswordInput.value.trim() || undefined;
  let requestResult = archiveWorkspace.buildPreviewRequest({
    overwrite,
    stripComponents,
    password,
  });
  if (!requestResult.ok) {
    setOperationalMessage("command.singleFileRequired");
    return;
  }
  let request = requestResult.request;

  const cachedPreviewPath = shellWorkspace.getCachedPreviewPathForEntry(request.entryPath);
  if (openOutside && cachedPreviewPath) {
    try {
      await openDesktopPath(cachedPreviewPath);
      archiveWorkspace.clearPasswordRetry();
      setBrowseState("loaded", message("preview.openedCached"));
      renderBrowse();
      return;
    } catch (error) {
      clearTrackedPreviewState();
    }
  }

  while (true) {
    try {
      const response = await runPreviewEntry(request);

      await openDesktopPath(response.previewPath);
      shellWorkspace.trackPreviewResultMetadata({
        cleanupRoot: response.cleanupRoot,
        previewPath: response.previewPath,
        entryPath: request.entryPath,
      });
      archiveWorkspace.clearPasswordRetry();
      if (openOutside) {
        setBrowseState("loaded", message("preview.openedOutside", { size: formatBytes(response.writtenBytes) }));
      } else {
        setBrowseState("loaded", message("preview.ready", { size: formatBytes(response.writtenBytes) }));
      }
      renderBrowse();
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      const retry = requestArchivePasswordRetry(
        openOutside ? "openOutsideEntry" : "previewEntry",
        commandError,
      );
      if (retry) {
        const nextPassword = promptForArchivePasswordRetry(retry);
        if (!nextPassword) {
          archiveWorkspace.clearPasswordRetry();
          setBrowseState("error", commandError?.message ?? message("preview.unablePreview"));
          return;
        }
        password = nextPassword;
        requestResult = archiveWorkspace.buildPreviewRequest({
          overwrite,
          stripComponents,
          password,
        });
        if (!requestResult.ok) {
          setOperationalMessage("command.singleFileRequired");
          return;
        }
        request = requestResult.request;
        continue;
      }

      setBrowseState("error", commandError?.message ?? message("preview.unablePreview"));
      return;
    }
  }
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
  refreshCreateStateAfterDestinationEdit();
}

async function runCreate(
  options: { destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"] } = {},
) {
  if (isCreateSubmissionInFlight()) {
    return;
  }

  const sourceSnapshot = syncCreateSourcesFromWorkspace();
  if (sourceSnapshot.isEmpty) {
    return;
  }

  const requestResult = createWorkspace.buildStartCreateRequest({
    password: createPasswordInput.value,
    passwordConfirm: createPasswordConfirmInput.value,
    destinationCollisionStrategy: options.destinationCollisionStrategy,
  });
  syncCreateSourcesFromWorkspace(requestResult.snapshot);
  if (!requestResult.ok) {
    setCreatePlanState();
    return;
  }

  const request = requestResult.request;
  syncCreateSourcesFromWorkspace(createWorkspace.setSubmissionInFlight(true).snapshot);
  setCreatePlanState();

  try {
    const response = await runStartCreate(request);

    clearCreatePasswordFields();
    recordCreateDestinationHistory(request.destinationPath);
    addJobState(response, {
      focusProgress: true,
      autoCloseAction: "returnToWorkspace",
      progressContext: createJobProgressContext(request),
      outputActions: createJobOutputActions(request),
    });
  } catch (error) {
    const commandError = asCommandError(error);
    syncCreateSourcesFromWorkspace(createWorkspace.setPlanError(
      commandError?.message
        ? { fallbackText: commandError.message }
        : { messageKey: "create.error.unableStart" },
    ));
    setCreatePlanState();
  } finally {
    syncCreateSourcesFromWorkspace(createWorkspace.setSubmissionInFlight(false).snapshot);
    setCreatePlanState();
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

async function onJobOutputAction(jobId?: string, indexValue?: string, kind?: string) {
  const resolution = jobsWorkspace.getOutputAction({
    jobId,
    index: Number(indexValue),
    kind,
  });
  if (resolution.action === "unavailable") {
    setOperationalMessage("jobs.outputUnavailable");
    return;
  }

  try {
    await jobOutputEffects.run(resolution.outputAction);
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, message("jobs.outputOpenFailed")));
  }
}

async function onDismissJob(jobId: string) {
  try {
    await dismissJobCommand({ jobId });
    jobsWorkspace.removeJob(jobId);
    renderJobs();
    if (!jobsWorkspace.hasJobs()) {
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
  const defaults = createDefaultsForFormat(appPreferences, format);
  syncCreateSourcesFromWorkspace(createWorkspace.changeFormat(format, defaults).snapshot);
  clearCreatePasswordFields();

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
    modalController.trapFocus(event, openDialogElement);
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

  const shortcutSelectedCount = event.key === "F5" ? selectedEntries.size : getSelectedEntryPaths().length;
  const routedCommand = selectKeyboardCommand({
    key: event.key,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    selectedCount: shortcutSelectedCount,
  });
  if (routedCommand) {
    event.preventDefault();
    runRoutedCommand(routedCommand.commandId, routedCommand.payload);
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
  bindDropOverlayActions(shellViewElements, {
    onChoice: activatePendingDropChoice,
  });
  bindCommandSurface(appRoot, {
    commandDefinitions: COMMAND_DEFINITIONS,
    onCommand: (commandId) => runRoutedCommand(commandId),
    onMenuPopoverCommand: closeOpenMenus,
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
    const routedCommand = selectDetailsCommand(action);
    if (routedCommand) {
      runRoutedCommand(routedCommand.commandId, routedCommand.payload);
      return;
    }
    if (action === "clear-search") {
      clearSearch();
    }
  });
  navBackButton.addEventListener("click", navigateBack);
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
      const toggleResult = createWorkspace.toggleTreeFolder(folderPath);
      syncCreateSourcesFromWorkspace(toggleResult.snapshot);
      if (toggleResult.accepted) {
        renderCompressSourceTree();
      }
      return;
    }

    const compressFolderTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-compress-folder-path]");
    if (compressFolderTarget) {
      navigateToCompressFolder(compressFolderTarget.dataset.compressFolderPath ?? "");
      return;
    }

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

  archiveEmptyStateElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showStartupContextMenu(event.clientX, event.clientY);
  });

  archiveEmptyStateElement.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-empty-action='open-archive']");
    if (!target) {
      return;
    }
    runRoutedCommand("open");
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
  applyArchiveTableSelection(applyHierarchicalMarqueeSelection({
    hitPaths: selectedRowsInMarqueeRect(rect),
    visiblePaths: getVisibleSelectablePaths(),
    baseSelection: gesture.baseSelection,
    additive: gesture.additive,
  }));
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
  if (selectedEntries.has(entryPath)) {
    applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path: entryPath,
      focusSelectedPath: true,
    }));
    return;
  }

  applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
    ...currentArchiveTableSelectionState(),
    path: entryPath,
    focusSelectedPath: true,
  }));
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
      runRoutedCommand("view");
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
    applyArchiveTableSelection(setHierarchicalTablePathSelected({
      ...currentArchiveTableSelectionState(),
      path,
      selected: target.checked,
    }));
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
          applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
            ...currentArchiveTableSelectionState(),
            path: entryPath,
          }));
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
      applyArchiveTableSelection(replaceHierarchicalTableSelection({
        paths: [entryPath],
        focusedPath: entryPath,
        anchorPath: entryPath,
      }));
      renderBrowse();
      runRoutedCommand("view");
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
        applyArchiveTableSelection(ensureHierarchicalTablePathSelected({
          ...currentArchiveTableSelectionState(),
          path: entryPath,
        }));
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

  browseExtractDestinationButton.addEventListener("click", () => void onSelectDestinationForExtract());
  extractStartButton.addEventListener("click", () => void startExtract(activeExtractMode));
  extractDialog.addEventListener("keydown", handleExtractDialogEnter);
  extractDestinationInput.addEventListener("input", syncExtractDialogState);
  extractDestinationInput.addEventListener("change", syncExtractDialogState);

  addSourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showAddSourcesMenu(addSourceButton);
  });
  bindCreateSourceListActions(createSourceListViewElements, {
    onRemoveSource: (sourcePath) => {
      removeCreateSources([sourcePath]);
    },
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
    setCurrentCompressFolderIncluded(readCompressIncludeAllChecked(compressIncludeAllControlViewElements));
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
        focusCompressRow(findCompressSourceRowByPath(compressSourceTableViewElements, rowPath));
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
      focusCompressRow(findCompressSourceRowByPath(compressSourceTableViewElements, rowPath));
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
        applyCompressTableSelection(ensureHierarchicalTablePathSelected({
          ...currentCompressTableSelectionState(),
          path: rowPath,
        }));
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
      applyCompressTableSelection(ensureHierarchicalTablePathSelected({
        ...currentCompressTableSelectionState(),
        path: rowPath,
      }));
      syncCompressSelectionUi();
    }
    showCompressRowContextMenu(row, event.clientX, event.clientY);
  });

  createFormatSelect.addEventListener("change", onCreateFormatChange);
  createDestinationInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);
  createDestinationRecentSelect.addEventListener("change", () => {
    const destination = createDestinationRecentSelect.value;
    if (destination) {
      syncCreateSourcesFromWorkspace(createWorkspace.setDestinationPath(destination).snapshot);
      setCreatePlanState();
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
    button.addEventListener("change", updateCreatePlanOptionsFromControls);
  }
  createCompressionInput.addEventListener("change", updateCreateOptionsFromControls);
  createVolumeInput.addEventListener("change", updateCreateOptionsFromControls);
  createTzapRecoveryInput.addEventListener("change", updateCreateOptionsFromControls);

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
    const outputAction = actionButton?.dataset.outputAction;
    const outputJobId = actionButton?.dataset.outputJob;
    const outputIndex = actionButton?.dataset.outputIndex;
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
    if (outputAction !== undefined) {
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

  document.addEventListener("focusin", (event) => modalController.keepFocusInsideOpenModal(event));
  appRoot.addEventListener("keydown", handleShortcut);
}

bindMenuBehavior();
bindDialogCloseButtons();
bindActions();
bindBrowserFileDropFallback();
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
