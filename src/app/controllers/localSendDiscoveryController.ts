import type { LocalSendDeviceInfoDto } from "../../api/types";

export type LocalSendDiscoverySnapshot = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  devices: readonly LocalSendDeviceInfoDto[];
  error: string | null;
}>;

export type LocalSendDiscoveryController = Readonly<{
  getSnapshot(): LocalSendDiscoverySnapshot;
  openPicker(alias: string): Promise<LocalSendDiscoverySnapshot>;
  refresh(alias: string): Promise<LocalSendDiscoverySnapshot>;
}>;

type Options = Readonly<{
  now?: () => number;
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
  let refreshGeneration = 0;
  let lastSuccessAt = -Infinity;
  let pending: { alias: string; promise: Promise<LocalSendDiscoverySnapshot> } | null = null;
  const now = options.now ?? Date.now;
  const freshForMs = 30_000;

  function update(next: LocalSendDiscoverySnapshot): LocalSendDiscoverySnapshot {
    snapshot = Object.freeze({ ...next, devices: Object.freeze([...next.devices]) });
    options.publish(snapshot);
    return snapshot;
  }

  function refresh(alias: string): Promise<LocalSendDiscoverySnapshot> {
    if (pending?.alias === alias) return pending.promise;
    const promise = scan(alias);
    pending = { alias, promise };
    void promise.finally(() => { if (pending?.promise === promise) pending = null; });
    return promise;
  }

  async function scan(alias: string): Promise<LocalSendDiscoverySnapshot> {
    const generation = ++refreshGeneration;
    update({ ...snapshot, status: "loading", error: null });
    try {
      const devices = await options.discover(alias);
      if (generation !== refreshGeneration) {
        return snapshot;
      }
      lastSuccessAt = now();
      return update({ status: "ready", devices: [...new Map(devices.map(device => [device.fingerprint, device])).values()], error: null });
    } catch (error) {
      if (generation !== refreshGeneration) {
        return snapshot;
      }
      return update({ ...snapshot, status: "error", error: options.errorMessage(error) });
    }
  }

  return {
    getSnapshot: () => snapshot,
    refresh,
    openPicker: (alias) => snapshot.status === "ready" && snapshot.devices.length > 0 && now() - lastSuccessAt < freshForMs
      ? Promise.resolve(snapshot)
      : refresh(alias),
  };
}
