import { describe, expect, it, vi } from "vitest";

import type { ArchiveListingDto, CommandErrorDto } from "../../api/types";
import { createArchiveWorkspace, type ArchiveWorkspaceSnapshot } from "../workspaces/archiveWorkspace";
import { createArchiveLoadController, type ArchiveLoadControllerOptions } from "./archiveLoadController";

function listing(overrides: Partial<ArchiveListingDto> = {}): ArchiveListingDto {
  return {
    archivePath: "C:/archives/demo.zip",
    entryCount: 1,
    totalSize: 12,
    entries: [{
      path: "readme.txt",
      kind: "file",
      size: 12,
    }],
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "List failed",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function createHarness(overrides: Partial<ArchiveLoadControllerOptions> = {}) {
  const workspace = createArchiveWorkspace();
  const calls = {
    enterExtractWorkspace: 0,
    loadingSnapshots: [] as ArchiveWorkspaceSnapshot[],
    acceptedListings: [] as ArchiveListingDto[],
    acceptedOptions: [] as { preserveState: boolean }[],
    errorSnapshots: [] as ArchiveWorkspaceSnapshot[],
    errorMessages: [] as string[],
    prompts: [] as string[],
  };
  const listArchive = vi.fn(async () => listing());

  const controller = createArchiveLoadController({
    workspace,
    enterExtractWorkspace() {
      calls.enterExtractWorkspace += 1;
    },
    listArchive,
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    renderLoading(snapshot) {
      calls.loadingSnapshots.push(snapshot);
    },
    acceptListing(acceptedListing, options) {
      calls.acceptedListings.push(acceptedListing);
      calls.acceptedOptions.push(options);
      workspace.loadSucceeded(acceptedListing, {
        preserveState: options.preserveState ? false : false,
      });
    },
    renderLoadError(snapshot, message) {
      calls.errorSnapshots.push(snapshot);
      calls.errorMessages.push(message);
    },
    failedListMessage() {
      return "Could not list archive.";
    },
    loadErrorMessage(error, options) {
      return options.includeHint && error.hint ? `${error.message}\n${error.hint}` : error.message;
    },
    promptForPasswordRetry(retry) {
      calls.prompts.push(retry.promptKey);
      return "secret";
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    listArchive,
    workspace,
  };
}

describe("archive load controller", () => {
  it("renders loading, lists the archive, and accepts the listing", async () => {
    const harness = createHarness();
    harness.listArchive.mockResolvedValueOnce(listing({ entryCount: 2 }));

    await harness.controller.loadArchive({
      archivePath: "C:/archives/demo.zip",
      password: "  initial  ",
    }, {
      preserveState: true,
    });

    expect(harness.calls.enterExtractWorkspace).toBe(1);
    expect(harness.calls.loadingSnapshots).toHaveLength(1);
    expect(harness.calls.loadingSnapshots[0].browseState).toBe("loading");
    expect(harness.listArchive).toHaveBeenCalledWith({
      archivePath: "C:/archives/demo.zip",
      password: "initial",
    });
    expect(harness.calls.acceptedListings).toEqual([listing({ entryCount: 2 })]);
    expect(harness.calls.acceptedOptions).toEqual([{ preserveState: true }]);
    expect(harness.calls.errorMessages).toEqual([]);
  });

  it("retries password errors with a prompted password", async () => {
    const harness = createHarness();
    harness.listArchive
      .mockRejectedValueOnce(commandError({ code: "password_required", message: "Password required" }))
      .mockResolvedValueOnce(listing());

    await harness.controller.loadArchive({
      archivePath: "C:/archives/demo.zip",
    });

    expect(harness.calls.loadingSnapshots).toHaveLength(2);
    expect(harness.calls.prompts).toEqual(["browse.passwordRequired"]);
    expect(harness.listArchive).toHaveBeenNthCalledWith(1, {
      archivePath: "C:/archives/demo.zip",
    });
    expect(harness.listArchive).toHaveBeenNthCalledWith(2, {
      archivePath: "C:/archives/demo.zip",
      password: "secret",
    });
    expect(harness.calls.acceptedListings).toHaveLength(1);
  });

  it("renders command errors with hints when no retry is available", async () => {
    const harness = createHarness();
    harness.listArchive.mockRejectedValueOnce(commandError({
      code: "bad_archive",
      message: "Bad archive",
      hint: "Try another file.",
    }));

    await harness.controller.loadArchive({
      archivePath: "C:/archives/demo.zip",
    });

    expect(harness.calls.errorSnapshots).toHaveLength(1);
    expect(harness.calls.errorSnapshots[0].browseState).toBe("error");
    expect(harness.calls.errorMessages).toEqual(["Bad archive\nTry another file."]);
    expect(harness.calls.acceptedListings).toEqual([]);
  });

  it("renders command message without hint when a retry is cancelled", async () => {
    const harness = createHarness({
      promptForPasswordRetry: () => null,
    });
    harness.listArchive.mockRejectedValueOnce(commandError({
      code: "invalid_password",
      message: "Invalid password",
      hint: "Try again.",
    }));

    await harness.controller.loadArchive({
      archivePath: "C:/archives/demo.zip",
    });

    expect(harness.calls.errorMessages).toEqual(["Invalid password"]);
    expect(harness.calls.acceptedListings).toEqual([]);
  });

  it("renders the generic failure message for unknown errors", async () => {
    const harness = createHarness();
    harness.listArchive.mockRejectedValueOnce(new Error("boom"));

    await harness.controller.loadArchive({
      archivePath: "C:/archives/demo.zip",
    });

    expect(harness.calls.errorSnapshots).toHaveLength(1);
    expect(harness.calls.errorMessages).toEqual(["Could not list archive."]);
  });
});
