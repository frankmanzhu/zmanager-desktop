import { Archive, ChevronRight, Folder } from "lucide-react";
import type { CSSProperties } from "react";

import { getPathBasename } from "../../../app/formatting";
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
  const archiveName = getPathBasename(archive.currentArchivePath, "Archive");
  const folders = archive.view.treeFolders.map((folder) => ({
    path: folder.path,
    label: folder.isRoot ? archiveName : folder.name,
    depth: folder.depth,
    canToggle: folder.hasChildren && !folder.isRoot,
    isExpanded: folder.isExpanded,
    isActive: folder.isActive,
  }));

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
