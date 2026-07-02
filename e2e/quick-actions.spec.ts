import { expect, test, type Page } from "@playwright/test";

type IpcCall = {
  cmd: string;
  args: Record<string, unknown>;
};

type QuickActionStartupState = {
  launchedForQuickAction: boolean;
  quickAction: { kind: string; paths: string[] } | null;
  error: null;
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
  error: null,
};

test("fixed create context actions use the compact job window and close after completion", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: { kind: "compressTzap", paths: ["/tmp/source.txt"] },
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".browser-shell")).toBeHidden();

  const startCreateCall = await waitForIpcCall(page, "start_create");
  expect(startCreateCall.args.request).toMatchObject({
    sources: ["/tmp/source.txt"],
    destinationPath: "/tmp/source.txt.tzap",
    format: "tzap",
    cleanSource: false,
    replaceExisting: false,
    destinationCollisionStrategy: "rename",
    preserveMetadata: true,
  });

  await expectWindowCommand(page, "plugin:window|close");
});

test("extract-here context actions start extraction without listing the archive", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: { kind: "extractHere", paths: ["/tmp/archive.tzap"] },
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");

  const startExtractCall = await waitForIpcCall(page, "start_extract");
  expect(startExtractCall.args.request).toMatchObject({
    archivePath: "/tmp/archive.tzap",
    destinationPath: "/tmp",
    overwrite: "rename",
    stripComponents: 0,
  });

  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "list_archive")).toBe(false);
  await expectWindowCommand(page, "plugin:window|close");
});

async function installQuickActionTauriStub(
  page: Page,
  startupStates: QuickActionStartupState[],
) {
  await page.addInitScript((states: QuickActionStartupState[]) => {
    const ipcCalls: IpcCall[] = [];
    const callbacks = new Map<number, { callback: unknown; once: boolean }>();
    let callbackId = 1;
    let jobSequence = 1;

    Object.defineProperty(window, "isTauri", {
      configurable: true,
      value: true,
    });

    window.__zmanagerE2E = { ipcCalls };

    const invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      ipcCalls.push({ cmd, args });

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
          error: null,
        };
      }

      if (cmd === "start_create") {
        const request = args.request as { format?: string };
        const jobId = `job-${jobSequence++}`;
        const kind = request.format === "tzap" ? "tzapCreate" : "zipCreate";
        return {
          jobId,
          kind,
          status: "queued",
          createdAt: new Date().toISOString(),
        };
      }

      if (cmd === "start_extract") {
        const jobId = `job-${jobSequence++}`;
        return {
          jobId,
          kind: "tzapExtract",
          status: "queued",
          createdAt: new Date().toISOString(),
        };
      }

      if (cmd === "poll_job_events") {
        const request = args.request as { jobId: string };
        return {
          jobId: request.jobId,
          kind: request.jobId === "job-1" ? "tzapCreate" : "tzapExtract",
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
  }, startupStates);
}

async function ipcCalls(page: Page): Promise<IpcCall[]> {
  return page.evaluate(() => window.__zmanagerE2E?.ipcCalls ?? []);
}

async function waitForIpcCall(page: Page, command: string): Promise<IpcCall> {
  await expect.poll(async () => {
    const calls = await ipcCalls(page);
    return calls.some((call) => call.cmd === command);
  }).toBe(true);

  const calls = await ipcCalls(page);
  const call = calls.find((candidate) => candidate.cmd === command);
  if (!call) {
    throw new Error(`Missing IPC call: ${command}`);
  }
  return call;
}

async function expectWindowCommand(page: Page, command: string) {
  await expect.poll(async () => {
    const calls = await ipcCalls(page);
    return calls.some((call) => call.cmd === command);
  }, { timeout: 3_000 }).toBe(true);
}
