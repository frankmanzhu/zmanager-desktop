import { describe, expect, it } from "vitest";

import {
  contextMenuItems,
} from "./contextMenuHelpers";

describe("context menu helpers", () => {
  it("returns visible enabled menu items and keeps the active item addressable", () => {
    const visible = testElement("button");
    const hidden = testElement("button", { visible: false });
    const activeHidden = testElement("button", { visible: false });
    const disabled = testElement("button", { disabled: true });
    const menu = testElement("div", { items: [visible, hidden, activeHidden, disabled] });

    expect(contextMenuItems(menu, activeHidden)).toEqual([visible, activeHidden]);
  });
});

type TestElement = HTMLElement & {
  disabled: boolean;
};

type TestElementOptions = {
  disabled?: boolean;
  items?: TestElement[];
  visible?: boolean;
};

function testElement(tagName = "div", options: TestElementOptions = {}): TestElement {
  const element = {
    disabled: Boolean(options.disabled),
    hidden: false,
    tagName: tagName.toUpperCase(),
    get offsetHeight() {
      return options.visible === false ? 0 : 1;
    },
    get offsetWidth() {
      return options.visible === false ? 0 : 1;
    },
    getClientRects() {
      return options.visible === false ? [] : [{ height: 1, width: 1 }];
    },
    querySelectorAll(selector: string) {
      if (!selector.includes("button")) {
        return [];
      }
      return options.items?.filter((item) => !item.disabled) ?? [];
    },
  };
  return element as unknown as TestElement;
}
