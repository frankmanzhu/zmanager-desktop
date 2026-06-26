import type { CreateArchiveFormat } from "./createFlow";
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
  quickOpenExtractionEnabled: boolean;
  previewCleanupPolicy: PreviewCleanupPolicy;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultArchiveFormat: "tarZst",
  defaultCleanSourceEnabled: true,
  defaultOutputLocation: "sourceFolder",
  customOutputFolderPath: "",
  defaultExtractionBehavior: "askEveryTime",
  quickOpenExtractionEnabled: false,
  previewCleanupPolicy: "beforeNextPreview",
};

const ARCHIVE_FORMATS = ["zip", "tarZst", "tzap", "sevenZ"] as const;
const OUTPUT_LOCATIONS = ["sourceFolder", "customFolder"] as const;
const EXTRACTION_BEHAVIORS = ["askEveryTime", "extractHere", "extractToFolder"] as const;
const PREVIEW_CLEANUP_POLICIES = ["beforeNextPreview", "whenAppCloses"] as const;

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

export function loadAppPreferences(storage = resolvePreferenceStorage()): AppPreferences {
  if (!storage) {
    return { ...DEFAULT_APP_PREFERENCES };
  }

  const defaultArchiveFormat = storage.getItem(PREFERENCE_KEYS.defaultArchiveFormat);
  const defaultOutputLocation = storage.getItem(PREFERENCE_KEYS.defaultOutputLocation);
  const defaultExtractionBehavior = storage.getItem(PREFERENCE_KEYS.defaultExtractionBehavior);
  const previewCleanupPolicy = storage.getItem(PREFERENCE_KEYS.previewCleanupPolicy);

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
    quickOpenExtractionEnabled: storedBool(
      storage.getItem(PREFERENCE_KEYS.quickOpenExtractionEnabled),
      DEFAULT_APP_PREFERENCES.quickOpenExtractionEnabled,
    ),
    previewCleanupPolicy: isOneOf(PREVIEW_CLEANUP_POLICIES, previewCleanupPolicy)
      ? previewCleanupPolicy
      : DEFAULT_APP_PREFERENCES.previewCleanupPolicy,
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
  storage.setItem(PREFERENCE_KEYS.quickOpenExtractionEnabled, String(preferences.quickOpenExtractionEnabled));
  storage.setItem(PREFERENCE_KEYS.previewCleanupPolicy, preferences.previewCleanupPolicy);

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
    customOutputFolderPath:
      patch.customOutputFolderPath !== undefined
        ? patch.customOutputFolderPath.trim()
        : preferences.customOutputFolderPath,
  };
}

export function defaultCreateDirectory(preferences: AppPreferences): string | null {
  if (preferences.defaultOutputLocation !== "customFolder") {
    return null;
  }

  return preferences.customOutputFolderPath.trim() || null;
}
