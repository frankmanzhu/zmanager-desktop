import { describe, expect, it } from "vitest";

import { enMessages } from "./messages.en";
import { zhCnMessages } from "./messages.zh-CN";

const PLACEHOLDER_PATTERN = /\{([A-Za-z0-9_]+)\}/g;

describe("message catalog parity", () => {
  it("keeps zh-CN keys in parity with English", () => {
    expect(Object.keys(zhCnMessages).sort()).toEqual(Object.keys(enMessages).sort());
  });

  it("keeps interpolation placeholders in parity with English", () => {
    for (const key of Object.keys(enMessages) as Array<keyof typeof enMessages>) {
      expect(placeholders(zhCnMessages[key])).toEqual(placeholders(enMessages[key]));
    }
  });
});

function placeholders(message: string): string[] {
  return [...message.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] ?? "").sort();
}
