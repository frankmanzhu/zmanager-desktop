import { describe, expect, it } from "vitest";

import type { LegacyReplacementPreferencesDto } from "../api/types";
import { PREFERENCE_KEYS, type PreferenceStorage } from "./preferenceStorage";
import {
  applyReplacementPreferences,
  rollbackReplacementPreferences,
} from "./replacementMigration";

const LEGACY: LegacyReplacementPreferencesDto = {
  defaultArchiveFormat: "tzap",
  defaultCleanSourceEnabled: false,
  legacyDefaultCreateProfile: null,
  defaultOutputLocation: "customFolder",
  customOutputFolderPath: "/Users/example/Archives",
  quickOpenExtractionEnabled: true,
  quickExtractionLocation: "chosenFolder",
  quickExtractionFolderPath: "/Users/example/Extracted",
  previewCleanupPolicy: "whenAppCloses",
};

describe("replacement preference migration", () => {
  it("maps every compatible legacy preference into typed storage", () => {
    const storage = memoryStorage();
    expect(applyReplacementPreferences(storage, LEGACY)).toEqual([
      "defaultArchiveFormat",
      "defaultCleanSourceEnabled",
      "defaultOutputLocation",
      "customOutputFolderPath",
      "defaultExtractionBehavior",
      "customExtractFolderPath",
      "previewCleanupPolicy",
    ]);
    expect(storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat)).toBe("tzap");
    expect(storage.getItem(PREFERENCE_KEYS.defaultCleanSourceEnabled)).toBe("false");
    expect(storage.getItem(PREFERENCE_KEYS.defaultExtractionBehavior)).toBe("extractToFolder");
  });

  it("gives every existing replacement value precedence, including corrupt values", () => {
    const storage = memoryStorage({
      [PREFERENCE_KEYS.defaultArchiveFormat]: "newer-choice",
      [PREFERENCE_KEYS.defaultExtractionBehavior]: "askEveryTime",
    });
    const applied = applyReplacementPreferences(storage, LEGACY);
    expect(applied).not.toContain("defaultArchiveFormat");
    expect(applied).not.toContain("defaultExtractionBehavior");
    expect(storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat)).toBe("newer-choice");
    expect(storage.getItem(PREFERENCE_KEYS.defaultExtractionBehavior)).toBe("askEveryTime");
  });

  it("uses the old create-profile fallback only when the newer old keys are absent", () => {
    const storage = memoryStorage();
    applyReplacementPreferences(storage, {
      ...emptyLegacy(),
      legacyDefaultCreateProfile: "zip",
    });
    expect(storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat)).toBe("zip");
    expect(storage.getItem(PREFERENCE_KEYS.defaultCleanSourceEnabled)).toBe("false");
  });

  it("rollback removes only unchanged migrated values", () => {
    const storage = memoryStorage();
    const applied = applyReplacementPreferences(storage, LEGACY);
    storage.setItem(PREFERENCE_KEYS.defaultArchiveFormat, "zip");
    const removed = rollbackReplacementPreferences(storage, LEGACY, applied);
    expect(removed).not.toContain("defaultArchiveFormat");
    expect(storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat)).toBe("zip");
    expect(storage.getItem(PREFERENCE_KEYS.defaultOutputLocation)).toBeNull();
  });
});

function emptyLegacy(): LegacyReplacementPreferencesDto {
  return {
    defaultArchiveFormat: null,
    defaultCleanSourceEnabled: null,
    legacyDefaultCreateProfile: null,
    defaultOutputLocation: null,
    customOutputFolderPath: null,
    quickOpenExtractionEnabled: null,
    quickExtractionLocation: null,
    quickExtractionFolderPath: null,
    previewCleanupPolicy: null,
  };
}

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
