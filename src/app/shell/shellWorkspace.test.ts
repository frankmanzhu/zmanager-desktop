import { describe, expect, it } from "vitest";

import { createShellWorkspace } from "./shellWorkspace";

describe("shell workspace state", () => {
  it("starts with an empty immutable snapshot", () => {
    const workspace = createShellWorkspace();
    const snapshot = workspace.getSnapshot();

    expect(snapshot).toEqual({
      activeMode: "compress",
      operationalStatus: "",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "",
        previewPath: "",
        entryPath: "",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.dropOverlay)).toBe(true);
    expect(Object.isFrozen(snapshot.previewCleanup)).toBe(true);
    expect(workspace.hasTrackedPreviewCleanup()).toBe(false);
    expect(workspace.hasPreviewCleanupRoot()).toBe(false);
  });

  it("tracks active workspace mode and operational status", () => {
    const workspace = createShellWorkspace();

    expect(workspace.setWorkspaceMode("extract")).toEqual({
      activeMode: "extract",
      operationalStatus: "",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "",
        previewPath: "",
        entryPath: "",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });

    expect(workspace.setOperationalStatus("Ready")).toEqual({
      activeMode: "extract",
      operationalStatus: "Ready",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "",
        previewPath: "",
        entryPath: "",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });
  });

  it("tracks job drawer visibility as shell state", () => {
    const workspace = createShellWorkspace();

    expect(workspace.getSnapshot().jobDrawerOpen).toBe(false);
    expect(workspace.setJobDrawerOpen(true).jobDrawerOpen).toBe(true);
    expect(workspace.setJobDrawerOpen(false).jobDrawerOpen).toBe(false);
  });

  it("tracks quick-action shell window mode and shown state", () => {
    const workspace = createShellWorkspace();

    expect(workspace.isQuickActionJobMode()).toBe(false);
    expect(workspace.isQuickActionWindowBackgrounded()).toBe(false);

    let snapshot = workspace.setQuickActionWindowMode("jobOnly");
    expect(snapshot.quickActionWindow).toEqual({
      mode: "jobOnly",
      shown: false,
    });
    expect(workspace.isQuickActionJobMode()).toBe(true);

    snapshot = workspace.setQuickActionWindowShown(true);
    expect(snapshot.quickActionWindow).toEqual({
      mode: "jobOnly",
      shown: true,
    });

    snapshot = workspace.setQuickActionWindowMode("background");
    expect(snapshot.quickActionWindow).toEqual({
      mode: "background",
      shown: true,
    });
    expect(workspace.isQuickActionWindowBackgrounded()).toBe(true);

    snapshot = workspace.setQuickActionWindowMode("normal");
    expect(snapshot.quickActionWindow).toEqual({
      mode: "normal",
      shown: true,
    });
    expect(workspace.isQuickActionJobMode()).toBe(false);
  });

  it("selects compact job window for startup quick actions that immediately track jobs", () => {
    const workspace = createShellWorkspace();

    expect(
      workspace.selectQuickActionStartupRevealTarget({
        launchedForQuickAction: true,
        quickActionJobs: [{ jobId: "job-1", kind: "zipExtract", status: "queued", createdAt: "2026-07-08T00:00:00Z" }],
      }),
    ).toBe("jobOnly");
  });

  it("selects compact job window for startup quick actions that launch job-only requests", () => {
    const workspace = createShellWorkspace();

    expect(
      workspace.selectQuickActionStartupRevealTarget({
        launchedForQuickAction: true,
        quickAction: {
          kind: "extractHere",
          paths: ["C:/archives/app.zip"],
        },
      }),
    ).toBe("jobOnly");
  });

  it("selects normal window for non-job startup, errors, or review quick actions", () => {
    const workspace = createShellWorkspace();

    expect(
      workspace.selectQuickActionStartupRevealTarget({
        launchedForQuickAction: false,
      }),
    ).toBe("normal");
    expect(
      workspace.selectQuickActionStartupRevealTarget({
        launchedForQuickAction: true,
        error: {
          code: "startup_failed",
          message: "Could not read startup state.",
        },
        quickActionJobs: [{ jobId: "job-1", kind: "zipExtract", status: "queued", createdAt: "2026-07-08T00:00:00Z" }],
      }),
    ).toBe("normal");
    expect(
      workspace.selectQuickActionStartupRevealTarget({
        launchedForQuickAction: true,
        quickAction: {
          kind: "open",
          paths: ["C:/archives/app.zip"],
        },
      }),
    ).toBe("normal");
  });

  it("tracks and clears preview result metadata", () => {
    const workspace = createShellWorkspace();

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "C:/tmp/zmanager-preview",
      previewPath: "C:/tmp/zmanager-preview/readme.txt",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.getSnapshot()).toEqual({
      activeMode: "compress",
      operationalStatus: "",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "C:/tmp/zmanager-preview",
        previewPath: "C:/tmp/zmanager-preview/readme.txt",
        entryPath: "docs/readme.txt",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });

    workspace.clearTrackedPreview();

    expect(workspace.getSnapshot()).toEqual({
      activeMode: "compress",
      operationalStatus: "",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "",
        previewPath: "",
        entryPath: "",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });
  });

  it("tracks active drop overlay copy as immutable plain data", () => {
    const workspace = createShellWorkspace();
    const snapshot = workspace.setDropOverlay("active", {
      titleKey: "drop.addSources.title",
      messageKey: "drop.addSources.copyMessage",
      supportKey: "drop.browserPreview",
      target: "compress",
    });

    expect(snapshot.dropOverlay).toEqual({
      mode: "active",
      copy: {
        titleKey: "drop.addSources.title",
        messageKey: "drop.addSources.copyMessage",
        supportKey: "drop.browserPreview",
        target: "compress",
      },
      pendingChoice: null,
    });
    expect(Object.isFrozen(snapshot.dropOverlay)).toBe(true);
    expect(Object.isFrozen(snapshot.dropOverlay.copy)).toBe(true);
    expect(Object.isFrozen(snapshot.quickActionWindow)).toBe(true);
    expect(Object.getPrototypeOf(snapshot.dropOverlay.copy)).toBe(Object.prototype);
  });

  it("tracks choosing drop overlay with a pending ask-action decision", () => {
    const workspace = createShellWorkspace();
    const choice = {
      kind: "askAction" as const,
      surface: "browse" as const,
      archivePaths: ["C:/archives/app.zip"],
      sourcePaths: ["C:/work/readme.txt"],
    };

    const snapshot = workspace.setDropOverlayChoice(choice, {
      titleKey: "drop.chooseMode.title",
      messageKey: "drop.chooseMode.mixedMessage",
      messageParams: {
        archiveCount: 1,
        sourceCount: 1,
      },
      target: "choose",
      showActions: true,
    });

    expect(snapshot.dropOverlay).toEqual({
      mode: "choosing",
      copy: {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: 1,
          sourceCount: 1,
        },
        target: "choose",
        showActions: true,
      },
      pendingChoice: choice,
    });
    expect(Object.isFrozen(snapshot.dropOverlay.pendingChoice)).toBe(true);
    expect(Object.isFrozen(snapshot.dropOverlay.pendingChoice?.archivePaths)).toBe(true);
    expect(Object.isFrozen(snapshot.dropOverlay.pendingChoice?.sourcePaths)).toBe(true);
    expect(Object.isFrozen(snapshot.dropOverlay.copy?.messageParams)).toBe(true);
    expect(Object.getPrototypeOf(snapshot.dropOverlay.pendingChoice)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.dropOverlay.pendingChoice?.archivePaths)).toBe(Array.prototype);
  });

  it("keeps drop overlay copy language-neutral and detached from caller params", () => {
    const workspace = createShellWorkspace();
    const params = {
      archiveName: "app.zip",
    };

    const snapshot = workspace.setDropOverlay("active", {
      titleKey: "drop.openArchive.title",
      messageKey: "drop.openArchive.actionMessage",
      messageParams: params,
      supportKey: "drop.browserPreview",
      target: "extract",
    });
    params.archiveName = "mutated.zip";

    expect(snapshot.dropOverlay.copy).toEqual({
      titleKey: "drop.openArchive.title",
      messageKey: "drop.openArchive.actionMessage",
      messageParams: {
        archiveName: "app.zip",
      },
      supportKey: "drop.browserPreview",
      target: "extract",
    });
    expect(workspace.getSnapshot().dropOverlay.copy?.messageParams).toEqual({
      archiveName: "app.zip",
    });
  });

  it("clears pending drop choice when the overlay returns to idle", () => {
    const workspace = createShellWorkspace();

    workspace.setDropOverlayChoice(
      {
        kind: "askAction",
        surface: "browse",
        archivePaths: ["C:/archives/app.zip"],
        sourcePaths: ["C:/work/readme.txt"],
      },
      {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: 1,
          sourceCount: 1,
        },
        target: "choose",
        showActions: true,
      },
    );

    expect(workspace.clearDropOverlay().dropOverlay).toEqual({
      mode: "idle",
      copy: null,
      pendingChoice: null,
    });
  });

  it("clears stale pending drop choice when replacing with active or blocked overlays", () => {
    const workspace = createShellWorkspace();

    workspace.setDropOverlayChoice(
      {
        kind: "askAction",
        surface: "browse",
        archivePaths: ["C:/archives/app.zip"],
        sourcePaths: ["C:/work/readme.txt"],
      },
      {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: 1,
          sourceCount: 1,
        },
        target: "choose",
        showActions: true,
      },
    );

    expect(
      workspace.setDropOverlay("active", {
        titleKey: "drop.openArchive.title",
        messageKey: "drop.openArchive.message",
        target: "extract",
      }).dropOverlay.pendingChoice,
    ).toBeNull();

    workspace.setDropOverlayChoice(
      {
        kind: "askAction",
        surface: "browse",
        archivePaths: ["C:/archives/app.zip"],
        sourcePaths: ["C:/work/readme.txt"],
      },
      {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: 1,
          sourceCount: 1,
        },
        target: "choose",
        showActions: true,
      },
    );

    expect(
      workspace.setDropOverlay("active", {
        titleKey: "drop.blocked.title",
        messageKey: "drop.blocked.message",
        target: "blocked",
      }).dropOverlay.pendingChoice,
    ).toBeNull();
  });

  it("reports cleanup availability when a cleanup root or preview path is tracked", () => {
    const workspace = createShellWorkspace();

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "",
      previewPath: "",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.hasTrackedPreviewCleanup()).toBe(false);
    expect(workspace.hasPreviewCleanupRoot()).toBe(false);

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "C:/tmp/zmanager-preview",
      previewPath: "",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.hasTrackedPreviewCleanup()).toBe(true);
    expect(workspace.hasPreviewCleanupRoot()).toBe(true);

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "",
      previewPath: "C:/tmp/zmanager-preview/readme.txt",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.hasTrackedPreviewCleanup()).toBe(true);
    expect(workspace.hasPreviewCleanupRoot()).toBe(false);
  });

  it("returns the cached preview path only when the entry path matches", () => {
    const workspace = createShellWorkspace();

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "C:/tmp/zmanager-preview",
      previewPath: "C:/tmp/zmanager-preview/readme.txt",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.getCachedPreviewPathForEntry("docs/readme.txt")).toBe("C:/tmp/zmanager-preview/readme.txt");
    expect(workspace.getCachedPreviewPathForEntry("docs/other.txt")).toBeNull();
  });

  it("does not match cached previews without a preview path", () => {
    const workspace = createShellWorkspace();

    workspace.trackPreviewResultMetadata({
      cleanupRoot: "C:/tmp/zmanager-preview",
      previewPath: "",
      entryPath: "docs/readme.txt",
    });

    expect(workspace.getCachedPreviewPathForEntry("docs/readme.txt")).toBeNull();
  });

  it("returns plain serializable snapshots", () => {
    const workspace = createShellWorkspace();
    workspace.setWorkspaceMode("extract");
    workspace.setOperationalStatus("Ready");
    workspace.trackPreviewResultMetadata({
      cleanupRoot: "C:/tmp/zmanager-preview",
      previewPath: "C:/tmp/zmanager-preview/readme.txt",
      entryPath: "docs/readme.txt",
    });

    const snapshot = workspace.getSnapshot();

    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.dropOverlay)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.previewCleanup)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.quickActionWindow)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot).toEqual({
      activeMode: "extract",
      operationalStatus: "Ready",
      jobDrawerOpen: false,
      dropOverlay: {
        mode: "idle",
        copy: null,
        pendingChoice: null,
      },
      previewCleanup: {
        cleanupRoot: "C:/tmp/zmanager-preview",
        previewPath: "C:/tmp/zmanager-preview/readme.txt",
        entryPath: "docs/readme.txt",
      },
      quickActionWindow: {
        mode: "normal",
        shown: false,
      },
    });
  });
});
