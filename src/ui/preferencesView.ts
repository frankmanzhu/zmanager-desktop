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
  showParentFolderItemCheckbox: HTMLInputElement;
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
): void {
  elements.defaultFormatSelect.value = preferences.defaultArchiveFormat;
  elements.defaultExtractionSelect.value = preferences.defaultExtractionBehavior;
  elements.outputLocationSelect.value = preferences.defaultOutputLocation;
  elements.previewCleanupSelect.value = preferences.previewCleanupPolicy;
  elements.customOutputInput.value = preferences.customOutputFolderPath;
  elements.cleanSourceCheckbox.checked = preferences.defaultCleanSourceEnabled;
  elements.showParentFolderItemCheckbox.checked = preferences.showParentFolderItem;
  elements.showGridLinesCheckbox.checked = preferences.showGridLines;
  elements.fullRowSelectCheckbox.checked = preferences.fullRowSelect;
  elements.singleClickOpenCheckbox.checked = preferences.singleClickOpen;
  elements.alternativeSelectionModeCheckbox.checked = preferences.alternativeSelectionMode;
  elements.toolbarVisibleCheckbox.checked = preferences.toolbarVisible;
  elements.largeToolbarButtonsCheckbox.checked = preferences.largeToolbarButtons;
  elements.showToolbarLabelsCheckbox.checked = preferences.showToolbarLabels;
  elements.flatViewDefaultCheckbox.checked = preferences.flatViewDefault;
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
    previewCleanupPolicy: elements.previewCleanupSelect.value as PreviewCleanupPolicy,
    showParentFolderItem: elements.showParentFolderItemCheckbox.checked,
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
