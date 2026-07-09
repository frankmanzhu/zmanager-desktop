import { listen } from "@tauri-apps/api/event";

import type { QuickActionStartupStateDto } from "../api/types";

export type QuickActionLaunchEvent = Readonly<{
  payload: QuickActionStartupStateDto;
}>;

export function listenQuickActionLaunch(
  listener: (event: QuickActionLaunchEvent) => void,
): Promise<() => void> {
  return listen<QuickActionStartupStateDto>("zmanager-quick-action", listener);
}
