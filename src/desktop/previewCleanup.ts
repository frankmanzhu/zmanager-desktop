import { cleanupPreviewRoots as cleanupPreviewRootsCommand } from "../api/commands";

export interface PreviewCleanupWindow {
  onpagehide: ((event?: unknown) => unknown) | null;
  onbeforeunload: ((event?: unknown) => unknown) | null;
}

export interface PreviewCleanupBindingOptions {
  windowRef?: PreviewCleanupWindow;
}

function browserWindow(): PreviewCleanupWindow | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as PreviewCleanupWindow);
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

  const previousPageHide = windowRef.onpagehide;
  const previousBeforeUnload = windowRef.onbeforeunload;
  const pageHide = (event?: unknown) => {
    previousPageHide?.call(windowRef, event);
    handler();
  };
  const beforeUnload = (event?: unknown) => {
    previousBeforeUnload?.call(windowRef, event);
    handler();
  };
  windowRef.onpagehide = pageHide;
  windowRef.onbeforeunload = beforeUnload;

  return () => {
    if (windowRef.onpagehide === pageHide) {
      windowRef.onpagehide = previousPageHide;
    }
    if (windowRef.onbeforeunload === beforeUnload) {
      windowRef.onbeforeunload = previousBeforeUnload;
    }
  };
}
