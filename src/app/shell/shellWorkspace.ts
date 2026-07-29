import type { DropIntentDecision, WorkspaceDropMode } from "../dropIntent";

export type DropOverlayMode = "idle" | "active" | "choosing";
export type DropOverlayTarget = "compress" | "extract" | "choose" | "blocked" | "unknown";
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
  readonly shown: boolean;
}

export interface ShellWorkspaceSnapshot {
  readonly activeMode: WorkspaceDropMode;
  readonly operationalStatus: string;
  readonly dropOverlay: DropOverlaySnapshot;
  readonly previewCleanup: PreviewCleanupMetadata;
  readonly quickActionWindow: QuickActionWindowSnapshot;
}

export interface ShellWorkspace {
  getSnapshot(): ShellWorkspaceSnapshot;
  setWorkspaceMode(mode: WorkspaceDropMode): ShellWorkspaceSnapshot;
  setOperationalStatus(message: string): ShellWorkspaceSnapshot;
  setQuickActionWindowShown(shown: boolean): ShellWorkspaceSnapshot;
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

export function createShellWorkspace(): ShellWorkspace {
  let activeMode: WorkspaceDropMode = "compress";
  let operationalStatus = "";
  let dropOverlayMode: DropOverlayMode = "idle";
  let dropOverlayCopy: DropOverlayCopy | null = null;
  let pendingDropChoice: PendingDropChoice | null = null;
  let previewCleanup = createEmptyPreviewCleanupMetadata();
  let quickActionWindowShown = false;

  function getSnapshot(): ShellWorkspaceSnapshot {
    return Object.freeze({
      activeMode,
      operationalStatus,
      dropOverlay: Object.freeze({
        mode: dropOverlayMode,
        copy: dropOverlayCopy ? freezeDropOverlayCopy(dropOverlayCopy) : null,
        pendingChoice: pendingDropChoice ? freezePendingDropChoice(pendingDropChoice) : null,
      }),
      previewCleanup: Object.freeze({ ...previewCleanup }),
      quickActionWindow: Object.freeze({
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

    setQuickActionWindowShown(shown) {
      quickActionWindowShown = shown;
      return getSnapshot();
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
