import { describe, expect, it } from "vitest";

import {
  formatVolumeSizePresetList,
  normalizeVolumeSizePresets,
  parseVolumeSizePresetList,
} from "./volumeSizePresets";

describe("volume size presets", () => {
  it("parses friendly binary size labels and preserves configured order", () => {
    expect(parseVolumeSizePresetList("5 MB, 25 MB; 1 GB")).toEqual([
      5 * 1024 * 1024,
      25 * 1024 * 1024,
      1024 * 1024 * 1024,
    ]);
    expect(formatVolumeSizePresetList([5 * 1024 * 1024, 1024 * 1024 * 1024])).toBe("5 MB, 1 GB");
  });

  it("rejects ambiguous values and removes duplicates", () => {
    expect(parseVolumeSizePresetList("10, 20 MB")).toBeNull();
    expect(normalizeVolumeSizePresets([1024, 1024, 0, "2048"])).toEqual([1024]);
  });
});
