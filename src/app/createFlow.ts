import type { CreateState, StartCreateRequest } from "../api/types";

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

export type CreatePathHelpers = {
  nativeParentPath: (path: string) => string;
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

export function createStateAfterDestinationEdit(
  state: CreateState,
  hasCurrentPlan: boolean,
): CreateState {
  return state === "error" && hasCurrentPlan ? "ready" : state;
}

export type BuildStartCreateRequestInput = {
  sources: string[];
  destinationPath: string;
  format: CreateArchiveFormat;
  cleanSource: boolean;
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
