import type { LegacyReplacementPreferencesDto } from "../api/types";
import {
  PREFERENCE_KEYS,
  type PreferenceStorage,
} from "./preferenceStorage";

type MigratedPreferenceKey =
  | "defaultArchiveFormat"
  | "defaultCleanSourceEnabled"
  | "defaultOutputLocation"
  | "customOutputFolderPath"
  | "defaultExtractionBehavior"
  | "customExtractFolderPath"
  | "previewCleanupPolicy";

const MIGRATED_KEYS = new Set<MigratedPreferenceKey>([
  "defaultArchiveFormat",
  "defaultCleanSourceEnabled",
  "defaultOutputLocation",
  "customOutputFolderPath",
  "defaultExtractionBehavior",
  "customExtractFolderPath",
  "previewCleanupPolicy",
]);

export function applyReplacementPreferences(
  storage: PreferenceStorage,
  legacy: LegacyReplacementPreferencesDto,
): MigratedPreferenceKey[] {
  const candidates = replacementPreferenceValues(legacy);
  const applied: MigratedPreferenceKey[] = [];
  for (const [key, value] of Object.entries(candidates) as [MigratedPreferenceKey, string][]) {
    const storageKey = PREFERENCE_KEYS[key];
    // Presence, including an invalid newer value, wins. Migration must never
    // silently replace a choice made by the replacement application.
    if (storage.getItem(storageKey) !== null) {
      continue;
    }
    storage.setItem(storageKey, value);
    applied.push(key);
  }
  return applied;
}

export function rollbackReplacementPreferences(
  storage: PreferenceStorage,
  legacy: LegacyReplacementPreferencesDto,
  appliedKeys: readonly string[],
): MigratedPreferenceKey[] {
  const candidates = replacementPreferenceValues(legacy);
  const removed: MigratedPreferenceKey[] = [];
  for (const key of appliedKeys) {
    if (!MIGRATED_KEYS.has(key as MigratedPreferenceKey)) {
      continue;
    }
    const migratedKey = key as MigratedPreferenceKey;
    const expected = candidates[migratedKey];
    const storageKey = PREFERENCE_KEYS[migratedKey];
    // Preserve values changed after migration; only the exact migrated value
    // is safe to remove during rollback.
    if (expected !== undefined && storage.getItem(storageKey) === expected) {
      storage.removeItem(storageKey);
      removed.push(migratedKey);
    }
  }
  return removed;
}

function replacementPreferenceValues(
  legacy: LegacyReplacementPreferencesDto,
): Partial<Record<MigratedPreferenceKey, string>> {
  const values: Partial<Record<MigratedPreferenceKey, string>> = {};
  const archiveFormat = oneOf(
    ["tarZst", "tarGz", "tzap", "sevenZ", "zip"] as const,
    legacy.defaultArchiveFormat,
  ) ?? (legacy.legacyDefaultCreateProfile === "zip"
    ? "zip"
    : legacy.legacyDefaultCreateProfile === "cleanSource" ? "tarZst" : null);
  if (archiveFormat) values.defaultArchiveFormat = archiveFormat;

  const cleanSource = typeof legacy.defaultCleanSourceEnabled === "boolean"
    ? legacy.defaultCleanSourceEnabled
    : legacy.legacyDefaultCreateProfile === "zip"
      ? false
      : legacy.legacyDefaultCreateProfile === "cleanSource" ? true : null;
  if (cleanSource !== null) values.defaultCleanSourceEnabled = String(cleanSource);

  const outputLocation = oneOf(
    ["sourceFolder", "customFolder"] as const,
    legacy.defaultOutputLocation,
  );
  if (outputLocation) values.defaultOutputLocation = outputLocation;
  const outputPath = absolutePath(legacy.customOutputFolderPath);
  if (outputPath) values.customOutputFolderPath = outputPath;

  if (typeof legacy.quickOpenExtractionEnabled === "boolean") {
    values.defaultExtractionBehavior = legacy.quickOpenExtractionEnabled
      ? legacy.quickExtractionLocation === "chosenFolder" ? "extractToFolder" : "extractHere"
      : "askEveryTime";
  }
  const extractPath = absolutePath(legacy.quickExtractionFolderPath);
  if (extractPath) values.customExtractFolderPath = extractPath;

  const cleanup = oneOf(
    ["beforeNextPreview", "whenAppCloses"] as const,
    legacy.previewCleanupPolicy,
  );
  if (cleanup) values.previewCleanupPolicy = cleanup;
  return values;
}

function oneOf<const Value extends string>(
  allowed: readonly Value[],
  value: string | null,
): Value | null {
  return typeof value === "string" && allowed.includes(value as Value)
    ? value as Value
    : null;
}

function absolutePath(value: string | null): string | null {
  const path = value?.trim() ?? "";
  return path.startsWith("/") && !path.includes("\0") ? path : null;
}
