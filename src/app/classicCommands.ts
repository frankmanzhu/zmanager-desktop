import type { BrowseState } from "../api/types";

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
  shortcut?: string;
  tooltip?: string;
  unsupported?: boolean;
  mutation?: boolean;
};

export type MenuItem =
  | { kind: "command"; id: CommandId }
  | { kind: "separator" }
  | { kind: "submenu"; label: string; items: MenuItem[] };

export type MenuGroup = {
  label: "File" | "Edit" | "View" | "Favorites" | "Tools" | "Help";
  items: MenuItem[];
};

export const COMMAND_DEFINITIONS: Record<CommandId, CommandDefinition> = {
  open: { id: "open", label: "Open...", shortcut: "Ctrl+O", tooltip: "Open archive (Ctrl+O)" },
  openInside: { id: "openInside", label: "Open Inside", shortcut: "Ctrl+PageDown", unsupported: true },
  openOutside: { id: "openOutside", label: "Open Outside", shortcut: "Shift+Enter" },
  view: { id: "view", label: "View", shortcut: "F3", tooltip: "View (F3)" },
  edit: { id: "edit", label: "Edit", shortcut: "F4", unsupported: true, mutation: true },
  rename: { id: "rename", label: "Rename", shortcut: "F2", unsupported: true, mutation: true },
  copyTo: { id: "copyTo", label: "Copy To...", shortcut: "F5", tooltip: "Copy To... (F5)" },
  moveTo: { id: "moveTo", label: "Move To...", shortcut: "F6", unsupported: true, mutation: true },
  delete: { id: "delete", label: "Delete", shortcut: "Delete", unsupported: true, mutation: true },
  splitFile: { id: "splitFile", label: "Split file...", unsupported: true },
  combineFiles: { id: "combineFiles", label: "Combine files...", unsupported: true },
  properties: { id: "properties", label: "Properties", shortcut: "Alt+Enter", tooltip: "Properties (Alt+Enter)" },
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
  createFile: { id: "createFile", label: "Create File", shortcut: "Ctrl+N", tooltip: "Create archive (Ctrl+N)" },
  exit: { id: "exit", label: "Exit", shortcut: "Alt+F4" },
  selectAll: { id: "selectAll", label: "Select All", shortcut: "Ctrl+A" },
  deselectAll: { id: "deselectAll", label: "Deselect All", shortcut: "Shift+Numpad Minus" },
  invertSelection: { id: "invertSelection", label: "Invert Selection", shortcut: "Numpad Star" },
  selectMask: { id: "selectMask", label: "Select...", shortcut: "Numpad Plus", unsupported: true },
  deselectMask: { id: "deselectMask", label: "Deselect...", shortcut: "Numpad Minus", unsupported: true },
  selectByType: { id: "selectByType", label: "Select by Type", shortcut: "Alt+Numpad Plus" },
  deselectByType: { id: "deselectByType", label: "Deselect by Type", shortcut: "Alt+Numpad Minus" },
  largeIcons: { id: "largeIcons", label: "Large Icons", shortcut: "Ctrl+1", unsupported: true },
  smallIcons: { id: "smallIcons", label: "Small Icons", shortcut: "Ctrl+2", unsupported: true },
  listView: { id: "listView", label: "List", shortcut: "Ctrl+3", unsupported: true },
  detailsView: { id: "detailsView", label: "Details", shortcut: "Ctrl+4" },
  sortName: { id: "sortName", label: "Name", shortcut: "Ctrl+F3" },
  sortType: { id: "sortType", label: "Type", shortcut: "Ctrl+F4" },
  sortDate: { id: "sortDate", label: "Date", shortcut: "Ctrl+F5" },
  sortSize: { id: "sortSize", label: "Size", shortcut: "Ctrl+F6" },
  unsorted: { id: "unsorted", label: "Unsorted", shortcut: "Ctrl+F7", unsupported: true },
  flatView: { id: "flatView", label: "Flat View" },
  twoPanels: { id: "twoPanels", label: "2 Panels", shortcut: "F9", unsupported: true },
  archiveToolbar: { id: "archiveToolbar", label: "Archive Toolbar" },
  standardToolbar: { id: "standardToolbar", label: "Standard Toolbar" },
  largeButtons: { id: "largeButtons", label: "Large Buttons" },
  showButtonText: { id: "showButtonText", label: "Show Buttons Text" },
  openRoot: { id: "openRoot", label: "Open Root Folder", shortcut: "\\" },
  upOneLevel: { id: "upOneLevel", label: "Up One Level", shortcut: "Backspace" },
  foldersHistory: { id: "foldersHistory", label: "Folders History...", shortcut: "Alt+F12", unsupported: true },
  refresh: { id: "refresh", label: "Refresh", shortcut: "Ctrl+R", tooltip: "Refresh (Ctrl+R)" },
  autoRefresh: { id: "autoRefresh", label: "Auto Refresh", unsupported: true },
  addFavorite: { id: "addFavorite", label: "Add folder to Favorites as", unsupported: true },
  options: { id: "options", label: "Options..." },
  benchmark: { id: "benchmark", label: "Benchmark", unsupported: true },
  deleteTempFiles: { id: "deleteTempFiles", label: "Delete Temporary Files..." },
  helpContents: { id: "helpContents", label: "Contents...", shortcut: "F1", unsupported: true },
  about: { id: "about", label: "About ZManager..." },
  add: { id: "add", label: "Add", shortcut: "Ctrl+N", tooltip: "Add (Ctrl+N)" },
  extract: { id: "extract", label: "Extract", shortcut: "F5", tooltip: "Extract (F5)" },
  test: { id: "test", label: "Test", tooltip: "Test archive" },
  copy: { id: "copy", label: "Copy", shortcut: "F5", tooltip: "Copy (F5)" },
  move: { id: "move", label: "Move", shortcut: "F6", unsupported: true, mutation: true },
  info: { id: "info", label: "Info", shortcut: "Alt+Enter", tooltip: "Info (Alt+Enter)" },
};

const CRC_MENU: MenuItem[] = [
  { kind: "command", id: "crc32" },
  { kind: "command", id: "crc64" },
  { kind: "command", id: "xxh64" },
  { kind: "command", id: "md5" },
  { kind: "command", id: "sha1" },
  { kind: "command", id: "sha256" },
  { kind: "command", id: "sha384" },
  { kind: "command", id: "sha512" },
  { kind: "command", id: "sha3256" },
  { kind: "command", id: "blake2sp" },
  { kind: "command", id: "crcAll" },
];

export const CLASSIC_MENU_GROUPS: MenuGroup[] = [
  {
    label: "File",
    items: [
      { kind: "command", id: "open" },
      { kind: "command", id: "openInside" },
      { kind: "command", id: "openOutside" },
      { kind: "command", id: "view" },
      { kind: "command", id: "edit" },
      { kind: "separator" },
      { kind: "command", id: "rename" },
      { kind: "command", id: "copyTo" },
      { kind: "command", id: "moveTo" },
      { kind: "command", id: "delete" },
      { kind: "separator" },
      { kind: "command", id: "splitFile" },
      { kind: "command", id: "combineFiles" },
      { kind: "separator" },
      { kind: "command", id: "properties" },
      { kind: "command", id: "comment" },
      { kind: "submenu", label: "CRC", items: CRC_MENU },
      { kind: "command", id: "diff" },
      { kind: "separator" },
      { kind: "command", id: "createFolder" },
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
      { kind: "command", id: "selectMask" },
      { kind: "command", id: "deselectMask" },
      { kind: "command", id: "selectByType" },
      { kind: "command", id: "deselectByType" },
    ],
  },
  {
    label: "View",
    items: [
      { kind: "command", id: "largeIcons" },
      { kind: "command", id: "smallIcons" },
      { kind: "command", id: "listView" },
      { kind: "command", id: "detailsView" },
      { kind: "separator" },
      { kind: "command", id: "sortName" },
      { kind: "command", id: "sortType" },
      { kind: "command", id: "sortDate" },
      { kind: "command", id: "sortSize" },
      { kind: "command", id: "unsorted" },
      { kind: "separator" },
      { kind: "command", id: "flatView" },
      { kind: "command", id: "twoPanels" },
      { kind: "separator" },
      {
        kind: "submenu",
        label: "Toolbars",
        items: [
          { kind: "command", id: "archiveToolbar" },
          { kind: "command", id: "standardToolbar" },
          { kind: "command", id: "largeButtons" },
          { kind: "command", id: "showButtonText" },
        ],
      },
      { kind: "command", id: "openRoot" },
      { kind: "command", id: "upOneLevel" },
      { kind: "command", id: "foldersHistory" },
      { kind: "command", id: "refresh" },
      { kind: "command", id: "autoRefresh" },
    ],
  },
  {
    label: "Favorites",
    items: [
      { kind: "command", id: "addFavorite" },
      { kind: "separator" },
    ],
  },
  {
    label: "Tools",
    items: [
      { kind: "command", id: "options" },
      { kind: "separator" },
      { kind: "command", id: "benchmark" },
      { kind: "separator" },
      { kind: "command", id: "deleteTempFiles" },
    ],
  },
  {
    label: "Help",
    items: [
      { kind: "command", id: "helpContents" },
      { kind: "separator" },
      { kind: "command", id: "about" },
    ],
  },
];

export const CLASSIC_TOOLBAR_GROUPS: CommandId[][] = [
  ["add", "extract", "test"],
  ["copy", "move", "delete", "info"],
];

export const CLASSIC_TOOLBAR_ORDER: CommandId[] = CLASSIC_TOOLBAR_GROUPS.flat();

export type CommandContext = {
  browseState: BrowseState;
  hasArchive: boolean;
  focusedRow: boolean;
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

export function selectCommandState(context: CommandContext): CommandStateMap {
  const canUseArchive =
    context.hasArchive &&
    context.browseState !== "loading" &&
    (context.browseState === "loaded" || context.browseState === "empty");
  const canListEntries = canUseArchive && context.browseState === "loaded";
  const hasSelection = context.selectedCount > 0;
  const hasOneSelection = context.selectedCount === 1;
  const hasFocusedOrSelected = context.focusedRow || hasSelection;
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
  enable(["openInside"], hasFocusedOrSelected && canListEntries);
  enable(["selectAll"], canListEntries && context.visibleSelectableCount > 0);
  enable(["deselectAll"], hasSelection);
  enable(["invertSelection"], canListEntries && context.visibleSelectableCount > 0);
  enable(["selectByType", "deselectByType"], hasFocusedOrSelected && canListEntries);
  enable(["detailsView", "sortName", "sortType", "sortDate", "sortSize"], canListEntries);
  enable(["openRoot"], canUseArchive);
  enable(["upOneLevel"], canUseArchive && context.focusedRow || canUseArchive);
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
