import { Archive, ChevronRight, Folder } from "lucide-react";

import { getPathBasename } from "../../../app/formatting";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { treeDepthClass } from "../workspace/treeDepthClass";
import {
  nativeIconDataUrlForArchivePath,
  nativeIconDataUrlForFolder,
} from "./archiveNativeIcons";

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
    <aside
      id="navigation-pane"
      className="flex min-h-0 min-w-[150px] flex-col overflow-hidden border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70"
      aria-label={i18n.t("workspace.archiveNavigation.aria")}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex h-10 shrink-0 items-center border-b border-slate-200 px-3 dark:border-slate-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {i18n.t("pane.folders")}
        </h2>
      </div>
      <div id="tree-content" className="min-h-0 flex-1 overflow-auto p-1.5">
        {folders.length ? (
          folders.map((folder) => {
            const iconDataUrl = folder.path
              ? nativeIconDataUrlForFolder(snapshot)
              : nativeIconDataUrlForArchivePath(
                  snapshot,
                  archive.currentArchivePath,
                );
            const Icon = folder.path ? Folder : Archive;
            const iconKind = folder.path ? "folder" : "archive";

            return (
              <button
                className={`flex min-h-8 w-full min-w-0 items-center gap-1 rounded-md border-0 bg-transparent pr-2 text-left text-sm hover:bg-slate-100 aria-selected:bg-blue-100 aria-selected:text-blue-800 dark:hover:bg-slate-800 dark:aria-selected:bg-blue-950 dark:aria-selected:text-blue-200 ${treeDepthClass(folder.depth)}`}
                type="button"
                data-tree-path={folder.path}
                aria-selected={folder.isActive}
                key={folder.path || "__root__"}
                onClick={() =>
                  actions.handleArchiveIntent({
                    type: "navigateToFolder",
                    folderPath: folder.path,
                  })
                }
              >
                {folder.canToggle ? (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/5"
                    data-tree-toggle
                    data-tree-path={folder.path}
                    aria-label={`${folder.isExpanded ? "Collapse" : "Expand"} ${folder.label}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      actions.handleArchiveIntent({
                        type: "toggleTreeFolder",
                        folderPath: folder.path,
                      });
                    }}
                  >
                    <ChevronRight
                      className={`size-3.5 transition-transform ${folder.isExpanded ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                ) : (
                  <span className="size-5 shrink-0" aria-hidden="true" />
                )}
                <span
                  className={`flex size-4 shrink-0 items-center justify-center ${iconKind === "archive" ? "text-blue-600" : "text-amber-600"}`}
                  aria-hidden="true"
                  draggable={false}
                >
                  {iconDataUrl ? (
                    <img
                      className="size-4 object-contain"
                      src={iconDataUrl}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <Icon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 truncate">{folder.label}</span>
              </button>
            );
          })
        ) : (
          <div className="grid min-h-24 place-items-center p-4 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>{i18n.t("browse.noArchiveOpen")}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
