import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canReadClipboard,
  canWriteClipboard,
  readClipboardText,
  writeClipboardText,
} from "./clipboard";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function restoreNavigator() {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
    return;
  }

  Reflect.deleteProperty(globalThis, "navigator");
}

function setClipboard(clipboard?: Partial<Clipboard>) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: clipboard ? { clipboard } : {},
  });
}

afterEach(() => {
  restoreNavigator();
});

describe("desktop clipboard adapter", () => {
  it("reports unsupported read and returns null", async () => {
    setClipboard();

    expect(canReadClipboard()).toBe(false);
    await expect(readClipboardText()).resolves.toBeNull();
  });

  it("reads clipboard text through the browser clipboard API", async () => {
    const readText = vi.fn(async () => "C:\\Archives\\source.zip");
    setClipboard({ readText });

    expect(canReadClipboard()).toBe(true);
    await expect(readClipboardText()).resolves.toBe("C:\\Archives\\source.zip");
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported write and rejects writes", async () => {
    setClipboard();

    expect(canWriteClipboard()).toBe(false);
    await expect(writeClipboardText("archive/path.txt")).rejects.toThrow("Clipboard write is not available.");
  });

  it("writes clipboard text through the browser clipboard API", async () => {
    const writeText = vi.fn(async (_value: string) => undefined);
    setClipboard({ writeText });

    expect(canWriteClipboard()).toBe(true);
    await writeClipboardText("first.txt\nsecond.txt");
    expect(writeText).toHaveBeenCalledWith("first.txt\nsecond.txt");
  });
});
