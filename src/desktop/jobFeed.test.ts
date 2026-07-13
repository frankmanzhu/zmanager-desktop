import { describe, expect, it, vi } from "vitest";
import type { DesktopJobSnapshotDto } from "../api/types";
import { createInMemoryJobFeed, isNewerRevision } from "./jobFeed";

function snapshot(revision: string, status: DesktopJobSnapshotDto["status"] = "running"): DesktopJobSnapshotDto {
  return { revision, jobId: "job-1", kind: "zipCreate", status, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", canPause: true, canResume: false, canCancel: true, canDismiss: false,
    progressFacts: { processedBytes: 0, processedEntries: 0, recentPaths: [], phaseProcessedBytes: 0, warningCount: 0, activeElapsedMillis: 0, phaseElapsedMillis: 0 }, boundedNotices: [], availableActions: [], outputArtifacts: [] };
}

describe("job feed", () => {
  it("orders revisions beyond JavaScript's safe integer range", () => {
    expect(isNewerRevision("9007199254740993", "9007199254740992")).toBe(true);
    expect(isNewerRevision("9007199254740992", "9007199254740993")).toBe(false);
  });

  it("delivers retained state and ignores stale publications", async () => {
    const feed = createInMemoryJobFeed([snapshot("9007199254740993")]);
    const accept = vi.fn();
    await feed.subscribeJob("job-1", accept);
    feed.publish(snapshot("9007199254740992", "failed"));
    feed.publish(snapshot("9007199254740994", "completed"));
    expect(accept.mock.calls.map(([value]) => value.status)).toEqual(["running", "completed"]);
  });
});
