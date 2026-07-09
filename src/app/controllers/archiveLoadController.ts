import type { ArchiveListingDto, CommandErrorDto, ListArchiveRequest } from "../../api/types";
import type {
  ArchiveWorkspace,
  ArchiveWorkspacePasswordRetry,
  ArchiveWorkspacePasswordRetryOperation,
  ArchiveWorkspaceSnapshot,
} from "../workspaces/archiveWorkspace";

export type ArchiveLoadOptions = Readonly<{
  preserveState?: boolean;
}>;

export type ArchiveLoadControllerWorkspace = Pick<
  ArchiveWorkspace,
  "beginLoading" | "loadFailed" | "requestPasswordRetry"
>;

export type ArchiveLoadControllerOptions = Readonly<{
  workspace: ArchiveLoadControllerWorkspace;
  enterExtractWorkspace(): void;
  listArchive(request: ListArchiveRequest): Promise<ArchiveListingDto>;
  toCommandError(error: unknown): CommandErrorDto | null;
  renderLoading(snapshot: ArchiveWorkspaceSnapshot): void;
  acceptListing(listing: ArchiveListingDto, options: Required<ArchiveLoadOptions>): void;
  renderLoadError(snapshot: ArchiveWorkspaceSnapshot, message: string): void;
  failedListMessage(): string;
  loadErrorMessage(error: CommandErrorDto, options: { includeHint: boolean }): string;
  promptForPasswordRetry(retry: ArchiveWorkspacePasswordRetry): string | null;
}>;

export type ArchiveLoadController = Readonly<{
  loadArchive(request: ListArchiveRequest, options?: ArchiveLoadOptions): Promise<void>;
}>;

const LIST_ARCHIVE_OPERATION: ArchiveWorkspacePasswordRetryOperation = "listArchive";

function requestWithPassword(archivePath: string, password: string | undefined): ListArchiveRequest {
  return {
    archivePath,
    ...(password ? { password } : {}),
  };
}

export function createArchiveLoadController(
  options: ArchiveLoadControllerOptions,
): ArchiveLoadController {
  async function loadArchive(
    request: ListArchiveRequest,
    loadOptions: ArchiveLoadOptions = {},
  ): Promise<void> {
    let password = request.password?.trim();
    const resolvedOptions: Required<ArchiveLoadOptions> = {
      preserveState: loadOptions.preserveState ?? false,
    };

    options.enterExtractWorkspace();

    while (true) {
      const loadingSnapshot = options.workspace.beginLoading({
        archivePath: request.archivePath,
        preserveListing: resolvedOptions.preserveState,
      });
      options.renderLoading(loadingSnapshot);

      try {
        const listing = await options.listArchive(requestWithPassword(request.archivePath, password));
        options.acceptListing(listing, resolvedOptions);
        return;
      } catch (error) {
        const commandError = options.toCommandError(error);
        const retry = options.workspace.requestPasswordRetry({
          operation: LIST_ARCHIVE_OPERATION,
          error: commandError,
        });

        if (!retry) {
          options.renderLoadError(
            options.workspace.loadFailed(commandError ?? { kind: "unknown" }),
            commandError
              ? options.loadErrorMessage(commandError, { includeHint: true })
              : options.failedListMessage(),
          );
          return;
        }

        const nextPassword = options.promptForPasswordRetry(retry);
        if (!nextPassword) {
          options.renderLoadError(
            options.workspace.loadFailed(commandError ?? { kind: "unknown" }),
            commandError?.message ?? options.failedListMessage(),
          );
          return;
        }

        password = nextPassword;
      }
    }
  }

  return {
    loadArchive,
  };
}
