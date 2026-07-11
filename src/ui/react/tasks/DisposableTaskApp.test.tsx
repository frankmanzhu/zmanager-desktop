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
    const html = renderToStaticMarkup(createElement(DisposableTaskView, {
      state,
      nowMs: Date.parse("2026-07-11T00:00:01Z"),
      onCancel() {},
      onClose() {},
      onContinueInBackground() {},
      onKeepOpen() {},
      onMinimize() {},
      onPause() {},
      onResume() {},
    }));

    expect(html).toContain("Compressing with ZManager");
    expect(html).toContain("Starting…");
    expect(html).toContain('aria-label="Task progress"');
    expect(html).not.toContain("Archive Options");
  });
});
