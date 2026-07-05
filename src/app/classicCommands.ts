import type { BrowseState } from "../api/types";
import type { MessageKey, Translator } from "./i18n/translator";

export const UNSUPPORTED_OPERATION_MESSAGE = "Operation is not supported.";
export const SINGLE_FILE_REQUIRED_MESSAGE = "You must select one file.";

export type CommandId =
  | "open"
  | "openInside"
  | "openOutside"
  | "view"
  | "edit"
  | "rename"
  | "copyTo"
  | "moveTo"
  | "delete"
  | "splitFile"
  | "combineFiles"
  | "properties"
  | "comment"
  | "crc32"
  | "crc64"
  | "xxh64"
  | "md5"
  | "sha1"
  | "sha256"
  | "sha384"
  | "sha512"
  | "sha3256"
  | "blake2sp"
  | "crcAll"
  | "diff"
  | "createFolder"
  | "createFile"
  | "exit"
  | "selectAll"
  | "deselectAll"
  | "invertSelection"
  | "selectMask"
  | "deselectMask"
  | "selectByType"
  | "deselectByType"
  | "largeIcons"
  | "smallIcons"
  | "listView"
  | "detailsView"
  | "sortName"
  | "sortType"
  | "sortDate"
  | "sortSize"
  | "unsorted"
  | "flatView"
  | "twoPanels"
  | "archiveToolbar"
  | "standardToolbar"
  | "largeButtons"
  | "showButtonText"
  | "openRoot"
  | "upOneLevel"
  | "foldersHistory"
  | "refresh"
  | "autoRefresh"
  | "addFavorite"
  | "options"
  | "benchmark"
  | "deleteTempFiles"
  | "helpContents"
  | "about"
  | "add"
  | "extract"
  | "test"
  | "copy"
  | "move"
  | "info";

export type CommandDefinition = {
  id: CommandId;
  label: string;
  labelKey?: MessageKey;
  shortcut?: string;
  tooltip?: string;
  unsupported?: boolean;
  mutation?: boolean;
};

export type MenuItem =
  | { kind: "command"; id: CommandId }
  | { kind: "separator" }
  | { kind: "submenu"; label: string; labelKey?: MessageKey; items: MenuItem[] };

export type MenuGroup = {
  label: "File" | "Edit" | "View" | "Favorites" | "Tools" | "Help";
  items: MenuItem[];
};

export const COMMAND_DEFINITIONS: Record<CommandId, CommandDefinition> = {
  open: { id: "open", label: "Open...", labelKey: "command.open", shortcut: "Ctrl+O", tooltip: "Open archive (Ctrl+O)" },
  openInside: { id: "openInside", label: "Open Inside", labelKey: "command.openInside", shortcut: "Ctrl+PageDown" },
  openOutside: { id: "openOutside", label: "Open Outside", labelKey: "command.openOutside", shortcut: "Shift+Enter" },
  view: { id: "view", label: "View", labelKey: "command.view", shortcut: "F3", tooltip: "View (F3)" },
  edit: { id: "edit", label: "Edit", shortcut: "F4", unsupported: true, mutation: true },
  rename: { id: "rename", label: "Rename", shortcut: "F2", unsupported: true, mutation: true },
  copyTo: { id: "copyTo", label: "Copy To...", shortcut: "F5", tooltip: "Copy To... (F5)" },
  moveTo: { id: "moveTo", label: "Move To...", shortcut: "F6", unsupported: true, mutation: true },
  delete: { id: "delete", label: "Delete", shortcut: "Delete", unsupported: true, mutation: true },
  splitFile: { id: "splitFile", label: "Split file...", unsupported: true },
  combineFiles: { id: "combineFiles", label: "Combine files...", unsupported: true },
  properties: { id: "properties", label: "Properties", labelKey: "command.properties", shortcut: "Alt+Enter", tooltip: "Properties (Alt+Enter)" },
  comment: { id: "comment", label: "Comment...", shortcut: "Ctrl+Z", unsupported: true, mutation: true },
  crc32: { id: "crc32", label: "CRC-32", unsupported: true },
  crc64: { id: "crc64", label: "CRC-64", unsupported: true },
  xxh64: { id: "xxh64", label: "XXH64", unsupported: true },
  md5: { id: "md5", label: "MD5", unsupported: true },
  sha1: { id: "sha1", label: "SHA-1", unsupported: true },
  sha256: { id: "sha256", label: "SHA-256", unsupported: true },
  sha384: { id: "sha384", label: "SHA-384", unsupported: true },
  sha512: { id: "sha512", label: "SHA-512", unsupported: true },
  sha3256: { id: "sha3256", label: "SHA3-256", unsupported: true },
  blake2sp: { id: "blake2sp", label: "BLAKE2sp", unsupported: true },
  crcAll: { id: "crcAll", label: "All", unsupported: true },
  diff: { id: "diff", label: "Diff", unsupported: true },
  createFolder: { id: "createFolder", label: "Create Folder", shortcut: "F7", unsupported: true, mutation: true },
  createFile: { id: "createFile", label: "Create File", labelKey: "command.createFile", shortcut: "Ctrl+N", tooltip: "Create archive (Ctrl+N)" },
  exit: { id: "exit", label: "Exit", labelKey: "command.exit", shortcut: "Alt+F4" },
  selectAll: { id: "selectAll", label: "Select All", labelKey: "command.selectAll", shortcut: "Ctrl+A" },
  deselectAll: { id: "deselectAll", label: "Deselect All", labelKey: "command.deselectAll", shortcut: "Shift+Numpad Minus" },
  invertSelection: { id: "invertSelection", label: "Invert Selection", labelKey: "command.invertSelection", shortcut: "Numpad Star" },
  selectMask: { id: "selectMask", label: "Select...", shortcut: "Numpad Plus", unsupported: true },
  deselectMask: { id: "deselectMask", label: "Deselect...", shortcut: "Numpad Minus", unsupported: true },
  selectByType: { id: "selectByType", label: "Select by Type", labelKey: "command.selectByType", shortcut: "Alt+Numpad Plus" },
  deselectByType: { id: "deselectByType", label: "Deselect by Type", labelKey: "command.deselectByType", shortcut: "Alt+Numpad Minus" },
  largeIcons: { id: "largeIcons", label: "Large Icons", shortcut: "Ctrl+1", unsupported: true },
  smallIcons: { id: "smallIcons", label: "Small Icons", shortcut: "Ctrl+2", unsupported: true },
  listView: { id: "listView", label: "List", shortcut: "Ctrl+3", unsupported: true },
  detailsView: { id: "detailsView", label: "Details", shortcut: "Ctrl+4" },
  sortName: { id: "sortName", label: "Name", labelKey: "command.sortName", shortcut: "Ctrl+F3" },
  sortType: { id: "sortType", label: "Type", labelKey: "command.sortType", shortcut: "Ctrl+F4" },
  sortDate: { id: "sortDate", label: "Date", labelKey: "command.sortDate", shortcut: "Ctrl+F5" },
  sortSize: { id: "sortSize", label: "Size", labelKey: "command.sortSize", shortcut: "Ctrl+F6" },
  unsorted: { id: "unsorted", label: "Unsorted", shortcut: "Ctrl+F7", unsupported: true },
  flatView: { id: "flatView", label: "Flat View", labelKey: "command.flatView" },
  twoPanels: { id: "twoPanels", label: "2 Panels", shortcut: "F9", unsupported: true },
  archiveToolbar: { id: "archiveToolbar", label: "Archive Toolbar", labelKey: "command.archiveToolbar" },
  standardToolbar: { id: "standardToolbar", label: "Standard Toolbar" },
  largeButtons: { id: "largeButtons", label: "Large Buttons", labelKey: "command.largeButtons" },
  showButtonText: { id: "showButtonText", label: "Show Buttons Text", labelKey: "command.showButtonText" },
  openRoot: { id: "openRoot", label: "Open Root Folder", shortcut: "\\" },
  upOneLevel: { id: "upOneLevel", label: "Up One Level", labelKey: "commands.upOneLevel", shortcut: "Backspace" },
  foldersHistory: { id: "foldersHistory", label: "Folders History...", shortcut: "Alt+F12", unsupported: true },
  refresh: { id: "refresh", label: "Refresh", labelKey: "common.refresh", shortcut: "Ctrl+R", tooltip: "Refresh (Ctrl+R)" },
  autoRefresh: { id: "autoRefresh", label: "Auto Refresh", unsupported: true },
  addFavorite: { id: "addFavorite", label: "Add folder to Favorites as", unsupported: true },
  options: { id: "options", label: "Options...", labelKey: "command.options" },
  benchmark: { id: "benchmark", label: "Benchmark", unsupported: true },
  deleteTempFiles: { id: "deleteTempFiles", label: "Delete Temporary Files...", labelKey: "command.deleteTempFiles" },
  helpContents: { id: "helpContents", label: "Contents...", labelKey: "command.helpContents", shortcut: "F1", unsupported: true },
  about: { id: "about", label: "About ZManager...", labelKey: "command.about" },
  add: { id: "add", label: "Add", labelKey: "command.add", shortcut: "Ctrl+N", tooltip: "Add (Ctrl+N)" },
  extract: { id: "extract", label: "Extract", labelKey: "command.extract", shortcut: "F5", tooltip: "Extract (F5)" },
  test: { id: "test", label: "Test", labelKey: "command.test", tooltip: "Test archive" },
  copy: { id: "copy", label: "Copy", labelKey: "command.copy", shortcut: "F5", tooltip: "Copy (F5)" },
  move: { id: "move", label: "Move", shortcut: "F6", unsupported: true, mutation: true },
  info: { id: "info", label: "Info", labelKey: "command.info", shortcut: "Alt+Enter", tooltip: "Info (Alt+Enter)" },
};

export const CLASSIC_MENU_GROUPS: MenuGroup[] = [
  {
    label: "File",
    items: [
      { kind: "command", id: "open" },
      { kind: "command", id: "openInside" },
      { kind: "command", id: "openOutside" },
      { kind: "command", id: "view" },
      { kind: "separator" },
      { kind: "command", id: "properties" },
      { kind: "separator" },
      { kind: "command", id: "createFile" },
      { kind: "separator" },
      { kind: "command", id: "exit" },
    ],
  },
  {
    label: "Edit",
    items: [
      { kind: "command", id: "selectAll" },
      { kind: "command", id: "deselectAll" },
      { kind: "command", id: "invertSelection" },
      { kind: "command", id: "selectByType" },
      { kind: "command", id: "deselectByType" },
    ],
  },
  {
    label: "View",
    items: [
      { kind: "command", id: "sortName" },
      { kind: "command", id: "sortType" },
      { kind: "command", id: "sortDate" },
      { kind: "command", id: "sortSize" },
      { kind: "separator" },
      { kind: "command", id: "flatView" },
      { kind: "separator" },
      {
        kind: "submenu",
        label: "Toolbars",
        labelKey: "commandMenu.toolbars",
        items: [
          { kind: "command", id: "archiveToolbar" },
          { kind: "command", id: "largeButtons" },
          { kind: "command", id: "showButtonText" },
        ],
      },
    ],
  },
  {
    label: "Tools",
    items: [
      { kind: "command", id: "options" },
      { kind: "separator" },
      { kind: "command", id: "deleteTempFiles" },
    ],
  },
  {
    label: "Help",
    items: [
      { kind: "command", id: "about" },
    ],
  },
];

export const CLASSIC_TOOLBAR_GROUPS: CommandId[][] = [
  ["add", "extract", "test"],
  ["info"],
];

export const CLASSIC_TOOLBAR_ORDER: CommandId[] = CLASSIC_TOOLBAR_GROUPS.flat();

export type CommandContext = {
  browseState: BrowseState;
  hasArchive: boolean;
  focusedRow: boolean;
  canNavigateUp?: boolean;
  canOpenInside?: boolean;
  selectedCount: number;
  visibleSelectableCount: number;
  mutableOperationsSupported: boolean;
  jobRunning: boolean;
};

export type CommandState = {
  enabled: boolean;
  reason?: string;
};

export type CommandStateMap = Record<CommandId, CommandState>;

export function commandTooltip(id: CommandId): string {
  const command = COMMAND_DEFINITIONS[id];
  return command.tooltip ?? (command.shortcut ? `${command.label} (${command.shortcut})` : command.label);
}

export function commandLabel(id: CommandId, i18n?: Translator): string {
  const command = COMMAND_DEFINITIONS[id];
  return command.labelKey && i18n ? i18n.t(command.labelKey) : command.label;
}

export function commandTooltipText(id: CommandId, i18n?: Translator): string {
  const command = COMMAND_DEFINITIONS[id];
  const label = commandLabel(id, i18n);
  return command.shortcut ? `${label} (${command.shortcut})` : label;
}

export function menuGroupLabel(label: MenuGroup["label"], i18n?: Translator): string {
  if (!i18n) {
    return label;
  }

  switch (label) {
    case "File":
      return i18n.t("commandMenu.file");
    case "Edit":
      return i18n.t("commandMenu.edit");
    case "View":
      return i18n.t("commandMenu.view");
    case "Favorites":
      return "Favorites";
    case "Tools":
      return i18n.t("commandMenu.tools");
    case "Help":
      return i18n.t("commandMenu.help");
  }
}

export function selectCommandState(context: CommandContext): CommandStateMap {
  const canUseArchive =
    context.hasArchive &&
    context.browseState !== "loading" &&
    (context.browseState === "loaded" || context.browseState === "empty");
  const canListEntries = canUseArchive && context.browseState === "loaded";
  const hasSelection = context.selectedCount > 0;
  const hasOneSelection = context.selectedCount === 1;
  const hasFocusedOrSelected = context.focusedRow || hasSelection;
  const canNavigateUp = Boolean(context.canNavigateUp);
  const canOpenInside = Boolean(context.canOpenInside);
  const mutationsEnabled = context.mutableOperationsSupported && !context.jobRunning;

  const state = Object.fromEntries(
    (Object.keys(COMMAND_DEFINITIONS) as CommandId[]).map((id) => [id, { enabled: false }]),
  ) as CommandStateMap;

  const enable = (ids: CommandId[], enabled = true, reason?: string) => {
    for (const id of ids) {
      state[id] = { enabled, reason };
    }
  };

  enable(["open", "createFile", "add", "options", "helpContents", "about", "archiveToolbar", "standardToolbar", "largeButtons", "showButtonText", "exit"]);
  enable(["extract", "copyTo", "test", "properties", "info", "refresh", "flatView"], canUseArchive);
  enable(["copy"], hasSelection && canListEntries);
  enable(["view", "openOutside"], hasOneSelection && canListEntries);
  enable(["openInside"], canOpenInside && canListEntries);
  enable(["selectAll"], canListEntries && context.visibleSelectableCount > 0);
  enable(["deselectAll"], hasSelection);
  enable(["invertSelection"], canListEntries && context.visibleSelectableCount > 0);
  enable(["selectByType", "deselectByType"], hasFocusedOrSelected && canListEntries);
  enable(["detailsView", "sortName", "sortType", "sortDate", "sortSize"], canListEntries);
  enable(["openRoot"], canUseArchive);
  enable(["upOneLevel"], canUseArchive && canNavigateUp);
  enable(["deleteTempFiles"], true);

  const mutationIds: CommandId[] = ["edit", "rename", "moveTo", "delete", "comment", "createFolder", "move"];
  enable(mutationIds, mutationsEnabled && hasSelection);

  for (const id of Object.keys(COMMAND_DEFINITIONS) as CommandId[]) {
    if (COMMAND_DEFINITIONS[id].unsupported) {
      state[id] = { enabled: false, reason: UNSUPPORTED_OPERATION_MESSAGE };
    }
  }

  return state;
}
