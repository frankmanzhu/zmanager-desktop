import { useEffect, useState, type ReactNode } from "react";

export type WorkspacePathCrumb = Readonly<{
  name: string;
  path: string;
}>;

export type WorkspacePathSearch = Readonly<{
  query: string;
  disabled: boolean;
  clearDisabled: boolean;
  resultText: string;
  entriesLabel: string;
  placeholder: string;
  buttonLabel: string;
  clearLabel: string;
  clearAriaLabel: string;
  onChange?: (query: string) => void;
  onSubmit?: (query: string) => void;
  onClear?: () => void;
}>;

export type WorkspacePathBarProps = Readonly<{
  ariaLabel: string;
  locationLabel: string;
  pathAriaLabel: string;
  pathInputId?: string;
  displayPath: string;
  pathDisabled: boolean;
  pathReadOnly?: boolean;
  pathPlaceholder?: string;
  crumbs: readonly WorkspacePathCrumb[];
  crumbsHidden: boolean;
  emptyCrumbsText: string;
  pathAccessory?: ReactNode;
  search: WorkspacePathSearch;
  onPathChange?: (path: string) => void;
  onCrumbClick?: (path: string) => void;
}>;

export function WorkspacePathBar({
  ariaLabel,
  locationLabel,
  pathAriaLabel,
  pathInputId = "path-field",
  displayPath,
  pathDisabled,
  pathReadOnly = true,
  pathPlaceholder,
  crumbs,
  crumbsHidden,
  emptyCrumbsText,
  pathAccessory,
  search,
  onPathChange,
  onCrumbClick,
}: WorkspacePathBarProps) {
  return (
    <section className="path-bar" aria-label={ariaLabel}>
      <label className="path-location">
        <span className="path-location-label">{locationLabel}</span>
        <span className="path-location-control">
          <input
            id={pathInputId}
            className="path-field"
            type="text"
            aria-label={pathAriaLabel}
            value={displayPath}
            readOnly={pathReadOnly}
            disabled={pathDisabled}
            placeholder={pathPlaceholder}
            onChange={(event) => onPathChange?.(event.currentTarget.value)}
          />
        </span>
      </label>
      {pathAccessory ? (
        <div className="path-accessory">{pathAccessory}</div>
      ) : (
        <div id="path-crumbs" className="path-crumbs" aria-live="polite" hidden={crumbsHidden}>
          {crumbsHidden
            ? emptyCrumbsText
            : crumbs.map((crumb, index) => (
              <PathCrumb
                key={`${crumb.path}-${index}`}
                name={crumb.name}
                path={crumb.path}
                showSeparator={index > 0}
                onClick={onCrumbClick}
              />
            ))}
        </div>
      )}
      <WorkspaceSearchControls search={search} />
    </section>
  );
}

function PathCrumb({
  name,
  path,
  showSeparator,
  onClick,
}: Readonly<{
  name: string;
  path: string;
  showSeparator: boolean;
  onClick?: (path: string) => void;
}>) {
  return (
    <>
      {showSeparator ? <span aria-hidden="true">&gt;</span> : null}
      <button
        type="button"
        data-crumb-path={path}
        aria-keyshortcuts="Enter Space"
        onClick={() => onClick?.(path)}
      >
        {name}
      </button>
    </>
  );
}

function WorkspaceSearchControls({
  search,
}: Readonly<{
  search: WorkspacePathSearch;
}>) {
  const [draft, setDraft] = useState(search.query);

  useEffect(() => {
    setDraft(search.query);
  }, [search.query]);

  return (
    <div className="search-box" role="search">
      <label className="search-field">
        <span className="sr-only">{search.entriesLabel}</span>
        <input
          id="search-entries"
          type="search"
          placeholder={search.placeholder}
          aria-keyshortcuts="Control+F"
          disabled={search.disabled}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            search.onChange?.(event.currentTarget.value);
          }}
        />
      </label>
      <button
        id="search-submit"
        className="search-action"
        type="button"
        disabled={search.disabled}
        onClick={() => search.onSubmit?.(draft)}
      >
        {search.buttonLabel}
      </button>
      <button
        id="clear-search"
        className="search-action quiet-action"
        type="button"
        disabled={search.clearDisabled}
        aria-label={search.clearAriaLabel}
        onClick={() => search.onClear?.()}
      >
        {search.clearLabel}
      </button>
      <output id="search-count" className="search-count" htmlFor="search-entries" aria-live="polite">
        {search.resultText}
      </output>
    </div>
  );
}
