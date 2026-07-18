import type { ArchiveTableRow } from "../../../app/archiveTable";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { nativeIconDataUrlForPath } from "../systemFileIcons";

type ArchiveEntryIconTarget = Readonly<{
  kind: string;
  path: string;
}>;

export function nativeIconDataUrlForArchivePath(
  snapshot: ZManagerReactSnapshot,
  archivePath: string,
): string | null {
  return nativeIconDataUrlForPath(snapshot, archivePath, false);
}

export function nativeIconDataUrlForFolder(
  snapshot: ZManagerReactSnapshot,
): string | null {
  return nativeIconDataUrlForPath(snapshot, "folder", true);
}

export function nativeIconDataUrlForRow(
  snapshot: ZManagerReactSnapshot,
  row: ArchiveTableRow,
): string | null {
  if (row.rowType === "parent" || row.rowType === "folder") {
    return nativeIconDataUrlForFolder(snapshot);
  }

  return nativeIconDataUrlForEntry(snapshot, row.entry);
}

export function nativeIconDataUrlForEntry(
  snapshot: ZManagerReactSnapshot,
  entry: ArchiveEntryIconTarget,
): string | null {
  if (entry.kind === "directory") {
    return nativeIconDataUrlForFolder(snapshot);
  }
  if (entry.kind === "special") {
    return null;
  }

  return nativeIconDataUrlForPath(snapshot, entry.path, false);
}
