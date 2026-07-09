import { Archive, ChevronRight, Folder } from "lucide-react";
import type { CSSProperties } from "react";

import { getPathBasename } from "../../../app/formatting";
import type { ArchiveWorkspaceSnapshot } from "../../../app/workspaces/archiveWorkspace";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { nativeIconDataUrlForArchivePath, nativeIconDataUrlForFolder } from "./archiveNativeIcons";

type TreeFolder = Readonly<{
  path: string;
  label: string;
  depth: number;
  canToggle: boolean;
  isExpanded: boolean;
  isActive: boolean;
}>;

export function ArchiveTree() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const archive = snapshot.archive;
  const folders = archive.currentArchivePath ? treeFoldersForArchive(archive) : [];

  return (
    <aside id="navigation-pane" className="navigation-pane" aria-label={i18n.t("workspace.archiveNavigation.aria")}>
      <div className="pane-header">
        <h2>{i18n.t("pane.folders")}</h2>
      </div>
      <div id="tree-content" className="tree-content">
        {folders.length ? folders.map((folder) => {
          const iconDataUrl = folder.path
            ? nativeIconDataUrlForFolder(snapshot)
            : nativeIconDataUrlForArchivePath(snapshot, archive.currentArchivePath);
          const Icon = folder.path ? Folder : Archive;
          const iconKind = folder.path ? "folder" : "archive";

          return (
            <button
              className={`tree-item ${folder.isActive ? "is-active" : ""}`}
              type="button"
              data-tree-path={folder.path}
              style={{ "--depth": folder.depth } as CSSProperties}
              key={folder.path || "__root__"}
              onClick={() => actions.handleArchiveIntent({ type: "navigateToFolder", folderPath: folder.path })}
            >
              {folder.canToggle ? (
                <span
                  className="tree-disclosure"
                  data-tree-toggle
                  data-tree-path={folder.path}
                  aria-label={`${folder.isExpanded ? "Collapse" : "Expand"} ${folder.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.handleArchiveIntent({ type: "toggleTreeFolder", folderPath: folder.path });
                  }}
                >
                  <ChevronRight aria-hidden="true" />
                </span>
              ) : (
                <span className="tree-disclosure tree-disclosure-placeholder" aria-hidden="true" />
              )}
              <span className={`tree-icon tree-icon-${iconKind}`} aria-hidden="true" draggable={false}>
                {iconDataUrl ? (
                  <img className="tree-icon-native-image" src={iconDataUrl} alt="" draggable={false} />
                ) : (
                  <Icon className="tree-icon-svg" aria-hidden="true" />
                )}
              </span>
              <span className="tree-label">{folder.label}</span>
            </button>
          );
        }) : (
          <div className="empty-pane">
            <p>{i18n.t("browse.noArchiveOpen")}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function treeFoldersForArchive(snapshot: ArchiveWorkspaceSnapshot): TreeFolder[] {
  const expanded = new Set(snapshot.view.expandedTreeFolders);
  const childMap = new Map<string, Set<string>>();
  const folderPaths = new Set<string>([""]);

  for (const entry of snapshot.entries) {
    const parts = entry.path.split("/").filter(Boolean);
    const folderPartCount = entry.kind === "directory" ? parts.length : Math.max(0, parts.length - 1);
    let parent = "";
    for (let index = 0; index < folderPartCount; index += 1) {
      const path = parts.slice(0, index + 1).join("/");
      folderPaths.add(path);
      if (!childMap.has(parent)) {
        childMap.set(parent, new Set());
      }
      childMap.get(parent)!.add(path);
      parent = path;
    }
  }

  const archiveName = getPathBasename(snapshot.currentArchivePath, "Archive");
  const folders: TreeFolder[] = [{
    path: "",
    label: archiveName,
    depth: 0,
    canToggle: Boolean(childMap.get("")?.size),
    isExpanded: true,
    isActive: snapshot.view.currentFolder === "",
  }];

  function visit(parent: string, depth: number) {
    const children = [...(childMap.get(parent) ?? [])].sort((left, right) => left.localeCompare(right));
    for (const child of children) {
      if (!folderPaths.has(child)) {
        continue;
      }
      const label = child.split("/").at(-1) ?? child;
      const canToggle = Boolean(childMap.get(child)?.size);
      const isExpanded = expanded.has(child);
      folders.push({
        path: child,
        label,
        depth,
        canToggle,
        isExpanded,
        isActive: snapshot.view.currentFolder === child,
      });
      if (canToggle && isExpanded) {
        visit(child, depth + 1);
      }
    }
  }

  visit("", 1);
  return folders;
}
