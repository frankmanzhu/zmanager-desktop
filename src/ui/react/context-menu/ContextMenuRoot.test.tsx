import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactSnapshot,
} from "../appRuntime";
import { ContextMenuItemList, ContextMenuRoot } from "./ContextMenuRoot";

describe("React context menu root", () => {
  it("renders visible typed context menu items at the requested point", () => {
    const snapshot = contextMenuSnapshot();
    const html = renderToStaticMarkup(
      createElement(ContextMenuItemList, {
        items: snapshot.contextMenu.visible ? snapshot.contextMenu.items : [],
        onIntent: noopZManagerReactActions.handleContextMenuIntent,
      }),
    );

    expect(html).toContain('role="menuitem"');
    expect(html).toContain('role="menuitemcheckbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Open Archive");
    expect(html).toContain("Show Size");
    expect(html).toContain('data-context-action="open-archive"');
    expect(html).toContain('data-context-action="toggle-column"');
    expect(html).toContain('data-column-id="size"');
  });

  it("keeps hidden context menus empty", () => {
    const html = renderContextMenu(createInitialZManagerReactSnapshot());

    expect(html).toBe("");
    expect(html).not.toContain("data-context-action");
  });
});

function renderContextMenu(snapshot: ZManagerReactSnapshot): string {
  const store = createZManagerAppStore(snapshot, noopZManagerReactActions);
  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(ContextMenuRoot),
    ),
  );
}

function contextMenuSnapshot(): ZManagerReactSnapshot {
  const initial = createInitialZManagerReactSnapshot();

  return createZManagerReactSnapshot({
    shell: initial.shell,
    archive: initial.archive,
    create: initial.create,
    preferences: initial.preferences,
    preferencesDraft: initial.preferencesDraft,
    pathHistory: initial.pathHistory,
    display: initial.display,
    commands: initial.commands,
    contextMenu: {
      visible: true,
      id: 1,
      x: 24,
      y: 48,
      items: [
        {
          type: "action",
          label: "Open Archive",
          payload: { action: "open-archive" },
        },
        {
          type: "checkbox",
          label: "Show Size",
          payload: { action: "toggle-column", columnId: "size" },
          checked: true,
        },
      ],
    },
  });
}
