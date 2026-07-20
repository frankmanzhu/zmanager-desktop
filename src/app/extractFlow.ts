import type { StartExtractRequest } from "../api/types";
import { normalizeArchivePath } from "./archiveTree";

export type ExtractMode = "archive" | "selection";
export type ExtractPathMode = "full" | "current" | "none";
export type ExtractOverwritePolicy = StartExtractRequest["overwrite"];
export type TzapRestorePolicy = StartExtractRequest["tzapRestorePolicy"];

export type ExtractStartInput = Readonly<{
  destinationBasePath: string;
  useSubfolder: boolean;
  subfolder: string;
  pathMode: ExtractPathMode;
  overwrite: ExtractOverwritePolicy;
  stripComponents: string | number;
  deduplicateRoot: boolean;
  tzapRestorePolicy?: TzapRestorePolicy;
  tzapAllowDegraded?: boolean;
  tzapAllowAbsoluteSymlinks?: boolean;
  password?: string;
}>;

export type ResolvedExtractStartInput = Readonly<{
  destination: string | null;
  destinationValid: boolean;
  overwrite: ExtractOverwritePolicy;
  stripComponents: number;
  password?: string;
  entryReferences: readonly string[];
  tzapRestorePolicy: TzapRestorePolicy;
  tzapAllowDegraded: boolean;
  tzapAllowAbsoluteSymlinks: boolean;
}>;

export type ResolveExtractStartInputContext = Readonly<{
  currentFolder: string;
  allEntryPaths: readonly string[];
  entryReferences: readonly string[];
  joinNativePath(parentPath: string, childName: string): string;
}>;

export type BuildStartExtractRequestInput = {
  archivePath: string;
  destinationPath: string;
  overwrite: ExtractOverwritePolicy;
  destinationCollisionStrategy?: StartExtractRequest["destinationCollisionStrategy"];
  stripComponents: number;
  password?: string;
  entryPaths?: string[];
  tzapRestorePolicy?: TzapRestorePolicy;
  tzapAllowDegraded?: boolean;
  tzapAllowAbsoluteSymlinks?: boolean;
};

export function buildStartExtractRequest(input: BuildStartExtractRequestInput): StartExtractRequest {
  return {
    archivePath: input.archivePath,
    destinationPath: input.destinationPath,
    overwrite: input.overwrite,
    ...(input.destinationCollisionStrategy
      ? { destinationCollisionStrategy: input.destinationCollisionStrategy }
      : {}),
    ...(input.entryPaths ? { entryPaths: [...input.entryPaths] } : {}),
    stripComponents: input.stripComponents,
    tzapRestorePolicy: input.tzapRestorePolicy ?? "portable",
    tzapAllowDegraded: input.tzapAllowDegraded ?? false,
    tzapAllowAbsoluteSymlinks: input.tzapAllowAbsoluteSymlinks ?? false,
    ...(input.password ? { password: input.password } : {}),
  };
}

export function resolveExtractStartInput(
  input: ExtractStartInput,
  context: ResolveExtractStartInputContext,
): ResolvedExtractStartInput {
  const destination = resolveExtractDestination(input, context.joinNativePath);
  const entryReferences = [...context.entryReferences];
  return {
    destination,
    destinationValid: destination !== null,
    overwrite: input.overwrite,
    stripComponents: resolveExtractStripComponents({
      stripComponents: input.stripComponents,
      pathMode: input.pathMode,
      currentFolder: context.currentFolder,
      allEntryPaths: context.allEntryPaths,
      entryReferences,
      deduplicateRoot: input.deduplicateRoot,
    }),
    ...(input.password?.trim() ? { password: input.password.trim() } : {}),
    entryReferences,
    tzapRestorePolicy: input.tzapRestorePolicy ?? "portable",
    tzapAllowDegraded: input.tzapAllowDegraded ?? false,
    tzapAllowAbsoluteSymlinks: input.tzapAllowAbsoluteSymlinks ?? false,
  };
}

export function resolveExtractDestination(
  input: Pick<ExtractStartInput, "destinationBasePath" | "useSubfolder" | "subfolder">,
  joinNativePath: ResolveExtractStartInputContext["joinNativePath"],
): string | null {
  const baseDestination = input.destinationBasePath.trim();
  if (!baseDestination) {
    return null;
  }

  if (!input.useSubfolder) {
    return baseDestination;
  }

  const subfolder = input.subfolder.trim();
  return subfolder ? joinNativePath(baseDestination, subfolder) : baseDestination;
}

export function resolveExtractStripComponents(input: Readonly<{
  stripComponents: string | number;
  pathMode: ExtractPathMode;
  currentFolder: string;
  allEntryPaths: readonly string[];
  entryReferences: readonly string[];
  deduplicateRoot: boolean;
}>): number {
  const references = input.entryReferences.length > 0
    ? [...input.entryReferences]
    : [...input.allEntryPaths];
  let stripComponents = Math.max(0, numberOrZero(input.stripComponents));

  if (input.pathMode === "current") {
    stripComponents = Math.max(stripComponents, archivePathDepth(input.currentFolder));
  }
  if (input.pathMode === "none") {
    let maxDepth = 0;
    for (const path of references) {
      maxDepth = Math.max(maxDepth, archivePathDepth(path));
    }
    stripComponents = Math.max(stripComponents, maxDepth);
  }

  if (input.deduplicateRoot && hasSingleRootFolder(references)) {
    stripComponents += 1;
  }

  return stripComponents;
}

function numberOrZero(value: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : Math.trunc(parsed);
}

function archivePathDepth(entryPath: string): number {
  return normalizeArchivePath(entryPath).split("/").filter(Boolean).length;
}

function hasSingleRootFolder(entryPaths: readonly string[]): boolean {
  const normalized = entryPaths
    .map((entryPath) => normalizeArchivePath(entryPath).split("/").filter(Boolean))
    .filter((parts) => parts.length > 0);
  if (!normalized.length) {
    return false;
  }
  const root = normalized[0][0];
  return root ? normalized.every((parts) => parts[0] === root) : false;
}
