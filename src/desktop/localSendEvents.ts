import { listen, type Event } from "@tauri-apps/api/event";

import type { LocalSendEventDto } from "../api/types";

export const LOCALSEND_EVENT_NAME = "zmanager-localsend-event";

export type LocalSendEventEnvelope = Event<LocalSendEventDto>;

export function listenLocalSendEvents(
  listener: (event: LocalSendEventEnvelope) => void,
): Promise<() => void> {
  return listen<LocalSendEventDto>(LOCALSEND_EVENT_NAME, listener);
}
