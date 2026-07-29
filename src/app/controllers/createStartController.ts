import type { CommandErrorDto, StartCreateRequest, StartJobResponseDto } from "../../api/types";
import type {
  CreateWorkspace,
  CreateWorkspaceSnapshot,
} from "../workspaces/createWorkspace";
import type { MainWindowSubmissionGuard } from "../mainWindowSubmissionGuard";

export type CreateStartOptions = Readonly<{
  destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
  passwordInput: Readonly<{
    password: string;
    passwordConfirm: string;
    signingIdentityPassword?: string;
  }>;
}>;

export type CreateStartControllerWorkspace = Pick<
  CreateWorkspace,
  "buildStartCreateRequest" | "getSnapshot" | "setPlanError" | "setSubmissionInFlight"
>;

export type CreateStartControllerOptions = Readonly<{
  workspace: CreateStartControllerWorkspace;
  submissionGuard: MainWindowSubmissionGuard;
  publishSnapshot(snapshot: CreateWorkspaceSnapshot): CreateWorkspaceSnapshot;
  startCreate(request: StartCreateRequest): Promise<StartJobResponseDto>;
  onCreateStarted(
    response: StartJobResponseDto,
    request: StartCreateRequest,
  ): void | Promise<void>;
  toCommandError(error: unknown): CommandErrorDto | null;
}>;

export type CreateStartController = Readonly<{
  runCreate(options: CreateStartOptions): Promise<void>;
}>;

export function createCreateStartController(
  options: CreateStartControllerOptions,
): CreateStartController {
  async function runCreate(createOptions: CreateStartOptions): Promise<void> {
    if (options.submissionGuard.isInFlight()) {
      return;
    }

    const sourceSnapshot = options.workspace.getSnapshot();
    if (sourceSnapshot.isEmpty) {
      return;
    }

    const requestResult = options.workspace.buildStartCreateRequest({
      password: createOptions.passwordInput.password,
      passwordConfirm: createOptions.passwordInput.passwordConfirm,
      signingIdentityPassword: createOptions.passwordInput.signingIdentityPassword,
      destinationCollisionStrategy: createOptions.destinationCollisionStrategy,
    });
    options.publishSnapshot(requestResult.snapshot);
    if (!requestResult.ok) {
      return;
    }

    const request = requestResult.request;
    if (!options.submissionGuard.tryBegin()) {
      return;
    }
    options.publishSnapshot(options.workspace.setSubmissionInFlight(true).snapshot);

    let response: StartJobResponseDto;
    try {
      response = await options.startCreate(request);
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.publishSnapshot(options.workspace.setPlanError(
        commandError?.message
          ? { fallbackText: commandError.message }
          : { messageKey: "create.error.unableStart" },
      ));
      return;
    } finally {
      options.submissionGuard.end();
      options.publishSnapshot(options.workspace.setSubmissionInFlight(false).snapshot);
    }

    await options.onCreateStarted(response, request);
  }

  return {
    runCreate,
  };
}
