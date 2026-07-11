import { describe, expect, it } from "vitest";

import { buildQuickCreateStartRequest, createCreateWorkspace } from "./createWorkspace";
import type { CreatePlanResponse } from "../../api/types";
import type { FormatCreateDefaults } from "../preferences";

function createPlan(overrides: Partial<CreatePlanResponse> = {}): CreatePlanResponse {
  return {
    includedCount: 1,
    excludedCount: 0,
    totalBytes: 12,
    excludedBytes: 0,
    entries: ["project/readme.md"],
    planEntries: [{
      path: "project/readme.md",
      kind: "file",
      size: 12,
      sourcePath: "C:/work/project/readme.md",
    }],
    excludedEntries: [],
    warnings: [],
    ...overrides,
  };
}

function createNestedPlan(overrides: Partial<CreatePlanResponse> = {}): CreatePlanResponse {
  const planEntries: CreatePlanResponse["planEntries"] = [
    {
      path: "project",
      kind: "directory",
      sourcePath: "C:/work/project",
    },
    {
      path: "project/readme.md",
      kind: "file",
      size: 10,
      sourcePath: "C:/work/project/readme.md",
    },
    {
      path: "project/src",
      kind: "directory",
      sourcePath: "C:/work/project/src",
    },
    {
      path: "project/src/app.ts",
      kind: "file",
      size: 20,
      sourcePath: "C:/work/project/src/app.ts",
    },
    {
      path: "project/src/unused.ts",
      kind: "file",
      size: 5,
      sourcePath: "C:/work/project/src/unused.ts",
    },
    {
      path: "notes.txt",
      kind: "file",
      size: 3,
      sourcePath: "C:/work/notes.txt",
    },
  ];
  return {
    includedCount: planEntries.length,
    excludedCount: 0,
    totalBytes: 38,
    excludedBytes: 0,
    entries: planEntries.map((entry) => entry.path),
    planEntries,
    excludedEntries: [],
    warnings: [],
    ...overrides,
  };
}

function readyWorkspace(plan: CreatePlanResponse = createNestedPlan()) {
  const workspace = createCreateWorkspace();
  workspace.addSources(["C:/work/project"]);
  const started = workspace.beginPlan({
    cleanSource: false,
    respectGitignore: true,
  });
  expect(started.ready).toBe(true);
  if (!started.ready) {
    throw new Error("Expected plan request to be ready");
  }
  workspace.acceptPlanResult(started.revision, plan);
  return workspace;
}

function formatDefaults(overrides: Partial<FormatCreateDefaults> = {}): FormatCreateDefaults {
  return {
    cleanSource: true,
    compressionLevel: null,
    volumeSize: null,
    tzapRecoveryPercentage: null,
    preserveMetadata: true,
    replaceExisting: false,
    promptForPassword: false,
    ...overrides,
  };
}

const pathHelpers = {
  nativeParentPath(path: string): string {
    const trimmed = path.trim().replace(/[\\/]+$/, "");
    const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
    return slash > 0 ? trimmed.slice(0, slash) : "";
  },
};

describe("create workspace source state", () => {
  it("starts with an empty immutable source snapshot", () => {
    const workspace = createCreateWorkspace();

    const snapshot = workspace.getSnapshot();

    expect(snapshot).toEqual({
      sources: [],
      sourceCount: 0,
      hasSources: false,
      isEmpty: true,
      plan: {
        state: "idle",
        current: null,
        status: null,
        warnings: [],
        revision: 0,
        hasPlan: false,
      },
      inclusion: {
        excludedArchivePaths: [],
        includedEntries: [],
        includedCount: 0,
        hasIncludedEntries: false,
        filteredPlan: null,
      },
      view: {
        currentFolder: "",
        searchQuery: "",
        expandedTreeFolders: [""],
        rows: [],
        treeFolders: [{
          path: "",
          name: "",
          depth: 0,
          hasChildren: false,
          isExpanded: true,
        }],
      },
      selection: {
        selectedPaths: [],
        selectedCount: 0,
        focusedPath: "",
        anchorPath: "",
        visibleSelectablePaths: [],
        visibleSelectedPaths: [],
      },
      options: {
        destinationPath: "",
        format: "tarZst",
        cleanSource: true,
        respectGitignore: false,
        followSymlinks: false,
        replaceExisting: false,
        preserveMetadata: true,
        compressionLevel: null,
        volumeSize: null,
        tzapRecoveryPercentage: 5,
        tzapVolumeLossTolerance: 0,
        zipCompression: "deflate",
        sevenZSolid: true,
        sevenZThreads: null,
        sevenZChunkSize: 16 * 1024 * 1024,
        sevenZEncryptFileNames: true,
        tzapRecipientCertificatePaths: "",
        tzapSigningCertificatePath: "",
        tzapSigningPrivateKeyPath: "",
        tzapSigningChainPaths: "",
        submissionInFlight: false,
        password: {
          supportsPassword: false,
          visible: false,
          disabled: true,
        },
        tzapRecovery: {
          supportsTzapRecovery: false,
          visible: false,
          disabled: true,
        },
        readiness: {
          canCreate: false,
          unavailableReason: "needsSources",
        },
      },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.sources)).toBe(true);
    expect(Object.isFrozen(snapshot.plan)).toBe(true);
    expect(Object.isFrozen(snapshot.plan.warnings)).toBe(true);
    expect(Object.isFrozen(snapshot.inclusion)).toBe(true);
    expect(Object.isFrozen(snapshot.inclusion.excludedArchivePaths)).toBe(true);
    expect(Object.isFrozen(snapshot.inclusion.includedEntries)).toBe(true);
    expect(Object.isFrozen(snapshot.view)).toBe(true);
    expect(Object.isFrozen(snapshot.view.expandedTreeFolders)).toBe(true);
    expect(Object.isFrozen(snapshot.view.rows)).toBe(true);
    expect(Object.isFrozen(snapshot.view.treeFolders)).toBe(true);
    expect(Object.isFrozen(snapshot.selection)).toBe(true);
    expect(Object.isFrozen(snapshot.selection.selectedPaths)).toBe(true);
    expect(Object.isFrozen(snapshot.selection.visibleSelectablePaths)).toBe(true);
    expect(Object.isFrozen(snapshot.selection.visibleSelectedPaths)).toBe(true);
    expect(Object.isFrozen(snapshot.options)).toBe(true);
    expect(Object.isFrozen(snapshot.options.password)).toBe(true);
    expect(Object.isFrozen(snapshot.options.tzapRecovery)).toBe(true);
    expect(Object.isFrozen(snapshot.options.readiness)).toBe(true);
  });

  it("adds trimmed unique sources while preserving insertion order", () => {
    const workspace = createCreateWorkspace();

    const result = workspace.addSources([
      " C:/work/project ",
      "",
      "C:/work/photos",
      "C:/work/project",
      null,
      42,
      "  ",
    ]);

    expect(result.changed).toBe(true);
    expect(result.addedSources).toEqual(["C:/work/project", "C:/work/photos"]);
    expect(result.removedSources).toEqual([]);
    expect(result.snapshot.sources).toEqual(["C:/work/project", "C:/work/photos"]);
    expect(result.snapshot).toMatchObject({
      sourceCount: 2,
      hasSources: true,
      isEmpty: false,
    });
  });

  it("appends only new unique sources after existing sources", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos"]);

    const result = workspace.addSources([" C:/work/photos ", "C:/work/music"]);

    expect(result.changed).toBe(true);
    expect(result.addedSources).toEqual(["C:/work/music"]);
    expect(result.snapshot.sources).toEqual([
      "C:/work/project",
      "C:/work/photos",
      "C:/work/music",
    ]);
  });

  it("reports no change for blank or duplicate add operations", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);

    const result = workspace.addSources([" ", " C:/work/project "]);

    expect(result.changed).toBe(false);
    expect(result.addedSources).toEqual([]);
    expect(result.snapshot.sources).toEqual(["C:/work/project"]);
  });

  it("replaces sources for quick create review through setSources", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos"]);

    const result = workspace.setSources([" C:/work/music ", "C:/work/project", "C:/work/music"]);

    expect(result.changed).toBe(true);
    expect(result.addedSources).toEqual(["C:/work/music"]);
    expect(result.removedSources).toEqual(["C:/work/photos"]);
    expect(result.snapshot.sources).toEqual(["C:/work/music", "C:/work/project"]);
  });

  it("reports no change when setSources keeps the same normalized order", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos"]);

    const result = workspace.setSources([" C:/work/project ", "C:/work/photos"]);

    expect(result.changed).toBe(false);
    expect(result.addedSources).toEqual([]);
    expect(result.removedSources).toEqual([]);
    expect(result.snapshot.sources).toEqual(["C:/work/project", "C:/work/photos"]);
  });

  it("removes requested sources and ignores blanks or missing paths", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos", "C:/work/music"]);

    const result = workspace.removeSources([
      "",
      " C:/work/photos ",
      "C:/work/missing",
      null,
    ]);

    expect(result.changed).toBe(true);
    expect(result.addedSources).toEqual([]);
    expect(result.removedSources).toEqual(["C:/work/photos"]);
    expect(result.snapshot.sources).toEqual(["C:/work/project", "C:/work/music"]);
    expect(result.becameEmpty).toBe(false);
  });

  it("reports no change when removal has no matching source", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);

    const result = workspace.removeSources(["", "C:/work/missing"]);

    expect(result.changed).toBe(false);
    expect(result.removedSources).toEqual([]);
    expect(result.snapshot.sources).toEqual(["C:/work/project"]);
  });

  it("clears sources and reports when the workspace becomes empty", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos"]);

    const result = workspace.clearSources();

    expect(result.changed).toBe(true);
    expect(result.removedSources).toEqual(["C:/work/project", "C:/work/photos"]);
    expect(result.snapshot).toMatchObject({
      sources: [],
      sourceCount: 0,
      hasSources: false,
      isEmpty: true,
    });
    expect(result.becameEmpty).toBe(true);
  });

  it("reports clear and reset as no-ops when already empty", () => {
    const workspace = createCreateWorkspace();

    expect(workspace.clearSources()).toMatchObject({
      changed: false,
      addedSources: [],
      removedSources: [],
      becameEmpty: false,
    });
    expect(workspace.reset()).toMatchObject({
      changed: false,
      addedSources: [],
      removedSources: [],
      becameEmpty: false,
    });
  });

  it("returns snapshots that cannot mutate workspace state", () => {
    const workspace = createCreateWorkspace();
    const first = workspace.addSources(["C:/work/project"]).snapshot;

    expect(() => {
      (first.sources as string[]).push("C:/work/photos");
    }).toThrow(TypeError);

    workspace.addSources(["C:/work/photos"]);

    expect(first.sources).toEqual(["C:/work/project"]);
    expect(workspace.getSnapshot().sources).toEqual(["C:/work/project", "C:/work/photos"]);
  });
});

describe("create workspace plan lifecycle", () => {
  it("reports plan request readiness when no sources are present", () => {
    const workspace = createCreateWorkspace();

    const result = workspace.beginPlan({
      cleanSource: true,
      respectGitignore: true,
    });

    expect(result.ready).toBe(false);
    if (result.ready) {
      throw new Error("Expected create plan request to be unavailable without sources");
    }
    expect(result.reason).toBe("needsSources");
    expect(result.revision).toBe(1);
    expect(result.snapshot.plan).toMatchObject({
      state: "idle",
      current: null,
      revision: 1,
      hasPlan: false,
      status: { messageKey: "create.plan.noSources" },
    });
  });

  it("issues revisions and enters loading state when planning is queued", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);

    const first = workspace.queuePlan();
    const second = workspace.queuePlan();

    expect(first.revision).toBe(1);
    expect(first.hasSources).toBe(true);
    expect(first.snapshot.plan).toMatchObject({
      state: "loading",
      current: null,
      status: { messageKey: "create.plan.planning" },
      revision: 1,
    });
    expect(second.revision).toBe(2);
    expect(second.snapshot.plan.revision).toBe(2);
  });

  it("builds serializable plan requests from sources and option input", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources([" C:/work/project ", "C:/work/photos"]);

    const result = workspace.beginPlan({
      cleanSource: true,
      respectGitignore: false,
      excludeNames: [" node_modules ", ""],
      excludeArchivePaths: [" project/tmp "],
      includeArchivePaths: [" project/tmp/keep.txt "],
      followSymlinks: true,
    });

    expect(result.ready).toBe(true);
    if (!result.ready) {
      return;
    }
    expect(result.request).toEqual({
      sources: ["C:/work/project", "C:/work/photos"],
      cleanSource: true,
      respectGitignore: false,
      excludeNames: ["node_modules"],
      excludeArchivePaths: ["project/tmp"],
      includeArchivePaths: ["project/tmp/keep.txt"],
      followSymlinks: true,
    });
    expect(result.snapshot.plan).toMatchObject({
      state: "loading",
      revision: result.revision,
      hasPlan: false,
    });
  });

  it("accepts current plan results and exposes warnings", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const started = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }

    const accepted = workspace.acceptPlanResult(started.revision, createPlan({
      warnings: ["Skipped temporary file."],
    }));

    expect(accepted.accepted).toBe(true);
    expect(accepted.snapshot.plan).toMatchObject({
      state: "ready",
      revision: started.revision,
      hasPlan: true,
      warnings: ["Skipped temporary file."],
      status: null,
    });
    expect(accepted.snapshot.plan.current?.warnings).toEqual(["Skipped temporary file."]);
  });

  it("ignores stale plan results without changing the current plan", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const stale = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    const current = workspace.beginPlan({
      cleanSource: true,
      respectGitignore: true,
    });
    expect(stale.ready).toBe(true);
    expect(current.ready).toBe(true);
    if (!stale.ready || !current.ready) {
      return;
    }

    const ignored = workspace.acceptPlanResult(stale.revision, createPlan({
      entries: ["stale.txt"],
    }));

    expect(ignored.accepted).toBe(false);
    expect(ignored.snapshot.plan).toMatchObject({
      state: "loading",
      current: null,
      revision: current.revision,
    });
  });

  it("accepts current plan errors and ignores stale errors", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const stale = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    const current = workspace.beginPlan({
      cleanSource: true,
      respectGitignore: true,
    });
    expect(stale.ready).toBe(true);
    expect(current.ready).toBe(true);
    if (!stale.ready || !current.ready) {
      return;
    }

    const ignored = workspace.acceptPlanError(stale.revision, { fallbackText: "stale failure" });
    const accepted = workspace.acceptPlanError(current.revision, { fallbackText: "current failure" });

    expect(ignored.accepted).toBe(false);
    expect(accepted.accepted).toBe(true);
    expect(accepted.snapshot.plan).toMatchObject({
      state: "error",
      current: null,
      status: { fallbackText: "current failure" },
      hasPlan: false,
    });
  });

  it("clears plan state when sources are changed or cleared", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const started = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }
    workspace.acceptPlanResult(started.revision, createPlan());

    const removed = workspace.removeSources(["C:/work/project"]);

    expect(removed.snapshot.plan).toMatchObject({
      state: "idle",
      current: null,
      status: null,
      hasPlan: false,
    });
  });

  it("restores ready state after destination edits when a plan is still available", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const started = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }
    workspace.acceptPlanResult(started.revision, createPlan());

    const errorSnapshot = workspace.setPlanError({ messageKey: "create.error.pickDestination" });
    const restored = workspace.refreshPlanAfterDestinationEdit();

    expect(errorSnapshot.plan).toMatchObject({
      state: "error",
      hasPlan: true,
      status: { messageKey: "create.error.pickDestination" },
    });
    expect(restored.plan).toMatchObject({
      state: "ready",
      hasPlan: true,
      status: null,
    });
  });

  it("returns immutable plan snapshots isolated from accepted results", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const started = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }
    const mutablePlan = createPlan({
      warnings: ["first warning"],
    });
    const accepted = workspace.acceptPlanResult(started.revision, mutablePlan);
    const current = accepted.snapshot.plan.current;

    expect(current).not.toBeNull();
    expect(Object.isFrozen(accepted.snapshot.plan)).toBe(true);
    expect(Object.isFrozen(accepted.snapshot.plan.warnings)).toBe(true);
    expect(Object.isFrozen(current?.entries)).toBe(true);
    expect(Object.isFrozen(current?.planEntries)).toBe(true);
    expect(Object.isFrozen(current?.planEntries[0])).toBe(true);
    expect(() => {
      current?.entries.push("mutated.txt");
    }).toThrow(TypeError);

    mutablePlan.warnings.push("external mutation");

    expect(workspace.getSnapshot().plan.warnings).toEqual(["first warning"]);
  });
});

describe("create workspace plan navigation", () => {
  it("exposes visible rows at the root and in nested folders", () => {
    const workspace = readyWorkspace();

    expect(workspace.getSnapshot().view.rows.map((row) => [row.rowType, row.path, row.name])).toEqual([
      ["folder", "project", "project"],
      ["entry", "notes.txt", "notes.txt"],
    ]);

    const project = workspace.navigateToFolder("project");

    expect(project.accepted).toBe(true);
    expect(project.changed).toBe(true);
    expect(project.snapshot.view.currentFolder).toBe("project");
    expect(project.snapshot.view.rows.map((row) => [row.rowType, row.path, row.name])).toEqual([
      ["parent", "", ".."],
      ["folder", "project/src", "src"],
      ["entry", "project/readme.md", "readme.md"],
    ]);

    const nested = workspace.navigateToFolder(" project/src ");

    expect(nested.accepted).toBe(true);
    expect(nested.snapshot.view.currentFolder).toBe("project/src");
    expect(nested.snapshot.view.rows.map((row) => [row.rowType, row.path, row.name])).toEqual([
      ["parent", "project", ".."],
      ["entry", "project/src/app.ts", "app.ts"],
      ["entry", "project/src/unused.ts", "unused.ts"],
    ]);
  });

  it("filters create plan rows with a workspace-owned search query", () => {
    const workspace = readyWorkspace();
    workspace.navigateToFolder("project");

    const searched = workspace.setSearchQuery("app");

    expect(searched.view.searchQuery).toBe("app");
    expect(searched.view.currentFolder).toBe("project");
    expect(searched.view.rows.map((row) => [row.rowType, row.path, row.name])).toEqual([
      ["entry", "project/src/app.ts", "app.ts"],
    ]);

    const cleared = workspace.clearSearch();

    expect(cleared.view.searchQuery).toBe("");
    expect(cleared.view.rows.map((row) => [row.rowType, row.path, row.name])).toEqual([
      ["parent", "", ".."],
      ["folder", "project/src", "src"],
      ["entry", "project/readme.md", "readme.md"],
    ]);
  });

  it("rejects invalid navigation without changing the current folder", () => {
    const workspace = readyWorkspace();
    workspace.navigateToFolder("project");

    const invalid = workspace.navigateToFolder("missing/folder");

    expect(invalid.accepted).toBe(false);
    expect(invalid.changed).toBe(false);
    expect(invalid.snapshot.view.currentFolder).toBe("project");

    const filePath = workspace.navigateToFolder("notes.txt");

    expect(filePath.accepted).toBe(false);
    expect(filePath.changed).toBe(false);
    expect(filePath.snapshot.view.currentFolder).toBe("project");

    const same = workspace.navigateToFolder("project");

    expect(same.accepted).toBe(true);
    expect(same.changed).toBe(false);
    expect(same.snapshot.view.currentFolder).toBe("project");
  });

  it("derives expanded tree folders and tree folder snapshots", () => {
    const workspace = readyWorkspace();

    expect(workspace.getSnapshot().view.expandedTreeFolders).toEqual([""]);
    expect(workspace.getSnapshot().view.treeFolders.map((folder) => ({
      path: folder.path,
      depth: folder.depth,
      hasChildren: folder.hasChildren,
      isExpanded: folder.isExpanded,
    }))).toEqual([
      { path: "", depth: 0, hasChildren: true, isExpanded: true },
      { path: "project", depth: 1, hasChildren: true, isExpanded: false },
    ]);

    const expanded = workspace.setTreeFolderExpanded("project", true);

    expect(expanded.accepted).toBe(true);
    expect(expanded.changed).toBe(true);
    expect(expanded.snapshot.view.expandedTreeFolders).toEqual(["", "project"]);
    expect(expanded.snapshot.view.treeFolders.map((folder) => [folder.path, folder.depth, folder.isExpanded])).toEqual([
      ["", 0, true],
      ["project", 1, true],
      ["project/src", 2, false],
    ]);
  });

  it("keeps the active branch expanded when toggling an ancestor", () => {
    const workspace = readyWorkspace();

    workspace.navigateToFolder("project/src");
    const toggledAncestor = workspace.toggleTreeFolder("project");

    expect(toggledAncestor.accepted).toBe(true);
    expect(toggledAncestor.changed).toBe(false);
    expect(toggledAncestor.snapshot.view.currentFolder).toBe("project/src");
    expect(toggledAncestor.snapshot.view.expandedTreeFolders).toEqual(["", "project", "project/src"]);
    expect(toggledAncestor.snapshot.view.treeFolders.map((folder) => [folder.path, folder.isExpanded])).toEqual([
      ["", true],
      ["project", true],
      ["project/src", true],
    ]);
  });

  it("owns create row selection and cleans it when visible rows change", () => {
    const workspace = readyWorkspace();

    const selected = workspace.selectRow("project");

    expect(selected.changed).toBe(true);
    expect(selected.snapshot.selection).toMatchObject({
      selectedPaths: ["project"],
      selectedCount: 1,
      focusedPath: "project",
      anchorPath: "project",
      visibleSelectablePaths: ["project", "notes.txt"],
      visibleSelectedPaths: ["project"],
    });

    const focused = workspace.focusRow("notes.txt");

    expect(focused.changed).toBe(true);
    expect(focused.snapshot.selection).toMatchObject({
      selectedPaths: ["project"],
      focusedPath: "notes.txt",
      anchorPath: "project",
    });

    const searched = workspace.setSearchQuery("notes");

    expect(searched.selection).toEqual({
      selectedPaths: [],
      selectedCount: 0,
      focusedPath: "notes.txt",
      anchorPath: "notes.txt",
      visibleSelectablePaths: ["notes.txt"],
      visibleSelectedPaths: [],
    });
  });

  it("resets navigation when sources change or the plan becomes unavailable", () => {
    const workspace = readyWorkspace();

    workspace.navigateToFolder("project/src");
    const changedSources = workspace.addSources(["C:/work/photos"]);

    expect(changedSources.snapshot.view).toMatchObject({
      currentFolder: "",
      expandedTreeFolders: [""],
      rows: [],
    });

    const restored = readyWorkspace();
    restored.navigateToFolder("project/src");
    const started = restored.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }

    const failed = restored.acceptPlanError(started.revision, { fallbackText: "plan failed" });

    expect(failed.snapshot.view).toMatchObject({
      currentFolder: "",
      expandedTreeFolders: [""],
      rows: [],
    });
  });

  it("preserves or resets the current folder across accepted plan results", () => {
    const workspace = readyWorkspace();
    workspace.navigateToFolder("project/src");

    const matchingPlan = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(matchingPlan.ready).toBe(true);
    if (!matchingPlan.ready) {
      return;
    }

    const preserved = workspace.acceptPlanResult(matchingPlan.revision, createNestedPlan());

    expect(preserved.accepted).toBe(true);
    expect(preserved.snapshot.view.currentFolder).toBe("project/src");

    const smallerPlan = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(smallerPlan.ready).toBe(true);
    if (!smallerPlan.ready) {
      return;
    }

    const reset = workspace.acceptPlanResult(smallerPlan.revision, createNestedPlan({
      planEntries: [
        {
          path: "project",
          kind: "directory",
          sourcePath: "C:/work/project",
        },
        {
          path: "project/readme.md",
          kind: "file",
          size: 10,
          sourcePath: "C:/work/project/readme.md",
        },
      ],
      entries: ["project", "project/readme.md"],
      includedCount: 2,
      totalBytes: 10,
    }));

    expect(reset.accepted).toBe(true);
    expect(reset.snapshot.view.currentFolder).toBe("");
    expect(reset.snapshot.view.rows.map((row) => [row.rowType, row.path])).toEqual([
      ["folder", "project"],
    ]);
  });
});

describe("create workspace inclusion state", () => {
  it("excludes and re-includes a single planned file", () => {
    const workspace = readyWorkspace();

    const excluded = workspace.setPathIncluded(" project/readme.md ", false);

    expect(excluded.changed).toBe(true);
    expect(excluded.snapshot.inclusion.excludedArchivePaths).toEqual(["project/readme.md"]);
    expect(excluded.snapshot.inclusion.includedEntries.map((entry) => entry.path)).not.toContain("project/readme.md");
    expect(workspace.getPathInclusionState("project/readme.md")).toBe("excluded");

    const included = workspace.setPathIncluded("project/readme.md", true);

    expect(included.changed).toBe(true);
    expect(included.snapshot.inclusion.excludedArchivePaths).toEqual([]);
    expect(workspace.getPathInclusionState("project/readme.md")).toBe("included");
  });

  it("reports folder inclusion as excluded, partial, and included", () => {
    const workspace = readyWorkspace();

    workspace.setPathIncluded("project/src", false);

    expect(workspace.getPathInclusionState("project/src")).toBe("excluded");
    expect(workspace.getSnapshot().inclusion.excludedArchivePaths).toEqual([
      "project/src",
      "project/src/app.ts",
      "project/src/unused.ts",
    ]);

    workspace.setPathIncluded("project/src/app.ts", true);

    expect(workspace.getPathInclusionState("project/src")).toBe("partial");
    expect(workspace.getSnapshot().inclusion.excludedArchivePaths).toEqual(["project/src/unused.ts"]);

    workspace.setPathIncluded("project/src", true);

    expect(workspace.getPathInclusionState("project/src")).toBe("included");
    expect(workspace.getSnapshot().inclusion.excludedArchivePaths).toEqual([]);
  });

  it("includes and excludes all current plan paths", () => {
    const workspace = readyWorkspace();

    const excluded = workspace.setAllPathsIncluded(false);

    expect(excluded.changed).toBe(true);
    expect(excluded.snapshot.inclusion.includedCount).toBe(0);
    expect(excluded.snapshot.inclusion.hasIncludedEntries).toBe(false);
    expect(excluded.snapshot.inclusion.excludedArchivePaths).toEqual([
      "notes.txt",
      "project",
      "project/readme.md",
      "project/src",
      "project/src/app.ts",
      "project/src/unused.ts",
    ]);

    const included = workspace.setAllPathsIncluded(true);

    expect(included.changed).toBe(true);
    expect(included.snapshot.inclusion.excludedArchivePaths).toEqual([]);
    expect(included.snapshot.inclusion.includedCount).toBe(6);
  });

  it("includes and excludes only the visible table rows", () => {
    const workspace = readyWorkspace();
    workspace.navigateToFolder("project");

    const excluded = workspace.setVisibleRowsIncluded(false);

    expect(excluded.changed).toBe(true);
    expect(excluded.snapshot.view.currentFolder).toBe("project");
    expect(excluded.snapshot.view.rows.map((row) => row.path)).toEqual([
      "",
      "project/src",
      "project/readme.md",
    ]);
    expect(excluded.snapshot.inclusion.excludedArchivePaths).toEqual([
      "project/readme.md",
      "project/src",
      "project/src/app.ts",
      "project/src/unused.ts",
    ]);
    expect(excluded.snapshot.inclusion.includedEntries.map((entry) => entry.path)).toEqual([
      "project",
      "notes.txt",
    ]);

    const included = workspace.setVisibleRowsIncluded(true);

    expect(included.changed).toBe(true);
    expect(included.snapshot.inclusion.excludedArchivePaths).toEqual([]);
  });

  it("derives include-all control facts for the current folder", () => {
    const workspace = readyWorkspace();

    expect(workspace.getIncludeAllControlState("project")).toEqual({
      checked: true,
      indeterminate: false,
      disabled: false,
      affectedEntryCount: 5,
      includedEntryCount: 5,
    });

    workspace.setPathIncluded("project/src/unused.ts", false);

    expect(workspace.getIncludeAllControlState("project")).toEqual({
      checked: false,
      indeterminate: true,
      disabled: false,
      affectedEntryCount: 5,
      includedEntryCount: 4,
    });
    expect(workspace.getIncludeAllControlState("missing")).toMatchObject({
      checked: false,
      indeterminate: false,
      disabled: true,
      affectedEntryCount: 0,
      includedEntryCount: 0,
    });
  });

  it("filters the current plan counts and bytes from excluded paths", () => {
    const workspace = readyWorkspace();

    workspace.setPathIncluded("project/readme.md", false);
    const snapshot = workspace.setPathIncluded("project/src/unused.ts", false).snapshot;

    expect(snapshot.inclusion.filteredPlan).toMatchObject({
      includedCount: 4,
      excludedCount: 2,
      totalBytes: 23,
      excludedBytes: 15,
      entries: ["project", "project/src", "project/src/app.ts", "notes.txt"],
      excludedEntries: ["project/readme.md", "project/src/unused.ts"],
    });
    expect(snapshot.inclusion.includedEntries.map((entry) => entry.path)).toEqual([
      "project",
      "project/src",
      "project/src/app.ts",
      "notes.txt",
    ]);
  });

  it("prunes excluded paths when a new current plan is accepted", () => {
    const workspace = readyWorkspace();
    workspace.setPathIncluded("project/readme.md", false);
    workspace.setPathIncluded("notes.txt", false);
    const started = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }

    const accepted = workspace.acceptPlanResult(started.revision, createNestedPlan({
      planEntries: [{
        path: "notes.txt",
        kind: "file",
        size: 3,
        sourcePath: "C:/work/notes.txt",
      }],
      entries: ["notes.txt"],
      includedCount: 1,
      totalBytes: 3,
    }));

    expect(accepted.accepted).toBe(true);
    expect(accepted.snapshot.inclusion.excludedArchivePaths).toEqual(["notes.txt"]);
  });

  it("ignores stale plan results without pruning current exclusions", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);
    const stale = workspace.beginPlan({
      cleanSource: false,
      respectGitignore: true,
    });
    const current = workspace.beginPlan({
      cleanSource: true,
      respectGitignore: true,
    });
    expect(stale.ready).toBe(true);
    expect(current.ready).toBe(true);
    if (!stale.ready || !current.ready) {
      return;
    }
    workspace.acceptPlanResult(current.revision, createNestedPlan());
    workspace.setPathIncluded("project/readme.md", false);

    const ignored = workspace.acceptPlanResult(stale.revision, createNestedPlan({
      planEntries: [{
        path: "notes.txt",
        kind: "file",
        size: 3,
        sourcePath: "C:/work/notes.txt",
      }],
      entries: ["notes.txt"],
      includedCount: 1,
      totalBytes: 3,
    }));

    expect(ignored.accepted).toBe(false);
    expect(ignored.snapshot.inclusion.excludedArchivePaths).toEqual(["project/readme.md"]);
  });

  it("clears excluded paths when sources change", () => {
    const workspace = readyWorkspace();
    workspace.setPathIncluded("project/readme.md", false);

    const changed = workspace.addSources(["C:/work/photos"]);

    expect(changed.changed).toBe(true);
    expect(changed.snapshot.inclusion.excludedArchivePaths).toEqual([]);
    expect(changed.snapshot.inclusion.filteredPlan).toBeNull();
  });

  it("returns immutable excluded path snapshots isolated from later mutations", () => {
    const workspace = readyWorkspace();
    const first = workspace.setPathIncluded("project/readme.md", false).snapshot;

    expect(Object.isFrozen(first.inclusion.excludedArchivePaths)).toBe(true);
    expect(() => {
      (first.inclusion.excludedArchivePaths as string[]).push("notes.txt");
    }).toThrow(TypeError);

    workspace.setPathIncluded("notes.txt", false);

    expect(first.inclusion.excludedArchivePaths).toEqual(["project/readme.md"]);
    expect(workspace.getSnapshot().inclusion.excludedArchivePaths).toEqual([
      "notes.txt",
      "project/readme.md",
    ]);
  });
});

describe("create workspace option and readiness state", () => {
  it("applies per-format defaults and suggests a destination when sources are present", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);

    const result = workspace.applyFormatDefaults("tzap", formatDefaults({
      cleanSource: false,
      compressionLevel: 3,
      volumeSize: 2048,
      tzapRecoveryPercentage: 12,
      tzapVolumeLossTolerance: 0,
      preserveMetadata: false,
      replaceExisting: true,
      promptForPassword: true,
    }), {
      ...pathHelpers,
      defaultDirectory: "D:/archives",
    });

    expect(result.changed).toBe(true);
    expect(result.snapshot.options).toMatchObject({
      destinationPath: "D:/archives/project.tzap",
      format: "tzap",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
      compressionLevel: 3,
      volumeSize: 2048,
      sevenZSolid: true,
      sevenZEncryptFileNames: true,
      tzapRecoveryPercentage: 12,
      password: {
        supportsPassword: true,
        visible: true,
        disabled: false,
      },
      tzapRecovery: {
        supportsTzapRecovery: true,
        visible: true,
        disabled: false,
      },
    });
  });

  it("suggests destinations from the preferred directory or common source parent", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project", "C:/work/photos"]);

    expect(workspace.suggestedDestinationPath({
      ...pathHelpers,
      defaultDirectory: "E:/out",
    })).toBe("E:/out/work.tzst");

    expect(workspace.suggestedDestinationPath(pathHelpers)).toBe("C:/work/work.tzst");

    const suggested = workspace.suggestDestinationPathIfBlank(pathHelpers);

    expect(suggested.changed).toBe(true);
    expect(suggested.destinationPath).toBe("C:/work/work.tzst");
    expect(workspace.suggestDestinationPathIfBlank({
      ...pathHelpers,
      defaultDirectory: "F:/ignored",
    }).changed).toBe(false);
    expect(workspace.getSnapshot().options.destinationPath).toBe("C:/work/work.tzst");
  });

  it("uses a generic destination name for multiple browser sources without a parent directory", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources([
      "very-long-file-name-that-should-not-break-the-compress-table-layout-report-final.pdf",
      "deeply-nested-folder-with-a-long-name",
    ]);

    expect(workspace.suggestedDestinationPath(pathHelpers)).toBe("archive.tzst");
  });

  it("builds create destinations from a selected output folder", () => {
    const workspace = createCreateWorkspace();
    workspace.addSources(["C:/work/project"]);

    expect(workspace.destinationPathForOutputFolder("D:/archives")).toBe("D:/archives/project.tzst");

    workspace.setDestinationPath("C:/old/custom-name.zip");

    expect(workspace.destinationPathForOutputFolder("D:/archives")).toBe("D:/archives/custom-name.tzst");
    expect(workspace.destinationPathForOutputFolder("D:\\archives", "C:\\old\\typed-name")).toBe(
      "D:\\archives\\typed-name.tzst",
    );
  });

  it("changes formats by applying defaults and replacing an existing destination extension", () => {
    const workspace = createCreateWorkspace();
    workspace.setDestinationPath("C:/out/project.zip");

    const changed = workspace.changeFormat("sevenZ", formatDefaults({
      cleanSource: false,
      compressionLevel: 9,
      volumeSize: 1024,
    }));

    expect(changed.snapshot.options).toMatchObject({
      destinationPath: "C:/out/project.7z",
      format: "sevenZ",
      cleanSource: false,
      compressionLevel: 9,
      volumeSize: 1024,
      tzapRecoveryPercentage: 5,
      password: {
        supportsPassword: true,
        visible: true,
        disabled: false,
      },
      tzapRecovery: {
        supportsTzapRecovery: false,
        visible: false,
        disabled: true,
      },
    });

    workspace.setDestinationPath("");
    const blankDestination = workspace.changeFormat("zip", formatDefaults());

    expect(blankDestination.snapshot.options.destinationPath).toBe("");
  });

  it("derives password and TZAP option visibility from the selected format", () => {
    const workspace = createCreateWorkspace();

    expect(workspace.getSnapshot().options).toMatchObject({
      format: "tarZst",
      password: {
        supportsPassword: false,
        visible: false,
        disabled: true,
      },
      tzapRecovery: {
        supportsTzapRecovery: false,
        visible: false,
        disabled: true,
      },
    });

    expect(workspace.changeFormat("zip", formatDefaults()).snapshot.options).toMatchObject({
      password: {
        supportsPassword: true,
        visible: true,
        disabled: false,
      },
      tzapRecovery: {
        supportsTzapRecovery: false,
        visible: false,
        disabled: true,
      },
    });

    expect(workspace.changeFormat("tzap", formatDefaults({
      tzapRecoveryPercentage: 17,
    })).snapshot.options).toMatchObject({
      password: {
        supportsPassword: true,
        visible: true,
        disabled: false,
      },
      tzapRecovery: {
        supportsTzapRecovery: true,
        visible: true,
        disabled: false,
      },
      tzapRecoveryPercentage: 17,
    });
  });

  it("normalizes numeric option inputs", () => {
    const workspace = createCreateWorkspace();
    workspace.changeFormat("tzap", formatDefaults());

    const normalized = workspace.setOptions({
      compressionLevel: "3.9",
      volumeSize: "0",
      tzapRecoveryPercentage: "150",
    });

    expect(normalized.snapshot.options).toMatchObject({
      compressionLevel: 3,
      volumeSize: null,
      tzapRecoveryPercentage: 100,
    });

    const cleared = workspace.setOptions({
      compressionLevel: "-1",
      volumeSize: "4096.8",
      tzapRecoveryPercentage: "bad",
    });

    expect(cleared.snapshot.options).toMatchObject({
      compressionLevel: null,
      volumeSize: 4096,
      tzapRecoveryPercentage: 5,
      tzapVolumeLossTolerance: 1,
    });

    expect(workspace.setOptions({ tzapVolumeLossTolerance: "17" }).snapshot.options.tzapVolumeLossTolerance).toBe(16);
    expect(workspace.setOptions({ volumeSize: null }).snapshot.options).toMatchObject({
      volumeSize: null,
      tzapVolumeLossTolerance: 0,
    });
  });

  it("derives readiness reasons through plan, inclusion, destination, and submission states", () => {
    const workspace = createCreateWorkspace();

    expect(workspace.getSnapshot().options.readiness).toEqual({
      canCreate: false,
      unavailableReason: "needsSources",
    });

    workspace.addSources(["C:/work/project"]);
    expect(workspace.getSnapshot().options.readiness.unavailableReason).toBe("needsDestination");

    workspace.setDestinationPath("C:/out/project.tzst");
    expect(workspace.getSnapshot().options.readiness.unavailableReason).toBe("needsPlan");

    const started = workspace.beginPlan();
    expect(started.ready).toBe(true);
    if (!started.ready) {
      return;
    }
    expect(started.snapshot.options.readiness.unavailableReason).toBe("planning");

    workspace.acceptPlanResult(started.revision, createPlan());
    expect(workspace.getSnapshot().options.readiness).toEqual({
      canCreate: true,
      unavailableReason: null,
    });

    workspace.setAllPathsIncluded(false);
    expect(workspace.getSnapshot().options.readiness.unavailableReason).toBe("needsIncludedEntries");

    workspace.setAllPathsIncluded(true);
    workspace.setSubmissionInFlight(true);
    expect(workspace.getSnapshot().options.readiness).toEqual({
      canCreate: false,
      unavailableReason: "starting",
    });
  });

  it("recovers ready state after destination edits and keeps password values out of snapshots", () => {
    const workspace = readyWorkspace(createPlan());
    workspace.setDestinationPath("C:/out/project.tzst");

    workspace.setPlanError({ messageKey: "create.error.passwordMismatch" });
    const edited = workspace.setOptions({
      destinationPath: "C:/out/project-renamed.tzst",
      ...({ password: "hunter2" } as Record<string, string>),
    });

    expect(edited.snapshot.plan).toMatchObject({
      state: "ready",
      status: null,
      hasPlan: true,
    });
    expect(edited.snapshot.options.destinationPath).toBe("C:/out/project-renamed.tzst");
    expect(JSON.stringify(edited.snapshot)).not.toContain("hunter2");
    expect(Object.keys(edited.snapshot.options.password)).toEqual([
      "supportsPassword",
      "visible",
      "disabled",
    ]);
  });
});

describe("create workspace start request", () => {
  it("builds a start request from workspace state, options, and inclusion", () => {
    const workspace = readyWorkspace();
    workspace.changeFormat("tzap", formatDefaults({
      cleanSource: false,
      compressionLevel: 7,
      volumeSize: 4096,
      tzapRecoveryPercentage: 12,
      tzapVolumeLossTolerance: 0,
      preserveMetadata: false,
      replaceExisting: true,
    }));
    workspace.setOptions({
      respectGitignore: true,
      tzapSigningCertificatePath: " C:/certs/signer.pem ",
      tzapSigningPrivateKeyPath: "C:/certs/signer-key.pem",
      tzapSigningChainPaths: "C:/certs/intermediate-1.pem; C:/certs/intermediate-2.pem",
    });
    workspace.setDestinationPath("C:/out/project");
    workspace.setPathIncluded("project/src/unused.ts", false);

    const result = workspace.buildStartCreateRequest({
      password: " secret ",
      passwordConfirm: "secret",
      destinationCollisionStrategy: "rename",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected start create request to be available");
    }
    expect(result.request).toEqual({
      sources: ["C:/work/project"],
      destinationPath: "C:/out/project.tzap",
      format: "tzap",
      cleanSource: false,
      excludeArchivePaths: ["project/src/unused.ts"],
      respectGitignore: true,
      followSymlinks: false,
      replaceExisting: true,
      destinationCollisionStrategy: "rename",
      preserveMetadata: false,
      password: "secret",
      compressionLevel: 7,
      volumeSize: 4096,
      tzapRecoveryPercentage: 12,
      tzapVolumeLossTolerance: 0,
      tzapCertificates: {
        signingCertificatePath: "C:/certs/signer.pem",
        signingPrivateKeyPath: "C:/certs/signer-key.pem",
        signingChainPaths: ["C:/certs/intermediate-1.pem", "C:/certs/intermediate-2.pem"],
      },
    });
    expect(result.snapshot.options.destinationPath).toBe("C:/out/project.tzap");
  });

  it("ensures the destination extension before returning a request snapshot", () => {
    const workspace = readyWorkspace(createPlan());
    workspace.setDestinationPath("C:/out/project");

    const result = workspace.buildStartCreateRequest();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.destinationPath).toBe("C:/out/project.tzst");
    expect(result.snapshot.options.destinationPath).toBe("C:/out/project.tzst");
    expect(workspace.getSnapshot().options.destinationPath).toBe("C:/out/project.tzst");
  });

  it("uses sorted excluded archive paths from workspace inclusion", () => {
    const workspace = readyWorkspace();
    workspace.setDestinationPath("C:/out/project.tzst");
    workspace.setPathIncluded("notes.txt", false);
    workspace.setPathIncluded("project/readme.md", false);

    const result = workspace.buildStartCreateRequest();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.excludeArchivePaths).toEqual([
      "notes.txt",
      "project/readme.md",
    ]);
  });

  it("omits password for formats that do not support passwords", () => {
    const workspace = readyWorkspace(createPlan());
    workspace.setDestinationPath("C:/out/project.tzst");

    const result = workspace.buildStartCreateRequest({
      password: "hunter2",
      passwordConfirm: "different-secret",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.format).toBe("tarZst");
    expect(result.request).not.toHaveProperty("password");
    expect(JSON.stringify(result.snapshot)).not.toContain("hunter2");
    expect(JSON.stringify(result.snapshot)).not.toContain("different-secret");
  });

  it("rejects password mismatches without storing password values in snapshots", () => {
    const workspace = readyWorkspace(createPlan());
    workspace.changeFormat("zip", formatDefaults());
    workspace.setDestinationPath("C:/out/project.zip");

    const result = workspace.buildStartCreateRequest({
      password: "first-secret",
      passwordConfirm: "second-secret",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("passwordMismatch");
    expect(result.status).toEqual({ messageKey: "create.error.passwordMismatch" });
    expect(result.snapshot.plan).toMatchObject({
      state: "error",
      status: { messageKey: "create.error.passwordMismatch" },
      hasPlan: true,
    });
    expect(JSON.stringify(result.snapshot)).not.toContain("first-secret");
    expect(JSON.stringify(result.snapshot)).not.toContain("second-secret");
  });

  it("reports language-neutral unavailable reasons while preserving plan status keys", () => {
    const emptyWorkspace = createCreateWorkspace();
    const noSources = emptyWorkspace.buildStartCreateRequest();
    expect(noSources.ok).toBe(false);
    if (!noSources.ok) {
      expect(noSources.reason).toBe("needsSources");
      expect(noSources.status).toBeNull();
    }

    const needsDestinationWorkspace = readyWorkspace(createPlan());
    const needsDestination = needsDestinationWorkspace.buildStartCreateRequest();
    expect(needsDestination.ok).toBe(false);
    if (!needsDestination.ok) {
      expect(needsDestination.reason).toBe("needsDestination");
      expect(needsDestination.status).toEqual({ messageKey: "create.error.pickDestination" });
    }

    const needsPlanWorkspace = createCreateWorkspace();
    needsPlanWorkspace.addSources(["C:/work/project"]);
    needsPlanWorkspace.setDestinationPath("C:/out/project.tzst");
    const needsPlan = needsPlanWorkspace.buildStartCreateRequest();
    expect(needsPlan.ok).toBe(false);
    if (!needsPlan.ok) {
      expect(needsPlan.reason).toBe("needsPlan");
      expect(needsPlan.status).toEqual({ messageKey: "create.error.refreshPlan" });
    }

    const needsIncludedWorkspace = readyWorkspace(createPlan());
    needsIncludedWorkspace.setDestinationPath("C:/out/project.tzst");
    needsIncludedWorkspace.setAllPathsIncluded(false);
    const needsIncluded = needsIncludedWorkspace.buildStartCreateRequest();
    expect(needsIncluded.ok).toBe(false);
    if (!needsIncluded.ok) {
      expect(needsIncluded.reason).toBe("needsIncludedEntries");
      expect(needsIncluded.status).toBeNull();
    }
  });

  it("keeps password values out of successful request snapshots", () => {
    const workspace = readyWorkspace(createPlan());
    workspace.changeFormat("sevenZ", formatDefaults());
    workspace.setDestinationPath("C:/out/project.7z");

    const result = workspace.buildStartCreateRequest({
      password: "visible-only-in-request",
      passwordConfirm: "visible-only-in-request",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.password).toBe("visible-only-in-request");
    expect(JSON.stringify(result.snapshot)).not.toContain("visible-only-in-request");
  });

  it("builds quick create requests through the workspace helper", () => {
    const result = buildQuickCreateStartRequest({
      sources: [" C:/work/project ", "C:/work/project", ""],
      destinationPath: "C:/out/project",
      format: "sevenZ",
      cleanSource: false,
      replaceExisting: true,
      destinationCollisionStrategy: "rename",
      preserveMetadata: false,
      password: " secret ",
      compressionLevel: 9,
      volumeSize: 2048,
      sevenZSolid: true,
      sevenZEncryptFileNames: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected quick create request to be available");
    }
    expect(result.request).toEqual({
      sources: ["C:/work/project"],
      destinationPath: "C:/out/project.7z",
      format: "sevenZ",
      cleanSource: false,
      replaceExisting: true,
      destinationCollisionStrategy: "rename",
      preserveMetadata: false,
      password: "secret",
      compressionLevel: 9,
      volumeSize: 2048,
      sevenZSolid: true,
      sevenZEncryptFileNames: true,
    });

    expect(buildQuickCreateStartRequest({
      sources: [],
      destinationPath: "C:/out/project",
      format: "zip",
      cleanSource: true,
      replaceExisting: false,
      preserveMetadata: true,
    })).toEqual({
      ok: false,
      reason: "needsSources",
    });
    expect(buildQuickCreateStartRequest({
      sources: ["C:/work/project"],
      destinationPath: " ",
      format: "zip",
      cleanSource: true,
      replaceExisting: false,
      preserveMetadata: true,
    })).toEqual({
      ok: false,
      reason: "needsDestination",
    });
  });
});
