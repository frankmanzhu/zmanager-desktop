import type { DropIntentDecision, WorkspaceDropMode } from "../dropIntent";
import type { QuickActionRequestDto, QuickActionStartupStateDto } from "../../api/types";
import { quickActionWindowDisposition } from "../quickActions";

export type DropOverlayMode = "idle" | "active" | "choosing";
export type DropOverlayTarget = "compress" | "extract" | "choose" | "blocked" | "unknown";
export type QuickActionWindowMode = "normal" | "jobOnly" | "background";
export type QuickActionStartupRevealTarget = "normal" | "jobOnly";
export type DropOverlayMessageKey =
  | "drop.addSources.copyMessage"
  | "drop.addSources.title"
  | "drop.blocked.message"
  | "drop.blocked.title"
  | "drop.browseRequiresArchive"
  | "drop.browserPreview"
  | "drop.chooseMode.message"
  | "drop.chooseMode.mixedMessage"
  | "drop.chooseMode.title"
  | "drop.empty"
  | "drop.openArchive.actionMessage"
  | "drop.openArchive.message"
  | "drop.openArchive.title";
export type DropOverlayMessageParams = Record<string, string | number | boolean | null | undefined>;

export type DropOverlayCopy = {
  readonly titleKey: DropOverlayMessageKey;
  readonly messageKey: DropOverlayMessageKey;
  readonly messageParams?: DropOverlayMessageParams;
  readonly supportKey?: DropOverlayMessageKey;
  readonly target: DropOverlayTarget;
  readonly showActions?: boolean;
};

export type PendingDropChoice = Extract<DropIntentDecision, { kind: "askAction" }>;

export interface DropOverlaySnapshot {
  readonly mode: DropOverlayMode;
  readonly copy: DropOverlayCopy | null;
  readonly pendingChoice: PendingDropChoice | null;
}

export interface PreviewCleanupMetadata {
  readonly cleanupRoot: string;
  readonly previewPath: string;
  readonly entryPath: string;
}

export interface QuickActionWindowSnapshot {
  readonly mode: QuickActionWindowMode;
  readonly shown: boolean;
}

export interface ShellWorkspaceSnapshot {
  readonly activeMode: WorkspaceDropMode;
  readonly operationalStatus: string;
  readonly jobDrawerOpen: boolean;
  readonly dropOverlay: DropOverlaySnapshot;
  readonly previewCleanup: PreviewCleanupMetadata;
  readonly quickActionWindow: QuickActionWindowSnapshot;
}

export interface ShellWorkspace {
  getSnapshot(): ShellWorkspaceSnapshot;
  setWorkspaceMode(mode: WorkspaceDropMode): ShellWorkspaceSnapshot;
  setOperationalStatus(message: string): ShellWorkspaceSnapshot;
  setJobDrawerOpen(open: boolean): ShellWorkspaceSnapshot;
  setQuickActionWindowMode(mode: QuickActionWindowMode): ShellWorkspaceSnapshot;
  setQuickActionWindowShown(shown: boolean): ShellWorkspaceSnapshot;
  isQuickActionJobMode(): boolean;
  isQuickActionWindowBackgrounded(): boolean;
  selectQuickActionStartupRevealTarget(state: QuickActionStartupStateDto): QuickActionStartupRevealTarget;
  setDropOverlay(mode: DropOverlayMode, copy?: DropOverlayCopy): ShellWorkspaceSnapshot;
  setDropOverlayChoice(choice: PendingDropChoice, copy: DropOverlayCopy): ShellWorkspaceSnapshot;
  clearDropOverlay(): ShellWorkspaceSnapshot;
  clearTrackedPreview(): ShellWorkspaceSnapshot;
  trackPreviewResultMetadata(metadata: PreviewCleanupMetadata): ShellWorkspaceSnapshot;
  hasTrackedPreviewCleanup(): boolean;
  hasPreviewCleanupRoot(): boolean;
  getCachedPreviewPathForEntry(entryPath: string): string | null;
}

function createEmptyPreviewCleanupMetadata(): PreviewCleanupMetadata {
  return {
    cleanupRoot: "",
    previewPath: "",
    entryPath: "",
  };
}

function cloneDropOverlayCopy(copy: DropOverlayCopy): DropOverlayCopy {
  const clone: DropOverlayCopy = {
    titleKey: copy.titleKey,
    messageKey: copy.messageKey,
    ...(copy.messageParams ? { messageParams: { ...copy.messageParams } } : {}),
    target: copy.target,
  };
  const withSupport = copy.supportKey !== undefined ? { ...clone, supportKey: copy.supportKey } : clone;
  if (copy.showActions !== undefined) {
    return { ...withSupport, showActions: copy.showActions };
  }
  return withSupport;
}

function freezeDropOverlayCopy(copy: DropOverlayCopy): DropOverlayCopy {
  const clone = cloneDropOverlayCopy(copy);
  if (clone.messageParams) {
    Object.freeze(clone.messageParams);
  }
  return Object.freeze(clone);
}

function clonePendingDropChoice(choice: PendingDropChoice): PendingDropChoice {
  return {
    kind: "askAction",
    surface: choice.surface,
    archivePaths: [...choice.archivePaths],
    sourcePaths: [...choice.sourcePaths],
  };
}

function freezePendingDropChoice(choice: PendingDropChoice): PendingDropChoice {
  const clone = clonePendingDropChoice(choice);
  return Object.freeze({
    ...clone,
    archivePaths: Object.freeze([...clone.archivePaths]) as unknown as string[],
    sourcePaths: Object.freeze([...clone.sourcePaths]) as unknown as string[],
  });
}

function isJobOnlyQuickActionRequest(request?: QuickActionRequestDto | null): boolean {
  return Boolean(request && quickActionWindowDisposition(request.kind) === "disposableTask");
}

function hasQuickActionJobs(state: QuickActionStartupStateDto): boolean {
  return Boolean(state.quickActionJobs?.length);
}

export function createShellWorkspace(): ShellWorkspace {
  let activeMode: WorkspaceDropMode = "compress";
  let operationalStatus = "";
  let jobDrawerOpen = false;
  let dropOverlayMode: DropOverlayMode = "idle";
  let dropOverlayCopy: DropOverlayCopy | null = null;
  let pendingDropChoice: PendingDropChoice | null = null;
  let previewCleanup = createEmptyPreviewCleanupMetadata();
  let quickActionWindowMode: QuickActionWindowMode = "normal";
  let quickActionWindowShown = false;

  function getSnapshot(): ShellWorkspaceSnapshot {
    return Object.freeze({
      activeMode,
      operationalStatus,
      jobDrawerOpen,
      dropOverlay: Object.freeze({
        mode: dropOverlayMode,
        copy: dropOverlayCopy ? freezeDropOverlayCopy(dropOverlayCopy) : null,
        pendingChoice: pendingDropChoice ? freezePendingDropChoice(pendingDropChoice) : null,
      }),
      previewCleanup: Object.freeze({ ...previewCleanup }),
      quickActionWindow: Object.freeze({
        mode: quickActionWindowMode,
        shown: quickActionWindowShown,
      }),
    });
  }

  return {
    getSnapshot,

    setWorkspaceMode(mode) {
      activeMode = mode;
      return getSnapshot();
    },

    setOperationalStatus(message) {
      operationalStatus = message;
      return getSnapshot();
    },

    setJobDrawerOpen(open) {
      jobDrawerOpen = open;
      return getSnapshot();
    },

    setQuickActionWindowMode(mode) {
      quickActionWindowMode = mode;
      return getSnapshot();
    },

    setQuickActionWindowShown(shown) {
      quickActionWindowShown = shown;
      return getSnapshot();
    },

    isQuickActionJobMode() {
      return quickActionWindowMode === "jobOnly" || quickActionWindowMode === "background";
    },

    isQuickActionWindowBackgrounded() {
      return quickActionWindowMode === "background";
    },

    selectQuickActionStartupRevealTarget(state) {
      if (
        state.launchedForQuickAction &&
        !state.error &&
        (state.windowDisposition === "disposableTask"
          || (state.windowDisposition === undefined
            && (hasQuickActionJobs(state) || isJobOnlyQuickActionRequest(state.quickAction))))
      ) {
        return "jobOnly";
      }

      return "normal";
    },

    setDropOverlay(mode, copy) {
      dropOverlayMode = mode;
      dropOverlayCopy = copy ? cloneDropOverlayCopy(copy) : null;
      pendingDropChoice = null;
      return getSnapshot();
    },

    setDropOverlayChoice(choice, copy) {
      dropOverlayMode = "choosing";
      dropOverlayCopy = cloneDropOverlayCopy(copy);
      pendingDropChoice = clonePendingDropChoice(choice);
      return getSnapshot();
    },

    clearDropOverlay() {
      dropOverlayMode = "idle";
      dropOverlayCopy = null;
      pendingDropChoice = null;
      return getSnapshot();
    },

    clearTrackedPreview() {
      previewCleanup = createEmptyPreviewCleanupMetadata();
      return getSnapshot();
    },

    trackPreviewResultMetadata(metadata) {
      previewCleanup = {
        cleanupRoot: metadata.cleanupRoot,
        previewPath: metadata.previewPath,
        entryPath: metadata.entryPath,
      };
      return getSnapshot();
    },

    hasTrackedPreviewCleanup() {
      return Boolean(previewCleanup.cleanupRoot || previewCleanup.previewPath);
    },

    hasPreviewCleanupRoot() {
      return Boolean(previewCleanup.cleanupRoot);
    },

    getCachedPreviewPathForEntry(entryPath) {
      if (previewCleanup.entryPath !== entryPath || !previewCleanup.previewPath) {
        return null;
      }

      return previewCleanup.previewPath;
    },
  };
}
