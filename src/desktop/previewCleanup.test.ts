import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupPreviewRoots as cleanupPreviewRootsCommand } from "../api/commands";
import {
  bindPreviewCleanupOnAppClose,
  cleanupPreviewRoots,
  type PreviewCleanupWindow,
} from "./previewCleanup";

vi.mock("../api/commands", () => ({
  cleanupPreviewRoots: vi.fn(async () => undefined),
}));

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function restoreWindow() {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
}

function unsetWindow() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });
}

function createWindowStub(): PreviewCleanupWindow {
  return { onpagehide: null, onbeforeunload: null };
}

afterEach(() => {
  vi.clearAllMocks();
  restoreWindow();
});

describe("desktop preview cleanup adapter", () => {
  it("delegates preview cleanup to the API command", async () => {
    await cleanupPreviewRoots();

    expect(cleanupPreviewRootsCommand).toHaveBeenCalledTimes(1);
  });

  it("binds app-close cleanup to pagehide and beforeunload", () => {
    const handler = vi.fn();
    const windowRef = createWindowStub();

    bindPreviewCleanupOnAppClose(handler, { windowRef });

    windowRef.onpagehide?.();
    windowRef.onbeforeunload?.();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("unbinds pagehide and beforeunload cleanup handlers", () => {
    const handler = vi.fn();
    const windowRef = createWindowStub();

    const unbind = bindPreviewCleanupOnAppClose(handler, { windowRef });
    unbind();

    windowRef.onpagehide?.();
    windowRef.onbeforeunload?.();

    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves existing lifecycle callbacks and does not overwrite later bindings", () => {
    const earlier = vi.fn();
    const later = vi.fn();
    const handler = vi.fn();
    const windowRef = createWindowStub();
    windowRef.onpagehide = earlier;

    const unbind = bindPreviewCleanupOnAppClose(handler, { windowRef });
    windowRef.onpagehide?.();
    windowRef.onpagehide = later;
    unbind();
    windowRef.onpagehide?.();

    expect(earlier).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(later).toHaveBeenCalledOnce();
  });

  it("is a no-op when window is unavailable", () => {
    unsetWindow();
    const handler = vi.fn();

    const unbind = bindPreviewCleanupOnAppClose(handler);
    unbind();

    expect(handler).not.toHaveBeenCalled();
  });
});
