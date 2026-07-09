import type { ArchiveTableRow } from "../../../app/archiveTable";
import { getKnownArchiveSuffix } from "../../../app/archiveFileTypes";
import { getPathBasename } from "../../../app/formatting";
import type { ZManagerReactSnapshot } from "../appRuntime";

type ArchiveEntryIconTarget = Readonly<{
  kind: string;
  path: string;
}>;

export function nativeIconDataUrlForArchivePath(
  snapshot: ZManagerReactSnapshot,
  archivePath: string,
): string | null {
  return nativeIconDataUrlForKey(snapshot, systemIconKeyForPath(archivePath, false));
}

export function nativeIconDataUrlForFolder(snapshot: ZManagerReactSnapshot): string | null {
  return nativeIconDataUrlForKey(snapshot, "directory");
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

  return nativeIconDataUrlForKey(snapshot, systemIconKeyForPath(entry.path, false));
}

function nativeIconDataUrlForKey(snapshot: ZManagerReactSnapshot, key: string | null): string | null {
  if (!snapshot.preferences.showRealFileIcons || !key) {
    return null;
  }

  return snapshot.systemIcons[key] ?? null;
}

function systemIconKeyForPath(path: string, isDirectory: boolean): string {
  if (isDirectory) {
    return "directory";
  }

  return `file:${systemIconLookupPath(path).toLowerCase()}`;
}

function systemIconLookupPath(path: string): string {
  const suffix = getKnownArchiveSuffix(path);
  if (suffix) {
    return suffix;
  }

  const extension = pathExtension(path);
  return extension ? `.${extension}` : "file";
}

function pathExtension(path: string): string | null {
  const name = getPathBasename(path, path);
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
}
