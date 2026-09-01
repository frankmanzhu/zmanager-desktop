import type { JobCatalogSnapshotDto, JobStatus } from "../../api/types";

export type JobTerminationWatcher = Readonly<{
  observe(catalog: JobCatalogSnapshotDto): void;
  wait(jobId: string): Promise<JobStatus>;
}>;

/**
 * Resolves callers when a job becomes terminal, including callers that start
 * waiting after the catalog has already reported the terminal revision.
 *
 * The latter is important for fast jobs: presentation of a task window is
 * asynchronous, so a create job can finish before the follow-up action has
 * finished registering its watcher.
 */
export function createJobTerminationWatcher(): JobTerminationWatcher {
  let latestCatalog: JobCatalogSnapshotDto | null = null;
  const waiters = new Map<string, Set<(status: JobStatus) => void>>();

  function terminalStatus(jobId: string): JobStatus | null {
    const job = latestCatalog?.jobs.find((candidate) => candidate.jobId === jobId);
    return job?.terminal ? job.status : null;
  }

  function observe(catalog: JobCatalogSnapshotDto): void {
    latestCatalog = catalog;
    for (const job of catalog.jobs) {
      if (!job.terminal) {
        continue;
      }
      const jobWaiters = waiters.get(job.jobId);
      if (!jobWaiters) {
        continue;
      }
      waiters.delete(job.jobId);
      for (const resolve of jobWaiters) {
        resolve(job.status);
      }
    }
  }

  function wait(jobId: string): Promise<JobStatus> {
    const status = terminalStatus(jobId);
    if (status) {
      return Promise.resolve(status);
    }
    return new Promise((resolve) => {
      const jobWaiters = waiters.get(jobId) ?? new Set();
      jobWaiters.add(resolve);
      waiters.set(jobId, jobWaiters);
    });
  }

  return Object.freeze({ observe, wait });
}
