import { describe, expect, it } from "vitest";

import {
  normalizePathHistory,
  recordCreateDestinationHistoryEntry,
  recordExtractDestinationHistoryEntry,
  recordPathHistoryEntry,
  recordRecentArchiveHistoryEntry,
  setCreateDestinationHistoryEntries,
  setExtractDestinationHistoryEntries,
  setPathHistoryEntries,
  setRecentArchiveHistoryEntries,
} from "./pathHistory";

describe("path history helpers", () => {
  it("trims blanks and deduplicates while preserving first occurrence", () => {
    expect(normalizePathHistory([" C:/out ", "", "C:/tmp", "C:/out", "  ", "C:/tmp "])).toEqual([
      "C:/out",
      "C:/tmp",
    ]);
  });

  it("caps normalized histories when setting entries", () => {
    expect(setPathHistoryEntries(["A", "B", "C", "D"], 3)).toEqual(["A", "B", "C"]);
  });

  it("moves a duplicate record to the front", () => {
    expect(recordPathHistoryEntry(["C:/one", "C:/two", "C:/three"], " C:/two ", 10)).toEqual([
      "C:/two",
      "C:/one",
      "C:/three",
    ]);
  });

  it("ignores blank records", () => {
    expect(recordPathHistoryEntry(["C:/one"], "   ", 10)).toBeNull();
  });

  it("caps extract destination history at ten entries", () => {
    expect(setExtractDestinationHistoryEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    expect(recordExtractDestinationHistoryEntry(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], "11")).toEqual([
      "11",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
  });

  it("caps create destination history at ten entries", () => {
    expect(setCreateDestinationHistoryEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    expect(recordCreateDestinationHistoryEntry(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], "11")).toEqual([
      "11",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
  });

  it("caps recent archive history at eight entries", () => {
    expect(setRecentArchiveHistoryEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9"])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    expect(recordRecentArchiveHistoryEntry(["1", "2", "3", "4", "5", "6", "7", "8"], "9")).toEqual([
      "9",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });
});
