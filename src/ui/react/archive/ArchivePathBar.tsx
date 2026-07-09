import { useEffect, useState } from "react";

import { getPathBasename } from "../../../app/formatting";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";

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
    <section className="path-bar" aria-label={i18n.t("workspace.archiveLocation.aria")}>
      <button
        id="nav-back"
        type="button"
        disabled={!archive.command.canNavigateBack}
        onClick={() => actions.handleArchiveIntent({ type: "navigateBack" })}
      >
        {i18n.t("navigation.back")}
      </button>
      <button
        id="nav-up"
        className="icon-button"
        type="button"
        data-command-id="upOneLevel"
        disabled={!archive.command.canNavigateUp}
        title={i18n.t("commands.upOneLevel.tooltip")}
        aria-label={i18n.t("commands.upOneLevel")}
        onClick={() => actions.handleArchiveIntent({ type: "navigateUp" })}
      >
        ^
      </button>
      <input
        id="path-field"
        className="path-field"
        type="text"
        aria-label={i18n.t("path.archivePath.aria")}
        value={displayPath}
        readOnly
        disabled={!archive.currentArchivePath}
      />
      <div id="path-crumbs" className="path-crumbs" aria-live="polite" hidden={!archive.currentArchivePath}>
        {archive.currentArchivePath
          ? archive.view.breadcrumbs.map((crumb, index) => (
            <Crumb
              key={`${crumb.path}-${index}`}
              name={crumb.isRoot ? archiveName : crumb.name}
              path={crumb.path}
              showSeparator={index > 0}
            />
          ))
          : i18n.t("browse.statusEmpty")}
      </div>
      <ArchiveSearchControls />
    </section>
  );
}

function Crumb({
  name,
  path,
  showSeparator,
}: Readonly<{ name: string; path: string; showSeparator: boolean }>) {
  const actions = useZManagerActions();

  return (
    <>
      {showSeparator ? <span aria-hidden="true">&gt;</span> : null}
      <button
        type="button"
        data-crumb-path={path}
        aria-keyshortcuts="Enter Space"
        onClick={() => actions.handleArchiveIntent({ type: "navigateToFolder", folderPath: path })}
      >
        {name}
      </button>
    </>
  );
}

function ArchiveSearchControls() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const query = snapshot.archive.view.searchQuery;
  const [draft, setDraft] = useState(query);
  const searchDisabled = !snapshot.archive.command.canSearchEntries;
  const clearDisabled = searchDisabled || !query.trim();

  useEffect(() => {
    setDraft(query);
  }, [query]);

  return (
    <div className="search-box" role="search">
      <label className="search-field">
        <span className="sr-only">{i18n.t("search.entries")}</span>
        <input
          id="search-entries"
          type="search"
          placeholder={i18n.t("search.placeholder")}
          aria-keyshortcuts="Control+F"
          disabled={searchDisabled}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            actions.handleArchiveIntent({ type: "setSearchQuery", query: event.currentTarget.value });
          }}
        />
      </label>
      <button
        id="search-submit"
        className="search-action"
        type="button"
        disabled={searchDisabled}
        onClick={() => actions.handleArchiveIntent({ type: "setSearchQuery", query: draft })}
      >
        {i18n.t("search.button")}
      </button>
      <button
        id="clear-search"
        className="search-action quiet-action"
        type="button"
        disabled={clearDisabled}
        aria-label={i18n.t("search.clear.aria")}
        onClick={() => actions.handleArchiveIntent({ type: "clearSearch" })}
      >
        {i18n.t("search.clear")}
      </button>
      <output id="search-count" className="search-count" htmlFor="search-entries" aria-live="polite">
        {snapshot.archive.currentArchivePath
          ? i18n.t(
            snapshot.archive.view.selection.visibleSelectablePaths.length === 1
              ? "search.oneResult"
              : "search.results",
            { count: snapshot.archive.view.selection.visibleSelectablePaths.length },
          )
          : ""}
      </output>
    </div>
  );
}
