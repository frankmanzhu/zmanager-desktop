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
import { ContextMenuRoot } from "./ContextMenuRoot";

describe("React context menu root", () => {
  it("renders visible context menu html at the requested point", () => {
    const html = renderContextMenu(contextMenuSnapshot());

    expect(html).toContain('id="context-menu"');
    expect(html).toContain('role="menu"');
    expect(html).toContain("left:24px");
    expect(html).toContain("top:48px");
    expect(html).toContain('data-context-action="open-archive"');
    expect(html).toContain("Open Archive");
  });

  it("keeps hidden context menus empty", () => {
    const html = renderContextMenu(createInitialZManagerReactSnapshot());

    expect(html).toContain('id="context-menu"');
    expect(html).toContain("hidden");
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
    jobs: initial.jobs,
    quickActionProgress: initial.quickActionProgress,
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
      html: '<button type="button" role="menuitem" data-context-action="open-archive"><span class="context-menu-label">Open Archive</span></button>',
    },
  });
}
