import type { CommandErrorDto, StartExtractRequest, StartJobResponseDto } from "../../api/types";
import type { ExtractMode } from "../extractFlow";
import type { JobOutputAction, FocusedJobProgressContext } from "../workspaces/jobsWorkspace";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspaceRequestResult,
  ArchiveWorkspaceExtractUnavailableReason,
} from "../workspaces/archiveWorkspace";
import type { JobRetryContext } from "../jobs";

export type ExtractStartInput = Readonly<{
  destination: string | null;
  destinationValid: boolean;
  overwrite: StartExtractRequest["overwrite"];
  stripComponents: number;
  password?: string;
  entryReferences: readonly string[];
}>;

export type ExtractStartControllerWorkspace = Pick<
  ArchiveWorkspace,
  "buildExtractRequest" | "clearPasswordRetry" | "requestPasswordRetry"
>;

export type ExtractStartControllerOptions = Readonly<{
  workspace: ExtractStartControllerWorkspace;
  hasCurrentArchive(): boolean;
  startExtract(request: StartExtractRequest): Promise<StartJobResponseDto>;
  toCommandError(error: unknown): CommandErrorDto | null;
  requestPasswordInDialog(retry: ArchiveWorkspacePasswordRetry): void;
  chooseDestinationFirst(): void;
  selectEntryFirst(): void;
  recordDestination(destination: string): void;
  closeExtractDialog(): void;
  addJob(
    response: StartJobResponseDto,
    options: {
      retryContext: JobRetryContext;
      focusProgress: true;
      autoCloseAction: "returnToWorkspace";
      progressContext: FocusedJobProgressContext;
      outputActions: JobOutputAction[];
    },
  ): void;
  progressContext(request: StartExtractRequest, mode: ExtractMode): FocusedJobProgressContext;
  outputActions(request: StartExtractRequest): JobOutputAction[];
  unableStartMessage(mode: ExtractMode): string;
  setBrowseError(message: string): void;
}>;

export type ExtractStartController = Readonly<{
  startExtract(mode: ExtractMode, input: ExtractStartInput): Promise<void>;
}>;

function retryContextForRequest(
  request: StartExtractRequest,
  input: ExtractStartInput,
  mode: ExtractMode,
): JobRetryContext {
  return {
    retryKind: "extractArchive",
    archivePath: request.archivePath,
    destinationPath: input.destination ?? request.destinationPath,
    overwrite: input.overwrite,
    ...(mode === "selection" ? { entryPaths: request.entryPaths } : { entryPaths: undefined }),
    stripComponents: input.stripComponents,
  };
}

function passwordRetryOperation(mode: ExtractMode): "extractArchive" | "extractSelection" {
  return mode === "archive" ? "extractArchive" : "extractSelection";
}

export function createExtractStartController(
  options: ExtractStartControllerOptions,
): ExtractStartController {
  async function startExtract(mode: ExtractMode, input: ExtractStartInput): Promise<void> {
    if (!options.hasCurrentArchive()) {
      return;
    }

    if (!input.destinationValid || !input.destination) {
      options.chooseDestinationFirst();
      return;
    }

    if (mode === "selection" && input.entryReferences.length === 0) {
      options.selectEntryFirst();
      return;
    }

    let requestResult: ArchiveWorkspaceRequestResult<StartExtractRequest, ArchiveWorkspaceExtractUnavailableReason> =
      options.workspace.buildExtractRequest({
        mode,
        destinationPath: input.destination,
        overwrite: input.overwrite,
        stripComponents: input.stripComponents,
        password: input.password,
      });
    if (!requestResult.ok) {
      if (mode === "selection") {
        options.selectEntryFirst();
      }
      return;
    }
    const request = requestResult.request;

    try {
      const response = await options.startExtract(request);
      options.recordDestination(input.destination);
      options.closeExtractDialog();
      options.workspace.clearPasswordRetry();
      options.addJob(response, {
        retryContext: retryContextForRequest(request, input, mode),
        focusProgress: true,
        autoCloseAction: "returnToWorkspace",
        progressContext: options.progressContext(request, mode),
        outputActions: options.outputActions(request),
      });
    } catch (error) {
      const commandError = options.toCommandError(error);
      const retry = options.workspace.requestPasswordRetry({
        operation: passwordRetryOperation(mode),
        error: commandError,
      });
      if (retry) {
        options.requestPasswordInDialog(retry);
        return;
      }
      options.setBrowseError(commandError?.message ?? options.unableStartMessage(mode));
    }
  }

  return {
    startExtract,
  };
}
