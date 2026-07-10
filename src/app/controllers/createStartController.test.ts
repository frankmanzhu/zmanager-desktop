import { describe, expect, it, vi } from "vitest";

import type { CommandErrorDto, CreatePlanResponse, StartCreateRequest, StartJobResponseDto } from "../../api/types";
import type { FormatCreateDefaults } from "../preferences";
import { createCreateWorkspace, type CreateWorkspaceSnapshot } from "../workspaces/createWorkspace";
import { createCreateStartController, type CreateStartControllerOptions } from "./createStartController";

const startedAt = "2026-06-11T00:00:00Z";

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

function startJobResponse(overrides: Partial<StartJobResponseDto> = {}): StartJobResponseDto {
  return {
    jobId: "create-job",
    kind: "zipCreate",
    status: "queued",
    createdAt: startedAt,
    ...overrides,
  };
}

function commandError(overrides: Partial<CommandErrorDto> = {}): CommandErrorDto {
  return {
    code: "failed",
    message: "Could not create",
    hint: null,
    severity: "error",
    retryable: false,
    ...overrides,
  };
}

function formatDefaults(overrides: Partial<FormatCreateDefaults> = {}): FormatCreateDefaults {
  return {
    cleanSource: true,
    compressionLevel: null,
    volumeSize: null,
    preserveMetadata: true,
    replaceExisting: false,
    promptForPassword: false,
    tzapRecoveryPercentage: null,
    ...overrides,
  };
}

function createReadyWorkspace() {
  const workspace = createCreateWorkspace();
  workspace.addSources(["C:/work/project"]);
  workspace.changeFormat("zip", formatDefaults());
  workspace.setDestinationPath("C:/out/project.zip");
  const started = workspace.beginPlan();
  expect(started.ready).toBe(true);
  if (!started.ready) {
    throw new Error("Expected plan request to be ready");
  }
  workspace.acceptPlanResult(started.revision, createPlan());
  return workspace;
}

function createHarness(overrides: Partial<CreateStartControllerOptions> = {}) {
  const workspace = createReadyWorkspace();
  const calls = {
    sync: 0,
    published: [] as CreateWorkspaceSnapshot[],
    started: [] as unknown[],
  };
  const startCreate = vi.fn(async () => startJobResponse());

  const controller = createCreateStartController({
    workspace,
    syncSources(snapshot = workspace.getSnapshot()) {
      calls.sync += 1;
      return snapshot;
    },
    isSubmissionInFlight() {
      return workspace.getSnapshot().options.submissionInFlight;
    },
    startCreate,
    onCreateStarted(response, request) {
      calls.started.push({ response, request });
    },
    toCommandError(error) {
      return error && typeof error === "object" && "code" in error
        ? error as CommandErrorDto
        : null;
    },
    publishSnapshot(snapshot) {
      calls.published.push(snapshot);
    },
    ...overrides,
  });

  return {
    calls,
    controller,
    runCreate(next: {
      destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
      password?: string;
      passwordConfirm?: string;
    } = {}) {
      return controller.runCreate({
        destinationCollisionStrategy: next.destinationCollisionStrategy,
        passwordInput: {
          password: next.password ?? "",
          passwordConfirm: next.passwordConfirm ?? next.password ?? "",
        },
      });
    },
    startCreate,
    workspace,
  };
}

describe("create start controller", () => {
  it("builds a request, starts create, and runs success effects", async () => {
    const harness = createHarness();
    harness.startCreate.mockResolvedValueOnce(startJobResponse({ jobId: "job-1" }));

    await harness.runCreate({
      destinationCollisionStrategy: "rename",
      password: " secret ",
      passwordConfirm: "secret",
    });

    expect(harness.startCreate).toHaveBeenCalledWith(expect.objectContaining({
      sources: ["C:/work/project"],
      destinationPath: "C:/out/project.zip",
      password: "secret",
      destinationCollisionStrategy: "rename",
    }));
    expect(harness.calls.started).toHaveLength(1);
    expect(harness.calls.started[0]).toMatchObject({
      response: startJobResponse({ jobId: "job-1" }),
      request: {
        destinationPath: "C:/out/project.zip",
      },
    });
    expect(harness.workspace.getSnapshot().options.submissionInFlight).toBe(false);
    expect(harness.calls.published).toHaveLength(3);
  });

  it("renders validation errors without starting create", async () => {
    const harness = createHarness();

    await harness.runCreate({ password: "one", passwordConfirm: "two" });

    expect(harness.startCreate).not.toHaveBeenCalled();
    expect(harness.workspace.getSnapshot().plan.status).toEqual({
      messageKey: "create.error.passwordMismatch",
    });
    expect(harness.calls.published).toHaveLength(1);
  });

  it("uses explicit submit passwords", async () => {
    const harness = createHarness();

    await harness.runCreate({ password: " react secret ", passwordConfirm: "react secret" });

    expect(harness.startCreate).toHaveBeenCalledWith(expect.objectContaining({
      password: "react secret",
    }));
  });

  it("maps API errors to plan errors and clears submission state", async () => {
    const harness = createHarness();
    harness.startCreate.mockRejectedValueOnce(commandError({ message: "Create failed" }));

    await harness.runCreate();

    expect(harness.workspace.getSnapshot().plan.status).toEqual({
      fallbackText: "Create failed",
    });
    expect(harness.workspace.getSnapshot().options.submissionInFlight).toBe(false);
    expect(harness.calls.published).toHaveLength(4);
  });

  it("uses generic create error text for unknown API failures", async () => {
    const harness = createHarness();
    harness.startCreate.mockRejectedValueOnce(new Error("boom"));

    await harness.runCreate();

    expect(harness.workspace.getSnapshot().plan.status).toEqual({
      messageKey: "create.error.unableStart",
    });
  });

  it("does nothing while a submission is already in flight", async () => {
    const harness = createHarness();
    harness.workspace.setSubmissionInFlight(true);

    await harness.runCreate();

    expect(harness.startCreate).not.toHaveBeenCalled();
    expect(harness.calls.sync).toBe(0);
    expect(harness.calls.published).toHaveLength(0);
  });

  it("does nothing when there are no sources", async () => {
    const emptyWorkspace = createCreateWorkspace();
    const harness = createHarness({
      workspace: emptyWorkspace,
      syncSources: () => emptyWorkspace.getSnapshot(),
      isSubmissionInFlight: () => false,
    });

    await harness.runCreate();

    expect(harness.startCreate).not.toHaveBeenCalled();
    expect(harness.calls.published).toHaveLength(0);
  });
});
