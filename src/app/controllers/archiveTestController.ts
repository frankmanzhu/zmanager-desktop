import type { CommandErrorDto, StartJobResponseDto, TestArchiveRequest } from "../../api/types";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspaceRequestResult,
  ArchiveWorkspaceTestUnavailableReason,
} from "../workspaces/archiveWorkspace";
import type { JobRetryContext } from "../jobs";

export type ArchiveTestControllerWorkspace = Pick<
  ArchiveWorkspace,
  "buildTestRequest" | "clearPasswordRetry" | "requestPasswordRetry"
>;

export type ArchiveTestControllerOptions = Readonly<{
  workspace: ArchiveTestControllerWorkspace;
  hasCurrentArchive(): boolean;
  initialPassword(): string | undefined;
  runTestArchive(request: TestArchiveRequest): Promise<StartJobResponseDto>;
  addJob(response: StartJobResponseDto, options: { retryContext: JobRetryContext }): void;
  toCommandError(error: unknown): CommandErrorDto | null;
  promptForPasswordRetry(retry: ArchiveWorkspacePasswordRetry): string | null;
  unableStartMessage(): string;
  setBrowseError(message: string): void;
}>;

export type ArchiveTestController = Readonly<{
  testArchive(): Promise<void>;
}>;

function testRetryContext(request: TestArchiveRequest): JobRetryContext {
  return {
    retryKind: "testArchive",
    archivePath: request.archivePath,
    ...(request.entryPaths?.length ? { entryPaths: request.entryPaths } : {}),
  };
}

function commandErrorMessage(error: CommandErrorDto): string {
  return `${error.message}${error.hint ? `\n${error.hint}` : ""}`;
}

export function createArchiveTestController(
  options: ArchiveTestControllerOptions,
): ArchiveTestController {
  async function testArchive(): Promise<void> {
    if (!options.hasCurrentArchive()) {
      return;
    }

    let password = options.initialPassword();
    let requestResult: ArchiveWorkspaceRequestResult<TestArchiveRequest, ArchiveWorkspaceTestUnavailableReason> =
      options.workspace.buildTestRequest({ password });
    if (!requestResult.ok) {
      return;
    }
    let request = requestResult.request;

    while (true) {
      try {
        const response = await options.runTestArchive(request);
        options.addJob(response, {
          retryContext: testRetryContext(request),
        });
        options.workspace.clearPasswordRetry();
        return;
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
            return;
          }
          password = nextPassword;
          requestResult = options.workspace.buildTestRequest({ password });
          if (!requestResult.ok) {
            return;
          }
          request = requestResult.request;
          continue;
        }

        if (!commandError) {
          options.setBrowseError(options.unableStartMessage());
          return;
        }

        options.setBrowseError(commandErrorMessage(commandError));
        return;
      }
    }
  }

  return {
    testArchive,
  };
}
