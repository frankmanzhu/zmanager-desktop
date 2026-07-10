import { describe, expect, it } from "vitest";

import { contextMenuItems } from "./contextMenuHelpers";

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
  append: (...children: TestElement[]) => void;
  childElements: TestElement[];
  disabled: boolean;
  parentTestElement: TestElement | null;
};

type TestElementOptions = {
  disabled?: boolean;
  items?: TestElement[];
  visible?: boolean;
};

function testElement(tagName = "div", options: TestElementOptions = {}): TestElement {
  const children: TestElement[] = [];
  const element = {
    childElements: children,
    disabled: Boolean(options.disabled),
    hidden: false,
    parentTestElement: null as TestElement | null,
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
    append(...nextChildren: TestElement[]) {
      for (const child of nextChildren) {
        child.parentTestElement = testNode;
        children.push(child);
      }
    },
    querySelectorAll(selector: string) {
      if (!selector.includes("button")) {
        return [];
      }
      return options.items?.filter((item) => !item.disabled) ?? [];
    },
  };
  const testNode = element as unknown as TestElement;

  return testNode;
}
