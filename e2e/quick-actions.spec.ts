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
  completeOnPoll?: boolean;
  startupStateDelayMs?: number;
  catalogJobs?: { jobId: string; kind: string; status: string; createdAt: string }[];
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

const epochSecondsAgo = (seconds: number) => String(Math.floor(Date.now() / 1000) - seconds);

test("restored main window discovers terminal jobs through the retained catalog without polling", async ({ page }) => {
  await installQuickActionTauriStub(page, [notRequestedState], {
    catalogJobs: [{
      jobId: "job-from-task-window",
      kind: "zipExtract",
      status: "completed",
      createdAt: epochSecondsAgo(10),
    }],
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(async () => (await ipcCalls(page)).filter((call) => call.cmd === "subscribe_job").length).toBe(1);
  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "subscribe_job_catalog")).toBe(true);
});

test("fixed create context actions open a directly subscribed disposable task window", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectWindowCommand(page, "plugin:webview|create_webview_window");
  await expectWindowCommand(page, "subscribe_job");
  await expect(page.locator(".workspace")).toHaveAttribute("data-mode", "compress");

  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "start_create")).toBe(false);
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
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expectWindowCommand(page, "plugin:webview|create_webview_window");
  await expectWindowCommand(page, "subscribe_job");

  const calls = await ipcCalls(page);
  expect(calls.some((call) => call.cmd === "start_extract")).toBe(false);
  expect(calls.some((call) => call.cmd === "list_archive")).toBe(false);
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
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    rejectWindowCommands: ["plugin:window|set_min_size"],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expectWindowCommand(page, "plugin:webview|create_webview_window");
  await expectWindowCommand(page, "subscribe_job");
});

test("quick action startup waits for job state before showing the workspace", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    completeOnPoll: false,
    startupStateDelayMs: 750,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".workspace")).not.toHaveAttribute("data-mode", /.+/);
  expect((await ipcCalls(page)).some((call) => call.cmd === "plugin:window|show")).toBe(false);

  await expectWindowCommand(page, "plugin:webview|create_webview_window");
});

test.skip("legacy Main Window quick action controls are replaced by Disposable Task Window controls", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    completeOnPoll: false,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#quick-progress")).toBeVisible();
  await expect(page.locator("#quick-elapsed")).not.toHaveText("00:00:00");
  await expect(page.locator("#quick-remaining")).not.toHaveText("--:--:--");
  await expect(page.locator("#quick-files")).toContainText("2 / 4");
  await expect(page.locator("#quick-ratio")).toHaveText("");

  await page.locator("#quick-continue").click();
  await expectWindowCommand(page, "pause_job");
  await expect(page.locator("#quick-continue")).toHaveText("Continue");

  await page.locator("#quick-continue").click();
  await expectWindowCommand(page, "resume_job");
  await expect(page.locator("#quick-continue")).toHaveText("Pause");

  await page.locator("#quick-continue").click();
  await expect(page.locator("#quick-continue")).toHaveText("Continue");

  await page.locator("#quick-cancel").click();
  await expectWindowCommand(page, "cancel_job");
  await expectWindowCommand(page, "plugin:window|close");
  await expect(page.locator("#quick-operation")).toHaveText("Cancelled");
  await expect(page.locator("#quick-cancel")).toBeDisabled();
  await expect(page.locator("#quick-background")).toBeDisabled();
});

test.skip("legacy Main Window background mode is replaced by independent task windows", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    completeOnPoll: false,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.locator("#quick-background").click();
  await expectWindowCommand(page, "plugin:window|minimize");
  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "true");
});

test.skip("legacy Main Window minimize fallback is replaced by independent task windows", async ({ page }) => {
  await installQuickActionTauriStub(page, [
    {
      launchedForQuickAction: true,
      quickAction: null,
      quickActionJobs: [{
        jobId: "job-1",
        kind: "tzapCreate",
        status: "queued",
        createdAt: epochSecondsAgo(5),
      }],
      error: null,
    },
    notRequestedState,
  ], {
    completeOnPoll: false,
    rejectWindowCommands: ["plugin:window|minimize"],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#quick-progress")).toBeVisible();
  await page.locator("#quick-background").click();

  await expectWindowCommand(page, "plugin:window|minimize");
  await expect(page.locator(".workspace")).toHaveAttribute("data-quick-action-mode", "job-only");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "true");
});

test.skip("legacy focused Main Window extraction is replaced by a Disposable Task Window", async ({ page }) => {
  await installQuickActionTauriStub(page, [notRequestedState]);
  await page.setViewportSize({ width: 620, height: 420 });

  await page.goto("/?fixture=archive", { waitUntil: "domcontentloaded" });

  await page.locator("#extract-toolbar").click();
  await expect(page.getByRole("dialog", { name: "Extract Archive" })).toBeVisible();
  await page.locator("#extract-destination").fill("C:/fixtures/output");
  await page.locator("#extract-start").click();

  await expectWindowCommand(page, "plugin:webview|create_webview_window");
  await expectWindowCommand(page, "start_extract");
  await expect.poll(async () => page.evaluate(() => ({
    bodyOverflow: getComputedStyle(document.body).overflow,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }))).toEqual({
    bodyOverflow: "hidden",
    scrollHeight: 420,
    viewportHeight: 420,
  });

  await expect(page.locator(".browser-shell")).toBeVisible();
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
    const completeOnPoll = payload.options.completeOnPoll ?? true;
    const startupStateDelayMs = payload.options.startupStateDelayMs ?? 0;
    const ipcCalls: IpcCall[] = [];
    const jobStatuses = new Map<string, string>();
    const jobKinds = new Map<string, string>();
    const jobCreatedAts = new Map<string, string>();
    const callbacks = new Map<number, { callback: unknown; once: boolean }>();
    let callbackId = 1;
    let startedJobCount = 0;
    let startupDelayConsumed = false;
    let subscriptionCount = 0;
    const jobChannels = new Map<string, { callbackId: number; subscriptionId: string; revision: number }>();
    const catalogJobs = payload.options.catalogJobs ?? [];
    for (const job of catalogJobs) {
      jobStatuses.set(job.jobId, job.status);
      jobKinds.set(job.jobId, job.kind);
      jobCreatedAts.set(job.jobId, job.createdAt);
    }

    const channelCallbackId = (value: unknown): number => {
      if (typeof value === "number") return value;
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      return Number(serialized?.match(/(\d+)/)?.[1] ?? 0);
    };
    const deliverJob = (jobId: string, requestedStatus?: string) => {
      const channel = jobChannels.get(jobId); if (!channel) return;
      const previous = jobStatuses.get(jobId) ?? "queued";
      const status = requestedStatus ?? (["paused", "completed", "failed", "cancelled"].includes(previous) ? previous : "running");
      jobStatuses.set(jobId, status); channel.revision += 1;
      const terminal = status === "completed" || status === "failed" || status === "cancelled";
      const createdAt = jobCreatedAts.get(jobId) ?? String(Math.floor(Date.now() / 1000));
      const payload = { revision: String(channel.revision), jobId, kind: jobKinds.get(jobId) ?? "tzapCreate", status, createdAt, updatedAt: createdAt,
        canPause: status === "running", canResume: status === "paused", canCancel: status === "running" || status === "paused", canDismiss: terminal,
        progressFacts: { processedBytes: terminal ? 128 : 32, totalBytes: 128, processedEntries: terminal ? 4 : 2, totalEntries: 4, currentPath: "fixture.bin", recentPaths: ["fixture.bin"], activePhase: "emittingPayload", phaseProcessedBytes: terminal ? 128 : 32, phaseTotalBytes: 128, warningCount: 0, activeElapsedMillis: 1000, phaseElapsedMillis: 1000 },
        latestFailure: null, boundedNotices: [],
        availableActions: terminal ? [{ actionId: "open-output", kind: "open", artifactId: "output" }] : [],
        outputArtifacts: terminal ? [{ artifactId: "output", kind: "directory", path: "/tmp/output" }] : [], retryDescriptor: null,
        terminalSummary: status === "completed" ? { writtenEntries: 1, writtenBytes: 32, warnings: [] } : null };
      queueMicrotask(() => window.__TAURI_INTERNALS__?.runCallback(channel.callbackId, {
        index: channel.revision - 1,
        message: { subscriptionId: channel.subscriptionId, revision: payload.revision, payload },
      }));
    };

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
          commands: ["start_create", "start_extract", "subscribe_job", "subscribe_job_catalog", "cancel_job", "pause_job", "resume_job"],
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
        if (startupStateDelayMs > 0 && !startupDelayConsumed) {
          startupDelayConsumed = true;
          await new Promise((resolve) => setTimeout(resolve, startupStateDelayMs));
        }
        const state = states.shift() ?? {
          launchedForQuickAction: false,
          quickAction: null,
          quickActionJobs: [],
          error: null,
        };
        for (const job of state.quickActionJobs ?? []) {
          jobStatuses.set(job.jobId, job.status);
          jobKinds.set(job.jobId, job.kind);
          jobCreatedAts.set(job.jobId, job.createdAt);
        }
        return state;
      }

      if (cmd === "start_create" || cmd === "start_extract") {
        startedJobCount += 1;
        const jobId = `started-job-${startedJobCount}`;
        const kind = cmd === "start_create" ? "zipCreate" : "zipExtract";
        const createdAt = String(Math.floor(Date.now() / 1000));
        jobStatuses.set(jobId, "queued");
        jobKinds.set(jobId, kind);
        jobCreatedAts.set(jobId, createdAt);
        return {
          jobId,
          kind,
          status: "queued",
          createdAt,
        };
      }

      if (cmd === "subscribe_job_catalog") {
        const subscriptionId = `catalog-${++subscriptionCount}`;
        const callbackId = channelCallbackId(args.onSnapshot);
        const jobs = catalogJobs.map((job) => ({
          jobId: job.jobId,
          revision: "1",
          kind: job.kind,
          status: job.status,
          terminal: ["completed", "failed", "cancelled"].includes(job.status),
        }));
        if (payload.options.catalogJobs) {
          window.setTimeout(() => window.__TAURI_INTERNALS__?.runCallback(callbackId, {
            index: 0,
            message: {
              subscriptionId,
              revision: "1",
              payload: { catalogRevision: "1", jobs },
            },
          }), 0);
        }
        return subscriptionId;
      }
      if (cmd === "subscribe_job") {
        const request = args.request as { jobId: string }; const subscriptionId = `job-${++subscriptionCount}`;
        jobChannels.set(request.jobId, { callbackId: channelCallbackId(args.onSnapshot), subscriptionId, revision: 0 }); deliverJob(request.jobId); return subscriptionId;
      }
      if (cmd === "ack_subscription") {
        const subscriptionId = (args.request as { subscriptionId?: string } | undefined)?.subscriptionId;
        const entry = [...jobChannels.entries()].find(([, channel]) => channel.subscriptionId === subscriptionId);
        if (completeOnPoll && entry && jobStatuses.get(entry[0]) === "running") {
          window.setTimeout(() => deliverJob(entry[0], "completed"), 1_500);
        }
        return undefined;
      }
      if (cmd === "unsubscribe_job") return undefined;

      if (cmd === "cancel_job") {
        const request = args.request as { jobId: string };
        jobStatuses.set(request.jobId, "cancelled");
        deliverJob(request.jobId, "cancelled");
        return {
          jobId: request.jobId,
          status: "cancelled",
        };
      }

      if (cmd === "pause_job") {
        const request = args.request as { jobId: string };
        jobStatuses.set(request.jobId, "paused");
        deliverJob(request.jobId, "paused");
        return {
          jobId: request.jobId,
          status: "paused",
        };
      }

      if (cmd === "resume_job") {
        const request = args.request as { jobId: string };
        jobStatuses.set(request.jobId, "running");
        deliverJob(request.jobId, "running");
        return {
          jobId: request.jobId,
          status: "running",
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
        const request = args.request as { entries?: Array<{ key: string }> };
        return {
          icons: (request.entries ?? []).map((entry) => ({
            key: entry.key,
            dataUrl: null,
          })),
        };
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
