import { describe, expect, it } from "vitest";

import {
  applyTranslations,
  createTranslator,
  interpolateMessage,
} from "./translator";

describe("translator", () => {
  it("looks up English messages", () => {
    const i18n = createTranslator("en");

    expect(i18n.t("preferences.title")).toBe("Options");
    expect(i18n.t("preferences.language.english")).toBe("English");
  });

  it("falls back to English when a locale override omits a key", () => {
    const i18n = createTranslator("en", {
      en: {
        "common.save": "Store",
      },
    });

    expect(i18n.t("common.save")).toBe("Store");
    expect(i18n.t("common.cancel")).toBe("Cancel");
  });

  it("interpolates simple values without treating output as HTML", () => {
    expect(interpolateMessage("Processed {count} from {name}", {
      count: 3,
      name: "<archive>",
    })).toBe("Processed 3 from <archive>");
  });

  it("preserves icon button markup while translating explicit text and attributes", () => {
    const textElement = fakeElement({ i18nText: "preferences.title" }, { childCount: 1 });
    const iconButton = fakeElement(
      {},
      {
        attributes: {
          "data-i18n-aria-label": "common.save",
          "data-i18n-title": "common.save",
        },
        childCount: 1,
      },
    );
    const input = fakeElement({}, {
      attributes: {
        "data-i18n-placeholder": "preferences.language.systemDefault",
      },
    });
    const root = fakeRoot({
      "[data-i18n-text]": [textElement],
      "[data-i18n-aria-label]": [iconButton],
      "[data-i18n-title]": [iconButton],
      "[data-i18n-placeholder]": [input],
    });

    applyTranslations(root, createTranslator("en"));

    expect(iconButton.childCount).toBe(1);
    expect(iconButton.attributes["aria-label"]).toBe("Save");
    expect(iconButton.attributes.title).toBe("Save");
    expect(textElement.textContent).toBe("Options");
    expect(textElement.childCount).toBe(0);
    expect(input.attributes.placeholder).toBe("System default");
  });
});

type FakeElement = HTMLElement & {
  attributes: Record<string, string>;
  childCount: number;
};

function fakeRoot(results: Record<string, FakeElement[]>): ParentNode {
  return {
    querySelectorAll: (selector: string) => results[selector] ?? [],
  } as unknown as ParentNode;
}

function fakeElement(
  dataset: Record<string, string>,
  options: {
    attributes?: Record<string, string>;
    childCount?: number;
  } = {},
): FakeElement {
  let textContent: string | null = null;
  const element = {
    dataset,
    attributes: { ...options.attributes },
    childCount: options.childCount ?? 0,
    get textContent() {
      return textContent;
    },
    set textContent(value: string | null) {
      textContent = value;
      element.childCount = 0;
    },
    getAttribute(name: string) {
      return element.attributes[name] ?? null;
    },
    setAttribute(name: string, value: string) {
      element.attributes[name] = value;
    },
  };

  return element as unknown as FakeElement;
}
