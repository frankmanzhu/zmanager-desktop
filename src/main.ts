import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { open as openWithOpener } from "@tauri-apps/plugin-opener";
import "./styles.css";
import {
  APP_TITLE,
  COMMAND_INVALID_PASSWORD,
  COMMAND_PASSWORD_REQUIRED,
  JOB_POLL_INTERVAL_MS,
} from "./app/constants";
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
  CreatePlanResponse,
  JobEventDto,
  JobKind,
  JobState,
  BrowseState,
  CreateState,
  StartCreateRequest,
  StartJobResponseDto,
} from "./api/types";
import { ListArchiveRequest, PlanCreateRequest } from "./api/types";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("missing app root");
}

app.innerHTML = `
  <main class="workspace">
    <header class="topbar">
      <div>
        <h1>${APP_TITLE}</h1>
        <p id="engine-status">Checking engine...</p>
      </div>
      <div class="toolbar" role="toolbar" aria-label="Archive actions">
        <button id="open-archive" type="button">Open Archive</button>
        <button id="test-archive" type="button" disabled>Test Archive</button>
        <button id="jobs-tab-open" type="button">View Jobs</button>
      </div>
    </header>

    <section class="shell">
      <nav class="tabs" aria-label="Workspace">
        <button class="tab is-active" type="button" data-panel="browse-panel">Browse</button>
        <button class="tab" type="button" data-panel="create-panel">Create</button>
        <button class="tab" type="button" data-panel="jobs-panel">Jobs</button>
        <button class="tab" type="button" data-panel="settings-panel">Settings</button>
      </nav>

      <section id="browse-panel" class="panel is-active" aria-label="Archive browser">
        <div class="panel-header">
          <div>
            <h2>Archive Browser</h2>
            <p id="browse-meta">Open an archive to list entries through zmanager-core.</p>
          </div>
          <div class="browse-controls">
            <label class="field-inline">
              <span>Search</span>
              <input id="search-entries" class="search" type="search" placeholder="Filter entries" disabled />
            </label>
            <label class="field-inline">
              <span>Overwrite</span>
              <select id="browse-overwrite">
                <option value="refuse">Refuse</option>
                <option value="replace">Replace</option>
                <option value="rename">Rename</option>
                <option value="ask">Ask</option>
              </select>
            </label>
            <label class="field-inline">
              <span>Strip components</span>
              <input id="browse-strip-components" type="number" min="0" max="8" value="0" />
            </label>
            <label class="field-inline">
              <span>Password</span>
              <input id="browse-password" type="password" autocomplete="off" placeholder="Optional" />
            </label>
          </div>
        </div>

        <p id="browse-message" class="status status-idle">No archive selected.</p>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>
                  <input id="select-all" type="checkbox" aria-label="Select all entries" />
                </th>
                <th data-sort-key="path">Path</th>
                <th data-sort-key="kind">Type</th>
                <th data-sort-key="size">Size</th>
                <th data-sort-key="compressedSize">Packed</th>
                <th data-sort-key="modified">Modified</th>
              </tr>
            </thead>
            <tbody id="entry-table-body">
              <tr>
                <td colspan="6" class="empty">Choose an archive to begin.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="browse-actions">
          <button id="refresh-archive" type="button" disabled>Refresh Listing</button>
          <button id="extract-selected" type="button" disabled>Extract Selected</button>
          <button id="extract-all" type="button" disabled>Extract Archive</button>
          <button id="preview-selected" type="button" disabled>Preview Selected</button>
          <label class="destination-field">
            <span>Extract destination</span>
            <input id="extract-destination" type="text" placeholder="Select a destination folder" />
          </label>
          <button id="browse-extract-destination" type="button">Choose destination folder</button>
        </div>
      </section>

      <section id="create-panel" class="panel" aria-label="Create archive">
        <div class="panel-header">
          <div>
            <h2>Create Archive</h2>
            <p>Build ZIP, TZST, TZAP, and 7z jobs in the Rust core engine.</p>
          </div>
          <button id="start-create" type="button" disabled>Create</button>
        </div>

        <div class="form-grid">
          <label>
            <span>Source paths</span>
            <div class="source-controls">
              <button id="add-source-files" type="button">Add Files</button>
              <button id="add-source-folders" type="button">Add Folder</button>
              <button id="clear-sources" type="button">Clear</button>
            </div>
            <ul id="source-list" class="list-box"></ul>
          </label>
          <label>
            <span>Format</span>
            <select id="create-format">
              <option value="zip">ZIP</option>
              <option value="tarZst">TZST</option>
              <option value="tzap">TZAP</option>
              <option value="sevenZ">7Z</option>
            </select>
          </label>
          <label>
            <span>Destination archive</span>
            <input id="create-destination" type="text" placeholder="/path/to/output.zip" />
          </label>

          <label>
            <span>Plan/quality</span>
            <div class="toggle-grid">
              <label class="toggle-line"><input id="create-clean-source" type="checkbox" /> Clean source</label>
              <label class="toggle-line"><input id="create-preserve-metadata" type="checkbox" checked /> Preserve metadata</label>
              <label class="toggle-line"><input id="create-replace-existing" type="checkbox" /> Replace existing</label>
              <label class="toggle-line"><input id="create-respect-gitignore" type="checkbox" /> Respect .gitignore</label>
            </div>
          </label>
          <label>
            <span>Password</span>
            <input id="create-password" type="password" autocomplete="off" />
          </label>
          <label>
            <span>Compression (optional)</span>
            <input id="create-compression" type="number" min="0" max="22" placeholder="e.g. 6" />
          </label>
          <label>
            <span>Volume size bytes (optional)</span>
            <input id="create-volume" type="number" min="0" placeholder="e.g. 33554432" />
          </label>
          <button id="browse-create-destination" type="button">Choose archive file</button>
        </div>

        <div class="panel-header">
          <div>
            <h3>Plan</h3>
            <p id="create-plan-meta">Pick sources to generate an inclusion plan.</p>
          </div>
          <button id="run-plan" type="button" disabled>Refresh plan</button>
        </div>

        <p id="create-plan-status" class="status status-idle">Plan status: idle.</p>
        <div id="create-plan-summary" class="summary-card">
          <p>No plan available yet.</p>
        </div>
      </section>

      <section id="jobs-panel" class="panel" aria-label="Jobs">
        <div class="panel-header">
          <div>
            <h2>Jobs</h2>
            <p>Live extract/create/test jobs and terminal summaries.</p>
          </div>
          <button id="refresh-jobs" type="button">Refresh now</button>
        </div>
        <div id="jobs-list" class="jobs-list"></div>
      </section>

      <section id="settings-panel" class="panel" aria-label="Settings">
        <div class="panel-header">
          <div>
            <h2>Settings</h2>
            <p>Safe preferences only. Passwords must never persist.</p>
          </div>
        </div>
        <div id="contract" class="contract"></div>
      </section>
    </section>
  </main>
`;

const statusElement = document.querySelector<HTMLParagraphElement>("#engine-status");
const contractElement = document.querySelector<HTMLDivElement>("#contract");

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));

const openArchiveButton = document.querySelector<HTMLButtonElement>("#open-archive");
const testArchiveButton = document.querySelector<HTMLButtonElement>("#test-archive");
const jobsTabOpenButton = document.querySelector<HTMLButtonElement>("#jobs-tab-open");
const refreshArchiveButton = document.querySelector<HTMLButtonElement>("#refresh-archive");

const searchInput = document.querySelector<HTMLInputElement>("#search-entries");
const messageElement = document.querySelector<HTMLDivElement>("#browse-message");
const tableBody = document.querySelector<HTMLTableSectionElement>("#entry-table-body");
const metaElement = document.querySelector<HTMLParagraphElement>("#browse-meta");
const sortHeaders = Array.from(
  document.querySelectorAll<HTMLElement>("#browse-panel [data-sort-key]"),
);

const selectAllInput = document.querySelector<HTMLInputElement>("#select-all");
const extractSelectedButton = document.querySelector<HTMLButtonElement>("#extract-selected");
const extractAllButton = document.querySelector<HTMLButtonElement>("#extract-all");
const previewSelectedButton = document.querySelector<HTMLButtonElement>("#preview-selected");
const extractDestinationInput = document.querySelector<HTMLInputElement>("#extract-destination");
const browseExtractDestinationButton = document.querySelector<HTMLButtonElement>("#browse-extract-destination");
const browsePasswordInput = document.querySelector<HTMLInputElement>("#browse-password");
const browseOverwriteSelect = document.querySelector<HTMLSelectElement>("#browse-overwrite");
const browseStripInput = document.querySelector<HTMLInputElement>("#browse-strip-components");

const addSourceFilesButton = document.querySelector<HTMLButtonElement>("#add-source-files");
const addSourceFoldersButton = document.querySelector<HTMLButtonElement>("#add-source-folders");
const clearSourcesButton = document.querySelector<HTMLButtonElement>("#clear-sources");
const sourceListElement = document.querySelector<HTMLUListElement>("#source-list");
const createFormatSelect = document.querySelector<HTMLSelectElement>("#create-format");
const createDestinationInput = document.querySelector<HTMLInputElement>("#create-destination");
const browseCreateDestinationButton = document.querySelector<HTMLButtonElement>("#browse-create-destination");
const createCleanSourceCheckbox = document.querySelector<HTMLInputElement>("#create-clean-source");
const createPreserveMetadataCheckbox = document.querySelector<HTMLInputElement>("#create-preserve-metadata");
const createReplaceExistingCheckbox = document.querySelector<HTMLInputElement>("#create-replace-existing");
const createRespectGitignoreCheckbox = document.querySelector<HTMLInputElement>("#create-respect-gitignore");
const createPasswordInput = document.querySelector<HTMLInputElement>("#create-password");
const createCompressionInput = document.querySelector<HTMLInputElement>("#create-compression");
const createVolumeInput = document.querySelector<HTMLInputElement>("#create-volume");
const runPlanButton = document.querySelector<HTMLButtonElement>("#run-plan");
const createPlanStatus = document.querySelector<HTMLParagraphElement>("#create-plan-status");
const createPlanSummary = document.querySelector<HTMLDivElement>("#create-plan-summary");
const startCreateButton = document.querySelector<HTMLButtonElement>("#start-create");

const jobsListElement = document.querySelector<HTMLDivElement>("#jobs-list");
const refreshJobsButton = document.querySelector<HTMLButtonElement>("#refresh-jobs");

if (
  !openArchiveButton ||
  !testArchiveButton ||
  !jobsTabOpenButton ||
  !refreshArchiveButton ||
  !searchInput ||
  !messageElement ||
  !tableBody ||
  !metaElement ||
  !selectAllInput ||
  !extractSelectedButton ||
  !extractAllButton ||
  !previewSelectedButton ||
  !extractDestinationInput ||
  !browseExtractDestinationButton ||
  !browsePasswordInput ||
  !browseOverwriteSelect ||
  !browseStripInput ||
  !addSourceFilesButton ||
  !addSourceFoldersButton ||
  !clearSourcesButton ||
  !sourceListElement ||
  !createFormatSelect ||
  !createDestinationInput ||
  !browseCreateDestinationButton ||
  !createCleanSourceCheckbox ||
  !createPreserveMetadataCheckbox ||
  !createReplaceExistingCheckbox ||
  !createRespectGitignoreCheckbox ||
  !createPasswordInput ||
  !createCompressionInput ||
  !createVolumeInput ||
  !runPlanButton ||
  !createPlanStatus ||
  !createPlanSummary ||
  !startCreateButton ||
  !jobsListElement ||
  !refreshJobsButton
) {
  throw new Error("required workspace nodes missing");
}

let currentArchivePath = "";
let browseState: BrowseState = "idle";
let browseError = "";
let browseEntries: ArchiveEntryDto[] = [];
let selectedEntries = new Set<string>();
let sortKey: keyof Pick<ArchiveEntryDto, "path" | "kind" | "size" | "compressedSize" | "modified"> = "path";
let sortAscending = true;

let createSources: string[] = [];
let createPlanState: CreateState = "idle";
let currentPlan: CreatePlanResponse | null = null;
let currentPlanError = "";
let planDebounce: number | null = null;

const jobs = new Map<string, JobState>();
let pollTimer: number | null = null;

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const targetPanel = tab.dataset.panel;
    for (const candidate of tabs) {
      candidate.classList.toggle("is-active", candidate === tab);
    }
    for (const panel of panels) {
      panel.classList.toggle("is-active", panel.id === targetPanel);
    }
  });
}

jobsTabOpenButton.addEventListener("click", () => {
  const target = document.querySelector<HTMLButtonElement>(".tab[data-panel=\"jobs-panel\"]");
  if (target) {
    target.click();
  }
});

function formatBytes(value?: number): string {
  if (typeof value !== "number") {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB", "PB"];
  let scaled = value;
  let unitIndex = -1;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled = scaled / 1024;
    unitIndex += 1;
  }

  return `${scaled.toFixed(1)} ${units[unitIndex] ?? "B"}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (source) => {
    switch (source) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return source;
    }
  });
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

function setBrowseState(next: BrowseState, message = "") {
  browseState = next;
  browseError = message;
  messageElement.className = `status ${next === "loaded" ? "status-empty" : `status-${next}`}`;
  if (message) {
    messageElement.textContent = message;
  }

  const canInteract = next === "loaded" || next === "empty" || next === "error";
  searchInput.disabled = !canInteract;
  refreshArchiveButton.disabled = !currentArchivePath || next === "loading";
  testArchiveButton.disabled = !currentArchivePath || next === "loading";
  extractAllButton.disabled = !currentArchivePath || next !== "loaded";
  extractSelectedButton.disabled = selectedEntries.size === 0 || !currentArchivePath;
  previewSelectedButton.disabled = selectedEntries.size !== 1 || !currentArchivePath;
  extractDestinationInput.disabled = next === "loading";
  browseExtractDestinationButton.disabled = false;
}

function promptForArchivePassword(promptMessage: string): string | null {
  const value = window.prompt(promptMessage);
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sortedEntries(): ArchiveEntryDto[] {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? browseEntries.filter((entry) => entry.path.toLowerCase().includes(query))
    : browseEntries;

  return [...filtered].sort((left, right) => {
    const direction = sortAscending ? 1 : -1;

    if (sortKey === "path" || sortKey === "kind") {
      const leftValue = (sortKey === "path" ? left.path : left.kind).toLowerCase();
      const rightValue = (sortKey === "path" ? right.path : right.kind).toLowerCase();
      return direction * leftValue.localeCompare(rightValue);
    }

    if (sortKey === "size") {
      const leftValue = left.size ?? -1;
      const rightValue = right.size ?? -1;
      if (leftValue === rightValue) return 0;
      return direction * (leftValue < rightValue ? -1 : 1);
    }

    if (sortKey === "compressedSize") {
      const leftValue = left.compressedSize ?? -1;
      const rightValue = right.compressedSize ?? -1;
      if (leftValue === rightValue) return 0;
      return direction * (leftValue < rightValue ? -1 : 1);
    }

    const leftModified = Date.parse(left.modified ?? "");
    const rightModified = Date.parse(right.modified ?? "");

    if (Number.isNaN(leftModified) && Number.isNaN(rightModified)) return 0;
    if (Number.isNaN(leftModified)) return direction;
    if (Number.isNaN(rightModified)) return -direction;
    if (leftModified === rightModified) return 0;
    return direction * (leftModified < rightModified ? -1 : 1);
  });
}

function updateMeta() {
  if (!currentArchivePath) {
    metaElement.textContent = "Open an archive to list entries through zmanager-core.";
    return;
  }

  const count = browseEntries.length;
  metaElement.textContent = `${currentArchivePath} • ${count} entries`;
}

function renderBrowseRows() {
  if (browseState === "loading") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Loading archive entries…</td>
      </tr>
    `;
    return;
  }

  const entries = sortedEntries();

  if (browseState === "error") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">${browseError || "Failed to load archive."}</td>
      </tr>
    `;
    return;
  }

  if (!currentArchivePath) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Choose an archive to begin.</td>
      </tr>
    `;
    return;
  }

  if (!entries.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">This archive has no entries.</td>
      </tr>
    `;
    return;
  }

  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedEntries.has(entry.path));
  selectAllInput.checked = allVisibleSelected;

  tableBody.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>
            <input
              data-entry-path="${escapeHtml(entry.path)}"
              type="checkbox"
              ${selectedEntries.has(entry.path) ? "checked" : ""}
            />
          </td>
          <td>${escapeHtml(entry.path)}</td>
          <td>${escapeHtml(entry.kind)}</td>
          <td>${formatBytes(entry.size)}</td>
          <td>${formatBytes(entry.compressedSize)}</td>
          <td>${escapeHtml(entry.modified ?? "—")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderBrowse() {
  renderBrowseRows();
  updateMeta();

  const selectedCount = selectedEntries.size;
  if (browseState === "loaded" && selectedCount > 0) {
    messageElement.textContent = `${selectedCount} selected entries`; 
  }
}

function setCreatePlanState(state: CreateState, statusMessage = "") {
  createPlanState = state;
  currentPlanError = statusMessage;

  switch (state) {
    case "loading":
      createPlanStatus.textContent = "Plan status: loading…";
      createPlanStatus.className = "status status-loading";
      break;
    case "error":
      createPlanStatus.textContent = statusMessage || "Plan status: failed";
      createPlanStatus.className = "status status-error";
      break;
    case "ready":
      createPlanStatus.textContent = "Plan status: ready";
      createPlanStatus.className = "status status-empty";
      break;
    default:
      createPlanStatus.textContent = "Plan status: idle.";
      createPlanStatus.className = "status status-idle";
  }

  runPlanButton.disabled = createSources.length === 0;
  startCreateButton.disabled =
    createSources.length === 0 || createDestinationInput.value.trim().length === 0;
}

function formatPlanSummary(plan: CreatePlanResponse): string {
  const warnings =
    plan.warnings.length > 0
      ? `<ul>${plan.warnings.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
      : "<p>No warnings.</p>";

  const sampleRows = plan.entries
    .slice(0, 6)
    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
    .join("");

  return `
    <div class="plan-grid">
      <p><strong>Included:</strong> ${plan.includedCount} entries • ${formatBytes(plan.totalBytes)}</p>
      <p><strong>Excluded:</strong> ${plan.excludedCount} entries • ${formatBytes(plan.excludedBytes)}</p>
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
  if (createSources.length === 0) {
    sourceListElement.innerHTML = `<li class="empty">No sources yet.</li>`;
  } else {
  sourceListElement.innerHTML = createSources
      .map(
        (path) => `
          <li data-source-path="${escapeHtml(path)}">
            <span>${escapeHtml(path)}</span>
            <button type="button" data-source-remove>remove</button>
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
      selectedEntries.clear();
      renderCreateSources();
      queuePlanRun();
    });
  }
}

function renderJobs() {
  if (!jobs.size) {
    jobsListElement.innerHTML = `
      <div class="job-empty">
        <strong>No running or terminal jobs.</strong>
        <span>Start create/extract/test actions to watch job progress.</span>
      </div>
    `;
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
              <p class="job-title">${escapeHtml(formatJobKind(snapshot.kind))} • ${escapeHtml(snapshot.jobId)}</p>
              <p class="job-subtitle">${snapshot.status.toUpperCase()} • ${escapeHtml(snapshot.createdAt)}</p>
            </div>
            <div class="job-actions">
              ${snapshot.status === "queued" || snapshot.status === "running"
                ? `<button type="button" data-cancel="${snapshot.jobId}">Cancel</button>`
                : ""
              }
              ${snapshot.canDismiss ? `<button type="button" data-dismiss="${snapshot.jobId}">Dismiss</button>` : ""}
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
                      ${event.path ? ` · ${escapeHtml(event.path)}` : ""}
                      ${typeof event.bytes === "number" ? ` · ${formatBytes(event.bytes)}` : ""}
                      ${typeof event.entries === "number" ? ` · ${event.entries} entries` : ""}
                      ${event.message ? ` · ${escapeHtml(event.message)}` : ""}
                    </li>
                  `,
                    )
                    .join("")
                : "<li class=empty>Waiting for updates…</li>"
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
}

function queuePlanRun() {
  if (planDebounce !== null) {
    clearTimeout(planDebounce);
  }

  if (createSources.length === 0) {
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

async function loadArchive(request: ListArchiveRequest) {
  let password = request.password?.trim();

  while (true) {
    const requestPayload: ListArchiveRequest = {
      archivePath: request.archivePath,
      ...(password ? { password } : {}),
    };

    setBrowseState("loading", "Loading archive entries…");
    renderBrowse();

    try {
      const listing = await listArchiveCommand(requestPayload);

      currentArchivePath = listing.archivePath;
      browseEntries = listing.entries;
      selectedEntries.clear();
      setBrowseState(listing.entryCount > 0 ? "loaded" : "empty", "Archive loaded.");

      if (listing.totalSize !== undefined) {
        messageElement.textContent = `${listing.entryCount} entries`;
      } else {
        messageElement.textContent = listing.entryCount > 0
          ? `Loaded ${listing.entryCount} entries.`
          : "Archive is valid but contains no entries.";
      }

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

      const promptMessage =
        commandError.code === COMMAND_PASSWORD_REQUIRED
          ? "This archive is password-protected. Enter a password to continue."
          : "Invalid password. Enter the archive password again.";
      const nextPassword = promptForArchivePassword(promptMessage);
      if (!nextPassword) {
        setBrowseState("error", commandError.message);
        renderBrowse();
        return;
      }
      password = nextPassword;
      browsePasswordInput.value = password;
      continue;
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

  setCreatePlanState("loading", "Planning selected sources…");

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
}

async function pollJobs() {
  const pollableJobs = Array.from(jobs.values()).filter((state) => !state.snapshot.canDismiss);
  if (!pollableJobs.length) {
    stopPolling();
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

function toNumberOrUndefined(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : Math.trunc(parsed);
}

async function onOpenArchive() {
  const selected = await openDialog({
    title: "Open archive",
    directory: false,
    multiple: false,
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

      const jobsTab = document.querySelector<HTMLButtonElement>(".tab[data-panel=\"jobs-panel\"]");
      if (jobsTab) {
        jobsTab.click();
      }
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
        const promptMessage =
          commandError.code === COMMAND_PASSWORD_REQUIRED
            ? "This archive is password-protected. Enter password to continue."
            : "Invalid password. Enter the archive password again.";
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

function getSelectedEntryPaths(): string[] {
  return [...selectedEntries];
}

async function startExtract(destinationMode: "archive" | "selection") {
  if (!currentArchivePath) {
    return;
  }

  const destination = extractDestinationInput.value.trim();
  if (!destination) {
    setBrowseState("error", "Choose an extract destination folder first.");
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
        addJobState(response);
        const jobsTab = document.querySelector<HTMLButtonElement>(".tab[data-panel=\"jobs-panel\"]");
        if (jobsTab) {
          jobsTab.click();
        }
        return;
      } catch (error) {
        const commandError = asCommandError(error);
        if (
          commandError?.code === COMMAND_PASSWORD_REQUIRED ||
          commandError?.code === COMMAND_INVALID_PASSWORD
        ) {
          const promptMessage =
            commandError.code === COMMAND_PASSWORD_REQUIRED
              ? "This archive is password-protected. Enter a password to continue."
              : "Invalid password. Enter the archive password again.";
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
    setBrowseState("error", "Select at least one entry to extract.");
    return;
  }

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

      const totalLabel = entries.length === extractedCount ? `${extractedCount} entries` : `${extractedCount} of ${entries.length} entries`;
      setBrowseState(
        "loaded",
        `Extracted ${totalLabel} (${formatBytes(totalBytes)}) to ${destination}.`,
      );
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        const promptMessage =
          commandError.code === COMMAND_PASSWORD_REQUIRED
            ? "This archive is password-protected. Enter a password to continue."
            : "Invalid password. Enter the archive password again.";
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
      return;
    } catch (error) {
      const commandError = asCommandError(error);
      if (
        commandError?.code === COMMAND_PASSWORD_REQUIRED ||
        commandError?.code === COMMAND_INVALID_PASSWORD
      ) {
        const promptMessage =
          commandError.code === COMMAND_PASSWORD_REQUIRED
            ? "This archive is password-protected. Enter a password to continue."
            : "Invalid password. Enter the archive password again.";
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

    const response = await runStartCreate({
      request,
    });

    createPasswordInput.value = "";
    addJobState(response);
    const jobsTab = document.querySelector<HTMLButtonElement>(".tab[data-panel=\"jobs-panel\"]");
    if (jobsTab) {
      jobsTab.click();
    }
  } catch (error) {
    const commandError = asCommandError(error);
    setCreatePlanState("error", commandError?.message ?? "Unable to start create job.");
  }
}

async function onCancelJob(jobId: string) {
  try {
    await cancelJobCommand({ jobId });
  } catch (error) {
    const commandError = asCommandError(error);
    if (commandError) {
      setCreatePlanState("error", commandError.message);
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
      setCreatePlanState("error", commandError.message);
    }
  }
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

searchInput.addEventListener("input", () => {
  if (browseState === "loaded" || browseState === "empty") {
    renderBrowse();
  }
});

selectAllInput.addEventListener("change", () => {
  const rows = sortedEntries();
  if (selectAllInput.checked) {
    rows.forEach((entry) => selectedEntries.add(entry.path));
  } else {
    rows.forEach((entry) => selectedEntries.delete(entry.path));
  }
  renderBrowse();
  setBrowseState(browseState, messageElement.textContent ?? "");
});

for (const header of sortHeaders) {
  header.addEventListener("click", () => {
    const key = header.dataset.sortKey;
    if (!key) {
      return;
    }

    if (key === sortKey) {
      sortAscending = !sortAscending;
    } else {
      sortKey = key as "path" | "kind" | "size" | "compressedSize" | "modified";
      sortAscending = true;
    }

    renderBrowse();
  });
}

openArchiveButton.addEventListener("click", () => {
  void onOpenArchive();
});

testArchiveButton.addEventListener("click", () => {
  void onTestArchive();
});

refreshArchiveButton.addEventListener("click", () => {
  void onRefreshArchive();
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

  setBrowseState(browseState, messageElement.textContent ?? "");
});

extractAllButton.addEventListener("click", () => {
  void startExtract("archive");
});

extractSelectedButton.addEventListener("click", () => {
  void startExtract("selection");
});

previewSelectedButton.addEventListener("click", () => {
  void onPreviewSelectedEntry();
});

browseExtractDestinationButton.addEventListener("click", () => {
  void onSelectDestinationForExtract();
});

addSourceFilesButton.addEventListener("click", () => {
  void addSourcePathsFromDialog("files");
});

addSourceFoldersButton.addEventListener("click", () => {
  void addSourcePathsFromDialog("folder");
});

clearSourcesButton.addEventListener("click", () => {
  createSources = [];
  renderCreateSources();
  queuePlanRun();
});

createFormatSelect.addEventListener("change", () => {
  const format = createFormatSelect.value;
  if (format !== "zip") {
    createVolumeInput.placeholder = "Optional for zip/tzap/7z";
  }
  queuePlanRun();
});

runPlanButton.addEventListener("click", () => {
  void runPlan();
});

startCreateButton.addEventListener("click", () => {
  void runCreate();
});

browseCreateDestinationButton.addEventListener("click", async () => {
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
  setCreatePlanState("idle", "");
});

refreshJobsButton.addEventListener("click", () => {
  void pollJobs();
});

tableBody.addEventListener("dblclick", (event) => {
  const target = event.target as HTMLElement;
  const checkbox = target.closest<HTMLElement>("tr")?.querySelector<HTMLInputElement>("[data-entry-path]");
  if (!checkbox) {
    return;
  }
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
});

for (const button of [createCleanSourceCheckbox, createPreserveMetadataCheckbox, createReplaceExistingCheckbox, createRespectGitignoreCheckbox]) {
  button.addEventListener("change", () => {
    queuePlanRun();
  });
}

async function loadBootstrapState() {
  try {
    const [healthcheck, contract] = await Promise.all([
      fetchHealthcheck(),
      fetchProjectContract(),
    ]);

    if (statusElement) {
      statusElement.textContent = `${healthcheck.summary} via ${healthcheck.shell}`;
      statusElement.dataset.status = healthcheck.status;
    }

    if (contractElement) {
      contractElement.innerHTML = `
        <h3>Command Contract</h3>
        <p>${escapeHtml(contract.platformStrategy)}</p>
        <p><strong>Core:</strong> ${escapeHtml(contract.coreDependency)}</p>
        <ul>
          ${contract.commands.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}
        </ul>
      `;
    }
  } catch (error) {
    if (statusElement) {
      statusElement.textContent = "Desktop shell is ready. Tauri backend unavailable in browser mode.";
      statusElement.dataset.status = "frontend-only";
    }

    if (contractElement) {
      contractElement.textContent = String(error);
    }
  }
}

function clearBrowseSelection() {
  selectedEntries.clear();
  renderBrowse();
}

jobsListElement.addEventListener("focusin", () => {
  void pollJobs();
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearBrowseSelection();
  }
});

renderCreateSources();
setCreatePlanState("idle");
setBrowseState("idle", "No archive selected.");
renderBrowse();
renderJobs();
loadBootstrapState();
