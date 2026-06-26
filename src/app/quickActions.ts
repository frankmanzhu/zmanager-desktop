import type { QuickActionRequestDto } from "../api/types";
import { isSupportedArchivePath, baseNameWithoutKnownArchiveExtension } from "./archiveFileTypes";
import {
  commonSourceParentDirectory,
  suggestedCreateArchiveName,
  withCreateArchiveExtension,
  type CreatePathHelpers,
  type CreateArchiveFormat,
} from "./createFlow";
import {
  defaultCreateDirectory,
  type AppPreferences,
  type DefaultExtractionBehavior,
} from "./preferences";

export type QuickActionExtractMode = Exclude<DefaultExtractionBehavior, "askEveryTime">;

export type QuickActionPathHelpers = CreatePathHelpers & {
  joinNativePath: (parentPath: string, childName: string) => string;
};

export type QuickActionHandlers = {
  startCreate: (paths: string[], format: CreateArchiveFormat, cleanSource: boolean) => Promise<void>;
  openExtractReview: (paths: string[]) => Promise<void>;
  startExtract: (paths: string[], action: QuickActionExtractMode) => Promise<void>;
};

export function uniqueQuickActionPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
}

export function quickCreateDestination(
  paths: string[],
  format: CreateArchiveFormat,
  preferences: AppPreferences,
  pathHelpers: QuickActionPathHelpers,
): string {
  const firstPath = paths[0] ?? "";
  const outputDirectory =
    defaultCreateDirectory(preferences) ??
    commonSourceParentDirectory(paths, pathHelpers) ??
    pathHelpers.nativeParentPath(firstPath);
  const name = suggestedCreateArchiveName(paths, format);
  return withCreateArchiveExtension(
    outputDirectory ? pathHelpers.joinNativePath(outputDirectory, name) : name,
    format,
  );
}

export function quickExtractDestination(
  archivePath: string,
  action: QuickActionExtractMode,
  pathHelpers: QuickActionPathHelpers,
): string {
  const parent = pathHelpers.nativeParentPath(archivePath);
  if (action === "extractHere") {
    return parent;
  }

  const folderName = baseNameWithoutKnownArchiveExtension(archivePath);
  return parent ? pathHelpers.joinNativePath(parent, folderName) : folderName;
}

export function unsupportedQuickExtractPath(paths: string[]): string | null {
  return uniqueQuickActionPaths(paths).find((path) => !isSupportedArchivePath(path)) ?? null;
}

export async function runQuickActionRequest(
  request: QuickActionRequestDto,
  preferences: AppPreferences,
  handlers: QuickActionHandlers,
): Promise<void> {
  switch (request.kind) {
    case "compress":
      await handlers.startCreate(
        request.paths,
        preferences.defaultArchiveFormat,
        preferences.defaultCleanSourceEnabled,
      );
      break;
    case "extract":
      if (preferences.defaultExtractionBehavior === "askEveryTime") {
        await handlers.openExtractReview(request.paths);
      } else {
        await handlers.startExtract(request.paths, preferences.defaultExtractionBehavior);
      }
      break;
    case "compressZip":
      await handlers.startCreate(request.paths, "zip", false);
      break;
    case "compressCleanSource":
      await handlers.startCreate(request.paths, "tarZst", true);
      break;
    case "extractHere":
      await handlers.startExtract(request.paths, "extractHere");
      break;
    case "extractToFolder":
      await handlers.startExtract(request.paths, "extractToFolder");
      break;
  }
}
