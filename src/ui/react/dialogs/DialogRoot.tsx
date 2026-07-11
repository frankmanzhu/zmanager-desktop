import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOutput, SlidersHorizontal, X } from "lucide-react";

import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerDialogSnapshot } from "../appRuntime";
import { PreferencesDialog } from "../preferences/PreferencesDialog";
import { translatorForSnapshot } from "../shell/shellHelpers";

export function DialogRoot() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  useDialogFocusRestoration(snapshot.dialog, snapshot.archive.view.selection.focusedPath);

  useEffect(() => {
    if (snapshot.dialog.kind === "none" && !snapshot.preferencesDraft) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      actions.handleDialogIntent(snapshot.preferencesDraft ? { type: "preferencesCancel" } : { type: "closeCurrent" });
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [actions, snapshot.dialog.kind, snapshot.preferencesDraft]);

  if (snapshot.preferencesDraft) {
    return <PreferencesDialog />;
  }

  if (snapshot.dialog.kind === "none") {
    return null;
  }

  if (snapshot.dialog.kind === "extract") {
    return <ExtractDialog dialog={snapshot.dialog} />;
  }

  if (snapshot.dialog.kind === "info") {
    return <InfoDialog dialog={snapshot.dialog} />;
  }

  if (snapshot.dialog.kind === "about") {
    return <AboutDialog dialog={snapshot.dialog} />;
  }

  return null;
}

function useDialogFocusRestoration(dialog: ZManagerDialogSnapshot, archiveFocusedPath: string) {
  const previousDialogRef = useRef<ZManagerDialogSnapshot>({ kind: "none" });
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousDialog = previousDialogRef.current;
    if (previousDialog.kind === "none" && dialog.kind !== "none") {
      const activeElement = document.activeElement;
      returnFocusRef.current = activeElement instanceof HTMLElement
        ? dialogReturnFocusElement(activeElement)
        : null;
    }

    if (previousDialog.kind !== "none" && dialog.kind === "none") {
      const returnFocusTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      window.requestAnimationFrame(() => {
        const fallbackTarget = focusTargetForClosedDialog(previousDialog, archiveFocusedPath);
        const target = previousDialog.kind === "info"
          ? fallbackTarget ?? focusableConnectedElement(returnFocusTarget)
          : focusableConnectedElement(returnFocusTarget) ?? fallbackTarget;
        target?.focus();
      });
    }

    previousDialogRef.current = dialog;
  }, [archiveFocusedPath, dialog]);
}

function focusableConnectedElement(element: HTMLElement | null): HTMLElement | null {
  return dialogReturnFocusElement(element);
}

function dialogReturnFocusElement(element: HTMLElement | null): HTMLElement | null {
  if (!element?.isConnected) {
    return null;
  }

  if (element.closest("[hidden], .context-menu")) {
    return null;
  }

  return element;
}

function focusTargetForClosedDialog(dialog: ZManagerDialogSnapshot, archiveFocusedPath: string): HTMLElement | null {
  if (dialog.kind === "info") {
    return archiveRowElement(dialog.returnFocusPath) ?? document.querySelector<HTMLElement>("#info-toolbar");
  }

  if (dialog.kind === "extract") {
    return archiveRowElement(archiveFocusedPath) ?? document.querySelector<HTMLElement>("#extract-all");
  }

  return null;
}

function archiveRowElement(path: string): HTMLElement | null {
  if (!path) {
    return null;
  }

  return document.querySelector<HTMLElement>(`tr[data-entry-path="${CSS.escape(path)}"]`);
}

function InfoDialog({ dialog }: Readonly<{ dialog: Extract<ZManagerDialogSnapshot, { kind: "info" }> }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-6 backdrop-blur-[2px]" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        actions.handleDialogIntent({ type: "closeCurrent" });
      }
    }}>
      <section className="dialog property-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title" tabIndex={-1}>
        <div className="dialog-header">
          <div>
            <h2 id="info-title">{dialog.title}</h2>
            <p id="info-description">{dialog.description}</p>
          </div>
        </div>
        <div className="dialog-body property-dialog-body">
          <div id="info-dialog-body" className="diagnostics">
            <section className="dialog-section property-section">
              <h3>{dialog.sectionTitle}</h3>
              <dl className="detail-list">
                {dialog.rows.map((row) => (
                  <div key={`${row.label}:${row.value}`}>
                    <dt>{row.label}</dt>
                    <dd className="detail-copyable" title={row.value} aria-label={`${row.label}: ${row.value}`}>
                      <span className={`detail-value detail-value-${row.mode ?? detailValueMode(row.value)}`}>
                        {(row.mode ?? detailValueMode(row.value)) === "middle"
                          ? middleTruncateDetailValue(row.value)
                          : row.value}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
        <div className="dialog-actions">
          <div id="info-action-group" className="dialog-action-group">
            {dialog.actions.map((action) => (
              <Button
                type="button"
                variant={action.primary ? "dialogPrimary" : "dialog"}
                size="unset"
                className={action.primary ? "primary-action" : undefined}
                title={action.title}
                aria-label={action.title ? `${action.label}: ${action.title}` : undefined}
                onClick={() => actions.handleDialogIntent({
                  type: "infoAction",
                  action: action.action,
                  copyValue: action.copyValue,
                })}
                key={`${action.label}:${action.action ?? action.copyValue ?? ""}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <Button id="info-close" type="button" variant="dialog" size="unset" onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}>
            {i18n.t("common.close")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function AboutDialog({ dialog }: Readonly<{ dialog: Extract<ZManagerDialogSnapshot, { kind: "about" }> }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const [copied, setCopied] = useState(false);

  return (
    <div className="dialog-backdrop" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        actions.handleDialogIntent({ type: "closeCurrent" });
      }
    }}>
      <section className="dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex={-1}>
        <div className="dialog-header">
          <div>
            <h2 id="about-title">{dialog.title}</h2>
            <p>{i18n.t("about.description")}</p>
          </div>
          <Button
            id="about-dialog-close"
            variant="dialog"
            size="unset"
            className="icon-button"
            type="button"
            aria-label={i18n.t("about.close.aria")}
            onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}
          >
            {i18n.t("common.close")}
          </Button>
        </div>
        <div className="dialog-body property-dialog-body about-property-body">
          <div id="about-diagnostics" className="diagnostics diagnostics-groups">
            {dialog.groups.map((group) => (
              <section className="diagnostic-group" data-diagnostics-group key={group.title}>
                <h3>{group.title}</h3>
                <dl className="detail-list">
                  {group.rows.map(([label, value]) => (
                    <div key={`${label}:${value}`}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <Button
            id="copy-diagnostics"
            type="button"
            variant="dialog"
            size="unset"
            onClick={() => {
              actions.handleDialogIntent({ type: "copyAboutDiagnostics" });
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? i18n.t("status.copied") : i18n.t("about.copyDiagnostics")}
          </Button>
          <Button id="about-close" type="button" variant="dialog" size="unset" onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}>
            {i18n.t("common.close")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ExtractDialog({ dialog }: Readonly<{ dialog: Extract<ZManagerDialogSnapshot, { kind: "extract" }> }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const destinationRef = useRef<HTMLInputElement | null>(null);
  const [destination, setDestination] = useState(dialog.destination);
  const [useSubfolder, setUseSubfolder] = useState(dialog.useSubfolder);
  const [subfolder, setSubfolder] = useState(dialog.subfolder);
  const [pathMode, setPathMode] = useState(dialog.pathMode);
  const [overwrite, setOverwrite] = useState(dialog.overwrite);
  const [stripComponents, setStripComponents] = useState(dialog.stripComponents);
  const [deduplicateRoot, setDeduplicateRoot] = useState(dialog.deduplicateRoot);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const canExtract = destination.trim().length > 0;

  useEffect(() => {
    setDestination(dialog.destination);
    setUseSubfolder(dialog.useSubfolder);
    setSubfolder(dialog.subfolder);
    setPathMode(dialog.pathMode);
    setOverwrite(dialog.overwrite);
    setStripComponents(dialog.stripComponents);
    setDeduplicateRoot(dialog.deduplicateRoot);
  }, [
    dialog.destination,
    dialog.useSubfolder,
    dialog.subfolder,
    dialog.pathMode,
    dialog.overwrite,
    dialog.stripComponents,
    dialog.deduplicateRoot,
  ]);

  useEffect(() => {
    setPassword("");
    setShowPassword(false);
  }, [dialog.mode, dialog.passwordPromptOpen]);

  useEffect(() => {
    destinationRef.current?.focus();
  }, []);

  const form = {
    destination,
    useSubfolder,
    subfolder,
    pathMode,
    overwrite,
    stripComponents,
    deduplicateRoot,
  };

  return (
    <div className="dialog-backdrop" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        actions.handleDialogIntent({ type: "closeCurrent" });
      }
    }}>
      <section
        className="grid max-h-[calc(100vh-48px)] w-[min(720px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extract-title"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400"><FolderOutput className="size-4" />Extraction task</div>
            <h2 id="extract-title" className="text-xl font-semibold tracking-tight">{dialog.title}</h2>
            <p id="extract-dialog-message" className="mt-1 max-w-xl text-sm leading-5 text-slate-500 dark:text-slate-400">{dialog.message}</p>
          </div>
          <Button
            id="extract-dialog-close"
            variant="dialog"
            size="unset"
            className="!size-9 !rounded-lg !border-0 !bg-transparent !p-0 hover:!bg-slate-100 dark:hover:!bg-slate-800"
            type="button"
            aria-label={i18n.t("extract.close.aria")}
            onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto bg-slate-50/40 px-6 py-5 dark:bg-slate-950">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 [&>label]:grid [&>label]:gap-1.5 [&>label>span]:text-xs [&>label>span]:font-semibold">
            <div className="flex items-center gap-2"><div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><FolderOutput className="size-4" /></div><h3 className="text-sm font-semibold">{i18n.t("extract.destination")}</h3></div>
            <label>
              <span>{i18n.t("extract.destination")}</span>
              <div className="inline-field">
                <input
                  id="extract-destination"
                  ref={destinationRef}
                  type="text"
                  list="extract-destination-history"
                  placeholder={i18n.t("extract.destination.placeholder")}
                  value={destination}
                  onChange={(event) => setDestination(event.currentTarget.value)}
                />
                <datalist id="extract-destination-history">
                  {dialog.destinationHistory.map((entry) => (
                    <option value={entry} key={entry} />
                  ))}
                </datalist>
                <Button
                  id="browse-extract-destination"
                  variant="dialog"
                  size="unset"
                  type="button"
                  onClick={() => actions.handleDialogIntent({ type: "browseExtractDestination", ...form })}
                >
                  {i18n.t("common.browse")}
                </Button>
              </div>
            </label>
            <label className="checkbox-row">
              <input
                id="extract-use-subfolder"
                type="checkbox"
                checked={useSubfolder}
                onChange={(event) => setUseSubfolder(event.currentTarget.checked)}
              />
              <span>{i18n.t("extract.toSubfolder")}</span>
            </label>
            <label>
              <span>{i18n.t("extract.subfolder")}</span>
              <input
                id="extract-subfolder"
                type="text"
                placeholder={i18n.t("common.optional")}
                value={subfolder}
                disabled={!useSubfolder}
                onChange={(event) => setSubfolder(event.currentTarget.value)}
              />
            </label>
          </section>
          <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-slate-800/70 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><SlidersHorizontal className="size-4" /></span><span><strong className="block text-sm">{i18n.t("extract.advancedOptions")}</strong><span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">Path handling, collisions, password and folder structure</span></span></span>
              <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-5 dark:border-slate-800">
            <div className="form-grid !gap-4 [&>label]:!grid-cols-1 [&>label]:!items-stretch [&>label]:!gap-1.5 [&>label>span]:text-xs [&>label>span]:font-semibold">
              <label>
                <span>{i18n.t("extract.pathMode")}</span>
                <select
                  id="extract-path-mode"
                  value={pathMode}
                  onChange={(event) => setPathMode(event.currentTarget.value as typeof pathMode)}
                >
                  <option value="full">{i18n.t("extract.pathMode.full")}</option>
                  <option value="current">{i18n.t("extract.pathMode.current")}</option>
                  <option value="none">{i18n.t("extract.pathMode.none")}</option>
                </select>
              </label>
              <label>
                <span>{i18n.t("extract.overwritePolicy")}</span>
                <select
                  id="browse-overwrite"
                  value={overwrite}
                  onChange={(event) => setOverwrite(event.currentTarget.value as typeof overwrite)}
                >
                  <option value="refuse">{i18n.t("extract.overwrite.refuse")}</option>
                  <option value="ask">{i18n.t("extract.overwrite.ask")}</option>
                  <option value="rename">{i18n.t("extract.overwrite.rename")}</option>
                  <option value="replace">{i18n.t("extract.overwrite.replace")}</option>
                </select>
              </label>
              <label>
                <span>{i18n.t("extract.stripComponents")}</span>
                <input
                  id="browse-strip-components"
                  type="number"
                  min="0"
                  value={stripComponents}
                  onChange={(event) => setStripComponents(event.currentTarget.value)}
                />
              </label>
              <label className="checkbox-row min-h-10 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <input
                  id="extract-deduplicate-root"
                  type="checkbox"
                  checked={deduplicateRoot}
                  onChange={(event) => setDeduplicateRoot(event.currentTarget.checked)}
                />
                <span>{i18n.t("extract.deduplicateRoot")}</span>
              </label>
            </div>
            <details className="group/password overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40" open={dialog.passwordPromptOpen}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold [&::-webkit-details-marker]:hidden">{i18n.t("extract.password")}<ChevronDown className="size-4 text-slate-400 transition-transform group-open/password:rotate-180" /></summary>
              <div className="grid gap-3 border-t border-slate-200 p-4 dark:border-slate-700">
              <label>
                <span>{i18n.t("extract.password")}</span>
                <input
                  id="browse-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
              </label>
              <label className="checkbox-row">
                <input
                  id="browse-show-password"
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.currentTarget.checked)}
                />
                <span>{i18n.t("extract.showPassword")}</span>
              </label>
              </div>
            </details>
            </div>
          </details>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <Button
            id="extract-cancel"
            variant="dialog"
            size="unset"
            type="button"
            onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}
          >
            {i18n.t("common.cancel")}
          </Button>
          <Button
            id="extract-start"
            variant={canExtract ? "dialogPrimary" : "dialog"}
            size="unset"
            type="button"
            className={canExtract ? "primary-action min-w-24" : "min-w-24"}
            aria-disabled={!canExtract}
            disabled={!canExtract}
            onClick={() => actions.handleDialogIntent({
              type: "submitExtract",
              mode: dialog.mode,
              ...form,
              password,
            })}
          >
            {dialog.startLabel}
          </Button>
        </footer>
      </section>
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
