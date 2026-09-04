import { listen, type Event } from "@tauri-apps/api/event";

export const SHARE_QUEUE_CHANGED_EVENT_NAME = "zmanager-share-queue-changed";

export function listenShareQueueChanged(
  listener: (event: Event<string>) => void,
): Promise<() => void> {
  return listen<string>(SHARE_QUEUE_CHANGED_EVENT_NAME, listener);
}
