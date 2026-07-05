import { describe, expect, it } from "vitest";

import {
  CLASSIC_MENU_GROUPS,
  CLASSIC_TOOLBAR_ORDER,
  COMMAND_DEFINITIONS,
  commandLabel,
  commandTooltipText,
  type CommandId,
  type MenuItem,
  UNSUPPORTED_OPERATION_MESSAGE,
  selectCommandState,
} from "./classicCommands";
import { createTranslatorFromCatalog } from "./i18n/translator";
import { zhCnMessages } from "./i18n/messages.zh-CN";

function collectMenuCommandIds(items: readonly MenuItem[]): CommandId[] {
  return items.flatMap((item) => {
    if (item.kind === "command") {
      return [item.id];
    }
    if (item.kind === "submenu") {
      return collectMenuCommandIds(item.items);
    }
    return [];
  });
}

describe("classic command definitions", () => {
  it("keeps the required top-level menu groups visible", () => {
    expect(CLASSIC_MENU_GROUPS.map((group) => group.label)).toEqual([
      "File",
      "Edit",
      "View",
      "Tools",
      "Help",
    ]);
  });

  it("does not expose unsupported commands in the menu bar", () => {
    const visibleMenuCommandIds = CLASSIC_MENU_GROUPS.flatMap((group) => collectMenuCommandIds(group.items));

    for (const id of visibleMenuCommandIds) {
      expect(COMMAND_DEFINITIONS[id].unsupported).not.toBe(true);
    }
  });

  it("keeps redundant navigation commands out of the View menu", () => {
    const viewMenu = CLASSIC_MENU_GROUPS.find((group) => group.label === "View");
    expect(viewMenu).toBeDefined();

    const viewMenuCommandIds = collectMenuCommandIds(viewMenu?.items ?? []);
    expect(viewMenuCommandIds).toEqual([
      "sortName",
      "sortType",
      "sortDate",
      "sortSize",
      "flatView",
      "archiveToolbar",
      "largeButtons",
      "showButtonText",
    ]);
  });

  it("keeps the classic toolbar command order", () => {
    expect(CLASSIC_TOOLBAR_ORDER.map((id) => COMMAND_DEFINITIONS[id].label)).toEqual([
      "Add",
      "Extract",
      "Test",
      "Info",
    ]);
  });

  it("localizes labels and composes tooltips with stable shortcuts", () => {
    const zhCn = createTranslatorFromCatalog("zh-CN", zhCnMessages);

    expect(commandLabel("open", zhCn)).toBe("打开...");
    expect(commandTooltipText("open", zhCn)).toBe("打开... (Ctrl+O)");
    expect(COMMAND_DEFINITIONS.open.shortcut).toBe("Ctrl+O");
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
