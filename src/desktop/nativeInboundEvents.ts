import { listen, type Event } from "@tauri-apps/api/event";

import type { NativeInboundEvent } from "../api/generated/nativeInboundEvents.generated";

export const NATIVE_INBOUND_EVENT_NAME = "zmanager-native-inbound-event";

export type NativeInboundEventEnvelope = Event<NativeInboundEvent>;

export function listenNativeInboundEvents(
  listener: (event: NativeInboundEventEnvelope) => void,
): Promise<() => void> {
  return listen<NativeInboundEvent>(NATIVE_INBOUND_EVENT_NAME, listener);
}
