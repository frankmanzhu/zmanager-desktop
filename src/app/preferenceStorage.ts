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
  | "defaultOutputLocation"
  | "customOutputFolderPath"
  | "defaultExtractionBehavior"
  | "previewCleanupPolicy"
  | "showParentFolderItem"
  | "showRealFileIcons"
  | "showGridLines"
  | "fullRowSelect"
  | "singleClickOpen"
  | "alternativeSelectionMode"
  | "toolbarVisible"
  | "largeToolbarButtons"
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
  defaultOutputLocation: "zmanager.defaultOutputLocation",
  customOutputFolderPath: "zmanager.customOutputFolderPath",
  defaultExtractionBehavior: "zmanager.defaultExtractionBehavior",
  previewCleanupPolicy: "zmanager.previewCleanupPolicy",
  showParentFolderItem: "zmanager.showParentFolderItem",
  showRealFileIcons: "zmanager.showRealFileIcons",
  showGridLines: "zmanager.showGridLines",
  fullRowSelect: "zmanager.fullRowSelect",
  singleClickOpen: "zmanager.singleClickOpen",
  alternativeSelectionMode: "zmanager.alternativeSelectionMode",
  toolbarVisible: "zmanager.toolbarVisible",
  largeToolbarButtons: "zmanager.largeToolbarButtons",
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
