import { listen, type Event } from "@tauri-apps/api/event";

import { COMMAND_DEFINITIONS, type CommandId } from "../app/classicCommands";

export const NATIVE_MENU_COMMAND_EVENT = "zmanager-native-menu-command";

type NativeMenuCommandPayload = Readonly<{ commandId: string }>;

export function listenNativeMenuCommands(
  run: (commandId: CommandId) => void,
): Promise<() => void> {
  return listen<NativeMenuCommandPayload>(NATIVE_MENU_COMMAND_EVENT, ({ payload }) => {
    if (Object.prototype.hasOwnProperty.call(COMMAND_DEFINITIONS, payload.commandId)) {
      run(payload.commandId as CommandId);
    }
  });
}

export type NativeMenuCommandEvent = Event<NativeMenuCommandPayload>;
