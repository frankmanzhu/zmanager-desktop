import type { StartCreateRequest } from "../api/types";

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

export type BuildStartCreateRequestInput = {
  sources: string[];
  destinationPath: string;
  format: CreateArchiveFormat;
  cleanSource: boolean;
  replaceExisting: boolean;
  preserveMetadata: boolean;
  password?: string;
  compressionLevel?: number;
  volumeSize?: number;
};

export function buildStartCreateRequest(input: BuildStartCreateRequestInput): StartCreateRequest {
  return {
    sources: [...input.sources],
    destinationPath: withCreateArchiveExtension(input.destinationPath, input.format),
    format: input.format,
    cleanSource: input.cleanSource,
    replaceExisting: input.replaceExisting,
    preserveMetadata: input.preserveMetadata,
    ...(input.password ? { password: input.password } : {}),
    ...(input.compressionLevel !== undefined ? { compressionLevel: input.compressionLevel } : {}),
    ...(input.volumeSize !== undefined ? { volumeSize: input.volumeSize } : {}),
  };
}
