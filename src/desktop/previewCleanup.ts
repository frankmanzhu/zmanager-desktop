import {
  cleanupPreviewRoots as cleanupPreviewRootsCommand,
} from "../api/commands";

export interface PreviewCleanupWindow {
  addEventListener(type: "pagehide" | "beforeunload", listener: () => void): void;
  removeEventListener(type: "pagehide" | "beforeunload", listener: () => void): void;
}

export interface PreviewCleanupBindingOptions {
  windowRef?: PreviewCleanupWindow;
}

function browserWindow(): PreviewCleanupWindow | undefined {
  return typeof window === "undefined" ? undefined : window;
}

export async function cleanupPreviewRoots(): Promise<void> {
  await cleanupPreviewRootsCommand();
}

export function bindPreviewCleanupOnAppClose(
  handler: () => void,
  options: PreviewCleanupBindingOptions = {},
): () => void {
  const windowRef = options.windowRef ?? browserWindow();
  if (!windowRef) {
    return () => undefined;
  }

  windowRef.addEventListener("pagehide", handler);
  windowRef.addEventListener("beforeunload", handler);

  return () => {
    windowRef.removeEventListener("pagehide", handler);
    windowRef.removeEventListener("beforeunload", handler);
  };
}
