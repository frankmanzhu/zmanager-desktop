import type {
  JobCatalogSnapshotDto,
  StartJobResponseDto,
} from "../../api/types";
import { isLiveJobStatus } from "../jobs";

const MAX_RECENT_TERMINAL_JOB_IDS = 512;

export type ProcessJobAccountingSnapshot = Readonly<{
  activeJobIds: readonly string[];
  activeJobCount: number;
}>;

export type ProcessJobAccounting = Readonly<{
  getSnapshot(): ProcessJobAccountingSnapshot;
  observeAccepted(job: StartJobResponseDto): ProcessJobAccountingSnapshot;
  reconcileCatalog(catalog: JobCatalogSnapshotDto): ProcessJobAccountingSnapshot;
  hasActiveJobs(): boolean;
}>;

/**
 * Keeps only the process-lifetime facts the shell needs. Job presentation state
 * belongs to the disposable task window and is deliberately absent here.
 */
export function createProcessJobAccounting(): ProcessJobAccounting {
  const activeJobIds = new Set<string>();
  const observedInCatalog = new Set<string>();
  const recentTerminalJobIds = new Set<string>();

  function snapshot(): ProcessJobAccountingSnapshot {
    const ids = Object.freeze([...activeJobIds]);
    return Object.freeze({
      activeJobIds: ids,
      activeJobCount: ids.length,
    });
  }

  return Object.freeze({
    getSnapshot: snapshot,
    observeAccepted(job) {
      if (
        isLiveJobStatus(job.status)
        && !recentTerminalJobIds.has(job.jobId)
      ) {
        activeJobIds.add(job.jobId);
      }
      return snapshot();
    },
    reconcileCatalog(catalog) {
      const catalogIds = new Set(catalog.jobs.map((job) => job.jobId));
      for (const job of catalog.jobs) {
        if (job.terminal) {
          recentTerminalJobIds.add(job.jobId);
        }
      }
      while (recentTerminalJobIds.size > MAX_RECENT_TERMINAL_JOB_IDS) {
        const oldest = recentTerminalJobIds.values().next().value;
        if (oldest === undefined) break;
        recentTerminalJobIds.delete(oldest);
      }
      const liveCatalogIds = new Set(
        catalog.jobs
          .filter((job) => !job.terminal && isLiveJobStatus(job.status))
          .map((job) => job.jobId),
      );

      for (const jobId of liveCatalogIds) {
        activeJobIds.add(jobId);
        observedInCatalog.add(jobId);
      }

      for (const jobId of [...activeJobIds]) {
        const descriptor = catalog.jobs.find((job) => job.jobId === jobId);
        if (
          descriptor?.terminal
          || (observedInCatalog.has(jobId) && !catalogIds.has(jobId))
        ) {
          activeJobIds.delete(jobId);
          observedInCatalog.delete(jobId);
        }
      }

      return snapshot();
    },
    hasActiveJobs() {
      return activeJobIds.size > 0;
    },
  });
}
