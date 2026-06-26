import { describe, expect, it } from "vitest";

import {
  canRetryJobWithPassword,
  createInitialJobState,
  getLatestPasswordFailureEvent,
  mergePolledJobState,
} from "./jobs";
import type { JobState, PollJobEventsResponseDto, StartJobResponseDto } from "../api/types";

const startedAt = "2026-06-11T00:00:00Z";

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "queued",
    createdAt: startedAt,
    ...overrides,
  };
}

function pollResponse(overrides: Partial<PollJobEventsResponseDto> = {}): PollJobEventsResponseDto {
  return {
    jobId: "job-1",
    kind: "zipExtract",
    status: "running",
    createdAt: startedAt,
    canDismiss: false,
    events: [],
    terminalSummary: null,
    ...overrides,
  };
}

describe("job state helpers", () => {
  it("creates initial job state from a start response", () => {
    expect(createInitialJobState(startJobResponse())).toEqual({
      snapshot: {
        jobId: "job-1",
        kind: "zipExtract",
        status: "queued",
        createdAt: startedAt,
        canDismiss: false,
        events: [],
        terminalSummary: null,
      },
      events: [],
    });
  });

  it("appends drained poll events and preserves terminal summaries", () => {
    const previous: JobState = {
      snapshot: {
        ...pollResponse({
          status: "completed",
          canDismiss: true,
          terminalSummary: {
            writtenEntries: 2,
            skippedEntries: null,
            writtenBytes: 42,
            warnings: [],
          },
        }),
      },
      events: [{ eventType: "completed", jobKind: "zipExtract" }],
    };

    const merged = mergePolledJobState(
      previous,
      pollResponse({
        status: "completed",
        canDismiss: true,
        events: [{ eventType: "warning", message: "late warning" }],
        terminalSummary: null,
      }),
    );

    expect(merged.snapshot.terminalSummary?.writtenEntries).toBe(2);
    expect(merged.events.map((event) => event.eventType)).toEqual(["completed", "warning"]);
  });

  it("detects latest password failure and requires retry context", () => {
    const state: JobState = {
      snapshot: pollResponse({ status: "failed" }),
      events: [
        { eventType: "failed", code: "io_error" },
        { eventType: "failed", code: "password_required" },
      ],
    };

    expect(getLatestPasswordFailureEvent(state)?.code).toBe("password_required");
    expect(canRetryJobWithPassword(false, state)).toBe(false);
    expect(canRetryJobWithPassword(true, state)).toBe(true);
  });
});
