import { describe, expect, it, vi } from "vitest";

import { startZManagerRuntime, type RuntimeStartupOptions } from "./runtimeStartup";

describe("runtime startup", () => {
  it("runs browser startup immediately after rendering the normal workspace", () => {
    const calls: string[] = [];
    const options = createOptions(calls, {
      isDesktopRuntime: () => false,
    });

    startZManagerRuntime(options);

    expect(calls).toEqual([
      "bindWindowLifecycleHandlers",
      "refreshDisplayFromPreferences",
      "loadPathHistory",
      "applyCreatePreferenceDefaults",
      "setInitialBrowseState",
      "installRuntimeDevTools",
      "bindFileDrop",
      "renderNormalWorkspaceOnce",
      "loadLocalDevFixtureFromUrl",
      "loadBootstrapState",
    ]);
  });

  it("waits for desktop initialization before loading fixtures and bootstrap state", async () => {
    const calls: string[] = [];
    let finishInitialize: () => void = () => {
      throw new Error("initializeDesktopRuntime was not called");
    };
    const options = createOptions(calls, {
      isDesktopRuntime: () => true,
      initializeDesktopRuntime: vi.fn(() => new Promise<void>((resolve) => {
        finishInitialize = () => resolve();
      })),
    });

    startZManagerRuntime(options);
    expect(calls).not.toContain("loadBootstrapState");

    finishInitialize?.();
    await Promise.resolve();

    expect(calls.slice(-2)).toEqual([
      "loadLocalDevFixtureFromUrl",
      "loadBootstrapState",
    ]);
    expect(options.renderNormalWorkspaceOnce).not.toHaveBeenCalled();
  });
});

function createOptions(
  calls: string[],
  overrides: Partial<RuntimeStartupOptions> = {},
): RuntimeStartupOptions {
  function effect(name: string) {
    return vi.fn(() => {
      calls.push(name);
    });
  }

  return {
    bindWindowLifecycleHandlers: effect("bindWindowLifecycleHandlers"),
    refreshDisplayFromPreferences: effect("refreshDisplayFromPreferences"),
    loadPathHistory: effect("loadPathHistory"),
    applyCreatePreferenceDefaults: effect("applyCreatePreferenceDefaults"),
    setInitialBrowseState: effect("setInitialBrowseState"),
    installRuntimeDevTools: effect("installRuntimeDevTools"),
    bindFileDrop: effect("bindFileDrop"),
    isDesktopRuntime: () => false,
    initializeDesktopRuntime: vi.fn(async () => {
      calls.push("initializeDesktopRuntime");
    }),
    renderNormalWorkspaceOnce: effect("renderNormalWorkspaceOnce"),
    loadLocalDevFixtureFromUrl: effect("loadLocalDevFixtureFromUrl"),
    loadBootstrapState: effect("loadBootstrapState"),
    ...overrides,
  };
}
