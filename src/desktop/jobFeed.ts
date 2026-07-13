import { Channel } from "@tauri-apps/api/core";
import { ackSubscription, subscribeJob, subscribeJobCatalog, unsubscribeJob } from "../api/commands";

import type {
  DesktopJobSnapshotDto,
  JobCatalogEnvelopeDto,
  JobCatalogSnapshotDto,
  JobSnapshotEnvelopeDto,
} from "../api/types";

export type JobFeedSubscription = Readonly<{ unsubscribe(): Promise<void> }>;

export type JobFeed = Readonly<{
  subscribeJob(jobId: string, accept: (snapshot: DesktopJobSnapshotDto) => void): Promise<JobFeedSubscription>;
  subscribeCatalog(accept: (snapshot: JobCatalogSnapshotDto) => void): Promise<JobFeedSubscription>;
}>;

function newer(incoming: string, current: string | null): boolean {
  try { return current === null || BigInt(incoming) > BigInt(current); } catch { return false; }
}

export function createTauriJobFeed(): JobFeed {
  return {
    async subscribeJob(jobId, accept) {
      const channel = new Channel<JobSnapshotEnvelopeDto>();
      let highest: string | null = null;
      channel.onmessage = (envelope) => {
        if (newer(envelope.revision, highest)) {
          highest = envelope.revision;
          accept(envelope.payload);
        }
        void ackSubscription({ subscriptionId: envelope.subscriptionId, revision: envelope.revision });
      };
      const subscriptionId = await subscribeJob({ jobId }, channel);
      return { unsubscribe: () => unsubscribeJob({ subscriptionId }) };
    },
    async subscribeCatalog(accept) {
      const channel = new Channel<JobCatalogEnvelopeDto>();
      let highest: string | null = null;
      channel.onmessage = (envelope) => {
        if (newer(envelope.revision, highest)) {
          highest = envelope.revision;
          accept(envelope.payload);
        }
        void ackSubscription({ subscriptionId: envelope.subscriptionId, revision: envelope.revision });
      };
      const subscriptionId = await subscribeJobCatalog(channel);
      return { unsubscribe: () => unsubscribeJob({ subscriptionId }) };
    },
  };
}

export function createInMemoryJobFeed(initial: readonly DesktopJobSnapshotDto[] = []): JobFeed & Readonly<{
  publish(snapshot: DesktopJobSnapshotDto): void;
  publishCatalog(snapshot: JobCatalogSnapshotDto): void;
}> {
  const jobs = new Map(initial.map((snapshot) => [snapshot.jobId, snapshot]));
  const jobListeners = new Map<string, Set<(snapshot: DesktopJobSnapshotDto) => void>>();
  const catalogListeners = new Set<(snapshot: JobCatalogSnapshotDto) => void>();
  let catalog: JobCatalogSnapshotDto = { catalogRevision: "0", jobs: [] };
  return {
    async subscribeJob(jobId, accept) {
      const listeners = jobListeners.get(jobId) ?? new Set(); listeners.add(accept); jobListeners.set(jobId, listeners);
      const current = jobs.get(jobId); if (current) accept(current);
      return { async unsubscribe() { listeners.delete(accept); } };
    },
    async subscribeCatalog(accept) { catalogListeners.add(accept); accept(catalog); return { async unsubscribe() { catalogListeners.delete(accept); } }; },
    publish(snapshot) { const current = jobs.get(snapshot.jobId); if (current && !newer(snapshot.revision, current.revision)) return; jobs.set(snapshot.jobId, snapshot); jobListeners.get(snapshot.jobId)?.forEach((accept) => accept(snapshot)); },
    publishCatalog(snapshot) { if (!newer(snapshot.catalogRevision, catalog.catalogRevision)) return; catalog = snapshot; catalogListeners.forEach((accept) => accept(snapshot)); },
  };
}

export { newer as isNewerRevision };
