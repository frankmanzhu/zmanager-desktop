import type { ExtractMode, ExtractOverwritePolicy, ExtractPathMode, ExtractStartInput } from "../extractFlow";

export type ExtractWorkspaceOptionPatch = Partial<Pick<
  ExtractWorkspaceSnapshot,
  "destinationPath" | "pathMode" | "overwrite" | "stripComponents" | "deduplicateRoot" | "passwordPromptOpen"
>>;

export type ExtractWorkspaceDefaults = Readonly<{
  destinationPath: string;
  pathMode: ExtractPathMode;
  overwrite: ExtractOverwritePolicy;
  stripComponents: number;
  deduplicateRoot: boolean;
}>;

export type ExtractWorkspaceSnapshot = Readonly<{
  destinationPath: string;
  pathMode: ExtractPathMode;
  overwrite: ExtractOverwritePolicy;
  stripComponents: number;
  deduplicateRoot: boolean;
  usesGlobalDefaults: boolean;
  passwordPromptOpen: boolean;
}>;

export type ExtractWorkspace = Readonly<{
  getSnapshot(): ExtractWorkspaceSnapshot;
  applyDefaults(defaults: ExtractWorkspaceDefaults): ExtractWorkspaceSnapshot;
  setOptions(patch: ExtractWorkspaceOptionPatch): ExtractWorkspaceSnapshot;
  resetToDefaults(): ExtractWorkspaceSnapshot;
  buildStartInput(password?: string): ExtractStartInput;
}>;

const FALLBACK_DEFAULTS: ExtractWorkspaceDefaults = Object.freeze({
  destinationPath: "",
  pathMode: "full",
  overwrite: "ask",
  stripComponents: 0,
  deduplicateRoot: false,
});

export function createExtractWorkspace(initialDefaults: ExtractWorkspaceDefaults = FALLBACK_DEFAULTS): ExtractWorkspace {
  let defaults = normalizeDefaults(initialDefaults);
  let state = snapshotFromDefaults(defaults);

  return {
    getSnapshot() {
      return cloneSnapshot(state);
    },

    applyDefaults(nextDefaults) {
      defaults = normalizeDefaults(nextDefaults);
      state = snapshotFromDefaults(defaults);
      return cloneSnapshot(state);
    },

    setOptions(patch) {
      const changesDurableOption = Object.keys(patch).some((key) => key !== "passwordPromptOpen");
      state = {
        ...state,
        ...normalizedPatch(patch, state),
        usesGlobalDefaults: changesDurableOption ? false : state.usesGlobalDefaults,
      };
      return cloneSnapshot(state);
    },

    resetToDefaults() {
      state = snapshotFromDefaults(defaults);
      return cloneSnapshot(state);
    },

    buildStartInput(password = "") {
      return {
        destinationBasePath: state.destinationPath,
        useSubfolder: false,
        subfolder: "",
        pathMode: state.pathMode,
        overwrite: state.overwrite,
        stripComponents: String(state.stripComponents),
        deduplicateRoot: state.deduplicateRoot,
        ...(password.trim() ? { password: password.trim() } : {}),
      };
    },
  };
}

export function extractModeForSelection(selectedCount: number): ExtractMode {
  return selectedCount > 0 ? "selection" : "archive";
}

function snapshotFromDefaults(defaults: ExtractWorkspaceDefaults): ExtractWorkspaceSnapshot {
  return {
    ...defaults,
    usesGlobalDefaults: true,
    passwordPromptOpen: false,
  };
}

function normalizeDefaults(defaults: ExtractWorkspaceDefaults): ExtractWorkspaceDefaults {
  return {
    destinationPath: defaults.destinationPath.trim(),
    pathMode: normalizePathMode(defaults.pathMode),
    overwrite: normalizeOverwrite(defaults.overwrite),
    stripComponents: normalizeStripComponents(defaults.stripComponents),
    deduplicateRoot: Boolean(defaults.deduplicateRoot),
  };
}

function normalizedPatch(
  patch: ExtractWorkspaceOptionPatch,
  current: ExtractWorkspaceSnapshot,
): ExtractWorkspaceOptionPatch {
  return {
    ...(patch.destinationPath === undefined ? {} : { destinationPath: patch.destinationPath }),
    ...(patch.pathMode === undefined ? {} : { pathMode: normalizePathMode(patch.pathMode) }),
    ...(patch.overwrite === undefined ? {} : { overwrite: normalizeOverwrite(patch.overwrite) }),
    ...(patch.stripComponents === undefined
      ? {}
      : { stripComponents: normalizeStripComponents(patch.stripComponents) }),
    ...(patch.deduplicateRoot === undefined ? {} : { deduplicateRoot: Boolean(patch.deduplicateRoot) }),
    ...(patch.passwordPromptOpen === undefined
      ? {}
      : { passwordPromptOpen: Boolean(patch.passwordPromptOpen) }),
    destinationPath: patch.destinationPath ?? current.destinationPath,
  };
}

function normalizePathMode(value: ExtractPathMode): ExtractPathMode {
  return value === "current" || value === "none" ? value : "full";
}

function normalizeOverwrite(value: ExtractOverwritePolicy): ExtractOverwritePolicy {
  return value === "refuse" || value === "replace" || value === "rename" ? value : "ask";
}

function normalizeStripComponents(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function cloneSnapshot(snapshot: ExtractWorkspaceSnapshot): ExtractWorkspaceSnapshot {
  return { ...snapshot };
}
