import type { CreatePlanResponse, PlanCreateRequest } from "../../api/types";
import type {
  CreateWorkspacePlanOptions,
  CreateWorkspacePlanRequestResult,
  CreateWorkspacePlanResultAcceptance,
  CreateWorkspacePlanStatus,
  CreateWorkspaceSnapshot,
} from "../workspaces/createWorkspace";

export type CreatePlanDebounceTimer = Readonly<{
  cancel(): void;
  schedule(callback: () => void): void;
}>;

export type CreatePlanCommandError = Readonly<{
  message: string;
}>;

export type CreatePlanControllerWorkspace = Readonly<{
  queuePlan(): Readonly<{
    snapshot: CreateWorkspaceSnapshot;
    revision: number;
    hasSources: boolean;
  }>;
  beginPlan(
    options?: Partial<CreateWorkspacePlanOptions>,
    revision?: number,
  ): CreateWorkspacePlanRequestResult;
  acceptPlanResult(revision: number, plan: CreatePlanResponse): CreateWorkspacePlanResultAcceptance;
  acceptPlanError(
    revision: number,
    status: CreateWorkspacePlanStatus,
  ): CreateWorkspacePlanResultAcceptance;
}>;

export type CreatePlanControllerOptions = Readonly<{
  workspace: CreatePlanControllerWorkspace;
  debounceTimer: CreatePlanDebounceTimer;
  runPlanCreate(request: PlanCreateRequest): Promise<CreatePlanResponse>;
  syncSources(snapshot: CreateWorkspaceSnapshot): CreateWorkspaceSnapshot;
  publishSnapshot(snapshot: CreateWorkspaceSnapshot): void;
  canUseBrowserPreview(): boolean;
  browserPreview(sources: readonly string[]): CreatePlanResponse;
  toCommandError(error: unknown): CreatePlanCommandError | null;
}>;

export type CreatePlanController = Readonly<{
  queuePlanRun(): void;
  cancelQueuedPlanRun(): void;
  runPlan(revision?: number): Promise<void>;
}>;

const DEFAULT_PLAN_OPTIONS: Partial<CreateWorkspacePlanOptions> = {
  excludeNames: [],
  excludeArchivePaths: [],
  includeArchivePaths: [],
  followSymlinks: false,
};

export function createCreatePlanController(
  options: CreatePlanControllerOptions,
): CreatePlanController {
  function renderAcceptedPlan(acceptedPlan: CreateWorkspacePlanResultAcceptance): void {
    if (!acceptedPlan.accepted) {
      return;
    }

    const snapshot = options.syncSources(acceptedPlan.snapshot);
    if (!snapshot.plan.current) {
      return;
    }

    options.publishSnapshot(snapshot);
  }

  async function runPlan(revision?: number): Promise<void> {
    options.debounceTimer.cancel();

    const planStart = options.workspace.beginPlan(DEFAULT_PLAN_OPTIONS, revision);
    const planStartSnapshot = options.syncSources(planStart.snapshot);

    if (!planStart.ready) {
      if (planStart.reason === "needsSources") {
        options.publishSnapshot(planStartSnapshot);
      }
      return;
    }

    options.publishSnapshot(planStartSnapshot);

    if (options.canUseBrowserPreview()) {
      const result = options.browserPreview(planStart.request.sources);
      renderAcceptedPlan(options.workspace.acceptPlanResult(planStart.revision, result));
      return;
    }

    try {
      const result = await options.runPlanCreate(planStart.request);
      renderAcceptedPlan(options.workspace.acceptPlanResult(planStart.revision, result));
    } catch (error) {
      const commandError = options.toCommandError(error);
      const acceptedError = options.workspace.acceptPlanError(planStart.revision, {
        fallbackText: commandError?.message ?? "Could not create archive plan.",
      });
      if (!acceptedError.accepted) {
        return;
      }

      const errorSnapshot = options.syncSources(acceptedError.snapshot);
      options.publishSnapshot(errorSnapshot);
    }
  }

  return {
    queuePlanRun(): void {
      options.debounceTimer.cancel();

      const queuedPlan = options.workspace.queuePlan();
      const sourceSnapshot = options.syncSources(queuedPlan.snapshot);
      if (sourceSnapshot.isEmpty) {
        options.publishSnapshot(sourceSnapshot);
        return;
      }

      options.publishSnapshot(sourceSnapshot);
      options.debounceTimer.schedule(() => {
        void runPlan(queuedPlan.revision);
      });
    },

    cancelQueuedPlanRun(): void {
      options.debounceTimer.cancel();
    },

    runPlan,
  };
}
