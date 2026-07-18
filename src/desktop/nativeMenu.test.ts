import { beforeEach, describe, expect, it, vi } from "vitest";

import { listen } from "@tauri-apps/api/event";
import { listenNativeMenuCommands, NATIVE_MENU_COMMAND_EVENT } from "./nativeMenu";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

describe("native macOS menu adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes allowlisted product commands and rejects unknown payloads", async () => {
    const run = vi.fn();
    const dispose = vi.fn();
    vi.mocked(listen).mockImplementation(async (name, listener) => {
      expect(name).toBe(NATIVE_MENU_COMMAND_EVENT);
      listener({ event: name, id: 1, payload: { commandId: "open" } });
      listener({ event: name, id: 2, payload: { commandId: "not-a-command" } });
      return dispose;
    });

    await expect(listenNativeMenuCommands(run)).resolves.toBe(dispose);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("open");
  });
});
