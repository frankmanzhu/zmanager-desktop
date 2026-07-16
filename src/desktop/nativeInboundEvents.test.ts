import { beforeEach, describe, expect, it, vi } from "vitest";

import { listenNativeInboundEvents, NATIVE_INBOUND_EVENT_NAME } from "./nativeInboundEvents";

const listenMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

describe("native inbound desktop events", () => {
  beforeEach(() => listenMock.mockReset());

  it("binds the canonical Tauri event name", async () => {
    const listener = vi.fn();
    const dispose = vi.fn();
    listenMock.mockResolvedValue(dispose);
    await expect(listenNativeInboundEvents(listener)).resolves.toBe(dispose);
    expect(listenMock).toHaveBeenCalledWith(NATIVE_INBOUND_EVENT_NAME, listener);
  });
});
