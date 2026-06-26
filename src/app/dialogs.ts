import type { OpenDialogOptions, SaveDialogOptions } from "@tauri-apps/plugin-dialog";

type OpenDialogFn = (options: OpenDialogOptions) => Promise<string | string[] | null>;
type SaveDialogFn = (options: SaveDialogOptions) => Promise<string | null>;
type StatusReporter = (message: string) => void;

export function unknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export function nativeDialogErrorMessage(isDesktop: boolean, error: unknown): string {
  if (!isDesktop) {
    return "Native dialogs are unavailable in browser preview.";
  }

  return unknownErrorMessage(error, "Native dialog failed.");
}

export async function runNativeOpenDialog(
  openDialog: OpenDialogFn,
  options: OpenDialogOptions,
  isDesktop: boolean,
  reportStatus: StatusReporter,
) {
  try {
    return await openDialog(options);
  } catch (error) {
    reportStatus(nativeDialogErrorMessage(isDesktop, error));
    return null;
  }
}

export async function runNativeSaveDialog(
  saveDialog: SaveDialogFn,
  options: SaveDialogOptions,
  isDesktop: boolean,
  reportStatus: StatusReporter,
) {
  try {
    return await saveDialog(options);
  } catch (error) {
    reportStatus(nativeDialogErrorMessage(isDesktop, error));
    return null;
  }
}
