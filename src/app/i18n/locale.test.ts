import { describe, expect, it } from "vitest";

import {
  isLocalePreference,
  normalizeLocaleTag,
  resolveBestLocale,
  resolveLocalePreference,
} from "./locale";

describe("locale helpers", () => {
  it("normalizes browser language tags before matching", () => {
    expect(normalizeLocaleTag("EN_us")).toBe("en-US");
    expect(normalizeLocaleTag("zh_hans_cn")).toBe("zh-Hans-CN");
  });

  it("resolves exact supported locales first", () => {
    expect(resolveBestLocale(["en"])).toBe("en");
  });

  it("resolves explicit English aliases", () => {
    expect(resolveBestLocale(["en-AU"])).toBe("en");
  });

  it("falls back to English for unsupported languages", () => {
    expect(resolveBestLocale(["de-DE", "zh-CN"])).toBe("en");
  });

  it("can resolve an injected experimental locale without production preference support", () => {
    expect(resolveBestLocale(["zh-Hans-CN"], ["en", "zh-CN"] as const)).toBe("zh-CN");
    expect(resolveBestLocale(["zh-SG"], ["en", "zh-CN"] as const)).toBe("zh-CN");
    expect(resolveBestLocale(["ja-JP"], ["en", "zh-CN"] as const)).toBe("en");
  });

  it("keeps stored system separate from the resolved locale", () => {
    expect(resolveLocalePreference("system", ["en-US"])).toBe("en");
  });

  it("rejects production-unsupported locale preferences", () => {
    expect(isLocalePreference("system")).toBe(true);
    expect(isLocalePreference("en")).toBe(true);
    expect(isLocalePreference("zh-CN")).toBe(false);
  });
});
