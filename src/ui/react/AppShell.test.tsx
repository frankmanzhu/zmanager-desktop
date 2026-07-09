import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("is a React component boundary for the legacy GUI mount", () => {
    expect(typeof AppShell).toBe("function");
  });
});
