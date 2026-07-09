import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupPreviewRoots as cleanupPreviewRootsCommand,
} from "../api/commands";
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

function createWindowStub(): PreviewCleanupWindow & {
  listeners: Map<"pagehide" | "beforeunload", Set<() => void>>;
} {
  const listeners = new Map<"pagehide" | "beforeunload", Set<() => void>>();

  return {
    listeners,
    addEventListener(type, listener): void {
      const typeListeners = listeners.get(type) ?? new Set<() => void>();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener): void {
      listeners.get(type)?.delete(listener);
    },
  };
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

    windowRef.listeners.get("pagehide")?.forEach((listener) => listener());
    windowRef.listeners.get("beforeunload")?.forEach((listener) => listener());

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("unbinds pagehide and beforeunload cleanup handlers", () => {
    const handler = vi.fn();
    const windowRef = createWindowStub();

    const unbind = bindPreviewCleanupOnAppClose(handler, { windowRef });
    unbind();

    windowRef.listeners.get("pagehide")?.forEach((listener) => listener());
    windowRef.listeners.get("beforeunload")?.forEach((listener) => listener());

    expect(handler).not.toHaveBeenCalled();
  });

  it("is a no-op when window is unavailable", () => {
    unsetWindow();
    const handler = vi.fn();

    const unbind = bindPreviewCleanupOnAppClose(handler);
    unbind();

    expect(handler).not.toHaveBeenCalled();
  });
});
