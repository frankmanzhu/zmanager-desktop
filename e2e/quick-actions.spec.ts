import { expect, test, type Page } from "@playwright/test";

type IpcCall = {
  cmd: string;
  args: Record<string, unknown>;
};

type QuickActionStartupState = {
  launchedForQuickAction: boolean;
  quickAction: { kind: string; paths: string[] } | null;
  quickActionJobs?: { jobId: string; kind: string; status: string; createdAt: string }[] | null;
  error: null;
};

type QuickActionStubOptions = {
  rejectWindowCommands?: string[];
};

declare global {
  interface Window {
    __zmanagerE2E?: {
      ipcCalls: IpcCall[];
    };
    __TAURI_EVENT_PLUGIN_INTERNALS__?: {
      unregisterListener: (event: string, id: number) => void;
    };
    __TAURI_INTERNALS__?: Record<string, unknown>;
    isTauri?: boolean;
  }
}

const notRequestedState: QuickActionStartupState = {
  launchedForQuickAction: false,
  quickAction: null,
  quickActionJobs: [],
  error: null,
};

test("fixed create context actions use the compact job window and close after completion", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: new Date().toISOString(),
      }],
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".browser-shell")).toBeHidden();

  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "start_create")).toBe(false);
  await expect(page.locator("#quick-progress")).toBeVisible();

  await expectWindowCommand(page, "plugin:window|close");
});

test("extract-here context actions start extraction without listing the archive", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapExtract",
        status: "queued",
        createdAt: new Date().toISOString(),
      }],
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");

  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "start_extract")).toBe(false);
  expect(calls.some((call) => call.cmd === "list_archive")).toBe(false);
  await expectWindowCommand(page, "plugin:window|close");
});

test("quick action jobs still activate when window sizing is rejected", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: new Date().toISOString(),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    rejectWindowCommands: ["plugin:window|set_min_size"],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");
  await expect(page.locator("#quick-progress")).toBeVisible();
  await expectWindowCommand(page, "poll_job_events");
  await expectWindowCommand(page, "plugin:window|close");
});

async function installQuickActionTauriStub(
  page: Page,
  startupStates: QuickActionStartupState[],
  options: QuickActionStubOptions = {},
) {
  await page.addInitScript((payload: {
    startupStates: QuickActionStartupState[];
    options: QuickActionStubOptions;
  }) => {
    const states = payload.startupStates;
    const rejectedWindowCommands = new Set(payload.options.rejectWindowCommands ?? []);
    const ipcCalls: IpcCall[] = [];
    const callbacks = new Map<number, { callback: unknown; once: boolean }>();
    let callbackId = 1;

    Object.defineProperty(window, "isTauri", {
      configurable: true,
      value: true,
    });

    window.__zmanagerE2E = { ipcCalls };

    const invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      ipcCalls.push({ cmd, args });

      if (rejectedWindowCommands.has(cmd)) {
        throw new Error(`Rejected ${cmd}`);
      }

      if (cmd === "healthcheck") {
        return {
          engine: "zmanager-core",
          version: "e2e",
          ready: true,
          summary: "E2E backend stub",
          shell: "playwright",
          status: "ok",
        };
      }

      if (cmd === "project_contract") {
        return {
          commands: ["start_create", "start_extract", "poll_job_events"],
          platformStrategy: "e2e",
          coreDependency: "stub",
          platformIntegration: {
            platform: "linux",
            explorerIntegrationEnabled: false,
            desktopActionsEnabled: true,
            associatedExtensions: ["zip", "tzap"],
            shellActions: [],
          },
        };
      }

      if (cmd === "quick_action_startup_state") {
        return states.shift() ?? {
          launchedForQuickAction: false,
          quickAction: null,
          quickActionJobs: [],
          error: null,
        };
      }

      if (cmd === "poll_job_events") {
        const request = args.request as { jobId: string };
        return {
          jobId: request.jobId,
          kind: "tzapCreate",
          status: "completed",
          createdAt: new Date().toISOString(),
          canDismiss: true,
          events: [
            { eventType: "started", message: "started" },
            { eventType: "completed", entries: 1, totalBytesProcessed: 32, message: "completed" },
          ],
          terminalSummary: {
            writtenEntries: 1,
            writtenBytes: 32,
            warnings: [],
          },
        };
      }

      if (cmd === "list_archive") {
        const request = args.request as { archivePath: string };
        return {
          archivePath: request.archivePath,
          entries: [],
          entryCount: 0,
          totalSize: 0,
        };
      }

      if (cmd === "system_file_icons") {
        return { icons: [] };
      }

      if (cmd === "cleanup_preview_roots") {
        return undefined;
      }

      if (cmd === "plugin:window|inner_size") {
        return { width: 1280, height: 800 };
      }

      if (cmd === "plugin:window|inner_position") {
        return { x: 20, y: 20 };
      }

      if (cmd === "plugin:event|listen") {
        return args.handler;
      }

      if (cmd === "plugin:event|unlisten" || cmd.startsWith("plugin:window|") || cmd.startsWith("plugin:webview|")) {
        return undefined;
      }

      if (cmd.startsWith("plugin:")) {
        return undefined;
      }

      throw new Error(`Unhandled Tauri command in quick-action stub: ${cmd}`);
    };

    const transformCallback = (callback: unknown, once = false) => {
      const id = callbackId++;
      callbacks.set(id, { callback, once });
      return id;
    };

    const unregisterCallback = (id: number) => {
      callbacks.delete(id);
    };

    const runCallback = (id: number, data: unknown) => {
      const registration = callbacks.get(id);
      if (!registration || typeof registration.callback !== "function") {
        return;
      }
      if (registration.once) {
        callbacks.delete(id);
      }
      registration.callback(data);
    };

    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_event: string, id: number) => unregisterCallback(id),
    };

    window.__TAURI_INTERNALS__ = {
      callbacks,
      convertFileSrc: (path: string) => path,
      invoke,
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      runCallback,
      transformCallback,
      unregisterCallback,
    };
  }, { startupStates, options });
}

async function ipcCalls(page: Page): Promise<IpcCall[]> {
  return page.evaluate(() => window.__zmanagerE2E?.ipcCalls ?? []);
}

async function expectWindowCommand(page: Page, command: string) {
  await expect.poll(async () => {
    const calls = await ipcCalls(page);
    return calls.some((call) => call.cmd === command);
  }, { timeout: 3_000 }).toBe(true);
}
