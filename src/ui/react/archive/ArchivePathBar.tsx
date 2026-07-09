import { useEffect } from "react";

import { getPathBasename } from "../../../app/formatting";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { WorkspacePathBar } from "../workspace/WorkspacePathBar";

export function ArchivePathBar() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const archive = snapshot.archive;
  const archiveName = getPathBasename(archive.currentArchivePath, "ZManager");
  const displayPath = archive.currentArchivePath
    ? archive.view.currentFolder
      ? `${archive.currentArchivePath}\\${archive.view.currentFolder.replace(/\//g, "\\")}\\`
      : `${archive.currentArchivePath}\\`
    : i18n.t("browse.statusEmpty");

  useEffect(() => {
    document.title = archive.currentArchivePath
      ? archive.view.currentFolder
        ? `${archiveName}\\${archive.view.currentFolder.replace(/\//g, "\\")} - ZManager`
        : `${archiveName} - ZManager`
      : "ZManager";
  }, [archive.currentArchivePath, archive.view.currentFolder, archiveName]);

  return (
    <WorkspacePathBar
      ariaLabel={i18n.t("workspace.archiveLocation.aria")}
      locationLabel={i18n.t("path.fileLocation")}
      pathAriaLabel={i18n.t("path.archivePath.aria")}
      displayPath={displayPath}
      pathDisabled={!archive.currentArchivePath}
      crumbsHidden={!archive.currentArchivePath}
      emptyCrumbsText={i18n.t("browse.statusEmpty")}
      crumbs={archive.view.breadcrumbs.map((crumb) => ({
        name: crumb.isRoot ? archiveName : crumb.name,
        path: crumb.path,
      }))}
      onCrumbClick={(path) => actions.handleArchiveIntent({ type: "navigateToFolder", folderPath: path })}
      search={{
        query: archive.view.searchQuery,
        disabled: !archive.command.canSearchEntries,
        clearDisabled: !archive.command.canSearchEntries || !archive.view.searchQuery.trim(),
        resultText: archive.currentArchivePath
          ? i18n.t(
            archive.view.selection.visibleSelectablePaths.length === 1
              ? "search.oneResult"
              : "search.results",
            { count: archive.view.selection.visibleSelectablePaths.length },
          )
          : "",
        entriesLabel: i18n.t("search.entries"),
        placeholder: i18n.t("search.placeholder"),
        buttonLabel: i18n.t("search.button"),
        clearLabel: i18n.t("search.clear"),
        clearAriaLabel: i18n.t("search.clear.aria"),
        onChange: (query) => actions.handleArchiveIntent({ type: "setSearchQuery", query }),
        onSubmit: (query) => actions.handleArchiveIntent({ type: "setSearchQuery", query }),
        onClear: () => actions.handleArchiveIntent({ type: "clearSearch" }),
      }}
    />
  );
}
