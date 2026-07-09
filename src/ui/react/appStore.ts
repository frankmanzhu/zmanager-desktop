import { useSyncExternalStore } from "react";

import {
  createInitialZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactActions,
  type ZManagerReactSnapshot,
} from "./appRuntime";

export type ZManagerAppStore = Readonly<{
  getSnapshot(): ZManagerReactSnapshot;
  subscribe(listener: () => void): () => void;
  publish(snapshot: ZManagerReactSnapshot): void;
  getActions(): ZManagerReactActions;
  setActions(actions: ZManagerReactActions): void;
}>;

export function createZManagerAppStore(
  initialSnapshot: ZManagerReactSnapshot = createInitialZManagerReactSnapshot(),
  initialActions: ZManagerReactActions = noopZManagerReactActions,
): ZManagerAppStore {
  let snapshot = initialSnapshot;
  let actions = initialActions;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    publish(nextSnapshot) {
      if (Object.is(snapshot, nextSnapshot)) {
        return;
      }
      snapshot = nextSnapshot;
      emit();
    },

    getActions() {
      return actions;
    },

    setActions(nextActions) {
      actions = nextActions;
    },
  };
}

export function useZManagerStoreSnapshot(store: ZManagerAppStore): ZManagerReactSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
