import type { CommandErrorDto, StartCreateRequest, StartJobResponseDto } from "../../api/types";
import type {
  CreateWorkspace,
  CreateWorkspaceSnapshot,
} from "../workspaces/createWorkspace";

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
  publishSnapshot(snapshot: CreateWorkspaceSnapshot): CreateWorkspaceSnapshot;
  isSubmissionInFlight(): boolean;
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
    if (options.isSubmissionInFlight()) {
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
    options.publishSnapshot(options.workspace.setSubmissionInFlight(true).snapshot);

    try {
      const response = await options.startCreate(request);
      await options.onCreateStarted(response, request);
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.publishSnapshot(options.workspace.setPlanError(
        commandError?.message
          ? { fallbackText: commandError.message }
          : { messageKey: "create.error.unableStart" },
      ));
    } finally {
      options.publishSnapshot(options.workspace.setSubmissionInFlight(false).snapshot);
    }
  }

  return {
    runCreate,
  };
}
