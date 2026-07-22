import type { QuickActionRequestDto, StartExtractRequest } from "../api/types";
import { SHELL_ACTION_POLICIES } from "../api/generated/shellActions.generated";
import { isSupportedArchivePath, baseNameWithoutKnownArchiveExtension } from "./archiveFileTypes";
import {
  commonSourceParentDirectory,
  suggestedCreateArchiveName,
  withCreateArchiveExtension,
  type CreatePathHelpers,
  type CreateArchiveFormat,
} from "./createFlow";
import {
  createDefaultsForFormat,
  defaultCreateDirectory,
  type AppPreferences,
  type DefaultExtractionBehavior,
} from "./preferences";

export type QuickActionExtractMode = Exclude<DefaultExtractionBehavior, "askEveryTime">;
export type QuickActionWindowDisposition = "mainWindow" | "disposableTask";

export type QuickActionPathHelpers = CreatePathHelpers & {
  joinNativePath: (parentPath: string, childName: string) => string;
};

export type QuickExtractEntry = {
  path: string;
  kind?: string;
};

export type QuickExtractDestinationPlan = {
  destinationPath: string;
  stripComponents: number;
  destinationCollisionStrategy?: StartExtractRequest["destinationCollisionStrategy"];
};

export type QuickActionHandlers = {
  openArchive: (paths: string[]) => Promise<void>;
  openCreateReview: (paths: string[], format: CreateArchiveFormat, cleanSource: boolean) => Promise<void>;
  startCreate: (paths: string[], format: CreateArchiveFormat, cleanSource: boolean) => Promise<void>;
  openExtractReview: (paths: string[]) => Promise<void>;
  startExtract: (paths: string[], action: QuickActionExtractMode) => Promise<void>;
};

export function uniqueQuickActionPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
}

export function quickActionWindowDisposition(
  kind: QuickActionRequestDto["kind"],
): QuickActionWindowDisposition {
  const policy = SHELL_ACTION_POLICIES.find((candidate) => candidate.id === kind);
  if (!policy) {
    throw new Error(`Missing shell action policy for ${kind}`);
  }
  return policy.windowDisposition;
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

export function quickExtractDestinationCollisionStrategy(
  action: QuickActionExtractMode,
): StartExtractRequest["destinationCollisionStrategy"] | undefined {
  return action === "extractToFolder" ? "rename" : undefined;
}

export function quickExtractSingleRootFolder(entries: QuickExtractEntry[]): string | null {
  let root: string | null = null;
  let hasChildBelowRoot = false;
  let hasRootDirectoryEntry = false;

  for (const entry of entries) {
    const parts = entry.path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (!parts.length) {
      continue;
    }
    const entryRoot = parts[0];
    if (!isSafeArchiveRootName(entryRoot)) {
      return null;
    }
    if (root === null) {
      root = entryRoot;
    } else if (root !== entryRoot) {
      return null;
    }
    if (parts.length > 1) {
      hasChildBelowRoot = true;
    } else if (entry.kind === "directory") {
      hasRootDirectoryEntry = true;
    }
  }

  return root && (hasChildBelowRoot || hasRootDirectoryEntry) ? root : null;
}

export function quickExtractDestinationPlan(
  archivePath: string,
  action: QuickActionExtractMode,
  pathHelpers: QuickActionPathHelpers,
  entries?: QuickExtractEntry[],
): QuickExtractDestinationPlan {
  const destinationPath = quickExtractDestination(archivePath, action, pathHelpers);
  if (action === "extractHere" && entries) {
    const rootFolder = quickExtractSingleRootFolder(entries);
    if (rootFolder) {
      return {
        destinationPath: pathHelpers.joinNativePath(destinationPath, rootFolder),
        stripComponents: 1,
        destinationCollisionStrategy: "rename",
      };
    }
  }

  const destinationCollisionStrategy = quickExtractDestinationCollisionStrategy(action);
  return {
    destinationPath,
    stripComponents: 0,
    ...(destinationCollisionStrategy ? { destinationCollisionStrategy } : {}),
  };
}

function isSafeArchiveRootName(name: string): boolean {
  return Boolean(
    name &&
      name !== "." &&
      name !== ".." &&
      !name.includes("/") &&
      !name.includes("\\"),
  );
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
    case "open":
      await handlers.openArchive(request.paths);
      break;
    case "compress":
      {
        const createDefaults = createDefaultsForFormat(preferences, preferences.defaultArchiveFormat);
        await handlers.openCreateReview(
          request.paths,
          preferences.defaultArchiveFormat,
          createDefaults.cleanSource,
        );
      }
      break;
    case "extract":
      if (preferences.defaultExtractionBehavior === "askEveryTime") {
        await handlers.openExtractReview(request.paths);
      } else {
        await handlers.startExtract(request.paths, preferences.defaultExtractionBehavior);
      }
      break;
    case "compressZip":
      await handlers.startCreate(
        request.paths,
        "zip",
        createDefaultsForFormat(preferences, "zip").cleanSource,
      );
      break;
    case "compressTzap":
      await handlers.startCreate(
        request.paths,
        "tzap",
        createDefaultsForFormat(preferences, "tzap").cleanSource,
      );
      break;
    case "compressSevenZ":
      await handlers.startCreate(
        request.paths,
        "sevenZ",
        createDefaultsForFormat(preferences, "sevenZ").cleanSource,
      );
      break;
    case "compressTarZst":
      await handlers.startCreate(
        request.paths,
        "tarZst",
        createDefaultsForFormat(preferences, "tarZst").cleanSource,
      );
      break;
    case "compressTarGz":
      await handlers.startCreate(
        request.paths,
        "tarGz",
        createDefaultsForFormat(preferences, "tarGz").cleanSource,
      );
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
