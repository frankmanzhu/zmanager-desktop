import type { DesktopJobSnapshotDto } from "../api/types";
import type { JobFeed, JobFeedSubscription } from "./jobFeed";

type SubscriptionEntry = {
  desired: boolean;
  pending?: Promise<void>;
  subscription?: JobFeedSubscription;
};

export type JobSubscriptionSet = Readonly<{
  ensure(jobId: string): Promise<void>;
  remove(jobId: string): Promise<void>;
  reconcile(jobIds: ReadonlySet<string>): void;
}>;

export function createJobSubscriptionSet(
  feed: JobFeed,
  accept: (jobId: string, snapshot: DesktopJobSnapshotDto) => void,
  removed: (jobId: string) => void,
): JobSubscriptionSet {
  const entries = new Map<string, SubscriptionEntry>();

  async function ensure(jobId: string): Promise<void> {
    const entry = entries.get(jobId) ?? { desired: true };
    entry.desired = true;
    entries.set(jobId, entry);
    if (entry.subscription) return;
    if (entry.pending) return entry.pending;
    entry.pending = (async () => {
      const subscription = await feed.subscribeJob(jobId, (snapshot) => accept(jobId, snapshot));
      entry.pending = undefined;
      if (!entry.desired) {
        await subscription.unsubscribe();
        entries.delete(jobId);
        return;
      }
      entry.subscription = subscription;
    })().catch((error) => {
      entry.pending = undefined;
      if (!entry.subscription) entries.delete(jobId);
      throw error;
    });
    return entry.pending;
  }

  async function remove(jobId: string): Promise<void> {
    const entry = entries.get(jobId);
    if (!entry) return;
    entry.desired = false;
    removed(jobId);
    if (entry.pending) {
      await entry.pending.catch(() => undefined);
      return;
    }
    entries.delete(jobId);
    if (entry.subscription) await entry.subscription.unsubscribe();
  }

  return {
    ensure,
    remove,
    reconcile(jobIds) {
      for (const jobId of jobIds) void ensure(jobId).catch(() => undefined);
      for (const jobId of entries.keys()) {
        if (!jobIds.has(jobId)) void remove(jobId);
      }
    },
  };
}
