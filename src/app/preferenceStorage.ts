export type PreferenceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type PreferenceStorageKey =
  | "defaultArchiveFormat"
  | "defaultCleanSourceEnabled"
  | "defaultOutputLocation"
  | "customOutputFolderPath"
  | "defaultExtractionBehavior"
  | "quickOpenExtractionEnabled"
  | "previewCleanupPolicy";

export const PREFERENCE_KEYS = {
  defaultArchiveFormat: "zmanager.defaultArchiveFormat",
  defaultCleanSourceEnabled: "zmanager.defaultCleanSourceEnabled",
  defaultOutputLocation: "zmanager.defaultOutputLocation",
  customOutputFolderPath: "zmanager.customOutputFolderPath",
  defaultExtractionBehavior: "zmanager.defaultExtractionBehavior",
  quickOpenExtractionEnabled: "zmanager.quickOpenExtractionEnabled",
  previewCleanupPolicy: "zmanager.previewCleanupPolicy",
} satisfies Record<PreferenceStorageKey, string>;

export function resolvePreferenceStorage(): PreferenceStorage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}
