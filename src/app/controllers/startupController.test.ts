import { describe, expect, it, vi } from "vitest";

import type {
  CommandErrorDto,
  HealthcheckResponse,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  StartJobResponseDto,
} from "../../api/types";
import {
  createStartupController,
  type QuickActionLaunchEvent,
  type StartupControllerOptions,
} from "./startupController";

function healthcheck(overrides: Partial<HealthcheckResponse> = {}): HealthcheckResponse {
  return {
    engine: "zmanager-core",
    version: "1.0.0",
    ready: true,
    summary: "Ready",
    shell: "desktop",
    status: "ready",
    ...overrides,
  };
}

function contract(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    commands: ["list"],
    platformStrategy: "desktop",
    coreDependency: "zmanager-core",
    platformIntegration: {
      platform: "windows",
      selectedItemActionsEnabled: true,
      backgroundActionsEnabled: true,
      fileAssociationsEnabled: true,
      windowDecorations: true,
      customWindowChrome: false,
      manualWindowResize: false,
      associatedExtensions: [".zip"],
      shellActions: [],
    },
    ...overrides,
  };
}

function quickActionRequest(overrides: Partial<QuickActionRequestDto> = {}): QuickActionRequestDto {
  return {
    kind: "extractHere",
    paths: ["C:/archives/demo.zip"],
    ...overrides,
  };
}

function quickActionJob(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "job-1",
    kind: "archiveExtract",
    status: "running",
    createdAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

function startupState(overrides: Partial<QuickActionStartupStateDto> = {}): QuickActionStartupStateDto {
  return {
    launchedForQuickAction: false,
    quickAction: null,
    quickActionJobs: null,
    error: null,
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "backend_down",
    message: "Backend is down",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function createHarness(overrides: Partial<StartupControllerOptions> = {}) {
  let desktopRuntime = true;
  let launchListener: ((event: QuickActionLaunchEvent) => void) | null = null;
  const startupStates: QuickActionStartupStateDto[] = [];
  const calls = {
    revealQuickActionStates: [] as QuickActionStartupStateDto[],
    revealNormal: 0,
    activatedJobs: [] as StartJobResponseDto[][],
    handledRequests: [] as QuickActionRequestDto[],
    statuses: [] as string[],
    messages: [] as string[],
    browseErrors: [] as string[],
    bootstrapStates: [] as { healthcheck: HealthcheckResponse | null; contract: ProjectContract | null }[],
    bootstrapNotifications: 0,
  };

  const fetchHealthcheck = vi.fn(async () => healthcheck());
  const fetchProjectContract = vi.fn(async () => contract());
  const fetchQuickActionStartupState = vi.fn(async () => {
    const state = startupStates.shift();
    if (!state) {
      throw new Error("No startup state queued");
    }
    return state;
  });
  const listenQuickActionLaunch = vi.fn(async (listener: (event: QuickActionLaunchEvent) => void) => {
    launchListener = listener;
  });

  const controller = createStartupController({
    fetchHealthcheck,
    fetchProjectContract,
    fetchQuickActionStartupState,
    listenQuickActionLaunch,
    isDesktopRuntime() {
      return desktopRuntime;
    },
    async revealWindowForStartupQuickAction(state) {
      calls.revealQuickActionStates.push(state);
    },
    async revealNormalWindow() {
      calls.revealNormal += 1;
    },
    async activateQuickActionJobs(responses) {
      calls.activatedJobs.push([...responses]);
    },
    async handleQuickActionRequest(request) {
      calls.handledRequests.push(request);
    },
    setOperationalStatus(message) {
      calls.statuses.push(message);
    },
    setOperationalMessage(key) {
      calls.messages.push(key);
    },
    setBrowseError(message) {
      calls.browseErrors.push(message);
    },
    unknownErrorMessage(error, fallback) {
      return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
    },
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    message(key) {
      return `translated:${key}`;
    },
    setBootstrapState(state) {
      calls.bootstrapStates.push(state);
    },
    onBootstrapStateChanged() {
      calls.bootstrapNotifications += 1;
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    fetchHealthcheck,
    fetchProjectContract,
    fetchQuickActionStartupState,
    listenQuickActionLaunch,
    queueStartupStates(...states: QuickActionStartupStateDto[]) {
      startupStates.push(...states);
    },
    setDesktopRuntime(value: boolean) {
      desktopRuntime = value;
    },
    emitQuickActionLaunch(state: QuickActionStartupStateDto) {
      if (!launchListener) {
        throw new Error("Launch listener was not bound");
      }
      launchListener({ payload: state });
    },
  };
}

describe("startup controller", () => {
  it("loops startup states, reveals once, and stops at a normal launch state", async () => {
    const harness = createHarness();
    const first = startupState({
      launchedForQuickAction: true,
      quickAction: quickActionRequest({ kind: "extractHere" }),
    });
    const second = startupState({ launchedForQuickAction: false });
    harness.queueStartupStates(first, second);

    await harness.controller.handleStartupQuickAction();

    expect(harness.fetchQuickActionStartupState).toHaveBeenCalledTimes(2);
    expect(harness.calls.revealQuickActionStates).toEqual([first]);
    expect(harness.calls.statuses).toEqual(["translated:quickAction.starting"]);
    expect(harness.calls.handledRequests).toEqual([first.quickAction]);
    expect(harness.calls.revealNormal).toBe(0);
  });

  it("does not run startup handling outside desktop runtime", async () => {
    const harness = createHarness();
    harness.setDesktopRuntime(false);

    await harness.controller.handleStartupQuickAction();

    expect(harness.fetchQuickActionStartupState).not.toHaveBeenCalled();
    expect(harness.calls.revealQuickActionStates).toEqual([]);
  });

  it("stops the startup loop when a startup error is returned", async () => {
    const harness = createHarness();
    const state = startupState({
      launchedForQuickAction: true,
      error: {
        code: "bad_payload",
        message: "Quick action failed",
        hint: "Try again.",
      },
    });
    harness.queueStartupStates(state);

    await harness.controller.handleStartupQuickAction();

    expect(harness.fetchQuickActionStartupState).toHaveBeenCalledTimes(1);
    expect(harness.calls.statuses).toEqual(["Quick action failed"]);
    expect(harness.calls.browseErrors).toEqual(["Quick action failed\nTry again."]);
  });

  it("uses the startup read fallback and reveals the normal window when the first read fails", async () => {
    const harness = createHarness();

    await harness.controller.handleStartupQuickAction();

    expect(harness.calls.statuses).toEqual([
      "translated:jobs.quickActionStartupReadFailed: No startup state queued",
    ]);
    expect(harness.calls.revealNormal).toBe(1);
    expect(harness.calls.revealQuickActionStates).toEqual([]);
  });

  it("does not reveal the normal window again when a later startup read fails", async () => {
    const harness = createHarness();
    harness.queueStartupStates(startupState({
      launchedForQuickAction: true,
      quickAction: quickActionRequest(),
    }));

    await harness.controller.handleStartupQuickAction();

    expect(harness.calls.revealQuickActionStates).toHaveLength(1);
    expect(harness.calls.revealNormal).toBe(0);
    expect(harness.calls.statuses).toEqual([
      "translated:quickAction.starting",
      "translated:jobs.quickActionStartupReadFailed: No startup state queued",
    ]);
  });

  it("activates quick-action jobs before request handling", async () => {
    const harness = createHarness();
    const job = quickActionJob();

    await harness.controller.handleQuickActionStartupState(startupState({
      launchedForQuickAction: true,
      quickAction: quickActionRequest(),
      quickActionJobs: [job],
    }));

    expect(harness.calls.activatedJobs).toEqual([[job]]);
    expect(harness.calls.handledRequests).toEqual([]);
  });

  it("uses the opening archive status for open quick actions", async () => {
    const harness = createHarness();
    const request = quickActionRequest({ kind: "open" });

    await harness.controller.handleQuickActionStartupState(startupState({
      launchedForQuickAction: true,
      quickAction: request,
    }));

    expect(harness.calls.statuses).toEqual(["translated:quickAction.openingArchive"]);
    expect(harness.calls.handledRequests).toEqual([request]);
  });

  it("binds desktop launch events and routes their payload", async () => {
    const harness = createHarness();
    const request = quickActionRequest({ kind: "compressZip" });

    await harness.controller.bindQuickActionLaunchEvents();
    harness.emitQuickActionLaunch(startupState({
      launchedForQuickAction: true,
      quickAction: request,
    }));
    await Promise.resolve();

    expect(harness.listenQuickActionLaunch).toHaveBeenCalledTimes(1);
    expect(harness.calls.statuses).toEqual(["translated:quickAction.starting"]);
    expect(harness.calls.handledRequests).toEqual([request]);
  });

  it("skips launch event binding outside desktop runtime", async () => {
    const harness = createHarness();
    harness.setDesktopRuntime(false);

    await harness.controller.bindQuickActionLaunchEvents();

    expect(harness.listenQuickActionLaunch).not.toHaveBeenCalled();
  });

  it("initializes desktop runtime by binding launch events then handling startup", async () => {
    const order: string[] = [];
    const harness = createHarness({
      async listenQuickActionLaunch() {
        order.push("bind");
      },
      async fetchQuickActionStartupState() {
        order.push("startup");
        return startupState({ launchedForQuickAction: false });
      },
    });

    await harness.controller.initializeDesktopRuntime();

    expect(order).toEqual(["bind", "startup"]);
    expect(harness.calls.revealQuickActionStates).toHaveLength(1);
  });

  it("reports initialization failures and reveals the normal window", async () => {
    const harness = createHarness({
      async listenQuickActionLaunch() {
        throw new Error("listen failed");
      },
    });

    await harness.controller.initializeDesktopRuntime();

    expect(harness.calls.statuses).toEqual([
      "translated:desktopIntegration.initFailed: listen failed",
    ]);
    expect(harness.calls.revealNormal).toBe(1);
  });

  it("loads bootstrap state in parallel and notifies after ready bootstrap state", async () => {
    const order: string[] = [];
    const readyHealthcheck = healthcheck({ ready: true });
    const readyContract = contract();
    const harness = createHarness({
      async fetchHealthcheck() {
        order.push("healthcheck");
        return readyHealthcheck;
      },
      async fetchProjectContract() {
        order.push("contract");
        return readyContract;
      },
    });

    await harness.controller.loadBootstrapState();

    expect(order).toEqual(["healthcheck", "contract"]);
    expect(harness.calls.bootstrapStates).toEqual([{
      healthcheck: readyHealthcheck,
      contract: readyContract,
    }]);
    expect(harness.calls.statuses).toEqual(["translated:status.ready"]);
    expect(harness.calls.bootstrapNotifications).toBe(1);
  });

  it("sets backend unavailable when bootstrap healthcheck is not ready", async () => {
    const harness = createHarness({
      async fetchHealthcheck() {
        return healthcheck({ ready: false });
      },
    });

    await harness.controller.loadBootstrapState();

    expect(harness.calls.statuses).toEqual(["translated:status.backendUnavailable"]);
  });

  it("uses command errors for desktop bootstrap failures", async () => {
    const harness = createHarness({
      async fetchHealthcheck() {
        throw commandError({ message: "Command backend unavailable" });
      },
    });

    await harness.controller.loadBootstrapState();

    expect(harness.calls.bootstrapStates).toEqual([{ healthcheck: null, contract: null }]);
    expect(harness.calls.statuses).toEqual(["Command backend unavailable"]);
    expect(harness.calls.messages).toEqual([]);
    expect(harness.calls.bootstrapNotifications).toBe(1);
  });

  it("uses the unknown backend fallback for non-command desktop bootstrap failures", async () => {
    const harness = createHarness({
      async fetchProjectContract() {
        throw new Error("contract failed");
      },
    });

    await harness.controller.loadBootstrapState();

    expect(harness.calls.statuses).toEqual([
      "translated:status.backendUnavailable: contract failed",
    ]);
  });

  it("uses browser preview status messaging for browser bootstrap failures", async () => {
    const harness = createHarness({
      async fetchHealthcheck() {
        throw new Error("browser fetch failed");
      },
    });
    harness.setDesktopRuntime(false);

    await harness.controller.loadBootstrapState();

    expect(harness.calls.statuses).toEqual([]);
    expect(harness.calls.messages).toEqual(["status.readyBrowserPreview"]);
    expect(harness.calls.bootstrapStates).toEqual([{ healthcheck: null, contract: null }]);
  });

  it("notifies after bootstrap success and failure", async () => {
    const successHarness = createHarness();
    await successHarness.controller.loadBootstrapState();

    const failureHarness = createHarness({
      async fetchHealthcheck() {
        throw new Error("down");
      },
    });
    await failureHarness.controller.loadBootstrapState();

    expect(successHarness.calls.bootstrapNotifications).toBe(1);
    expect(failureHarness.calls.bootstrapNotifications).toBe(1);
  });
});
