import { beforeEach, describe, expect, it } from "vitest";

import {
  bindContextMenu,
  decodeContextMenuAction,
  type ContextMenuActionPayload,
} from "./contextMenuView";

describe("context menu view", () => {
  beforeEach(() => {
    activeElement = null;
  });

  it("clamps placement inside the viewport and focuses the first item", () => {
    const menu = testElement("div", { rect: { width: 90, height: 40 } });
    const first = testElement("button");
    menu.append(first);
    const controller = bindContextMenu(menu, {
      activeElement: () => activeElement,
      getViewport: () => ({ width: 100, height: 80 }),
      onAction: () => undefined,
    });

    controller.showContextMenu(90, 70, "<button></button>");

    expect(menu.hidden).toBe(false);
    expect(menu.style.left).toBe("6px");
    expect(menu.style.top).toBe("36px");
    expect(first.focusCount).toBe(1);
  });

  it("restores focus on hide only when focus was inside the visible menu", () => {
    const returnFocus = testElement("button");
    const outside = testElement("button");
    const item = testElement("button");
    const menu = testElement("div");
    menu.append(item);
    let hideCount = 0;
    const controller = bindContextMenu(menu, {
      activeElement: () => activeElement,
      getViewport: () => ({ width: 320, height: 240 }),
      onAction: () => undefined,
      onHide: () => {
        hideCount += 1;
      },
    });

    controller.showContextMenu(10, 10, "<button></button>", returnFocus);
    controller.hideContextMenu();
    controller.showContextMenu(10, 10, "<button></button>", returnFocus);
    activeElement = outside;
    controller.hideContextMenu();

    expect(menu.hidden).toBe(true);
    expect(menu.innerHTML).toBe("");
    expect(returnFocus.focusCount).toBe(1);
    expect(hideCount).toBe(2);
  });

  it("decodes context menu actions and dataset payloads from nested targets", () => {
    const menu = testElement("div");
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
    menu.append(button);
    const actions: ContextMenuActionPayload[] = [];
    bindContextMenu(menu, {
      activeElement: () => activeElement,
      onAction: (payload) => actions.push(payload),
    });
    const click = testEvent(label);

    menu.dispatch("click", click);

    expect(actions).toEqual([{
      action: "include-compress-path",
      archivePath: "C:/archives/demo.zip",
      columnId: "name",
      compressMenuPath: "src/app",
      entryPath: "folder/file.txt",
      folderPath: "folder",
      sourcePath: "C:/src/app",
    }]);
    expect(click.defaultPrevented).toBe(true);
    expect(decodeContextMenuAction(testElement("span"))).toBeNull();
  });

  it("moves focus with keyboard navigation, activates focused items, and hides on Escape", () => {
    const returnFocus = testElement("button");
    const first = testElement("button");
    const second = testElement("button");
    const third = testElement("button");
    const menu = testElement("div");
    menu.append(first, second, third);
    let hideCount = 0;
    const controller = bindContextMenu(menu, {
      activeElement: () => activeElement,
      getViewport: () => ({ width: 320, height: 240 }),
      onAction: () => undefined,
      onHide: () => {
        hideCount += 1;
      },
    });
    controller.showContextMenu(10, 10, "<button></button>", returnFocus);

    menu.dispatch("keydown", keyboardEvent("ArrowDown"));
    menu.dispatch("keydown", keyboardEvent("End"));
    menu.dispatch("keydown", keyboardEvent("Home"));
    const enter = keyboardEvent("Enter");
    menu.dispatch("keydown", enter);
    const escape = keyboardEvent("Escape");
    menu.dispatch("keydown", escape);

    expect(second.focusCount).toBe(1);
    expect(third.focusCount).toBe(1);
    expect(first.focusCount).toBe(2);
    expect(first.clickCount).toBe(1);
    expect(enter.defaultPrevented).toBe(true);
    expect(enter.propagationStopped).toBe(true);
    expect(escape.defaultPrevented).toBe(true);
    expect(menu.hidden).toBe(true);
    expect(returnFocus.focusCount).toBe(1);
    expect(hideCount).toBe(1);
  });

  it("hides after focus leaves the menu", () => {
    const outside = testElement("button");
    const item = testElement("button");
    const menu = testElement("div");
    menu.append(item);
    const deferred: { callback: (() => void) | null } = { callback: null };
    let hideCount = 0;
    const controller = bindContextMenu(menu, {
      activeElement: () => activeElement,
      defer: (callback) => {
        deferred.callback = callback;
      },
      getViewport: () => ({ width: 320, height: 240 }),
      onAction: () => undefined,
      onHide: () => {
        hideCount += 1;
      },
    });
    controller.showContextMenu(10, 10, "<button></button>");

    menu.dispatch("focusout", testEvent(item));
    activeElement = outside;
    expect(deferred.callback).toBeTypeOf("function");
    deferred.callback?.();

    expect(menu.hidden).toBe(true);
    expect(hideCount).toBe(1);
  });
});

let activeElement: Element | null = null;

type TestElement = HTMLElement & {
  childElements: TestElement[];
  clickCount: number;
  disabled: boolean;
  focusCount: number;
  parentTestElement: TestElement | null;
  append: (...children: TestElement[]) => void;
  dispatch: (type: string, event: TestEvent | TestKeyboardEvent) => void;
};

type TestElementOptions = {
  dataset?: Record<string, string>;
  rect?: { width: number; height: number };
  visible?: boolean;
};

type Listener = (event: Event) => void;

function testElement(tagName = "div", options: TestElementOptions = {}): TestElement {
  const children: TestElement[] = [];
  const listeners = new Map<string, Listener[]>();
  const attributes = new Map<string, string>();
  let html = "";
  const element = {
    childElements: children,
    clickCount: 0,
    disabled: false,
    focusCount: 0,
    hidden: true,
    parentTestElement: null as TestElement | null,
    style: {
      left: "",
      top: "",
    },
    tagName: tagName.toUpperCase(),
    dataset: { ...(options.dataset ?? {}) },
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      if (value === "") {
        children.length = 0;
      }
    },
    get offsetHeight() {
      return options.visible === false ? 0 : 1;
    },
    get offsetWidth() {
      return options.visible === false ? 0 : 1;
    },
    append(...nextChildren: TestElement[]) {
      for (const child of nextChildren) {
        child.parentTestElement = element as unknown as TestElement;
        children.push(child);
      }
    },
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
    },
    dispatch(type: string, event: TestEvent | TestKeyboardEvent) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event as unknown as Event);
      }
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    contains(candidate: unknown): boolean {
      return candidate === element || children.some((child) => child.contains(candidate as Node));
    },
    closest<T extends Element = Element>(selector: string): T | null {
      let candidate: TestElement | null = element as unknown as TestElement;
      while (candidate) {
        if (matchesSelector(candidate, selector)) {
          return candidate as unknown as T;
        }
        candidate = candidate.parentTestElement;
      }
      return null;
    },
    querySelectorAll<T extends Element>(selector: string): T[] {
      if (selector.includes("role='menuitem'") || selector.includes("button:not(:disabled)")) {
        return collectMenuItems(children) as unknown as T[];
      }
      return [];
    },
    getBoundingClientRect() {
      return {
        width: options.rect?.width ?? 80,
        height: options.rect?.height ?? 24,
      };
    },
    getClientRects() {
      return { length: options.visible === false ? 0 : 1 };
    },
    click() {
      element.clickCount += 1;
    },
    focus() {
      element.focusCount += 1;
      activeElement = element as unknown as Element;
    },
  };

  return element as unknown as TestElement;
}

function collectMenuItems(elements: TestElement[]): TestElement[] {
  const items: TestElement[] = [];
  for (const element of elements) {
    if (isMenuItem(element)) {
      items.push(element);
    }
    items.push(...collectMenuItems(element.childElements));
  }
  return items;
}

function isMenuItem(element: TestElement): boolean {
  const role = element.getAttribute("role");
  return !element.disabled
    && element.getAttribute("aria-disabled") !== "true"
    && (element.tagName === "BUTTON" || role === "menuitem" || role === "menuitemcheckbox");
}

function matchesSelector(element: TestElement, selector: string): boolean {
  return selector === "[data-context-action]" && Boolean(element.dataset.contextAction);
}

type TestEvent = {
  target: EventTarget;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

type TestKeyboardEvent = TestEvent & {
  key: string;
  propagationStopped: boolean;
  stopPropagation: () => void;
};

function testEvent(target: EventTarget): TestEvent {
  return {
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function keyboardEvent(key: string): TestKeyboardEvent {
  return {
    ...testEvent(activeElement as EventTarget),
    key,
    propagationStopped: false,
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}
