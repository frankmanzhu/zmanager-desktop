import { describe, expect, it } from "vitest";

import { formatBytes, formatCompressionRatio } from "./formatting";

describe("display formatting", () => {
  it("formats byte numbers with the provided locale", () => {
    expect(formatBytes(1536, { locale: "en", fractionDigits: 1 })).toBe("1.5 KB");
    expect(formatBytes(1536, { locale: "de-DE", fractionDigits: 1 })).toBe("1,5 KB");
  });

  it("formats compression ratios with the provided locale", () => {
    expect(formatCompressionRatio(1000, 125, { locale: "en", fractionDigits: 1 })).toBe("12.5%");
    expect(formatCompressionRatio(1000, 125, { locale: "de-DE", fractionDigits: 1 })).toBe("12,5%");
  });
});
