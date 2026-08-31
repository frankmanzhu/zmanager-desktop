export type LocalSendTrustSnapshot = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  fingerprints: readonly string[];
  error: string | null;
}>;

export type LocalSendTrustController = Readonly<{
  getSnapshot(): LocalSendTrustSnapshot;
  refresh(): Promise<LocalSendTrustSnapshot>;
  forget(fingerprint: string): Promise<LocalSendTrustSnapshot>;
}>;

type Options = Readonly<{
  list(): Promise<string[]>;
  untrust(fingerprint: string): Promise<string[]>;
  publish(snapshot: LocalSendTrustSnapshot): void;
  errorMessage(error: unknown): string;
}>;

const EMPTY: LocalSendTrustSnapshot = Object.freeze({
  status: "idle",
  fingerprints: Object.freeze([]),
  error: null,
});

export function createLocalSendTrustController(options: Options): LocalSendTrustController {
  let snapshot = EMPTY;

  function update(next: LocalSendTrustSnapshot): LocalSendTrustSnapshot {
    snapshot = Object.freeze({ ...next, fingerprints: Object.freeze([...next.fingerprints]) });
    options.publish(snapshot);
    return snapshot;
  }

  async function run(effect: () => Promise<string[]>) {
    update({ ...snapshot, status: "loading", error: null });
    try {
      const fingerprints = await effect();
      return update({ status: "ready", fingerprints, error: null });
    } catch (error) {
      return update({ ...snapshot, status: "error", error: options.errorMessage(error) });
    }
  }

  return {
    getSnapshot: () => snapshot,
    refresh: () => run(options.list),
    forget: (fingerprint) => run(() => options.untrust(fingerprint)),
  };
}
