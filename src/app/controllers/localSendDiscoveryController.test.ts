import { describe, expect, it, vi } from "vitest";

import { createLocalSendDiscoveryController } from "./localSendDiscoveryController";

describe("local send discovery controller", () => {
  it("publishes discovered receivers without exposing the desktop adapter to React", async () => {
    const publish = vi.fn();
    const controller = createLocalSendDiscoveryController({
      discover: async (alias) => [{ alias, fingerprint: "peer-1", port: 53317, protocol: "https", ip: null, deviceModel: null }],
      publish,
      errorMessage: () => "discovery failed",
    });

    const snapshot = await controller.refresh("ZManager Desktop");

    expect(snapshot).toMatchObject({ status: "ready", devices: [{ fingerprint: "peer-1" }], error: null });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ status: "loading" }));
    expect(publish).toHaveBeenLastCalledWith(snapshot);
  });

  it("retains the last receiver list and reports refresh errors", async () => {
    const controller = createLocalSendDiscoveryController({
      discover: async () => { throw new Error("offline"); },
      publish: () => {},
      errorMessage: () => "discovery failed",
    });

    const snapshot = await controller.refresh("ZManager Desktop");

    expect(snapshot).toMatchObject({ status: "error", devices: [], error: "discovery failed" });
  });
});
