import { describe, expect, it, vi } from "vitest";

import {
  createArchiveRuntimeActions,
  type ArchiveRuntimeActionEffects,
} from "./archiveRuntimeActions";

describe("archive runtime actions", () => {
  it("routes archive navigation and row activation by row kind", () => {
    const effects = createEffects();
    const actions = createArchiveRuntimeActions(effects);

    actions.handleIntent({ type: "navigateToFolder", folderPath: "docs" });
    actions.handleIntent({ type: "activateRow", rowKind: "folder", path: "docs", x: 0, y: 0 } as never);
    actions.handleIntent({ type: "activateRow", rowKind: "entry", path: "docs/readme.txt" });

    expect(effects.navigateToFolder).toHaveBeenCalledWith("docs");
    expect(effects.navigateToFolder).toHaveBeenCalledWith("docs");
    expect(effects.runEntryDefaultAction).toHaveBeenCalledWith("docs/readme.txt");
  });

  it("blocks selection replacement and native drag while jobs are active", () => {
    const effects = createEffects({ hasActiveJob: () => true });
    const actions = createArchiveRuntimeActions(effects);

    actions.handleIntent({
      type: "applySelection",
      selectedPaths: ["a.txt"],
      focusedPath: "a.txt",
      anchorPath: "a.txt",
    });
    actions.handleIntent({ type: "startNativeDrag", entryPath: "a.txt" });

    expect(effects.applySelection).not.toHaveBeenCalled();
    expect(effects.startNativeDrag).not.toHaveBeenCalled();
  });

  it("routes context menu intents through typed menu callbacks", () => {
    const effects = createEffects();
    const actions = createArchiveRuntimeActions(effects);

    actions.handleIntent({ type: "showEmptyContextMenu", x: 1, y: 2 });
    actions.handleIntent({ type: "showColumnContextMenu", columnId: "name", x: 3, y: 4 });
    actions.handleIntent({ type: "showRowContextMenu", rowKind: "entry", path: "a.txt", x: 5, y: 6 });
    actions.handleIntent({ type: "showRowContextMenu", rowKind: "parent", path: "..", x: 7, y: 8 });

    expect(effects.showEmptyContextMenu).toHaveBeenCalledWith(1, 2);
    expect(effects.showColumnContextMenu).toHaveBeenCalledWith("name", 3, 4);
    expect(effects.showEntryContextMenu).toHaveBeenCalledWith("a.txt", 5, 6);
    expect(effects.showFolderContextMenu).toHaveBeenCalledWith("..", 7, 8);
  });
});

function createEffects(
  overrides: Partial<ArchiveRuntimeActionEffects> = {},
): ArchiveRuntimeActionEffects {
  return {
    navigateToFolder: vi.fn(),
    navigateBack: vi.fn(),
    navigateUp: vi.fn(),
    setSearchQuery: vi.fn(),
    clearSearch: vi.fn(),
    setFlatView: vi.fn(),
    setColumnWidth: vi.fn(),
    toggleTreeFolder: vi.fn(),
    sortByColumn: vi.fn(),
    selectAllVisible: vi.fn(),
    clearSelection: vi.fn(),
    selectRow: vi.fn(),
    setRowSelected: vi.fn(),
    hasActiveJob: vi.fn(() => false),
    applySelection: vi.fn(),
    runEntryDefaultAction: vi.fn(),
    startNativeDrag: vi.fn(),
    copyDetailsValue: vi.fn(),
    showEmptyContextMenu: vi.fn(),
    showColumnContextMenu: vi.fn(),
    showFolderContextMenu: vi.fn(),
    showEntryContextMenu: vi.fn(),
    runDetailsAction: vi.fn(),
    ...overrides,
  };
}
