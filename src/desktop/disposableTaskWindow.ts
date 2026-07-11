import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { PollJobEventsResponseDto } from "../api/types";

export async function announceDisposableTaskReady(): Promise<void> {
  await getCurrentWebviewWindow().emit("zmanager-task-ready");
}

export async function listenDisposableTaskUpdates(
  listener: (snapshot: PollJobEventsResponseDto) => void,
): Promise<() => void> {
  return getCurrentWebviewWindow().listen<PollJobEventsResponseDto>(
    "zmanager-task-job-update",
    (event) => listener(event.payload),
  );
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
