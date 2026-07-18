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
        onResume() {},
      }),
    );

    expect(html).toContain("Compressing with ZManager");
    expect(html).toContain("Starting…");
    expect(html).toContain('aria-label="Task progress"');
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
        onResume() {},
      }),
    );

    expect(html).toContain('class="flex min-h-screen min-w-0 max-w-full');
    expect(html).toContain('data-state="closed"');
    expect(html).not.toContain('title="C:/Users/example');
    expect(html).toContain("…/reports/quarterly-summary.txt");
    expect(html).not.toContain(`>${fullPath}</p>`);
  });
});
