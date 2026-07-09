import { Archive, Copy, File, Folder } from "lucide-react";
import type { ReactNode } from "react";

import { getKnownArchiveSuffix } from "../../../app/archiveFileTypes";
import { formatBytes } from "../../../app/formatting";
import type { ArchiveWorkspaceDetailsModel } from "../../../app/workspaces/archiveWorkspace";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { nativeIconDataUrlForArchivePath, nativeIconDataUrlForEntry, nativeIconDataUrlForFolder } from "./archiveNativeIcons";

type ArchiveEntryKind = Extract<ArchiveWorkspaceDetailsModel, { kind: "entry" }>["entry"]["kind"];

export function ArchiveDetailsPane() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);

  return (
    <aside id="details-pane" className="details-pane" aria-label={i18n.t("workspace.details.aria")}>
      <div className="pane-header">
        <h2 id="details-pane-title">{i18n.t("pane.details")}</h2>
      </div>
      <div id="details-content" className="details-content">
        <DetailsContent model={snapshot.archive.view.details} />
      </div>
    </aside>
  );
}

function DetailsContent({ model }: Readonly<{ model: ArchiveWorkspaceDetailsModel }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);

  switch (model.kind) {
    case "noArchive":
      return (
        <div className="details-empty">
          <h3>No archive open</h3>
          <p>{i18n.t("browse.noArchiveOpen")}</p>
          <button
            className="primary-action"
            type="button"
            data-details-action="open-archive"
            onClick={() => actions.handleArchiveIntent({ type: "runDetailsAction", action: "open-archive" })}
          >
            {i18n.t("browse.emptyOpenAction")}
          </button>
        </div>
      );
    case "hiddenSelection":
      return (
        <DetailBlock title={i18n.t("detail.selectionHiddenBySearch")} rows={[
          ["Selected", String(model.selectedCount)],
          ["Search", model.searchQuery],
          ["First selected", model.firstSelectedEntryName || model.firstSelectedEntryPath],
        ]}>
          <button
            className="primary-action"
            type="button"
            data-details-action="clear-search"
            onClick={() => actions.handleArchiveIntent({ type: "runDetailsAction", action: "clear-search" })}
          >
            {i18n.t("search.clear")}
          </button>
        </DetailBlock>
      );
    case "archiveSummary":
      return (
        <DetailBlock
          title={model.archivePath.split(/[\\/]/).filter(Boolean).at(-1) ?? model.archivePath}
          icon={<Archive />}
          iconKind="archive"
          nativeIconDataUrl={nativeIconDataUrlForArchivePath(snapshot, model.archivePath)}
          rows={[
          ["Archive path", model.archivePath],
          [i18n.t("detail.format"), archiveFormatLabel(model.archivePath)],
          ["Entries", String(model.entryCount)],
          ["Folder", model.currentFolder || "/"],
          ["Unpacked size", model.unpackedSize === null ? "" : formatBytes(model.unpackedSize, { locale: snapshot.display.resolvedLocale })],
          ["Packed size", model.packedSize === null ? "" : formatBytes(model.packedSize, { locale: snapshot.display.resolvedLocale })],
        ]}
        />
      );
    case "syntheticFolder":
      return (
        <DetailBlock title={model.row.name} icon={<Folder />} iconKind="folder" nativeIconDataUrl={nativeIconDataUrlForFolder(snapshot)} rows={[
          ["Name", model.row.name],
          ["Path", model.row.path],
          ["Type", i18n.t("entryKind.directory")],
        ]} />
      );
    case "entry":
      return (
        <DetailBlock
          title={model.entry.path.split("/").at(-1) ?? model.entry.path}
          icon={model.entry.kind === "directory" ? <Folder /> : <File />}
          iconKind={model.entry.kind === "directory" ? "folder" : "file"}
          nativeIconDataUrl={nativeIconDataUrlForEntry(snapshot, model.entry)}
          rows={[
          ["Path", model.entry.path],
          ["Type", entryKindLabel(model.entry.kind, i18n)],
          ["Size", formatBytes(model.entry.size, { locale: snapshot.display.resolvedLocale, emptyValue: "" })],
          ["Packed size", formatBytes(model.entry.compressedSize, { locale: snapshot.display.resolvedLocale, emptyValue: "" })],
        ]}
        >
          {model.entry.kind !== "directory" ? (
            <button
              className="primary-action"
              type="button"
              data-details-action="preview"
              onClick={() => actions.handleArchiveIntent({ type: "runDetailsAction", action: "preview" })}
            >
              {i18n.t("command.view")}
            </button>
          ) : null}
        </DetailBlock>
      );
    case "multipleSelection":
      return (
        <DetailBlock title={`${model.selectedCount} entries selected`} rows={[
          ["Files", String(model.selectedFiles)],
          ["Folders", String(model.selectedFolders)],
          ["Total size", model.totalSize === null ? "" : formatBytes(model.totalSize, { locale: snapshot.display.resolvedLocale })],
        ]}>
          <button
            className="primary-action"
            type="button"
            data-details-action="extract-selected"
            onClick={() => actions.handleArchiveIntent({ type: "runDetailsAction", action: "extract-selected" })}
          >
            Extract Selected
          </button>
        </DetailBlock>
      );
  }
}

function DetailBlock({
  children,
  icon,
  iconKind,
  nativeIconDataUrl,
  rows,
  title,
}: Readonly<{
  children?: ReactNode;
  icon?: ReactNode;
  iconKind?: string;
  nativeIconDataUrl?: string | null;
  rows: readonly (readonly [string, string | null | undefined])[];
  title: string;
}>) {
  const actions = useZManagerActions();

  return (
    <div className="detail-block">
      <h3 className={icon ? "detail-title" : undefined}>
        {icon ? (
          <span className={`detail-icon detail-icon-${iconKind ?? "file"}`} aria-hidden="true" draggable={false}>
            {nativeIconDataUrl ? (
              <img className="detail-icon-native-image" src={nativeIconDataUrl} alt="" draggable={false} />
            ) : icon}
          </span>
        ) : null}
        <span>{title}</span>
      </h3>
      {children ? <div className="detail-actions">{children}</div> : null}
      <dl className="detail-list">
        {rows.filter(([, value]) => Boolean(value)).map(([label, value]) => (
          <DetailDefinition label={label} value={value ?? ""} actions={actions} key={label} />
        ))}
      </dl>
    </div>
  );
}

function DetailDefinition({
  actions,
  label,
  value,
}: Readonly<{
  actions: ReturnType<typeof useZManagerActions>;
  label: string;
  value: string;
}>) {
  const valueMode = detailValueMode(value);
  const displayValue = valueMode === "middle" ? middleTruncateDetailValue(value) : value;

  return (
    <div>
      <dt>{label}</dt>
      <dd className="detail-copyable" title={value} aria-label={`${label}: ${value}`}>
        {valueMode === "middle" ? (
          <>
            <span className="detail-value detail-value-middle" aria-hidden="true">{displayValue}</span>
            <span className="sr-only">{value}</span>
          </>
        ) : (
          <span className="detail-value detail-value-wrap">{displayValue}</span>
        )}
        <button
          className="detail-copy-button"
          type="button"
          data-copy-value={value}
          aria-label={`Copy ${label}`}
          title="Copy"
          onClick={() => actions.handleArchiveIntent({ type: "copyDetailsValue", value })}
        >
          <Copy className="tool-icon" aria-hidden="true" />
        </button>
      </dd>
    </div>
  );
}

function detailValueMode(value: string): "wrap" | "middle" {
  return /[\\/]/.test(value) && value.length > 48 ? "middle" : "wrap";
}

function middleTruncateDetailValue(value: string, maxLength = 88): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 3) * 0.56);
  const tailLength = Math.floor((maxLength - 3) * 0.44);
  return `${value.slice(0, headLength)}...${value.slice(value.length - tailLength)}`;
}

function entryKindLabel(kind: ArchiveEntryKind, i18n: ReturnType<typeof translatorForSnapshot>): string {
  switch (kind) {
    case "directory":
      return i18n.t("entryKind.directory");
    case "hardlink":
      return i18n.t("entryKind.hardlink");
    case "symlink":
      return i18n.t("entryKind.symlink");
    case "special":
      return i18n.t("entryKind.special");
    case "file":
      return i18n.t("entryKind.file");
  }
}

function archiveFormatLabel(path: string): string | null {
  const suffix = getKnownArchiveSuffix(path);
  return suffix ? suffix.slice(1).toUpperCase() : null;
}
