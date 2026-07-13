import { describe, expect, it } from "vitest";

import { createDisposableTask, reduceDisposableTask } from "./disposableTask";
import type { DesktopJobSnapshotDto, StartJobResponseDto } from "../../api/types";

const started: StartJobResponseDto = {
  jobId: "job-1",
  kind: "zipCreate",
  status: "queued",
  createdAt: "2026-07-11T00:00:00Z",
};

let revision = 0;
function update(status: DesktopJobSnapshotDto["status"]): DesktopJobSnapshotDto {
  revision += 1;
  return {
    ...started,
    status, revision: String(revision), updatedAt: started.createdAt, canPause: status === "running", canResume: status === "paused", canCancel: status === "running" || status === "paused",
    canDismiss: status === "completed" || status === "failed" || status === "cancelled",
    progressFacts: { processedBytes: 0, processedEntries: 0, currentPath: status === "running" ? "project/readme.md" : null, recentPaths: status === "running" ? ["project/readme.md"] : [], phaseProcessedBytes: 0, warningCount: 0, activeElapsedMillis: 0, phaseElapsedMillis: 0 },
    boundedNotices: [], availableActions: [], outputArtifacts: [],
  };
}

describe("disposable task state", () => {
  it("tracks one job through running and successful auto-close", () => {
    let state = createDisposableTask(started);
    expect(state.phase).toBe("starting");

    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("running") });
    expect(state).toMatchObject({ phase: "running", closePromptOpen: false });

    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("completed") });
    expect(state.phase).toBe("succeeded");

    state = reduceDisposableTask(state, { type: "autoCloseElapsed" });
    expect(state.phase).toBe("closing");
  });

  it("keeps failed work visible and never regresses a terminal state", () => {
    let state = createDisposableTask(started);
    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("failed") });
    expect(state.phase).toBe("failed");

    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("running") });
    expect(state.phase).toBe("failed");
  });

  it("requires a decision before closing a running task", () => {
    let state = createDisposableTask(started);
    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("running") });
    state = reduceDisposableTask(state, { type: "closeRequested" });
    expect(state.closePromptOpen).toBe(true);

    state = reduceDisposableTask(state, { type: "keepOpen" });
    expect(state).toMatchObject({ phase: "running", closePromptOpen: false });

    state = reduceDisposableTask(state, { type: "closeRequested" });
    state = reduceDisposableTask(state, { type: "continueInBackground" });
    expect(state.phase).toBe("closing");
  });

  it("ignores updates for another job", () => {
    const state = createDisposableTask(started);
    const other = { ...update("completed"), jobId: "job-2" };
    expect(reduceDisposableTask(state, { type: "jobUpdated", snapshot: other })).toBe(state);
  });

  it("returns to the authoritative job phase when cancellation is rejected", () => {
    let state = createDisposableTask(started);
    state = reduceDisposableTask(state, { type: "jobUpdated", snapshot: update("running") });
    state = reduceDisposableTask(state, { type: "cancelRequested" });
    expect(state.phase).toBe("cancelling");

    state = reduceDisposableTask(state, { type: "controlRejected" });
    expect(state.phase).toBe("running");
  });
});
