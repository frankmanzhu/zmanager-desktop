import { describe, expect, it } from "vitest";

import { DEFAULT_APP_PREFERENCES } from "../app/preferences";
import { createTranslator, createTranslatorFromCatalog } from "../app/i18n/translator";
import { zhCnMessages } from "../app/i18n/messages.zh-CN";
import {
  collectPreferencesFromDialog,
  renderPreferencesDialog,
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

  it("renders translated dialog-owned text from an injected experimental catalog", () => {
    const elements = createPreferenceElements();

    renderPreferencesDialog(
      elements,
      DEFAULT_APP_PREFERENCES,
      createTranslatorFromCatalog("zh-CN", zhCnMessages),
    );

    expect(elements.statusElement.textContent).toBe("偏好设置仅存储在本机，绝不会包含密码。");
    expect(elements.localeSelect.value).toBe("system");
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
    createFormatSelect: select(DEFAULT_APP_PREFERENCES.defaultArchiveFormat),
    createCompressionLevelSelect: select(""),
    createVolumeInput: input(""),
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
  return { value, disabled: false } as HTMLInputElement;
}

function checkbox(checked: boolean): HTMLInputElement {
  return { checked, disabled: false } as HTMLInputElement;
}

function button(): HTMLButtonElement {
  return { disabled: false } as HTMLButtonElement;
}

function paragraph(): HTMLParagraphElement {
  return { textContent: "", className: "" } as HTMLParagraphElement;
}
