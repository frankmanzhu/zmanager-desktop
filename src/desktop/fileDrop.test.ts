import { describe, expect, it, vi } from "vitest";

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import {
  bindDesktopFileDrop,
  createDesktopFileDropBinder,
  type DesktopFileDropEvent,
  type DesktopFileDropWebview,
} from "./fileDrop";

type DesktopFileDropDropEvent = Extract<DesktopFileDropEvent, { type: "drop" }>;
const dropPosition = { x: 0, y: 0 } as DesktopFileDropDropEvent["position"];

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(),
}));

function createFakeWebview() {
  let dragDropHandler: ((event: { payload: DesktopFileDropEvent }) => void) | null = null;
  const unlisten = vi.fn();
  const webview: DesktopFileDropWebview = {
    onDragDropEvent: vi.fn(async (handler) => {
      dragDropHandler = handler;
      return unlisten;
    }),
  };

  return {
    webview,
    unlisten,
    emit(payload: DesktopFileDropEvent) {
      dragDropHandler?.({ payload });
    },
  };
}

describe("desktop file drop adapter", () => {
  it("does not bind webview drag events outside the desktop runtime", async () => {
    const getWebview = vi.fn();
    const normalizePaths = vi.fn((paths: readonly string[]) => [...paths]);
    const bindFileDrop = createDesktopFileDropBinder({
      getCurrentWebview: getWebview,
      isDesktopRuntime: () => false,
      normalizePaths,
    });

    const unlisten = await bindFileDrop(vi.fn());
    unlisten();

    expect(getWebview).not.toHaveBeenCalled();
    expect(normalizePaths).not.toHaveBeenCalled();
  });

  it("forwards non-drop drag events without normalizing paths", async () => {
    const fakeWebview = createFakeWebview();
    const normalizePaths = vi.fn((paths: readonly string[]) => [...paths]);
    const onDropEvent = vi.fn();
    const bindFileDrop = createDesktopFileDropBinder({
      getCurrentWebview: () => fakeWebview.webview,
      isDesktopRuntime: () => true,
      normalizePaths,
    });
    const dragEvent = { type: "enter", paths: ["C:\\incoming\\archive.zip"] } as DesktopFileDropEvent;

    await bindFileDrop(onDropEvent);
    fakeWebview.emit(dragEvent);

    expect(onDropEvent).toHaveBeenCalledWith(dragEvent);
    expect(normalizePaths).not.toHaveBeenCalled();
  });

  it("normalizes drop paths before forwarding the drop event", async () => {
    const fakeWebview = createFakeWebview();
    const normalizePaths = vi.fn(() => ["C:\\incoming\\archive.zip"]);
    const onDropEvent = vi.fn();
    const bindFileDrop = createDesktopFileDropBinder({
      getCurrentWebview: () => fakeWebview.webview,
      isDesktopRuntime: () => true,
      normalizePaths,
    });
    const dropEvent: DesktopFileDropDropEvent = {
      type: "drop",
      paths: [" file:///C:/incoming/archive.zip ", ""],
      position: dropPosition,
    };

    const unlisten = await bindFileDrop(onDropEvent);
    fakeWebview.emit(dropEvent);
    unlisten();

    expect(normalizePaths).toHaveBeenCalledWith(dropEvent.paths);
    expect(onDropEvent).toHaveBeenCalledWith({
      ...dropEvent,
      paths: ["C:\\incoming\\archive.zip"],
    });
    expect(fakeWebview.unlisten).toHaveBeenCalledTimes(1);
  });

  it("uses the Tauri runtime check and current webview in the default adapter", async () => {
    const fakeWebview = createFakeWebview();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getCurrentWebview).mockReturnValue(fakeWebview.webview as never);
    const onDropEvent = vi.fn();

    await bindDesktopFileDrop(onDropEvent);
    fakeWebview.emit({
      type: "drop",
      paths: ["file:///C:/incoming/archive.zip"],
      position: dropPosition,
    });

    expect(getCurrentWebview).toHaveBeenCalledTimes(1);
    expect(onDropEvent).toHaveBeenCalledWith({
      type: "drop",
      paths: ["C:\\incoming\\archive.zip"],
      position: dropPosition,
    });
  });
});
