import { describe, expect, it, vi } from "vitest";

import { createLocalSendTrustController } from "./localSendTrustController";

describe("LAN Sharing trust controller", () => {
  it("publishes immutable fingerprint lists on refresh and forget", async () => {
    const publish = vi.fn();
    const list = vi.fn().mockResolvedValue(["aaa", "bbb"]);
    const untrust = vi.fn().mockResolvedValue(["bbb"]);
    const controller = createLocalSendTrustController({
      list,
      untrust,
      publish,
      errorMessage: String,
    });

    const refreshed = await controller.refresh();
    expect(refreshed.status).toBe("ready");
    expect(refreshed.fingerprints).toEqual(["aaa", "bbb"]);
    expect(Object.isFrozen(refreshed.fingerprints)).toBe(true);

    const forgotten = await controller.forget("aaa");
    expect(untrust).toHaveBeenCalledWith("aaa");
    expect(forgotten.fingerprints).toEqual(["bbb"]);
    expect(publish).toHaveBeenCalled();
  });

  it("normalizes failures into controller state without losing prior data", async () => {
    const controller = createLocalSendTrustController({
      list: vi.fn().mockRejectedValue(new Error("registry unreachable")),
      untrust: vi.fn(),
      publish: vi.fn(),
      errorMessage: (error) => (error instanceof Error ? error.message : String(error)),
    });

    await expect(controller.refresh()).resolves.toMatchObject({
      status: "error",
      error: "registry unreachable",
    });
  });
});
