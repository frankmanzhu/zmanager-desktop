import type { DragEventHandler, HTMLAttributes } from "react";

import type { DroppedPath } from "../../../app/dropIntent";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function useBrowserFileDropHandlers(): Pick<
  HTMLAttributes<HTMLDivElement>,
  "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
> {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  if (snapshot.runtime.isDesktop) {
    return {};
  }

  const enter: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    actions.handleDesktopIntent({
      type: "dropEntered",
      paths: droppedPathsFromDataTransfer(event.dataTransfer),
    });
  };
  return {
    onDragEnter: enter,
    onDragOver: enter,
    onDragLeave: (event) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }
      actions.handleDesktopIntent({ type: "dropLeft" });
    },
    onDrop: (event) => {
      event.preventDefault();
      actions.handleDesktopIntent({
        type: "droppedPaths",
        paths: droppedPathsFromDataTransfer(event.dataTransfer),
      });
    },
  };
}

export function droppedPathsFromDataTransfer(
  dataTransfer: DataTransfer | null,
): DroppedPath[] {
  const paths: DroppedPath[] = [];
  for (const file of Array.from(dataTransfer?.files ?? [])) {
    const fileWithPath = file as File & { path?: string };
    const path =
      fileWithPath.path?.trim() ||
      file.webkitRelativePath?.trim() ||
      file.name.trim();
    if (path) {
      paths.push({ path, kind: "unknown" });
    }
  }
  return paths;
}
