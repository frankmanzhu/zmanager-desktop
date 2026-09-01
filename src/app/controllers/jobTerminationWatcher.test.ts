import { describe, expect, it } from "vitest";

import type { JobCatalogSnapshotDto } from "../../api/types";
import { createJobTerminationWatcher } from "./jobTerminationWatcher";

function catalog(
  jobId: string,
  terminal: boolean,
  status: "queued" | "completed" | "failed",
): JobCatalogSnapshotDto {
  return {
    catalogRevision: terminal ? "2" : "1",
    jobs: [{
      jobId,
      revision: terminal ? "2" : "1",
      kind: "zipCreate",
      status,
      terminal,
    }],
  };
}

describe("job termination watcher", () => {
  it("resolves a waiter when a catalog observes a terminal job", async () => {
    const watcher = createJobTerminationWatcher();
    const result = watcher.wait("job-1");

    watcher.observe(catalog("job-1", true, "completed"));

    await expect(result).resolves.toBe("completed");
  });

  it("resolves immediately when the job was already terminal before waiting", async () => {
    const watcher = createJobTerminationWatcher();
    watcher.observe(catalog("job-1", true, "completed"));

    await expect(watcher.wait("job-1")).resolves.toBe("completed");
  });

  it("keeps non-terminal jobs pending until a later catalog revision", async () => {
    const watcher = createJobTerminationWatcher();
    let settled = false;
    const result = watcher.wait("job-1").then(() => {
      settled = true;
    });

    watcher.observe(catalog("job-1", false, "queued"));
    await Promise.resolve();
    expect(settled).toBe(false);

    watcher.observe(catalog("job-1", true, "failed"));
    await expect(result).resolves.toBeUndefined();
  });
});
