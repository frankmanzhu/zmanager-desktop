import { describe, expect, it } from "vitest";

import { CLASSIC_MENU_GROUPS, COMMAND_DEFINITIONS, type CommandId, type CommandStateMap, type MenuItem } from "../classicCommands";
import {
  createCommandRouter,
  selectContextCommand,
  selectDetailsCommand,
  selectKeyboardCommand,
  selectTreeCommand,
  type CommandRouterEffects,
} from "./commandRouter";

function enabledState(overrides: Partial<CommandStateMap> = {}): CommandStateMap {
  return {
    ...Object.fromEntries(
      (Object.keys(COMMAND_DEFINITIONS) as CommandId[]).map((id) => [id, { enabled: true }]),
    ) as CommandStateMap,
    ...overrides,
  };
}

function recordingEffects(log: string[]): CommandRouterEffects {
  const record = (entry: string) => {
    log.push(entry);
  };

  return {
    openArchive: (source, archivePath) => record(`openArchive:${source}:${archivePath ?? ""}`),
    closeArchive: () => record("closeArchive"),
    addSources: (anchor) => record(`addSources:${anchor ? `${anchor.x},${anchor.y}` : ""}`),
    selectAll: () => record("selectAll"),
    deselectAll: () => record("deselectAll"),
    invertSelection: () => record("invertSelection"),
    selectByType: () => record("selectByType"),
    deselectByType: () => record("deselectByType"),
    openRoot: () => record("openRoot"),
    upOneLevel: () => record("upOneLevel"),
    openInside: () => record("openInside"),
    openOutside: () => record("openOutside"),
    extract: (mode, destination) => record(`extract:${mode}:${destination}`),
    test: () => record("test"),
    view: () => record("view"),
    copySelectedPaths: () => record("copySelectedPaths"),
    info: (target) => record(`info:${target}`),
    refresh: () => record("refresh"),
    exit: () => record("exit"),
    detailsView: () => record("detailsView"),
    sort: (key) => record(`sort:${key}`),
    toggleToolbarLabels: () => record("toggleToolbarLabels"),
    options: () => record("options"),
    about: () => record("about"),
    toggleFlatView: () => record("toggleFlatView"),
    deleteTempFiles: () => record("deleteTempFiles"),
    reportDisabled: (commandId, reason) => record(`disabled:${commandId}:${reason ?? ""}`),
    reportUnsupported: (commandId, reason) => record(`unsupported:${commandId}:${reason}`),
  };
}

describe("command router", () => {
  it("executes every command exposed by the application menu", () => {
    const router = createCommandRouter({
      getCommandState: () => enabledState(),
      effects: recordingEffects([]),
    });
    const visibleCommands = CLASSIC_MENU_GROUPS.flatMap((group) => menuCommandIds(group.items));

    expect(visibleCommands.length).toBeGreaterThan(0);
    for (const commandId of visibleCommands) {
      expect(router.run(commandId).status, commandId).toBe("executed");
    }
  });

  it("routes representative menu and toolbar commands to injected effects", () => {
    const log: string[] = [];
    const router = createCommandRouter({
      getCommandState: () => enabledState(),
      effects: recordingEffects(log),
    });

    expect(router.run("open")).toEqual({ commandId: "open", status: "executed" });
    expect(router.run("closeArchive")).toEqual({ commandId: "closeArchive", status: "executed" });
    expect(router.run("add")).toEqual({ commandId: "add", status: "executed" });
    expect(router.run("selectAll")).toEqual({ commandId: "selectAll", status: "executed" });
    expect(router.run("refresh")).toEqual({ commandId: "refresh", status: "executed" });
    expect(router.run("about")).toEqual({ commandId: "about", status: "executed" });

    expect(log).toEqual(["openArchive:dialog:", "closeArchive", "addSources:", "selectAll", "refresh", "about"]);
  });

  it("passes payload for commands whose behavior depends on the surface context", () => {
    const log: string[] = [];
    const router = createCommandRouter({
      getCommandState: () => enabledState(),
      effects: recordingEffects(log),
    });

    router.run("extract", { extractMode: "selection" });
    router.run("extract");
    router.run("extract", { extractMode: "archive", extractDestination: "here" });
    router.run("add", { addSourcesMenuAnchor: { x: 12, y: 24 } });
    router.run("sortDate");

    expect(log).toEqual([
      "extract:selection:dialog",
      "extract:archive:dialog",
      "extract:archive:here",
      "addSources:12,24",
      "sort:modified",
    ]);
  });

  it("normalizes disabled commands before executing effects", () => {
    const log: string[] = [];
    const router = createCommandRouter({
      getCommandState: () => enabledState({
        test: { enabled: false, reason: "Open an archive first." },
      }),
      effects: recordingEffects(log),
    });

    expect(router.run("test")).toEqual({
      commandId: "test",
      status: "disabled",
      reason: "Open an archive first.",
    });
    expect(log).toEqual(["disabled:test:Open an archive first."]);
  });

  it("normalizes unsupported commands through a shared effect", () => {
    const log: string[] = [];
    const router = createCommandRouter({
      getCommandState: () => enabledState(),
      effects: recordingEffects(log),
    });

    expect(router.run("helpContents")).toEqual({
      commandId: "helpContents",
      status: "unsupported",
      reason: "Operation is not supported.",
    });
    expect(router.run("copyTo")).toEqual({
      commandId: "copyTo",
      status: "unsupported",
      reason: "Operation is not supported.",
    });
    expect(log).toEqual([
      "unsupported:helpContents:Operation is not supported.",
      "unsupported:copyTo:Operation is not supported.",
    ]);
  });

  it("passes info target payloads to the info effect", () => {
    const log: string[] = [];
    const router = createCommandRouter({
      getCommandState: () => enabledState(),
      effects: recordingEffects(log),
    });

    router.run("info");
    router.run("properties");
    router.run("info", { infoTarget: "archive" });

    expect(log).toEqual(["info:current", "info:current", "info:archive"]);
  });
});

function menuCommandIds(items: readonly MenuItem[]): CommandId[] {
  return items.flatMap((item) => item.kind === "command"
    ? [item.id]
    : item.kind === "submenu" ? menuCommandIds(item.items) : []);
}

describe("keyboard command selector", () => {
  it("maps global shortcuts to command ids", () => {
    expect(selectKeyboardCommand({ key: "o", ctrlKey: true })).toEqual({ commandId: "open" });
    expect(selectKeyboardCommand({ key: "N", ctrlKey: true })).toEqual({ commandId: "add" });
    expect(selectKeyboardCommand({ key: "a", ctrlKey: true })).toEqual({ commandId: "selectAll" });
    expect(selectKeyboardCommand({ key: "r", ctrlKey: true })).toEqual({ commandId: "refresh" });
    expect(selectKeyboardCommand({ key: "Backspace" })).toEqual({ commandId: "upOneLevel" });
    expect(selectKeyboardCommand({ key: "ArrowUp", altKey: true })).toEqual({ commandId: "upOneLevel" });
    expect(selectKeyboardCommand({ key: "F3" })).toEqual({ commandId: "view" });
  });

  it("passes selection-sensitive payloads for extract and enter preview", () => {
    expect(selectKeyboardCommand({ key: "F5", selectedCount: 2 })).toEqual({
      commandId: "extract",
      payload: { extractMode: "selection" },
    });
    expect(selectKeyboardCommand({ key: "F5", selectedCount: 0 })).toEqual({
      commandId: "extract",
      payload: { extractMode: "archive" },
    });
    expect(selectKeyboardCommand({ key: "Enter", selectedCount: 1 })).toEqual({ commandId: "view" });
    expect(selectKeyboardCommand({ key: "Enter", selectedCount: 0 })).toBeNull();
  });

  it("preserves current enter handling precedence over alt-enter info", () => {
    expect(selectKeyboardCommand({ key: "Enter", altKey: true, selectedCount: 1 })).toEqual({ commandId: "view" });
    expect(selectKeyboardCommand({ key: "Enter", altKey: true, selectedCount: 0 })).toBeNull();
  });
});

describe("details command selector", () => {
  it("maps details-pane actions to command ids and payloads", () => {
    expect(selectDetailsCommand("open-archive")).toEqual({ commandId: "open" });
    expect(selectDetailsCommand("preview")).toEqual({ commandId: "view" });
    expect(selectDetailsCommand("extract-selected")).toEqual({
      commandId: "extract",
      payload: { extractMode: "selection" },
    });
    expect(selectDetailsCommand("test-selected")).toEqual({ commandId: "test" });
    expect(selectDetailsCommand("properties")).toEqual({ commandId: "properties" });
    expect(selectDetailsCommand("archive-info")).toEqual({
      commandId: "info",
      payload: { infoTarget: "archive" },
    });
  });

  it("ignores details actions that are not classic commands", () => {
    expect(selectDetailsCommand("clear-search")).toBeNull();
    expect(selectDetailsCommand(undefined)).toBeNull();
  });
});

describe("context command selector", () => {
  it("maps context actions to command ids and payloads", () => {
    expect(selectContextCommand("open-archive")).toEqual({ commandId: "open" });
    expect(selectContextCommand("paste-archive-path")).toEqual({
      commandId: "open",
      payload: { openSource: "clipboard" },
    });
    expect(selectContextCommand("open-recent-archive", { archivePath: "C:/archives/app.zip" })).toEqual({
      commandId: "open",
      payload: { openSource: "path", archivePath: "C:/archives/app.zip" },
    });
    expect(selectContextCommand("open-entry")).toEqual({ commandId: "view" });
    expect(selectContextCommand("open-outside")).toEqual({ commandId: "openOutside" });
    expect(selectContextCommand("select-by-type")).toEqual({ commandId: "selectByType" });
    expect(selectContextCommand("deselect-by-type")).toEqual({ commandId: "deselectByType" });
    expect(selectContextCommand("extract")).toEqual({
      commandId: "extract",
      payload: { extractMode: "selection" },
    });
    expect(selectContextCommand("extract-here", { extractMode: "selection" })).toEqual({
      commandId: "extract",
      payload: { extractMode: "selection", extractDestination: "here" },
    });
    expect(selectContextCommand("test")).toEqual({ commandId: "test" });
    expect(selectContextCommand("info", { entryPath: "docs/readme.txt" })).toEqual({
      commandId: "info",
      payload: { infoTarget: "context", entryPath: "docs/readme.txt" },
    });
  });

  it("ignores context actions that are not classic commands", () => {
    expect(selectContextCommand("open-recent-archive")).toBeNull();
    expect(selectContextCommand("create-archive")).toBeNull();
    expect(selectContextCommand("open-folder")).toBeNull();
    expect(selectContextCommand("toggle-column")).toBeNull();
    expect(selectContextCommand(undefined)).toBeNull();
  });
});

describe("tree command selector", () => {
  it("maps explicit tree actions to command ids", () => {
    expect(selectTreeCommand("open")).toEqual({ commandId: "open" });
  });

  it("ignores tree actions that are not classic commands", () => {
    expect(selectTreeCommand("create")).toBeNull();
    expect(selectTreeCommand("toggle")).toBeNull();
    expect(selectTreeCommand(undefined)).toBeNull();
  });
});
