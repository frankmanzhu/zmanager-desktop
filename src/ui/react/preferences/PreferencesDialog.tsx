import { useEffect, useState } from "react";

import {
  createFormatSupportsPassword,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
} from "../../../app/createFlow";
import { createDefaultsForFormat, type AppPreferences, type FormatCreateDefaults } from "../../../app/preferences";
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
          <button
            id="preferences-dialog-close"
            className="icon-button"
            type="button"
            aria-label={i18n.t("preferences.close.aria")}
            onClick={() => actions.handleDialogIntent({ type: "preferencesCancel" })}
          >
            {i18n.t("common.close")}
          </button>
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
          <button id="preferences-save" type="button" disabled={customOutputMissing} onClick={() => actions.handleDialogIntent({ type: "preferencesSave" })}>{i18n.t("common.save")}</button>
          <button id="preferences-cancel" type="button" onClick={() => actions.handleDialogIntent({ type: "preferencesCancel" })}>{i18n.t("common.cancel")}</button>
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
            <button id="pref-choose-output" type="button" disabled={!customOutputSelected} onClick={() => actions.handleDialogIntent({ type: "preferencesChooseOutput" })}>
              {i18n.t("common.browse")}
            </button>
          </div>
          <p id="pref-custom-output-help" className="setting-description">{i18n.t("preferences.folders.customHelp")}</p>
          <p id="pref-custom-output-validation" className={customOutputMissing ? "setting-validation status-error" : "setting-validation"} aria-live="polite" hidden={!customOutputMissing}>
            {customOutputMissing ? i18n.t("preferences.validation.customOutputRequired") : ""}
          </p>
        </div>
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
        <div className="setting-row">
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
        <div className="setting-row">
          <label htmlFor="pref-create-volume">{i18n.t("preferences.archiveDefaults.splitVolumes")}</label>
          <div className="setting-control">
            <input id="pref-create-volume" type="number" min="0" placeholder={i18n.t("preferences.archiveDefaults.noSplit")} value={defaults.volumeSize ?? ""} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { volumeSize: optionalPositiveNumber(event.currentTarget.value) })} />
          </div>
        </div>
        <div id="pref-create-tzap-recovery-field" className="setting-row" hidden={!supportsTzapRecovery}>
          <label htmlFor="pref-create-tzap-recovery">{i18n.t("create.tzapRecovery")}</label>
          <div className="setting-control">
            <input id="pref-create-tzap-recovery" type="number" min={TZAP_RECOVERY_PERCENTAGE_MIN} max={TZAP_RECOVERY_PERCENTAGE_MAX} disabled={!supportsTzapRecovery} value={supportsTzapRecovery ? defaults.tzapRecoveryPercentage ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT : ""} onChange={(event) => patchCreateDefaults(actions, selectedCreateFormat, { tzapRecoveryPercentage: optionalNumber(event.currentTarget.value) })} />
          </div>
        </div>
      </div>
    </section>
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
