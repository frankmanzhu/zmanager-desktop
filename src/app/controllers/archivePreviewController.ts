import type {
  CommandErrorDto,
  PreviewEntryRequest,
  PreviewEntryResponse,
} from "../../api/types";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspacePasswordRetryOperation,
  ArchiveWorkspacePreviewUnavailableReason,
  ArchiveWorkspaceRequestResult,
  BuildArchiveWorkspacePreviewRequestInput,
} from "../workspaces/archiveWorkspace";

export type ArchivePreviewMode = "preview" | "openOutside";

export type ArchivePreviewResultMetadata = Readonly<{
  cleanupRoot: string;
  previewPath: string;
  entryPath: string;
}>;

export type ArchivePreviewControllerWorkspace = Pick<
  ArchiveWorkspace,
  "buildPreviewRequest" | "clearPasswordRetry" | "requestPasswordRetry"
>;

export type ArchivePreviewControllerOptions = Readonly<{
  workspace: ArchivePreviewControllerWorkspace;
  hasCurrentArchive(): boolean;
  isCurrentArchive(archivePath: string): boolean;
  cleanupBeforePreview(): Promise<void>;
  previewRequestInput(password: string | undefined): BuildArchiveWorkspacePreviewRequestInput;
  cachedPreviewPathForEntry(entryPath: string): string | null;
  runPreviewEntry(request: PreviewEntryRequest): Promise<PreviewEntryResponse>;
  openPath(path: string): Promise<void>;
  clearTrackedPreviewState(): void;
  trackPreviewResult(metadata: ArchivePreviewResultMetadata): void;
  toCommandError(error: unknown): CommandErrorDto | null;
  promptForPasswordRetry(retry: ArchiveWorkspacePasswordRetry): string | null;
  singleFileRequired(): void;
  previewUnableMessage(): string;
  cachedOpenedMessage(): string;
  openedOutsideMessage(writtenBytes: number): string;
  previewReadyMessage(writtenBytes: number): string;
  setBrowseLoaded(message: string): void;
  setBrowseError(message: string): void;
}>;

export type ArchivePreviewController = Readonly<{
  previewSelectedEntry(mode: ArchivePreviewMode): Promise<void>;
}>;

function retryOperationForMode(mode: ArchivePreviewMode): ArchiveWorkspacePasswordRetryOperation {
  return mode === "openOutside" ? "openOutsideEntry" : "previewEntry";
}

export function createArchivePreviewController(
  options: ArchivePreviewControllerOptions,
): ArchivePreviewController {
  async function previewSelectedEntry(mode: ArchivePreviewMode): Promise<void> {
    if (!options.hasCurrentArchive()) {
      return;
    }

    let requestInput = options.previewRequestInput(undefined);
    let password = requestInput.password;
    let requestResult: ArchiveWorkspaceRequestResult<PreviewEntryRequest, ArchiveWorkspacePreviewUnavailableReason> =
      options.workspace.buildPreviewRequest(requestInput);
    if (!requestResult.ok) {
      options.singleFileRequired();
      return;
    }
    let request = requestResult.request;
    if (!options.isCurrentArchive(request.archivePath)) {
      return;
    }
    let cachedPreviewStale = false;

    const cachedPreviewPath = options.cachedPreviewPathForEntry(request.entryPath);
    if (mode === "openOutside" && cachedPreviewPath) {
      try {
        await options.openPath(cachedPreviewPath);
        if (!options.isCurrentArchive(request.archivePath)) {
          return;
        }
        options.workspace.clearPasswordRetry();
        options.setBrowseLoaded(options.cachedOpenedMessage());
        return;
      } catch {
        if (!options.isCurrentArchive(request.archivePath)) {
          return;
        }
        cachedPreviewStale = true;
      }
    }

    await options.cleanupBeforePreview();
    if (!options.isCurrentArchive(request.archivePath)) {
      return;
    }
    if (cachedPreviewStale) {
      options.clearTrackedPreviewState();
    }

    while (true) {
      try {
        const response = await options.runPreviewEntry(request);
        if (!options.isCurrentArchive(request.archivePath)) {
          return;
        }
        options.trackPreviewResult({
          cleanupRoot: response.cleanupRoot,
          previewPath: response.previewPath,
          entryPath: request.entryPath,
        });
        await options.openPath(response.previewPath);
        if (!options.isCurrentArchive(request.archivePath)) {
          return;
        }
        options.workspace.clearPasswordRetry();
        options.setBrowseLoaded(
          mode === "openOutside"
            ? options.openedOutsideMessage(response.writtenBytes)
            : options.previewReadyMessage(response.writtenBytes),
        );
        return;
      } catch (error) {
        if (!options.isCurrentArchive(request.archivePath)) {
          return;
        }
        const commandError = options.toCommandError(error);
        const retry = options.workspace.requestPasswordRetry({
          operation: retryOperationForMode(mode),
          error: commandError,
        });
        if (retry) {
          const nextPassword = options.promptForPasswordRetry(retry);
          if (!nextPassword) {
            options.workspace.clearPasswordRetry();
            options.setBrowseError(commandError?.message ?? options.previewUnableMessage());
            return;
          }

          password = nextPassword;
          requestInput = options.previewRequestInput(password);
          requestResult = options.workspace.buildPreviewRequest(requestInput);
          if (!requestResult.ok) {
            options.singleFileRequired();
            return;
          }
          request = requestResult.request;
          if (!options.isCurrentArchive(request.archivePath)) {
            return;
          }
          continue;
        }

        options.setBrowseError(commandError?.message ?? options.previewUnableMessage());
        return;
      }
    }
  }

  return {
    previewSelectedEntry,
  };
}
