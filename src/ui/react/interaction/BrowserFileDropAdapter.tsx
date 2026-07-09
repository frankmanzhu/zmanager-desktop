import { useEffect } from "react";

import type { DroppedPath } from "../../../app/dropIntent";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function BrowserFileDropAdapter() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  useEffect(() => {
    if (snapshot.runtime.isDesktop) {
      return;
    }

    const dropRoot = document.querySelector<HTMLElement>("#app") ?? document.documentElement;
    const onDragEnter = (event: DragEvent) => {
      event.preventDefault();
      actions.handleDesktopIntent({ type: "dropEntered", paths: droppedPathsFromDataTransfer(event.dataTransfer) });
    };
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      actions.handleDesktopIntent({ type: "dropEntered", paths: droppedPathsFromDataTransfer(event.dataTransfer) });
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && dropRoot.contains(event.relatedTarget)) {
        return;
      }
      actions.handleDesktopIntent({ type: "dropLeft" });
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      actions.handleDesktopIntent({ type: "droppedPaths", paths: droppedPathsFromDataTransfer(event.dataTransfer) });
    };

    dropRoot.addEventListener("dragenter", onDragEnter);
    dropRoot.addEventListener("dragover", onDragOver);
    dropRoot.addEventListener("dragleave", onDragLeave);
    dropRoot.addEventListener("drop", onDrop);
    return () => {
      dropRoot.removeEventListener("dragenter", onDragEnter);
      dropRoot.removeEventListener("dragover", onDragOver);
      dropRoot.removeEventListener("dragleave", onDragLeave);
      dropRoot.removeEventListener("drop", onDrop);
    };
  }, [actions, snapshot.runtime.isDesktop]);

  return null;
}

export function droppedPathsFromDataTransfer(dataTransfer: DataTransfer | null): DroppedPath[] {
  const paths: DroppedPath[] = [];
  for (const file of Array.from(dataTransfer?.files ?? [])) {
    const fileWithPath = file as File & { path?: string };
    const path = fileWithPath.path?.trim() || file.webkitRelativePath?.trim() || file.name.trim();
    if (path) {
      paths.push({ path, kind: "unknown" });
    }
  }
  return paths;
}
