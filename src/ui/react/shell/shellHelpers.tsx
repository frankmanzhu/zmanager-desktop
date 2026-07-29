import {
  Archive,
  Check,
  CheckSquare,
  Copy,
  Download,
  Eye,
  FolderOpen,
  HelpCircle,
  Info,
  List,
  MoveRight,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  COMMAND_DEFINITIONS,
  commandLabel,
  commandTooltipText,
  menuGroupLabel,
  type CommandId,
  type CommandStateMap,
  type MenuGroup,
} from "../../../app/classicCommands";
import {
  createTranslator,
  type Translator,
} from "../../../app/i18n/translator";
import type { ZManagerReactSnapshot } from "../appRuntime";

export function translatorForSnapshot(
  snapshot: ZManagerReactSnapshot,
): Translator {
  return createTranslator(snapshot.display.resolvedLocale);
}

export function localizedCommandLabel(
  commandId: CommandId,
  snapshot: ZManagerReactSnapshot,
): string {
  return commandLabel(commandId, translatorForSnapshot(snapshot));
}

export function localizedCommandTooltip(
  commandId: CommandId,
  snapshot: ZManagerReactSnapshot,
): string {
  return commandTooltipText(commandId, translatorForSnapshot(snapshot));
}

export function localizedMenuGroupLabel(
  label: MenuGroup["label"],
  snapshot: ZManagerReactSnapshot,
): string {
  return menuGroupLabel(label, translatorForSnapshot(snapshot));
}

export function commandButtonId(commandId: CommandId): string {
  switch (commandId) {
    case "add":
      return "add-archive";
    case "extract":
      return "extract-toolbar";
    case "test":
      return "test-archive";
    case "copy":
      return "copy-toolbar";
    case "move":
      return "move-toolbar";
    case "delete":
      return "delete-toolbar";
    case "info":
      return "info-toolbar";
    case "open":
      return "open-archive";
    case "closeArchive":
      return "close-archive";
    case "options":
      return "preferences-toolbar";
    default:
      return `toolbar-${commandId}`;
  }
}

export function commandStateFor(
  commandState: CommandStateMap,
  commandId: CommandId,
): { enabled: boolean; reason?: string } {
  return commandState[commandId] ?? { enabled: false };
}

export function commandShortcut(commandId: CommandId): string | undefined {
  return COMMAND_DEFINITIONS[commandId].shortcut?.replace("Ctrl", "Control");
}

export function commandIcon(commandId: CommandId): LucideIcon {
  switch (commandId) {
    case "add":
      return Plus;
    case "open":
      return FolderOpen;
    case "closeArchive":
      return X;
    case "extract":
    case "copyTo":
      return Download;
    case "test":
      return Check;
    case "view":
      return Eye;
    case "copy":
      return Copy;
    case "move":
    case "moveTo":
      return MoveRight;
    case "delete":
      return Trash2;
    case "info":
    case "properties":
      return Info;
    case "options":
    case "deleteTempFiles":
      return Settings;
    case "refresh":
      return RefreshCw;
    case "selectAll":
      return CheckSquare;
    case "flatView":
      return List;
    case "helpContents":
    case "about":
      return HelpCircle;
    default:
      return Archive;
  }
}

export function menuGroupAccessKey(label: MenuGroup["label"]): string {
  switch (label) {
    case "File":
      return "f";
    case "Edit":
      return "e";
    case "View":
      return "v";
    case "Favorites":
      return "a";
    case "Tools":
      return "t";
    case "Help":
      return "h";
  }
}
