import { describe, expect, it } from "vitest";

import {
  COMMAND_DEFINITIONS,
  type CommandId,
  type CommandStateMap,
} from "../app/classicCommands";
import {
  applyCommandSurfaceState,
  bindCommandSurface,
  refreshCommandSurfaceText,
} from "./commandSurfaceView";

describe("command surface view", () => {
  it("decodes valid command clicks and signals menu popover commands", () => {
    const root = testElement("div");
    const popover = testElement("div", ["menu-popover"]);
    const button = commandButton("open");
    const label = testElement("span");
    root.append(popover);
    popover.append(button);
    button.append(label);
    const commands: CommandId[] = [];
    let closeSignals = 0;
    const unbind = bindCommandSurface(root, {
      commandDefinitions: COMMAND_DEFINITIONS,
      onCommand: (commandId) => commands.push(commandId),
      onMenuPopoverCommand: () => {
        closeSignals += 1;
      },
    });
    const clickEvent = eventWithTarget(label);

    root.dispatch("click", clickEvent);
    unbind();
    root.dispatch("click", eventWithTarget(label));

    expect(commands).toEqual(["open"]);
    expect(closeSignals).toBe(1);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it("ignores invalid command ids", () => {
    const root = testElement("div");
    const button = testElement("button");
    button.dataset.commandId = "notACommand";
    root.append(button);
    const commands: CommandId[] = [];
    bindCommandSurface(root, {
      commandDefinitions: COMMAND_DEFINITIONS,
      onCommand: (commandId) => commands.push(commandId),
    });
    const clickEvent = eventWithTarget(button);

    root.dispatch("click", clickEvent);

    expect(commands).toEqual([]);
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it("refreshes menu, submenu, command labels, aria labels, and tooltips", () => {
    const root = testElement("div");
    const menuSummary = testElement("summary");
    menuSummary.dataset.menuGroupLabel = "File";
    const submenu = testElement("span");
    submenu.dataset.commandSubmenuLabel = "commandMenu.toolbars";
    const button = commandButton("open");
    const buttonLabel = testElement("span", ["tool-label"]);
    button.append(buttonLabel);
    root.append(menuSummary, submenu, button);

    refreshCommandSurfaceText(root, {
      commandDefinitions: COMMAND_DEFINITIONS,
      commandLabel: (commandId) => `label:${commandId}`,
      commandTooltip: (commandId) => `tooltip:${commandId}`,
      menuGroupLabel: (label) => `menu:${label}`,
      submenuLabel: (key) => `submenu:${key}`,
    });

    expect(menuSummary.textContent).toBe("menu:File");
    expect(submenu.textContent).toBe("submenu:commandMenu.toolbars");
    expect(buttonLabel.textContent).toBe("label:open");
    expect(button.getAttribute("aria-label")).toBe("label:open");
    expect(button.title).toBe("tooltip:open");
  });

  it("falls back to button text only when a command button has no icon", () => {
    const root = testElement("div");
    const textButton = commandButton("about");
    const iconButton = commandButton("refresh");
    iconButton.append(testElement("svg"));
    root.append(textButton, iconButton);

    refreshCommandSurfaceText(root, {
      commandDefinitions: COMMAND_DEFINITIONS,
      commandLabel: (commandId) => `label:${commandId}`,
      commandTooltip: (commandId) => `tooltip:${commandId}`,
      menuGroupLabel: (label) => label,
      submenuLabel: (key) => key,
    });

    expect(textButton.textContent).toBe("label:about");
    expect(iconButton.textContent).toBe("");
  });

  it("applies disabled, aria, pressed, unsupported, and visual command state", () => {
    const root = testElement("div");
    const openButton = commandButton("open");
    const flatButton = commandButton("flatView");
    const largeButton = commandButton("largeButtons");
    const editButton = commandButton("edit");
    const refreshButton = commandButton("refresh");
    const unknownButton = testElement("button");
    unknownButton.dataset.commandId = "missing";
    root.append(openButton, flatButton, largeButton, editButton, refreshButton, unknownButton);

    applyCommandSurfaceState(root, {
      commandDefinitions: COMMAND_DEFINITIONS,
      commandState: enabledCommandState({
        open: { enabled: false, reason: "Open blocked" },
        edit: { enabled: false },
      }),
      commandTooltip: (commandId) => `tooltip:${commandId}`,
      commandStateReason: (reason) => reason ? `reason:${reason}` : undefined,
      pressedState: {
        flatView: true,
        largeButtons: false,
      },
      classState: {
        open: { primary: true },
        refresh: { secondary: true },
      },
    });

    expect(openButton.disabled).toBe(true);
    expect(openButton.title).toBe("reason:Open blocked");
    expect(openButton.getAttribute("aria-disabled")).toBe("true");
    expect(openButton.classList.contains("is-primary-command")).toBe(true);
    expect(flatButton.getAttribute("aria-pressed")).toBe("true");
    expect(largeButton.getAttribute("aria-pressed")).toBe("false");
    expect(refreshButton.classList.contains("is-secondary-command")).toBe(true);
    expect(editButton.dataset.unsupported).toBe("true");
    expect(unknownButton.getAttribute("aria-disabled")).toBeNull();
  });
});

function enabledCommandState(overrides: Partial<CommandStateMap> = {}): CommandStateMap {
  return {
    ...Object.fromEntries(
      (Object.keys(COMMAND_DEFINITIONS) as CommandId[]).map((id) => [id, { enabled: true }]),
    ) as CommandStateMap,
    ...overrides,
  };
}

function commandButton(commandId: CommandId): TestElement {
  const button = testElement("button");
  button.dataset.commandId = commandId;
  return button;
}

type Listener = (event: Event) => void;

type TestEvent = {
  target?: EventTarget;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

type TestElement = HTMLElement & {
  disabled: boolean;
  append: (...children: TestElement[]) => void;
  dispatch: (type: string, event: TestEvent) => void;
};

function testElement(tagName: string, classes: string[] = []): TestElement {
  const listeners = new Map<string, Listener[]>();
  const classNames = new Set(classes);
  const children: ElementState[] = [];
  const element = {
    tagName: tagName.toUpperCase(),
    dataset: {} as Record<string, string | undefined>,
    attributes: {} as Record<string, string>,
    children,
    parentElement: null as ElementState | null,
    disabled: false,
    title: "",
    textContent: "",
    classList: {
      toggle(name: string, force?: boolean) {
        if (force) {
          classNames.add(name);
        } else {
          classNames.delete(name);
        }
      },
      contains(name: string) {
        return classNames.has(name);
      },
    },
    append(...nextChildren: ElementState[]) {
      for (const child of nextChildren) {
        child.parentElement = element as ElementState;
        children.push(child);
      }
    },
    setAttribute(name: string, value: string) {
      element.attributes[name] = value;
    },
    removeAttribute(name: string) {
      delete element.attributes[name];
    },
    getAttribute(name: string) {
      return element.attributes[name] ?? null;
    },
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
    },
    dispatch(type: string, event: TestEvent) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event as unknown as Event);
      }
    },
    querySelectorAll<T extends Element>(selector: string): T[] {
      return collectMatching(children, selector) as unknown as T[];
    },
    querySelector<T extends Element>(selector: string): T | null {
      return collectMatching(children, selector)[0] as unknown as T | undefined ?? null;
    },
    closest<T extends Element>(selector: string): T | null {
      let candidate: ElementState | null = element as ElementState;
      while (candidate) {
        if (matchesSelector(candidate, selector)) {
          return candidate as unknown as T;
        }
        candidate = candidate.parentElement;
      }
      return null;
    },
  };

  return element as unknown as TestElement;
}

type ElementState = {
  tagName: string;
  dataset: Record<string, string | undefined>;
  children: ElementState[];
  parentElement: ElementState | null;
  classList: {
    contains: (name: string) => boolean;
  };
};

function collectMatching(elements: ElementState[], selector: string): ElementState[] {
  const matches: ElementState[] = [];
  for (const element of elements) {
    if (matchesSelector(element, selector)) {
      matches.push(element);
    }
    matches.push(...collectMatching(element.children, selector));
  }
  return matches;
}

function matchesSelector(element: ElementState, selector: string): boolean {
  switch (selector) {
    case "[data-command-id]":
      return Boolean(element.dataset.commandId);
    case "[data-menu-group-label]":
      return Boolean(element.dataset.menuGroupLabel);
    case "[data-command-submenu-label]":
      return Boolean(element.dataset.commandSubmenuLabel);
    case ".menu-popover":
      return element.classList.contains("menu-popover");
    case ".tool-label, .context-menu-label":
      return element.classList.contains("tool-label") || element.classList.contains("context-menu-label");
    case "span:not(.sort-indicator)":
      return element.tagName === "SPAN" && !element.classList.contains("sort-indicator");
    case "svg":
      return element.tagName === "SVG";
    default:
      return false;
  }
}

function eventWithTarget(target: EventTarget): TestEvent {
  return {
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
