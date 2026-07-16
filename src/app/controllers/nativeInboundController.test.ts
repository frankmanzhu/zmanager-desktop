import { describe, expect, it, vi } from "vitest";

import type { NativeInboundEvent } from "../../api/generated/nativeInboundEvents.generated";
import { createNativeInboundController } from "./nativeInboundController";

function event(overrides: Partial<NativeInboundEvent> = {}): NativeInboundEvent {
  return {
    version: 1,
    eventId: "event-1234567890",
    kind: "reopenApplication",
    timestampUnixMs: 1,
    payload: {},
    ...overrides,
  } as NativeInboundEvent;
}

function harness() {
  let listener: ((envelope: Readonly<{ payload: NativeInboundEvent }>) => void) | null = null;
  const calls: string[] = [];
  const options = {
    isDesktopRuntime: () => true,
    listen: vi.fn(async (next: (envelope: Readonly<{ payload: NativeInboundEvent }>) => void) => {
      calls.push("listen");
      listener = next;
    }),
    markFrontendReady: vi.fn(async () => {
      calls.push("ready");
      return 0;
    }),
    acknowledge: vi.fn(async (_window: string, id: string) => {
      calls.push(`ack:${id}`);
    }),
    handleQuickAction: vi.fn(async () => {}),
    handleShellActionToken: vi.fn(async () => {}),
    handleHostedAuthCallback: vi.fn(async () => {}),
    revealApplication: vi.fn(async () => {}),
    reportFailure: vi.fn(),
  };
  const controller = createNativeInboundController(options);
  return {
    calls,
    controller,
    options,
    emit(value: NativeInboundEvent) {
      listener?.({ payload: value });
    },
    async settle() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("native inbound controller", () => {
  it("subscribes before declaring the frontend ready", async () => {
    const test = harness();
    await test.controller.initialize();
    expect(test.calls).toEqual(["listen", "ready"]);
  });

  it("serializes events and acknowledges only after successful handling", async () => {
    const test = harness();
    await test.controller.initialize();
    const first = event({
      eventId: "open-event-123456",
      kind: "openPaths",
      payload: { paths: ["/tmp/archive.zip"] },
    });
    test.emit(first);
    await test.settle();
    expect(test.options.handleQuickAction).toHaveBeenCalledWith({
      kind: "open",
      paths: ["/tmp/archive.zip"],
    });
    expect(test.options.acknowledge).toHaveBeenCalledWith("main", first.eventId);
  });

  it("does not acknowledge a failed handler so the Rust inbox can replay it", async () => {
    const test = harness();
    test.options.revealApplication.mockRejectedValueOnce(new Error("window failed"));
    await test.controller.initialize();
    test.emit(event());
    await test.settle();
    expect(test.options.acknowledge).not.toHaveBeenCalled();
    expect(test.options.reportFailure).toHaveBeenCalledOnce();
  });

  it("routes request tokens and secret-free hosted authentication results", async () => {
    const test = harness();
    await test.controller.process(event({
      eventId: "shell-event-123456",
      kind: "shellActionRequest",
      payload: { requestToken: "abcdefghijklmnopqrstuv" },
    }));
    await test.controller.process(event({
      eventId: "auth-event-1234567",
      kind: "hostedAuthCallback",
      payload: { state: "state-1234567890", result: "completed" },
    }));
    expect(test.options.handleShellActionToken).toHaveBeenCalledWith("abcdefghijklmnopqrstuv");
    expect(test.options.handleHostedAuthCallback).toHaveBeenCalledWith({
      state: "state-1234567890",
      result: "completed",
    });
  });

  it("does nothing in browser preview", async () => {
    const test = harness();
    const controller = createNativeInboundController({
      ...test.options,
      isDesktopRuntime: () => false,
    });
    await controller.initialize();
    expect(test.options.listen).not.toHaveBeenCalled();
    expect(test.options.markFrontendReady).not.toHaveBeenCalled();
  });
});
