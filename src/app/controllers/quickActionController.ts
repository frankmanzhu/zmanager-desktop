import type {
  BrowseState,
  CommandErrorDto,
  ListArchiveRequest,
  QuickActionRequestDto,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
} from "../../api/types";
import { isSupportedArchivePath } from "../archiveFileTypes";
import { createFormatSupportsPassword, type CreateArchiveFormat } from "../createFlow";
import { buildStartExtractRequest } from "../extractFlow";
import type { MessageKey, MessageParams } from "../i18n/translator";
import type { JobRetryContext } from "../jobs";
import {
  createDefaultsForFormat,
  type AppPreferences,
} from "../preferences";
import {
  quickCreateDestination,
  quickExtractDestinationPlan,
  runQuickActionRequest,
  uniqueQuickActionPaths,
  type QuickActionExtractMode,
  type QuickActionPathHelpers,
} from "../quickActions";
import type {
  FocusedJobAutoCloseAction,
  FocusedJobProgressContext,
  JobOutputAction,
} from "../workspaces/jobsWorkspace";
import {
  buildQuickCreateStartRequest,
  type CreateWorkspaceOptionPatch,
  type CreateWorkspaceSnapshot,
} from "../workspaces/createWorkspace";

export type QuickActionControllerAddJobOptions = Readonly<{
  retryContext?: JobRetryContext;
  focusProgress?: boolean;
  autoCloseAction?: FocusedJobAutoCloseAction;
  progressContext?: FocusedJobProgressContext;
  outputActions?: JobOutputAction[];
}>;

export type QuickActionControllerOptions = Readonly<{
  preferences(): AppPreferences;
  pathHelpers: QuickActionPathHelpers;
  setOperationalMessage(key: MessageKey, params?: MessageParams): void;
  setOperationalStatus(message: string): void;
  message(key: MessageKey, params?: MessageParams): string;
  openArchive(paths: string[]): Promise<void>;
  runStartCreate(request: StartCreateRequest): Promise<StartJobResponseDto>;
  runStartExtract(request: StartExtractRequest): Promise<StartJobResponseDto>;
  toCommandError(error: unknown): CommandErrorDto | null;
  isPasswordCommandError(error: CommandErrorDto | null): boolean;
  promptForNewArchivePassword(): string | null;
  promptForCommandRetry(commandCode: string): string | null;
  recordCreateDestination(destination: string): void;
  recordExtractDestination(destination: string): void;
  addJob(response: StartJobResponseDto, options?: QuickActionControllerAddJobOptions): void;
  createProgressContext(request: StartCreateRequest): FocusedJobProgressContext;
  createOutputActions(request: StartCreateRequest): JobOutputAction[];
  extractProgressContext(request: StartExtractRequest): FocusedJobProgressContext;
  extractOutputActions(request: StartExtractRequest): JobOutputAction[];
  showCreateWorkspace(): void;
  readCreateSnapshot(): CreateWorkspaceSnapshot;
  addCreateSources(sources: readonly string[]): CreateWorkspaceSnapshot;
  applyCreateDefaultsForFormat(format: CreateArchiveFormat): void;
  setCreateOptions(patch: CreateWorkspaceOptionPatch): CreateWorkspaceSnapshot;
  setCreateDestinationPath(path: string): CreateWorkspaceSnapshot;
  publishCreateSnapshot(snapshot?: CreateWorkspaceSnapshot): CreateWorkspaceSnapshot;
  cancelQueuedPlanRun(): void;
  runPlan(): Promise<void>;
  setCurrentArchivePath(archivePath: string): void;
  loadArchive(request: ListArchiveRequest): Promise<void>;
  readBrowseState(): BrowseState;
  setBrowseError(message: string): void;
  openExtractDialog(mode: "archive"): void;
}>;

export type QuickActionController = Readonly<{
  handleQuickActionRequest(request: QuickActionRequestDto): Promise<void>;
  startQuickCreate(paths: string[], format: CreateArchiveFormat, cleanSource: boolean): Promise<void>;
  openQuickCreateReview(paths: string[], format: CreateArchiveFormat, cleanSource: boolean): Promise<void>;
  openQuickExtractReview(paths: string[]): Promise<void>;
  startQuickExtract(paths: string[], action: QuickActionExtractMode): Promise<void>;
}>;

export function createQuickActionController(
  options: QuickActionControllerOptions,
): QuickActionController {
  async function startQuickCreate(
    paths: string[],
    format: CreateArchiveFormat,
    cleanSource: boolean,
  ): Promise<void> {
    const sources = uniqueQuickActionPaths(paths);
    if (!sources.length) {
      options.setOperationalMessage("quickCreate.needsSource");
      return;
    }

    const preferences = options.preferences();
    const destinationPath = quickCreateDestination(
      sources,
      format,
      preferences,
      options.pathHelpers,
    );

    if (!destinationPath) {
      options.setOperationalMessage("quickCreate.needsDestination");
      return;
    }

    options.setOperationalMessage("quickCreate.starting");
    try {
      const defaults = createDefaultsForFormat(preferences, format);
      let password: string | undefined;
      if (defaults.promptForPassword && createFormatSupportsPassword(format)) {
        const promptedPassword = options.promptForNewArchivePassword();
        if (!promptedPassword) {
          options.setOperationalMessage("quickCreate.cancelled");
          return;
        }
        password = promptedPassword;
      }

      const requestResult = buildQuickCreateStartRequest({
        sources,
        destinationPath,
        format,
        cleanSource,
        replaceExisting: defaults.replaceExisting,
        destinationCollisionStrategy: "rename",
        preserveMetadata: defaults.preserveMetadata,
        password,
        compressionLevel: defaults.compressionLevel ?? undefined,
        volumeSize: defaults.volumeSize ?? undefined,
        respectGitignore: defaults.respectGitignore,
        followSymlinks: defaults.followSymlinks,
        tzapRecoveryPercentage: defaults.tzapRecoveryPercentage,
        tzapVolumeLossTolerance: defaults.tzapVolumeLossTolerance,
        zipCompression: defaults.zipCompression,
        sevenZSolid: defaults.sevenZSolid,
        sevenZThreads: defaults.sevenZThreads,
        sevenZChunkSize: defaults.sevenZChunkSize,
        sevenZEncryptFileNames: defaults.sevenZEncryptFileNames,
      });
      if (!requestResult.ok) {
        options.setOperationalMessage(
          requestResult.reason === "needsSources"
            ? "quickCreate.needsSource"
            : "quickCreate.needsDestination",
        );
        return;
      }

      const request = requestResult.request;
      const response = await options.runStartCreate(request);
      options.recordCreateDestination(request.destinationPath);
      options.addJob(response, {
        focusProgress: true,
        autoCloseAction: "closeWindow",
        progressContext: options.createProgressContext(request),
        outputActions: options.createOutputActions(request),
      });
      options.setOperationalMessage("quickCreate.started");
    } catch (error) {
      const commandError = options.toCommandError(error);
      options.setOperationalStatus(
        commandError?.message ?? options.message("quickCreate.unableStart"),
      );
    }
  }

  async function openQuickCreateReview(
    paths: string[],
    format: CreateArchiveFormat,
    cleanSource: boolean,
  ): Promise<void> {
    const sources = uniqueQuickActionPaths(paths);
    if (!sources.length) {
      options.setOperationalMessage("quickCreate.needsSource");
      return;
    }

    const previousSnapshot = options.readCreateSnapshot();
    options.showCreateWorkspace();
    const sourceSnapshot = options.publishCreateSnapshot(options.addCreateSources(sources));
    if (!previousSnapshot.hasSources) {
      options.applyCreateDefaultsForFormat(format);
      options.publishCreateSnapshot();
      options.publishCreateSnapshot(options.setCreateOptions({ cleanSource }));
      options.publishCreateSnapshot(options.setCreateDestinationPath(quickCreateDestination(
        [...sourceSnapshot.sources],
        format,
        options.preferences(),
        options.pathHelpers,
      )));
    }
    options.cancelQueuedPlanRun();

    options.setOperationalMessage("quickCreate.planning");
    await options.runPlan();
    const reviewSnapshot = options.publishCreateSnapshot();
    if (reviewSnapshot.plan.state === "ready" && reviewSnapshot.plan.current !== null) {
      options.setOperationalMessage("quickCreate.review");
    } else {
      options.setOperationalMessage("quickCreate.needsReview");
    }
  }

  async function openQuickExtractReview(paths: string[]): Promise<void> {
    const archives = uniqueQuickActionPaths(paths);
    if (archives.length !== 1) {
      options.setOperationalMessage("quickExtract.oneArchiveAtATime");
      return;
    }

    const archivePath = archives[0];
    if (!archivePath || !isSupportedArchivePath(archivePath)) {
      options.setOperationalMessage("archive.unsupported", { archivePath });
      return;
    }

    options.setCurrentArchivePath(archivePath);
    await options.loadArchive({ archivePath });
    const browseState = options.readBrowseState();
    if (browseState !== "loaded" && browseState !== "empty") {
      return;
    }

    options.setOperationalMessage("quickExtract.chooseOptions");
    options.openExtractDialog("archive");
  }

  async function startQuickExtract(
    paths: string[],
    action: QuickActionExtractMode,
  ): Promise<void> {
    const archives = uniqueQuickActionPaths(paths);
    if (!archives.length) {
      options.setOperationalMessage("quickExtract.needsArchive");
      return;
    }

    for (const archivePath of archives) {
      if (!isSupportedArchivePath(archivePath)) {
        options.setOperationalMessage("archive.unsupported", { archivePath });
        continue;
      }

      let password: string | undefined;
      while (true) {
        try {
          const destinationPlan = quickExtractDestinationPlan(
            archivePath,
            action,
            options.pathHelpers,
          );
          if (!destinationPlan.destinationPath) {
            options.setOperationalMessage("quickExtract.chooseDestination", { archivePath });
            break;
          }

          const request = buildStartExtractRequest({
            archivePath,
            destinationPath: destinationPlan.destinationPath,
            overwrite: "rename",
            destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
            stripComponents: destinationPlan.stripComponents,
            ...(password ? { password } : {}),
          });
          const response = await options.runStartExtract(request);
          options.recordExtractDestination(destinationPlan.destinationPath);
          options.addJob(response, {
            retryContext: {
              retryKind: "extractArchive",
              archivePath,
              destinationPath: destinationPlan.destinationPath,
              overwrite: "rename",
              destinationCollisionStrategy: destinationPlan.destinationCollisionStrategy,
              stripComponents: destinationPlan.stripComponents,
            },
            focusProgress: true,
            autoCloseAction: "closeWindow",
            progressContext: options.extractProgressContext(request),
            outputActions: options.extractOutputActions(request),
          });
          break;
        } catch (error) {
          const commandError = options.toCommandError(error);
          if (options.isPasswordCommandError(commandError)) {
            const nextPassword = options.promptForCommandRetry(commandError?.code ?? "");
            if (!nextPassword) {
              options.setOperationalStatus(commandError?.message ?? options.message("quickExtract.unableExtract", { archivePath }));
              break;
            }
            password = nextPassword;
            continue;
          }

          options.setOperationalStatus(
            commandError?.message ?? options.message("quickExtract.unableExtract", { archivePath }),
          );
          if (commandError?.hint) {
            options.setBrowseError(`${commandError.message}\n${commandError.hint}`);
          }
          break;
        }
      }
    }
  }

  async function handleQuickActionRequest(request: QuickActionRequestDto): Promise<void> {
    await runQuickActionRequest(request, options.preferences(), {
      openArchive: options.openArchive,
      openCreateReview: openQuickCreateReview,
      startCreate: startQuickCreate,
      openExtractReview: openQuickExtractReview,
      startExtract: startQuickExtract,
    });
  }

  return {
    handleQuickActionRequest,
    startQuickCreate,
    openQuickCreateReview,
    openQuickExtractReview,
    startQuickExtract,
  };
}
