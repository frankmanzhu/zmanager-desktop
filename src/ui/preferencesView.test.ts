import { describe, expect, it } from "vitest";

import { DEFAULT_APP_PREFERENCES } from "../app/preferences";
import { createTranslator } from "../app/i18n/translator";
import {
  collectPreferencesFromDialog,
  fullCustomOutputPath,
  middleTruncatePath,
  renderPreferencesDialog,
  restoreFullCustomOutputPathForEdit,
  syncCustomOutputPathFromInput,
  type PreferencesViewElements,
} from "./preferencesView";

describe("preferences view", () => {
  it("renders and collects the stored locale preference", () => {
    const elements = createPreferenceElements();

    renderPreferencesDialog(elements, {
      ...DEFAULT_APP_PREFERENCES,
      locale: "en",
    }, createTranslator("en"));

    expect(elements.localeSelect.value).toBe("en");
    expect(elements.statusElement.textContent).toBe("Preferences are stored locally and never include passwords.");

    elements.localeSelect.value = "system";

    expect(collectPreferencesFromDialog(elements, DEFAULT_APP_PREFERENCES).locale).toBe("system");
  });

  it("renders translated dialog-owned text from the zh-CN catalog", () => {
    const elements = createPreferenceElements();

    renderPreferencesDialog(
      elements,
      DEFAULT_APP_PREFERENCES,
      createTranslator("zh-CN"),
    );

    expect(elements.statusElement.textContent).toBe("偏好设置仅存储在本机，绝不会包含密码。");
    expect(elements.localeSelect.value).toBe("system");
  });

  it("renders and collects TZAP recovery defaults", () => {
    const elements = createPreferenceElements();

    renderPreferencesDialog(elements, {
      ...DEFAULT_APP_PREFERENCES,
      defaultArchiveFormat: "tzap",
      createFormatDefaults: {
        ...DEFAULT_APP_PREFERENCES.createFormatDefaults,
        tzap: {
          ...DEFAULT_APP_PREFERENCES.createFormatDefaults.tzap,
          tzapRecoveryPercentage: 12,
        },
      },
    }, createTranslator("en"));

    expect(elements.createTzapRecoveryField.hidden).toBe(false);
    expect(elements.createTzapRecoveryInput.disabled).toBe(false);
    expect(elements.createTzapRecoveryInput.value).toBe("12");

    elements.createTzapRecoveryInput.value = "18";

    expect(
      collectPreferencesFromDialog(elements, DEFAULT_APP_PREFERENCES)
        .createFormatDefaults.tzap.tzapRecoveryPercentage,
    ).toBe(18);
  });

  it("keeps a full custom output path while showing a middle-truncated unfocused value", () => {
    const elements = createPreferenceElements();
    const longPath = "C:/Users/frankzhu/Documents/Projects/ZManager/Very/Long/Output/Folder";

    renderPreferencesDialog(elements, {
      ...DEFAULT_APP_PREFERENCES,
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: longPath,
    }, createTranslator("en"));

    expect(elements.customOutputInput.value).toBe(middleTruncatePath(longPath));
    expect(fullCustomOutputPath(elements.customOutputInput)).toBe(longPath);

    restoreFullCustomOutputPathForEdit(elements.customOutputInput);
    expect(elements.customOutputInput.value).toBe(longPath);

    elements.customOutputInput.value = `${longPath}/Edited`;
    syncCustomOutputPathFromInput(elements.customOutputInput);

    expect(collectPreferencesFromDialog(elements, DEFAULT_APP_PREFERENCES).customOutputFolderPath)
      .toBe(`${longPath}/Edited`);
  });
});

function createPreferenceElements(): PreferencesViewElements {
  return {
    localeSelect: select("system"),
    defaultFormatSelect: select(DEFAULT_APP_PREFERENCES.defaultArchiveFormat),
    defaultExtractionSelect: select(DEFAULT_APP_PREFERENCES.defaultExtractionBehavior),
    outputLocationSelect: select(DEFAULT_APP_PREFERENCES.defaultOutputLocation),
    previewCleanupSelect: select(DEFAULT_APP_PREFERENCES.previewCleanupPolicy),
    customOutputInput: input(DEFAULT_APP_PREFERENCES.customOutputFolderPath),
    chooseOutputButton: button(),
    customOutputValidation: element(),
    createFormatSelect: select(DEFAULT_APP_PREFERENCES.defaultArchiveFormat),
    createCompressionLevelSelect: select(""),
    createVolumeInput: input(""),
    createTzapRecoveryField: element(),
    createTzapRecoveryInput: input(""),
    createCleanSourceCheckbox: checkbox(true),
    createPreserveMetadataCheckbox: checkbox(true),
    createReplaceExistingCheckbox: checkbox(false),
    createPromptPasswordCheckbox: checkbox(false),
    showParentFolderItemCheckbox: checkbox(DEFAULT_APP_PREFERENCES.showParentFolderItem),
    showRealFileIconsCheckbox: checkbox(DEFAULT_APP_PREFERENCES.showRealFileIcons),
    showGridLinesCheckbox: checkbox(DEFAULT_APP_PREFERENCES.showGridLines),
    fullRowSelectCheckbox: checkbox(DEFAULT_APP_PREFERENCES.fullRowSelect),
    singleClickOpenCheckbox: checkbox(DEFAULT_APP_PREFERENCES.singleClickOpen),
    alternativeSelectionModeCheckbox: checkbox(DEFAULT_APP_PREFERENCES.alternativeSelectionMode),
    toolbarVisibleCheckbox: checkbox(DEFAULT_APP_PREFERENCES.toolbarVisible),
    largeToolbarButtonsCheckbox: checkbox(DEFAULT_APP_PREFERENCES.largeToolbarButtons),
    showToolbarLabelsCheckbox: checkbox(DEFAULT_APP_PREFERENCES.showToolbarLabels),
    flatViewDefaultCheckbox: checkbox(DEFAULT_APP_PREFERENCES.flatViewDefault),
    statusElement: paragraph(),
  };
}

function select(value: string): HTMLSelectElement {
  return { value, disabled: false } as HTMLSelectElement;
}

function input(value: string): HTMLInputElement {
  return {
    value,
    disabled: false,
    dataset: {},
    title: "",
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
  } as unknown as HTMLInputElement;
}

function checkbox(checked: boolean): HTMLInputElement {
  return { checked, disabled: false } as HTMLInputElement;
}

function button(): HTMLButtonElement {
  return { disabled: false } as HTMLButtonElement;
}

function element(): HTMLElement {
  return { hidden: false } as HTMLElement;
}

function paragraph(): HTMLParagraphElement {
  return { textContent: "", className: "" } as HTMLParagraphElement;
}
