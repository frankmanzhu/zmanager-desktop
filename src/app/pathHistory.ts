export const EXTRACT_DESTINATION_HISTORY_MAX = 10;
export const CREATE_DESTINATION_HISTORY_MAX = 10;
export const RECENT_ARCHIVE_HISTORY_MAX = 8;

export type PathHistoryEntries = readonly string[];

export function normalizePathHistory(entries: PathHistoryEntries): string[] {
  const normalizedEntries: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const normalizedEntry = entry.trim();
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }
    seen.add(normalizedEntry);
    normalizedEntries.push(normalizedEntry);
  }

  return normalizedEntries;
}

export function setPathHistoryEntries(entries: PathHistoryEntries, maxEntries: number): string[] {
  return normalizePathHistory(entries).slice(0, maxEntries);
}

export function recordPathHistoryEntry(
  currentEntries: PathHistoryEntries,
  recordedPath: string,
  maxEntries: number,
): string[] | null {
  const normalizedPath = recordedPath.trim();
  if (!normalizedPath) {
    return null;
  }

  return setPathHistoryEntries(
    [normalizedPath, ...currentEntries.filter((entry) => entry !== normalizedPath)],
    maxEntries,
  );
}

export function normalizeExtractDestinationHistory(entries: PathHistoryEntries): string[] {
  return normalizePathHistory(entries);
}

export function setExtractDestinationHistoryEntries(entries: PathHistoryEntries): string[] {
  return setPathHistoryEntries(entries, EXTRACT_DESTINATION_HISTORY_MAX);
}

export function recordExtractDestinationHistoryEntry(
  currentEntries: PathHistoryEntries,
  destinationPath: string,
): string[] | null {
  return recordPathHistoryEntry(currentEntries, destinationPath, EXTRACT_DESTINATION_HISTORY_MAX);
}

export function normalizeCreateDestinationHistory(entries: PathHistoryEntries): string[] {
  return normalizePathHistory(entries);
}

export function setCreateDestinationHistoryEntries(entries: PathHistoryEntries): string[] {
  return setPathHistoryEntries(entries, CREATE_DESTINATION_HISTORY_MAX);
}

export function recordCreateDestinationHistoryEntry(
  currentEntries: PathHistoryEntries,
  destinationPath: string,
): string[] | null {
  return recordPathHistoryEntry(currentEntries, destinationPath, CREATE_DESTINATION_HISTORY_MAX);
}

export function normalizeRecentArchiveHistory(entries: PathHistoryEntries): string[] {
  return normalizePathHistory(entries);
}

export function setRecentArchiveHistoryEntries(entries: PathHistoryEntries): string[] {
  return setPathHistoryEntries(entries, RECENT_ARCHIVE_HISTORY_MAX);
}

export function recordRecentArchiveHistoryEntry(
  currentEntries: PathHistoryEntries,
  archivePath: string,
): string[] | null {
  return recordPathHistoryEntry(currentEntries, archivePath, RECENT_ARCHIVE_HISTORY_MAX);
}
