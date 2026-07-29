import { describe, expect, it, vi } from "vitest";

import type { ArchiveListingDto, CommandErrorDto, StartJobResponseDto } from "../../api/types";
import { createArchiveWorkspace } from "../workspaces/archiveWorkspace";
import { createMainWindowSubmissionGuard } from "../mainWindowSubmissionGuard";
import { createArchiveTestController, type ArchiveTestControllerOptions } from "./archiveTestController";

const startedAt = "2026-06-11T00:00:00Z";

function archiveListing(): ArchiveListingDto {
  return {
    archivePath: "C:/archives/demo.zip",
    entryCount: 2,
    totalSize: 24,
    entries: [
      { path: "readme.txt", kind: "file", size: 12 },
      { path: "docs/guide.txt", kind: "file", size: 12 },
    ],
  };
}

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "job-1",
    kind: "testArchive",
    status: "queued",
    createdAt: startedAt,
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "Could not test",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function createHarness(overrides: Partial<ArchiveTestControllerOptions> = {}) {
  const workspace = createArchiveWorkspace();
  workspace.loadSucceeded(archiveListing());
  const calls = {
    jobs: [] as unknown[],
    prompts: [] as string[],
    errors: [] as string[],
  };
  let password = "initial";
  const runTestArchive = vi.fn(async () => startJobResponse());

  const controller = createArchiveTestController({
    workspace,
    submissionGuard: createMainWindowSubmissionGuard(),
    hasCurrentArchive() {
      return Boolean(workspace.getSnapshot().currentArchivePath);
    },
    initialPassword() {
      return password.trim() || undefined;
    },
    runTestArchive,
    async handoffAcceptedJob(response, resetSubmittedState) {
      calls.jobs.push(response);
      resetSubmittedState();
    },
    resetSubmittedState() {
      workspace.resetAfterAcceptedOperation();
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
    unableStartMessage() {
      return "Unable to start test.";
    },
    setBrowseError(message) {
      calls.errors.push(message);
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    runTestArchive,
    setInitialPassword(value: string) {
      password = value;
    },
    workspace,
  };
}

describe("archive test controller", () => {
  it("hands an accepted test job to its disposable task", async () => {
    const harness = createHarness();
    harness.workspace.updateSelection({
      selectedPaths: new Set(["readme.txt"]),
      focusedPath: "readme.txt",
      anchorPath: "readme.txt",
    });
    harness.setInitialPassword("  initial  ");
    harness.runTestArchive.mockResolvedValueOnce(startJobResponse({ jobId: "test-job" }));

    await harness.controller.testArchive();

    expect(harness.runTestArchive).toHaveBeenCalledWith({
      archivePath: "C:/archives/demo.zip",
      entryPaths: ["readme.txt"],
      password: "initial",
    });
    expect(harness.calls.jobs).toEqual([
      startJobResponse({ jobId: "test-job" }),
    ]);
    expect(harness.calls.errors).toEqual([]);
    expect(harness.workspace.getSnapshot().view.selection.selectedPaths).toEqual([]);
  });

  it("retries password errors with a prompted password", async () => {
    const harness = createHarness();
    harness.runTestArchive
      .mockRejectedValueOnce(commandError({ code: "password_required", message: "Password required" }))
      .mockResolvedValueOnce(startJobResponse());

    await harness.controller.testArchive();

    expect(harness.calls.prompts).toEqual(["browse.passwordRequired"]);
    expect(harness.runTestArchive).toHaveBeenNthCalledWith(1, {
      archivePath: "C:/archives/demo.zip",
      password: "initial",
    });
    expect(harness.runTestArchive).toHaveBeenNthCalledWith(2, {
      archivePath: "C:/archives/demo.zip",
      password: "secret",
    });
    expect(harness.calls.jobs).toHaveLength(1);
  });

  it("clears retry state and reports command message when password retry is cancelled", async () => {
    const harness = createHarness({
      promptForPasswordRetry: () => null,
    });
    harness.runTestArchive.mockRejectedValueOnce(commandError({
      code: "invalid_password",
      message: "Invalid password",
      hint: "Try again.",
    }));

    await harness.controller.testArchive();

    expect(harness.calls.errors).toEqual(["Invalid password"]);
    expect(harness.calls.jobs).toEqual([]);
  });

  it("reports non-password command errors with hints", async () => {
    const harness = createHarness();
    harness.runTestArchive.mockRejectedValueOnce(commandError({
      code: "bad_archive",
      message: "Bad archive",
      hint: "Try another file.",
    }));

    await harness.controller.testArchive();

    expect(harness.calls.errors).toEqual(["Bad archive\nTry another file."]);
    expect(harness.calls.jobs).toEqual([]);
  });

  it("reports the generic message for unknown errors", async () => {
    const harness = createHarness();
    harness.runTestArchive.mockRejectedValueOnce(new Error("boom"));

    await harness.controller.testArchive();

    expect(harness.calls.errors).toEqual(["Unable to start test."]);
  });

  it("does nothing when no archive is current", async () => {
    const harness = createHarness({
      hasCurrentArchive: () => false,
    });

    await harness.controller.testArchive();

    expect(harness.runTestArchive).not.toHaveBeenCalled();
    expect(harness.calls.jobs).toEqual([]);
    expect(harness.calls.errors).toEqual([]);
  });

  it("guards only the test request awaiting Rust acceptance", async () => {
    let acceptFirst: (job: StartJobResponseDto) => void = () => {
      throw new Error("first test was not started");
    };
    const firstAcceptance = new Promise<StartJobResponseDto>((resolve) => {
      acceptFirst = resolve;
    });
    const runTestArchive = vi.fn()
      .mockImplementationOnce(() => firstAcceptance)
      .mockResolvedValueOnce(startJobResponse({ jobId: "test-job-2" }));
    const harness = createHarness({ runTestArchive });

    const first = harness.controller.testArchive();
    const duplicate = harness.controller.testArchive();
    expect(runTestArchive).toHaveBeenCalledTimes(1);

    acceptFirst(startJobResponse({ jobId: "test-job-1" }));
    await Promise.all([first, duplicate]);
    await harness.controller.testArchive();

    expect(runTestArchive).toHaveBeenCalledTimes(2);
  });
});
