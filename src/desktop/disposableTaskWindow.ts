import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";


export async function announceDisposableTaskReady(): Promise<void> {
  await getCurrentWebviewWindow().emit("zmanager-task-ready");
}

export async function listenDisposableTaskCloseRequested(
  listener: () => void,
): Promise<() => void> {
  return getCurrentWebviewWindow().onCloseRequested((event) => {
    event.preventDefault();
    listener();
  });
}

export async function closeDisposableTaskWindow(): Promise<void> {
  await getCurrentWebviewWindow().destroy();
}

export async function minimizeDisposableTaskWindow(): Promise<void> {
  await getCurrentWebviewWindow().minimize();
}
