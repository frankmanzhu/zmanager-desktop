import type { QuickActionRequestDto } from "../../api/types";
import {
  quickActionWindowDisposition,
  type QuickActionWindowDisposition,
} from "../quickActions";

export type QuickActionLaunchDispositionEffects = Readonly<{
  observeDisposableTaskLaunch(): void;
  beginDisposableTaskRequest(): void;
  endDisposableTaskRequest(): void;
  revealMainWindow(): Promise<void>;
  onDispositionApplied(disposition: QuickActionWindowDisposition): void;
  execute(request: QuickActionRequestDto): Promise<void>;
  onDisposableTaskRequestSettled(): void;
}>;

/** Owns window disposition and coordinator activity around one inbound request. */
export async function runInboundQuickAction(
  request: QuickActionRequestDto,
  effects: QuickActionLaunchDispositionEffects,
): Promise<QuickActionWindowDisposition> {
  const disposition = quickActionWindowDisposition(request.kind);
  if (disposition === "disposableTask") {
    effects.observeDisposableTaskLaunch();
    effects.beginDisposableTaskRequest();
  } else {
    await effects.revealMainWindow();
  }
  effects.onDispositionApplied(disposition);

  try {
    await effects.execute(request);
    return disposition;
  } finally {
    if (disposition === "disposableTask") {
      effects.endDisposableTaskRequest();
      effects.onDisposableTaskRequestSettled();
    }
  }
}
