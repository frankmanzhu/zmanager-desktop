import type { CommandErrorDto, StartCreateRequest, StartJobResponseDto } from "../../api/types";
import type {
  CreateWorkspace,
  CreateWorkspaceSnapshot,
} from "../workspaces/createWorkspace";

export type CreateStartOptions = Readonly<{
  destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
}>;

export type CreateStartControllerWorkspace = Pick<
  CreateWorkspace,
  "buildStartCreateRequest" | "setPlanError" | "setSubmissionInFlight"
>;

export type CreateStartControllerOptions = Readonly<{
  workspace: CreateStartControllerWorkspace;
  syncSources(snapshot?: CreateWorkspaceSnapshot): CreateWorkspaceSnapshot;
  isSubmissionInFlight(): boolean;
  passwordInput(): { password: string; passwordConfirm: string };
  startCreate(request: StartCreateRequest): Promise<StartJobResponseDto>;
  onCreateStarted(response: StartJobResponseDto, request: StartCreateRequest): void;
  toCommandError(error: unknown): CommandErrorDto | null;
  renderPlanState(): void;
}>;

export type CreateStartController = Readonly<{
  runCreate(options?: CreateStartOptions): Promise<void>;
}>;

export function createCreateStartController(
  options: CreateStartControllerOptions,
): CreateStartController {
  async function runCreate(createOptions: CreateStartOptions = {}): Promise<void> {
    if (options.isSubmissionInFlight()) {
      return;
    }

    const sourceSnapshot = options.syncSources();
    if (sourceSnapshot.isEmpty) {
      return;
    }

    const passwordInput = options.passwordInput();
    const requestResult = options.workspace.buildStartCreateRequest({
      password: passwordInput.password,
      passwordConfirm: passwordInput.passwordConfirm,
      destinationCollisionStrategy: createOptions.destinationCollisionStrategy,
    });
    options.syncSources(requestResult.snapshot);
    if (!requestResult.ok) {
      options.renderPlanState();
      return;
    }

    const request = requestResult.request;
    options.syncSources(options.workspace.setSubmissionInFlight(true).snapshot);
    options.renderPlanState();

    try {
      const response = await options.startCreate(request);
      options.onCreateStarted(response, request);
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.syncSources(options.workspace.setPlanError(
        commandError?.message
          ? { fallbackText: commandError.message }
          : { messageKey: "create.error.unableStart" },
      ));
      options.renderPlanState();
    } finally {
      options.syncSources(options.workspace.setSubmissionInFlight(false).snapshot);
      options.renderPlanState();
    }
  }

  return {
    runCreate,
  };
}
