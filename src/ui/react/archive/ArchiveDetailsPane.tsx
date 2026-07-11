import { Archive, Copy, File, Folder, Plus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { getKnownArchiveSuffix } from "../../../app/archiveFileTypes";
import { formatBytes } from "../../../app/formatting";
import type { ArchiveWorkspaceDetailsModel } from "../../../app/workspaces/archiveWorkspace";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { nativeIconDataUrlForArchivePath, nativeIconDataUrlForEntry, nativeIconDataUrlForFolder } from "./archiveNativeIcons";
import { useExtractPasswordState } from "./ExtractPasswordContext";

type ArchiveEntryKind = Extract<ArchiveWorkspaceDetailsModel, { kind: "entry" }>["entry"]["kind"];

export function ArchiveDetailsPane() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);

  return (
    <aside id="details-pane" className="details-pane !min-h-0 !overflow-y-auto [@media(max-height:560px)]:[&_details.advanced-options]:!hidden" aria-label={i18n.t("workspace.details.aria")}>
      <div className="pane-header [@media(max-height:560px)]:!hidden">
        <h2 id="details-pane-title">{i18n.t("compress.options")}</h2>
      </div>
      <div className="extract-side-pane-content">
        <ExtractOptions />
        <TzapVerification />
        <section className="extract-details-section [@media(max-height:560px)]:!hidden" aria-labelledby="extract-details-title">
          <h2 id="extract-details-title">{i18n.t("pane.details")}</h2>
          <div id="details-content" className="details-content">
            <DetailsContent model={snapshot.archive.view.details} />
          </div>
        </section>
      </div>
    </aside>
  );
}

function TzapVerification() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const verification = snapshot.extract.tzapVerification;
  const isTzap = snapshot.archive.currentArchivePath.toLowerCase().includes(".tzap");
  if (!isTzap) {
    return null;
  }

  const busy = verification.state === "checking";
  const successful = verification.state === "trusted" || verification.state === "signatureValid";
  return (
    <section className="rounded-xl border border-black/10 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]" aria-labelledby="tzap-verification-title">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 rounded-lg p-1.5 ${successful ? "bg-emerald-500/10 text-emerald-700" : verification.state === "error" ? "bg-red-500/10 text-red-700" : "bg-blue-500/10 text-blue-700"}`} aria-hidden="true">
          {verification.state === "error" ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="tzap-verification-title" className="text-xs font-semibold">{i18n.t("extract.tzapVerification.title")}</h3>
          <p className="mt-0.5 text-[11px] opacity-70">{i18n.t("extract.tzapVerification.description")}</p>
        </div>
      </div>

      <label className="mt-3 grid gap-1 text-[11px] font-medium">
        <span>{i18n.t("extract.tzapVerification.mode")}</span>
        <select value={verification.validateTrust ? "trust" : "signature"} disabled={busy} onChange={(event) => actions.handleArchiveIntent({ type: "setTzapVerificationOptions", patch: { validateTrust: event.currentTarget.value === "trust" } })}>
          <option value="signature">{i18n.t("extract.tzapVerification.signatureOnly")}</option>
          <option value="trust">{i18n.t("extract.tzapVerification.validateTrust")}</option>
        </select>
      </label>

      {verification.validateTrust ? (
        <div className="mt-3 grid gap-2 rounded-lg bg-black/[0.025] p-2 dark:bg-white/[0.035]">
          <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={verification.includeOfficialTzapRoot} disabled={busy} onChange={(event) => actions.handleArchiveIntent({ type: "setTzapVerificationOptions", patch: { includeOfficialTzapRoot: event.currentTarget.checked } })} /><span>{i18n.t("extract.tzapVerification.officialRoot")}</span></label>
          <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={verification.trustedSystemRoots} disabled={busy} onChange={(event) => actions.handleArchiveIntent({ type: "setTzapVerificationOptions", patch: { trustedSystemRoots: event.currentTarget.checked } })} /><span>{i18n.t("extract.tzapVerification.systemRoots")}</span></label>
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium">{i18n.t("extract.tzapVerification.customCAs")}</span><button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5" disabled={busy} onClick={() => actions.handleArchiveIntent({ type: "chooseTzapTrustedCAs" })}><Plus className="size-3" />{i18n.t("common.add")}</button></div>
          {verification.trustedCaCertificatePaths.map((path) => <div className="flex min-w-0 items-center gap-1 rounded-md border border-black/10 bg-white/70 px-2 py-1 dark:border-white/10 dark:bg-black/10" key={path}><span className="min-w-0 flex-1 truncate text-[10px]" title={path}>{path.split(/[\\/]/).at(-1)}</span><button type="button" className="rounded p-0.5 hover:bg-black/5" aria-label={i18n.t("common.remove")} onClick={() => actions.handleArchiveIntent({ type: "removeTzapTrustedCA", path })}><X className="size-3" /></button></div>)}
        </div>
      ) : null}

      <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50" disabled={busy || (verification.validateTrust && !verification.includeOfficialTzapRoot && !verification.trustedSystemRoots && verification.trustedCaCertificatePaths.length === 0)} onClick={() => actions.handleArchiveIntent({ type: "verifyTzapCertificate" })}>{busy ? i18n.t("extract.tzapVerification.checking") : verification.validateTrust ? i18n.t("extract.tzapVerification.validate") : i18n.t("extract.tzapVerification.inspect")}</button>

      {verification.result ? <div className="mt-3 grid gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2 text-[10px]"><strong className="text-emerald-700">{verification.state === "trusted" ? i18n.t("extract.tzapVerification.trusted") : i18n.t("extract.tzapVerification.signatureValid")}</strong><span className="truncate" title={verification.result.subject}>{verification.result.subject}</span><span className="truncate opacity-70" title={verification.result.issuer}>{verification.result.issuer}</span><code className="truncate opacity-70" title={verification.result.certificateSha256}>{verification.result.certificateSha256}</code></div> : null}
      {verification.error ? <p className="mt-2 text-[10px] text-red-700" role="alert">{verification.error}</p> : null}
    </section>
  );
}

function ExtractOptions() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const options = snapshot.extract;
  const passwordState = useExtractPasswordState();
  const [advancedOpen, setAdvancedOpen] = useState(options.passwordPromptOpen);

  useEffect(() => {
    if (options.passwordPromptOpen) {
      setAdvancedOpen(true);
    }
  }, [options.passwordPromptOpen]);


  return (
    <section className="extract-options-panel" aria-labelledby="extract-options-title">
      <div className="compress-options-intro">
        <h3 id="extract-options-title">{i18n.t("extract.options.title")}</h3>
        <p>{options.usesGlobalDefaults ? i18n.t("extract.usingGlobalDefaults") : i18n.t("extract.overriddenDefaults")}</p>
      </div>
      <div className="form-grid extract-options-grid [@media(max-height:560px)]:!grid-cols-2">
        <label>
          <span>{i18n.t("extract.pathMode")}</span>
          <select id="extract-path-mode" value={options.pathMode} onChange={(event) => actions.handleArchiveIntent({ type: "setExtractOptions", patch: { pathMode: event.currentTarget.value as typeof options.pathMode } })}>
            <option value="full">{i18n.t("extract.pathMode.full")}</option>
            <option value="current">{i18n.t("extract.pathMode.current")}</option>
            <option value="none">{i18n.t("extract.pathMode.none")}</option>
          </select>
        </label>
        <label>
          <span>{i18n.t("extract.overwritePolicy")}</span>
          <select id="extract-overwrite" value={options.overwrite} onChange={(event) => actions.handleArchiveIntent({ type: "setExtractOptions", patch: { overwrite: event.currentTarget.value as typeof options.overwrite } })}>
            <option value="refuse">{i18n.t("extract.overwrite.refuse")}</option>
            <option value="ask">{i18n.t("extract.overwrite.ask")}</option>
            <option value="rename">{i18n.t("extract.overwrite.rename")}</option>
            <option value="replace">{i18n.t("extract.overwrite.replace")}</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input id="extract-deduplicate-root" type="checkbox" checked={options.deduplicateRoot} onChange={(event) => actions.handleArchiveIntent({ type: "setExtractOptions", patch: { deduplicateRoot: event.currentTarget.checked } })} />
          <span>{i18n.t("extract.deduplicateRoot")}</span>
        </label>
      </div>
      <button className="link-action [@media(max-height:560px)]:!hidden" type="button" onClick={() => {
        actions.handleArchiveIntent({ type: "resetExtractDefaults" });
        passwordState.reset();
      }}>
        {i18n.t("extract.resetGlobalDefaults")}
      </button>
      <details className="advanced-options" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>{i18n.t("extract.advancedOptions")}</summary>
        <div className="form-grid form-grid-compact extract-advanced-grid">
          <label>
            <span>{i18n.t("extract.stripComponents")}</span>
            <input id="extract-strip-components" type="number" min="0" value={options.stripComponents} onChange={(event) => actions.handleArchiveIntent({ type: "setExtractOptions", patch: { stripComponents: Math.max(0, Number.parseInt(event.currentTarget.value, 10) || 0) } })} />
          </label>
          <label>
            <span>{i18n.t("extract.password")}</span>
            <input id="extract-password" type={passwordState.showPassword ? "text" : "password"} value={passwordState.password} onChange={(event) => passwordState.setPassword(event.currentTarget.value)} />
          </label>
          <label className="checkbox-row">
            <input id="extract-show-password" type="checkbox" checked={passwordState.showPassword} onChange={(event) => passwordState.setShowPassword(event.currentTarget.checked)} />
            <span>{i18n.t("extract.showPassword")}</span>
          </label>
        </div>
      </details>
    </section>
  );
}

function DetailsContent({ model }: Readonly<{ model: ArchiveWorkspaceDetailsModel }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const openCommandState = snapshot.commands.states.open;

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
            disabled={!openCommandState.enabled}
            title={openCommandState.enabled ? undefined : openCommandState.reason}
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
