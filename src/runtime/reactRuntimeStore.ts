export type ReactRuntimeSnapshotListener<TSnapshot> = (snapshot: TSnapshot) => void;

export type ReactRuntimeStore<TSnapshot> = Readonly<{
  getSnapshot(): TSnapshot;
  publishSnapshot(): void;
  subscribe(listener: ReactRuntimeSnapshotListener<TSnapshot>): () => void;
}>;

export type CreateReactRuntimeStoreOptions<TSnapshot> = Readonly<{
  createSnapshot(): TSnapshot;
}>;

export function createReactRuntimeStore<TSnapshot>(
  options: CreateReactRuntimeStoreOptions<TSnapshot>,
): ReactRuntimeStore<TSnapshot> {
  const subscribers = new Set<ReactRuntimeSnapshotListener<TSnapshot>>();

  function getSnapshot(): TSnapshot {
    return options.createSnapshot();
  }

  return {
    getSnapshot,
    publishSnapshot() {
      if (subscribers.size === 0) {
        return;
      }

      const snapshot = getSnapshot();
      for (const subscriber of subscribers) {
        subscriber(snapshot);
      }
    },
    subscribe(listener) {
      subscribers.add(listener);
      listener(getSnapshot());
      return () => {
        subscribers.delete(listener);
      };
    },
  };
}
