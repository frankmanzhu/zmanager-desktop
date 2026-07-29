import { beforeEach, describe, expect, it } from "vitest";

import type { JobStatus, StartJobResponseDto } from "../../api/types";
import {
  createJobsWorkspace,
  type JobsWorkspace,
} from "./jobsWorkspace";

function sampleJob(id: string, status: JobStatus = "queued"): StartJobResponseDto {
  return {
    jobId: id,
    kind: "zipCreate",
    status,
    createdAt: new Date().toISOString(),
  };
}

describe("jobsWorkspace", () => {
  let workspace: JobsWorkspace;

  beforeEach(() => {
    workspace = createJobsWorkspace();
  });

  it("adds and retrieves a job", () => {
    workspace.addJob(sampleJob("job-1"));
    expect(workspace.hasJob("job-1")).toBe(true);
    expect(workspace.getJob("job-1")).toBeDefined();
  });

  it("hasJobs reports correctly", () => {
    expect(workspace.hasJobs()).toBe(false);
    workspace.addJob(sampleJob("job-1"));
    expect(workspace.hasJobs()).toBe(true);
  });

  it("hasActiveJob detects live jobs", () => {
    expect(workspace.hasActiveJob()).toBe(false);
    workspace.addJob(sampleJob("job-1", "running"));
    expect(workspace.hasActiveJob()).toBe(true);
  });

  it("hasActiveJob returns false for terminal jobs", () => {
    workspace.addJob(sampleJob("job-1", "completed"));
    expect(workspace.hasActiveJob()).toBe(false);
  });

  it("removes a job", () => {
    workspace.addJob(sampleJob("job-1"));
    expect(workspace.removeJob("job-1")).toBe(true);
    expect(workspace.hasJob("job-1")).toBe(false);
  });

  it("removing unknown job returns false", () => {
    expect(workspace.removeJob("nonexistent")).toBe(false);
  });

  it("updates job status", () => {
    workspace.addJob(sampleJob("job-1", "queued"));
    workspace.updateJobStatus("job-1", "running");
    expect(workspace.getJob("job-1")?.snapshot.status).toBe("running");
  });

  it("clears all jobs", () => {
    workspace.addJob(sampleJob("job-1"));
    workspace.addJob(sampleJob("job-2"));
    workspace.clear();
    expect(workspace.hasJobs()).toBe(false);
  });

  it("stores and retrieves retry context", () => {
    const context = {
      retryKind: "extractArchive" as const,
      archivePath: "/tmp/test.zip",
      destinationPath: "/tmp/output",
      overwrite: "rename" as const,
      stripComponents: 0,
      tzapRestorePolicy: "portable" as const,
      tzapAllowDegraded: false,
      tzapAllowAbsoluteSymlinks: false,
      ignoreSymlinks: false,
    };
    workspace.addJob(sampleJob("job-1"), { retryContext: context });
    expect(workspace.getRetryContext("job-1")).toBeDefined();
    expect(workspace.getRetryContext("job-1")?.archivePath).toBe("/tmp/test.zip");
  });

  it("getPasswordRetryDetails returns null for non-failed job", () => {
    workspace.addJob(sampleJob("job-1", "running"));
    expect(workspace.getPasswordRetryDetails("job-1")).toBeNull();
  });

  it("markPasswordRetryPromptedIfEligible returns false when not eligible", () => {
    workspace.addJob(sampleJob("job-1"));
    expect(workspace.markPasswordRetryPromptedIfEligible("job-1")).toBe(false);
  });

  it("getJobs and getJobsMap return all jobs", () => {
    workspace.addJob(sampleJob("job-1"));
    workspace.addJob(sampleJob("job-2"));
    expect(workspace.getJobs()).toHaveLength(2);
    expect(workspace.getJobsMap().size).toBe(2);
  });
});
