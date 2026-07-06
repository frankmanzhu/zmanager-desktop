import {
  createFormatSupportsPassword,
  TZAP_RECOVERY_PERCENTAGE_DEFAULT,
  TZAP_RECOVERY_PERCENTAGE_MAX,
  TZAP_RECOVERY_PERCENTAGE_MIN,
  type CreateArchiveFormat,
} from "../app/createFlow";
import {
  createDefaultsForFormat,
  preferencesWithPatch,
  type AppPreferences,
  type DefaultExtractionBehavior,
  type DefaultOutputLocation,
  type PreviewCleanupPolicy,
} from "../app/preferences";
import type { LocalePreference } from "../app/i18n/locale";
import type { Translator } from "../app/i18n/translator";

export type PreferencesViewElements = {
  localeSelect: HTMLSelectElement;
  defaultFormatSelect: HTMLSelectElement;
  defaultExtractionSelect: HTMLSelectElement;
  outputLocationSelect: HTMLSelectElement;
  previewCleanupSelect: HTMLSelectElement;
  customOutputInput: HTMLInputElement;
  chooseOutputButton: HTMLButtonElement;
  createFormatSelect: HTMLSelectElement;
  createCompressionLevelSelect: HTMLSelectElement;
  createVolumeInput: HTMLInputElement;
  createTzapRecoveryField: HTMLElement;
  createTzapRecoveryInput: HTMLInputElement;
  createCleanSourceCheckbox: HTMLInputElement;
  createPreserveMetadataCheckbox: HTMLInputElement;
  createReplaceExistingCheckbox: HTMLInputElement;
  createPromptPasswordCheckbox: HTMLInputElement;
  showParentFolderItemCheckbox: HTMLInputElement;
  showRealFileIconsCheckbox: HTMLInputElement;
  showGridLinesCheckbox: HTMLInputElement;
  fullRowSelectCheckbox: HTMLInputElement;
  singleClickOpenCheckbox: HTMLInputElement;
  alternativeSelectionModeCheckbox: HTMLInputElement;
  toolbarVisibleCheckbox: HTMLInputElement;
  largeToolbarButtonsCheckbox: HTMLInputElement;
  showToolbarLabelsCheckbox: HTMLInputElement;
  flatViewDefaultCheckbox: HTMLInputElement;
  statusElement: HTMLParagraphElement;
};

export function syncPreferenceOutputState(elements: PreferencesViewElements): void {
  const customOutputEnabled = elements.outputLocationSelect.value === "customFolder";
  elements.customOutputInput.disabled = !customOutputEnabled;
  elements.chooseOutputButton.disabled = !customOutputEnabled;
}

export function renderPreferencesDialog(
  elements: PreferencesViewElements,
  preferences: AppPreferences,
  i18n: Translator,
): void {
  elements.localeSelect.value = preferences.locale;
  elements.defaultFormatSelect.value = preferences.defaultArchiveFormat;
  elements.defaultExtractionSelect.value = preferences.defaultExtractionBehavior;
  elements.outputLocationSelect.value = preferences.defaultOutputLocation;
  elements.previewCleanupSelect.value = preferences.previewCleanupPolicy;
  elements.customOutputInput.value = preferences.customOutputFolderPath;
  elements.createFormatSelect.value = preferences.defaultArchiveFormat;
  renderCreateDefaultsForSelectedFormat(elements, preferences);
  elements.showParentFolderItemCheckbox.checked = preferences.showParentFolderItem;
  elements.showRealFileIconsCheckbox.checked = preferences.showRealFileIcons;
  elements.showGridLinesCheckbox.checked = preferences.showGridLines;
  elements.fullRowSelectCheckbox.checked = preferences.fullRowSelect;
  elements.singleClickOpenCheckbox.checked = preferences.singleClickOpen;
  elements.alternativeSelectionModeCheckbox.checked = preferences.alternativeSelectionMode;
  elements.toolbarVisibleCheckbox.checked = preferences.toolbarVisible;
  elements.largeToolbarButtonsCheckbox.checked = preferences.largeToolbarButtons;
  elements.showToolbarLabelsCheckbox.checked = preferences.showToolbarLabels;
  elements.flatViewDefaultCheckbox.checked = preferences.flatViewDefault;
  elements.statusElement.textContent = i18n.t("preferences.status.localOnly");
  elements.statusElement.className = "status status-idle";
  syncPreferenceOutputState(elements);
}

export function renderCreateDefaultsForSelectedFormat(
  elements: PreferencesViewElements,
  preferences: AppPreferences,
): void {
  const format = elements.createFormatSelect.value as CreateArchiveFormat;
  const createDefaults = createDefaultsForFormat(preferences, format);
  const supportsPassword = createFormatSupportsPassword(format);
  elements.createCompressionLevelSelect.value = createDefaults.compressionLevel === null
    ? ""
    : String(createDefaults.compressionLevel);
  elements.createVolumeInput.value = createDefaults.volumeSize === null
    ? ""
    : String(createDefaults.volumeSize);
  const supportsTzapRecovery = format === "tzap";
  elements.createTzapRecoveryField.hidden = !supportsTzapRecovery;
  elements.createTzapRecoveryInput.disabled = !supportsTzapRecovery;
  elements.createTzapRecoveryInput.value = supportsTzapRecovery
    ? String(createDefaults.tzapRecoveryPercentage ?? TZAP_RECOVERY_PERCENTAGE_DEFAULT)
    : "";
  elements.createCleanSourceCheckbox.checked = createDefaults.cleanSource;
  elements.createPreserveMetadataCheckbox.checked = createDefaults.preserveMetadata;
  elements.createReplaceExistingCheckbox.checked = createDefaults.replaceExisting;
  elements.createPromptPasswordCheckbox.checked = supportsPassword && createDefaults.promptForPassword;
  elements.createPromptPasswordCheckbox.disabled = !supportsPassword;
}

export function collectPreferencesFromDialog(
  elements: PreferencesViewElements,
  preferences: AppPreferences,
): AppPreferences {
  const selectedFormat = elements.createFormatSelect.value as CreateArchiveFormat;
  const compressionLevel = parseOptionalNonNegativeInteger(elements.createCompressionLevelSelect.value);
  const volumeSize = parseOptionalPositiveInteger(elements.createVolumeInput.value);
  const tzapRecoveryPercentage = selectedFormat === "tzap"
    ? parseTzapRecoveryPercentage(elements.createTzapRecoveryInput.value)
    : null;
  const createFormatDefaults = preferences.createFormatDefaults;
  const nextCreateFormatDefaults = {
    ...createFormatDefaults,
    [selectedFormat]: {
      cleanSource: elements.createCleanSourceCheckbox.checked,
      compressionLevel,
      volumeSize,
      tzapRecoveryPercentage,
      preserveMetadata: elements.createPreserveMetadataCheckbox.checked,
      replaceExisting: elements.createReplaceExistingCheckbox.checked,
      promptForPassword:
        createFormatSupportsPassword(selectedFormat) && elements.createPromptPasswordCheckbox.checked,
    },
  };

  return preferencesWithPatch(preferences, {
    locale: elements.localeSelect.value as LocalePreference,
    defaultArchiveFormat: elements.defaultFormatSelect.value as CreateArchiveFormat,
    defaultCleanSourceEnabled:
      nextCreateFormatDefaults[elements.defaultFormatSelect.value as CreateArchiveFormat].cleanSource,
    createFormatDefaults: nextCreateFormatDefaults,
    defaultOutputLocation: elements.outputLocationSelect.value as DefaultOutputLocation,
    customOutputFolderPath: elements.customOutputInput.value,
    defaultExtractionBehavior: elements.defaultExtractionSelect.value as DefaultExtractionBehavior,
    previewCleanupPolicy: elements.previewCleanupSelect.value as PreviewCleanupPolicy,
    showParentFolderItem: elements.showParentFolderItemCheckbox.checked,
    showRealFileIcons: elements.showRealFileIconsCheckbox.checked,
    showGridLines: elements.showGridLinesCheckbox.checked,
    fullRowSelect: elements.fullRowSelectCheckbox.checked,
    singleClickOpen: elements.singleClickOpenCheckbox.checked,
    alternativeSelectionMode: elements.alternativeSelectionModeCheckbox.checked,
    toolbarVisible: elements.toolbarVisibleCheckbox.checked,
    largeToolbarButtons: elements.largeToolbarButtonsCheckbox.checked,
    showToolbarLabels: elements.showToolbarLabelsCheckbox.checked,
    flatViewDefault: elements.flatViewDefaultCheckbox.checked,
  });
}

function parseOptionalNonNegativeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

function parseOptionalPositiveInteger(value: string): number | null {
  const parsed = parseOptionalNonNegativeInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseTzapRecoveryPercentage(value: string): number {
  const parsed = parseOptionalNonNegativeInteger(value);
  if (parsed === null) {
    return TZAP_RECOVERY_PERCENTAGE_DEFAULT;
  }
  return Math.min(TZAP_RECOVERY_PERCENTAGE_MAX, Math.max(TZAP_RECOVERY_PERCENTAGE_MIN, parsed));
}
