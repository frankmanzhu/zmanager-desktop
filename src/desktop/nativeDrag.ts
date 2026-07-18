import { listen, type Event } from "@tauri-apps/api/event";

import {
  runStartNativeFileDrag,
} from "../api/commands";
import type {
  NativeFileDragRequest,
  NativeFileDragResponse,
} from "../api/types";

export async function startNativeFileDrag(
  request: NativeFileDragRequest,
): Promise<NativeFileDragResponse> {
  return runStartNativeFileDrag(request);
}

export const NATIVE_FILE_DRAG_OUTCOME_EVENT = "native-file-drag-outcome";

export type NativeFileDragOutcomeEvent = {
  sessionId: string;
  outcome: "dropped" | "cancelled";
};

export function listenNativeFileDragOutcomes(
  listener: (event: Event<NativeFileDragOutcomeEvent>) => void,
): Promise<() => void> {
  return listen<NativeFileDragOutcomeEvent>(NATIVE_FILE_DRAG_OUTCOME_EVENT, listener);
}
