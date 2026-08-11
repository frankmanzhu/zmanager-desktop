import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDisposableTask } from "../../../app/workspaces/disposableTask";
import { DisposableTaskView } from "./DisposableTaskApp";

describe("disposable task view", () => {
  it("renders an isolated compact job surface", () => {
    const state = createDisposableTask({
      jobId: "job-1",
      kind: "tzapCreate",
      status: "queued",
      createdAt: "2026-07-11T00:00:00Z",
    });
    const html = renderToStaticMarkup(
      createElement(DisposableTaskView, {
        state,
        nowMs: Date.parse("2026-07-11T00:00:01Z"),
        onCancel() {},
        onClose() {},
        onContinueInBackground() {},
        onKeepOpen() {},
        onMinimize() {},
        onPause() {},
        onRetry() {},
        onResume() {},
        onRunOutputAction() {},
      }),
    );

    expect(html).toContain("Compressing with ZManager");
    expect(html).toContain("Starting…");
    expect(html).toContain('aria-label="Task progress"');
    expect(html).toContain('data-task-content="true"');
    expect(html).toContain("overflow-y-auto");
    expect(html).not.toContain("Archive Options");
  });

  it("keeps long current paths from widening the disposable task window", () => {
    const initial = createDisposableTask({
      jobId: "job-long-path",
      kind: "zipCreate",
      status: "running",
      createdAt: "2026-07-11T00:00:00Z",
    });
    const fullPath =
      "C:/Users/example/a-very-long-workspace-name/another-very-long-folder-name/output/reports/quarterly-summary.txt";
    const state = {
      ...initial,
      job: {
        ...initial.job,
        progressFacts: { ...initial.job.progressFacts, currentPath: fullPath },
      },
    };
    const html = renderToStaticMarkup(
      createElement(DisposableTaskView, {
        state,
        nowMs: Date.parse("2026-07-11T00:00:01Z"),
        onCancel() {},
        onClose() {},
        onContinueInBackground() {},
        onKeepOpen() {},
        onMinimize() {},
        onPause() {},
        onRetry() {},
        onResume() {},
        onRunOutputAction() {},
      }),
    );

    expect(html).toContain('class="flex min-h-screen min-w-0 max-w-full');
    expect(html).toContain('data-state="closed"');
    expect(html).not.toContain('title="C:/Users/example');
    expect(html).toContain("…/reports/quarterly-summary.txt");
    expect(html).not.toContain(`>${fullPath}</p>`);
  });

  it("shows task-owned recovery and output actions for a recoverable failure", () => {
    const initial = createDisposableTask({
      jobId: "failed-job",
      kind: "zipExtract",
      status: "queued",
      createdAt: "2026-07-11T00:00:00Z",
    });
    const state = {
      ...initial,
      phase: "failed" as const,
      job: {
        ...initial.job,
        status: "failed" as const,
        latestFailure: {
          eventType: "failed" as const,
          code: "password_required",
          message: "Password required",
          hint: "Try again with the archive password.",
        },
        retryDescriptor: {
          retryKind: "extractArchive" as const,
          actionId: "retry-with-password",
          archivePath: "C:/source.zip",
          destinationPath: "C:/out",
          overwrite: "rename" as const,
          destinationCollisionStrategy: "rename" as const,
          entryPaths: [],
          stripComponents: 0,
        },
        outputArtifacts: [{
          artifactId: "output",
          kind: "directory" as const,
          path: "C:/out",
        }],
        availableActions: [{
          actionId: "open-output",
          kind: "open" as const,
          artifactId: "output",
        }],
      },
    };

    const html = renderToStaticMarkup(createElement(DisposableTaskView, {
      state,
      nowMs: Date.parse("2026-07-11T00:00:01Z"),
      onCancel() {},
      onClose() {},
      onContinueInBackground() {},
      onKeepOpen() {},
      onMinimize() {},
      onPause() {},
      onRetry() {},
      onResume() {},
      onRunOutputAction() {},
    }));

    expect(html).toContain("Retry with password");
    expect(html).toContain("Open output");
    expect(html).toContain("Try again with the archive password.");
    expect(html).not.toContain('data-dialog-nested-scroll="details"');
  });

  it("bounds long failure details in the explicitly marked nested panel", () => {
    const initial = createDisposableTask({
      jobId: "long-failed-job",
      kind: "zipExtract",
      status: "queued",
      createdAt: "2026-07-11T00:00:00Z",
    });
    const message = "Archive extraction failed after the archive was inspected.";
    const hint = "A detailed backend diagnostic: " + "path component mismatch; ".repeat(16);
    const state = {
      ...initial,
      phase: "failed" as const,
      job: {
        ...initial.job,
        status: "failed" as const,
        latestFailure: {
          eventType: "failed" as const,
          message,
          hint,
        },
      },
    };

    const html = renderToStaticMarkup(createElement(DisposableTaskView, {
      state,
      nowMs: Date.parse("2026-07-11T00:00:01Z"),
      onCancel() {},
      onClose() {},
      onContinueInBackground() {},
      onKeepOpen() {},
      onMinimize() {},
      onPause() {},
      onRetry() {},
      onResume() {},
      onRunOutputAction() {},
    }));

    expect(html).toContain('data-dialog-nested-scroll="details"');
    expect(html).toContain("max-h-40");
    expect(html).toContain(message);
    expect(html).toContain(hint);
  });
});
