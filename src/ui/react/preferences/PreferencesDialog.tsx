import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import {
  Archive,
  Columns,
  FolderOpen,
  Monitor,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import {
  createFormatSupportsPassword,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
} from "../../../app/createFlow";
import {
  createDefaultsForFormat,
  type AppPreferences,
  type FormatCreateDefaults,
} from "../../../app/preferences";
import { createFormatCapabilities, supportedCreateFormats } from "../../../app/createFormatCapabilities";
import {
  formatVolumeSize,
  formatVolumeSizePresetList,
  parseVolumeSizePresetList,
} from "../../../app/volumeSizePresets";
import { ARCHIVE_TABLE_COLUMNS } from "../../../app/archiveTable";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { HelpTooltip } from "../../components/ui/tooltip";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { CompressionLevelSelect } from "../create/CompressionLevelSelect";

type PreferencePage =
  "folders" | "archive" | "columns" | "extraction" | "interface" | "safety";
type CreateFormat = AppPreferences["defaultArchiveFormat"];

const FORMAT_LABELS: Record<CreateFormat, string> = {
  zip: "ZIP",
  tarZst: "TZST",
  tarGz: "TGZ",
  tzap: "TZAP",
  sevenZ: "7Z",
  appleArchive: "AAR",
};

const PAGE_ICONS: Record<PreferencePage, typeof FolderOpen> = {
  folders: FolderOpen,
  archive: Archive,
  columns: Columns,
  extraction: Sparkles,
  interface: Monitor,
  safety: ShieldCheck,
};

const PREFERENCE_PAGE_CLASS = [
  "space-y-5",
  "[&>h3]:text-xl [&>h3]:font-semibold [&>h3]:tracking-tight",
].join(" ");

const DESCRIPTION_CLASS =
  "-mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400";
const SETTING_GRID_CLASS = "grid gap-3 lg:grid-cols-2";
const SETTING_ROW_CLASS =
  "grid grid-cols-1 items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 [&>label]:text-sm [&>label]:font-semibold";
const SETTING_CONTROL_CLASS = "min-w-0 space-y-2 [&_select]:w-full";
const SETTING_DESCRIPTION_CLASS =
  "text-xs leading-5 text-slate-500 dark:text-slate-400";
const QUICK_BADGE_CLASS =
  "mr-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300";
const INLINE_FIELD_CLASS = "grid grid-cols-[minmax(0,1fr)_auto] gap-2";
const TOGGLE_GRID_CLASS = "grid gap-3 lg:grid-cols-2";
const TOGGLE_LINE_CLASS =
  "flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70";

const IDENTITY_FIELD_CLASS =
  "grid gap-1.5 text-[11px] font-semibold leading-4 text-slate-600 dark:text-slate-300 [&>input]:h-9 [&>input]:w-full [&>input]:text-xs [&>input]:font-normal";

const PAGES: readonly Readonly<{
  id: PreferencePage;
  labelKey: Parameters<ReturnType<typeof translatorForSnapshot>["t"]>[0];
}>[] = [
  { id: "folders", labelKey: "preferences.folders.title" },
  { id: "archive", labelKey: "preferences.archiveDefaults.title" },
  { id: "columns", labelKey: "Columns" as any },
  { id: "extraction", labelKey: "preferences.extraction.title" },
  { id: "interface", labelKey: "preferences.interface.title" },
  { id: "safety", labelKey: "preferences.safety.title" },
];

export function PreferencesDialog() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const draft = snapshot.preferencesDraft;
  const [activePage, setActivePage] = useState<PreferencePage>("folders");
  const [selectedCreateFormat, setSelectedCreateFormat] =
    useState<CreateFormat>(
      draft?.defaultArchiveFormat ?? snapshot.preferences.defaultArchiveFormat,
    );
  const [customOutputFocused, setCustomOutputFocused] = useState(false);

  useEffect(() => {
    if (draft) {
      setSelectedCreateFormat(draft.defaultArchiveFormat);
    }
  }, [draft?.defaultArchiveFormat]);

  if (!draft) {
    return null;
  }

  const customOutputSelected = draft.defaultOutputLocation === "customFolder";
  const customOutputMissing =
    customOutputSelected && !draft.customOutputFolderPath.trim();

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-6 backdrop-blur-[2px]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.handleDialogIntent({ type: "preferencesCancel" });
        }
      }}
    >
      <section
        className="grid h-[min(780px,calc(100vh-48px))] w-[min(1040px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        tabIndex={-1}
        autoFocus
      >
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 px-7 py-5 dark:border-slate-800">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
              <Sparkles className="size-3.5" />
              ZManager
            </div>
            <h2
              id="preferences-title"
              className="text-2xl font-semibold tracking-tight"
            >
              {i18n.t("preferences.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {i18n.t("preferences.description")}
            </p>
          </div>
          <Button
            id="preferences-dialog-close"
            variant="dialog"
            size="unset"
            className="!size-9 !rounded-lg !border-0 !bg-transparent !p-0 hover:!bg-slate-100 dark:hover:!bg-slate-800"
            type="button"
            aria-label={i18n.t("preferences.close.aria")}
            onClick={() =>
              actions.handleDialogIntent({ type: "preferencesCancel" })
            }
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] max-md:grid-cols-1">
          <nav
            className="flex flex-col gap-1 border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/45 max-md:flex-row max-md:overflow-x-auto max-md:border-b max-md:border-r-0"
            aria-label="Preference categories"
          >
            {PAGES.map((page) => (
              <PreferenceNavigationButton
                icon={PAGE_ICONS[page.id]}
                type="button"
                data-pref-page-target={page.id}
                aria-selected={activePage === page.id}
                onClick={() => setActivePage(page.id)}
                key={page.id}
              >
                {page.id === "columns" ? "Columns" : i18n.t(page.labelKey)}
              </PreferenceNavigationButton>
            ))}
          </nav>
          <div className="min-h-0 overflow-y-auto bg-slate-50/35 px-7 py-6 dark:bg-slate-950">
            <div className="mx-auto max-w-3xl">
              <FoldersPage
                draft={draft}
                active={activePage === "folders"}
                customOutputFocused={customOutputFocused}
                customOutputMissing={customOutputMissing}
                setCustomOutputFocused={setCustomOutputFocused}
              />
              <ArchiveDefaultsPage
                draft={draft}
                active={activePage === "archive"}
                selectedCreateFormat={selectedCreateFormat}
                setSelectedCreateFormat={setSelectedCreateFormat}
              />
              <ExtractionPage
                draft={draft}
                active={activePage === "extraction"}
              />
              <InterfacePage
                draft={draft}
                active={activePage === "interface"}
              />
              <ColumnsPage
                draft={draft}
                active={activePage === "columns"}
              />
              <SafetyPage draft={draft} active={activePage === "safety"} />
              <p
                id="preferences-status"
                className={`mt-6 rounded-xl border px-4 py-3 text-xs ${customOutputMissing ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400"}`}
              >
                {customOutputMissing
                  ? i18n.t("preferences.validation.customOutputRequired")
                  : i18n.t("preferences.status.localOnly")}
              </p>
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-7 py-4 dark:border-slate-800 dark:bg-slate-950">
          <Button
            id="preferences-cancel"
            type="button"
            variant="dialog"
            size="unset"
            onClick={() =>
              actions.handleDialogIntent({ type: "preferencesCancel" })
            }
          >
            {i18n.t("common.cancel")}
          </Button>
          <Button
            id="preferences-save"
            type="button"
            variant="dialogPrimary"
            size="unset"
            disabled={customOutputMissing}
            onClick={() =>
              actions.handleDialogIntent({ type: "preferencesSave" })
            }
          >
            {i18n.t("common.save")}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function PreferenceNavigationButton({
  icon: Icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: typeof FolderOpen }) {
  return (
    <button
      {...props}
      className="flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950 aria-selected:bg-white aria-selected:text-blue-700 aria-selected:shadow-sm dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:aria-selected:bg-slate-800 dark:aria-selected:text-blue-300"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

function FoldersPage({
  draft,
  active,
  customOutputFocused,
  customOutputMissing,
  setCustomOutputFocused,
}: Readonly<{
  draft: AppPreferences;
  active: boolean;
  customOutputFocused: boolean;
  customOutputMissing: boolean;
  setCustomOutputFocused(value: boolean): void;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const customOutputSelected = draft.defaultOutputLocation === "customFolder";
  const customOutputDisplay = customOutputFocused
    ? draft.customOutputFolderPath
    : middleTruncatePath(draft.customOutputFolderPath);

  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="folders"
      hidden={!active}
    >
      <h3>{i18n.t("preferences.folders.title")}</h3>
      <p className={DESCRIPTION_CLASS}>
        {i18n.t("preferences.folders.description")}
      </p>
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-output-location">
          {i18n.t("preferences.folders.workingOutput")}
        </label>
        <div className={SETTING_CONTROL_CLASS}>
          <select
            id="pref-output-location"
            value={draft.defaultOutputLocation}
            onChange={(event) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: {
                  defaultOutputLocation: event.currentTarget
                    .value as AppPreferences["defaultOutputLocation"],
                },
              })
            }
          >
            <option value="sourceFolder">
              {i18n.t("preferences.folders.sourceFolder")}
            </option>
            <option value="customFolder">
              {i18n.t("preferences.folders.customFolder")}
            </option>
          </select>
          <p className={SETTING_DESCRIPTION_CLASS}>
            <span className={QUICK_BADGE_CLASS}>
              {i18n.t("preferences.quickActions.badge")}
            </span>{" "}
            <span>{i18n.t("preferences.folders.quickDescription")}</span>
          </p>
        </div>
      </div>
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-custom-output">
          {i18n.t("preferences.folders.customFolder")}
        </label>
        <div className={SETTING_CONTROL_CLASS}>
          <div className={INLINE_FIELD_CLASS}>
            <input
              id="pref-custom-output"
              className="path-input"
              type="text"
              aria-describedby="pref-custom-output-help pref-custom-output-validation"
              aria-invalid={customOutputMissing}
              placeholder={i18n.t("preferences.folders.customPlaceholder")}
              value={customOutputDisplay}
              title={draft.customOutputFolderPath}
              disabled={!customOutputSelected}
              onFocus={() => setCustomOutputFocused(true)}
              onChange={(event) =>
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: { customOutputFolderPath: event.currentTarget.value },
                })
              }
              onBlur={() => setCustomOutputFocused(false)}
            />
            <Button
              id="pref-choose-output"
              type="button"
              variant="dialog"
              size="unset"
              disabled={!customOutputSelected}
              onClick={() =>
                actions.handleDialogIntent({ type: "preferencesChooseOutput" })
              }
            >
              {i18n.t("common.browse")}
            </Button>
          </div>
          <p id="pref-custom-output-help" className={SETTING_DESCRIPTION_CLASS}>
            {i18n.t("preferences.folders.customHelp")}
          </p>
          <p
            id="pref-custom-output-validation"
            className={
              customOutputMissing
                ? "setting-validation status-error"
                : "setting-validation"
            }
            aria-live="polite"
            hidden={!customOutputMissing}
          >
            {customOutputMissing
              ? i18n.t("preferences.validation.customOutputRequired")
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
        <label
          className="mb-2 block text-xs font-semibold"
          htmlFor="pref-custom-extract-output"
        >
          {i18n.t("preferences.folders.extractFolder")}
        </label>
        <div className="flex gap-2">
          <input
            id="pref-custom-extract-output"
            className="min-w-0 flex-1"
            type="text"
            placeholder={i18n.t("preferences.folders.extractPlaceholder")}
            value={draft.customExtractFolderPath}
            onChange={(event) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: { customExtractFolderPath: event.currentTarget.value },
              })
            }
          />
          <Button
            id="pref-choose-extract-output"
            type="button"
            variant="dialog"
            size="unset"
            onClick={() =>
              actions.handleDialogIntent({
                type: "preferencesChooseExtractOutput",
              })
            }
          >
            {i18n.t("common.browse")}
          </Button>
        </div>
        <p className="mt-2 text-xs opacity-70">
          {i18n.t("preferences.folders.extractHelp")}
        </p>
      </div>
    </section>
  );
}

function ArchiveDefaultsPage({
  draft,
  active,
  selectedCreateFormat,
  setSelectedCreateFormat,
}: Readonly<{
  draft: AppPreferences;
  active: boolean;
  selectedCreateFormat: CreateFormat;
  setSelectedCreateFormat(format: CreateFormat): void;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const defaults = createDefaultsForFormat(draft, selectedCreateFormat);
  const [identityName, setIdentityName] = useState("TZAP Signing Identity");
  const [identityPassword, setIdentityPassword] = useState("");
  const supportsTzapRecovery = selectedCreateFormat === "tzap";
  const supportsPassword = createFormatSupportsPassword(selectedCreateFormat);
  const capabilities = createFormatCapabilities(selectedCreateFormat);
  const volumeSizeChoices =
    defaults.volumeSize !== null &&
    !draft.volumeSizePresets.includes(defaults.volumeSize)
      ? [defaults.volumeSize, ...draft.volumeSizePresets]
      : draft.volumeSizePresets;

  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="archive"
      hidden={!active}
    >
      <h3>{i18n.t("preferences.archiveDefaults.title")}</h3>
      <p className={DESCRIPTION_CLASS}>
        {i18n.t("preferences.archiveDefaults.description")}
      </p>
      <div className={SETTING_GRID_CLASS}>
        <div className={SETTING_ROW_CLASS}>
          <label htmlFor="pref-default-format">
            {i18n.t("preferences.archiveDefaults.defaultFormat")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <FormatSelect
              id="pref-default-format"
              value={draft.defaultArchiveFormat}
              isMacOs={snapshot.runtime.isMacOs}
              onChange={(format) => {
                setSelectedCreateFormat(format);
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: {
                    defaultArchiveFormat: format,
                    defaultCleanSourceEnabled: createDefaultsForFormat(
                      draft,
                      format,
                    ).cleanSource,
                  },
                });
              }}
            />
            <p className={SETTING_DESCRIPTION_CLASS}>
              <span className={QUICK_BADGE_CLASS}>
                {i18n.t("preferences.quickActions.badge")}
              </span>{" "}
              <span>
                {i18n.t("preferences.archiveDefaults.formatQuickDescription")}
              </span>
            </p>
          </div>
        </div>
        <div className={SETTING_ROW_CLASS}>
          <label htmlFor="pref-create-format">
            {i18n.t("preferences.archiveDefaults.editFormat")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <FormatSelect
              id="pref-create-format"
              value={selectedCreateFormat}
              isMacOs={snapshot.runtime.isMacOs}
              onChange={setSelectedCreateFormat}
            />
          </div>
        </div>
        <div
          className={SETTING_ROW_CLASS}
          hidden={!capabilities.compressionLevel}
        >
          <label htmlFor="pref-create-compression-level">
            {i18n.t("preferences.archiveDefaults.compressionLevel")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <CompressionLevelSelect
              id="pref-create-compression-level"
              value={defaults.compressionLevel}
              i18n={i18n}
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  compressionLevel: optionalNumber(event.currentTarget.value),
                })
              }
            />
          </div>
        </div>
        <div className={SETTING_ROW_CLASS} hidden={!capabilities.splitVolumes}>
          <label htmlFor="pref-create-volume">
            {i18n.t("create.splitSize")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <select
              id="pref-create-volume"
              value={defaults.volumeSize ?? ""}
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  volumeSize: optionalPositiveNumber(event.currentTarget.value),
                })
              }
            >
              <option value="">{i18n.t("create.noSplit")}</option>
              {volumeSizeChoices.map((bytes) => (
                <option value={bytes} key={bytes}>
                  {formatVolumeSize(bytes)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          id="pref-create-tzap-recovery-field"
          className={SETTING_ROW_CLASS}
          hidden={!supportsTzapRecovery}
        >
          <label htmlFor="pref-create-tzap-recovery">
            {i18n.t("create.tzapRecovery")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <input
              id="pref-create-tzap-recovery"
              type="number"
              min={TZAP_RECOVERY_PERCENTAGE_MIN}
              max={TZAP_RECOVERY_PERCENTAGE_MAX}
              disabled={!supportsTzapRecovery}
              value={
                supportsTzapRecovery
                  ? (defaults.tzapRecoveryPercentage ??
                    TZAP_RECOVERY_PERCENTAGE_DEFAULT)
                  : ""
              }
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  tzapRecoveryPercentage: optionalNumber(
                    event.currentTarget.value,
                  ),
                })
              }
            />
          </div>
        </div>
        <div
          className={SETTING_ROW_CLASS}
          hidden={!capabilities.zipCompression}
        >
          <label htmlFor="pref-create-zip-compression">
            {i18n.t("create.zipCompression")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <select
              id="pref-create-zip-compression"
              value={defaults.zipCompression ?? "deflate"}
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  zipCompression: event.currentTarget.value as
                    "store" | "deflate",
                })
              }
            >
              <option value="deflate">Deflate</option>
              <option value="store">{i18n.t("common.store")}</option>
            </select>
          </div>
        </div>
        <div
          className={SETTING_ROW_CLASS}
          hidden={!capabilities.tzapVolumeLossTolerance}
        >
          <label htmlFor="pref-create-tzap-volume-tolerance">
            {i18n.t("create.tzapVolumeLossTolerance")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <input
              id="pref-create-tzap-volume-tolerance"
              type="number"
              min="0"
              max="16"
              disabled={!defaults.volumeSize}
              value={
                defaults.volumeSize
                  ? (defaults.tzapVolumeLossTolerance ?? 1)
                  : 0
              }
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  tzapVolumeLossTolerance:
                    optionalNumber(event.currentTarget.value) ?? 0,
                })
              }
            />
          </div>
        </div>
        <div
          className={SETTING_ROW_CLASS}
          hidden={!capabilities.sevenZAdvanced}
        >
          <label htmlFor="pref-create-7z-threads">
            {i18n.t("create.sevenZThreads")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <input
              id="pref-create-7z-threads"
              type="number"
              min="1"
              max="256"
              placeholder={i18n.t("preferences.archiveDefaults.backendDefault")}
              value={defaults.sevenZThreads ?? ""}
              onChange={(event) =>
                patchCreateDefaults(actions, selectedCreateFormat, {
                  sevenZThreads: optionalPositiveNumber(
                    event.currentTarget.value,
                  ),
                })
              }
            />
          </div>
        </div>
      </div>
      <VolumeSizePresetEditor draft={draft} />
      {selectedCreateFormat === "tzap" ? (
        <section className="mt-4 rounded-xl border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <h4 className="text-xs font-semibold">
            {i18n.t("preferences.archiveDefaults.signingIdentity")}
          </h4>
          <p className="mt-1 text-xs opacity-65">
            {i18n.t("preferences.archiveDefaults.signingIdentityHelp")}
          </p>
          <div className="mt-3 grid grid-cols-2 rounded-lg bg-black/[0.06] p-1 dark:bg-white/[0.06]">
            <button
              type="button"
              className={`rounded-md px-2 py-1.5 !text-xs ${defaults.tzapSigningMode !== "advanced" ? "bg-blue-600 text-white shadow-sm" : "opacity-70"}`}
              onClick={() =>
                patchCreateDefaults(actions, "tzap", {
                  tzapSigningMode: "identity",
                })
              }
            >
              {i18n.t("create.tzapIdentityFile")}
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1.5 !text-xs ${defaults.tzapSigningMode === "advanced" ? "bg-blue-600 text-white shadow-sm" : "opacity-70"}`}
              onClick={() =>
                patchCreateDefaults(actions, "tzap", {
                  tzapSigningMode: "advanced",
                })
              }
            >
              {i18n.t("create.tzapAdvancedIdentity")}
            </button>
          </div>
          {defaults.tzapSigningMode !== "advanced" ? (
            <div className="mt-3 grid gap-3">
              <PreferenceSigningFile
                label={i18n.t("create.tzapIdentityFile")}
                value={defaults.tzapSigningIdentityPath ?? ""}
                onChoose={() =>
                  actions.handleDialogIntent({
                    type: "preferencesChooseTzapSigningFile",
                    target: "identity",
                  })
                }
              />
              <label className={IDENTITY_FIELD_CLASS}>
                <span>{i18n.t("create.tzapIdentityName")}</span>
                <input
                  aria-label={i18n.t("create.tzapIdentityName")}
                  value={identityName}
                  onChange={(event) =>
                    setIdentityName(event.currentTarget.value)
                  }
                />
              </label>
              <label className={IDENTITY_FIELD_CLASS}>
                <span>{i18n.t("create.tzapIdentityPassword")}</span>
                <input
                  aria-label={i18n.t("create.tzapIdentityPassword")}
                  type="password"
                  value={identityPassword}
                  onChange={(event) =>
                    setIdentityPassword(event.currentTarget.value)
                  }
                />
              </label>
              <button
                type="button"
                className="min-h-9 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 !text-[11px] !font-semibold text-blue-700 dark:text-blue-300"
                onClick={() =>
                  actions.handleDialogIntent({
                    type: "preferencesGenerateTzapIdentity",
                    commonName: identityName,
                    password: identityPassword,
                  })
                }
              >
                {i18n.t("create.tzapCreateIdentity")}
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <PreferenceSigningFile
                label={i18n.t("create.tzapSigningCertificate")}
                value={defaults.tzapSigningCertificatePath ?? ""}
                onChoose={() =>
                  actions.handleDialogIntent({
                    type: "preferencesChooseTzapSigningFile",
                    target: "certificate",
                  })
                }
              />
              <PreferenceSigningFile
                label={i18n.t("create.tzapSigningPrivateKey")}
                value={defaults.tzapSigningPrivateKeyPath ?? ""}
                onChoose={() =>
                  actions.handleDialogIntent({
                    type: "preferencesChooseTzapSigningFile",
                    target: "privateKey",
                  })
                }
              />
              <PreferenceSigningFile
                label={i18n.t("create.tzapSigningChain")}
                value={defaults.tzapSigningChainPaths ?? ""}
                onChoose={() =>
                  actions.handleDialogIntent({
                    type: "preferencesChooseTzapSigningFile",
                    target: "chain",
                  })
                }
              />
              <p className="text-xs opacity-65">
                {i18n.t("create.tzapIntermediateHelp")}
              </p>
            </div>
          )}
        </section>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
        <PreferenceCheckbox
          id="pref-create-clean-source"
          label={i18n.t("create.cleanSource")}
          tooltip={i18n.t("create.cleanSource.tooltip")}
          checked={defaults.cleanSource}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              cleanSource: checked,
            })
          }
        />
        <PreferenceCheckbox
          id="pref-create-respect-gitignore"
          label={i18n.t("create.respectGitignore")}
          tooltip={i18n.t("create.respectGitignore.tooltip")}
          checked={Boolean(defaults.respectGitignore)}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              respectGitignore: checked,
            })
          }
        />
        <PreferenceCheckbox
          id="pref-create-follow-symlinks"
          label={i18n.t("create.followSymlinks")}
          tooltip={i18n.t("create.followSymlinks.tooltip")}
          checked={Boolean(defaults.followSymlinks)}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              followSymlinks: checked,
            })
          }
        />
        <PreferenceCheckbox
          id="pref-create-preserve-metadata"
          label={i18n.t("create.preserveMetadata")}
          tooltip={i18n.t(
            `create.preserveMetadata.${selectedCreateFormat}.tooltip`,
          )}
          checked={defaults.preserveMetadata}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              preserveMetadata: checked,
            })
          }
        />
        <PreferenceCheckbox
          id="pref-create-replace-existing"
          label={i18n.t("create.replaceExisting")}
          tooltip={i18n.t("create.replaceExisting.tooltip")}
          checked={defaults.replaceExisting}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              replaceExisting: checked,
            })
          }
        />
        <PreferenceCheckbox
          id="pref-create-prompt-password"
          label={i18n.t("create.promptForPassword")}
          tooltip={i18n.t("create.promptForPassword.tooltip")}
          checked={supportsPassword && defaults.promptForPassword}
          disabled={!supportsPassword}
          onChange={(checked) =>
            patchCreateDefaults(actions, selectedCreateFormat, {
              promptForPassword: checked,
            })
          }
        />
        {capabilities.sevenZAdvanced ? (
          <PreferenceCheckbox
            id="pref-create-7z-solid"
            label={i18n.t("create.sevenZSolid")}
            tooltip={i18n.t("create.sevenZSolid.tooltip")}
            checked={defaults.sevenZSolid ?? true}
            onChange={(checked) =>
              patchCreateDefaults(actions, selectedCreateFormat, {
                sevenZSolid: checked,
              })
            }
          />
        ) : null}
        {capabilities.sevenZAdvanced ? (
          <PreferenceCheckbox
            id="pref-create-7z-encrypt-names"
            label={i18n.t("create.sevenZEncryptFileNames")}
            tooltip={i18n.t("create.sevenZEncryptFileNames.tooltip")}
            checked={defaults.sevenZEncryptFileNames ?? true}
            onChange={(checked) =>
              patchCreateDefaults(actions, selectedCreateFormat, {
                sevenZEncryptFileNames: checked,
              })
            }
          />
        ) : null}
      </div>
      <p className={`${SETTING_DESCRIPTION_CLASS} mt-2`}>
        <span className={QUICK_BADGE_CLASS}>
          {i18n.t("preferences.quickActions.badge")}
        </span>{" "}
        <span>{i18n.t("preferences.safety.quickDescription")}</span>
      </p>
    </section>
  );
}

function VolumeSizePresetEditor({
  draft,
}: Readonly<{ draft: AppPreferences }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const canonical = formatVolumeSizePresetList(draft.volumeSizePresets);
  const [value, setValue] = useState(canonical);
  const parsed = parseVolumeSizePresetList(value);

  useEffect(() => setValue(canonical), [canonical]);

  const commit = () => {
    if (parsed) {
      actions.handleDialogIntent({
        type: "preferencesPatch",
        patch: { volumeSizePresets: parsed },
      });
    } else {
      setValue(canonical);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <label
        className="mb-2 block text-xs font-semibold"
        htmlFor="pref-volume-size-presets"
      >
        {i18n.t("preferences.archiveDefaults.volumeChoices")}
      </label>
      <input
        id="pref-volume-size-presets"
        className="w-full"
        type="text"
        value={value}
        aria-invalid={parsed === null}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <p className="mt-2 text-xs opacity-70">
        {i18n.t("preferences.archiveDefaults.volumeChoicesHelp")}
      </p>
    </div>
  );
}

function PreferenceSigningFile({
  label,
  value,
  onChoose,
}: Readonly<{ label: string; value: string; onChoose(): void }>) {
  const display =
    value
      .split(/[;\\/]/)
      .filter(Boolean)
      .at(-1) ?? "Not configured";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-black/10 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-black/10">
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold leading-4">
          {label}
        </span>
        <span
          className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400"
          title={value}
        >
          {display}
        </span>
      </div>
      <button
        type="button"
        className="min-h-8 rounded-md px-2 py-1 !text-[11px] !font-medium hover:bg-black/5 dark:hover:bg-white/5"
        onClick={onChoose}
      >
        {value ? "Change" : "Choose"}
      </button>
    </div>
  );
}

function ExtractionPage({
  draft,
  active,
}: Readonly<{ draft: AppPreferences; active: boolean }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="extraction"
      hidden={!active}
    >
      <h3>{i18n.t("preferences.extraction.title")}</h3>
      <p className={DESCRIPTION_CLASS}>
        {i18n.t("preferences.extraction.description")}
      </p>
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-default-extraction">
          {i18n.t("preferences.archiveDefaults.defaultExtraction")}
        </label>
        <div className={SETTING_CONTROL_CLASS}>
          <select
            id="pref-default-extraction"
            value={draft.defaultExtractionBehavior}
            onChange={(event) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: {
                  defaultExtractionBehavior: event.currentTarget
                    .value as AppPreferences["defaultExtractionBehavior"],
                },
              })
            }
          >
            <option value="askEveryTime">
              {i18n.t("preferences.extraction.askEveryTime")}
            </option>
            <option value="extractHere">
              {i18n.t("preferences.extraction.extractHere")}
            </option>
            <option value="extractToFolder">
              {i18n.t("preferences.extraction.extractToFolder")}
            </option>
          </select>
          <p className={SETTING_DESCRIPTION_CLASS}>
            <span className={QUICK_BADGE_CLASS}>
              {i18n.t("preferences.quickActions.badge")}
            </span>{" "}
            <span>{i18n.t("preferences.extraction.quickDescription")}</span>
          </p>
        </div>
      </div>
      <div className={SETTING_GRID_CLASS}>
        <div className={SETTING_ROW_CLASS}>
          <label htmlFor="pref-extract-path-mode">
            {i18n.t("extract.pathMode")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <select
              id="pref-extract-path-mode"
              value={draft.defaultExtractPathMode}
              onChange={(event) =>
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: {
                    defaultExtractPathMode: event.currentTarget
                      .value as AppPreferences["defaultExtractPathMode"],
                  },
                })
              }
            >
              <option value="full">{i18n.t("extract.pathMode.full")}</option>
              <option value="current">
                {i18n.t("extract.pathMode.current")}
              </option>
              <option value="none">{i18n.t("extract.pathMode.none")}</option>
            </select>
          </div>
        </div>
        <div className={SETTING_ROW_CLASS}>
          <label htmlFor="pref-extract-overwrite">
            {i18n.t("extract.overwritePolicy")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <select
              id="pref-extract-overwrite"
              value={draft.defaultExtractOverwrite}
              onChange={(event) =>
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: {
                    defaultExtractOverwrite: event.currentTarget
                      .value as AppPreferences["defaultExtractOverwrite"],
                  },
                })
              }
            >
              <option value="refuse">
                {i18n.t("extract.overwrite.refuse")}
              </option>
              <option value="ask">{i18n.t("extract.overwrite.ask")}</option>
              <option value="rename">
                {i18n.t("extract.overwrite.rename")}
              </option>
              <option value="replace">
                {i18n.t("extract.overwrite.replace")}
              </option>
            </select>
          </div>
        </div>
        <div className={SETTING_ROW_CLASS}>
          <label htmlFor="pref-extract-strip-components">
            {i18n.t("extract.stripComponents")}
          </label>
          <div className={SETTING_CONTROL_CLASS}>
            <input
              id="pref-extract-strip-components"
              type="number"
              min="0"
              value={draft.defaultExtractStripComponents}
              onChange={(event) =>
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: {
                    defaultExtractStripComponents: Math.max(
                      0,
                      Number.parseInt(event.currentTarget.value, 10) || 0,
                    ),
                  },
                })
              }
            />
          </div>
        </div>
      </div>
      <PreferenceCheckbox
        id="pref-extract-deduplicate-root"
        label={i18n.t("extract.deduplicateRoot")}
        checked={draft.defaultExtractDeduplicateRoot}
        onChange={(checked) =>
          actions.handleDialogIntent({
            type: "preferencesPatch",
            patch: { defaultExtractDeduplicateRoot: checked },
          })
        }
      />
      <div className="mt-4 grid gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
        <div>
          <h4 className="text-xs font-semibold">
            {i18n.t("preferences.extraction.tzapMetadata")}
          </h4>
          <p className="mt-1 text-xs leading-5 opacity-70">
            {i18n.t("preferences.extraction.tzapMetadata.help")}
          </p>
        </div>
        <label className="grid gap-1.5 text-xs font-semibold">
          <span>{i18n.t("extract.tzapRestorePolicy")}</span>
          <Select
            value={draft.defaultTzapRestorePolicy}
            onValueChange={(value) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: {
                  defaultTzapRestorePolicy:
                    value as AppPreferences["defaultTzapRestorePolicy"],
                  ...(value === "content" || value === "portable"
                    ? { defaultTzapAllowDegraded: false }
                    : {}),
                },
              })
            }
          >
            <SelectTrigger id="pref-tzap-restore-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">
                {i18n.t("extract.tzapRestorePolicy.content")}
              </SelectItem>
              <SelectItem value="portable">
                {i18n.t("extract.tzapRestorePolicy.portable")}
              </SelectItem>
              <SelectItem value="sameOs">
                {i18n.t("extract.tzapRestorePolicy.sameOs")}
              </SelectItem>
              <SelectItem value="system">
                {i18n.t("extract.tzapRestorePolicy.system")}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] font-normal leading-4 opacity-70">
            {i18n.t(
              `extract.tzapRestorePolicy.${draft.defaultTzapRestorePolicy}.help`,
            )}
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs font-medium">
          <Checkbox
            id="pref-tzap-allow-degraded"
            checked={draft.defaultTzapAllowDegraded}
            disabled={
              draft.defaultTzapRestorePolicy === "content" ||
              draft.defaultTzapRestorePolicy === "portable"
            }
            onCheckedChange={(checked) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: { defaultTzapAllowDegraded: checked === true },
              })
            }
          />
          <span className="grid gap-0.5">
            <span>{i18n.t("extract.tzapAllowDegraded")}</span>
            <span className="font-normal leading-4 opacity-70">
              {i18n.t("extract.tzapAllowDegraded.help")}
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

function InterfacePage({
  draft,
  active,
}: Readonly<{ draft: AppPreferences; active: boolean }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="interface"
      hidden={!active}
    >
      <h3>{i18n.t("preferences.interface.title")}</h3>
      <p className={DESCRIPTION_CLASS}>
        {i18n.t("preferences.interface.description")}
      </p>
      <div className={TOGGLE_GRID_CLASS}>
        <PreferenceCheckbox
          id="pref-show-parent"
          label={i18n.t("preferences.interface.showParent")}
          checked={draft.showParentFolderItem}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { showParentFolderItem: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-real-file-icons"
          label={i18n.t("preferences.interface.realFileIcons")}
          checked={draft.showRealFileIcons}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { showRealFileIcons: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-full-row-select"
          label={i18n.t("preferences.interface.fullRowSelect")}
          checked={draft.fullRowSelect}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { fullRowSelect: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-show-grid"
          label={i18n.t("preferences.interface.showGrid")}
          checked={draft.showGridLines}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { showGridLines: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-single-click"
          label={i18n.t("preferences.interface.singleClick")}
          checked={draft.singleClickOpen}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { singleClickOpen: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-alternative-selection"
          label={i18n.t("preferences.interface.alternativeSelection")}
          checked={draft.alternativeSelectionMode}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { alternativeSelectionMode: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-toolbar-labels"
          label={i18n.t("preferences.interface.toolbarLabels")}
          checked={draft.showToolbarLabels}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { showToolbarLabels: checked },
            })
          }
        />
        <PreferenceCheckbox
          id="pref-flat-view"
          label={i18n.t("preferences.interface.flatView")}
          checked={draft.flatViewDefault}
          onChange={(checked) =>
            actions.handleDialogIntent({
              type: "preferencesPatch",
              patch: { flatViewDefault: checked },
            })
          }
        />
      </div>
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-language">
          {i18n.t("preferences.language.title")}
        </label>
        <div className={SETTING_CONTROL_CLASS}>
          <select
            id="pref-language"
            value={draft.locale}
            onChange={(event) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: {
                  locale: event.currentTarget.value as AppPreferences["locale"],
                },
              })
            }
          >
            <option value="system">
              {i18n.t("preferences.language.systemDefault")}
            </option>
            <option value="en">{i18n.t("preferences.language.english")}</option>
            <option value="zh-CN">
              {i18n.t("preferences.language.chineseSimplified")}
            </option>
          </select>
        </div>
      </div>
    </section>
  );
}

function SafetyPage({
  draft,
  active,
}: Readonly<{
  draft: AppPreferences;
  active: boolean;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);

  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="safety"
      hidden={!active}
    >
      <h3>{i18n.t("preferences.safety.title")}</h3>
      <p className={DESCRIPTION_CLASS}>
        {i18n.t("preferences.safety.description")}
      </p>
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-preview-cleanup">
          {i18n.t("preferences.archiveDefaults.previewCleanup")}
        </label>
        <div className={SETTING_CONTROL_CLASS}>
          <select
            id="pref-preview-cleanup"
            value={draft.previewCleanupPolicy}
            onChange={(event) =>
              actions.handleDialogIntent({
                type: "preferencesPatch",
                patch: {
                  previewCleanupPolicy: event.currentTarget
                    .value as AppPreferences["previewCleanupPolicy"],
                },
              })
            }
          >
            <option value="beforeNextPreview">
              {i18n.t("preferences.previewCleanup.beforeNextPreview")}
            </option>
            <option value="whenAppCloses">
              {i18n.t("preferences.previewCleanup.whenAppCloses")}
            </option>
          </select>
        </div>
      </div>
      {snapshot.defaultHandlers.status !== "idle" ? (
        <div className={SETTING_ROW_CLASS} data-default-handler-settings>
          <label>{i18n.t("preferences.defaultHandlers.title")}</label>
          <div className={SETTING_CONTROL_CLASS}>
            <p className={SETTING_DESCRIPTION_CLASS}>
              {snapshot.defaultHandlers.error ??
                i18n.t("preferences.defaultHandlers.status", {
                  current: snapshot.defaultHandlers.entries.filter(
                    (entry) => entry.isCurrentApplication,
                  ).length,
                  total: snapshot.defaultHandlers.entries.length,
                })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="dialogPrimary"
                size="unset"
                disabled={snapshot.defaultHandlers.status === "loading"}
                onClick={() =>
                  actions.handleDialogIntent({ type: "defaultHandlersSet" })
                }
              >
                {i18n.t("preferences.defaultHandlers.set")}
              </Button>
              <Button
                type="button"
                variant="dialog"
                size="unset"
                disabled={
                  !snapshot.defaultHandlers.canRestore ||
                  snapshot.defaultHandlers.status === "loading"
                }
                onClick={() =>
                  actions.handleDialogIntent({ type: "defaultHandlersRestore" })
                }
              >
                {i18n.t("preferences.defaultHandlers.restore")}
              </Button>
              <Button
                type="button"
                variant="dialog"
                size="unset"
                disabled={snapshot.defaultHandlers.status === "loading"}
                onClick={() =>
                  actions.handleDialogIntent({ type: "defaultHandlersRefresh" })
                }
              >
                {i18n.t("common.refresh")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PreferenceCheckbox({
  id,
  label,
  tooltip,
  checked,
  disabled = false,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  tooltip?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}>) {
  const checkbox = (
    <label className={TOGGLE_LINE_CLASS}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />{" "}
      <span>{label}</span>
    </label>
  );
  return tooltip ? (
    <HelpTooltip content={tooltip}>{checkbox}</HelpTooltip>
  ) : (
    checkbox
  );
}

function FormatSelect({
  id,
  value,
  onChange,
  isMacOs,
}: Readonly<{
  id: string;
  value: CreateFormat;
  onChange(format: CreateFormat): void;
  isMacOs: boolean;
}>) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value as CreateFormat)}
    >
      {supportedCreateFormats(isMacOs).map((format) => (
        <option key={format} value={format}>
          {FORMAT_LABELS[format]}
        </option>
      ))}
    </select>
  );
}

function patchCreateDefaults(
  actions: ReturnType<typeof useZManagerActions>,
  format: CreateFormat,
  patch: Partial<FormatCreateDefaults>,
): void {
  actions.handleDialogIntent({
    type: "preferencesCreateDefaultsPatch",
    format,
    patch,
  });
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function optionalPositiveNumber(value: string): number | null {
  const parsed = optionalNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

const CUSTOM_OUTPUT_TRUNCATE_LENGTH = 40;
const CUSTOM_OUTPUT_TRUNCATE_HEAD = 21;
const CUSTOM_OUTPUT_TRUNCATE_TAIL = 13;

function middleTruncatePath(value: string): string {
  return value.length <= CUSTOM_OUTPUT_TRUNCATE_LENGTH
    ? value
    : `${value.slice(0, CUSTOM_OUTPUT_TRUNCATE_HEAD)}...${value.slice(-CUSTOM_OUTPUT_TRUNCATE_TAIL)}`;
}

function ColumnsPage({
  draft,
  active,
}: Readonly<{
  draft: AppPreferences;
  active: boolean;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const [selectedFormat, setSelectedFormat] = useState<string>("default");

  const currentColumns = draft.tableColumnsByFormat[selectedFormat] ?? {
    visibleColumnIds: draft.tableVisibleColumnIds ?? [],
    columnOrderIds: draft.tableColumnOrderIds ?? [],
    columnWidths: draft.tableColumnWidths ?? {},
  };

  const handleToggleColumn = (columnId: string) => {
    const isVisible = currentColumns.visibleColumnIds.includes(columnId as any);
    const newVisible = isVisible
      ? currentColumns.visibleColumnIds.filter((id: string) => id !== columnId)
      : [...currentColumns.visibleColumnIds, columnId];

    const patch: Record<string, unknown> = {};
    if (selectedFormat === "default") {
      patch.tableVisibleColumnIds = newVisible;
      patch.tableColumnOrderIds = currentColumns.columnOrderIds;
      
      const nextFormats = { ...draft.tableColumnsByFormat };
      delete nextFormats["default"];
      patch.tableColumnsByFormat = nextFormats;
    } else {
      patch.tableColumnsByFormat = {
        ...draft.tableColumnsByFormat,
        [selectedFormat]: {
          ...currentColumns,
          visibleColumnIds: newVisible,
        },
      };
    }

    actions.handleDialogIntent({
      type: "preferencesPatch",
      patch: patch as any,
    });
  };

  const handleReset = () => {
    if (selectedFormat === "default") return;
    const nextFormats = { ...draft.tableColumnsByFormat };
    delete nextFormats[selectedFormat];
    actions.handleDialogIntent({
      type: "preferencesPatch",
      patch: {
        tableColumnsByFormat: nextFormats,
      },
    });
  };

  const hasLocalOverride = selectedFormat !== "default" && draft.tableColumnsByFormat[selectedFormat] !== undefined;

  return (
    <section
      className={PREFERENCE_PAGE_CLASS}
      data-pref-page="columns"
      hidden={!active}
    >
      <h3>Columns</h3>
      <p className={DESCRIPTION_CLASS}>
        Configure the default table columns for each archive format.
      </p>
      
      <div className={SETTING_ROW_CLASS}>
        <label htmlFor="pref-columns-format">Archive Format</label>
        <div className={SETTING_CONTROL_CLASS}>
          <Select
            value={selectedFormat}
            onValueChange={setSelectedFormat}
          >
            <SelectTrigger id="pref-columns-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Global Defaults</SelectItem>
              <SelectItem value=".zip">ZIP</SelectItem>
              <SelectItem value=".tar.zst">TZST</SelectItem>
              <SelectItem value=".tar.gz">TGZ</SelectItem>
              <SelectItem value=".tzap">TZAP</SelectItem>
              <SelectItem value=".7z">7Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Visible Columns</h4>
        {hasLocalOverride && (
          <Button
            type="button"
            variant="dialog"
            size="unset"
            className="!px-2 !py-1 !text-xs"
            onClick={handleReset}
          >
            Reset to Global Defaults
          </Button>
        )}
      </div>

      <div className="mt-2 grid gap-2">
        {ARCHIVE_TABLE_COLUMNS.map((column) => (
          <label key={column.id} className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={currentColumns.visibleColumnIds.includes(column.id as any)}
              disabled={column.alwaysVisible}
              onCheckedChange={() => handleToggleColumn(column.id)}
            />
            {i18n.t(column.labelKey as any) || column.labelKey}
          </label>
        ))}
      </div>
    </section>
  );
}
