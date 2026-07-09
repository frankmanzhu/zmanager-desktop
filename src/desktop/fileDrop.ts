import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";

import { normalizeDroppedPaths } from "./paths";

export type DesktopFileDropEvent = DragDropEvent;
export type DesktopFileDropUnlisten = () => void;

type DesktopFileDropCallback = (event: DesktopFileDropEvent) => void;

type DesktopFileDropSourceEvent = {
  payload: DesktopFileDropEvent;
};

export type DesktopFileDropWebview = {
  onDragDropEvent(
    callback: (event: DesktopFileDropSourceEvent) => void,
  ): Promise<DesktopFileDropUnlisten>;
};

type DesktopFileDropBinderOptions = {
  getCurrentWebview: () => DesktopFileDropWebview;
  isDesktopRuntime: () => boolean;
  normalizePaths: (paths: readonly string[]) => string[];
};

export function createDesktopFileDropBinder({
  getCurrentWebview,
  isDesktopRuntime,
  normalizePaths,
}: DesktopFileDropBinderOptions) {
  return async function bindDesktopFileDrop(
    onDropEvent: DesktopFileDropCallback,
  ): Promise<DesktopFileDropUnlisten> {
    if (!isDesktopRuntime()) {
      return () => undefined;
    }

    return getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type !== "drop") {
        onDropEvent(payload);
        return;
      }

      const dropPaths = normalizePaths(payload.paths);
      onDropEvent({
        ...payload,
        paths: dropPaths,
      });
    });
  };
}

export const bindDesktopFileDrop = createDesktopFileDropBinder({
  getCurrentWebview,
  isDesktopRuntime: isTauri,
  normalizePaths: normalizeDroppedPaths,
});
