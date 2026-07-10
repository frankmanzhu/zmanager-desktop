import { describe, expect, it, vi } from "vitest";

import { createBrowserPasswordPromptAdapter } from "./passwordPromptAdapter";

describe("password prompt adapter", () => {
  it("trims non-empty prompted passwords", () => {
    const prompt = vi.fn(() => "  secret  ");
    const adapter = createBrowserPasswordPromptAdapter({ prompt });

    expect(adapter.promptForPassword("Password")).toBe("secret");
    expect(prompt).toHaveBeenCalledWith("Password");
  });

  it("normalizes cancelled and blank prompts to null", () => {
    const prompt = vi.fn<() => string | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("   ");
    const adapter = createBrowserPasswordPromptAdapter({ prompt });

    expect(adapter.promptForPassword("First")).toBeNull();
    expect(adapter.promptForPassword("Second")).toBeNull();
  });
});
