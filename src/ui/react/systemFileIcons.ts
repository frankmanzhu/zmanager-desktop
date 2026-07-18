import { getKnownArchiveSuffix } from "../../app/archiveFileTypes";
import { getPathBasename } from "../../app/formatting";
import type { ZManagerReactSnapshot } from "./appRuntime";

export function nativeIconDataUrlForPath(
  snapshot: ZManagerReactSnapshot,
  path: string,
  isDirectory: boolean,
): string | null {
  if (!snapshot.preferences.showRealFileIcons) {
    return null;
  }

  return snapshot.systemIcons[systemIconKeyForPath(path, isDirectory)] ?? null;
}

export function systemIconKeyForPath(
  path: string,
  isDirectory: boolean,
): string {
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
