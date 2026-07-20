import { describe, expect, it } from "vitest";

import {
  DEFAULT_APP_PREFERENCES,
  defaultCreateDirectory,
  loadAppPreferences,
  preferencesWithPatch,
  createDefaultsForFormat,
  saveAppPreferences,
  type AppPreferences,
} from "./preferences";
import { PREFERENCE_KEYS, type PreferenceStorage } from "./preferenceStorage";

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
      "zmanager.locale": "en",
      "zmanager.defaultArchiveFormat": "zip",
      "zmanager.defaultCleanSourceEnabled": "false",
      "zmanager.createFormatDefaults": JSON.stringify({
        zip: {
          cleanSource: false,
          respectGitignore: false,
          followSymlinks: false,
          compressionLevel: 9,
          volumeSize: 1048576,
          tzapRecoveryPercentage: null,
          preserveMetadata: false,
          replaceExisting: true,
          promptForPassword: true,
          zipCompression: "deflate",
        },
      }),
      "zmanager.defaultOutputLocation": "customFolder",
      "zmanager.customOutputFolderPath": " C:/Archives ",
      "zmanager.defaultExtractionBehavior": "extractToFolder",
      "zmanager.defaultExtractPathMode": "current",
      "zmanager.defaultExtractOverwrite": "rename",
      "zmanager.defaultExtractStripComponents": "2",
      "zmanager.defaultExtractDeduplicateRoot": "true",
      "zmanager.defaultTzapRestorePolicy": "sameOs",
      "zmanager.defaultTzapAllowDegraded": "true",
      "zmanager.defaultTzapAllowAbsoluteSymlinks": "true",
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
      locale: "en",
      defaultArchiveFormat: "zip",
      defaultCleanSourceEnabled: false,
      createFormatDefaults: {
        zip: {
          cleanSource: false,
          respectGitignore: false,
          followSymlinks: false,
          compressionLevel: 9,
          volumeSize: 1048576,
          tzapRecoveryPercentage: null,
          preserveMetadata: false,
          replaceExisting: true,
          promptForPassword: true,
          zipCompression: "deflate",
        },
        tarZst: {
          cleanSource: false,
          respectGitignore: false,
          followSymlinks: false,
          compressionLevel: null,
          volumeSize: null,
          tzapRecoveryPercentage: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
        },
        tzap: {
          cleanSource: false,
          respectGitignore: false,
          followSymlinks: false,
          compressionLevel: null,
          volumeSize: null,
          tzapRecoveryPercentage: 5,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
          tzapVolumeLossTolerance: 0,
          tzapSigningMode: "identity",
          tzapSigningIdentityPath: "",
          tzapSigningCertificatePath: "",
          tzapSigningPrivateKeyPath: "",
          tzapSigningChainPaths: "",
        },
        sevenZ: {
          cleanSource: false,
          respectGitignore: false,
          followSymlinks: false,
          compressionLevel: null,
          volumeSize: null,
          tzapRecoveryPercentage: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: false,
          sevenZSolid: true,
          sevenZThreads: null,
          sevenZChunkSize: null,
          sevenZEncryptFileNames: true,
        },
      },
      volumeSizePresets: DEFAULT_APP_PREFERENCES.volumeSizePresets,
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: "C:/Archives",
      customExtractFolderPath: "",
      defaultExtractionBehavior: "extractToFolder",
      defaultExtractPathMode: "current",
      defaultExtractOverwrite: "rename",
      defaultExtractStripComponents: 2,
      defaultExtractDeduplicateRoot: true,
      defaultTzapRestorePolicy: "sameOs",
      defaultTzapAllowDegraded: true,
      defaultTzapAllowAbsoluteSymlinks: true,
      previewCleanupPolicy: "whenAppCloses",
      showParentFolderItem: false,
      showRealFileIcons: false,
      showGridLines: false,
      fullRowSelect: false,
      singleClickOpen: true,
      alternativeSelectionMode: true,
      showToolbarLabels: false,
      flatViewDefault: true,
      tableVisibleColumnIds: ["name", "size", "crc"],
      tableColumnOrderIds: [
        "name",
        "crc",
        "size",
        "compressedSize",
        "modified",
        "mode",
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
      "zmanager.locale": "ja-JP",
      "zmanager.defaultArchiveFormat": "rar",
      "zmanager.defaultCleanSourceEnabled": "yes",
      "zmanager.defaultOutputLocation": "downloads",
      "zmanager.defaultExtractionBehavior": "alwaysOverwrite",
      "zmanager.previewCleanupPolicy": "never",
    });

    expect(loadAppPreferences(storage)).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("loads the supported Simplified Chinese locale preference", () => {
    const storage = memoryStorage({
      "zmanager.locale": "zh-CN",
    });

    expect(loadAppPreferences(storage).locale).toBe("zh-CN");
  });

  it("saves non-sensitive preference fields and removes blank custom output", () => {
    const storage = memoryStorage({
      "zmanager.customOutputFolderPath": "C:/Old",
    });

    saveAppPreferences(
      {
        ...DEFAULT_APP_PREFERENCES,
        defaultArchiveFormat: "sevenZ",
        defaultCleanSourceEnabled: false,
        createFormatDefaults: {
          ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
          sevenZ: {
            cleanSource: false,
            compressionLevel: 22,
            volumeSize: 4096,
            tzapRecoveryPercentage: null,
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
        showToolbarLabels: false,
        flatViewDefault: true,
        tableVisibleColumnIds: ["size"],
        tableColumnOrderIds: DEFAULT_APP_PREFERENCES.tableColumnOrderIds,
        tableColumnWidths: { name: 240 },
        tableSortKey: "size",
        tableSortAscending: false,
        locale: "en",
      },
      storage,
    );

    expect(Object.fromEntries(storage.values)).toEqual({
      "zmanager.locale": "en",
      "zmanager.defaultArchiveFormat": "sevenZ",
      "zmanager.defaultCleanSourceEnabled": "false",
      "zmanager.createFormatDefaults": JSON.stringify({
        ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
        sevenZ: {
          cleanSource: false,
          compressionLevel: 22,
          volumeSize: 4096,
          tzapRecoveryPercentage: null,
          preserveMetadata: true,
          replaceExisting: true,
          promptForPassword: true,
        },
      }),
      "zmanager.volumeSizePresets": JSON.stringify(DEFAULT_APP_PREFERENCES.volumeSizePresets),
      "zmanager.defaultOutputLocation": "sourceFolder",
      "zmanager.defaultExtractionBehavior": "extractHere",
      "zmanager.defaultExtractPathMode": "full",
      "zmanager.defaultExtractOverwrite": "ask",
      "zmanager.defaultExtractStripComponents": "0",
      "zmanager.defaultExtractDeduplicateRoot": "false",
      "zmanager.defaultTzapRestorePolicy": "portable",
      "zmanager.defaultTzapAllowDegraded": "false",
      "zmanager.defaultTzapAllowAbsoluteSymlinks": "false",
      "zmanager.previewCleanupPolicy": "whenAppCloses",
      "zmanager.showParentFolderItem": "false",
      "zmanager.showRealFileIcons": "true",
      "zmanager.showGridLines": "false",
      "zmanager.fullRowSelect": "true",
      "zmanager.singleClickOpen": "false",
      "zmanager.alternativeSelectionMode": "false",
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
          tzapRecoveryPercentage: null,
          preserveMetadata: true,
          replaceExisting: false,
          promptForPassword: true,
        },
      },
    });

    expect(preferences.customOutputFolderPath).toBe("/tmp/archives");
    expect(createDefaultsForFormat(preferences, "zip")).toEqual({
      cleanSource: false,
      respectGitignore: false,
      followSymlinks: false,
      compressionLevel: 9,
      volumeSize: 1024,
      tzapRecoveryPercentage: null,
      preserveMetadata: true,
      replaceExisting: false,
      promptForPassword: true,
      zipCompression: "deflate",
    });
    expect(defaultCreateDirectory(preferences)).toBe("/tmp/archives");
    expect(defaultCreateDirectory(DEFAULT_APP_PREFERENCES)).toBeNull();
  });

  it("normalizes full preference-shaped patches from dialog saves", () => {
    const dialogPreferences: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      customOutputFolderPath: " /tmp/dialog-output ",
      tableVisibleColumnIds: ["size", "name", "size"],
      tableColumnOrderIds: ["size", "name", "size"],
      tableColumnWidths: {
        name: 12,
        size: 1200,
        unknown: 200,
      } as AppPreferences["tableColumnWidths"],
    };

    const preferences = preferencesWithPatch(DEFAULT_APP_PREFERENCES, dialogPreferences);

    expect(preferences.customOutputFolderPath).toBe("/tmp/dialog-output");
    expect(preferences.tableVisibleColumnIds).toEqual(["size", "name"]);
    expect(preferences.tableColumnOrderIds.slice(0, 3)).toEqual(["name", "size", "compressedSize"]);
    expect(preferences.tableColumnWidths).toEqual({
      name: 140,
      size: 520,
    });
  });

  it("treats zero volume defaults as no split", () => {
    const preferences = preferencesWithPatch(DEFAULT_APP_PREFERENCES, {
      createFormatDefaults: {
        ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
        tzap: {
          ...DEFAULT_APP_PREFERENCES.createFormatDefaults.tzap,
          volumeSize: 0,
          tzapRecoveryPercentage: 250,
          tzapVolumeLossTolerance: 99,
        },
      },
    });

    expect(createDefaultsForFormat(preferences, "tzap").volumeSize).toBeNull();
    expect(createDefaultsForFormat(preferences, "tzap").tzapRecoveryPercentage).toBe(100);
    expect(createDefaultsForFormat(preferences, "tzap").tzapVolumeLossTolerance).toBe(0);
  });

  it("declares locale storage through the tracked preference key map", () => {
    expect(PREFERENCE_KEYS.locale).toBe("zmanager.locale");
  });
});
