import { describe, expect, it } from "vitest";

import {
  CLASSIC_MENU_GROUPS,
  CLASSIC_TOOLBAR_ORDER,
  COMMAND_DEFINITIONS,
  UNSUPPORTED_OPERATION_MESSAGE,
  selectCommandState,
} from "./classicCommands";

describe("classic command definitions", () => {
  it("keeps the required top-level menu groups visible", () => {
    expect(CLASSIC_MENU_GROUPS.map((group) => group.label)).toEqual([
      "File",
      "Edit",
      "View",
      "Favorites",
      "Tools",
      "Help",
    ]);
  });

  it("keeps the classic toolbar command order", () => {
    expect(CLASSIC_TOOLBAR_ORDER.map((id) => COMMAND_DEFINITIONS[id].label)).toEqual([
      "Add",
      "Extract",
      "Test",
      "Copy",
      "Move",
      "Delete",
      "Info",
    ]);
  });
});

describe("command state selector", () => {
  const baseContext = {
    browseState: "idle" as const,
    hasArchive: false,
    focusedRow: false,
    selectedCount: 0,
    visibleSelectableCount: 0,
    mutableOperationsSupported: false,
    jobRunning: false,
  };

  it("enables open and create-style commands before an archive is open", () => {
    const state = selectCommandState(baseContext);

    expect(state.open.enabled).toBe(true);
    expect(state.add.enabled).toBe(true);
    expect(state.extract.enabled).toBe(false);
    expect(state.test.enabled).toBe(false);
    expect(state.info.enabled).toBe(false);
  });

  it("enables archive-level commands after a listing is available", () => {
    const state = selectCommandState({
      ...baseContext,
      browseState: "loaded",
      hasArchive: true,
      visibleSelectableCount: 2,
    });

    expect(state.test.enabled).toBe(true);
    expect(state.info.enabled).toBe(true);
    expect(state.properties.enabled).toBe(true);
    expect(state.selectAll.enabled).toBe(true);
    expect(state.upOneLevel.enabled).toBe(false);
  });

  it("enables row commands for a single selected entry and keeps mutations disabled", () => {
    const state = selectCommandState({
      ...baseContext,
      browseState: "loaded",
      hasArchive: true,
      focusedRow: true,
      selectedCount: 1,
      visibleSelectableCount: 3,
    });

    expect(state.view.enabled).toBe(true);
    expect(state.copy.enabled).toBe(true);
    expect(state.openInside.enabled).toBe(false);
    expect(state.delete.enabled).toBe(false);
    expect(state.rename.enabled).toBe(false);
  });

  it("enables navigation commands only when their target exists", () => {
    const state = selectCommandState({
      ...baseContext,
      browseState: "loaded",
      hasArchive: true,
      focusedRow: true,
      selectedCount: 1,
      visibleSelectableCount: 3,
      canNavigateUp: true,
      canOpenInside: true,
    });

    expect(state.upOneLevel.enabled).toBe(true);
    expect(state.openInside.enabled).toBe(true);
  });

  it("disables unsupported commands with a shared message", () => {
    const state = selectCommandState({
      ...baseContext,
      browseState: "loaded",
      hasArchive: true,
      visibleSelectableCount: 3,
    });

    const unsupportedCommands = Object.entries(COMMAND_DEFINITIONS)
      .filter(([, definition]) => definition.unsupported)
      .map(([id]) => id as keyof typeof COMMAND_DEFINITIONS);

    for (const id of unsupportedCommands) {
      expect(state[id].enabled).toBe(false);
      expect(state[id].reason).toBe(UNSUPPORTED_OPERATION_MESSAGE);
    }
  });
});
