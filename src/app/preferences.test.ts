import { describe, expect, it } from "vitest";

import {
  DEFAULT_APP_PREFERENCES,
  defaultCreateDirectory,
  loadAppPreferences,
  preferencesWithPatch,
  saveAppPreferences,
} from "./preferences";
import type { PreferenceStorage } from "./preferenceStorage";

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("preferences helpers", () => {
  it("returns macOS-aligned safe defaults when storage is unavailable", () => {
    expect(loadAppPreferences(null)).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("loads valid stored preferences", () => {
    const storage = memoryStorage({
      "zmanager.defaultArchiveFormat": "zip",
      "zmanager.defaultCleanSourceEnabled": "false",
      "zmanager.defaultOutputLocation": "customFolder",
      "zmanager.customOutputFolderPath": " C:/Archives ",
      "zmanager.defaultExtractionBehavior": "extractToFolder",
      "zmanager.quickOpenExtractionEnabled": "true",
      "zmanager.previewCleanupPolicy": "whenAppCloses",
    });

    expect(loadAppPreferences(storage)).toEqual({
      defaultArchiveFormat: "zip",
      defaultCleanSourceEnabled: false,
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: "C:/Archives",
      defaultExtractionBehavior: "extractToFolder",
      quickOpenExtractionEnabled: true,
      previewCleanupPolicy: "whenAppCloses",
    });
  });

  it("falls back when stored values are invalid", () => {
    const storage = memoryStorage({
      "zmanager.defaultArchiveFormat": "rar",
      "zmanager.defaultCleanSourceEnabled": "yes",
      "zmanager.defaultOutputLocation": "downloads",
      "zmanager.defaultExtractionBehavior": "alwaysOverwrite",
      "zmanager.quickOpenExtractionEnabled": "1",
      "zmanager.previewCleanupPolicy": "never",
    });

    expect(loadAppPreferences(storage)).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("saves non-sensitive preference fields and removes blank custom output", () => {
    const storage = memoryStorage({
      "zmanager.customOutputFolderPath": "C:/Old",
    });

    saveAppPreferences(
      {
        defaultArchiveFormat: "sevenZ",
        defaultCleanSourceEnabled: false,
        defaultOutputLocation: "sourceFolder",
        customOutputFolderPath: "   ",
        defaultExtractionBehavior: "extractHere",
        quickOpenExtractionEnabled: true,
        previewCleanupPolicy: "whenAppCloses",
      },
      storage,
    );

    expect(Object.fromEntries(storage.values)).toEqual({
      "zmanager.defaultArchiveFormat": "sevenZ",
      "zmanager.defaultCleanSourceEnabled": "false",
      "zmanager.defaultOutputLocation": "sourceFolder",
      "zmanager.defaultExtractionBehavior": "extractHere",
      "zmanager.quickOpenExtractionEnabled": "true",
      "zmanager.previewCleanupPolicy": "whenAppCloses",
    });
  });

  it("normalizes patches and resolves default create directories", () => {
    const preferences = preferencesWithPatch(DEFAULT_APP_PREFERENCES, {
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: " /tmp/archives ",
    });

    expect(preferences.customOutputFolderPath).toBe("/tmp/archives");
    expect(defaultCreateDirectory(preferences)).toBe("/tmp/archives");
    expect(defaultCreateDirectory(DEFAULT_APP_PREFERENCES)).toBeNull();
  });
});
