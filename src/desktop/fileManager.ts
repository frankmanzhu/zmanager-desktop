import {
  openPath as openWithOpener,
  revealItemInDir,
} from "@tauri-apps/plugin-opener";

export async function openDesktopPath(path: string): Promise<void> {
  await openWithOpener(path);
}

export async function revealInFileManager(path: string): Promise<void> {
  await revealItemInDir(path);
}
