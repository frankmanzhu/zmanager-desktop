import { describe, expect, it } from "vitest";
import { createDisposableTaskLifecycle } from "./disposableTaskLifecycle";

const idle = {
  desktopRuntime: true,
  hasOpenTaskWindows: false,
  hasActiveJobs: false,
  mainWindowShown: false,
};

describe("disposable task lifecycle", () => {
  it("closes a quick-action-only coordinator after work and windows finish", () => {
    const lifecycle = createDisposableTaskLifecycle();
    lifecycle.observeQuickActionLaunch();

    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(true);
    expect(lifecycle.shouldCloseCoordinator({ ...idle, hasActiveJobs: true })).toBe(false);
    expect(lifecycle.shouldCloseCoordinator({ ...idle, hasOpenTaskWindows: true })).toBe(false);
  });

  it("keeps the process when the normal manager owns the session", () => {
    const lifecycle = createDisposableTaskLifecycle();
    lifecycle.observeNormalLaunch();
    lifecycle.observeQuickActionLaunch();

    expect(lifecycle.getSnapshot()).toEqual({
      normalLaunchObserved: true,
      quickActionOnlyCoordinator: false,
    });
    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(false);
  });

  it("allows a hidden manager with active work to become a disposable coordinator", () => {
    const lifecycle = createDisposableTaskLifecycle();
    lifecycle.observeNormalLaunch();
    lifecycle.observeMainWindowHiddenForTasks();

    expect(lifecycle.shouldCloseCoordinator(idle)).toBe(true);
  });
});
