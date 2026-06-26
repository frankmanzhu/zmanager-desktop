import "./styles.css";
import {
  APP_TITLE,
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
  BROWSE_ACTION_PASSWORD_INVALID,
  BROWSE_ACTION_PASSWORD_REQUIRED,
  BROWSE_STATUS_EMPTY,
  BROWSE_STATUS_IDLE,
  BROWSE_STATUS_LOADING,
  BROWSE_STATUS_UNKNOWN,
  BROWSE_STATUS_READY,
  JOB_POLL_INTERVAL_MS,
} from "./app/constants";
import {
  escapeHtml as escapeHtmlValue,
  formatBytes as formatBytesValue,
  formatCompressionRatio,
  formatDate as formatDateValue,
  getPathBasename,
} from "./app/formatting";
import {
  buildArchiveTree,
  flattenArchiveTree,
  getArchiveBreadcrumbs,
  getParentArchivePath,
  normalizeArchivePath,
} from "./app/archiveTree";
import {
  CREATE_ARCHIVE_FILTERS,
  buildStartCreateRequest,
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
import { isSupportedArchivePath } from "./app/archiveFileTypes";
import {
  classifyDropIntent,
  type DropIntentSurface,
} from "./app/dropIntent";
import {
  canRetryJobWithPassword as canRetryJobWithPasswordState,
  createInitialJobState,
  getLatestPasswordFailureEvent,
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
  quickExtractDestination as buildQuickExtractDestination,
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
  listArchive as listArchiveCommand,
  pollJobEvents as pollJobEventsCommand,
  runPlanCreate,
  runPreviewEntry,
  runStartCreate,
  runStartExtract,
  runTestArchive,
} from "./api/commands";
import type {
  ArchiveEntryDto,
  BrowseState,
  CreatePlanResponse,
  CreateState,
  HealthcheckResponse,
  JobEventDto,
  JobKind,
  JobState,
  ProjectContract,
  QuickActionRequestDto,
  StartJobResponseDto,
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

type SortKey = "name" | "kind" | "size" | "compressedSize" | "modified" | "ratio";
type BrowserRow =
  | {
      rowType: "folder";
      path: string;
      name: string;
    }
  | {
      rowType: "entry";
      path: string;
      name: string;
      entry: ArchiveEntryDto;
    };
type ArchiveFixture = {
  archivePath: string;
  entries: ArchiveEntryDto[];
  totalSize?: number;
};

const ARCHIVE_OPEN_FILTER = {
  name: "Archives",
  extensions: ["zip", "zipx", "7z", "rar", "tar", "gz", "xz", "zst", "tzst", "tzap"],
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
    };
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("missing app root");
}
const appRoot = app;

function toolbarIcon(
  name: "open" | "new" | "add" | "extract" | "test" | "preview" | "info" | "jobs" | "settings",
): string {
  const paths = {
    open: '<path d="M3 6.5h4.2l1.3 1.5H13v6H3z" /><path d="M3 6.5V4h3.8l1.3 1.5H13V8" />',
    new: '<path d="M7.5 3v9" /><path d="M3 7.5h9" /><path d="M13.5 5v9H4.5" />',
    add: '<path d="M3 5.5h4.2L8.5 7H13v6H3z" /><path d="M8 8.5v3" /><path d="M6.5 10h3" />',
    extract: '<path d="M7.5 3v7" /><path d="M4.5 7.5l3 3 3-3" /><path d="M3 13h9" />',
    test: '<path d="M3.5 8l2.5 2.5 5.5-6" /><path d="M13 8a5.5 5.5 0 1 1-2-4.2" />',
    preview: '<path d="M2.5 8s2-3.5 5-3.5 5 3.5 5 3.5-2 3.5-5 3.5-5-3.5-5-3.5z" /><path d="M7.5 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />',
    info: '<path d="M7.5 13a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z" /><path d="M7.5 7v3" /><path d="M7.5 5h.01" />',
    jobs: '<path d="M3 4.5h9" /><path d="M3 7.5h9" /><path d="M3 10.5h6" />',
    settings: '<path d="M6.5 2.5h2l.4 1.5 1.3.5 1.4-.8 1 1.7-1.1 1.1.2 1.5 1.1 1.1-1 1.7-1.4-.8-1.3.5-.4 1.5h-2l-.4-1.5-1.3-.5-1.4.8-1-1.7 1.1-1.1-.2-1.5-1.1-1.1 1-1.7 1.4.8 1.3-.5z" /><path d="M7.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />',
  } satisfies Record<typeof name, string>;

  return `<svg class="tool-icon" aria-hidden="true" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

appRoot.innerHTML = `
  <main class="workspace" data-job-drawer="closed">
    <nav class="app-menu" aria-label="Application menu">
      <details class="menu">
        <summary>File</summary>
        <div class="menu-popover">
          <button id="menu-open" type="button">Open Archive...</button>
          <button id="menu-new" type="button">New Archive...</button>
        </div>
      </details>
      <details class="menu">
        <summary>Edit</summary>
        <div class="menu-popover">
          <button id="menu-select-all" type="button">Select Visible Entries</button>
          <button id="menu-clear-selection" type="button">Clear Selection</button>
        </div>
      </details>
      <details class="menu">
        <summary>View</summary>
        <div class="menu-popover">
          <button id="menu-focus-search" type="button">Search</button>
          <button id="menu-toggle-jobs" type="button">Jobs Drawer</button>
        </div>
      </details>
      <details class="menu">
        <summary>Archive</summary>
        <div class="menu-popover">
          <button id="menu-extract" type="button">Extract...</button>
          <button id="menu-test" type="button">Test Archive</button>
          <button id="menu-preview" type="button">Preview</button>
          <button id="menu-info" type="button">Info</button>
        </div>
      </details>
      <details class="menu">
        <summary>Tools</summary>
        <div class="menu-popover">
          <button id="menu-refresh" type="button">Refresh Listing</button>
          <button id="menu-preferences" type="button">Preferences</button>
        </div>
      </details>
      <details class="menu">
        <summary>Help</summary>
        <div class="menu-popover">
          <button id="menu-about" type="button">About ZManager</button>
        </div>
      </details>
    </nav>

    <header class="command-toolbar" role="toolbar" aria-label="Archive actions">
      <div class="toolbar-brand" aria-label="ZManager">
        ${toolbarIcon("new")}
        <span>ZManager</span>
      </div>
      <div class="toolbar-group">
        <button id="open-archive" class="tool-button" type="button" aria-keyshortcuts="Control+O">${toolbarIcon("open")}<span>Open</span></button>
        <button id="new-archive" class="tool-button" type="button" aria-keyshortcuts="Control+N">${toolbarIcon("new")}<span>New</span></button>
        <button id="add-archive" class="tool-button" type="button" disabled title="Adding to an existing archive is not supported yet">${toolbarIcon("add")}<span>Add</span></button>
      </div>
      <div class="toolbar-separator" aria-hidden="true"></div>
      <div class="toolbar-group">
        <button id="extract-toolbar" class="tool-button" type="button" disabled>${toolbarIcon("extract")}<span>Extract</span></button>
        <button id="test-archive" class="tool-button" type="button" disabled>${toolbarIcon("test")}<span>Test</span></button>
        <button id="preview-selected" class="tool-button" type="button" disabled>${toolbarIcon("preview")}<span>Preview</span></button>
        <button id="info-toolbar" class="tool-button" type="button" disabled>${toolbarIcon("info")}<span>Info</span></button>
      </div>
      <div class="toolbar-spacer"></div>
      <p id="workspace-status" class="workspace-status">Ready</p>
      <button id="preferences-toolbar" class="tool-button icon-only" type="button" aria-label="Preferences" title="Preferences">${toolbarIcon("settings")}</button>
      <button id="jobs-drawer-open" class="tool-button" type="button">${toolbarIcon("jobs")}<span>Jobs</span></button>
    </header>

    <section class="path-bar" aria-label="Archive location">
      <button id="nav-back" type="button" disabled>Back</button>
      <button id="nav-up" type="button" disabled>Up</button>
      <div id="path-crumbs" class="path-crumbs" aria-live="polite">${BROWSE_STATUS_EMPTY}</div>
      <label class="search-field">
        <span class="sr-only">Search entries</span>
        <input id="search-entries" type="search" placeholder="Search archive" aria-keyshortcuts="Control+F" disabled />
      </label>
      <label class="flat-toggle">
        <input id="flat-view-toggle" type="checkbox" disabled />
        <span>Flat</span>
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
            <h1>${APP_TITLE}</h1>
            <p id="browse-meta">${BROWSE_STATUS_READY}</p>
          </div>
          <button id="refresh-archive" type="button" disabled>Refresh</button>
        </div>
        <p id="browse-message" class="status status-idle">${BROWSE_STATUS_IDLE}</p>
        <div class="table-shell" tabindex="0">
          <table>
            <thead>
              <tr>
                <th class="selection-column">
                  <input id="select-all" type="checkbox" aria-label="Select visible entries" disabled />
                </th>
                <th data-sort-key="name">Name</th>
                <th data-sort-key="size">Size</th>
                <th data-sort-key="compressedSize">Packed</th>
                <th data-sort-key="kind">Type</th>
                <th data-sort-key="modified">Modified</th>
                <th data-sort-key="ratio">Ratio</th>
              </tr>
            </thead>
            <tbody id="entry-table-body">
              <tr>
                <td colspan="7" class="empty">${BROWSE_STATUS_EMPTY}</td>
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

    <footer class="status-bar">
      <span id="status-text">Ready.</span>
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
            <span>Destination</span>
            <div class="inline-field">
              <input id="extract-destination" type="text" placeholder="Select a destination folder" />
              <button id="browse-extract-destination" type="button">Choose</button>
            </div>
          </label>
          <div class="form-grid form-grid-compact">
            <label>
              <span>Overwrite policy</span>
              <select id="browse-overwrite">
                <option value="refuse">Refuse</option>
                <option value="replace">Replace</option>
                <option value="rename">Rename</option>
                <option value="ask">Ask</option>
              </select>
            </label>
            <label>
              <span>Optional password</span>
              <input id="browse-password" type="password" autocomplete="off" />
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
          <button id="extract-start" type="button">Start Extract</button>
          <button id="extract-cancel" type="button">Cancel</button>
        </div>
      </section>
    </div>

    <div id="create-dialog" class="dialog-backdrop" hidden>
      <section class="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div class="dialog-header">
          <div>
            <h2 id="create-title">Create Archive</h2>
            <p>Choose sources, destination, format, and review the plan.</p>
          </div>
          <button id="create-dialog-close" class="icon-button" type="button" aria-label="Close create dialog">Close</button>
        </div>
        <div class="dialog-body">
          <div class="source-controls">
            <button id="add-source-files" type="button">Add Files</button>
            <button id="add-source-folders" type="button">Add Folder</button>
            <button id="clear-sources" type="button">Clear</button>
          </div>
          <ul id="source-list" class="list-box"></ul>
          <div class="form-grid">
            <label>
              <span>Format</span>
              <select id="create-format">
                <option value="zip">ZIP</option>
                <option value="tarZst">TZST</option>
                <option value="tzap">TZAP</option>
                <option value="sevenZ">7Z</option>
              </select>
            </label>
            <label class="span-2">
              <span>Destination archive</span>
              <div class="inline-field">
                <input id="create-destination" type="text" placeholder="Choose output archive" />
                <button id="browse-create-destination" type="button">Choose</button>
              </div>
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
                <span>Optional password</span>
                <input id="create-password" type="password" autocomplete="off" />
              </label>
              <label>
                <span>Compression level</span>
                <input id="create-compression" type="number" min="0" max="22" placeholder="Optional" />
              </label>
              <label>
                <span>Volume size bytes</span>
                <input id="create-volume" type="number" min="0" placeholder="Optional" />
              </label>
            </div>
          </details>
          <div class="plan-header">
            <div>
              <h3>Plan</h3>
              <p id="create-plan-meta">Pick sources to generate an inclusion plan.</p>
            </div>
            <button id="run-plan" type="button" disabled>Refresh Plan</button>
          </div>
          <p id="create-plan-status" class="status status-idle">Plan status: idle.</p>
          <div id="create-plan-summary" class="summary-card">
            <p>No plan available yet.</p>
          </div>
        </div>
        <div class="dialog-actions">
          <button id="start-create" type="button" disabled>Create</button>
          <button id="create-cancel" type="button">Cancel</button>
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
        <div id="about-diagnostics" class="diagnostics"></div>
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
            <h2 id="preferences-title">Preferences</h2>
            <p>Defaults for quick create, extract, and preview behavior.</p>
          </div>
          <button id="preferences-dialog-close" class="icon-button" type="button" aria-label="Close preferences dialog">Close</button>
        </div>
        <div class="dialog-body">
          <div class="form-grid form-grid-compact">
            <label>
              <span>Default format</span>
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
              <span>Create output</span>
              <select id="pref-output-location">
                <option value="sourceFolder">Source folder</option>
                <option value="customFolder">Chosen folder</option>
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
          <label class="field-row">
            <span>Chosen output folder</span>
            <div class="inline-field">
              <input id="pref-custom-output" type="text" placeholder="Optional folder for new archives" />
              <button id="pref-choose-output" type="button">Choose</button>
            </div>
          </label>
          <div class="toggle-grid">
            <label class="toggle-line"><input id="pref-clean-source" type="checkbox" /> Clean source by default</label>
            <label class="toggle-line"><input id="pref-quick-open-extract" type="checkbox" /> Extract associated archives immediately when opened</label>
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
const statusElement = document.querySelector<HTMLParagraphElement>("#workspace-status")!;
const statusTextElement = document.querySelector<HTMLSpanElement>("#status-text")!;
const activeJobElement = document.querySelector<HTMLSpanElement>("#active-job-text")!;
const pathCrumbsElement = document.querySelector<HTMLDivElement>("#path-crumbs")!;
const treeContentElement = document.querySelector<HTMLDivElement>("#tree-content")!;
const detailsElement = document.querySelector<HTMLDivElement>("#details-content")!;

const openArchiveButton = document.querySelector<HTMLButtonElement>("#open-archive")!;
const newArchiveButton = document.querySelector<HTMLButtonElement>("#new-archive")!;
const addArchiveButton = document.querySelector<HTMLButtonElement>("#add-archive")!;
const extractToolbarButton = document.querySelector<HTMLButtonElement>("#extract-toolbar")!;
const testArchiveButton = document.querySelector<HTMLButtonElement>("#test-archive")!;
const previewSelectedButton = document.querySelector<HTMLButtonElement>("#preview-selected")!;
const infoToolbarButton = document.querySelector<HTMLButtonElement>("#info-toolbar")!;
const jobsDrawerOpenButton = document.querySelector<HTMLButtonElement>("#jobs-drawer-open")!;
const preferencesToolbarButton = document.querySelector<HTMLButtonElement>("#preferences-toolbar")!;
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive")!;
const navBackButton = document.querySelector<HTMLButtonElement>("#nav-back")!;
const navUpButton = document.querySelector<HTMLButtonElement>("#nav-up")!;
const flatViewToggle = document.querySelector<HTMLInputElement>("#flat-view-toggle")!;

const menuOpenButton = document.querySelector<HTMLButtonElement>("#menu-open")!;
const menuNewButton = document.querySelector<HTMLButtonElement>("#menu-new")!;
const menuSelectAllButton = document.querySelector<HTMLButtonElement>("#menu-select-all")!;
const menuClearSelectionButton = document.querySelector<HTMLButtonElement>("#menu-clear-selection")!;
const menuFocusSearchButton = document.querySelector<HTMLButtonElement>("#menu-focus-search")!;
const menuToggleJobsButton = document.querySelector<HTMLButtonElement>("#menu-toggle-jobs")!;
const menuExtractButton = document.querySelector<HTMLButtonElement>("#menu-extract")!;
const menuTestButton = document.querySelector<HTMLButtonElement>("#menu-test")!;
const menuPreviewButton = document.querySelector<HTMLButtonElement>("#menu-preview")!;
const menuInfoButton = document.querySelector<HTMLButtonElement>("#menu-info")!;
const menuRefreshButton = document.querySelector<HTMLButtonElement>("#menu-refresh")!;
const menuPreferencesButton = document.querySelector<HTMLButtonElement>("#menu-preferences")!;
const menuAboutButton = document.querySelector<HTMLButtonElement>("#menu-about")!;

const searchInput = document.querySelector<HTMLInputElement>("#search-entries")!;
const messageElement = document.querySelector<HTMLParagraphElement>("#browse-message")!;
const tableBody = document.querySelector<HTMLTableSectionElement>("#entry-table-body")!;
const metaElement = document.querySelector<HTMLParagraphElement>("#browse-meta")!;
const sortHeaders = Array.from(document.querySelectorAll<HTMLElement>("[data-sort-key]"));
const selectAllInput = document.querySelector<HTMLInputElement>("#select-all")!;

const extractDialog = document.querySelector<HTMLDivElement>("#extract-dialog")!;
const extractTitle = document.querySelector<HTMLHeadingElement>("#extract-title")!;
const extractDialogMessage = document.querySelector<HTMLParagraphElement>("#extract-dialog-message")!;
const extractStartButton = document.querySelector<HTMLButtonElement>("#extract-start")!;
const extractDestinationInput = document.querySelector<HTMLInputElement>("#extract-destination")!;
const browseExtractDestinationButton = document.querySelector<HTMLButtonElement>("#browse-extract-destination")!;
const browsePasswordInput = document.querySelector<HTMLInputElement>("#browse-password")!;
const browseOverwriteSelect = document.querySelector<HTMLSelectElement>("#browse-overwrite")!;
const browseStripInput = document.querySelector<HTMLInputElement>("#browse-strip-components")!;

const createDialog = document.querySelector<HTMLDivElement>("#create-dialog")!;
const addSourceFilesButton = document.querySelector<HTMLButtonElement>("#add-source-files")!;
const addSourceFoldersButton = document.querySelector<HTMLButtonElement>("#add-source-folders")!;
const clearSourcesButton = document.querySelector<HTMLButtonElement>("#clear-sources")!;
const sourceListElement = document.querySelector<HTMLUListElement>("#source-list")!;
const createFormatSelect = document.querySelector<HTMLSelectElement>("#create-format")!;
const createDestinationInput = document.querySelector<HTMLInputElement>("#create-destination")!;
const browseCreateDestinationButton = document.querySelector<HTMLButtonElement>("#browse-create-destination")!;
const createCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#create-clean-source")!;
const createPreserveMetadataCheckbox = document.querySelector<HTMLInputElement>("#create-preserve-metadata")!;
const createReplaceExistingCheckbox = document.querySelector<HTMLInputElement>("#create-replace-existing")!;
const createRespectGitignoreCheckbox = document.querySelector<HTMLInputElement>("#create-respect-gitignore")!;
const createPasswordInput = document.querySelector<HTMLInputElement>("#create-password")!;
const createCompressionInput = document.querySelector<HTMLInputElement>("#create-compression")!;
const createVolumeInput = document.querySelector<HTMLInputElement>("#create-volume")!;
const runPlanButton = document.querySelector<HTMLButtonElement>("#run-plan")!;
const createPlanMeta = document.querySelector<HTMLParagraphElement>("#create-plan-meta")!;
const createPlanStatus = document.querySelector<HTMLParagraphElement>("#create-plan-status")!;
const createPlanSummary = document.querySelector<HTMLDivElement>("#create-plan-summary")!;
const startCreateButton = document.querySelector<HTMLButtonElement>("#start-create")!;

const jobsListElement = document.querySelector<HTMLDivElement>("#jobs-list")!;
const refreshJobsButton = document.querySelector<HTMLButtonElement>("#refresh-jobs")!;
const jobDrawer = document.querySelector<HTMLElement>("#job-drawer")!;
const statusJobButton = document.querySelector<HTMLButtonElement>("#status-job-button")!;
const jobDrawerCloseButton = document.querySelector<HTMLButtonElement>("#job-drawer-close")!;
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
const preferencesQuickOpenExtractCheckbox = document.querySelector<HTMLInputElement>("#pref-quick-open-extract")!;
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
  quickOpenExtractCheckbox: preferencesQuickOpenExtractCheckbox,
  statusElement: preferencesStatusElement,
};
const infoDialog = document.querySelector<HTMLDivElement>("#info-dialog")!;
const infoDialogBody = document.querySelector<HTMLDivElement>("#info-dialog-body")!;
const infoTitle = document.querySelector<HTMLHeadingElement>("#info-title")!;

let currentArchivePath = "";
let currentArchiveFolder = "";
let browseState: BrowseState = "idle";
let browseError = "";
let browseEntries: ArchiveEntryDto[] = [];
let selectedEntries = new Set<string>();
let navigationHistory: string[] = [];
let sortKey: SortKey = "name";
let sortAscending = true;
let isFlatView = false;
let activeExtractMode: ExtractMode = "archive";
let contextEntryPath = "";
let contextSourcePath = "";

let createSources: string[] = [];
let createPlanState: CreateState = "idle";
let currentPlan: CreatePlanResponse | null = null;
let currentPlanError = "";
let planDebounce: number | null = null;
let appPreferences: AppPreferences = loadAppPreferences();
let createPlanRevision = 0;
let createSubmissionInFlight = false;
let dropUnlisten: (() => void) | null = null;

const jobs = new Map<string, JobState>();
const jobRetryContexts = new Map<string, JobRetryContext>();
const promptedPasswordRetryJobs = new Set<string>();
let pollTimer: number | null = null;
let pollInFlight = false;
let pollAgainRequested = false;
let latestHealthcheck: HealthcheckResponse | null = null;
let latestContract: ProjectContract | null = null;
let focusedBeforeDialog: HTMLElement | null = null;

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
  return formatDateValue(value, { emptyValue: value || "-" });
}

function formatRatio(entry: ArchiveEntryDto): string {
  return formatCompressionRatio(entry.size, entry.compressedSize, { fractionDigits: 0 });
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

function getParentPath(path: string): string {
  return getParentArchivePath(path) ?? "";
}

function suggestedCreateArchiveName(): string {
  return buildSuggestedCreateArchiveName(createSources, createFormatSelect.value as CreateArchiveFormat);
}

function joinNativePath(parentPath: string, childName: string): string {
  const trimmedParent = parentPath.trim().replace(/[\\/]+$/, "");
  if (!trimmedParent) {
    return childName;
  }
  const separator = trimmedParent.includes("\\") ? "\\" : "/";
  return `${trimmedParent}${separator}${childName}`;
}

function suggestedCreateArchiveDefaultPath(): string {
  const directory = defaultCreateDirectory(appPreferences);
  const name = suggestedCreateArchiveName();
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

function getKnownFolderPaths(): string[] {
  const tree = buildArchiveTree(browseEntries, { rootName: getArchiveName(currentArchivePath, APP_TITLE) });
  return flattenArchiveTree(tree).map((node) => node.path);
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
      folderRows.set(childPath, {
        rowType: "folder",
        path: childPath,
        name: parts[0],
      });
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

function compareOptionalNumbers(left?: number, right?: number): number {
  const leftValue = left ?? -1;
  const rightValue = right ?? -1;
  if (leftValue === rightValue) {
    return 0;
  }
  return leftValue < rightValue ? -1 : 1;
}

function sortBrowserRows(rows: BrowserRow[]): BrowserRow[] {
  return [...rows].sort((left, right) => {
    const direction = sortAscending ? 1 : -1;

    if (left.rowType !== right.rowType && sortKey === "name") {
      return left.rowType === "folder" ? -1 : 1;
    }

    if (sortKey === "name") {
      return direction * left.name.localeCompare(right.name);
    }

    if (sortKey === "kind") {
      const leftKind = left.rowType === "folder" ? "folder" : left.entry.kind;
      const rightKind = right.rowType === "folder" ? "folder" : right.entry.kind;
      return direction * leftKind.localeCompare(rightKind);
    }

    if (left.rowType === "folder" || right.rowType === "folder") {
      return left.rowType === "folder" ? -1 : 1;
    }

    if (sortKey === "size" || sortKey === "compressedSize") {
      return direction * compareOptionalNumbers(left.entry[sortKey], right.entry[sortKey]);
    }

    if (sortKey === "ratio") {
      const leftRatio = typeof left.entry.size === "number" && typeof left.entry.compressedSize === "number"
        ? left.entry.compressedSize / Math.max(left.entry.size, 1)
        : Number.POSITIVE_INFINITY;
      const rightRatio = typeof right.entry.size === "number" && typeof right.entry.compressedSize === "number"
        ? right.entry.compressedSize / Math.max(right.entry.size, 1)
        : Number.POSITIVE_INFINITY;
      return direction * (leftRatio === rightRatio ? 0 : leftRatio < rightRatio ? -1 : 1);
    }

    const leftModified = Date.parse(left.entry.modified ?? "");
    const rightModified = Date.parse(right.entry.modified ?? "");
    if (Number.isNaN(leftModified) && Number.isNaN(rightModified)) return 0;
    if (Number.isNaN(leftModified)) return direction;
    if (Number.isNaN(rightModified)) return -direction;
    if (leftModified === rightModified) return 0;
    return direction * (leftModified < rightModified ? -1 : 1);
  });
}

function visibleRows(): BrowserRow[] {
  return sortBrowserRows(buildBrowserRows());
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
  const hasOneSelection = selectedCount === 1;
  const canUseArchive = hasArchive && !isLoading && (browseState === "loaded" || browseState === "empty");
  const canListEntries = hasArchive && !isLoading && browseState === "loaded";

  searchInput.disabled = !canUseArchive;
  flatViewToggle.disabled = !canUseArchive;
  selectAllInput.disabled = !canListEntries || visibleRows().every((row) => row.rowType !== "entry");
  refreshArchiveButton.disabled = !hasArchive || isLoading;
  navBackButton.disabled = navigationHistory.length === 0;
  navUpButton.disabled = !currentArchiveFolder;

  extractToolbarButton.disabled = !canUseArchive || (selectedCount > 0 && !canListEntries);
  testArchiveButton.disabled = !canUseArchive;
  previewSelectedButton.disabled = !hasOneSelection || !canListEntries;
  infoToolbarButton.disabled = !canUseArchive;
  addArchiveButton.disabled = true;

  menuSelectAllButton.disabled = !canListEntries;
  menuClearSelectionButton.disabled = selectedCount === 0;
  menuExtractButton.disabled = extractToolbarButton.disabled;
  menuTestButton.disabled = testArchiveButton.disabled;
  menuPreviewButton.disabled = previewSelectedButton.disabled;
  menuInfoButton.disabled = infoToolbarButton.disabled;
  menuRefreshButton.disabled = refreshArchiveButton.disabled;
}

function updateMeta() {
  if (!currentArchivePath) {
    metaElement.textContent = BROWSE_STATUS_READY;
    return;
  }

  const folderLabel = currentArchiveFolder ? ` > ${currentArchiveFolder}` : "";
  metaElement.textContent = `${getArchiveName(currentArchivePath, APP_TITLE)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderPathBar() {
  if (!currentArchivePath) {
    pathCrumbsElement.textContent = BROWSE_STATUS_EMPTY;
    return;
  }

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
        <button type="button" data-tree-action="open">Open Archive</button>
        <button type="button" data-tree-action="create">Create Archive</button>
      </div>
    `;
    return;
  }

  const folders = getKnownFolderPaths();
  treeContentElement.innerHTML = folders
    .map((folder) => {
      const depth = folder ? folder.split("/").length : 0;
      const label = folder ? getBaseName(folder) : getArchiveName(currentArchivePath, APP_TITLE);
      return `
        <button
          class="tree-item ${folder === currentArchiveFolder ? "is-active" : ""}"
          type="button"
          data-tree-path="${escapeHtml(folder)}"
          style="--depth: ${depth}"
        >
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join("");
}

function renderBrowseRows() {
  if (browseState === "loading") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">${BROWSE_STATUS_LOADING}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (browseState === "error") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">${escapeHtml(browseError || BROWSE_STATUS_UNKNOWN)}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  if (!currentArchivePath) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">${BROWSE_STATUS_EMPTY}</td>
      </tr>
    `;
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
        <td colspan="7" class="empty">${emptyMessage}</td>
      </tr>
    `;
    selectAllInput.checked = false;
    selectAllInput.indeterminate = false;
    return;
  }

  const selectableRows = rows.filter((row) => row.rowType === "entry");
  const selectedVisibleCount = selectableRows.filter((row) => selectedEntries.has(row.path)).length;
  selectAllInput.checked = selectableRows.length > 0 && selectedVisibleCount === selectableRows.length;
  selectAllInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < selectableRows.length;

  const showFullPath = Boolean(searchInput.value.trim()) || isFlatView;
  tableBody.innerHTML = rows
    .map((row) => {
      if (row.rowType === "folder") {
        return `
          <tr class="folder-row" data-folder-path="${escapeHtml(row.path)}" tabindex="0" aria-label="Open folder ${escapeHtml(row.name)}">
            <td class="selection-column"></td>
            <td class="name-cell"><span class="row-primary">${escapeHtml(row.name)}</span></td>
            <td>-</td>
            <td>-</td>
            <td>Folder</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `;
      }

      const selected = selectedEntries.has(row.path);
      return `
        <tr
          class="${selected ? "is-selected" : ""}"
          data-entry-path="${escapeHtml(row.path)}"
          tabindex="0"
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
          <td class="name-cell">
            <span class="row-primary">${escapeHtml(row.name)}</span>
            ${showFullPath ? `<span class="row-secondary">${escapeHtml(row.entry.path)}</span>` : ""}
          </td>
          <td>${formatBytes(row.entry.size)}</td>
          <td>${formatBytes(row.entry.compressedSize)}</td>
          <td>${escapeHtml(row.entry.kind)}</td>
          <td>${escapeHtml(formatDate(row.entry.modified))}</td>
          <td>${formatRatio(row.entry)}</td>
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
        <h3>Ready</h3>
        <p>Open an archive or create a new one.</p>
        <div class="detail-actions">
          <button type="button" data-detail-action="open">Open Archive</button>
          <button type="button" data-detail-action="create">Create Archive</button>
        </div>
      </div>
    `;
    return;
  }

  if (selected.length === 0) {
    const totalSize = browseEntries.reduce((total, entry) => total + (entry.size ?? 0), 0);
    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3>${escapeHtml(getArchiveName(currentArchivePath, APP_TITLE))}</h3>
        <dl class="detail-list">
          <div><dt>Entries</dt><dd>${browseEntries.length}</dd></div>
          <div><dt>Total size</dt><dd>${formatBytes(totalSize)}</dd></div>
          <div><dt>Folder</dt><dd>${escapeHtml(currentArchiveFolder || "/")}</dd></div>
        </dl>
        <div class="detail-actions">
          <button type="button" data-detail-action="extract-all">Extract All</button>
          <button type="button" data-detail-action="test">Test Archive</button>
          <button type="button" data-detail-action="create">New Archive</button>
          <button type="button" data-detail-action="archive-info">Info</button>
        </div>
      </div>
    `;
    return;
  }

  if (selected.length === 1) {
    const entry = selected[0];
    detailsElement.innerHTML = `
      <div class="detail-block">
        <h3>${escapeHtml(getBaseName(entry.path))}</h3>
        <dl class="detail-list">
          <div><dt>Type</dt><dd>${escapeHtml(entry.kind)}</dd></div>
          <div><dt>Size</dt><dd>${formatBytes(entry.size)}</dd></div>
          <div><dt>Packed</dt><dd>${formatBytes(entry.compressedSize)}</dd></div>
          <div><dt>Modified</dt><dd>${escapeHtml(formatDate(entry.modified))}</dd></div>
          <div><dt>Path</dt><dd>${escapeHtml(entry.path)}</dd></div>
        </dl>
        <div class="detail-actions">
          <button type="button" data-detail-action="extract-selection">Extract</button>
          <button type="button" data-detail-action="preview">Preview</button>
          <button type="button" data-detail-action="entry-info">Info</button>
        </div>
      </div>
    `;
    return;
  }

  const selectedTotal = selected.reduce((total, entry) => total + (entry.size ?? 0), 0);
  detailsElement.innerHTML = `
    <div class="detail-block">
      <h3>${selected.length} entries selected</h3>
      <dl class="detail-list">
        <div><dt>Total size</dt><dd>${formatBytes(selectedTotal)}</dd></div>
      </dl>
      <div class="detail-actions">
        <button type="button" data-detail-action="extract-selection">Extract Selected</button>
        <button type="button" data-detail-action="clear-selection">Clear Selection</button>
      </div>
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

  if (browseState === "loaded" && selectedEntries.size > 0) {
    messageElement.textContent = `${selectedEntries.size} selected entries.`;
  }
}

function setCreatePlanState(state: CreateState, statusMessage = "") {
  createPlanState = state;
  currentPlanError = statusMessage;

  switch (state) {
    case "loading":
      createPlanStatus.textContent = "Plan status: loading...";
      createPlanStatus.className = "status status-loading";
      break;
    case "error":
      createPlanStatus.textContent = statusMessage || "Plan status: failed.";
      createPlanStatus.className = "status status-error";
      break;
    case "ready":
      createPlanStatus.textContent = "Plan status: ready.";
      createPlanStatus.className = "status status-loaded";
      break;
    default:
      createPlanStatus.textContent = "Plan status: idle.";
      createPlanStatus.className = "status status-idle";
  }

  runPlanButton.disabled = createSources.length === 0 || state === "loading";
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
  createPlanMeta.textContent = createSources.length
    ? `${createSources.length} source${createSources.length === 1 ? "" : "s"} selected.`
    : "Pick sources to generate an inclusion plan.";

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
      queuePlanRun();
    });
  }

  setCreatePlanState(createPlanState, currentPlanError);
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
  }
  focusedBeforeDialog?.focus();
  focusedBeforeDialog = null;
}

function openJobDrawer() {
  jobDrawer.setAttribute("aria-hidden", "false");
  workspaceElement.dataset.jobDrawer = "open";
  void pollJobs();
}

function closeJobDrawer() {
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
  if (!createDialog.hidden) {
    return "create";
  }
  return "browse";
}

function setDropOverlay(active: boolean, title = "Drop files", message = "Open an archive or add files to a new archive.") {
  workspaceElement.dataset.dropState = active ? "active" : "idle";
  dropOverlay.setAttribute("aria-hidden", active ? "false" : "true");
  dropOverlayTitle.textContent = title;
  dropOverlayMessage.textContent = message;
}

function dropCopyForSurface(surface: DropIntentSurface): { title: string; message: string } {
  if (surface === "create") {
    return {
      title: "Add sources",
      message: "Drop files or folders to add them to the new archive.",
    };
  }

  if (currentArchivePath) {
    return {
      title: "Open archive",
      message: "Drop another archive to browse it, or drop files to create a new archive.",
    };
  }

  return {
    title: "Open or create",
    message: "Drop an archive to browse it, or files and folders to create one.",
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
  if (createDialog.hidden) {
    openCreateDialog();
  }
  addSources(paths);
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

function bindBrowserFileDropFallback() {
  appRoot.addEventListener("dragover", (event) => {
    if (isDesktopRuntime()) {
      return;
    }
    event.preventDefault();
    setDropOverlayForSurface(currentDropSurface());
  });

  appRoot.addEventListener("dragleave", (event) => {
    if (isDesktopRuntime() || event.relatedTarget instanceof Node && appRoot.contains(event.relatedTarget)) {
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
      .map((file) => file.name)
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
  selectedEntries.clear();
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
  selectedEntries.clear();
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

function focusTableRow(row: HTMLTableRowElement | null) {
  if (!row) {
    return;
  }
  row.focus();
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
  renderBrowse();
  focusTableRow(tableBody.querySelector<HTMLTableRowElement>(`tr[data-entry-path="${CSS.escape(entryPath)}"]`));
}

function selectVisibleEntries() {
  for (const row of visibleRows()) {
    if (row.rowType === "entry") {
      selectedEntries.add(row.path);
    }
  }
  renderBrowse();
}

function clearBrowseSelection() {
  selectedEntries.clear();
  renderBrowse();
}

function showContextMenu(x: number, y: number, html: string) {
  contextMenu.innerHTML = html;
  contextMenu.hidden = false;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
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
  selectedEntries = new Set(
    browseEntries
      .filter((entry) => entry.kind !== "directory" && entryIsUnderFolder(entry.path, folderPath))
      .map((entry) => entry.path),
  );
  renderBrowse();
}

function showFolderContextMenu(folderPath: string, x: number, y: number) {
  contextEntryPath = "";
  contextSourcePath = "";
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="open-folder" data-folder-path="${escapeHtml(folderPath)}">Open Folder</button>
    <button type="button" role="menuitem" data-context-action="extract-folder" data-folder-path="${escapeHtml(folderPath)}">Extract Folder</button>
    <button type="button" role="menuitem" data-context-action="info">Info</button>
  `);
}

function showEntryContextMenu(entryPath: string, x: number, y: number) {
  contextEntryPath = entryPath;
  contextSourcePath = "";
  if (!selectedEntries.has(entryPath)) {
    selectedEntries = new Set([entryPath]);
    renderBrowse();
  }
  showContextMenu(x, y, `
    <button type="button" role="menuitem" data-context-action="preview">Preview</button>
    <button type="button" role="menuitem" data-context-action="extract">Extract Selected</button>
    <button type="button" role="menuitem" data-context-action="extract-here">Extract Here</button>
    <button type="button" role="menuitem" data-context-action="extract-all">Extract To...</button>
    <button type="button" role="menuitem" data-context-action="info">Info</button>
  `);
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

function hideContextMenu() {
  contextMenu.hidden = true;
  contextMenu.innerHTML = "";
  contextEntryPath = "";
  contextSourcePath = "";
}

function showArchiveInfo() {
  infoTitle.textContent = "Archive Info";
  const totalSize = browseEntries.reduce((total, entry) => total + (entry.size ?? 0), 0);
  const packedSize = browseEntries.reduce((total, entry) => total + (entry.compressedSize ?? 0), 0);
  infoDialogBody.innerHTML = `
    <dl class="detail-list">
      <div><dt>Archive</dt><dd>${escapeHtml(currentArchivePath || "-")}</dd></div>
      <div><dt>Entries</dt><dd>${browseEntries.length}</dd></div>
      <div><dt>Total size</dt><dd>${formatBytes(totalSize)}</dd></div>
      <div><dt>Packed size</dt><dd>${formatBytes(packedSize)}</dd></div>
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
  infoDialogBody.innerHTML = `
    <dl class="detail-list">
      <div><dt>Name</dt><dd>${escapeHtml(getBaseName(entry.path))}</dd></div>
      <div><dt>Path</dt><dd>${escapeHtml(entry.path)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(entry.kind)}</dd></div>
      <div><dt>Size</dt><dd>${formatBytes(entry.size)}</dd></div>
      <div><dt>Packed</dt><dd>${formatBytes(entry.compressedSize)}</dd></div>
      <div><dt>Modified</dt><dd>${escapeHtml(formatDate(entry.modified))}</dd></div>
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
      <div><dt>Quick open extraction</dt><dd>${appPreferences.quickOpenExtractionEnabled ? "enabled" : "disabled"}</dd></div>
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
  preferencesStatusElement.textContent = "Preferences saved.";
  preferencesStatusElement.className = "status status-success";
  applyCreatePreferenceDefaults();
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

function openCreateDialog() {
  applyCreatePreferenceDefaults();
  setCreatePlanState(createPlanState, currentPlanError);
  renderCreateSources();
  openModal(createDialog, "#add-source-files");
}

async function loadArchive(request: ListArchiveRequest) {
  let password = request.password?.trim();

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
        totalSize: listing.totalSize,
      });
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
      browsePasswordInput.value = password;
    }
  }
}

function loadArchiveListingIntoState(listing: ArchiveFixture) {
  currentArchivePath = listing.archivePath;
  currentArchiveFolder = "";
  navigationHistory = [];
  searchInput.value = "";
  isFlatView = false;
  flatViewToggle.checked = false;
  browseEntries = listing.entries;
  selectedEntries.clear();
  setBrowseState(listing.entries.length > 0 ? "loaded" : "empty", "Archive loaded.");

  messageElement.textContent = listing.entries.length > 0
    ? `Loaded ${listing.entries.length} entries.`
    : "Archive is valid but contains no entries.";

  renderBrowse();
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
        modified: "2026-06-10T10:00:00Z",
      },
      {
        path: "wedding/raw/photo01.jpg",
        kind: "file",
        size: 5_242_880,
        compressedSize: 3_145_728,
        modified: "2026-06-10T10:01:00Z",
      },
      {
        path: "wedding/raw/photo02.jpg",
        kind: "file",
        size: 6_291_456,
        compressedSize: 4_194_304,
        modified: "2026-06-10T10:02:00Z",
      },
      {
        path: "docs/readme.txt",
        kind: "file",
        size: 1_200,
        compressedSize: 600,
        modified: "2026-06-09T09:00:00Z",
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
  queuePlanRun();
}

function addJobState(response: StartJobResponseDto, retryContext?: JobRetryContext) {
  jobs.set(response.jobId, createInitialJobState(response));

  if (retryContext) {
    jobRetryContexts.set(response.jobId, retryContext);
  }

  schedulePolling();
  renderJobs();
  openJobDrawer();
}

async function startQuickCreate(paths: string[], format: CreateArchiveFormat, cleanSource: boolean) {
  const sources = uniqueQuickActionPaths(paths);
  if (!sources.length) {
    setOperationalStatus("Quick create needs at least one source.");
    return;
  }

  openCreateDialog();
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

  setOperationalStatus("Planning quick create...");
  await runPlan();
  if (createPlanState !== "ready" || currentPlan === null) {
    setOperationalStatus("Quick create needs review before it can start.");
    return;
  }

  await runCreate();
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

    const destinationPath = buildQuickExtractDestination(
      archivePath,
      action,
      { nativeParentPath, joinNativePath },
    );
    if (!destinationPath) {
      setOperationalStatus(`Choose a destination before extracting ${archivePath}.`);
      continue;
    }

    try {
      const response = await runStartExtract(buildStartExtractRequest({
        archivePath,
        destinationPath,
        overwrite: "rename",
        stripComponents: 0,
      }));
      addJobState(response, {
        retryKind: "extractArchive",
        archivePath,
        destinationPath,
        overwrite: "rename",
        stripComponents: 0,
      });
    } catch (error) {
      const commandError = asCommandError(error);
      setOperationalStatus(commandError?.message ?? `Unable to extract ${archivePath}.`);
      if (commandError?.hint) {
        setBrowseState("error", `${commandError.message}\n${commandError.hint}`);
      }
    }
  }
}

async function handleQuickActionRequest(request: QuickActionRequestDto) {
  await runQuickActionRequest(request, appPreferences, {
    startCreate: startQuickCreate,
    openExtractReview: openQuickExtractReview,
    startExtract: startQuickExtract,
  });
}

async function handleStartupQuickAction() {
  if (!isDesktopRuntime()) {
    return;
  }

  try {
    const state = await fetchQuickActionStartupState();
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

    if (state.quickAction) {
      setOperationalStatus("Starting quick action...");
      await handleQuickActionRequest(state.quickAction);
    }
  } catch (error) {
    setOperationalStatus(unknownErrorMessage(error, "Unable to read quick-action startup state."));
  }
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
        browsePasswordInput.value = password;
        continue;
      }

      setBrowseState("error", `${commandError.message}${commandError.hint ? `\n${commandError.hint}` : ""}`);
      return;
    }
  }
}

async function onRefreshArchive() {
  if (!currentArchivePath) {
    return;
  }

  await loadArchive({
    archivePath: currentArchivePath,
    ...(browsePasswordInput.value.trim() ? { password: browsePasswordInput.value.trim() } : {}),
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

  const destination = extractDestinationInput.value.trim();
  if (!destination) {
    extractDialogMessage.textContent = "Choose an extract destination folder first.";
    extractDestinationInput.focus();
    return;
  }

  const overwrite = getOverwritePolicyValue();
  const stripComponents = toNumberOrUndefined(browseStripInput.value) ?? 0;
  let password = browsePasswordInput.value.trim() || undefined;

  if (destinationMode === "archive") {
    while (true) {
      try {
        const response = await runStartExtract(buildStartExtractRequest({
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          stripComponents,
          password,
        }));
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
          browsePasswordInput.value = password;
          continue;
        }
        setBrowseState("error", commandError?.message ?? "Unable to start extraction.");
        return;
      }
    }
  }

  const entries = getSelectedEntryPaths();
  if (!entries.length) {
    extractDialogMessage.textContent = "Select at least one entry to extract.";
    return;
  }

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
        browsePasswordInput.value = password;
        continue;
      }
      setBrowseState("error", commandError?.message ?? "Unable to extract selected entries.");
      return;
    }
  }
}

async function onPreviewSelectedEntry() {
  if (!currentArchivePath) {
    return;
  }

  const selected = getSelectedEntryPaths();
  if (selected.length !== 1) {
    setBrowseState("error", "Select exactly one entry to preview.");
    return;
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
      setBrowseState("loaded", `Preview ready: ${formatBytes(response.writtenBytes)}.`);
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
        browsePasswordInput.value = password;
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
  setCreatePlanState(createPlanState, currentPlanError);
}

async function runCreate() {
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
      preserveMetadata,
      password: passwordValue,
      compressionLevel,
      volumeSize,
    });

    const response = await runStartCreate(request);

    createPasswordInput.value = "";
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

  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void onOpenArchive();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openCreateDialog();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (event.key === "F5") {
    event.preventDefault();
    void onRefreshArchive();
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

  if (isEditableTarget(event.target)) {
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
  openArchiveButton.addEventListener("click", () => void onOpenArchive());
  newArchiveButton.addEventListener("click", openCreateDialog);
  addArchiveButton.addEventListener("click", openCreateDialog);
  extractToolbarButton.addEventListener("click", () => openExtractDialog(selectedEntries.size ? "selection" : "archive"));
  testArchiveButton.addEventListener("click", () => void onTestArchive());
  previewSelectedButton.addEventListener("click", () => void onPreviewSelectedEntry());
  infoToolbarButton.addEventListener("click", showCurrentInfo);
  jobsDrawerOpenButton.addEventListener("click", openJobDrawer);
  preferencesToolbarButton.addEventListener("click", openPreferencesDialog);
  refreshArchiveButton.addEventListener("click", () => void onRefreshArchive());
  navBackButton.addEventListener("click", navigateBack);
  navUpButton.addEventListener("click", navigateUp);

  menuOpenButton.addEventListener("click", () => void onOpenArchive());
  menuNewButton.addEventListener("click", openCreateDialog);
  menuSelectAllButton.addEventListener("click", selectVisibleEntries);
  menuClearSelectionButton.addEventListener("click", clearBrowseSelection);
  menuFocusSearchButton.addEventListener("click", () => searchInput.focus());
  menuToggleJobsButton.addEventListener("click", toggleJobDrawer);
  menuExtractButton.addEventListener("click", () => openExtractDialog(selectedEntries.size ? "selection" : "archive"));
  menuTestButton.addEventListener("click", () => void onTestArchive());
  menuPreviewButton.addEventListener("click", () => void onPreviewSelectedEntry());
  menuInfoButton.addEventListener("click", showCurrentInfo);
  menuRefreshButton.addEventListener("click", () => void onRefreshArchive());
  menuPreferencesButton.addEventListener("click", openPreferencesDialog);
  menuAboutButton.addEventListener("click", () => {
    renderAboutDiagnostics();
    openModal(aboutDialog, "#about-close");
  });

  for (const button of [
    menuOpenButton,
    menuNewButton,
    menuSelectAllButton,
    menuClearSelectionButton,
    menuFocusSearchButton,
    menuToggleJobsButton,
    menuExtractButton,
    menuTestButton,
    menuPreviewButton,
    menuInfoButton,
    menuRefreshButton,
    menuPreferencesButton,
    menuAboutButton,
  ]) {
    button.addEventListener("click", () => closeOpenMenus());
  }

  searchInput.addEventListener("input", () => {
    renderBrowse();
  });

  flatViewToggle.addEventListener("change", () => {
    isFlatView = flatViewToggle.checked;
    renderBrowse();
  });

  selectAllInput.addEventListener("change", () => {
    const rows = visibleRows();
    if (selectAllInput.checked) {
      rows.forEach((row) => {
        if (row.rowType === "entry") {
          selectedEntries.add(row.path);
        }
      });
    } else {
      rows.forEach((row) => {
        if (row.rowType === "entry") {
          selectedEntries.delete(row.path);
        }
      });
    }
    renderBrowse();
  });

  for (const header of sortHeaders) {
    header.addEventListener("click", () => {
      const key = header.dataset.sortKey as SortKey | undefined;
      if (!key) {
        return;
      }

      if (key === sortKey) {
        sortAscending = !sortAscending;
      } else {
        sortKey = key;
        sortAscending = true;
      }

      renderBrowse();
    });
  }

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
      openCreateDialog();
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tree-path]");
    if (!target) {
      return;
    }
    navigateToFolder(target.dataset.treePath ?? "");
  });

  tableBody.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement) {
      return;
    }

    const row = target.closest<HTMLTableRowElement>("tr");
    const entryPath = row?.dataset.entryPath;
    if (!entryPath) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (selectedEntries.has(entryPath)) {
        selectedEntries.delete(entryPath);
      } else {
        selectedEntries.add(entryPath);
      }
    } else {
      selectedEntries = new Set([entryPath]);
    }
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
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      const x = rect.left + 24;
      const y = rect.top + Math.min(rect.height - 2, 24);
      const folderPath = row.dataset.folderPath;
      if (folderPath !== undefined) {
        showFolderContextMenu(folderPath, x, y);
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
      activateTableRow(row);
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

    renderBrowse();
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
      showFolderContextMenu(folderPath, event.clientX, event.clientY);
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
    const entryPath = contextEntryPath;
    const sourcePath = contextSourcePath;
    hideContextMenu();

    if (action === "open-folder" && folderPath !== undefined) {
      navigateToFolder(folderPath);
      return;
    }
    if (action === "extract-folder" && folderPath !== undefined) {
      selectFolderEntries(folderPath);
      openExtractDialog("selection");
      return;
    }
    if (action === "preview") {
      void onPreviewSelectedEntry();
      return;
    }
    if (action === "extract") {
      openExtractDialog("selection");
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
      queuePlanRun();
      return;
    }
    if (action === "clear-sources") {
      createSources = [];
      currentPlan = null;
      renderCreateSources();
      queuePlanRun();
    }
  });

  detailsElement.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-detail-action]");
    if (!target) {
      return;
    }

    switch (target.dataset.detailAction) {
      case "open":
        void onOpenArchive();
        break;
      case "create":
        openCreateDialog();
        break;
      case "extract-all":
        openExtractDialog("archive");
        break;
      case "extract-selection":
        openExtractDialog("selection");
        break;
      case "test":
        void onTestArchive();
        break;
      case "preview":
        void onPreviewSelectedEntry();
        break;
      case "entry-info": {
        const selected = getSelectedEntryDtos()[0];
        if (selected) {
          showEntryInfo(selected.path);
        }
        break;
      }
      case "archive-info":
        showArchiveInfo();
        break;
      case "clear-selection":
        clearBrowseSelection();
        break;
    }
  });

  browseExtractDestinationButton.addEventListener("click", () => void onSelectDestinationForExtract());
  extractStartButton.addEventListener("click", () => void startExtract(activeExtractMode));

  addSourceFilesButton.addEventListener("click", () => void addSourcePathsFromDialog("files"));
  addSourceFoldersButton.addEventListener("click", () => void addSourcePathsFromDialog("folder"));
  clearSourcesButton.addEventListener("click", () => {
    createSources = [];
    currentPlan = null;
    renderCreateSources();
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
  createDestinationInput.addEventListener("input", () => setCreatePlanState(createPlanState, currentPlanError));
  browseCreateDestinationButton.addEventListener("click", () => void onSelectCreateDestination());
  runPlanButton.addEventListener("click", () => void runPlan());
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
applyCreatePreferenceDefaults();
renderCreateSources();
setCreatePlanState("idle");
setBrowseState("idle", BROWSE_STATUS_IDLE);
renderBrowse();
renderJobs();
if (isLocalDevHost()) {
  window.__zmanagerDev = {
    loadArchiveFixture: loadArchiveListingIntoState,
  };
}
loadLocalDevFixtureFromUrl();
void loadBootstrapState();
void bindTauriFileDrop();
void handleStartupQuickAction();
