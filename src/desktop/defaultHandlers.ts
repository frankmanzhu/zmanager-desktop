import {
  fetchDefaultHandlerStatus,
  restoreDefaultHandlers,
  setDefaultHandlers,
} from "../api/commands";
import type { DefaultHandlerSnapshotDto } from "../api/types";

export type DefaultHandlerDesktopAdapter = Readonly<{
  status(): Promise<DefaultHandlerSnapshotDto>;
  set(): Promise<DefaultHandlerSnapshotDto>;
  restore(): Promise<DefaultHandlerSnapshotDto>;
}>;

export const defaultHandlerDesktopAdapter: DefaultHandlerDesktopAdapter = {
  status: fetchDefaultHandlerStatus,
  set: setDefaultHandlers,
  restore: restoreDefaultHandlers,
};
