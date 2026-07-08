import {
  isVisibleElement,
} from "./modalController";

export type ContextMenuActionPayload = {
  action: string;
  archivePath?: string;
  columnId?: string;
  compressMenuPath?: string;
  entryPath?: string;
  folderPath?: string;
  sourcePath?: string;
};

export type ContextMenuViewport = {
  width: number;
  height: number;
};

export type ContextMenuViewOptions = {
  onAction: (payload: ContextMenuActionPayload) => void;
  onHide?: () => void;
  activeElement?: () => Element | null;
  defer?: (callback: () => void) => unknown;
  getViewport?: () => ContextMenuViewport;
};

export type ContextMenuView = ReturnType<typeof bindContextMenu>;

const MENU_ITEM_SELECTOR = [
  "button:not(:disabled)",
  "[role='menuitem']:not(:disabled):not([aria-disabled='true'])",
  "[role='menuitemcheckbox']:not(:disabled):not([aria-disabled='true'])",
].join(", ");

export function bindContextMenu(contextMenu: HTMLElement, options: ContextMenuViewOptions) {
  let returnFocus: HTMLElement | null = null;

  function currentActiveElement(): Element | null {
    return options.activeElement?.()
      ?? contextMenu.ownerDocument?.activeElement
      ?? (typeof document === "undefined" ? null : document.activeElement);
  }

  function currentActiveHtmlElement(): HTMLElement | null {
    const active = currentActiveElement();
    return isElement(active) ? active : null;
  }

  function showContextMenu(
    x: number,
    y: number,
    html: string,
    focusTarget: HTMLElement | null = currentActiveHtmlElement(),
  ) {
    returnFocus = focusTarget;
    contextMenu.innerHTML = html;
    contextMenu.hidden = false;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    const rect = contextMenu.getBoundingClientRect();
    const viewport = currentViewport(contextMenu, options.getViewport);
    const clampedX = Math.max(4, Math.min(x, viewport.width - rect.width - 4));
    const clampedY = Math.max(4, Math.min(y, viewport.height - rect.height - 4));
    contextMenu.style.left = `${clampedX}px`;
    contextMenu.style.top = `${clampedY}px`;
    contextMenuItems(contextMenu, currentActiveElement())[0]?.focus();
  }

  function hideContextMenu() {
    const restoreTarget = returnFocus;
    const active = currentActiveElement();
    const shouldRestoreFocus = !contextMenu.hidden
      && isElement(active)
      && contextMenu.contains(active);

    contextMenu.hidden = true;
    contextMenu.innerHTML = "";
    returnFocus = null;
    options.onHide?.();

    if (restoreTarget && shouldRestoreFocus && isVisibleElement(restoreTarget)) {
      restoreTarget.focus();
    }
  }

  const onClick = (event: Event) => {
    const payload = decodeContextMenuAction(event.target);
    if (!payload) {
      return;
    }

    event.preventDefault();
    options.onAction(payload);
  };

  const onKeydown = (event: KeyboardEvent) => {
    const items = contextMenuItems(contextMenu, currentActiveElement());
    if (items.length === 0) {
      return;
    }

    const active = currentActiveElement();
    const activeIndex = Math.max(0, items.indexOf(active as HTMLElement));
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hideContextMenu();
      return;
    } else if (event.key === "Tab") {
      event.stopPropagation();
      hideContextMenu();
      return;
    } else if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      const item = items[activeIndex];
      event.preventDefault();
      event.stopPropagation();
      item?.click();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  };

  const onFocusout = () => {
    const defer = options.defer ?? defaultDefer;
    defer(() => {
      const active = currentActiveElement();
      if (isElement(active) && !contextMenu.hidden && !contextMenu.contains(active)) {
        hideContextMenu();
      }
    });
  };

  contextMenu.addEventListener("click", onClick);
  contextMenu.addEventListener("keydown", onKeydown);
  contextMenu.addEventListener("focusout", onFocusout);

  return {
    contextMenuItems: () => contextMenuItems(contextMenu, currentActiveElement()),
    hideContextMenu,
    showContextMenu,
    unbind() {
      contextMenu.removeEventListener("click", onClick);
      contextMenu.removeEventListener("keydown", onKeydown);
      contextMenu.removeEventListener("focusout", onFocusout);
    },
  };
}

export function contextMenuItems(
  contextMenu: HTMLElement,
  activeElement: Element | null = contextMenu.ownerDocument?.activeElement ?? null,
): HTMLElement[] {
  return Array.from(contextMenu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR))
    .filter((element) => isVisibleElement(element) || element === activeElement);
}

export function decodeContextMenuAction(target: EventTarget | null): ContextMenuActionPayload | null {
  const button = closestElement<HTMLElement>(target, "[data-context-action]");
  const action = button?.dataset.contextAction;
  if (!button || !action) {
    return null;
  }

  return {
    action,
    archivePath: button.dataset.archivePath,
    columnId: button.dataset.columnId,
    compressMenuPath: button.dataset.compressMenuPath,
    entryPath: button.dataset.entryPath,
    folderPath: button.dataset.folderPath,
    sourcePath: button.dataset.sourcePath,
  };
}

function currentViewport(
  contextMenu: HTMLElement,
  getViewport: (() => ContextMenuViewport) | undefined,
): ContextMenuViewport {
  if (getViewport) {
    return getViewport();
  }

  const view = contextMenu.ownerDocument?.defaultView ?? (typeof window === "undefined" ? null : window);
  return {
    width: view?.innerWidth ?? 0,
    height: view?.innerHeight ?? 0,
  };
}

function defaultDefer(callback: () => void): unknown {
  if (typeof window === "undefined") {
    callback();
    return undefined;
  }

  return window.setTimeout(callback, 0);
}

type ClosestElement = {
  closest: <T extends Element = Element>(selector: string) => T | null;
};

function closestElement<T extends Element>(target: EventTarget | null, selector: string): T | null {
  if (!target || typeof (target as Partial<ClosestElement>).closest !== "function") {
    return null;
  }

  return (target as unknown as ClosestElement).closest<T>(selector);
}

function isElement(value: unknown): value is HTMLElement {
  return Boolean(value && typeof value === "object" && "contains" in value && "focus" in value);
}
