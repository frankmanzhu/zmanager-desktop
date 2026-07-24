import { describe, expect, it, vi } from "vitest";

import { createDefaultHandlerController } from "./defaultHandlerController";

describe("default handler controller", () => {
  it("publishes immutable status and set results", async () => {
    const publish = vi.fn();
    const status = vi.fn().mockResolvedValue({
      entries: [{
        fileExtension: "zip", contentType: "public.zip-archive",
        handlerBundleId: "com.apple.ArchiveUtility", isCurrentApplication: false, errorCode: null,
      }],
      canRestore: false,
    });
    const set = vi.fn().mockResolvedValue({
      entries: [{
        fileExtension: "zip", contentType: "public.zip-archive",
        handlerBundleId: "org.tzap-org.zmanager", isCurrentApplication: true, errorCode: null,
      }],
      canRestore: true,
    });
    const controller = createDefaultHandlerController({
      status,
      set,
      restore: vi.fn(),
      publish,
      errorMessage: String,
    });

    await controller.refresh();
    const snapshot = await controller.set();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.canRestore).toBe(true);
    expect(snapshot.entries[0].isCurrentApplication).toBe(true);
    expect(Object.isFrozen(snapshot.entries)).toBe(true);
    expect(set).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalled();
  });

  it("normalizes operation failures into controller state", async () => {
    const controller = createDefaultHandlerController({
      status: vi.fn().mockRejectedValue(new Error("Launch Services unavailable")),
      set: vi.fn(),
      restore: vi.fn(),
      publish: vi.fn(),
      errorMessage: (error) => error instanceof Error ? error.message : String(error),
    });
    await expect(controller.refresh()).resolves.toMatchObject({
      status: "error",
      error: "Launch Services unavailable",
    });
  });
});
