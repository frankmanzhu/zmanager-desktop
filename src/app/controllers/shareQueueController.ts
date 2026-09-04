import {
  cancelShare,
  enqueueShare,
  getShareQueue,
  removeShare,
  setShareReceiver,
  skipShare,
  startShare,
} from "../../api/commands";
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
  listen(listener: () => void): Promise<() => void>;
  publish(): void;
  reportError(error: unknown): void;
}>;

const EMPTY_SNAPSHOT: ShareRegistrySnapshot = { queueRevision: "0", items: [] };

export function createShareQueueController(options: Options): ShareQueueController {
  let snapshot = EMPTY_SNAPSHOT;
  let disposed = false;
  let loadChain = Promise.resolve();

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
      const next = await getShareQueue();
      if (!disposed) apply(next);
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

  async function runMutation(operation: () => Promise<ShareRecordSnapshot | void>): Promise<void> {
    await operation();
    await load();
  }

  return {
    getSnapshot: () => snapshot,
    initialize,
    handleQueueHint,
    enqueue: async (request) => {
      const response = await enqueueShare(request);
      await load();
      return response;
    },
    setReceiver: (shareId, receiver) => runMutation(() => setShareReceiver({ shareId, receiver })),
    start: (shareId, acknowledgeDeliveryUncertainty = false) => runMutation(() => startShare({ shareId, acknowledgeDeliveryUncertainty })),
    skip: (shareId) => runMutation(() => skipShare({ shareId })),
    cancel: (shareId) => runMutation(() => cancelShare({ shareId })),
    remove: (shareId) => runMutation(() => removeShare({ shareId })),
  };
}
