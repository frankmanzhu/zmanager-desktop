import { describe, expect, it, vi } from "vitest";

import type {
  ArchiveEntryDto,
  ArchiveListingDto,
  CommandErrorDto,
  PreviewEntryResponse,
} from "../../api/types";
import { createArchiveWorkspace, type ArchiveWorkspace } from "../workspaces/archiveWorkspace";
import {
  createArchivePreviewController,
  type ArchivePreviewControllerOptions,
  type ArchivePreviewResultMetadata,
} from "./archivePreviewController";

const entries: ArchiveEntryDto[] = [
  { path: "docs", kind: "directory" },
  { path: "docs/readme.txt", kind: "file", size: 12 },
  { path: "src/main.rs", kind: "file", size: 20 },
];

function archiveListing(): ArchiveListingDto {
  return {
    archivePath: "C:/archives/demo.zip",
    entryCount: entries.length,
    totalSize: 32,
    entries,
  };
}

function previewResponse(overrides: Partial<PreviewEntryResponse> = {}): PreviewEntryResponse {
  return {
    previewPath: "C:/preview/readme.txt",
    cleanupRoot: "C:/preview",
    writtenBytes: 12,
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "Could not preview",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function selectPaths(workspace: ArchiveWorkspace, paths: readonly string[]): void {
  workspace.updateSelection({
    selectedPaths: new Set(paths),
    focusedPath: paths[0] ?? "",
    anchorPath: paths[0] ?? "",
  });
}

function createHarness(overrides: Partial<ArchivePreviewControllerOptions> = {}) {
  const workspace = createArchiveWorkspace();
  workspace.loadSucceeded(archiveListing());
  selectPaths(workspace, ["docs/readme.txt"]);

  const calls = {
    cleanup: 0,
    clearTracked: 0,
    singleFileRequired: 0,
    loaded: [] as string[],
    errors: [] as string[],
    prompts: [] as string[],
    tracked: [] as ArchivePreviewResultMetadata[],
    openedPaths: [] as string[],
    order: [] as string[],
  };
  let password = "initial";
  let cachedPreviewPath: string | null = null;
  let currentArchivePath: string | null = workspace.getSnapshot().currentArchivePath;
  const runPreviewEntry = vi.fn(async () => previewResponse());
  const openPath = vi.fn(async (path: string) => {
    calls.openedPaths.push(path);
  });

  const controller = createArchivePreviewController({
    workspace,
    hasCurrentArchive() {
      return Boolean(currentArchivePath);
    },
    isCurrentArchive(archivePath) {
      return currentArchivePath === archivePath;
    },
    async cleanupBeforePreview() {
      calls.cleanup += 1;
      calls.order.push("cleanup");
    },
    previewRequestInput(nextPassword) {
      return {
        overwrite: "replace",
        stripComponents: 1,
        password: nextPassword ?? (password.trim() || undefined),
      };
    },
    cachedPreviewPathForEntry() {
      return cachedPreviewPath;
    },
    runPreviewEntry,
    openPath,
    clearTrackedPreviewState() {
      calls.clearTracked += 1;
      calls.order.push("clearTracked");
      cachedPreviewPath = null;
    },
    trackPreviewResult(metadata) {
      calls.tracked.push(metadata);
    },
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    promptForPasswordRetry(retry) {
      calls.prompts.push(retry.promptKey);
      return "secret";
    },
    singleFileRequired() {
      calls.singleFileRequired += 1;
    },
    previewUnableMessage() {
      return "Unable to preview.";
    },
    cachedOpenedMessage() {
      return "Opened cached.";
    },
    openedOutsideMessage(size) {
      return `Opened outside ${size}.`;
    },
    previewReadyMessage(size) {
      return `Preview ready ${size}.`;
    },
    setBrowseLoaded(message) {
      calls.loaded.push(message);
    },
    setBrowseError(message) {
      calls.errors.push(message);
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    openPath,
    runPreviewEntry,
    setCachedPreviewPath(path: string | null) {
      cachedPreviewPath = path;
    },
    setInitialPassword(value: string) {
      password = value;
    },
    setCurrentArchivePath(path: string | null) {
      currentArchivePath = path;
    },
    workspace,
  };
}

describe("archive preview controller", () => {
  it("generates, opens, tracks, and reports an inline preview", async () => {
    const harness = createHarness();
    harness.setInitialPassword("  initial  ");
    harness.runPreviewEntry.mockResolvedValueOnce(previewResponse({ writtenBytes: 99 }));

    await harness.controller.previewSelectedEntry("preview");

    expect(harness.calls.cleanup).toBe(1);
    expect(harness.runPreviewEntry).toHaveBeenCalledWith({
      archivePath: "C:/archives/demo.zip",
      entryPath: "docs/readme.txt",
      overwrite: "replace",
      stripComponents: 1,
      password: "initial",
    });
    expect(harness.calls.openedPaths).toEqual(["C:/preview/readme.txt"]);
    expect(harness.calls.tracked).toEqual([{
      cleanupRoot: "C:/preview",
      previewPath: "C:/preview/readme.txt",
      entryPath: "docs/readme.txt",
    }]);
    expect(harness.calls.loaded).toEqual(["Preview ready 99."]);
  });

  it("opens cached previews for open-outside without regenerating", async () => {
    const harness = createHarness();
    harness.setCachedPreviewPath("C:/preview/cached.txt");

    await harness.controller.previewSelectedEntry("openOutside");

    expect(harness.calls.cleanup).toBe(0);
    expect(harness.calls.openedPaths).toEqual(["C:/preview/cached.txt"]);
    expect(harness.runPreviewEntry).not.toHaveBeenCalled();
    expect(harness.calls.loaded).toEqual(["Opened cached."]);
  });

  it("clears stale cached previews and regenerates when cached open fails", async () => {
    const harness = createHarness();
    harness.setCachedPreviewPath("C:/preview/stale.txt");
    harness.openPath
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce(undefined);

    await harness.controller.previewSelectedEntry("openOutside");

    expect(harness.calls.clearTracked).toBe(1);
    expect(harness.calls.order).toEqual(["cleanup", "clearTracked"]);
    expect(harness.runPreviewEntry).toHaveBeenCalledTimes(1);
    expect(harness.openPath).toHaveBeenNthCalledWith(1, "C:/preview/stale.txt");
    expect(harness.openPath).toHaveBeenNthCalledWith(2, "C:/preview/readme.txt");
    expect(harness.calls.loaded).toEqual(["Opened outside 12."]);
  });

  it("ignores generated preview results when the current archive changes", async () => {
    const pending = deferred<PreviewEntryResponse>();
    const harness = createHarness({
      runPreviewEntry: vi.fn(() => pending.promise),
    });

    const preview = harness.controller.previewSelectedEntry("preview");
    harness.setCurrentArchivePath("C:/archives/other.zip");
    pending.resolve(previewResponse());
    await preview;

    expect(harness.openPath).not.toHaveBeenCalled();
    expect(harness.calls.tracked).toEqual([]);
    expect(harness.calls.loaded).toEqual([]);
    expect(harness.calls.errors).toEqual([]);
  });

  it("tracks generated preview metadata before reporting opener failures", async () => {
    const harness = createHarness();
    harness.openPath.mockRejectedValueOnce(new Error("cannot open"));

    await harness.controller.previewSelectedEntry("preview");

    expect(harness.calls.tracked).toEqual([{
      cleanupRoot: "C:/preview",
      previewPath: "C:/preview/readme.txt",
      entryPath: "docs/readme.txt",
    }]);
    expect(harness.calls.errors).toEqual(["Unable to preview."]);
  });

  it("retries password errors with a prompted password and operation per mode", async () => {
    const harness = createHarness();
    harness.runPreviewEntry
      .mockRejectedValueOnce(commandError({ code: "invalid_password", message: "Invalid password" }))
      .mockResolvedValueOnce(previewResponse());

    await harness.controller.previewSelectedEntry("openOutside");

    expect(harness.calls.prompts).toEqual(["browse.passwordInvalid"]);
    expect(harness.runPreviewEntry).toHaveBeenNthCalledWith(2, {
      archivePath: "C:/archives/demo.zip",
      entryPath: "docs/readme.txt",
      overwrite: "replace",
      stripComponents: 1,
      password: "secret",
    });
    expect(harness.calls.loaded).toEqual(["Opened outside 12."]);
  });

  it("reports command message when password retry is cancelled", async () => {
    const harness = createHarness({
      promptForPasswordRetry: () => null,
    });
    harness.runPreviewEntry.mockRejectedValueOnce(commandError({
      code: "password_required",
      message: "Password required",
    }));

    await harness.controller.previewSelectedEntry("preview");

    expect(harness.calls.errors).toEqual(["Password required"]);
    expect(harness.calls.loaded).toEqual([]);
  });

  it("reports single-file requirement when preview request is unavailable", async () => {
    const harness = createHarness();
    selectPaths(harness.workspace, ["docs/readme.txt", "src/main.rs"]);

    await harness.controller.previewSelectedEntry("preview");

    expect(harness.calls.singleFileRequired).toBe(1);
    expect(harness.runPreviewEntry).not.toHaveBeenCalled();
  });

  it("reports fallback preview errors for unknown failures", async () => {
    const harness = createHarness();
    harness.runPreviewEntry.mockRejectedValueOnce(new Error("boom"));

    await harness.controller.previewSelectedEntry("preview");

    expect(harness.calls.errors).toEqual(["Unable to preview."]);
  });
});
