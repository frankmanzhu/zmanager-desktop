import { describe, expect, it } from "vitest";

import {
  DEFAULT_APP_PREFERENCES,
  defaultCreateDirectory,
  loadAppPreferences,
  preferencesWithPatch,
  createDefaultsForFormat,
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
      "zmanager.createFormatDefaults": JSON.stringify({
        zip: {
          cleanSource: false,
          compressionLevel: 9,
          volumeSize: 1048576,
          preserveMetadata: false,
          replaceExisting: true,
          promptForPassword: true,
        },
      }),
      "zmanager.defaultOutputLocation": "customFolder",
      "zmanager.customOutputFolderPath": " C:/Archives ",
      "zmanager.defaultExtractionBehavior": "extractToFolder",
      "zmanager.previewCleanupPolicy": "whenAppCloses",
      "zmanager.showParentFolderItem": "false",
      "zmanager.showRealFileIcons": "false",
      "zmanager.showGridLines": "false",
      "zmanager.fullRowSelect": "false",
      "zmanager.singleClickOpen": "true",
      "zmanager.alternativeSelectionMode": "true",
      "zmanager.toolbarVisible": "false",
      "zmanager.largeToolbarButtons": "true",
      "zmanager.showToolbarLabels": "false",
      "zmanager.flatViewDefault": "true",
      "zmanager.tableVisibleColumns": "name,size,crc",
      "zmanager.tableColumnOrder": "name,crc,size",
      "zmanager.tableColumnWidths": "{\"name\":240,\"size\":130}",
      "zmanager.tableSortKey": "size",
      "zmanager.tableSortAscending": "false",
    });

    expect(loadAppPreferences(storage)).toEqual({
      defaultArchiveFormat: "zip",
      defaultCleanSourceEnabled: false,
      createFormatDefaults: {
        zip: {
          cleanSource: false,
          compressionLevel: 9,
          volumeSize: 1048576,
          preserveMetadata: false,
          replaceExisting: true,
          promptForPassword: true,
        },
        tarZst: {
          cleanSource: false,
          compressionLevel: null,
          volumeSize: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
        },
        tzap: {
          cleanSource: false,
          compressionLevel: null,
          volumeSize: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
        },
        sevenZ: {
          cleanSource: false,
          compressionLevel: null,
          volumeSize: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
        },
      },
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: "C:/Archives",
      defaultExtractionBehavior: "extractToFolder",
      previewCleanupPolicy: "whenAppCloses",
      showParentFolderItem: false,
      showRealFileIcons: false,
      showGridLines: false,
      fullRowSelect: false,
      singleClickOpen: true,
      alternativeSelectionMode: true,
      toolbarVisible: false,
      largeToolbarButtons: true,
      showToolbarLabels: false,
      flatViewDefault: true,
      tableVisibleColumnIds: ["name", "size", "crc"],
      tableColumnOrderIds: [
        "name",
        "crc",
        "size",
        "compressedSize",
        "modified",
        "created",
        "accessed",
        "attributes",
        "encrypted",
        "method",
        "block",
        "comment",
        "kind",
        "ratio",
      ],
      tableColumnWidths: { name: 240, size: 130 },
      tableSortKey: "size",
      tableSortAscending: false,
    });
  });

  it("falls back when stored values are invalid", () => {
    const storage = memoryStorage({
      "zmanager.defaultArchiveFormat": "rar",
      "zmanager.defaultCleanSourceEnabled": "yes",
      "zmanager.defaultOutputLocation": "downloads",
      "zmanager.defaultExtractionBehavior": "alwaysOverwrite",
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
        createFormatDefaults: {
          ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
          sevenZ: {
            cleanSource: false,
            compressionLevel: 22,
            volumeSize: 4096,
            preserveMetadata: true,
            replaceExisting: true,
            promptForPassword: true,
          },
        },
        defaultOutputLocation: "sourceFolder",
        customOutputFolderPath: "   ",
        defaultExtractionBehavior: "extractHere",
        previewCleanupPolicy: "whenAppCloses",
        showParentFolderItem: false,
        showRealFileIcons: true,
        showGridLines: false,
        fullRowSelect: true,
        singleClickOpen: false,
        alternativeSelectionMode: false,
        toolbarVisible: true,
        largeToolbarButtons: true,
        showToolbarLabels: false,
        flatViewDefault: true,
        tableVisibleColumnIds: ["size"],
        tableColumnOrderIds: DEFAULT_APP_PREFERENCES.tableColumnOrderIds,
        tableColumnWidths: { name: 240 },
        tableSortKey: "size",
        tableSortAscending: false,
      },
      storage,
    );

    expect(Object.fromEntries(storage.values)).toEqual({
      "zmanager.defaultArchiveFormat": "sevenZ",
      "zmanager.defaultCleanSourceEnabled": "false",
      "zmanager.createFormatDefaults": JSON.stringify({
        ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
        sevenZ: {
          cleanSource: false,
          compressionLevel: 22,
          volumeSize: 4096,
          preserveMetadata: true,
          replaceExisting: true,
          promptForPassword: true,
        },
      }),
      "zmanager.defaultOutputLocation": "sourceFolder",
      "zmanager.defaultExtractionBehavior": "extractHere",
      "zmanager.previewCleanupPolicy": "whenAppCloses",
      "zmanager.showParentFolderItem": "false",
      "zmanager.showRealFileIcons": "true",
      "zmanager.showGridLines": "false",
      "zmanager.fullRowSelect": "true",
      "zmanager.singleClickOpen": "false",
      "zmanager.alternativeSelectionMode": "false",
      "zmanager.toolbarVisible": "true",
      "zmanager.largeToolbarButtons": "true",
      "zmanager.showToolbarLabels": "false",
      "zmanager.flatViewDefault": "true",
      "zmanager.tableVisibleColumns": "name,size",
      "zmanager.tableColumnOrder": DEFAULT_APP_PREFERENCES.tableColumnOrderIds.join(","),
      "zmanager.tableColumnWidths": "{\"name\":240}",
      "zmanager.tableSortKey": "size",
      "zmanager.tableSortAscending": "false",
    });
  });

  it("normalizes patches and resolves default create directories", () => {
    const preferences = preferencesWithPatch(DEFAULT_APP_PREFERENCES, {
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: " /tmp/archives ",
      createFormatDefaults: {
        ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
        zip: {
          cleanSource: false,
          compressionLevel: 9,
          volumeSize: 1024,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: true,
        },
      },
    });

    expect(preferences.customOutputFolderPath).toBe("/tmp/archives");
    expect(createDefaultsForFormat(preferences, "zip")).toEqual({
      cleanSource: false,
      compressionLevel: 9,
      volumeSize: 1024,
      preserveMetadata: true,
      replaceExisting: false,
      promptForPassword: true,
    });
    expect(defaultCreateDirectory(preferences)).toBe("/tmp/archives");
    expect(defaultCreateDirectory(DEFAULT_APP_PREFERENCES)).toBeNull();
  });
});
