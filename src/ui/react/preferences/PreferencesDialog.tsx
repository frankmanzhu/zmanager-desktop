import { useEffect, useState } from "react";

import {
  createFormatSupportsPassword,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
} from "../../../app/createFlow";
import { createDefaultsForFormat, type AppPreferences, type FormatCreateDefaults } from "../../../app/preferences";
import { createFormatCapabilities } from "../../../app/createFormatCapabilities";
import { formatVolumeSize, formatVolumeSizePresetList, parseVolumeSizePresetList } from "../../../app/volumeSizePresets";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";

type PreferencePage = "folders" | "archive" | "extraction" | "interface" | "safety";
type CreateFormat = AppPreferences["defaultArchiveFormat"];

const PAGES: readonly Readonly<{ id: PreferencePage; labelKey: Parameters<ReturnType<typeof translatorForSnapshot>["t"]>[0] }>[] = [
  { id: "folders", labelKey: "preferences.folders.title" },
  { id: "archive", labelKey: "preferences.archiveDefaults.title" },
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
  const [selectedCreateFormat, setSelectedCreateFormat] = useState<CreateFormat>(draft?.defaultArchiveFormat ?? snapshot.preferences.defaultArchiveFormat);
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
  const customOutputMissing = customOutputSelected && !draft.customOutputFolderPath.trim();

  return (
    <div className="dialog-backdrop" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        actions.handleDialogIntent({ type: "preferencesCancel" });
      }
    }}>
      <section className="dialog property-dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="preferences-title" tabIndex={-1}>
        <div className="dialog-header">
          <div>
            <h2 id="preferences-title">{i18n.t("preferences.title")}</h2>
            <p>{i18n.t("preferences.description")}</p>
          </div>
          <Button
            id="preferences-dialog-close"
            variant="dialog"
            size="unset"
            className="icon-button"
            type="button"
            aria-label={i18n.t("preferences.close.aria")}
            onClick={() => actions.handleDialogIntent({ type: "preferencesCancel" })}
          >
            {i18n.t("common.close")}
          </Button>
        </div>
        <div className="dialog-body property-dialog-body preferences-property-body">
          <div className="property-sheet">
            <nav className="property-nav" aria-label="Preference categories">
              {PAGES.map((page) => (
                <button
                  type="button"
                  className="property-nav-item"
                  data-pref-page-target={page.id}
                  aria-selected={activePage === page.id}
                  onClick={() => setActivePage(page.id)}
                  key={page.id}
                >
                  {i18n.t(page.labelKey)}
                </button>
              ))}
            </nav>
            <div className="options-pages">
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
              <ExtractionPage draft={draft} active={activePage === "extraction"} />
              <InterfacePage draft={draft} active={activePage === "interface"} />
              <SafetyPage draft={draft} active={activePage === "safety"} selectedCreateFormat={selectedCreateFormat} />
            </div>
          </div>
          <p id="preferences-status" className={customOutputMissing ? "status status-warning" : "status status-idle"}>
            {customOutputMissing ? i18n.t("preferences.validation.customOutputRequired") : i18n.t("preferences.status.localOnly")}
          </p>
        </div>
        <div className="dialog-actions">
          <Button id="preferences-save" type="button" variant="dialogPrimary" size="unset" disabled={customOutputMissing} onClick={() => actions.handleDialogIntent({ type: "preferencesSave" })}>{i18n.t("common.save")}</Button>
          <Button id="preferences-cancel" type="button" variant="dialog" size="unset" onClick={() => actions.handleDialogIntent({ type: "preferencesCancel" })}>{i18n.t("common.cancel")}</Button>
        </div>
      </section>
    </div>
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
    <section className="options-page property-section" data-pref-page="folders" hidden={!active}>
      <h3>{i18n.t("preferences.folders.title")}</h3>
      <p className="section-description">{i18n.t("preferences.folders.description")}</p>
      <div className="setting-row">
        <label htmlFor="pref-output-location">{i18n.t("preferences.folders.workingOutput")}</label>
        <div className="setting-control">
          <select
            id="pref-output-location"
            value={draft.defaultOutputLocation}
            onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultOutputLocation: event.currentTarget.value as AppPreferences["defaultOutputLocation"] } })}
          >
            <option value="sourceFolder">{i18n.t("preferences.folders.sourceFolder")}</option>
            <option value="customFolder">{i18n.t("preferences.folders.customFolder")}</option>
          </select>
          <p className="setting-description"><span className="quick-action-badge">{i18n.t("preferences.quickActions.badge")}</span> <span>{i18n.t("preferences.folders.quickDescription")}</span></p>
        </div>
      </div>
      <div className="setting-row">
        <label htmlFor="pref-custom-output">{i18n.t("preferences.folders.customFolder")}</label>
        <div className="setting-control">
          <div className="inline-field">
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
              onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { customOutputFolderPath: event.currentTarget.value } })}
              onBlur={() => setCustomOutputFocused(false)}
            />
            <Button id="pref-choose-output" type="button" variant="dialog" size="unset" disabled={!customOutputSelected} onClick={() => actions.handleDialogIntent({ type: "preferencesChooseOutput" })}>
              {i18n.t("common.browse")}
            </Button>
          </div>
          <p id="pref-custom-output-help" className="setting-description">{i18n.t("preferences.folders.customHelp")}</p>
          <p id="pref-custom-output-validation" className={customOutputMissing ? "setting-validation status-error" : "setting-validation"} aria-live="polite" hidden={!customOutputMissing}>
            {customOutputMissing ? i18n.t("preferences.validation.customOutputRequired") : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
        <label className="mb-2 block text-xs font-semibold" htmlFor="pref-custom-extract-output">{i18n.t("preferences.folders.extractFolder")}</label>
        <div className="flex gap-2">
          <input id="pref-custom-extract-output" className="min-w-0 flex-1" type="text" placeholder={i18n.t("preferences.folders.extractPlaceholder")} value={draft.customExtractFolderPath} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { customExtractFolderPath: event.currentTarget.value } })} />
          <Button id="pref-choose-extract-output" type="button" variant="dialog" size="unset" onClick={() => actions.handleDialogIntent({ type: "preferencesChooseExtractOutput" })}>{i18n.t("common.browse")}</Button>
        </div>
        <p className="mt-2 text-xs opacity-70">{i18n.t("preferences.folders.extractHelp")}</p>
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
  const supportsTzapRecovery = selectedCreateFormat === "tzap";
  const capabilities = createFormatCapabilities(selectedCreateFormat);
  const volumeSizeChoices = defaults.volumeSize !== null && !draft.volumeSizePresets.includes(defaults.volumeSize)
    ? [defaults.volumeSize, ...draft.volumeSizePresets]
    : draft.volumeSizePresets;

  return (
    <section className="options-page property-section" data-pref-page="archive" hidden={!active}>
      <h3>{i18n.t("preferences.archiveDefaults.title")}</h3>
      <p className="section-description">{i18n.t("preferences.archiveDefaults.description")}</p>
      <div className="setting-grid">
        <div className="setting-row">
          <label htmlFor="pref-default-format">{i18n.t("preferences.archiveDefaults.defaultFormat")}</label>
          <div className="setting-control">
            <FormatSelect
              id="pref-default-format"
              value={draft.defaultArchiveFormat}
              onChange={(format) => {
                setSelectedCreateFormat(format);
                actions.handleDialogIntent({
                  type: "preferencesPatch",
                  patch: {
                    defaultArchiveFormat: format,
                    defaultCleanSourceEnabled: createDefaultsForFormat(draft, format).cleanSource,
                  },
                });
              }}
            />
            <p className="setting-description"><span className="quick-action-badge">{i18n.t("preferences.quickActions.badge")}</span> <span>{i18n.t("preferences.archiveDefaults.formatQuickDescription")}</span></p>
          </div>
        </div>
        <div className="setting-row">
          <label htmlFor="pref-create-format">{i18n.t("preferences.archiveDefaults.editFormat")}</label>
          <div className="setting-control">
            <FormatSelect id="pref-create-format" value={selectedCreateFormat} onChange={setSelectedCreateFormat} />
          </div>
        </div>
        <div className="setting-row" hidden={!capabilities.compressionLevel}>
          <label htmlFor="pref-create-compression-level">{i18n.t("preferences.archiveDefaults.compressionLevel")}</label>
          <div className="setting-control">
            <select
              id="pref-create-compression-level"
              value={defaults.compressionLevel ?? ""}
              onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { compressionLevel: optionalNumber(event.currentTarget.value) })}
            >
              <option value="">{i18n.t("preferences.archiveDefaults.backendDefault")}</option>
              <option value="0">{i18n.t("common.store")}</option>
              <option value="1">{i18n.t("common.fastest")}</option>
              <option value="3">{i18n.t("common.fast")}</option>
              <option value="9">{i18n.t("common.maximum")}</option>
              <option value="22">{i18n.t("common.ultra")}</option>
            </select>
          </div>
        </div>
        <div className="setting-row" hidden={!capabilities.splitVolumes}>
          <label htmlFor="pref-create-volume">{i18n.t("create.splitSize")}</label>
          <div className="setting-control">
            <select id="pref-create-volume" value={defaults.volumeSize ?? ""} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { volumeSize: optionalPositiveNumber(event.currentTarget.value) })}><option value="">{i18n.t("create.noSplit")}</option>{volumeSizeChoices.map((bytes) => <option value={bytes} key={bytes}>{formatVolumeSize(bytes)}</option>)}</select>
          </div>
        </div>
        <div id="pref-create-tzap-recovery-field" className="setting-row" hidden={!supportsTzapRecovery}>
          <label htmlFor="pref-create-tzap-recovery">{i18n.t("create.tzapRecovery")}</label>
          <div className="setting-control">
            <input id="pref-create-tzap-recovery" type="number" min={TZAP_RECOVERY_PERCENTAGE_MIN} max={TZAP_RECOVERY_PERCENTAGE_MAX} disabled={!supportsTzapRecovery} value={supportsTzapRecovery ? defaults.tzapRecoveryPercentage ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT : ""} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { tzapRecoveryPercentage: optionalNumber(event.currentTarget.value) })} />
          </div>
        </div>
        <div className="setting-row" hidden={!capabilities.zipCompression}>
          <label htmlFor="pref-create-zip-compression">{i18n.t("create.zipCompression")}</label>
          <div className="setting-control"><select id="pref-create-zip-compression" value={defaults.zipCompression ?? "deflate"} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { zipCompression: event.currentTarget.value as "store" | "deflate" })}><option value="deflate">Deflate</option><option value="store">{i18n.t("common.store")}</option></select></div>
        </div>
        <div className="setting-row" hidden={!capabilities.tzapVolumeLossTolerance}>
          <label htmlFor="pref-create-tzap-volume-tolerance">{i18n.t("create.tzapVolumeLossTolerance")}</label>
          <div className="setting-control"><input id="pref-create-tzap-volume-tolerance" type="number" min="0" max="16" disabled={!defaults.volumeSize} value={defaults.volumeSize ? defaults.tzapVolumeLossTolerance ?? 1 : 0} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { tzapVolumeLossTolerance: optionalNumber(event.currentTarget.value) ?? 0 })} /></div>
        </div>
        <div className="setting-row" hidden={!capabilities.sevenZAdvanced}>
          <label htmlFor="pref-create-7z-threads">{i18n.t("create.sevenZThreads")}</label>
          <div className="setting-control"><input id="pref-create-7z-threads" type="number" min="1" max="256" placeholder={i18n.t("preferences.archiveDefaults.backendDefault")} value={defaults.sevenZThreads ?? ""} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { sevenZThreads: optionalPositiveNumber(event.currentTarget.value) })} /></div>
        </div>
      </div>
      <VolumeSizePresetEditor draft={draft} />
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
        <PreferenceCheckbox id="pref-create-respect-gitignore" label={i18n.t("create.respectGitignore")} checked={Boolean(defaults.respectGitignore)} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { respectGitignore: checked })} />
        <PreferenceCheckbox id="pref-create-follow-symlinks" label={i18n.t("create.followSymlinks")} checked={Boolean(defaults.followSymlinks)} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { followSymlinks: checked })} />
        {capabilities.sevenZAdvanced ? <PreferenceCheckbox id="pref-create-7z-solid" label={i18n.t("create.sevenZSolid")} checked={defaults.sevenZSolid ?? true} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { sevenZSolid: checked })} /> : null}
        {capabilities.sevenZAdvanced ? <PreferenceCheckbox id="pref-create-7z-encrypt-names" label={i18n.t("create.sevenZEncryptFileNames")} checked={defaults.sevenZEncryptFileNames ?? true} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { sevenZEncryptFileNames: checked })} /> : null}
      </div>
    </section>
  );
}

function VolumeSizePresetEditor({ draft }: Readonly<{ draft: AppPreferences }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const canonical = formatVolumeSizePresetList(draft.volumeSizePresets);
  const [value, setValue] = useState(canonical);
  const parsed = parseVolumeSizePresetList(value);

  useEffect(() => setValue(canonical), [canonical]);

  const commit = () => {
    if (parsed) {
      actions.handleDialogIntent({ type: "preferencesPatch", patch: { volumeSizePresets: parsed } });
    } else {
      setValue(canonical);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <label className="mb-2 block text-xs font-semibold" htmlFor="pref-volume-size-presets">{i18n.t("preferences.archiveDefaults.volumeChoices")}</label>
      <input id="pref-volume-size-presets" className="w-full" type="text" value={value} aria-invalid={parsed === null} onChange={(event) => setValue(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
      <p className="mt-2 text-xs opacity-70">{i18n.t("preferences.archiveDefaults.volumeChoicesHelp")}</p>
    </div>
  );
}

function ExtractionPage({ draft, active }: Readonly<{ draft: AppPreferences; active: boolean }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <section className="options-page property-section" data-pref-page="extraction" hidden={!active}>
      <h3>{i18n.t("preferences.extraction.title")}</h3>
      <p className="section-description">{i18n.t("preferences.extraction.description")}</p>
      <div className="setting-row">
        <label htmlFor="pref-default-extraction">{i18n.t("preferences.archiveDefaults.defaultExtraction")}</label>
        <div className="setting-control">
          <select id="pref-default-extraction" value={draft.defaultExtractionBehavior} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultExtractionBehavior: event.currentTarget.value as AppPreferences["defaultExtractionBehavior"] } })}>
            <option value="askEveryTime">{i18n.t("preferences.extraction.askEveryTime")}</option>
            <option value="extractHere">{i18n.t("preferences.extraction.extractHere")}</option>
            <option value="extractToFolder">{i18n.t("preferences.extraction.extractToFolder")}</option>
          </select>
          <p className="setting-description"><span className="quick-action-badge">{i18n.t("preferences.quickActions.badge")}</span> <span>{i18n.t("preferences.extraction.quickDescription")}</span></p>
        </div>
      </div>
      <div className="setting-grid">
        <div className="setting-row">
          <label htmlFor="pref-extract-path-mode">{i18n.t("extract.pathMode")}</label>
          <div className="setting-control">
            <select id="pref-extract-path-mode" value={draft.defaultExtractPathMode} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultExtractPathMode: event.currentTarget.value as AppPreferences["defaultExtractPathMode"] } })}>
              <option value="full">{i18n.t("extract.pathMode.full")}</option>
              <option value="current">{i18n.t("extract.pathMode.current")}</option>
              <option value="none">{i18n.t("extract.pathMode.none")}</option>
            </select>
          </div>
        </div>
        <div className="setting-row">
          <label htmlFor="pref-extract-overwrite">{i18n.t("extract.overwritePolicy")}</label>
          <div className="setting-control">
            <select id="pref-extract-overwrite" value={draft.defaultExtractOverwrite} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultExtractOverwrite: event.currentTarget.value as AppPreferences["defaultExtractOverwrite"] } })}>
              <option value="refuse">{i18n.t("extract.overwrite.refuse")}</option>
              <option value="ask">{i18n.t("extract.overwrite.ask")}</option>
              <option value="rename">{i18n.t("extract.overwrite.rename")}</option>
              <option value="replace">{i18n.t("extract.overwrite.replace")}</option>
            </select>
          </div>
        </div>
        <div className="setting-row">
          <label htmlFor="pref-extract-strip-components">{i18n.t("extract.stripComponents")}</label>
          <div className="setting-control">
            <input id="pref-extract-strip-components" type="number" min="0" value={draft.defaultExtractStripComponents} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultExtractStripComponents: Math.max(0, Number.parseInt(event.currentTarget.value, 10) || 0) } })} />
          </div>
        </div>
      </div>
      <PreferenceCheckbox id="pref-extract-deduplicate-root" label={i18n.t("extract.deduplicateRoot")} checked={draft.defaultExtractDeduplicateRoot} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { defaultExtractDeduplicateRoot: checked } })} />
    </section>
  );
}

function InterfacePage({ draft, active }: Readonly<{ draft: AppPreferences; active: boolean }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <section className="options-page property-section" data-pref-page="interface" hidden={!active}>
      <h3>{i18n.t("preferences.interface.title")}</h3>
      <p className="section-description">{i18n.t("preferences.interface.description")}</p>
      <div className="toggle-grid settings-toggle-grid">
        <PreferenceCheckbox id="pref-show-parent" label={i18n.t("preferences.interface.showParent")} checked={draft.showParentFolderItem} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { showParentFolderItem: checked } })} />
        <PreferenceCheckbox id="pref-real-file-icons" label={i18n.t("preferences.interface.realFileIcons")} checked={draft.showRealFileIcons} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { showRealFileIcons: checked } })} />
        <PreferenceCheckbox id="pref-full-row-select" label={i18n.t("preferences.interface.fullRowSelect")} checked={draft.fullRowSelect} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { fullRowSelect: checked } })} />
        <PreferenceCheckbox id="pref-show-grid" label={i18n.t("preferences.interface.showGrid")} checked={draft.showGridLines} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { showGridLines: checked } })} />
        <PreferenceCheckbox id="pref-single-click" label={i18n.t("preferences.interface.singleClick")} checked={draft.singleClickOpen} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { singleClickOpen: checked } })} />
        <PreferenceCheckbox id="pref-alternative-selection" label={i18n.t("preferences.interface.alternativeSelection")} checked={draft.alternativeSelectionMode} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { alternativeSelectionMode: checked } })} />
        <PreferenceCheckbox id="pref-toolbar-visible" label={i18n.t("preferences.interface.toolbarVisible")} checked={draft.toolbarVisible} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { toolbarVisible: checked } })} />
        <PreferenceCheckbox id="pref-large-toolbar" label={i18n.t("preferences.interface.largeToolbar")} checked={draft.largeToolbarButtons} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { largeToolbarButtons: checked } })} />
        <PreferenceCheckbox id="pref-toolbar-labels" label={i18n.t("preferences.interface.toolbarLabels")} checked={draft.showToolbarLabels} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { showToolbarLabels: checked } })} />
        <PreferenceCheckbox id="pref-flat-view" label={i18n.t("preferences.interface.flatView")} checked={draft.flatViewDefault} onChange={(checked) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { flatViewDefault: checked } })} />
      </div>
      <div className="setting-row">
        <label htmlFor="pref-language">{i18n.t("preferences.language.title")}</label>
        <div className="setting-control">
          <select id="pref-language" value={draft.locale} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { locale: event.currentTarget.value as AppPreferences["locale"] } })}>
            <option value="system">{i18n.t("preferences.language.systemDefault")}</option>
            <option value="en">{i18n.t("preferences.language.english")}</option>
            <option value="zh-CN">{i18n.t("preferences.language.chineseSimplified")}</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function SafetyPage({
  draft,
  active,
  selectedCreateFormat,
}: Readonly<{
  draft: AppPreferences;
  active: boolean;
  selectedCreateFormat: CreateFormat;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const defaults = createDefaultsForFormat(draft, selectedCreateFormat);
  const supportsPassword = createFormatSupportsPassword(selectedCreateFormat);

  return (
    <section className="options-page property-section" data-pref-page="safety" hidden={!active}>
      <h3>{i18n.t("preferences.safety.title")}</h3>
      <p className="section-description">{i18n.t("preferences.safety.description")}</p>
      <div className="toggle-grid settings-toggle-grid">
        <PreferenceCheckbox id="pref-create-clean-source" label={i18n.t("create.cleanSource")} checked={defaults.cleanSource} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { cleanSource: checked })} />
        <PreferenceCheckbox id="pref-create-preserve-metadata" label={i18n.t("create.preserveMetadata")} checked={defaults.preserveMetadata} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { preserveMetadata: checked })} />
        <PreferenceCheckbox id="pref-create-replace-existing" label={i18n.t("create.replaceExisting")} checked={defaults.replaceExisting} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { replaceExisting: checked })} />
        <PreferenceCheckbox id="pref-create-prompt-password" label={i18n.t("create.promptForPassword")} checked={supportsPassword && defaults.promptForPassword} disabled={!supportsPassword} onChange={(checked) => patchCreateDefaults(actions, selectedCreateFormat, { promptForPassword: checked })} />
      </div>
      <p className="setting-description"><span className="quick-action-badge">{i18n.t("preferences.quickActions.badge")}</span> <span>{i18n.t("preferences.safety.quickDescription")}</span></p>
      <div className="setting-row">
        <label htmlFor="pref-preview-cleanup">{i18n.t("preferences.archiveDefaults.previewCleanup")}</label>
        <div className="setting-control">
          <select id="pref-preview-cleanup" value={draft.previewCleanupPolicy} onChange={(event) => actions.handleDialogIntent({ type: "preferencesPatch", patch: { previewCleanupPolicy: event.currentTarget.value as AppPreferences["previewCleanupPolicy"] } })}>
            <option value="beforeNextPreview">{i18n.t("preferences.previewCleanup.beforeNextPreview")}</option>
            <option value="whenAppCloses">{i18n.t("preferences.previewCleanup.whenAppCloses")}</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function PreferenceCheckbox({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}>) {
  return (
    <label className="toggle-line">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} /> <span>{label}</span>
    </label>
  );
}

function FormatSelect({
  id,
  value,
  onChange,
}: Readonly<{
  id: string;
  value: CreateFormat;
  onChange(format: CreateFormat): void;
}>) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.currentTarget.value as CreateFormat)}>
      <option value="zip">ZIP</option>
      <option value="tarZst">TZST</option>
      <option value="tzap">TZAP</option>
      <option value="sevenZ">7Z</option>
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
