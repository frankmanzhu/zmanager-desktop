const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;
const GIBIBYTE = 1024 * MEBIBYTE;

export const DEFAULT_VOLUME_SIZE_PRESETS = Object.freeze([
  MEBIBYTE,
  10 * MEBIBYTE,
  50 * MEBIBYTE,
  100 * MEBIBYTE,
  500 * MEBIBYTE,
  GIBIBYTE,
  2 * GIBIBYTE,
  4 * GIBIBYTE,
]);

export function normalizeVolumeSizePresets(values: readonly unknown[]): number[] {
  const unique = new Set<number>();
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      unique.add(value);
    }
  }
  return [...unique];
}

export function parseVolumeSizePresetList(value: string): number[] | null {
  const tokens = value.split(/[,;\r\n]+/).map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) {
    return null;
  }
  const parsed = tokens.map(parseVolumeSize);
  return parsed.every((size): size is number => size !== null)
    ? normalizeVolumeSizePresets(parsed)
    : null;
}

export function formatVolumeSizePresetList(values: readonly number[]): string {
  return values.map(formatVolumeSize).join(", ");
}

export function formatVolumeSize(bytes: number): string {
  if (bytes % GIBIBYTE === 0) {
    return `${bytes / GIBIBYTE} GB`;
  }
  if (bytes % MEBIBYTE === 0) {
    return `${bytes / MEBIBYTE} MB`;
  }
  if (bytes % KIBIBYTE === 0) {
    return `${bytes / KIBIBYTE} KB`;
  }
  return `${bytes} B`;
}

function parseVolumeSize(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(value);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const multiplier = { b: 1, kb: KIBIBYTE, mb: MEBIBYTE, gb: GIBIBYTE }[match[2].toLowerCase() as "b" | "kb" | "mb" | "gb"];
  const bytes = amount * multiplier;
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
}
