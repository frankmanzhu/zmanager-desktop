import type { CommandErrorDto, StartExtractRequest, StartJobResponseDto } from "../../api/types";
import {
  resolveExtractStartInput,
  type ExtractMode,
  type ExtractStartInput,
  type ResolvedExtractStartInput,
} from "../extractFlow";
import type { JobOutputAction, FocusedJobProgressContext } from "../workspaces/jobsWorkspace";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspaceRequestResult,
  ArchiveWorkspaceExtractUnavailableReason,
} from "../workspaces/archiveWorkspace";
import type { JobRetryContext } from "../jobs";

export type ExtractStartControllerWorkspace = Pick<
  ArchiveWorkspace,
  | "buildExtractRequest"
  | "clearPasswordRetry"
  | "getExtractReferencePaths"
  | "getSnapshot"
  | "requestPasswordRetry"
>;

export type ExtractStartControllerOptions = Readonly<{
  workspace: ExtractStartControllerWorkspace;
  hasCurrentArchive(): boolean;
  joinNativePath(parentPath: string, childName: string): string;
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
  input: ResolvedExtractStartInput,
  mode: ExtractMode,
): JobRetryContext {
  return {
    retryKind: "extractArchive",
    archivePath: request.archivePath,
    destinationPath: input.destination ?? request.destinationPath,
    overwrite: input.overwrite,
    ...(mode === "selection" ? { entryPaths: request.entryPaths } : { entryPaths: undefined }),
    stripComponents: input.stripComponents,
    tzapRestorePolicy: input.tzapRestorePolicy,
    tzapAllowDegraded: input.tzapAllowDegraded,
    tzapAllowAbsoluteSymlinks: input.tzapAllowAbsoluteSymlinks,
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

    const snapshot = options.workspace.getSnapshot();
    const resolvedInput = resolveExtractStartInput(input, {
      currentFolder: snapshot.view.currentFolder,
      allEntryPaths: snapshot.entries.map((entry) => entry.path),
      entryReferences: options.workspace.getExtractReferencePaths(mode),
      joinNativePath: options.joinNativePath,
    });
    if (!resolvedInput.destinationValid || !resolvedInput.destination) {
      options.chooseDestinationFirst();
      return;
    }

    if (mode === "selection" && resolvedInput.entryReferences.length === 0) {
      options.selectEntryFirst();
      return;
    }

    let requestResult: ArchiveWorkspaceRequestResult<StartExtractRequest, ArchiveWorkspaceExtractUnavailableReason> =
      options.workspace.buildExtractRequest({
        mode,
        destinationPath: resolvedInput.destination,
        overwrite: resolvedInput.overwrite,
        stripComponents: resolvedInput.stripComponents,
        tzapRestorePolicy: resolvedInput.tzapRestorePolicy,
        tzapAllowDegraded: resolvedInput.tzapAllowDegraded,
        tzapAllowAbsoluteSymlinks: resolvedInput.tzapAllowAbsoluteSymlinks,
        password: resolvedInput.password,
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
      options.recordDestination(resolvedInput.destination);
      options.closeExtractDialog();
      options.workspace.clearPasswordRetry();
      options.addJob(response, {
        retryContext: retryContextForRequest(request, resolvedInput, mode),
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
