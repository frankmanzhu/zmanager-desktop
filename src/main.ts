import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

type HealthcheckResponse = {
  engine: string;
  version: string;
  ready: boolean;
  summary: string;
  shell: string;
  status: string;
};

type ProjectContract = {
  commands: string[];
  platformStrategy: string;
  coreDependency: string;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("missing app root");
}

app.innerHTML = `
  <main class="workspace">
    <header class="topbar">
      <div>
        <h1>ZManager</h1>
        <p id="engine-status">Checking engine...</p>
      </div>
      <div class="toolbar" role="toolbar" aria-label="Archive actions">
        <button id="open-archive" type="button">Open Archive</button>
        <button id="create-archive" type="button">Create</button>
        <button id="extract-archive" type="button" disabled>Extract</button>
      </div>
    </header>

    <section class="shell">
      <nav class="tabs" aria-label="Workspace">
        <button class="tab is-active" type="button" data-panel="browse-panel">Browse</button>
        <button class="tab" type="button" data-panel="create-panel">Create</button>
        <button class="tab" type="button" data-panel="jobs-panel">Jobs</button>
        <button class="tab" type="button" data-panel="settings-panel">Settings</button>
      </nav>

      <section id="browse-panel" class="panel is-active" aria-label="Browse archive">
        <div class="panel-header">
          <div>
            <h2>Archive Browser</h2>
            <p>Open an archive to list entries through zmanager-core.</p>
          </div>
          <input class="search" type="search" placeholder="Filter entries" disabled />
        </div>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Type</th>
                <th>Size</th>
                <th>Packed</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="empty">Archive listing command is the first implementation slice.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="create-panel" class="panel" aria-label="Create archive">
        <div class="panel-header">
          <div>
            <h2>Create Archive</h2>
            <p>Plan ZIP, TZST, TZAP, and 7z creation against selected sources.</p>
          </div>
        </div>
        <div class="form-grid">
          <label>
            Format
            <select>
              <option>TZST (.tzst)</option>
              <option>TZAP (.tzap)</option>
              <option>ZIP (.zip)</option>
              <option>7z (.7z)</option>
            </select>
          </label>
          <label>
            Source mode
            <select>
              <option>Normal</option>
              <option>Clean source</option>
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" />
            Encrypt archive
          </label>
        </div>
      </section>

      <section id="jobs-panel" class="panel" aria-label="Jobs">
        <div class="panel-header">
          <div>
            <h2>Jobs</h2>
            <p>Long-running create and extract operations will appear here.</p>
          </div>
        </div>
        <div class="job-row">
          <div>
            <strong>No running jobs</strong>
            <span>Wire start/poll/cancel after archive listing.</span>
          </div>
          <progress value="0" max="100"></progress>
        </div>
      </section>

      <section id="settings-panel" class="panel" aria-label="Settings">
        <div class="panel-header">
          <div>
            <h2>Settings</h2>
            <p>Safe preferences only. Passwords must never be persisted.</p>
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

async function loadBootstrapState(): Promise<void> {
  try {
    const [healthcheck, contract] = await Promise.all([
      invoke<HealthcheckResponse>("healthcheck"),
      invoke<ProjectContract>("project_contract")
    ]);

    if (statusElement) {
      statusElement.textContent = `${healthcheck.summary} via ${healthcheck.shell}`;
      statusElement.dataset.status = healthcheck.status;
    }

    if (contractElement) {
      contractElement.innerHTML = `
        <h3>Command Contract</h3>
        <p>${contract.platformStrategy}</p>
        <p><strong>Core:</strong> ${contract.coreDependency}</p>
        <ul>
          ${contract.commands.map((command) => `<li>${command}</li>`).join("")}
        </ul>
      `;
    }
  } catch (error) {
    if (statusElement) {
      statusElement.textContent = `Desktop shell is ready. Tauri backend unavailable in browser-only mode.`;
      statusElement.dataset.status = "frontend-only";
    }
    if (contractElement) {
      contractElement.textContent = String(error);
    }
  }
}

void loadBootstrapState();

