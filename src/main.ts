import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath as openWithOpener } from "@tauri-apps/plugin-opener";
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
  asCommandError,
  cancelJob as cancelJobCommand,
  dismissJob as dismissJobCommand,
  fetchHealthcheck,
  fetchProjectContract,
  listArchive as listArchiveCommand,
  pollJobEvents as pollJobEventsCommand,
  runExtractEntry,
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
  JobKind,
  JobState,
  ProjectContract,
  StartCreateRequest,
  StartJobResponseDto,
} from "./api/types";
import { ListArchiveRequest, PlanCreateRequest } from "./api/types";

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
type ExtractMode = "archive" | "selection";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("missing app root");
}
const appRoot = app;

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
      <div class="toolbar-group">
        <button id="open-archive" class="tool-button" type="button" aria-keyshortcuts="Control+O">Open</button>
        <button id="new-archive" class="tool-button" type="button" aria-keyshortcuts="Control+N">New</button>
        <button id="add-archive" class="tool-button" type="button">Add</button>
      </div>
      <div class="toolbar-separator" aria-hidden="true"></div>
      <div class="toolbar-group">
        <button id="extract-toolbar" class="tool-button" type="button" disabled>Extract</button>
        <button id="test-archive" class="tool-button" type="button" disabled>Test</button>
        <button id="preview-selected" class="tool-button" type="button" disabled>Preview</button>
        <button id="info-toolbar" class="tool-button" type="button" disabled>Info</button>
      </div>
      <div class="toolbar-spacer"></div>
      <p id="workspace-status" class="workspace-status">Ready</p>
      <button id="jobs-drawer-open" class="tool-button" type="button">Jobs</button>
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

const aboutDialog = document.querySelector<HTMLDivElement>("#about-dialog")!;
const aboutDiagnostics = document.querySelector<HTMLDivElement>("#about-diagnostics")!;
const copyDiagnosticsButton = document.querySelector<HTMLButtonElement>("#copy-diagnostics")!;
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

let createSources: string[] = [];
let createPlanState: CreateState = "idle";
let currentPlan: CreatePlanResponse | null = null;
let currentPlanError = "";
let planDebounce: number | null = null;

const jobs = new Map<string, JobState>();
let pollTimer: number | null = null;
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

function getArchiveName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.at(-1) ?? APP_TITLE;
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
  const tree = buildArchiveTree(browseEntries, { rootName: getArchiveName(currentArchivePath) });
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

function updateCommandState() {
  const hasArchive = Boolean(currentArchivePath);
  const isLoading = browseState === "loading";
  const selectedCount = selectedEntries.size;
  const hasOneSelection = selectedCount === 1;
  const canBrowse = hasArchive && !isLoading;

  searchInput.disabled = !canBrowse;
  flatViewToggle.disabled = !hasArchive;
  selectAllInput.disabled = !canBrowse || visibleRows().every((row) => row.rowType !== "entry");
  refreshArchiveButton.disabled = !hasArchive || isLoading;
  navBackButton.disabled = navigationHistory.length === 0;
  navUpButton.disabled = !currentArchiveFolder;

  extractToolbarButton.disabled = !hasArchive || isLoading || (selectedCount > 0 && browseState !== "loaded");
  testArchiveButton.disabled = !hasArchive || isLoading;
  previewSelectedButton.disabled = !hasOneSelection || !hasArchive;
  infoToolbarButton.disabled = !hasArchive;

  menuSelectAllButton.disabled = !canBrowse;
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
  metaElement.textContent = `${getArchiveName(currentArchivePath)}${folderLabel} - ${browseEntries.length} entries`;
}

function renderPathBar() {
  if (!currentArchivePath) {
    pathCrumbsElement.textContent = BROWSE_STATUS_EMPTY;
    return;
  }

  const crumbs = getArchiveBreadcrumbs(currentArchiveFolder, {
    rootName: getArchiveName(currentArchivePath),
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
      const label = folder ? getBaseName(folder) : getArchiveName(currentArchivePath);
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
          <tr class="folder-row" data-folder-path="${escapeHtml(row.path)}">
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
        <tr class="${selected ? "is-selected" : ""}" data-entry-path="${escapeHtml(row.path)}">
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
        <h3>${escapeHtml(getArchiveName(currentArchivePath))}</h3>
        <dl class="detail-list">
          <div><dt>Entries</dt><dd>${browseEntries.length}</dd></div>
          <div><dt>Total size</dt><dd>${formatBytes(totalSize)}</dd></div>
          <div><dt>Folder</dt><dd>${escapeHtml(currentArchiveFolder || "/")}</dd></div>
        </dl>
        <div class="detail-actions">
          <button type="button" data-detail-action="extract-all">Extract All</button>
          <button type="button" data-detail-action="test">Test Archive</button>
          <button type="button" data-detail-action="create">Add Files</button>
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
  startCreateButton.disabled =
    createSources.length === 0 || createDestinationInput.value.trim().length === 0 || state === "loading";
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
  const sortedJobs = Array.from(jobs.values()).sort((a, b) =>
    b.snapshot.createdAt.localeCompare(a.snapshot.createdAt),
  );
  const active = sortedJobs.find((state) =>
    state.snapshot.status === "queued" || state.snapshot.status === "running",
  ) ?? sortedJobs[0];

  if (!active) {
    activeJobElement.textContent = "No jobs";
    return;
  }

  activeJobElement.textContent = `${formatJobKind(active.snapshot.kind)}: ${active.snapshot.status}`;
}

function renderJobs() {
  if (!jobs.size) {
    jobsListElement.innerHTML = `
      <div class="job-empty">
        <strong>No running or terminal jobs.</strong>
        <span>Start create, extract, or test actions to watch progress.</span>
      </div>
    `;
    renderJobStatusBar();
    return;
  }

  const entries = Array.from(jobs.values()).sort((a, b) =>
    b.snapshot.createdAt.localeCompare(a.snapshot.createdAt),
  );

  jobsListElement.innerHTML = entries
    .map((state) => {
      const snapshot = state.snapshot;
      const summary = snapshot.terminalSummary;
      const recentEvents = state.events.slice(-12);
      return `
        <article class="job-card">
          <div class="job-header">
            <div>
              <p class="job-title">${escapeHtml(formatJobKind(snapshot.kind))}</p>
              <p class="job-subtitle">${snapshot.status.toUpperCase()} - ${escapeHtml(snapshot.jobId)}</p>
            </div>
            <div class="job-actions">
              ${snapshot.status === "queued" || snapshot.status === "running"
                ? `<button type="button" data-cancel="${escapeHtml(snapshot.jobId)}">Cancel</button>`
                : ""
              }
              ${snapshot.canDismiss ? `<button type="button" data-dismiss="${escapeHtml(snapshot.jobId)}">Dismiss</button>` : ""}
            </div>
          </div>
          <ul class="event-list">
            ${
              recentEvents.length
                ? recentEvents
                    .map(
                      (event) => `
                    <li>
                      <strong>${escapeHtml(event.eventType)}</strong>
                      ${event.path ? ` - ${escapeHtml(event.path)}` : ""}
                      ${typeof event.bytes === "number" ? ` - ${formatBytes(event.bytes)}` : ""}
                      ${typeof event.entries === "number" ? ` - ${event.entries} entries` : ""}
                      ${event.message ? ` - ${escapeHtml(event.message)}` : ""}
                    </li>
                  `,
                    )
                    .join("")
                : "<li class=empty>Waiting for updates...</li>"
            }
          </ul>
          <div class="job-summary">
            ${
              summary
                ? `
                  <p><strong>Written:</strong> ${summary.writtenEntries} entries, ${formatBytes(summary.writtenBytes)}</p>
                  ${
                    typeof summary.skippedEntries === "number"
                      ? `<p><strong>Skipped:</strong> ${summary.skippedEntries}</p>`
                      : ""
                  }
                  ${
                    summary.warnings.length
                      ? `<p><strong>Warnings:</strong> ${summary.warnings.length}</p>`
                      : ""
                  }
                `
                : "<p>No summary yet.</p>"
            }
          </div>
        </article>
      `;
    })
    .join("");

  renderJobStatusBar();
}

function queuePlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
  }

  if (createSources.length === 0) {
    currentPlan = null;
    setCreatePlanState("idle");
    createPlanSummary.innerHTML = "<p>No sources selected.</p>";
    return;
  }

  planDebounce = window.setTimeout(() => {
    void runPlan();
  }, 350);
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

function closeOpenMenus() {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(".menu[open]")) {
    menu.open = false;
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
}

function navigateBack() {
  const previous = navigationHistory.pop();
  if (previous === undefined) {
    return;
  }
  currentArchiveFolder = previous;
  selectedEntries.clear();
  renderBrowse();
}

function navigateUp() {
  if (!currentArchiveFolder) {
    return;
  }
  navigateToFolder(getParentPath(currentArchiveFolder));
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

function hideContextMenu() {
  contextMenu.hidden = true;
  contextMenu.innerHTML = "";
  contextEntryPath = "";
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
    </dl>
  `;
}

function diagnosticsText(): string {
  return JSON.stringify(
    {
      app: APP_TITLE,
      healthcheck: latestHealthcheck,
      contract: latestContract,
    },
    null,
    2,
  );
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

function openCreateDialog() {
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

      currentArchivePath = listing.archivePath;
      currentArchiveFolder = "";
      navigationHistory = [];
      browseEntries = listing.entries;
      selectedEntries.clear();
      setBrowseState(listing.entryCount > 0 ? "loaded" : "empty", "Archive loaded.");

      messageElement.textContent = listing.entryCount > 0
        ? `Loaded ${listing.entryCount} entries.`
        : "Archive is valid but contains no entries.";

      renderBrowse();
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

async function runPlan() {
  const request: PlanCreateRequest = {
    sources: [...createSources],
    cleanSource: createCleanSourceCheckbox.checked,
    respectGitignore: createRespectGitignoreCheckbox.checked,
    excludeNames: [],
    excludeArchivePaths: [],
    includeArchivePaths: [],
    followSymlinks: false,
  };

  setCreatePlanState("loading", "Planning selected sources...");

  try {
    const result = await runPlanCreate(request);

    currentPlan = result;
    createPlanSummary.innerHTML = formatPlanSummary(result);
    setCreatePlanState("ready", "Plan generated.");
  } catch (error) {
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
  renderCreateSources();
  queuePlanRun();
}

function addJobState(response: StartJobResponseDto) {
  jobs.set(response.jobId, {
    snapshot: {
      jobId: response.jobId,
      kind: response.kind,
      status: response.status,
      createdAt: response.createdAt,
      canDismiss: false,
      events: [],
      terminalSummary: null,
    },
    events: [],
  });
  schedulePolling();
  renderJobs();
  openJobDrawer();
}

async function pollJobs() {
  const pollableJobs = Array.from(jobs.values()).filter((state) => !state.snapshot.canDismiss);
  if (!pollableJobs.length) {
    stopPolling();
    renderJobs();
    return;
  }

  await Promise.all(
    pollableJobs.map(async (state) => {
      const jobId = state.snapshot.jobId;
      try {
        const snapshot = await pollJobEventsCommand({ jobId });

        const previous = jobs.get(jobId);
        const mergedEvents = [...(previous?.events ?? []), ...snapshot.events];
        jobs.set(jobId, {
          snapshot: {
            ...snapshot,
            terminalSummary: snapshot.terminalSummary ?? previous?.snapshot.terminalSummary ?? null,
          },
          events: mergedEvents,
        });
      } catch (error) {
        const commandError = asCommandError(error);
        if (commandError?.code === "not_found") {
          jobs.delete(jobId);
        }
      }
    }),
  );

  renderJobs();
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
  const selected = await openDialog({
    title: "Open archive",
    directory: false,
    multiple: false,
    filters: [
      {
        name: "Archives",
        extensions: ["zip", "7z", "rar", "tar", "gz", "xz", "zst", "tzst", "tzap"],
      },
    ],
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
      addJobState(response);
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
  const selected = await openDialog({
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
        const response = await runStartExtract({
          archivePath: currentArchivePath,
          destinationPath: destination,
          overwrite,
          stripComponents,
          ...(password ? { password } : {}),
        });
        closeModal(extractDialog);
        addJobState(response);
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

  closeModal(extractDialog);
  while (true) {
    try {
      let totalBytes = 0;
      let extractedCount = 0;
      for (const entryPath of entries) {
        const response = await runExtractEntry({
          archivePath: currentArchivePath,
          entryPath,
          destinationPath: destination,
          overwrite,
          stripComponents,
          ...(password ? { password } : {}),
        });
        totalBytes += response.writtenBytes;
        extractedCount += 1;
        setBrowseState("loaded", `${extractedCount} / ${entries.length} entries extracted.`);
      }

      const totalLabel = entries.length === extractedCount
        ? `${extractedCount} entries`
        : `${extractedCount} of ${entries.length} entries`;
      setBrowseState(
        "loaded",
        `Extracted ${totalLabel} (${formatBytes(totalBytes)}) to ${destination}.`,
      );
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

      await openWithOpener(response.previewPath);
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
  const selected = await openDialog({
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
  const selected = await openDialog({
    title: "Choose destination archive",
    directory: false,
    multiple: false,
    filters: [
      {
        name: "Archive",
        extensions: ["zip", "tzst", "tzap", "7z"],
      },
    ],
  });

  if (!selected || typeof selected !== "string") {
    return;
  }
  createDestinationInput.value = selected;
  setCreatePlanState(createPlanState, currentPlanError);
}

async function runCreate() {
  if (!createSources.length) {
    return;
  }

  const destinationPath = createDestinationInput.value.trim();
  if (!destinationPath) {
    setCreatePlanState("error", "Pick a destination archive path.");
    return;
  }

  const format = createFormatSelect.value as StartCreateRequest["format"];
  const cleanSource = createCleanSourceCheckbox.checked;
  const replaceExisting = createReplaceExistingCheckbox.checked;
  const preserveMetadata = createPreserveMetadataCheckbox.checked;
  const passwordValue = createPasswordInput.value.trim();
  const compressionLevel = parseNonNegativeInteger(createCompressionInput.value);
  const volumeSize = parseNonNegativeInteger(createVolumeInput.value);

  try {
    const request: StartCreateRequest = {
      sources: [...createSources],
      destinationPath,
      format,
      cleanSource,
      replaceExisting,
      preserveMetadata,
      ...(passwordValue ? { password: passwordValue } : {}),
      ...(compressionLevel !== undefined ? { compressionLevel } : {}),
      ...(volumeSize !== undefined ? { volumeSize } : {}),
    };

    const response = await runStartCreate(request);

    createPasswordInput.value = "";
    closeModal(createDialog);
    addJobState(response);
  } catch (error) {
    const commandError = asCommandError(error);
    setCreatePlanState("error", commandError?.message ?? "Unable to start create job.");
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
  } catch {
    latestHealthcheck = null;
    latestContract = null;
    setOperationalStatus("Ready in browser preview.");
    renderAboutDiagnostics();
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function handleShortcut(event: KeyboardEvent) {
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
    hideContextMenu();
    if (!extractDialog.hidden) closeModal(extractDialog);
    else if (!createDialog.hidden) closeModal(createDialog);
    else if (!aboutDialog.hidden) closeModal(aboutDialog);
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
    menuAboutButton,
  ]) {
    button.addEventListener("click", closeOpenMenus);
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
      showContextMenu(event.clientX, event.clientY, `
        <button type="button" data-context-action="open-folder" data-folder-path="${escapeHtml(folderPath)}">Open Folder</button>
      `);
      return;
    }

    const entryPath = row.dataset.entryPath;
    if (!entryPath) {
      return;
    }

    event.preventDefault();
    contextEntryPath = entryPath;
    if (!selectedEntries.has(entryPath)) {
      selectedEntries = new Set([entryPath]);
      renderBrowse();
    }
    showContextMenu(event.clientX, event.clientY, `
      <button type="button" data-context-action="preview">Preview</button>
      <button type="button" data-context-action="extract">Extract</button>
      <button type="button" data-context-action="info">Info</button>
    `);
  });

  contextMenu.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-context-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.contextAction;
    const folderPath = target.dataset.folderPath;
    hideContextMenu();

    if (action === "open-folder" && folderPath !== undefined) {
      navigateToFolder(folderPath);
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
    if (action === "info" && contextEntryPath) {
      showEntryInfo(contextEntryPath);
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

  createFormatSelect.addEventListener("change", queuePlanRun);
  createDestinationInput.addEventListener("input", () => setCreatePlanState(createPlanState, currentPlanError));
  browseCreateDestinationButton.addEventListener("click", () => void onSelectCreateDestination());
  runPlanButton.addEventListener("click", () => void runPlan());
  startCreateButton.addEventListener("click", () => void runCreate());

  for (const button of [
    createCleanSourceCheckbox,
    createPreserveMetadataCheckbox,
    createReplaceExistingCheckbox,
    createRespectGitignoreCheckbox,
  ]) {
    button.addEventListener("change", queuePlanRun);
  }

  jobsListElement.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const cancelId = target.dataset.cancel;
    const dismissId = target.dataset.dismiss;
    if (cancelId) {
      void onCancelJob(cancelId);
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

bindDialogCloseButtons();
bindActions();
renderCreateSources();
setCreatePlanState("idle");
setBrowseState("idle", BROWSE_STATUS_IDLE);
renderBrowse();
renderJobs();
void loadBootstrapState();
