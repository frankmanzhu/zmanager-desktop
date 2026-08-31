import { describe, expect, it, vi } from "vitest";

import { createLocalSendShareController } from "./localSendShareController";
import type { LocalSendDeviceInfoDto } from "../../api/types";

const DEVICE: LocalSendDeviceInfoDto = {
  alias: "Frank's Phone",
  fingerprint: "fp-1",
  port: 53317,
  protocol: "http",
  ip: "192.168.1.20",
  deviceModel: "iPhone",
};

describe("LAN Sharing (send) controller", () => {
  it("opens, discovers, selects a target, and sends with progress reaching sent", async () => {
    const publish = vi.fn();
    const discover = vi.fn().mockResolvedValue([DEVICE]);
    const sendFile = vi.fn().mockResolvedValue({ sessionId: "session-1" });
    const controller = createLocalSendShareController({
      discover,
      sendFile,
      cancelSend: vi.fn(),
      publish,
      errorMessage: String,
      createSendId: () => "send-1",
    });

    controller.open("/tmp/archives/vacation.zip", "ZManager Desktop");
    expect(controller.getSnapshot()).toMatchObject({ archivePath: "/tmp/archives/vacation.zip", discovery: "idle" });

    await controller.discover();
    expect(discover).toHaveBeenCalledWith("ZManager Desktop");
    expect(controller.getSnapshot()?.devices).toEqual([DEVICE]);
    expect(Object.isFrozen(controller.getSnapshot()?.devices)).toBe(true);

    controller.selectTarget(DEVICE.fingerprint);
    expect(controller.getSnapshot()?.selectedFingerprint).toBe(DEVICE.fingerprint);

    await controller.send();
    expect(sendFile).toHaveBeenCalledWith({
      sendId: "send-1",
      alias: "ZManager Desktop",
      target: DEVICE,
      filePath: "/tmp/archives/vacation.zip",
    });
    expect(controller.getSnapshot()?.send).toBe("sending");

    controller.handleEvent({
      type: "fileSendProgress",
      sendId: "send-1",
      sessionId: "session-1",
      fileId: "file-1",
      fileName: "vacation.zip",
      bytesSent: 512,
      totalBytes: 1024,
      rateBytesPerSecond: 1024,
    });
    expect(controller.getSnapshot()?.bytesSent).toBe(512);

    controller.handleEvent({ type: "sessionDone", sessionId: "session-1" });
    expect(controller.getSnapshot()?.send).toBe("sent");
    expect(publish).toHaveBeenCalled();
  });

  it("ignores progress and completion events for a different session", async () => {
    const controller = createLocalSendShareController({
      discover: vi.fn().mockResolvedValue([DEVICE]),
      sendFile: vi.fn().mockResolvedValue({ sessionId: "session-1" }),
      cancelSend: vi.fn(),
      publish: vi.fn(),
      errorMessage: String,
      createSendId: () => "send-1",
    });
    controller.open("/tmp/archives/vacation.zip", "ZManager Desktop");
    await controller.discover();
    controller.selectTarget(DEVICE.fingerprint);
    await controller.send();

    controller.handleEvent({ type: "sessionDone", sessionId: "unrelated-session" });
    expect(controller.getSnapshot()?.send).toBe("sending");
  });

  it("moves to an error state when the transfer fails to start", async () => {
    const controller = createLocalSendShareController({
      discover: vi.fn().mockResolvedValue([DEVICE]),
      sendFile: vi.fn().mockRejectedValue(new Error("device unreachable")),
      cancelSend: vi.fn(),
      publish: vi.fn(),
      errorMessage: (error) => (error instanceof Error ? error.message : String(error)),
      createSendId: () => "send-1",
    });
    controller.open("/tmp/archives/vacation.zip", "ZManager Desktop");
    await controller.discover();
    controller.selectTarget(DEVICE.fingerprint);

    await controller.send();
    expect(controller.getSnapshot()).toMatchObject({ send: "error", sendError: "device unreachable" });
  });

  it("cancels an in-flight send", async () => {
    const cancelSend = vi.fn().mockResolvedValue(undefined);
    const controller = createLocalSendShareController({
      discover: vi.fn().mockResolvedValue([DEVICE]),
      sendFile: vi.fn().mockResolvedValue({ sessionId: "session-1" }),
      cancelSend,
      publish: vi.fn(),
      errorMessage: String,
      createSendId: () => "send-1",
    });
    controller.open("/tmp/archives/vacation.zip", "ZManager Desktop");
    await controller.discover();
    controller.selectTarget(DEVICE.fingerprint);
    await controller.send();

    await controller.cancelSend();
    expect(cancelSend).toHaveBeenCalledWith("send-1");
    expect(controller.getSnapshot()?.send).toBe("cancelled");
  });

  it("resets to a clean idle state on close and re-open", async () => {
    const controller = createLocalSendShareController({
      discover: vi.fn().mockResolvedValue([DEVICE]),
      sendFile: vi.fn().mockResolvedValue({ sessionId: "session-1" }),
      cancelSend: vi.fn(),
      publish: vi.fn(),
      errorMessage: String,
      createSendId: () => "send-1",
    });
    controller.open("/tmp/archives/a.zip", "Alias");
    await controller.discover();
    controller.close();
    expect(controller.getSnapshot()).toBeNull();

    controller.open("/tmp/archives/b.zip", "Alias");
    expect(controller.getSnapshot()).toMatchObject({ archivePath: "/tmp/archives/b.zip", devices: [], discovery: "idle" });
  });
});
