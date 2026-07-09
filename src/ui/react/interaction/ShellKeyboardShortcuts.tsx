import { useEffect } from "react";

import { selectKeyboardCommand } from "../../../app/commands/commandRouter";
import type { CommandRouterPayload } from "../../../app/commands/commandRouter";
import type { CommandId } from "../../../app/classicCommands";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";

export type ShellKeyboardEventLike = Readonly<{
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  editableTarget?: boolean;
}>;

export type ShellKeyboardDecision =
  | Readonly<{ type: "ignore" }>
  | Readonly<{ type: "escape" }>
  | Readonly<{ type: "focusSearch" }>
  | Readonly<{ type: "command"; commandId: CommandId; payload?: CommandRouterPayload }>;

export function decodeShellKeyboardShortcut(
  snapshot: ZManagerReactSnapshot,
  event: ShellKeyboardEventLike,
): ShellKeyboardDecision {
  if (event.key === "Escape") {
    return { type: "escape" };
  }

  if (snapshot.dialog.kind !== "none" || snapshot.preferencesDraft || event.editableTarget) {
    return { type: "ignore" };
  }

  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    return { type: "focusSearch" };
  }

  const selectedCount = event.key === "F5"
    ? snapshot.archive.view.selection.selectedPaths.length
    : snapshot.archive.view.selection.selectedEntryPaths.length;
  const command = selectKeyboardCommand({
    key: event.key,
    ctrlKey: Boolean(event.ctrlKey),
    altKey: Boolean(event.altKey),
    selectedCount,
  });

  return command ? { type: "command", ...command } : { type: "ignore" };
}

export function ShellKeyboardShortcuts() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("#app") ?? document;
    const onKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      const decision = decodeShellKeyboardShortcut(snapshot, {
        key: event.key,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        editableTarget: isEditableTarget(event.target),
      });

      switch (decision.type) {
        case "escape":
          event.preventDefault();
          actions.handleKeyboardIntent({ type: "escape" });
          break;
        case "focusSearch":
          event.preventDefault();
          if (snapshot.archive.command.canSearchEntries && focusArchiveSearchInput()) {
            break;
          }
          actions.handleKeyboardIntent({ type: "focusSearch" });
          break;
        case "command":
          event.preventDefault();
          actions.executeCommand(decision.commandId, decision.payload);
          break;
        case "ignore":
          break;
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [actions, snapshot]);

  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function focusArchiveSearchInput(): boolean {
  const searchInput = document.querySelector<HTMLInputElement>("#search-entries");
  if (!searchInput) {
    return false;
  }

  searchInput.focus();
  searchInput.select();
  return true;
}
