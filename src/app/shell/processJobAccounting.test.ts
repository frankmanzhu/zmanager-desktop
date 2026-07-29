import { describe, expect, it } from "vitest";

import type {
  JobCatalogSnapshotDto,
  StartJobResponseDto,
} from "../../api/types";
import { createProcessJobAccounting } from "./processJobAccounting";

const acceptedJob: StartJobResponseDto = {
  jobId: "job-1",
  kind: "zipExtract",
  status: "queued",
  createdAt: "2026-07-29T00:00:00.000Z",
};

function catalog(
  jobs: JobCatalogSnapshotDto["jobs"],
  revision = "1",
): JobCatalogSnapshotDto {
  return { catalogRevision: revision, jobs };
}

describe("process job accounting", () => {
  it("tracks only live job identity and count", () => {
    const accounting = createProcessJobAccounting();

    expect(accounting.observeAccepted(acceptedJob)).toEqual({
      activeJobIds: ["job-1"],
      activeJobCount: 1,
    });
    expect(accounting.hasActiveJobs()).toBe(true);
  });

  it("does not lose a newly accepted job to an older catalog snapshot", () => {
    const accounting = createProcessJobAccounting();
    accounting.observeAccepted(acceptedJob);

    accounting.reconcileCatalog(catalog([]));

    expect(accounting.hasActiveJobs()).toBe(true);
  });

  it("removes a job when the authoritative catalog reports it terminal", () => {
    const accounting = createProcessJobAccounting();
    accounting.observeAccepted(acceptedJob);
    accounting.reconcileCatalog(catalog([{
      jobId: "job-1",
      revision: "1",
      kind: "zipExtract",
      status: "running",
      terminal: false,
    }]));

    expect(accounting.reconcileCatalog(catalog([{
      jobId: "job-1",
      revision: "2",
      kind: "zipExtract",
      status: "completed",
      terminal: true,
    }], "2"))).toEqual({
      activeJobIds: [],
      activeJobCount: 0,
    });
  });

  it("reconciles retained live jobs that predate this frontend session", () => {
    const accounting = createProcessJobAccounting();

    accounting.reconcileCatalog(catalog([{
      jobId: "retained-job",
      revision: "4",
      kind: "sevenZCreate",
      status: "paused",
      terminal: false,
    }]));

    expect(accounting.getSnapshot()).toEqual({
      activeJobIds: ["retained-job"],
      activeJobCount: 1,
    });
  });
});
