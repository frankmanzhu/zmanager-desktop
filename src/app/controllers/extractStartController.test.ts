import { describe, expect, it, vi } from "vitest";

import type {
  ArchiveEntryDto,
  ArchiveListingDto,
  CommandErrorDto,
  StartExtractRequest,
  StartJobResponseDto,
} from "../../api/types";
import type { ExtractMode } from "../extractFlow";
import { createArchiveWorkspace, type ArchiveWorkspace } from "../workspaces/archiveWorkspace";
import {
  createExtractStartController,
  type ExtractStartControllerOptions,
  type ExtractStartInput,
} from "./extractStartController";

const startedAt = "2026-06-11T00:00:00Z";

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

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "extract-job",
    kind: "zipExtract",
    status: "queued",
    createdAt: startedAt,
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "Could not extract",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function selectPaths(workspace: ArchiveWorkspace, paths: readonly string[]): void {
  workspace.updateSelection({
    selectedPaths: new Set(paths),
    focusedPath: paths[0] ?? "",
    anchorPath: paths[0] ?? "",
  });
}

function createHarness(overrides: Partial<ExtractStartControllerOptions> = {}) {
  const workspace = createArchiveWorkspace();
  workspace.loadSucceeded(archiveListing());
  const calls = {
    chooseDestinationFirst: 0,
    selectEntryFirst: 0,
    recordDestination: [] as string[],
    closeDialog: 0,
    jobs: [] as unknown[],
    retries: [] as string[],
    errors: [] as string[],
  };
  const defaultInput: ExtractStartInput = {
    destination: "C:/out/demo",
    destinationValid: true,
    overwrite: "ask" as StartExtractRequest["overwrite"],
    stripComponents: 1,
    password: undefined as string | undefined,
    entryReferences: [] as string[],
  };
  const startExtract = vi.fn(async () => startJobResponse());

  const controller = createExtractStartController({
    workspace,
    hasCurrentArchive() {
      return Boolean(workspace.getSnapshot().currentArchivePath);
    },
    startExtract,
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    requestPasswordInDialog(retry) {
      calls.retries.push(retry.promptKey);
    },
    chooseDestinationFirst() {
      calls.chooseDestinationFirst += 1;
    },
    selectEntryFirst() {
      calls.selectEntryFirst += 1;
    },
    recordDestination(destination) {
      calls.recordDestination.push(destination);
    },
    closeExtractDialog() {
      calls.closeDialog += 1;
    },
    addJob(response, options) {
      calls.jobs.push({ response, options });
    },
    progressContext(request, mode) {
      return {
        kind: "extract",
        title: mode === "selection" ? "selection" : "archive",
        archivePath: request.archivePath,
        destinationPath: request.destinationPath,
        overwrite: request.overwrite,
        entryPaths: request.entryPaths,
      };
    },
    outputActions(request) {
      return [{ kind: "open", path: request.destinationPath }];
    },
    unableStartMessage(mode) {
      return mode === "selection" ? "Unable to extract selection." : "Unable to extract archive.";
    },
    setBrowseError(message) {
      calls.errors.push(message);
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    start(mode: ExtractMode, next: Partial<ExtractStartInput> = {}) {
      return controller.startExtract(mode, { ...defaultInput, ...next });
    },
    startExtract,
    workspace,
  };
}

describe("extract start controller", () => {
  it("starts archive extraction and records job metadata", async () => {
    const harness = createHarness();

    await harness.start("archive");

    expect(harness.startExtract).toHaveBeenCalledWith({
      archivePath: "C:/archives/demo.zip",
      destinationPath: "C:/out/demo",
      overwrite: "ask",
      stripComponents: 1,
    });
    expect(harness.calls.recordDestination).toEqual(["C:/out/demo"]);
    expect(harness.calls.closeDialog).toBe(1);
    expect(harness.calls.jobs).toHaveLength(1);
    expect(harness.calls.jobs[0]).toMatchObject({
      response: startJobResponse(),
      options: {
        retryContext: {
          retryKind: "extractArchive",
          archivePath: "C:/archives/demo.zip",
          destinationPath: "C:/out/demo",
          overwrite: "ask",
          stripComponents: 1,
        },
        focusProgress: true,
        autoCloseAction: "returnToWorkspace",
      },
    });
  });

  it("starts selection extraction with selected entry paths", async () => {
    const harness = createHarness();
    selectPaths(harness.workspace, ["docs/readme.txt"]);

    await harness.start("selection", { entryReferences: ["docs/readme.txt"] });

    expect(harness.startExtract).toHaveBeenCalledWith({
      archivePath: "C:/archives/demo.zip",
      destinationPath: "C:/out/demo",
      overwrite: "ask",
      stripComponents: 1,
      entryPaths: ["docs/readme.txt"],
    });
    expect(harness.calls.jobs[0]).toMatchObject({
      options: {
        retryContext: {
          entryPaths: ["docs/readme.txt"],
        },
        progressContext: {
          title: "selection",
          entryPaths: ["docs/readme.txt"],
        },
      },
    });
  });

  it("prompts for a destination before building requests", async () => {
    const harness = createHarness();

    await harness.start("archive", { destination: null, destinationValid: false });

    expect(harness.calls.chooseDestinationFirst).toBe(1);
    expect(harness.startExtract).not.toHaveBeenCalled();
  });

  it("prompts for selection before building selection requests", async () => {
    const harness = createHarness();

    await harness.start("selection");

    expect(harness.calls.selectEntryFirst).toBe(1);
    expect(harness.startExtract).not.toHaveBeenCalled();
  });

  it("routes password errors to the dialog retry prompt", async () => {
    const harness = createHarness();
    harness.startExtract.mockRejectedValueOnce(commandError({
      code: "password_required",
      message: "Password required",
    }));

    await harness.start("archive");

    expect(harness.calls.retries).toEqual(["browse.passwordRequired"]);
    expect(harness.calls.errors).toEqual([]);
  });

  it("reports command and unknown failures with mode-specific fallbacks", async () => {
    const commandHarness = createHarness();
    commandHarness.startExtract.mockRejectedValueOnce(commandError({ message: "Disk full" }));

    await commandHarness.start("archive");

    expect(commandHarness.calls.errors).toEqual(["Disk full"]);

    const unknownHarness = createHarness();
    selectPaths(unknownHarness.workspace, ["docs/readme.txt"]);
    unknownHarness.startExtract.mockRejectedValueOnce(new Error("boom"));

    await unknownHarness.start("selection", { entryReferences: ["docs/readme.txt"] });

    expect(unknownHarness.calls.errors).toEqual(["Unable to extract selection."]);
  });
});
