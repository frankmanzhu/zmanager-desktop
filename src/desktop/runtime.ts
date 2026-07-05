import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import {
  open as openDialog,
  save as saveDialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "@tauri-apps/plugin-dialog";
import {
  openPath as openWithOpener,
  revealItemInDir,
} from "@tauri-apps/plugin-opener";
import {
  runNativeOpenDialog,
  runNativeSaveDialog,
  type NativeDialogErrorMessages,
} from "../app/dialogs";
import { normalizeDroppedPaths } from "./paths";

type StatusReporter = (message: string) => void;

export type DesktopFileDropEvent = DragDropEvent;
export type { OpenDialogOptions, SaveDialogOptions };

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export async function openNativeDialog(
  options: OpenDialogOptions,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  return runNativeOpenDialog(openDialog, options, isDesktopRuntime(), reportStatus, messages);
}

export async function saveNativeDialog(
  options: SaveDialogOptions,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  return runNativeSaveDialog(saveDialog, options, isDesktopRuntime(), reportStatus, messages);
}

export async function bindDesktopFileDrop(
  onDropEvent: (event: DesktopFileDropEvent) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => undefined;
  }

  return getCurrentWebview().onDragDropEvent((event) => {
    const payload = event.payload;
    if (payload.type !== "drop") {
      onDropEvent(payload);
      return;
    }

    const dropPaths = normalizeDroppedPaths(payload.paths);
    onDropEvent({
      ...payload,
      paths: dropPaths,
    });
  });
}

export async function openDesktopPath(path: string): Promise<void> {
  await openWithOpener(path);
}

export async function revealInFileManager(path: string): Promise<void> {
  await revealItemInDir(path);
}
