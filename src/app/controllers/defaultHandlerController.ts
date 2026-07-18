import type { DefaultHandlerEntryDto, DefaultHandlerSnapshotDto } from "../../api/types";

export type DefaultHandlerSnapshot = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  entries: readonly Readonly<DefaultHandlerEntryDto>[];
  canRestore: boolean;
  error: string | null;
}>;

export type DefaultHandlerController = Readonly<{
  getSnapshot(): DefaultHandlerSnapshot;
  refresh(): Promise<DefaultHandlerSnapshot>;
  set(): Promise<DefaultHandlerSnapshot>;
  restore(): Promise<DefaultHandlerSnapshot>;
}>;

type Options = Readonly<{
  status(): Promise<DefaultHandlerSnapshotDto>;
  set(): Promise<DefaultHandlerSnapshotDto>;
  restore(): Promise<DefaultHandlerSnapshotDto>;
  publish(snapshot: DefaultHandlerSnapshot): void;
  errorMessage(error: unknown): string;
}>;

const EMPTY: DefaultHandlerSnapshot = Object.freeze({
  status: "idle",
  entries: Object.freeze([]),
  canRestore: false,
  error: null,
});

export function createDefaultHandlerController(options: Options): DefaultHandlerController {
  let snapshot = EMPTY;

  function update(next: DefaultHandlerSnapshot): DefaultHandlerSnapshot {
    snapshot = Object.freeze({
      ...next,
      entries: Object.freeze(next.entries.map((entry) => Object.freeze({ ...entry }))),
    });
    options.publish(snapshot);
    return snapshot;
  }

  async function run(effect: () => Promise<DefaultHandlerSnapshotDto>) {
    update({ ...snapshot, status: "loading", error: null });
    try {
      const result = await effect();
      return update({
        status: "ready",
        entries: result.entries,
        canRestore: result.canRestore,
        error: null,
      });
    } catch (error) {
      return update({ ...snapshot, status: "error", error: options.errorMessage(error) });
    }
  }

  return {
    getSnapshot: () => snapshot,
    refresh: () => run(options.status),
    set: () => run(options.set),
    restore: () => run(options.restore),
  };
}
