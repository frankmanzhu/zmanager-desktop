import type { CreatePlanEntryDto, CreatePlanResponse, CreateState, StartCreateRequest } from "../api/types";
import {
  getParentArchivePath,
  isArchivePathInFolder,
  normalizeArchivePath,
} from "./archiveTree";
import { getPathBasename } from "./formatting";
import {
  buildHierarchicalRows,
  type HierarchicalTableRow,
} from "./hierarchicalTable";

export type CreateArchiveFormat = StartCreateRequest["format"];

export const CREATE_ARCHIVE_FILTERS = [
  {
    name: "Archive",
    extensions: ["zip", "tzst", "tar.zst", "tzap", "7z"],
  },
];

const CREATE_FORMAT_EXTENSIONS = {
  zip: "zip",
  tarZst: "tzst",
  tzap: "tzap",
  sevenZ: "7z",
} satisfies Record<CreateArchiveFormat, string>;

const CREATE_FORMAT_ALLOWED_EXTENSIONS = {
  zip: ["zip"],
  tarZst: ["tzst", "tar.zst"],
  tzap: ["tzap"],
  sevenZ: ["7z"],
} satisfies Record<CreateArchiveFormat, string[]>;

const RECOGNIZED_CREATE_EXTENSIONS = ["tar.zst", "zip", "tzst", "tzap", "7z"];
const CREATE_PASSWORD_FORMATS = new Set<CreateArchiveFormat>(["zip", "tzap", "sevenZ"]);

export const TZAP_RECOVERY_PERCENTAGE_DEFAULT = 5;
export const TZAP_RECOVERY_PERCENTAGE_MIN = 0;
export const TZAP_RECOVERY_PERCENTAGE_MAX = 100;

export type CreateArchiveUnavailableReason =
  | "needsSources"
  | "needsIncludedEntries"
  | "needsDestination"
  | "planning"
  | "needsPlan"
  | "starting";

export type CreateArchiveAvailabilityInput = {
  sourceCount: number;
  includedEntryCount?: number;
  destinationPath: string;
  planState: CreateState;
  hasPlan: boolean;
  submissionInFlight: boolean;
};

export type CreatePathHelpers = {
  nativeParentPath: (path: string) => string;
};

export type CreatePlanRow = HierarchicalTableRow<CreatePlanEntryDto>;

export type CreatePlanInclusionState = "included" | "excluded" | "partial";

export type BuildCreatePlanRowsOptions = {
  entries: readonly CreatePlanEntryDto[];
  currentFolder?: string | null;
};

export type ApplyCreatePlanPathInclusionInput = {
  entries: readonly CreatePlanEntryDto[];
  excludedPaths: ReadonlySet<string> | readonly string[];
  path: string;
  included: boolean;
};

type ParsedDirectoryPath = {
  root: string;
  segments: string[];
  separator: "/" | "\\";
};

export function getArchiveName(path: string, fallback: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.at(-1) ?? fallback;
}

export function getCreateFormatExtension(format: CreateArchiveFormat): string {
  return CREATE_FORMAT_EXTENSIONS[format];
}

export function getCreateArchiveExtension(path: string): string | null {
  const normalized = path.toLowerCase();
  return RECOGNIZED_CREATE_EXTENSIONS.find((extension) => normalized.endsWith(`.${extension}`)) ?? null;
}

export function withCreateArchiveExtension(path: string, format: CreateArchiveFormat): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return trimmed;
  }

  const existingExtension = getCreateArchiveExtension(trimmed);
  if (existingExtension && CREATE_FORMAT_ALLOWED_EXTENSIONS[format].includes(existingExtension)) {
    return trimmed;
  }

  if (existingExtension) {
    const basePath = trimmed.slice(0, -(existingExtension.length + 1));
    return `${basePath}.${getCreateFormatExtension(format)}`;
  }

  return `${trimmed}.${getCreateFormatExtension(format)}`;
}

export function suggestedCreateArchiveName(
  sources: string[],
  format: CreateArchiveFormat,
  fallback = "archive",
): string {
  const firstSource = sources[0];
  const sourceName = firstSource ? getArchiveName(firstSource, fallback) : fallback;
  const safeName = sourceName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || fallback;
  return `${safeName}.${getCreateFormatExtension(format)}`;
}

export function createFormatSupportsPassword(format: CreateArchiveFormat): boolean {
  return CREATE_PASSWORD_FORMATS.has(format);
}

export function normalizeTzapRecoveryPercentage(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(
    TZAP_RECOVERY_PERCENTAGE_MAX,
    Math.max(TZAP_RECOVERY_PERCENTAGE_MIN, Math.floor(value)),
  );
}

export function normalizeCreateVolumeSize(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function parseDirectoryPath(directory: string): ParsedDirectoryPath | null {
  const trimmed = directory.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    return null;
  }

  const separator = trimmed.includes("\\") ? "\\" : "/";
  const normalized = trimmed.replace(/\\/g, "/");
  const uncMatch = normalized.match(/^\/\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (uncMatch) {
    const segments = (uncMatch[3] ?? "").split("/").filter(Boolean);
    return {
      root: `//${uncMatch[1]}/${uncMatch[2]}`,
      segments,
      separator,
    };
  }

  const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/(.*))?$/);
  if (driveMatch) {
    const segments = (driveMatch[2] ?? "").split("/").filter(Boolean);
    return {
      root: driveMatch[1],
      segments,
      separator,
    };
  }

  if (normalized.startsWith("/")) {
    return {
      root: "/",
      segments: normalized.slice(1).split("/").filter(Boolean),
      separator: "/",
    };
  }

  return {
    root: "",
    segments: normalized.split("/").filter(Boolean),
    separator,
  };
}

function isCaseInsensitiveRoot(root: string): boolean {
  return /^[A-Za-z]:$/.test(root) || root.startsWith("//");
}

function samePathPart(left: string, right: string, caseInsensitive: boolean): boolean {
  return caseInsensitive ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function formatParsedDirectoryPath(parsed: ParsedDirectoryPath, segments: string[]): string | null {
  const separator = parsed.separator;
  if (parsed.root.startsWith("//")) {
    const root = parsed.root.replace(/\//g, separator);
    return segments.length ? `${root}${separator}${segments.join(separator)}` : root;
  }

  if (/^[A-Za-z]:$/.test(parsed.root)) {
    return segments.length
      ? `${parsed.root}${separator}${segments.join(separator)}`
      : `${parsed.root}${separator}`;
  }

  if (parsed.root === "/") {
    return segments.length ? `/${segments.join("/")}` : "/";
  }

  if (segments.length === 0) {
    return null;
  }

  return segments.join(separator);
}

export function commonSourceParentDirectory(
  sources: readonly string[],
  pathHelpers: CreatePathHelpers,
): string | null {
  const parents = sources
    .map((source) => pathHelpers.nativeParentPath(source))
    .map((parent) => parseDirectoryPath(parent))
    .filter((parent): parent is ParsedDirectoryPath => parent !== null);

  if (parents.length === 0) {
    return null;
  }

  const [firstParent, ...remainingParents] = parents;
  const caseInsensitive = isCaseInsensitiveRoot(firstParent.root);
  for (const parent of remainingParents) {
    if (!samePathPart(firstParent.root, parent.root, caseInsensitive)) {
      return null;
    }
  }

  const commonSegments: string[] = [];
  for (let index = 0; index < firstParent.segments.length; index += 1) {
    const segment = firstParent.segments[index];
    if (parents.every((parent) => samePathPart(segment, parent.segments[index] ?? "", caseInsensitive))) {
      commonSegments.push(segment);
      continue;
    }
    break;
  }

  return formatParsedDirectoryPath(firstParent, commonSegments);
}

export function buildCreatePlanRows(options: BuildCreatePlanRowsOptions): CreatePlanRow[] {
  const currentFolder = normalizeArchivePath(options.currentFolder);
  const rows = buildHierarchicalRows({
    entries: options.entries,
    getPath: (entry) => entry.path,
    isFolderEntry: (entry) => entry.kind === "directory",
    currentFolder,
    showParentRow: Boolean(currentFolder),
  });

  const parentRows = rows.filter((row) => row.rowType === "parent");
  const sortedFolders = rows
    .filter((row): row is Extract<CreatePlanRow, { rowType: "folder" }> => row.rowType === "folder")
    .sort((left, right) => left.name.localeCompare(right.name));
  const sortedEntries = rows
    .filter((row): row is Extract<CreatePlanRow, { rowType: "entry" }> => row.rowType === "entry")
    .sort((left, right) => left.name.localeCompare(right.name));
  return [...parentRows, ...sortedFolders, ...sortedEntries];
}

export function createPlanEntriesForPath(
  entries: readonly CreatePlanEntryDto[],
  path: string,
): CreatePlanEntryDto[] {
  const normalizedPath = normalizeArchivePath(path);
  if (!normalizedPath) {
    return [...entries];
  }
  return entries.filter((entry) => isArchivePathInFolder(entry.path, normalizedPath));
}

export function isCreatePlanPathIncluded(
  excludedPaths: ReadonlySet<string> | readonly string[],
  path: string,
): boolean {
  return !normalizeExcludedCreatePlanPaths(excludedPaths).has(normalizeArchivePath(path));
}

export function createPlanRowInclusionState(
  row: CreatePlanRow,
  entries: readonly CreatePlanEntryDto[],
  excludedPaths: ReadonlySet<string> | readonly string[],
): CreatePlanInclusionState {
  if (row.rowType === "parent") {
    return "included";
  }

  const affectedEntries = createPlanEntriesForPath(entries, row.path);
  if (affectedEntries.length === 0) {
    return isCreatePlanPathIncluded(excludedPaths, row.path) ? "included" : "excluded";
  }

  const includedCount = affectedEntries.filter((entry) => isCreatePlanPathIncluded(excludedPaths, entry.path)).length;
  if (includedCount === 0) {
    return "excluded";
  }
  if (includedCount === affectedEntries.length) {
    return "included";
  }
  return "partial";
}

export function applyCreatePlanPathInclusion(
  input: ApplyCreatePlanPathInclusionInput,
): Set<string> {
  const excludedPaths = normalizeExcludedCreatePlanPaths(input.excludedPaths);
  const affectedEntries = createPlanEntriesForPath(input.entries, input.path);
  const paths = affectedEntries.length
    ? affectedEntries.map((entry) => normalizeArchivePath(entry.path))
    : [normalizeArchivePath(input.path)];

  for (const entryPath of paths) {
    if (!entryPath) {
      continue;
    }
    if (input.included) {
      excludedPaths.delete(entryPath);
      let parent = getParentArchivePath(entryPath) ?? "";
      while (parent) {
        excludedPaths.delete(parent);
        parent = getParentArchivePath(parent) ?? "";
      }
    } else {
      excludedPaths.add(entryPath);
    }
  }

  return excludedPaths;
}

export function filterCreatePlanByIncludedPaths(
  plan: CreatePlanResponse,
  excludedPaths: ReadonlySet<string> | readonly string[],
): CreatePlanResponse {
  const includedEntries = plan.planEntries.filter((entry) => isCreatePlanPathIncluded(excludedPaths, entry.path));
  const excludedByUser = plan.planEntries.filter((entry) => !isCreatePlanPathIncluded(excludedPaths, entry.path));
  const excludedBytes = excludedByUser.reduce((total, entry) => total + (entry.size ?? 0), 0);
  return {
    ...plan,
    includedCount: includedEntries.length,
    excludedCount: plan.excludedCount + excludedByUser.length,
    totalBytes: includedEntries.reduce((total, entry) => total + (entry.size ?? 0), 0),
    excludedBytes: plan.excludedBytes + excludedBytes,
    entries: includedEntries.map((entry) => entry.path),
    planEntries: includedEntries,
    excludedEntries: [
      ...plan.excludedEntries,
      ...excludedByUser.map((entry) => entry.path),
    ],
  };
}

export function sourcePathForCreatePlanRow(
  row: CreatePlanRow,
  entries: readonly CreatePlanEntryDto[],
  createSources: readonly string[],
): string {
  if (row.rowType === "parent") {
    return "";
  }

  const sourceFromArchivePath = sourcePathForCreatePlanArchivePath(row.path, entries, createSources);
  if (sourceFromArchivePath) {
    return sourceFromArchivePath;
  }

  if (row.entry?.sourcePath) {
    const sourceFromNativePath = sourcePathForNativePath(row.entry.sourcePath, createSources);
    if (sourceFromNativePath) {
      return sourceFromNativePath;
    }
  }

  const descendantSources = new Set(
    createPlanEntriesForPath(entries, row.path)
      .map((entry) => sourcePathForNativePath(entry.sourcePath, createSources))
      .filter(Boolean),
  );
  if (descendantSources.size === 1) {
    return descendantSources.values().next().value ?? "";
  }

  return createSources.find((sourcePath) => getPathBasename(sourcePath) === row.path) ?? "";
}

export function isCreatePlanRevisionCurrent(resultRevision: number, currentRevision: number): boolean {
  return resultRevision === currentRevision;
}

export function createStateAfterDestinationEdit(
  state: CreateState,
  hasCurrentPlan: boolean,
): CreateState {
  return state === "error" && hasCurrentPlan ? "ready" : state;
}

export function createArchiveUnavailableReason(
  input: CreateArchiveAvailabilityInput,
): CreateArchiveUnavailableReason | null {
  if (input.submissionInFlight) {
    return "starting";
  }
  if (input.sourceCount === 0) {
    return "needsSources";
  }
  if (input.includedEntryCount !== undefined && input.includedEntryCount === 0) {
    return "needsIncludedEntries";
  }
  if (input.destinationPath.trim().length === 0) {
    return "needsDestination";
  }
  if (input.planState === "loading") {
    return "planning";
  }
  if (input.planState !== "ready" || !input.hasPlan) {
    return "needsPlan";
  }
  return null;
}

export type BuildStartCreateRequestInput = {
  sources: string[];
  destinationPath: string;
  format: CreateArchiveFormat;
  cleanSource: boolean;
  excludeNames?: string[];
  excludeArchivePaths?: string[];
  includeArchivePaths?: string[];
  respectGitignore?: boolean;
  followSymlinks?: boolean;
  replaceExisting: boolean;
  destinationCollisionStrategy?: StartCreateRequest["destinationCollisionStrategy"];
  preserveMetadata: boolean;
  password?: string;
  compressionLevel?: number;
  volumeSize?: number;
  tzapRecoveryPercentage?: number;
};

export function buildStartCreateRequest(input: BuildStartCreateRequestInput): StartCreateRequest {
  const volumeSize = normalizeCreateVolumeSize(input.volumeSize);

  return {
    sources: [...input.sources],
    destinationPath: withCreateArchiveExtension(input.destinationPath, input.format),
    format: input.format,
    cleanSource: input.cleanSource,
    ...(input.excludeNames?.length ? { excludeNames: [...input.excludeNames] } : {}),
    ...(input.excludeArchivePaths?.length ? { excludeArchivePaths: [...input.excludeArchivePaths] } : {}),
    ...(input.includeArchivePaths?.length ? { includeArchivePaths: [...input.includeArchivePaths] } : {}),
    ...(input.respectGitignore !== undefined ? { respectGitignore: input.respectGitignore } : {}),
    ...(input.followSymlinks !== undefined ? { followSymlinks: input.followSymlinks } : {}),
    replaceExisting: input.replaceExisting,
    ...(input.destinationCollisionStrategy
      ? { destinationCollisionStrategy: input.destinationCollisionStrategy }
      : {}),
    preserveMetadata: input.preserveMetadata,
    ...(input.password && createFormatSupportsPassword(input.format) ? { password: input.password } : {}),
    ...(input.compressionLevel !== undefined ? { compressionLevel: input.compressionLevel } : {}),
    ...(volumeSize !== undefined ? { volumeSize } : {}),
    ...(input.format === "tzap"
      ? {
          tzapRecoveryPercentage:
            normalizeTzapRecoveryPercentage(input.tzapRecoveryPercentage) ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT,
        }
      : {}),
  };
}

function normalizeExcludedCreatePlanPaths(
  excludedPaths: ReadonlySet<string> | readonly string[],
): Set<string> {
  return new Set(Array.from(excludedPaths).map((path) => normalizeArchivePath(path)).filter(Boolean));
}

function sourcePathForCreatePlanArchivePath(
  archivePath: string,
  entries: readonly CreatePlanEntryDto[],
  createSources: readonly string[],
): string {
  const normalizedArchivePath = normalizeArchivePath(archivePath);
  if (!normalizedArchivePath) {
    return "";
  }

  const rootEntries = entries
    .filter((entry) => createSources.includes(entry.sourcePath))
    .sort((left, right) => normalizeArchivePath(right.path).length - normalizeArchivePath(left.path).length);
  const rootEntry = rootEntries.find((entry) => isArchivePathInFolder(normalizedArchivePath, entry.path));
  return rootEntry?.sourcePath ?? "";
}

function normalizedNativePathForCompare(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")
    ? normalized.toLowerCase()
    : normalized;
}

function sourcePathForNativePath(nativePath: string, createSources: readonly string[]): string {
  const normalizedNativePath = normalizedNativePathForCompare(nativePath);
  if (!normalizedNativePath) {
    return "";
  }

  return createSources.find((sourcePath) => {
    const normalizedSourcePath = normalizedNativePathForCompare(sourcePath);
    return normalizedNativePath === normalizedSourcePath
      || normalizedNativePath.startsWith(`${normalizedSourcePath}/`);
  }) ?? "";
}
