import {
  openPath as openWithOpener,
  openUrl as openUrlWithOpener,
  revealItemInDir,
} from "@tauri-apps/plugin-opener";

export async function openDesktopPath(path: string): Promise<void> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    await openUrlWithOpener(path);
  } else {
    await openWithOpener(path);
  }
}

export async function revealInFileManager(path: string): Promise<void> {
  await revealItemInDir(path);
}
