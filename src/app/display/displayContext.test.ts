import { describe, expect, it } from "vitest";

import {
  createDisplayContext,
  refreshDisplayContext,
  selectDisplayRefreshSurfaces,
} from "./displayContext";

describe("display context", () => {
  it("creates a display snapshot from an explicit locale preference", () => {
    const display = createDisplayContext("zh-CN");

    expect(display.resolvedLocale).toBe("zh-CN");
    expect(display.documentLanguage).toBe("zh-CN");
    expect(display.documentDirection).toBe("ltr");
    expect(display.translator.locale).toBe("zh-CN");
  });

  it("resolves system locale from browser languages without changing the stored preference", () => {
    const display = createDisplayContext("system", {
      browserLanguages: ["zh-Hans-CN", "en-US"],
    });

    expect(display.resolvedLocale).toBe("zh-CN");
    expect(display.documentLanguage).toBe("zh-CN");
  });

  it("uses the resolved locale for bytes, dates, and ratios", () => {
    const display = createDisplayContext("en");

    expect(display.format.bytes(1536)).toBe("1.5 KB");
    expect(display.format.date("2026-07-08T04:05:06Z", {
      dateStyle: "short",
      timeStyle: "short",
    })).toMatch(/7\/8\/26|08\/07\/2026/);
    expect(display.format.ratio(200, 50, { fractionDigits: 0 })).toBe("25%");
  });

  it("preserves formatter empty-value overrides", () => {
    const display = createDisplayContext("en");

    expect(display.format.bytes(undefined, { emptyValue: "" })).toBe("");
    expect(display.format.date(null, { emptyValue: "" })).toBe("");
    expect(display.format.ratio(undefined, 50, { emptyValue: "" })).toBe("");
  });

  it("selects active display refresh surfaces", () => {
    expect(selectDisplayRefreshSurfaces({
      activeWorkspace: "browse",
    })).toEqual(["browse"]);

    expect(selectDisplayRefreshSurfaces({
      activeWorkspace: "create",
      jobsVisible: true,
      preferencesVisible: true,
    })).toEqual(["create", "jobs", "preferences"]);
  });

  it("refreshes display context metadata after committing the new locale", () => {
    const documentElement = { lang: "", dir: "" };
    const calls: string[] = [];

    const display = refreshDisplayContext("zh-CN", {
      commitContext: (context) => calls.push(`commit:${context.resolvedLocale}`),
      documentElement,
      refreshCommands: (context) => calls.push(`commands:${context.translator.locale}`),
    });

    expect(display.resolvedLocale).toBe("zh-CN");
    expect(documentElement).toEqual({ lang: "zh-CN", dir: "ltr" });
    expect(calls).toEqual([
      "commit:zh-CN",
      "commands:zh-CN",
    ]);
  });

  it("rerenders active views without mutating raw archive view options", () => {
    const archiveViewOptions = Object.freeze({
      sortKey: "size",
      sortAscending: false,
      searchQuery: "docs",
      flatView: true,
    });
    const calls: string[] = [];

    refreshDisplayContext("en", {
      refreshCommands: () => calls.push("commands"),
    });

    expect(calls).toEqual(["commands"]);
    expect(archiveViewOptions).toEqual({
      sortKey: "size",
      sortAscending: false,
      searchQuery: "docs",
      flatView: true,
    });
  });
});
