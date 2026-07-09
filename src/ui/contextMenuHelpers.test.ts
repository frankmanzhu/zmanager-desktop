import { describe, expect, it } from "vitest";

import {
  contextMenuItems,
  decodeContextMenuAction,
  type ContextMenuActionPayload,
} from "./contextMenuHelpers";

describe("context menu helpers", () => {
  it("decodes context menu actions and dataset payloads from nested targets", () => {
    const button = testElement("button", {
      dataset: {
        archivePath: "C:/archives/demo.zip",
        columnId: "name",
        compressMenuPath: "src/app",
        contextAction: "include-compress-path",
        entryPath: "folder/file.txt",
        folderPath: "folder",
        sourcePath: "C:/src/app",
      },
    });
    const label = testElement("span");
    button.append(label);

    expect(decodeContextMenuAction(label)).toEqual<ContextMenuActionPayload>({
      action: "include-compress-path",
      archivePath: "C:/archives/demo.zip",
      columnId: "name",
      compressMenuPath: "src/app",
      entryPath: "folder/file.txt",
      folderPath: "folder",
      sourcePath: "C:/src/app",
    });
    expect(decodeContextMenuAction(testElement("span"))).toBeNull();
  });

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
  dataset?: Record<string, string>;
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
    dataset: { ...(options.dataset ?? {}) },
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
    closest(selector: string) {
      if (selector === "[data-context-action]") {
        let current: TestElement | null = testNode;
        while (current) {
          if (current.dataset.contextAction) {
            return current;
          }
          current = current.parentTestElement;
        }
      }
      return null;
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
