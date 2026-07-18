import { describe, expect, it } from "vitest";

import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
} from "../appRuntime";
import { decodeShellKeyboardShortcut } from "./ShellKeyboardShortcuts";

describe("React shell keyboard shortcut decoder", () => {
  it("maps global command shortcuts to routed command ids", () => {
    const snapshot = createInitialZManagerReactSnapshot();

    expect(
      decodeShellKeyboardShortcut(snapshot, { key: "o", ctrlKey: true }),
    ).toEqual({
      type: "command",
      commandId: "open",
    });
    expect(decodeShellKeyboardShortcut(snapshot, { key: "F5" })).toEqual({
      type: "command",
      commandId: "extract",
      payload: { extractMode: "archive" },
    });
  });

  it("keeps search focus and escape as shell intents", () => {
    const snapshot = createInitialZManagerReactSnapshot();

    expect(
      decodeShellKeyboardShortcut(snapshot, { key: "f", ctrlKey: true }),
    ).toEqual({
      type: "focusSearch",
    });
    expect(
      decodeShellKeyboardShortcut(snapshot, {
        key: "Escape",
        editableTarget: true,
      }),
    ).toEqual({
      type: "escape",
    });
  });

  it("ignores command shortcuts from editable targets and open dialogs", () => {
    const initial = createInitialZManagerReactSnapshot();
    const dialogSnapshot = createZManagerReactSnapshot({
      shell: initial.shell,
      archive: initial.archive,
      create: initial.create,
      jobs: initial.jobs,
      quickActionProgress: initial.quickActionProgress,
      preferences: initial.preferences,
      preferencesDraft: initial.preferencesDraft,
      pathHistory: initial.pathHistory,
      display: initial.display,
      commands: initial.commands,
      dialog: {
        kind: "about",
        title: "About",
        groups: [],
      },
    });

    expect(
      decodeShellKeyboardShortcut(initial, {
        key: "o",
        ctrlKey: true,
        editableTarget: true,
      }),
    ).toEqual({
      type: "ignore",
    });
    expect(
      decodeShellKeyboardShortcut(dialogSnapshot, { key: "o", ctrlKey: true }),
    ).toEqual({
      type: "ignore",
    });
  });
});
