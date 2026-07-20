export type PreferenceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type PreferenceStorageKey =
  | "locale"
  | "defaultArchiveFormat"
  | "defaultCleanSourceEnabled"
  | "createFormatDefaults"
  | "volumeSizePresets"
  | "defaultOutputLocation"
  | "customOutputFolderPath"
  | "customExtractFolderPath"
  | "defaultExtractionBehavior"
  | "defaultExtractPathMode"
  | "defaultExtractOverwrite"
  | "defaultExtractStripComponents"
  | "defaultExtractDeduplicateRoot"
  | "defaultTzapRestorePolicy"
  | "defaultTzapAllowDegraded"
  | "defaultTzapAllowAbsoluteSymlinks"
  | "previewCleanupPolicy"
  | "showParentFolderItem"
  | "showRealFileIcons"
  | "showGridLines"
  | "fullRowSelect"
  | "singleClickOpen"
  | "alternativeSelectionMode"
  | "showToolbarLabels"
  | "flatViewDefault"
  | "tableVisibleColumns"
  | "tableColumnOrder"
  | "tableColumnWidths"
  | "tableSortKey"
  | "tableSortAscending";

export const PREFERENCE_KEYS = {
  locale: "zmanager.locale",
  defaultArchiveFormat: "zmanager.defaultArchiveFormat",
  defaultCleanSourceEnabled: "zmanager.defaultCleanSourceEnabled",
  createFormatDefaults: "zmanager.createFormatDefaults",
  volumeSizePresets: "zmanager.volumeSizePresets",
  defaultOutputLocation: "zmanager.defaultOutputLocation",
  customOutputFolderPath: "zmanager.customOutputFolderPath",
  customExtractFolderPath: "zmanager.customExtractFolderPath",
  defaultExtractionBehavior: "zmanager.defaultExtractionBehavior",
  defaultExtractPathMode: "zmanager.defaultExtractPathMode",
  defaultExtractOverwrite: "zmanager.defaultExtractOverwrite",
  defaultExtractStripComponents: "zmanager.defaultExtractStripComponents",
  defaultExtractDeduplicateRoot: "zmanager.defaultExtractDeduplicateRoot",
  defaultTzapRestorePolicy: "zmanager.defaultTzapRestorePolicy",
  defaultTzapAllowDegraded: "zmanager.defaultTzapAllowDegraded",
  defaultTzapAllowAbsoluteSymlinks: "zmanager.defaultTzapAllowAbsoluteSymlinks",
  previewCleanupPolicy: "zmanager.previewCleanupPolicy",
  showParentFolderItem: "zmanager.showParentFolderItem",
  showRealFileIcons: "zmanager.showRealFileIcons",
  showGridLines: "zmanager.showGridLines",
  fullRowSelect: "zmanager.fullRowSelect",
  singleClickOpen: "zmanager.singleClickOpen",
  alternativeSelectionMode: "zmanager.alternativeSelectionMode",
  showToolbarLabels: "zmanager.showToolbarLabels",
  flatViewDefault: "zmanager.flatViewDefault",
  tableVisibleColumns: "zmanager.tableVisibleColumns",
  tableColumnOrder: "zmanager.tableColumnOrder",
  tableColumnWidths: "zmanager.tableColumnWidths",
  tableSortKey: "zmanager.tableSortKey",
  tableSortAscending: "zmanager.tableSortAscending",
} satisfies Record<PreferenceStorageKey, string>;

export function resolvePreferenceStorage(): PreferenceStorage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}
