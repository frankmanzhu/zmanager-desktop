import type { CommandErrorDto, StartJobResponseDto, TestArchiveRequest } from "../../api/types";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspaceRequestResult,
  ArchiveWorkspaceTestUnavailableReason,
} from "../workspaces/archiveWorkspace";
import type { MainWindowSubmissionGuard } from "../mainWindowSubmissionGuard";

export type ArchiveTestControllerWorkspace = Pick<
  ArchiveWorkspace,
  "buildTestRequest" | "clearPasswordRetry" | "requestPasswordRetry"
>;

export type ArchiveTestControllerOptions = Readonly<{
  workspace: ArchiveTestControllerWorkspace;
  submissionGuard: MainWindowSubmissionGuard;
  hasCurrentArchive(): boolean;
  initialPassword(): string | undefined;
  runTestArchive(request: TestArchiveRequest): Promise<StartJobResponseDto>;
  handoffAcceptedJob(
    response: StartJobResponseDto,
    resetSubmittedState: () => void,
  ): Promise<void>;
  resetSubmittedState(): void;
  toCommandError(error: unknown): CommandErrorDto | null;
  promptForPasswordRetry(retry: ArchiveWorkspacePasswordRetry): string | null;
  unableStartMessage(): string;
  setBrowseError(message: string): void;
}>;

export type ArchiveTestController = Readonly<{
  testArchive(): Promise<void>;
}>;

function commandErrorMessage(error: CommandErrorDto): string {
  return `${error.message}${error.hint ? `\n${error.hint}` : ""}`;
}

export function createArchiveTestController(
  options: ArchiveTestControllerOptions,
): ArchiveTestController {
  async function testArchive(): Promise<void> {
    if (!options.hasCurrentArchive() || options.submissionGuard.isInFlight()) {
      return;
    }

    let password = options.initialPassword();
    let requestResult: ArchiveWorkspaceRequestResult<TestArchiveRequest, ArchiveWorkspaceTestUnavailableReason> =
      options.workspace.buildTestRequest({ password });
    if (!requestResult.ok) {
      return;
    }
    let request = requestResult.request;

    if (!options.submissionGuard.tryBegin()) {
      return;
    }

    let acceptedResponse: StartJobResponseDto | null = null;
    try {
      while (true) {
        try {
          acceptedResponse = await options.runTestArchive(request);
          break;
        } catch (error) {
          const commandError = options.toCommandError(error);
          const retry = options.workspace.requestPasswordRetry({
            operation: "testArchive",
            error: commandError,
          });
          if (retry) {
            const nextPassword = options.promptForPasswordRetry(retry);
            if (!nextPassword) {
              options.workspace.clearPasswordRetry();
              options.setBrowseError(commandError?.message ?? options.unableStartMessage());
              break;
            }
            password = nextPassword;
            requestResult = options.workspace.buildTestRequest({ password });
            if (!requestResult.ok) {
              break;
            }
            request = requestResult.request;
            continue;
          }

          if (!commandError) {
            options.setBrowseError(options.unableStartMessage());
            break;
          }

          options.setBrowseError(commandErrorMessage(commandError));
          break;
        }
      }
    } finally {
      options.submissionGuard.end();
    }

    if (!acceptedResponse) {
      return;
    }

    await options.handoffAcceptedJob(
      acceptedResponse,
      options.resetSubmittedState,
    );
  }

  return {
    testArchive,
  };
}
