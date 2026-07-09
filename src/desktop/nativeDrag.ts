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
