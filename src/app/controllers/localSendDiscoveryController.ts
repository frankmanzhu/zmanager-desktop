import type { LocalSendDeviceInfoDto } from "../../api/types";

export type LocalSendDiscoverySnapshot = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  devices: readonly LocalSendDeviceInfoDto[];
  error: string | null;
}>;

export type LocalSendDiscoveryController = Readonly<{
  getSnapshot(): LocalSendDiscoverySnapshot;
  refresh(alias: string): Promise<LocalSendDiscoverySnapshot>;
}>;

type Options = Readonly<{
  discover(alias: string): Promise<LocalSendDeviceInfoDto[]>;
  publish(snapshot: LocalSendDiscoverySnapshot): void;
  errorMessage(error: unknown): string;
}>;

const EMPTY: LocalSendDiscoverySnapshot = Object.freeze({
  status: "idle",
  devices: Object.freeze([]),
  error: null,
});

export function createLocalSendDiscoveryController(options: Options): LocalSendDiscoveryController {
  let snapshot = EMPTY;

  function update(next: LocalSendDiscoverySnapshot): LocalSendDiscoverySnapshot {
    snapshot = Object.freeze({ ...next, devices: Object.freeze([...next.devices]) });
    options.publish(snapshot);
    return snapshot;
  }

  return {
    getSnapshot: () => snapshot,
    refresh: async (alias) => {
      update({ ...snapshot, status: "loading", error: null });
      try {
        const devices = await options.discover(alias);
        return update({ status: "ready", devices, error: null });
      } catch (error) {
        return update({ ...snapshot, status: "error", error: options.errorMessage(error) });
      }
    },
  };
}
