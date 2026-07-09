import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_APP_PREFERENCES } from "../../../app/preferences";
import { createCreateWorkspace, type CreateWorkspaceSnapshot } from "../../../app/workspaces/createWorkspace";
import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactSnapshot,
} from "../appRuntime";
import { CreateWorkspace } from "./CreateWorkspace";

type CreatePlan = NonNullable<CreateWorkspaceSnapshot["plan"]["current"]>;

describe("React create workspace", () => {
  it("renders create sources, plan rows, options, and the top create command", () => {
    const html = renderCreateWorkspace(createSnapshot());

    expect(html).toContain('class="path-bar"');
    expect(html).toContain('class="path-location"');
    expect(html).toContain("File Location");
    expect(html).not.toContain('id="nav-back"');
    expect(html).not.toContain('id="nav-up"');
    expect(html).toContain('id="create-destination"');
    expect(html).toContain('id="add-source"');
    expect(html).toContain('id="start-create"');
    expect(html.match(/id="start-create"/g)).toHaveLength(1);
    expect(html).toContain('data-pane-resizer="navigation"');
    expect(html).toContain('aria-keyshortcuts="ArrowLeft ArrowRight Home End"');
    expect(html).toContain('id="compress-source-body"');
    expect(html).toContain('id="compress-marquee-hit-surface"');
    expect(html).toContain('class="compress-table-shell" tabindex="0"');
    expect(html).toContain('<th class="inclusion-column"><input id="compress-include-all"');
    expect(html).not.toContain('<span class="column-header-label" aria-hidden="true"></span><input id="compress-include-all"');
    expect(html).toContain('data-compress-path="photos-folder"');
    expect(html).toContain('data-compress-source-path="C:/work/photos-folder"');
    expect(html).toContain('id="compress-options-panel"');
    expect(html).toMatch(/<details[^>]*id="compress-options-panel"[^>]*open=""/);
    expect(html).toContain('id="create-format"');
  });

  it("renders password-capable formats without serializing password values", () => {
    const html = renderCreateWorkspace(createSnapshot("sevenZ"));

    expect(html).toContain('value="sevenZ" selected');
    expect(html).toContain('class="advanced-options"');
    expect(html).toContain('id="create-password"');
    expect(html).toContain('id="create-password-confirm"');
    expect(html).toContain('id="create-show-password"');
    expect(html).not.toContain("correct horse");
  });

  it("renders create row selection and focus from the runtime snapshot", () => {
    const html = renderCreateWorkspace(createSnapshot("tarZst", {
      selectedPaths: ["quarterly-report.pdf"],
      focusedPath: "quarterly-report.pdf",
      anchorPath: "quarterly-report.pdf",
    }));

    expect(html).toMatch(/class="is-selected is-focused-row"[^>]*data-compress-path="quarterly-report\.pdf"/);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"');
  });
});

function renderCreateWorkspace(snapshot: ZManagerReactSnapshot): string {
  const store = createZManagerAppStore(snapshot, noopZManagerReactActions);
  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(CreateWorkspace),
    ),
  );
}

function createSnapshot(
  format: "tarZst" | "sevenZ" = "tarZst",
  createSelection?: Readonly<{
    selectedPaths: readonly string[];
    focusedPath: string;
    anchorPath: string;
  }>,
): ZManagerReactSnapshot {
  const initial = createInitialZManagerReactSnapshot();
  const workspace = createCreateWorkspace();
  workspace.addSources([
    "C:/work/photos-folder",
    "C:/work/desktop-archive-source.zip",
    "C:/work/quarterly-report.pdf",
  ]);
  if (format === "sevenZ") {
    workspace.changeFormat("sevenZ", DEFAULT_APP_PREFERENCES.createFormatDefaults.sevenZ);
  }
  workspace.setDestinationPath(format === "sevenZ" ? "C:/work/bundle.7z" : "C:/work/bundle.tzst");
  const started = workspace.beginPlan();
  expect(started.ready).toBe(true);
  if (!started.ready) {
    throw new Error("Expected create plan to be ready");
  }
  workspace.acceptPlanResult(started.revision, createPlan());
  if (createSelection) {
    workspace.updateSelection({
      selectedPaths: new Set(createSelection.selectedPaths),
      focusedPath: createSelection.focusedPath,
      anchorPath: createSelection.anchorPath,
    });
  }

  return createZManagerReactSnapshot({
    shell: {
      ...initial.shell,
      activeMode: "compress",
    },
    archive: initial.archive,
    create: workspace.getSnapshot(),
    jobs: initial.jobs,
    quickActionProgress: initial.quickActionProgress,
    preferences: initial.preferences,
    preferencesDraft: initial.preferencesDraft,
    pathHistory: initial.pathHistory,
    display: initial.display,
    commands: initial.commands,
  });
}

function createPlan(): CreatePlan {
  const planEntries: CreatePlan["planEntries"] = [
    {
      path: "photos-folder",
      kind: "directory",
      sourcePath: "C:/work/photos-folder",
    },
    {
      path: "desktop-archive-source.zip",
      kind: "file",
      size: 0,
      sourcePath: "C:/work/desktop-archive-source.zip",
    },
    {
      path: "quarterly-report.pdf",
      kind: "file",
      size: 0,
      sourcePath: "C:/work/quarterly-report.pdf",
    },
  ];
  return {
    includedCount: planEntries.length,
    excludedCount: 0,
    totalBytes: 0,
    excludedBytes: 0,
    entries: planEntries.map((entry) => entry.path),
    planEntries,
    excludedEntries: [],
    warnings: [],
  };
}
