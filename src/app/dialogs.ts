export type NativeDialogFilter = {
  name: string;
  extensions: string[];
};

export type NativeDialogOpenOptions = {
  title?: string;
  filters?: NativeDialogFilter[];
  defaultPath?: string;
  multiple?: boolean;
  directory?: boolean;
  recursive?: boolean;
  canCreateDirectories?: boolean;
};

export type NativeDialogSaveOptions = {
  title?: string;
  filters?: NativeDialogFilter[];
  defaultPath?: string;
  canCreateDirectories?: boolean;
};

export type NativeOpenDialogResult = string | string[] | null;
export type NativeSaveDialogResult = string | null;

export type NativeOpenDialogFn = (options: NativeDialogOpenOptions) => Promise<NativeOpenDialogResult>;
export type NativeSaveDialogFn = (options: NativeDialogSaveOptions) => Promise<NativeSaveDialogResult>;
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

  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
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
  openDialog: NativeOpenDialogFn,
  options: NativeDialogOpenOptions,
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
  saveDialog: NativeSaveDialogFn,
  options: NativeDialogSaveOptions,
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
