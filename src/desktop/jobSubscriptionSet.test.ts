import { describe, expect, it, vi } from "vitest";

import type { DesktopJobSnapshotDto } from "../api/types";
import type { JobFeed, JobFeedSubscription } from "./jobFeed";
import { createJobSubscriptionSet } from "./jobSubscriptionSet";

describe("job subscription set", () => {
  it("shares one pending subscription and disposes it if catalog removal wins the race", async () => {
    let resolveSubscription!: (subscription: JobFeedSubscription) => void;
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeJob = vi.fn(() => new Promise<JobFeedSubscription>((resolve) => {
      resolveSubscription = resolve;
    }));
    const feed: JobFeed = {
      subscribeJob,
      async subscribeCatalog() { throw new Error("unused"); },
    };
    const removed = vi.fn();
    const subscriptions = createJobSubscriptionSet(feed, vi.fn<(jobId: string, snapshot: DesktopJobSnapshotDto) => void>(), removed);

    const first = subscriptions.ensure("job-1");
    const second = subscriptions.ensure("job-1");
    subscriptions.reconcile(new Set());
    resolveSubscription({ unsubscribe });
    await Promise.all([first, second]);

    expect(subscribeJob).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith("job-1");
  });
});
