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

const MENU_ITEM_SELECTOR = [
  "button:not(:disabled)",
  "[role='menuitem']:not(:disabled):not([aria-disabled='true'])",
  "[role='menuitemcheckbox']:not(:disabled):not([aria-disabled='true'])",
].join(", ");

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

type ClosestElement = {
  closest: <T extends Element = Element>(selector: string) => T | null;
};

function closestElement<T extends Element>(target: EventTarget | null, selector: string): T | null {
  if (!target || typeof (target as Partial<ClosestElement>).closest !== "function") {
    return null;
  }

  return (target as unknown as ClosestElement).closest<T>(selector);
}
