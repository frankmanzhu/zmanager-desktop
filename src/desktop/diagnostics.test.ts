import { describe, expect, it, vi } from "vitest";

import { createDesktopDiagnosticRecorder } from "./diagnostics";

describe("desktop diagnostics", () => {
  it("forwards structured events in the desktop runtime", async () => {
    const write = vi.fn(async () => {});
    const recorder = createDesktopDiagnosticRecorder({
      isDesktopRuntime: () => true,
      write,
    });

    recorder.record({
      scope: "quickAction",
      name: "requestReceived",
      fields: { action: "compressZip", pathCount: 2 },
    });
    await Promise.resolve();

    expect(write).toHaveBeenCalledWith({
      scope: "quickAction",
      name: "requestReceived",
      fields: { action: "compressZip", pathCount: 2 },
    });
  });

  it("does not invoke the backend in browser preview", () => {
    const write = vi.fn(async () => {});
    const recorder = createDesktopDiagnosticRecorder({
      isDesktopRuntime: () => false,
      write,
    });

    recorder.record({ scope: "startup", name: "ignored" });

    expect(write).not.toHaveBeenCalled();
  });
});
