const DEFAULT_EMPTY_VALUE = "-";
const BINARY_UNIT_SIZE = 1024;
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"] as const;
const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const TRAILING_PATH_SEPARATOR_PATTERN = /[\\/]+$/;
const PATH_SEPARATOR_PATTERN = /[\\/]+/;

const HTML_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export type FormatBytesOptions = {
  emptyValue?: string;
  fractionDigits?: number;
};

export type FormatDateOptions = {
  emptyValue?: string;
  locale?: string | string[];
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
};

export type FormatCompressionRatioOptions = {
  emptyValue?: string;
  fractionDigits?: number;
};

export function formatBytes(
  value?: number | null,
  options: FormatBytesOptions = {},
): string {
  const emptyValue = options.emptyValue ?? DEFAULT_EMPTY_VALUE;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return emptyValue;
  }

  if (value < BINARY_UNIT_SIZE) {
    return `${value} B`;
  }

  const fractionDigits = options.fractionDigits ?? 1;
  let scaled = value;
  let unitIndex = 0;

  while (scaled >= BINARY_UNIT_SIZE && unitIndex < BYTE_UNITS.length - 1) {
    scaled /= BINARY_UNIT_SIZE;
    unitIndex += 1;
  }

  return `${scaled.toFixed(fractionDigits)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatDate(
  value?: string | number | Date | null,
  options: FormatDateOptions = {},
): string {
  const emptyValue = options.emptyValue ?? DEFAULT_EMPTY_VALUE;
  if (value === undefined || value === null || value === "") {
    return emptyValue;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return emptyValue;
  }

  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.timeStyle ?? "short",
  }).format(date);
}

export function calculateCompressionRatio(
  uncompressedBytes?: number | null,
  compressedBytes?: number | null,
): number | null {
  if (
    typeof uncompressedBytes !== "number" ||
    typeof compressedBytes !== "number" ||
    !Number.isFinite(uncompressedBytes) ||
    !Number.isFinite(compressedBytes) ||
    uncompressedBytes < 0 ||
    compressedBytes < 0
  ) {
    return null;
  }

  if (uncompressedBytes === 0) {
    return compressedBytes === 0 ? 0 : null;
  }

  return compressedBytes / uncompressedBytes;
}

export function formatCompressionRatio(
  uncompressedBytes?: number | null,
  compressedBytes?: number | null,
  options: FormatCompressionRatioOptions = {},
): string {
  const ratio = calculateCompressionRatio(uncompressedBytes, compressedBytes);
  if (ratio === null) {
    return options.emptyValue ?? DEFAULT_EMPTY_VALUE;
  }

  const fractionDigits = options.fractionDigits ?? 1;
  const percentage = (ratio * 100).toFixed(fractionDigits).replace(/\.0$/, "");
  return `${percentage}%`;
}

export function escapeHtml(value: string | number | boolean | null | undefined): string {
  return String(value ?? "").replace(
    HTML_ESCAPE_PATTERN,
    (source) => HTML_ESCAPE_REPLACEMENTS[source] ?? source,
  );
}

export function trimTrailingPathSeparators(value: string): string {
  return value.replace(TRAILING_PATH_SEPARATOR_PATTERN, "");
}

export function isFolderishPath(value?: string | null): boolean {
  return typeof value === "string" && TRAILING_PATH_SEPARATOR_PATTERN.test(value);
}

export function getPathBasename(value?: string | null, fallback = ""): string {
  if (!value) {
    return fallback;
  }

  const trimmed = trimTrailingPathSeparators(value) || value;
  if (/^[\\/]+$/.test(trimmed)) {
    return trimmed[0] ?? fallback;
  }

  const segments = trimmed.split(PATH_SEPARATOR_PATTERN).filter(Boolean);
  return segments.at(-1) ?? fallback;
}

export function getPathDirectory(value?: string | null): string {
  if (!value) {
    return "";
  }

  const trimmed = trimTrailingPathSeparators(value) || value;
  const forwardIndex = trimmed.lastIndexOf("/");
  const backwardIndex = trimmed.lastIndexOf("\\");
  const separatorIndex = Math.max(forwardIndex, backwardIndex);

  if (separatorIndex < 0) {
    return "";
  }

  if (separatorIndex === 0) {
    return trimmed[0] ?? "";
  }

  const parent = trimmed.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}${trimmed[separatorIndex]}`;
  }

  return parent;
}
