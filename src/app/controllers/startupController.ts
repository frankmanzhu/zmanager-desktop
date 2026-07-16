import type {
  CommandErrorDto,
  HealthcheckResponse,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  StartJobResponseDto,
} from "../../api/types";
import type { MessageKey, MessageParams } from "../i18n/translator";

export type BootstrapState = Readonly<{
  healthcheck: HealthcheckResponse | null;
  contract: ProjectContract | null;
}>;

export type StartupControllerOptions = Readonly<{
  fetchHealthcheck(): Promise<HealthcheckResponse>;
  fetchProjectContract(): Promise<ProjectContract>;
  fetchQuickActionStartupState(): Promise<QuickActionStartupStateDto>;
  isDesktopRuntime(): boolean;
  revealWindowForStartupQuickAction(state: QuickActionStartupStateDto): Promise<void>;
  revealNormalWindow(): Promise<void>;
  activateQuickActionJobs(responses: StartJobResponseDto[]): Promise<void>;
  handleQuickActionRequest(request: QuickActionRequestDto): Promise<void>;
  setOperationalStatus(message: string): void;
  setOperationalMessage(key: MessageKey, params?: MessageParams): void;
  setBrowseError(message: string): void;
  unknownErrorMessage(error: unknown, fallback: string): string;
  toCommandError(error: unknown): CommandErrorDto | null;
  message(key: MessageKey, params?: MessageParams): string;
  setBootstrapState(state: BootstrapState): void;
  onBootstrapStateChanged(): void;
}>;

export type StartupController = Readonly<{
  handleStartupQuickAction(): Promise<void>;
  handleQuickActionStartupState(state: QuickActionStartupStateDto): Promise<void>;
  initializeDesktopRuntime(): Promise<void>;
  loadBootstrapState(): Promise<void>;
}>;

export function createStartupController(
  options: StartupControllerOptions,
): StartupController {
  async function handleQuickActionStartupState(state: QuickActionStartupStateDto): Promise<void> {
    if (!state.launchedForQuickAction) {
      return;
    }

    if (state.error) {
      options.setOperationalStatus(state.error.message);
      if (state.error.hint) {
        options.setBrowseError(`${state.error.message}\n${state.error.hint}`);
      }
      return;
    }

    if (state.quickActionJobs?.length) {
      await options.activateQuickActionJobs(state.quickActionJobs);
      return;
    }

    if (state.quickAction) {
      options.setOperationalStatus(options.message(
        state.quickAction.kind === "open"
          ? "quickAction.openingArchive"
          : "quickAction.starting",
      ));
      await options.handleQuickActionRequest(state.quickAction);
    }
  }

  async function handleStartupQuickAction(): Promise<void> {
    if (!options.isDesktopRuntime()) {
      return;
    }

    let revealedWindow = false;
    try {
      while (true) {
        const state = await options.fetchQuickActionStartupState();
        if (!revealedWindow) {
          await options.revealWindowForStartupQuickAction(state);
          revealedWindow = true;
        }
        await handleQuickActionStartupState(state);
        if (!state.launchedForQuickAction || state.error) {
          break;
        }
      }
    } catch (error) {
      options.setOperationalStatus(options.unknownErrorMessage(
        error,
        options.message("jobs.quickActionStartupReadFailed"),
      ));
      if (!revealedWindow) {
        await options.revealNormalWindow();
      }
    }
  }

  async function initializeDesktopRuntime(): Promise<void> {
    if (!options.isDesktopRuntime()) {
      return;
    }

    try {
      await handleStartupQuickAction();
    } catch (error) {
      options.setOperationalStatus(options.unknownErrorMessage(
        error,
        options.message("desktopIntegration.initFailed"),
      ));
      await options.revealNormalWindow();
    }
  }

  async function loadBootstrapState(): Promise<void> {
    try {
      const [healthcheck, contract] = await Promise.all([
        options.fetchHealthcheck(),
        options.fetchProjectContract(),
      ]);

      options.setBootstrapState({ healthcheck, contract });
      options.setOperationalStatus(
        healthcheck.ready
          ? options.message("status.ready")
          : options.message("status.backendUnavailable"),
      );
      options.onBootstrapStateChanged();
    } catch (error) {
      options.setBootstrapState({ healthcheck: null, contract: null });
      if (options.isDesktopRuntime()) {
        const commandError = options.toCommandError(error);
        options.setOperationalStatus(
          commandError?.message
            ?? options.unknownErrorMessage(error, options.message("status.backendUnavailable")),
        );
      } else {
        options.setOperationalMessage("status.readyBrowserPreview");
      }
      options.onBootstrapStateChanged();
    }
  }

  return {
    handleStartupQuickAction,
    handleQuickActionStartupState,
    initializeDesktopRuntime,
    loadBootstrapState,
  };
}
