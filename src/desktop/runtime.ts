import { isTauri } from "@tauri-apps/api/core";
import {
  open as openDialog,
  save as saveDialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "@tauri-apps/plugin-dialog";
import {
  runNativeOpenDialog,
  runNativeSaveDialog,
  type NativeDialogErrorMessages,
  type NativeDialogOpenOptions,
  type NativeDialogSaveOptions,
  type NativeOpenDialogResult,
  type NativeSaveDialogResult,
} from "../app/dialogs";

type StatusReporter = (message: string) => void;

export function isDesktopRuntime(): boolean {
  return isTauri();
}

async function openTauriDialog(options: NativeDialogOpenOptions): Promise<NativeOpenDialogResult> {
  return openDialog(options satisfies OpenDialogOptions);
}

async function saveTauriDialog(options: NativeDialogSaveOptions): Promise<NativeSaveDialogResult> {
  return saveDialog(options satisfies SaveDialogOptions);
}

export async function openNativeDialog(
  options: NativeDialogOpenOptions,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  return runNativeOpenDialog(openTauriDialog, options, isDesktopRuntime(), reportStatus, messages);
}

export async function saveNativeDialog(
  options: NativeDialogSaveOptions,
  reportStatus: StatusReporter,
  messages: NativeDialogErrorMessages,
) {
  return runNativeSaveDialog(saveTauriDialog, options, isDesktopRuntime(), reportStatus, messages);
}
