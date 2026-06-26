import type { CreateArchiveFormat } from "../app/createFlow";
import {
  preferencesWithPatch,
  type AppPreferences,
  type DefaultExtractionBehavior,
  type DefaultOutputLocation,
  type PreviewCleanupPolicy,
} from "../app/preferences";

export type PreferencesViewElements = {
  defaultFormatSelect: HTMLSelectElement;
  defaultExtractionSelect: HTMLSelectElement;
  outputLocationSelect: HTMLSelectElement;
  previewCleanupSelect: HTMLSelectElement;
  customOutputInput: HTMLInputElement;
  chooseOutputButton: HTMLButtonElement;
  cleanSourceCheckbox: HTMLInputElement;
  quickOpenExtractCheckbox: HTMLInputElement;
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
): void {
  elements.defaultFormatSelect.value = preferences.defaultArchiveFormat;
  elements.defaultExtractionSelect.value = preferences.defaultExtractionBehavior;
  elements.outputLocationSelect.value = preferences.defaultOutputLocation;
  elements.previewCleanupSelect.value = preferences.previewCleanupPolicy;
  elements.customOutputInput.value = preferences.customOutputFolderPath;
  elements.cleanSourceCheckbox.checked = preferences.defaultCleanSourceEnabled;
  elements.quickOpenExtractCheckbox.checked = preferences.quickOpenExtractionEnabled;
  elements.statusElement.textContent = "Preferences are stored locally and never include passwords.";
  elements.statusElement.className = "status status-idle";
  syncPreferenceOutputState(elements);
}

export function collectPreferencesFromDialog(
  elements: PreferencesViewElements,
  preferences: AppPreferences,
): AppPreferences {
  return preferencesWithPatch(preferences, {
    defaultArchiveFormat: elements.defaultFormatSelect.value as CreateArchiveFormat,
    defaultCleanSourceEnabled: elements.cleanSourceCheckbox.checked,
    defaultOutputLocation: elements.outputLocationSelect.value as DefaultOutputLocation,
    customOutputFolderPath: elements.customOutputInput.value,
    defaultExtractionBehavior: elements.defaultExtractionSelect.value as DefaultExtractionBehavior,
    quickOpenExtractionEnabled: elements.quickOpenExtractCheckbox.checked,
    previewCleanupPolicy: elements.previewCleanupSelect.value as PreviewCleanupPolicy,
  });
}
