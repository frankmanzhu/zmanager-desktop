import { isSupportedArchivePath } from "./archiveFileTypes";

export type DropIntentSurface = "browse" | "create" | "global" | "unknown";
export type DroppedPathKind = "file" | "directory" | "unknown";

export type DroppedPath =
  | string
  | {
      path: string;
      kind?: DroppedPathKind;
    };

export type DropRejectReason =
  | "emptyDrop"
  | "browseRequiresArchive"
  | "openRequiresSingleArchive";

export type DropIntentDecision =
  | {
      kind: "openArchive";
      surface: DropIntentSurface;
      archivePath: string;
    }
  | {
      kind: "addCreateSources";
      surface: DropIntentSurface;
      sourcePaths: string[];
    }
  | {
      kind: "askAction";
      surface: DropIntentSurface;
      archivePaths: string[];
      sourcePaths: string[];
    }
  | {
      kind: "rejectUnsupportedDrop";
      surface: DropIntentSurface;
      reason: DropRejectReason;
      paths: string[];
      archivePaths: string[];
      sourcePaths: string[];
    };

type ClassifiedDropPath = {
  path: string;
  archive: boolean;
};

export function classifyDropIntent(
  droppedPaths: readonly DroppedPath[],
  surface: DropIntentSurface = "unknown",
): DropIntentDecision {
  const classifiedPaths = droppedPaths
    .map(classifyDroppedPath)
    .filter((item): item is ClassifiedDropPath => item !== null);
  const paths = classifiedPaths.map((item) => item.path);
  const archivePaths = classifiedPaths.filter((item) => item.archive).map((item) => item.path);
  const sourcePaths = classifiedPaths.filter((item) => !item.archive).map((item) => item.path);

  if (paths.length === 0) {
    return rejectDrop(surface, "emptyDrop", paths, archivePaths, sourcePaths);
  }

  if (archivePaths.length > 0 && sourcePaths.length > 0) {
    return {
      kind: "askAction",
      surface,
      archivePaths,
      sourcePaths,
    };
  }

  if (surface === "create") {
    return {
      kind: "addCreateSources",
      surface,
      sourcePaths: paths,
    };
  }

  if (archivePaths.length === 1) {
    return {
      kind: "openArchive",
      surface,
      archivePath: archivePaths[0],
    };
  }

  if (archivePaths.length > 1) {
    return rejectDrop(surface, "openRequiresSingleArchive", paths, archivePaths, sourcePaths);
  }

  if (surface === "browse") {
    return rejectDrop(surface, "browseRequiresArchive", paths, archivePaths, sourcePaths);
  }

  return {
    kind: "addCreateSources",
    surface,
    sourcePaths,
  };
}

function classifyDroppedPath(droppedPath: DroppedPath): ClassifiedDropPath | null {
  const path = typeof droppedPath === "string" ? droppedPath : droppedPath.path;
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const kind = typeof droppedPath === "string" ? "unknown" : (droppedPath.kind ?? "unknown");
  return {
    path: trimmedPath,
    archive: kind !== "directory" && isSupportedArchivePath(trimmedPath),
  };
}

function rejectDrop(
  surface: DropIntentSurface,
  reason: DropRejectReason,
  paths: string[],
  archivePaths: string[],
  sourcePaths: string[],
): DropIntentDecision {
  return {
    kind: "rejectUnsupportedDrop",
    surface,
    reason,
    paths,
    archivePaths,
    sourcePaths,
  };
}
