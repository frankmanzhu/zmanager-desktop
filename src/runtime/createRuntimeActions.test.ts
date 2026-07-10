import { describe, expect, it, vi } from "vitest";

import {
  createCreateRuntimeActions,
  type CreateRuntimeActionEffects,
} from "./createRuntimeActions";

describe("create runtime actions", () => {
  it("routes source and destination intents to create effects", () => {
    const effects = createEffects();
    const actions = createCreateRuntimeActions(effects);

    actions.handleIntent({ type: "showAddSourcesMenu", x: 10, y: 20 });
    actions.handleIntent({ type: "removeSources", sourcePaths: ["a", "b"] });
    actions.handleIntent({ type: "setDestinationPath", destinationPath: "out.zip" });

    expect(effects.showAddSourcesMenu).toHaveBeenCalledWith(10, 20);
    expect(effects.removeSources).toHaveBeenCalledWith(["a", "b"]);
    expect(effects.setDestinationPath).toHaveBeenCalledWith("out.zip");
  });

  it("routes selection and inclusion intents without mutating payloads", () => {
    const effects = createEffects();
    const actions = createCreateRuntimeActions(effects);
    const selectedPaths = Object.freeze(["a.txt"]);

    actions.handleIntent({
      type: "applySelection",
      selectedPaths,
      focusedPath: "a.txt",
      anchorPath: "a.txt",
    });
    actions.handleIntent({ type: "setPathIncluded", path: "a.txt", included: false });

    expect(effects.applySelection).toHaveBeenCalledWith({
      type: "applySelection",
      selectedPaths,
      focusedPath: "a.txt",
      anchorPath: "a.txt",
    });
    expect(effects.setPathIncluded).toHaveBeenCalledWith("a.txt", false);
  });

  it("fire-and-forgets create submission with password inputs", () => {
    const effects = createEffects();
    const actions = createCreateRuntimeActions(effects);

    actions.handleIntent({ type: "runCreate", password: "one", passwordConfirm: "two" });

    expect(effects.runCreate).toHaveBeenCalledWith("one", "two");
  });
});

function createEffects(
  overrides: Partial<CreateRuntimeActionEffects> = {},
): CreateRuntimeActionEffects {
  return {
    showWorkspace: vi.fn(),
    showAddSourcesMenu: vi.fn(),
    clearSources: vi.fn(),
    removeSources: vi.fn(),
    showSourceContextMenu: vi.fn(),
    setDestinationPath: vi.fn(),
    browseDestination: vi.fn(),
    changeFormat: vi.fn(),
    setOptions: vi.fn(),
    navigateToFolder: vi.fn(),
    setSearchQuery: vi.fn(),
    clearSearch: vi.fn(),
    toggleTreeFolder: vi.fn(),
    setPathIncluded: vi.fn(),
    setAllIncluded: vi.fn(),
    setCurrentFolderIncluded: vi.fn(),
    selectRow: vi.fn(),
    applySelection: vi.fn(),
    toggleRowSelection: vi.fn(),
    focusRow: vi.fn(),
    removeSelectedSources: vi.fn(),
    showCompressRowContextMenu: vi.fn(),
    runCreate: vi.fn(),
    ...overrides,
  };
}
