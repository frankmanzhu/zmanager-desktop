import { describe, expect, it } from "vitest";

import {
  createModalController,
  dialogButtonFromSelector,
  getDialogSurface,
  getFocusableElements,
  isVisibleElement,
} from "./modalController";

describe("modal controller", () => {
  it("opens a dialog with selected focus and restores the prior visible focus on close", () => {
    const previous = testElement("button");
    const fallback = testElement("button");
    const target = testElement("input");
    const surface = testElement("section", { role: "dialog", focusable: [target] });
    const dialog = testElement("div", { children: [surface], hidden: true });
    let activeElement: Element | null = previous;
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => fallback,
      activeElement: () => activeElement,
    });

    controller.open(dialog, "input");
    activeElement = target;
    controller.close(dialog);

    expect(dialog.hidden).toBe(true);
    expect(target.focusCount).toBe(1);
    expect(target.scrollCount).toBe(1);
    expect(previous.focusCount).toBe(1);
    expect(fallback.focusCount).toBe(0);
  });

  it("ignores active elements inside ignored roots and restores fallback focus", () => {
    const menuItem = testElement("button");
    const menu = testElement("div", { children: [menuItem] });
    const fallback = testElement("button");
    const dialog = testElement("div", {
      children: [testElement("section", { role: "dialog" })],
      hidden: true,
    });
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => fallback,
      ignoredReturnFocusRoots: () => [menu],
      activeElement: () => menuItem,
    });

    controller.open(dialog);
    controller.close(dialog);

    expect(fallback.focusCount).toBe(1);
  });

  it("traps Tab focus inside the surface and focuses the surface when there are no focusable children", () => {
    const first = testElement("button");
    const last = testElement("button");
    const surface = testElement("section", { role: "dialog", focusable: [first, last] });
    const dialog = testElement("div", { children: [surface] });
    let activeElement: Element | null = first;
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => null,
      activeElement: () => activeElement,
    });
    const shiftTab = keyboardEvent("Tab", { shiftKey: true });

    controller.trapFocus(shiftTab, dialog);
    activeElement = last;
    const tab = keyboardEvent("Tab");
    controller.trapFocus(tab, dialog);

    expect(shiftTab.defaultPrevented).toBe(true);
    expect(tab.defaultPrevented).toBe(true);
    expect(last.focusCount).toBe(1);
    expect(first.focusCount).toBe(1);

    const emptySurface = testElement("section", { role: "dialog" });
    const emptyDialog = testElement("div", { children: [emptySurface] });
    const emptyController = createModalController({
      dialogs: () => [emptyDialog],
      fallbackFocus: () => null,
      activeElement: () => null,
    });
    const emptyTab = keyboardEvent("Tab");

    emptyController.trapFocus(emptyTab, emptyDialog);

    expect(emptyTab.defaultPrevented).toBe(true);
    expect(emptySurface.focusCount).toBe(1);
  });

  it("activates default buttons while respecting text-entry and safe-input rules", () => {
    const defaultButton = testElement("button");
    const textInput = testElement("input");
    const safeInput = testElement("input");
    const surface = testElement("section", {
      dataset: { dialogDefault: "#ok" },
      role: "dialog",
      selectorMap: new Map([["#ok", defaultButton]]),
    });
    const dialog = testElement("div", { children: [surface] });
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => null,
    });
    const blocked = keyboardEvent("Enter", { target: textInput });
    const safe = keyboardEvent("Enter", { target: safeInput });
    const modified = keyboardEvent("Enter", { ctrlKey: true, target: safeInput });

    expect(controller.activateDefault(blocked, dialog)).toBe(false);
    expect(controller.activateDefault(modified, dialog, { isDefaultSafeTextEntry: () => true })).toBe(false);
    expect(controller.activateDefault(safe, dialog, { isDefaultSafeTextEntry: (_dialog, target) => target === safeInput }))
      .toBe(true);

    expect(blocked.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(safe.defaultPrevented).toBe(true);
    expect(defaultButton.clickCount).toBe(1);
  });

  it("activates cancel buttons or closes when cancel is unavailable", () => {
    const fallback = testElement("button");
    const cancelButton = testElement("button");
    const surface = testElement("section", {
      dataset: { dialogCancel: "#cancel" },
      role: "dialog",
      selectorMap: new Map([["#cancel", cancelButton]]),
    });
    const dialog = testElement("div", { children: [surface] });
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => fallback,
    });
    const cancelEvent = keyboardEvent("Escape");

    expect(controller.cancel(cancelEvent, dialog)).toBe(true);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(cancelButton.clickCount).toBe(1);

    const noCancelDialog = testElement("div", {
      children: [testElement("section", { role: "dialog" })],
    });
    const closeEvent = keyboardEvent("Escape");

    controller.cancel(closeEvent, noCancelDialog);

    expect(noCancelDialog.hidden).toBe(true);
    expect(fallback.focusCount).toBe(1);
  });

  it("returns stray focus into the open modal", () => {
    const first = testElement("button");
    const outside = testElement("button");
    const surface = testElement("section", { children: [first], role: "dialog", focusable: [first] });
    const dialog = testElement("div", { children: [surface], hidden: false });
    const controller = createModalController({
      dialogs: () => [dialog],
      fallbackFocus: () => null,
    });

    controller.keepFocusInsideOpenModal(focusEvent(outside));
    controller.keepFocusInsideOpenModal(focusEvent(first));

    expect(first.focusCount).toBe(1);
  });

  it("exposes focused DOM helpers for shared modal behavior", () => {
    const hidden = testElement("button", { visible: false });
    const visible = testElement("button");
    const surface = testElement("section", {
      dataset: { dialogDefault: "#ok" },
      focusable: [hidden, visible],
      role: "dialog",
      selectorMap: new Map([["#ok", visible]]),
    });
    const dialog = testElement("div", { children: [surface] });

    expect(getDialogSurface(dialog)).toBe(surface);
    expect(getFocusableElements(surface)).toEqual([visible]);
    expect(isVisibleElement(hidden)).toBe(false);
    expect(isVisibleElement(visible)).toBe(true);
    expect(dialogButtonFromSelector(dialog, "dialogDefault")).toBe(visible);
  });
});

type TestElement = HTMLElement & {
  clickCount: number;
  focusCount: number;
  scrollCount: number;
};

type TestElementOptions = {
  children?: TestElement[];
  dataset?: Record<string, string>;
  focusable?: TestElement[];
  hidden?: boolean;
  role?: string;
  selectorMap?: Map<string, TestElement>;
  visible?: boolean;
};

function testElement(tagName = "div", options: TestElementOptions = {}): TestElement {
  const children = options.children ?? [];
  const selectorMap = options.selectorMap ?? new Map<string, TestElement>();
  const roleTarget = options.role ? selfReference() : null;
  const element = {
    clickCount: 0,
    disabled: false,
    focusCount: 0,
    hidden: options.hidden ?? false,
    isContentEditable: false,
    parentElement: null as TestElement | null,
    scrollCount: 0,
    tagName: tagName.toUpperCase(),
    dataset: options.dataset ?? {},
    get offsetHeight() {
      return options.visible === false ? 0 : 1;
    },
    get offsetWidth() {
      return options.visible === false ? 0 : 1;
    },
    contains(candidate: unknown) {
      return candidate === element || children.some((child) => child.contains(candidate as Node));
    },
    querySelector(selector: string) {
      if (selector === "[role='dialog']") {
        return roleTarget?.() ?? children.find((child) => child.getAttribute("role") === "dialog") ?? null;
      }
      return selectorMap.get(selector) ?? null;
    },
    querySelectorAll() {
      return options.focusable ?? [];
    },
    getAttribute(name: string) {
      return name === "role" ? options.role ?? null : null;
    },
    getClientRects() {
      return { length: options.visible === false ? 0 : 1 };
    },
    closest(selector: string) {
      if (selector.includes(tagName.toLowerCase())) {
        return element;
      }
      return null;
    },
    click() {
      element.clickCount += 1;
    },
    focus() {
      element.focusCount += 1;
    },
    scrollIntoView() {
      element.scrollCount += 1;
    },
  };

  function selfReference() {
    return () => element as unknown as TestElement;
  }

  return element as unknown as TestElement;
}

type TestKeyboardEvent = KeyboardEvent & {
  defaultPrevented: boolean;
};

function keyboardEvent(
  key: string,
  options: Partial<Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">> & { target?: EventTarget } = {},
): TestKeyboardEvent {
  return {
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    defaultPrevented: false,
    key,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    target: options.target ?? null,
    preventDefault() {
      this.defaultPrevented = true;
    },
  } as TestKeyboardEvent;
}

function focusEvent(target: EventTarget): FocusEvent {
  return { target } as FocusEvent;
}
