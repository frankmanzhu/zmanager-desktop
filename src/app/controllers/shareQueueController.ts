import type {
  EnqueueShareRequest,
  EnqueueShareResponse,
  LocalSendDeviceInfoDto,
  ShareRecordSnapshot,
  ShareRegistrySnapshot,
} from "../../api/types";

export type { LocalSendDeviceInfoDto, ShareRecordSnapshot, ShareRegistrySnapshot } from "../../api/types";

export type ShareQueueController = Readonly<{
  getSnapshot(): ShareRegistrySnapshot;
  initialize(): Promise<void>;
  handleQueueHint(): void;
  enqueue(request: EnqueueShareRequest): Promise<EnqueueShareResponse>;
  setReceiver(shareId: string, receiver: LocalSendDeviceInfoDto): Promise<void>;
  start(shareId: string, acknowledgeDeliveryUncertainty?: boolean): Promise<void>;
  skip(shareId: string): Promise<void>;
  cancel(shareId: string): Promise<void>;
  remove(shareId: string): Promise<void>;
}>;

type Options = Readonly<{
  api: Readonly<{
    enqueueShare(request: EnqueueShareRequest): Promise<EnqueueShareResponse>;
    getShareQueue(): Promise<ShareRegistrySnapshot>;
    setShareReceiver(request: { shareId: string; receiver: LocalSendDeviceInfoDto }): Promise<ShareRecordSnapshot>;
    startShare(request: { shareId: string; acknowledgeDeliveryUncertainty: boolean }): Promise<ShareRecordSnapshot>;
    skipShare(request: { shareId: string }): Promise<ShareRecordSnapshot>;
    cancelShare(request: { shareId: string }): Promise<ShareRecordSnapshot>;
    removeShare(request: { shareId: string }): Promise<void>;
  }>;
  reveal(): Promise<void>;
  listen(listener: () => void): Promise<() => void>;
  publish(): void;
  reportError(error: unknown): void;
}>;

const EMPTY_SNAPSHOT: ShareRegistrySnapshot = { queueRevision: "0", items: [] };

export function createShareQueueController(options: Options): ShareQueueController {
  let snapshot = EMPTY_SNAPSHOT;

  let loadChain = Promise.resolve();
  const mutations = new Map<string, Promise<void>>();

  function revision(value: string): bigint {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  function apply(next: ShareRegistrySnapshot): void {
    if (revision(next.queueRevision) <= revision(snapshot.queueRevision)) {
      return;
    }
    snapshot = {
      queueRevision: next.queueRevision,
      items: [...next.items],
    };
    options.publish();
  }

  function load(): Promise<void> {
    loadChain = loadChain.then(async () => {
      const next = await options.api.getShareQueue();
      apply(next);
    }).catch(options.reportError);
    return loadChain;
  }

  async function initialize(): Promise<void> {
    await options.listen(handleQueueHint);
    await load();
  }

  function handleQueueHint(): void {
    void load();
  }

  function runMutation(key: string, operation: () => Promise<ShareRecordSnapshot | void>): Promise<void> {
    const pending = mutations.get(key);
    if (pending) return pending;
    const task = (async () => {
      try {
        await operation();
      } finally {
        await load();
        mutations.delete(key);
      }
    })();
    mutations.set(key, task);
    return task;
  }

  return {
    getSnapshot: () => snapshot,
    initialize,
    handleQueueHint,
    enqueue: async (request) => {
      const response = await options.api.enqueueShare(request);
      await load();
      await options.reveal();
      return response;
    },
    setReceiver: (shareId, receiver) => runMutation(`setReceiver:${shareId}`, () => options.api.setShareReceiver({ shareId, receiver })),
    start: (shareId, acknowledgeDeliveryUncertainty = false) => runMutation(`start:${shareId}`, () => options.api.startShare({ shareId, acknowledgeDeliveryUncertainty })),
    skip: (shareId) => runMutation(`skip:${shareId}`, () => options.api.skipShare({ shareId })),
    cancel: (shareId) => runMutation(`cancel:${shareId}`, () => options.api.cancelShare({ shareId })),
    remove: (shareId) => runMutation(`remove:${shareId}`, () => options.api.removeShare({ shareId })),
  };
}
