import { listen, type Event } from "@tauri-apps/api/event";

import type { CommandId } from "../app/classicCommands";

export const NATIVE_MENU_COMMAND_EVENT = "zmanager-native-menu-command";

const NATIVE_MENU_COMMANDS = new Set<CommandId>([
  "about",
  "add",
  "closeArchive",
  "extract",
  "helpContents",
  "info",
  "open",
  "options",
  "selectAll",
  "test",
]);

type NativeMenuCommandPayload = Readonly<{ commandId: string }>;

export function listenNativeMenuCommands(
  run: (commandId: CommandId) => void,
): Promise<() => void> {
  return listen<NativeMenuCommandPayload>(NATIVE_MENU_COMMAND_EVENT, ({ payload }) => {
    if (NATIVE_MENU_COMMANDS.has(payload.commandId as CommandId)) {
      run(payload.commandId as CommandId);
    }
  });
}

export type NativeMenuCommandEvent = Event<NativeMenuCommandPayload>;
