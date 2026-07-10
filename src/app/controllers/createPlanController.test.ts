import { describe, expect, it, vi } from "vitest";

import type { CreatePlanResponse } from "../../api/types";
import { createCreateWorkspace } from "../workspaces/createWorkspace";
import {
  createCreatePlanController,
  type CreatePlanControllerOptions,
} from "./createPlanController";

function createPlan(overrides: Partial<CreatePlanResponse> = {}): CreatePlanResponse {
  return {
    includedCount: 1,
    excludedCount: 0,
    totalBytes: 12,
    excludedBytes: 0,
    entries: ["project/readme.md"],
    planEntries: [{
      path: "project/readme.md",
      kind: "file",
      size: 12,
      sourcePath: "C:/work/project/readme.md",
    }],
    excludedEntries: [],
    warnings: [],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createHarness(overrides: Partial<CreatePlanControllerOptions> = {}) {
  const workspace = createCreateWorkspace();
  let scheduledCallback: (() => void) | null = null;
  const calls = {
    cancel: 0,
    schedule: 0,
    sync: 0,
    published: [] as ReturnType<typeof workspace.getSnapshot>[],
    statuses: [] as string[],
    browserPreviewSources: [] as string[][],
  };
  const runPlanCreate = vi.fn(async () => createPlan());

  const controller = createCreatePlanController({
    workspace,
    debounceTimer: {
      cancel() {
        calls.cancel += 1;
        scheduledCallback = null;
      },
      schedule(callback) {
        calls.schedule += 1;
        scheduledCallback = callback;
      },
    },
    runPlanCreate,
    syncSources(snapshot) {
      calls.sync += 1;
      return snapshot;
    },
    publishSnapshot(snapshot) {
      calls.published.push(snapshot);
      calls.statuses.push(snapshot.plan.status?.fallbackText ?? snapshot.plan.status?.messageKey ?? "");
    },
    canUseBrowserPreview() {
      return false;
    },
    browserPreview(sources) {
      calls.browserPreviewSources.push([...sources]);
      return createPlan();
    },
    toCommandError(error) {
      return error instanceof Error ? { message: error.message } : null;
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    runPlanCreate,
    workspace,
    flushScheduled() {
      const callback = scheduledCallback;
      scheduledCallback = null;
      callback?.();
    },
    hasScheduled() {
      return scheduledCallback !== null;
    },
  };
}

describe("create plan controller", () => {
  it("renders no-sources queue state without scheduling or calling the API", () => {
    const harness = createHarness();

    harness.controller.queuePlanRun();

    expect(harness.calls.cancel).toBe(1);
    expect(harness.calls.schedule).toBe(0);
    expect(harness.hasScheduled()).toBe(false);
    expect(harness.runPlanCreate).not.toHaveBeenCalled();
    expect(harness.calls.statuses).toEqual(["create.plan.noSources"]);
    expect(harness.calls.published).toHaveLength(1);
  });

  it("schedules a debounced run for non-empty sources", () => {
    const harness = createHarness();
    harness.workspace.addSources(["C:/work/project"]);

    harness.controller.queuePlanRun();

    expect(harness.calls.cancel).toBe(1);
    expect(harness.calls.schedule).toBe(1);
    expect(harness.hasScheduled()).toBe(true);
    expect(harness.calls.statuses).toEqual(["create.plan.planning"]);
    expect(harness.runPlanCreate).not.toHaveBeenCalled();
  });

  it("cancels a queued run without invoking the API", () => {
    const harness = createHarness();
    harness.workspace.addSources(["C:/work/project"]);
    harness.controller.queuePlanRun();

    harness.controller.cancelQueuedPlanRun();

    expect(harness.calls.cancel).toBe(2);
    expect(harness.hasScheduled()).toBe(false);
    expect(harness.runPlanCreate).not.toHaveBeenCalled();
  });

  it("runs the API request and accepts the matching result", async () => {
    const harness = createHarness();
    harness.workspace.addSources(["C:/work/project"]);
    harness.runPlanCreate.mockResolvedValueOnce(createPlan({ totalBytes: 99 }));

    await harness.controller.runPlan();

    expect(harness.runPlanCreate).toHaveBeenCalledWith({
      sources: ["C:/work/project"],
      cleanSource: true,
      respectGitignore: false,
      followSymlinks: false,
    });
    expect(harness.workspace.getSnapshot().plan.current?.totalBytes).toBe(99);
    expect(harness.calls.statuses).toEqual(["create.plan.planning", ""]);
    expect(harness.calls.published).toHaveLength(2);
  });

  it("ignores stale async results", async () => {
    const pending = deferred<CreatePlanResponse>();
    const harness = createHarness({
      runPlanCreate: vi.fn(() => pending.promise),
    });
    harness.workspace.addSources(["C:/work/project"]);

    const run = harness.controller.runPlan();
    harness.workspace.queuePlan();
    pending.resolve(createPlan({ totalBytes: 99 }));
    await run;

    expect(harness.workspace.getSnapshot().plan.current).toBeNull();
    expect(harness.calls.published).toHaveLength(1);
  });

  it("uses browser preview without calling the API", async () => {
    const harness = createHarness({
      canUseBrowserPreview: () => true,
    });
    harness.workspace.addSources(["C:/work/project"]);

    await harness.controller.runPlan();

    expect(harness.runPlanCreate).not.toHaveBeenCalled();
    expect(harness.calls.browserPreviewSources).toEqual([["C:/work/project"]]);
    expect(harness.workspace.getSnapshot().plan.current).not.toBeNull();
    expect(harness.calls.published).toHaveLength(2);
  });

  it("maps API errors to accepted fallback plan errors", async () => {
    const harness = createHarness({
      runPlanCreate: vi.fn(async () => {
        throw new Error("planning failed");
      }),
    });
    harness.workspace.addSources(["C:/work/project"]);

    await harness.controller.runPlan();

    expect(harness.workspace.getSnapshot().plan.status).toEqual({
      fallbackText: "planning failed",
    });
    expect(harness.calls.statuses).toEqual(["create.plan.planning", "planning failed"]);
    expect(harness.calls.published).toHaveLength(2);
  });

  it("ignores stale async errors", async () => {
    const pending = deferred<CreatePlanResponse>();
    const harness = createHarness({
      runPlanCreate: vi.fn(() => pending.promise),
    });
    harness.workspace.addSources(["C:/work/project"]);

    const run = harness.controller.runPlan();
    harness.workspace.queuePlan();
    pending.reject(new Error("planning failed"));
    await run;

    expect(harness.workspace.getSnapshot().plan.status).toEqual({
      messageKey: "create.plan.planning",
    });
    expect(harness.calls.statuses).toEqual(["create.plan.planning"]);
    expect(harness.calls.published).toHaveLength(1);
  });
});
