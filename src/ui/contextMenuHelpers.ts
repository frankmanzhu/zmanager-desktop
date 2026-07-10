import { isVisibleElement } from "./modalController";

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
