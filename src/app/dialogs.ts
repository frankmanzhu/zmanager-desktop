import type { OpenDialogOptions, SaveDialogOptions } from "@tauri-apps/plugin-dialog";

type OpenDialogFn = (options: OpenDialogOptions) => Promise<string | string[] | null>;
type SaveDialogFn = (options: SaveDialogOptions) => Promise<string | null>;
type StatusReporter = (message: string) => void;
export type NativeDialogErrorMessages = {
  unavailableInBrowser: string;
  failed: string;
};

export function unknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export function nativeDialogErrorMessage(
  isDesktop: boolean,
  error: unknown,
  messages: NativeDialogErrorMessages,
): string {
  if (!isDesktop) {
    return messages.unavailableInBrowser;
  }

  return unknownErrorMessage(error, messages.failed);
}

export async function runNativeOpenDialog(
  openDialog: OpenDialogFn,
  options: OpenDialogOptions,
  isDesktop: boolean,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  try {
    return await openDialog(options);
  } catch (error) {
    reportStatus(nativeDialogErrorMessage(isDesktop, error, messages));
    return null;
  }
}

export async function runNativeSaveDialog(
  saveDialog: SaveDialogFn,
  options: SaveDialogOptions,
  isDesktop: boolean,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  try {
    return await saveDialog(options);
  } catch (error) {
    reportStatus(nativeDialogErrorMessage(isDesktop, error, messages));
    return null;
  }
}
