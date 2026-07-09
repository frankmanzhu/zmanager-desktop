import { describe, expect, it } from "vitest";

import { createTranslator } from "../app/i18n/translator";
import {
  bindDropOverlayActions,
  dropOverlayActionFromChoice,
  focusDropOverlayPrimaryAction,
  renderDropOverlay,
  renderShellStatusBar,
  type DropOverlayAction,
  type DropOverlaySnapshot,
  type ShellStatusBarElements,
  type ShellViewElements,
} from "./shellView";

describe("shell view", () => {
  it("renders the idle drop overlay with default copy", () => {
    const elements = createShellViewElements();
    elements.workspace.dataset.dropTarget = "blocked";

    renderDropOverlay(elements, idleDropOverlay(), createTranslator("en").t);

    expect(elements.workspace.dataset.dropState).toBe("idle");
    expect(elements.workspace.dataset.dropTarget).toBeUndefined();
    expect(elements.dropOverlay.getAttribute("aria-hidden")).toBe("true");
    expect(elements.dropOverlayTitle.textContent).toBe("Drop files");
    expect(elements.dropOverlayMessage.textContent).toBe("Drop files into Compress or archives into Extract.");
    expect(elements.dropOverlaySupport.hidden).toBe(true);
    expect(elements.dropOverlayActions.hidden).toBe(true);
    expect(elements.dropOverlayCard.getAttribute("role")).toBe("status");
    expect(elements.dropOverlayCard.getAttribute("aria-modal")).toBeNull();
  });

  it("renders active copy with support text and a target dataset", () => {
    const elements = createShellViewElements();

    renderDropOverlay(elements, {
      mode: "active",
      copy: {
        titleKey: "drop.addSources.title",
        messageKey: "drop.addSources.copyMessage",
        supportKey: "drop.browserPreview",
        target: "compress",
      },
      pendingChoice: null,
    }, createTranslator("en").t);

    expect(elements.workspace.dataset.dropState).toBe("active");
    expect(elements.workspace.dataset.dropTarget).toBe("compress");
    expect(elements.dropOverlay.getAttribute("aria-hidden")).toBe("false");
    expect(elements.dropOverlayTitle.textContent).toBe("Add sources to archive");
    expect(elements.dropOverlayMessage.textContent).toContain("Copy the dropped items");
    expect(elements.dropOverlaySupport.textContent).toBe(
      "Browser preview uses copy-style file drops. Native drag-out is available in the desktop app.",
    );
    expect(elements.dropOverlaySupport.hidden).toBe(false);
    expect(elements.dropOverlayActions.hidden).toBe(true);
    expect(elements.dropOverlayCard.getAttribute("role")).toBe("status");
  });

  it("renders choosing copy with action controls and dialog semantics", () => {
    const elements = createShellViewElements();

    renderDropOverlay(elements, {
      mode: "choosing",
      copy: {
        titleKey: "drop.chooseMode.title",
        messageKey: "drop.chooseMode.mixedMessage",
        messageParams: {
          archiveCount: 2,
          sourceCount: 3,
        },
        target: "choose",
        showActions: true,
      },
      pendingChoice: {
        kind: "askAction",
        surface: "global",
        archivePaths: ["C:/in/one.zip", "C:/in/two.7z"],
        sourcePaths: ["C:/in/report.pdf", "C:/in/images", "C:/in/readme.txt"],
      },
    }, createTranslator("en").t);

    expect(elements.workspace.dataset.dropState).toBe("choosing");
    expect(elements.workspace.dataset.dropTarget).toBe("choose");
    expect(elements.dropOverlayActions.hidden).toBe(false);
    expect(elements.dropOverlayCard.getAttribute("role")).toBe("dialog");
    expect(elements.dropOverlayCard.getAttribute("aria-modal")).toBe("false");
    expect(elements.dropOverlayMessage.textContent).toContain("2 archive(s) and 3 other item(s)");
  });

  it("renders blocked copy through the target dataset", () => {
    const elements = createShellViewElements();

    renderDropOverlay(elements, {
      mode: "active",
      copy: {
        titleKey: "drop.blocked.title",
        messageKey: "drop.blocked.message",
        target: "blocked",
      },
      pendingChoice: null,
    }, createTranslator("en").t);

    expect(elements.workspace.dataset.dropTarget).toBe("blocked");
    expect(elements.dropOverlayTitle.textContent).toBe("Drop blocked");
    expect(elements.dropOverlayMessage.textContent).toBe("Finish the current job before dropping more files.");
    expect(elements.dropOverlaySupport.hidden).toBe(true);
  });

  it("decodes drop overlay button clicks and Escape key presses", () => {
    const elements = createShellViewElements();
    const choices: DropOverlayAction[] = [];
    const unbind = bindDropOverlayActions(elements, {
      onChoice: (action) => choices.push(action),
    });
    const clickEvent = eventWithTarget(choiceTarget("add-compress"));
    const escapeEvent = keyboardEvent("Escape");
    const ignoredKeyEvent = keyboardEvent("Enter");

    elements.dropOverlayActions.dispatch("click", clickEvent);
    elements.dropOverlay.dispatch("keydown", ignoredKeyEvent);
    elements.dropOverlay.dispatch("keydown", escapeEvent);
    unbind();
    elements.dropOverlayActions.dispatch("click", eventWithTarget(choiceTarget("open-archive")));

    expect(choices).toEqual(["addToCompress", "cancel"]);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(ignoredKeyEvent.defaultPrevented).toBe(false);
  });

  it("maps supported drop action attributes and focuses the primary action", () => {
    const elements = createShellViewElements();

    focusDropOverlayPrimaryAction(elements);

    expect(dropOverlayActionFromChoice("open-archive")).toBe("openArchive");
    expect(dropOverlayActionFromChoice("add-compress")).toBe("addToCompress");
    expect(dropOverlayActionFromChoice("cancel")).toBe("cancel");
    expect(dropOverlayActionFromChoice("unknown")).toBeNull();
    expect(elements.dropOpenArchiveButton.focusCount).toBe(1);
  });

  it("renders populated status bar selection and focus text", () => {
    const elements = createShellStatusBarElements();

    renderShellStatusBar(elements, {
      selectionCountText: "2 of 5 selected",
      selectionSizeText: "Selected: 12 KB",
      focusedSizeText: "Size: 10 KB",
      focusedModifiedText: "Modified: Jan 2, 2026",
    });

    expect(elements.selectionCount.textContent).toBe("2 of 5 selected");
    expect(elements.selectionSize.textContent).toBe("Selected: 12 KB");
    expect(elements.focusedSize.textContent).toBe("Size: 10 KB");
    expect(elements.focusedModified.textContent).toBe("Modified: Jan 2, 2026");
  });

  it("renders empty optional status bar selection and focus text", () => {
    const elements = createShellStatusBarElements();
    elements.selectionSize.textContent = "stale selection";
    elements.focusedSize.textContent = "stale size";
    elements.focusedModified.textContent = "stale modified";

    renderShellStatusBar(elements, {
      selectionCountText: "0 of 5 selected",
      selectionSizeText: "",
      focusedSizeText: "",
      focusedModifiedText: "",
    });

    expect(elements.selectionCount.textContent).toBe("0 of 5 selected");
    expect(elements.selectionSize.textContent).toBe("");
    expect(elements.focusedSize.textContent).toBe("");
    expect(elements.focusedModified.textContent).toBe("");
  });
});

function idleDropOverlay(): DropOverlaySnapshot {
  return {
    mode: "idle",
    copy: null,
    pendingChoice: null,
  };
}

type TestShellViewElements = ShellViewElements & {
  dropOverlay: TestElement;
  dropOverlayActions: TestElement;
  dropOpenArchiveButton: TestElement & HTMLButtonElement;
};

function createShellViewElements(): TestShellViewElements {
  return {
    workspace: testElement(),
    dropOverlay: testElement(),
    dropOverlayCard: testElement(),
    dropOverlayTitle: testElement(),
    dropOverlayMessage: testElement(),
    dropOverlaySupport: testElement(),
    dropOverlayActions: testElement(),
    dropOpenArchiveButton: testElement() as TestElement & HTMLButtonElement,
  };
}

function createShellStatusBarElements(): ShellStatusBarElements {
  return {
    selectionCount: testElement(),
    selectionSize: testElement(),
    focusedSize: testElement(),
    focusedModified: testElement(),
  };
}

type TestEvent = {
  target?: EventTarget;
  key?: string;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

type Listener = (event: Event) => void;

type TestElement = HTMLElement & {
  attributes: Record<string, string>;
  focusCount: number;
  dispatch: (type: string, event: TestEvent) => void;
};

function testElement(): TestElement {
  const listeners = new Map<string, Listener[]>();
  const element = {
    attributes: {} as Record<string, string>,
    dataset: {},
    hidden: false,
    textContent: "",
    focusCount: 0,
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
    focus() {
      element.focusCount += 1;
    },
  };

  return element as unknown as TestElement;
}

function choiceTarget(choice: string): EventTarget {
  return {
    closest: () => ({ dataset: { dropChoice: choice } }),
  } as unknown as EventTarget;
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

function keyboardEvent(key: string): TestEvent {
  return {
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
