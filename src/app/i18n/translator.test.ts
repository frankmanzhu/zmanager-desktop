import { describe, expect, it } from "vitest";

import {
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
});
