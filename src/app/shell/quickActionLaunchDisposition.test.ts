import { describe, expect, it, vi } from "vitest";

import { createDisposableTaskLifecycle } from "./disposableTaskLifecycle";
import { runInboundQuickAction } from "./quickActionLaunchDisposition";

const idle = {
  desktopRuntime: true,
  hasOpenTaskWindows: false,
  hasActiveJobs: false,
  mainWindowShown: false,
};

describe("quick-action launch disposition", () => {
  it("keeps fixed-format quick actions off the Main Window and makes the coordinator disposable", async () => {
    const lifecycle = createDisposableTaskLifecycle();
    const revealMainWindow = vi.fn(async () => lifecycle.observeNormalLaunch());

    const disposition = await runInboundQuickAction(
      { kind: "compressTzap", paths: ["C:/source"] },
      {
        observeDisposableTaskLaunch: lifecycle.observeQuickActionLaunch,
        beginDisposableTaskRequest: lifecycle.beginQuickActionRequest,
        endDisposableTaskRequest: lifecycle.endQuickActionRequest,
        revealMainWindow,
        onDispositionApplied: vi.fn(),
        execute: vi.fn(async () => {}),
        onDisposableTaskRequestSettled: vi.fn(),
      },
    );

    expect(disposition).toBe("disposableTask");
    expect(revealMainWindow).not.toHaveBeenCalled();
    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(true);
  });

  it("reveals and retains the Main Window for Add to archive", async () => {
    const lifecycle = createDisposableTaskLifecycle();
    const revealMainWindow = vi.fn(async () => lifecycle.observeNormalLaunch());

    const disposition = await runInboundQuickAction(
      { kind: "compress", paths: ["C:/source"] },
      {
        observeDisposableTaskLaunch: lifecycle.observeQuickActionLaunch,
        beginDisposableTaskRequest: lifecycle.beginQuickActionRequest,
        endDisposableTaskRequest: lifecycle.endQuickActionRequest,
        revealMainWindow,
        onDispositionApplied: vi.fn(),
        execute: vi.fn(async () => {}),
        onDisposableTaskRequestSettled: vi.fn(),
      },
    );

    expect(disposition).toBe("mainWindow");
    expect(revealMainWindow).toHaveBeenCalledOnce();
    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(false);
  });

  it("does not turn an existing normal session into a disposable coordinator", async () => {
    const lifecycle = createDisposableTaskLifecycle();
    lifecycle.observeNormalLaunch();

    await runInboundQuickAction(
      { kind: "extractHere", paths: ["C:/archive.zip"] },
      {
        observeDisposableTaskLaunch: lifecycle.observeQuickActionLaunch,
        beginDisposableTaskRequest: lifecycle.beginQuickActionRequest,
        endDisposableTaskRequest: lifecycle.endQuickActionRequest,
        revealMainWindow: vi.fn(async () => {}),
        onDispositionApplied: vi.fn(),
        execute: vi.fn(async () => {}),
        onDisposableTaskRequestSettled: vi.fn(),
      },
    );

    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(false);
  });

  it("settles disposable ownership when request execution fails before a job starts", async () => {
    const lifecycle = createDisposableTaskLifecycle();
    const settled = vi.fn();

    await expect(runInboundQuickAction(
      { kind: "compressZip", paths: ["C:/source"] },
      {
        observeDisposableTaskLaunch: lifecycle.observeQuickActionLaunch,
        beginDisposableTaskRequest: lifecycle.beginQuickActionRequest,
        endDisposableTaskRequest: lifecycle.endQuickActionRequest,
        revealMainWindow: vi.fn(async () => {}),
        onDispositionApplied: vi.fn(),
        execute: vi.fn(async () => { throw new Error("start failed"); }),
        onDisposableTaskRequestSettled: settled,
      },
    )).rejects.toThrow("start failed");

    expect(settled).toHaveBeenCalledOnce();
    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(true);
  });
});
