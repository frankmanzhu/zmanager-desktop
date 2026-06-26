const TZAP_EXTENSION_SUFFIX = ".tzap";
const TZAP_VOLUME_MARKER = ".vol";

export const SUPPORTED_SINGLE_ARCHIVE_EXTENSIONS = [
  "7z",
  "apk",
  "appx",
  "br",
  "bz2",
  "cab",
  "cbr",
  "cpio",
  "deb",
  "gz",
  "ipa",
  "iso",
  "jar",
  "lz",
  "lz4",
  "lzma",
  "lzo",
  "lrz",
  "rar",
  "rpm",
  "tar",
  "tbz2",
  "tgz",
  "txz",
  "tzap",
  "tzst",
  "war",
  "xar",
  "xpi",
  "xz",
  "z",
  "zip",
  "zipx",
  "zst",
] as const;

export const SUPPORTED_COMPOUND_ARCHIVE_EXTENSIONS = [
  "tar.br",
  "tar.bz2",
  "tar.gz",
  "tar.lz",
  "tar.lz4",
  "tar.lzma",
  "tar.lzo",
  "tar.lrz",
  "tar.xz",
  "tar.z",
  "tar.zst",
] as const;

export const SUPPORTED_SPLIT_ARCHIVE_FILE_SUFFIXES = [".7z.001", ".vol000.tzap"] as const;

const SUPPORTED_SINGLE_ARCHIVE_EXTENSION_SET = new Set<string>(SUPPORTED_SINGLE_ARCHIVE_EXTENSIONS);
const SUPPORTED_COMPOUND_ARCHIVE_EXTENSION_SET = new Set<string>(SUPPORTED_COMPOUND_ARCHIVE_EXTENSIONS);

export const SUPPORTED_ARCHIVE_FILE_SUFFIXES = [
  ...SUPPORTED_COMPOUND_ARCHIVE_EXTENSIONS.map((extension) => `.${extension}`),
  ...SUPPORTED_SINGLE_ARCHIVE_EXTENSIONS.map((extension) => `.${extension}`),
  ...SUPPORTED_SPLIT_ARCHIVE_FILE_SUFFIXES,
].sort((lhs, rhs) => {
  if (lhs.length === rhs.length) {
    return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
  }

  return rhs.length - lhs.length;
});

export function isSupportedArchivePath(path: string): boolean {
  const name = getLastPathComponent(path).toLowerCase();
  if (isTzapVolumeArchiveName(name)) {
    return true;
  }

  if (SUPPORTED_SPLIT_ARCHIVE_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return true;
  }

  if (SUPPORTED_COMPOUND_ARCHIVE_EXTENSION_SET.has(getCompoundExtension(name))) {
    return true;
  }

  return SUPPORTED_SINGLE_ARCHIVE_EXTENSION_SET.has(getPathExtension(name));
}

export function baseNameWithoutKnownArchiveExtension(path: string): string {
  const name = getLastPathComponent(path);
  const lowercasedName = name.toLowerCase();
  const tzapVolumeBaseName = baseNameWithoutTzapVolumeSuffix(name);
  if (tzapVolumeBaseName !== null) {
    return tzapVolumeBaseName;
  }

  const knownSuffix = SUPPORTED_ARCHIVE_FILE_SUFFIXES.find((suffix) => lowercasedName.endsWith(suffix));
  if (knownSuffix) {
    return name.slice(0, -knownSuffix.length);
  }

  return deletePathExtension(name);
}

export function isTzapVolumeArchiveName(name: string): boolean {
  return baseNameWithoutTzapVolumeSuffix(getLastPathComponent(name)) !== null;
}

export function getKnownArchiveSuffix(path: string): string | null {
  const name = getLastPathComponent(path).toLowerCase();
  if (isTzapVolumeArchiveName(name)) {
    return name.slice(baseNameWithoutKnownArchiveExtension(name).length);
  }

  return SUPPORTED_ARCHIVE_FILE_SUFFIXES.find((suffix) => name.endsWith(suffix)) ?? null;
}

function baseNameWithoutTzapVolumeSuffix(name: string): string | null {
  const lowercasedName = name.toLowerCase();
  if (!lowercasedName.endsWith(TZAP_EXTENSION_SUFFIX)) {
    return null;
  }

  const stem = name.slice(0, -TZAP_EXTENSION_SUFFIX.length);
  const markerIndex = stem.toLowerCase().lastIndexOf(TZAP_VOLUME_MARKER);
  if (markerIndex < 0) {
    return null;
  }

  const baseName = stem.slice(0, markerIndex);
  const digits = stem.slice(markerIndex + TZAP_VOLUME_MARKER.length);
  if (!baseName || !isAsciiDigits(digits)) {
    return null;
  }

  return baseName;
}

function getLastPathComponent(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function getPathExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === name.length - 1) {
    return "";
  }

  return name.slice(dotIndex + 1).toLowerCase();
}

function getCompoundExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 3) {
    return "";
  }

  return `${parts.at(-2)}.${parts.at(-1)}`;
}

function deletePathExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return name;
  }

  return name.slice(0, dotIndex);
}

function isAsciiDigits(value: string): boolean {
  return value.length > 0 && /^[0-9]+$/.test(value);
}
