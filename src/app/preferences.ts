import type { CreateArchiveFormat } from "./createFlow";
import {
  DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
  normalizeColumnSettings,
  type ArchiveSortKey,
  type ArchiveTableColumnId,
  type ArchiveTableColumnWidthMap,
} from "./archiveTable";
import {
  PREFERENCE_KEYS,
  resolvePreferenceStorage,
  type PreferenceStorage,
} from "./preferenceStorage";

export type DefaultOutputLocation = "sourceFolder" | "customFolder";
export type DefaultExtractionBehavior = "askEveryTime" | "extractHere" | "extractToFolder";
export type PreviewCleanupPolicy = "beforeNextPreview" | "whenAppCloses";

export type AppPreferences = {
  defaultArchiveFormat: CreateArchiveFormat;
  defaultCleanSourceEnabled: boolean;
  defaultOutputLocation: DefaultOutputLocation;
  customOutputFolderPath: string;
  defaultExtractionBehavior: DefaultExtractionBehavior;
  previewCleanupPolicy: PreviewCleanupPolicy;
  showParentFolderItem: boolean;
  showRealFileIcons: boolean;
  showGridLines: boolean;
  fullRowSelect: boolean;
  singleClickOpen: boolean;
  alternativeSelectionMode: boolean;
  toolbarVisible: boolean;
  largeToolbarButtons: boolean;
  showToolbarLabels: boolean;
  flatViewDefault: boolean;
  tableVisibleColumnIds: ArchiveTableColumnId[];
  tableColumnOrderIds: ArchiveTableColumnId[];
  tableColumnWidths: ArchiveTableColumnWidthMap;
  tableSortKey: ArchiveSortKey;
  tableSortAscending: boolean;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultArchiveFormat: "tarZst",
  defaultCleanSourceEnabled: true,
  defaultOutputLocation: "sourceFolder",
  customOutputFolderPath: "",
  defaultExtractionBehavior: "askEveryTime",
  previewCleanupPolicy: "beforeNextPreview",
  showParentFolderItem: true,
  showRealFileIcons: true,
  showGridLines: true,
  fullRowSelect: true,
  singleClickOpen: false,
  alternativeSelectionMode: false,
  toolbarVisible: true,
  largeToolbarButtons: false,
  showToolbarLabels: true,
  flatViewDefault: false,
  tableVisibleColumnIds: DEFAULT_ARCHIVE_TABLE_COLUMN_IDS,
  tableColumnOrderIds: DEFAULT_ARCHIVE_TABLE_COLUMN_ORDER_IDS,
  tableColumnWidths: {},
  tableSortKey: "name",
  tableSortAscending: true,
};

const ARCHIVE_FORMATS = ["zip", "tarZst", "tzap", "sevenZ"] as const;
const OUTPUT_LOCATIONS = ["sourceFolder", "customFolder"] as const;
const EXTRACTION_BEHAVIORS = ["askEveryTime", "extractHere", "extractToFolder"] as const;
const PREVIEW_CLEANUP_POLICIES = ["beforeNextPreview", "whenAppCloses"] as const;
const TABLE_SORT_KEYS = [
  "name",
  "size",
  "compressedSize",
  "modified",
  "created",
  "accessed",
  "attributes",
  "encrypted",
  "method",
  "crc",
  "block",
  "comment",
  "kind",
  "ratio",
] as const;

function isOneOf<T extends readonly string[]>(values: T, value: string | null): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function storedBool(value: string | null, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function cleanPath(value: string | null): string {
  return value?.trim() ?? "";
}

function loadVisibleColumnIds(value: string | null): ArchiveTableColumnId[] {
  if (!value) {
    return DEFAULT_APP_PREFERENCES.tableVisibleColumnIds;
  }

  return normalizeColumnSettings({
    visibleColumnIds: value.split(",").map((item) => item.trim()) as ArchiveTableColumnId[],
  }).visibleColumnIds;
}

function loadColumnOrderIds(value: string | null): ArchiveTableColumnId[] {
  if (!value) {
    return DEFAULT_APP_PREFERENCES.tableColumnOrderIds;
  }

  return normalizeColumnSettings({
    columnOrderIds: value.split(",").map((item) => item.trim()) as ArchiveTableColumnId[],
  }).columnOrderIds;
}

function loadColumnWidths(value: string | null): ArchiveTableColumnWidthMap {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const columnWidths = Object.fromEntries(
      Object.entries(parsed)
        .filter(([, width]) => typeof width === "number" && Number.isFinite(width)),
    ) as ArchiveTableColumnWidthMap;
    return normalizeColumnSettings({ columnWidths }).columnWidths;
  } catch {
    return {};
  }
}

export function loadAppPreferences(storage = resolvePreferenceStorage()): AppPreferences {
  if (!storage) {
    return { ...DEFAULT_APP_PREFERENCES };
  }

  const defaultArchiveFormat = storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat);
  const defaultOutputLocation = storage.getItem(PREFERENCE_KEYS.defaultOutputLocation);
  const defaultExtractionBehavior = storage.getItem(PREFERENCE_KEYS.defaultExtractionBehavior);
  const previewCleanupPolicy = storage.getItem(PREFERENCE_KEYS.previewCleanupPolicy);
  const tableSortKey = storage.getItem(PREFERENCE_KEYS.tableSortKey);

  return {
    defaultArchiveFormat: isOneOf(ARCHIVE_FORMATS, defaultArchiveFormat)
      ? defaultArchiveFormat
      : DEFAULT_APP_PREFERENCES.defaultArchiveFormat,
    defaultCleanSourceEnabled: storedBool(
      storage.getItem(PREFERENCE_KEYS.defaultCleanSourceEnabled),
      DEFAULT_APP_PREFERENCES.defaultCleanSourceEnabled,
    ),
    defaultOutputLocation: isOneOf(OUTPUT_LOCATIONS, defaultOutputLocation)
      ? defaultOutputLocation
      : DEFAULT_APP_PREFERENCES.defaultOutputLocation,
    customOutputFolderPath: cleanPath(storage.getItem(PREFERENCE_KEYS.customOutputFolderPath)),
    defaultExtractionBehavior: isOneOf(EXTRACTION_BEHAVIORS, defaultExtractionBehavior)
      ? defaultExtractionBehavior
      : DEFAULT_APP_PREFERENCES.defaultExtractionBehavior,
    previewCleanupPolicy: isOneOf(PREVIEW_CLEANUP_POLICIES, previewCleanupPolicy)
      ? previewCleanupPolicy
      : DEFAULT_APP_PREFERENCES.previewCleanupPolicy,
    showParentFolderItem: storedBool(
      storage.getItem(PREFERENCE_KEYS.showParentFolderItem),
      DEFAULT_APP_PREFERENCES.showParentFolderItem,
    ),
    showRealFileIcons: storedBool(
      storage.getItem(PREFERENCE_KEYS.showRealFileIcons),
      DEFAULT_APP_PREFERENCES.showRealFileIcons,
    ),
    showGridLines: storedBool(
      storage.getItem(PREFERENCE_KEYS.showGridLines),
      DEFAULT_APP_PREFERENCES.showGridLines,
    ),
    fullRowSelect: storedBool(
      storage.getItem(PREFERENCE_KEYS.fullRowSelect),
      DEFAULT_APP_PREFERENCES.fullRowSelect,
    ),
    singleClickOpen: storedBool(
      storage.getItem(PREFERENCE_KEYS.singleClickOpen),
      DEFAULT_APP_PREFERENCES.singleClickOpen,
    ),
    alternativeSelectionMode: storedBool(
      storage.getItem(PREFERENCE_KEYS.alternativeSelectionMode),
      DEFAULT_APP_PREFERENCES.alternativeSelectionMode,
    ),
    toolbarVisible: storedBool(
      storage.getItem(PREFERENCE_KEYS.toolbarVisible),
      DEFAULT_APP_PREFERENCES.toolbarVisible,
    ),
    largeToolbarButtons: storedBool(
      storage.getItem(PREFERENCE_KEYS.largeToolbarButtons),
      DEFAULT_APP_PREFERENCES.largeToolbarButtons,
    ),
    showToolbarLabels: storedBool(
      storage.getItem(PREFERENCE_KEYS.showToolbarLabels),
      DEFAULT_APP_PREFERENCES.showToolbarLabels,
    ),
    flatViewDefault: storedBool(
      storage.getItem(PREFERENCE_KEYS.flatViewDefault),
      DEFAULT_APP_PREFERENCES.flatViewDefault,
    ),
    tableVisibleColumnIds: loadVisibleColumnIds(storage.getItem(PREFERENCE_KEYS.tableVisibleColumns)),
    tableColumnOrderIds: loadColumnOrderIds(storage.getItem(PREFERENCE_KEYS.tableColumnOrder)),
    tableColumnWidths: loadColumnWidths(storage.getItem(PREFERENCE_KEYS.tableColumnWidths)),
    tableSortKey: isOneOf(TABLE_SORT_KEYS, tableSortKey)
      ? tableSortKey
      : DEFAULT_APP_PREFERENCES.tableSortKey,
    tableSortAscending: storedBool(
      storage.getItem(PREFERENCE_KEYS.tableSortAscending),
      DEFAULT_APP_PREFERENCES.tableSortAscending,
    ),
  };
}

export function saveAppPreferences(preferences: AppPreferences, storage = resolvePreferenceStorage()): void {
  if (!storage) {
    return;
  }

  storage.setItem(PREFERENCE_KEYS.defaultArchiveFormat, preferences.defaultArchiveFormat);
  storage.setItem(PREFERENCE_KEYS.defaultCleanSourceEnabled, String(preferences.defaultCleanSourceEnabled));
  storage.setItem(PREFERENCE_KEYS.defaultOutputLocation, preferences.defaultOutputLocation);
  storage.setItem(PREFERENCE_KEYS.defaultExtractionBehavior, preferences.defaultExtractionBehavior);
  storage.setItem(PREFERENCE_KEYS.previewCleanupPolicy, preferences.previewCleanupPolicy);
  storage.setItem(PREFERENCE_KEYS.showParentFolderItem, String(preferences.showParentFolderItem));
  storage.setItem(PREFERENCE_KEYS.showRealFileIcons, String(preferences.showRealFileIcons));
  storage.setItem(PREFERENCE_KEYS.showGridLines, String(preferences.showGridLines));
  storage.setItem(PREFERENCE_KEYS.fullRowSelect, String(preferences.fullRowSelect));
  storage.setItem(PREFERENCE_KEYS.singleClickOpen, String(preferences.singleClickOpen));
  storage.setItem(PREFERENCE_KEYS.alternativeSelectionMode, String(preferences.alternativeSelectionMode));
  storage.setItem(PREFERENCE_KEYS.toolbarVisible, String(preferences.toolbarVisible));
  storage.setItem(PREFERENCE_KEYS.largeToolbarButtons, String(preferences.largeToolbarButtons));
  storage.setItem(PREFERENCE_KEYS.showToolbarLabels, String(preferences.showToolbarLabels));
  storage.setItem(PREFERENCE_KEYS.flatViewDefault, String(preferences.flatViewDefault));
  const tableSettings = normalizeColumnSettings({
    visibleColumnIds: preferences.tableVisibleColumnIds,
    columnOrderIds: preferences.tableColumnOrderIds,
    columnWidths: preferences.tableColumnWidths,
  });
  storage.setItem(PREFERENCE_KEYS.tableVisibleColumns, tableSettings.visibleColumnIds.join(","));
  storage.setItem(PREFERENCE_KEYS.tableColumnOrder, tableSettings.columnOrderIds.join(","));
  storage.setItem(PREFERENCE_KEYS.tableColumnWidths, JSON.stringify(tableSettings.columnWidths));
  storage.setItem(PREFERENCE_KEYS.tableSortKey, preferences.tableSortKey);
  storage.setItem(PREFERENCE_KEYS.tableSortAscending, String(preferences.tableSortAscending));

  const customOutputFolderPath = preferences.customOutputFolderPath.trim();
  if (customOutputFolderPath) {
    storage.setItem(PREFERENCE_KEYS.customOutputFolderPath, customOutputFolderPath);
  } else {
    storage.removeItem(PREFERENCE_KEYS.customOutputFolderPath);
  }
}

export function preferencesWithPatch(
  preferences: AppPreferences,
  patch: Partial<AppPreferences>,
): AppPreferences {
  return {
    ...preferences,
    ...patch,
    ...normalizePreferenceTablePatch(preferences, patch),
    customOutputFolderPath:
      patch.customOutputFolderPath !== undefined
        ? patch.customOutputFolderPath.trim()
        : preferences.customOutputFolderPath,
  };
}

function normalizePreferenceTablePatch(
  preferences: AppPreferences,
  patch: Partial<AppPreferences>,
): Pick<AppPreferences, "tableVisibleColumnIds" | "tableColumnOrderIds" | "tableColumnWidths"> {
  const normalized = normalizeColumnSettings({
    visibleColumnIds: patch.tableVisibleColumnIds ?? preferences.tableVisibleColumnIds,
    columnOrderIds: patch.tableColumnOrderIds ?? preferences.tableColumnOrderIds,
    columnWidths: patch.tableColumnWidths ?? preferences.tableColumnWidths,
  });

  return {
    tableVisibleColumnIds: normalized.visibleColumnIds,
    tableColumnOrderIds: normalized.columnOrderIds,
    tableColumnWidths: normalized.columnWidths,
  };
}

export function defaultCreateDirectory(preferences: AppPreferences): string | null {
  if (preferences.defaultOutputLocation !== "customFolder") {
    return null;
  }

  return preferences.customOutputFolderPath.trim() || null;
}
