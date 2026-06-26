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
  | "previewCleanupPolicy"
  | "showParentFolderItem"
  | "showGridLines"
  | "fullRowSelect"
  | "singleClickOpen"
  | "alternativeSelectionMode"
  | "toolbarVisible"
  | "largeToolbarButtons"
  | "showToolbarLabels"
  | "flatViewDefault"
  | "tableVisibleColumns"
  | "tableSortKey"
  | "tableSortAscending";

export const PREFERENCE_KEYS = {
  defaultArchiveFormat: "zmanager.defaultArchiveFormat",
  defaultCleanSourceEnabled: "zmanager.defaultCleanSourceEnabled",
  defaultOutputLocation: "zmanager.defaultOutputLocation",
  customOutputFolderPath: "zmanager.customOutputFolderPath",
  defaultExtractionBehavior: "zmanager.defaultExtractionBehavior",
  quickOpenExtractionEnabled: "zmanager.quickOpenExtractionEnabled",
  previewCleanupPolicy: "zmanager.previewCleanupPolicy",
  showParentFolderItem: "zmanager.showParentFolderItem",
  showGridLines: "zmanager.showGridLines",
  fullRowSelect: "zmanager.fullRowSelect",
  singleClickOpen: "zmanager.singleClickOpen",
  alternativeSelectionMode: "zmanager.alternativeSelectionMode",
  toolbarVisible: "zmanager.toolbarVisible",
  largeToolbarButtons: "zmanager.largeToolbarButtons",
  showToolbarLabels: "zmanager.showToolbarLabels",
  flatViewDefault: "zmanager.flatViewDefault",
  tableVisibleColumns: "zmanager.tableVisibleColumns",
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
