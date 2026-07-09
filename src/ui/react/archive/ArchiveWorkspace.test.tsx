import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createArchiveWorkspace } from "../../../app/workspaces/archiveWorkspace";
import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactSnapshot,
} from "../appRuntime";
import { ArchiveWorkspace } from "./ArchiveWorkspace";

describe("React archive workspace", () => {
  it("renders archive path, search, tree, table, and details from an archive snapshot", () => {
    const snapshot = archiveSnapshot();
    const html = renderArchiveWorkspace(snapshot);

    expect(html).toContain('class="path-bar"');
    expect(html).toContain('id="path-field"');
    expect(html).toContain("demo.zip");
    expect(html).toContain('id="search-entries"');
    expect(html).toContain('id="tree-content"');
    expect(html).toContain('data-tree-path="docs"');
    expect(html).toContain('id="entry-table"');
    expect(html).toContain('data-entry-path="docs/readme.txt"');
    expect(html).toContain('data-column-id="name"');
    expect(html).toContain('id="details-content"');
    expect(html).toContain("C:/archives/demo.zip");
  });

  it("renders the no-archive empty action without legacy DOM ownership", () => {
    const html = renderArchiveWorkspace(createInitialZManagerReactSnapshot());

    expect(html).toContain('id="archive-empty-state"');
    expect(html).toContain('data-empty-action="open-archive"');
    expect(html).toContain('data-details-action="open-archive"');
    expect(html).toContain("Open Archive");
  });
});

function renderArchiveWorkspace(snapshot: ZManagerReactSnapshot): string {
  const store = createZManagerAppStore(snapshot, noopZManagerReactActions);
  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(ArchiveWorkspace),
    ),
  );
}

function archiveSnapshot(): ZManagerReactSnapshot {
  const initial = createInitialZManagerReactSnapshot();
  const archiveWorkspace = createArchiveWorkspace({
    flatView: false,
    showParentFolderItem: true,
  });
  archiveWorkspace.loadSucceeded({
    archivePath: "C:/archives/demo.zip",
    entries: [
      {
        path: "docs/readme.txt",
        kind: "file",
        size: 1234,
        compressedSize: 456,
        modified: "1781085660",
      },
      {
        path: "docs",
        kind: "directory",
        size: 0,
        compressedSize: 0,
        modified: "1781085600",
      },
    ],
    entryCount: 2,
    totalSize: 1234,
  });
  const archive = archiveWorkspace.navigateToFolder("docs");

  return createZManagerReactSnapshot({
    shell: {
      ...initial.shell,
      activeMode: "extract",
    },
    archive,
    create: initial.create,
    jobs: initial.jobs,
    quickActionProgress: initial.quickActionProgress,
    preferences: initial.preferences,
    preferencesDraft: initial.preferencesDraft,
    pathHistory: initial.pathHistory,
    display: initial.display,
    commands: initial.commands,
  });
}
