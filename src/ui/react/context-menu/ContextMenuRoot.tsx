import { useEffect, useRef } from "react";

import {
  contextMenuItems,
} from "../../contextMenuHelpers";
import type { ZManagerContextMenuItem } from "../appRuntime";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function ContextMenuRoot() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const menu = snapshot.contextMenu;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const menuElement = menuRef.current;
    if (!menu.visible || !menuElement) {
      if (wasVisibleRef.current) {
        wasVisibleRef.current = false;
        restoreContextMenuFocus(menuElement, returnFocusRef.current);
        returnFocusRef.current = null;
      }
      return;
    }

    if (!wasVisibleRef.current) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && !menuElement.contains(active) ? active : null;
    }
    wasVisibleRef.current = true;

    menuElement.style.left = `${menu.x}px`;
    menuElement.style.top = `${menu.y}px`;
    const rect = menuElement.getBoundingClientRect();
    const clampedX = Math.max(4, Math.min(menu.x, window.innerWidth - rect.width - 4));
    const clampedY = Math.max(4, Math.min(menu.y, window.innerHeight - rect.height - 4));
    menuElement.style.left = `${clampedX}px`;
    menuElement.style.top = `${clampedY}px`;
    contextMenuItems(menuElement)[0]?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu.visible) {
      return;
    }

    const ownerDocument = menuRef.current?.ownerDocument ?? document;
    const hideOnOutsidePointerDown = (event: PointerEvent) => {
      const menuElement = menuRef.current;
      if (!menuElement || !(event.target instanceof Node) || menuElement.contains(event.target)) {
        return;
      }

      actions.handleContextMenuIntent({ type: "hide" });
    };

    ownerDocument.addEventListener("pointerdown", hideOnOutsidePointerDown);
    return () => ownerDocument.removeEventListener("pointerdown", hideOnOutsidePointerDown);
  }, [actions, menu.visible, menu.id]);

  return (
    <div
      id="context-menu"
      ref={menuRef}
      className="context-menu"
      role="menu"
      hidden={!menu.visible}
      style={menu.visible ? { left: menu.x, top: menu.y } : undefined}
      onKeyDown={(event) => {
        if (handleContextMenuKeyboard(event.currentTarget, event.nativeEvent)) {
          actions.handleContextMenuIntent({ type: "hide" });
          return;
        }
      }}
      onFocus={(event) => {
        if (!returnFocusRef.current && event.relatedTarget instanceof HTMLElement) {
          returnFocusRef.current = event.relatedTarget;
        }
      }}
    >
      {menu.visible
        ? menu.items.map((item, index) => renderContextMenuItem(item, index, actions.handleContextMenuIntent))
        : null}
    </div>
  );
}

function renderContextMenuItem(
  item: ZManagerContextMenuItem,
  index: number,
  onIntent: ReturnType<typeof useZManagerActions>["handleContextMenuIntent"],
) {
  switch (item.type) {
    case "action":
      return (
        <button
          key={contextMenuItemKey(item, index)}
          type="button"
          role="menuitem"
          data-context-action={item.payload.action}
          data-column-id={item.payload.columnId}
          data-archive-path={item.payload.archivePath}
          data-entry-path={item.payload.entryPath}
          data-source-path={item.payload.sourcePath}
          disabled={item.disabled}
          aria-disabled={item.disabled ? true : undefined}
          title={item.title ?? item.disabledReason}
          onClick={(event) => {
            event.preventDefault();
            onIntent({ type: "action", payload: item.payload });
          }}
        >
          <span className="context-menu-label">{item.label}</span>
        </button>
      );
    case "checkbox":
      return (
        <button
          key={contextMenuItemKey(item, index)}
          type="button"
          className="context-check-item"
          role="menuitemcheckbox"
          data-context-action={item.payload.action}
          data-column-id={item.payload.columnId}
          data-archive-path={item.payload.archivePath}
          data-entry-path={item.payload.entryPath}
          data-source-path={item.payload.sourcePath}
          aria-checked={item.checked ? "true" : "false"}
          disabled={item.disabled}
          aria-disabled={item.disabled ? true : undefined}
          title={item.title ?? item.disabledReason}
          onClick={(event) => {
            event.preventDefault();
            onIntent({ type: "action", payload: item.payload });
          }}
        >
          <span className="context-check" aria-hidden="true" />
          <span className="context-menu-label">{item.label}</span>
        </button>
      );
    case "caption":
      return (
        <div key={contextMenuItemKey(item, index)} className="context-menu-caption">
          {item.label}
        </div>
      );
    case "separator":
      return <div key={contextMenuItemKey(item, index)} className="context-menu-separator" role="separator" />;
  }
}

function contextMenuItemKey(item: ZManagerContextMenuItem, index: number): string {
  switch (item.type) {
    case "action":
    case "checkbox":
      return `${item.type}:${item.payload.action}:${index}`;
    case "caption":
      return `${item.type}:${item.label}:${index}`;
    case "separator":
      return `${item.type}:${index}`;
  }
}

function handleContextMenuKeyboard(contextMenu: HTMLElement, event: KeyboardEvent): boolean {
  const items = contextMenuItems(contextMenu);
  if (items.length === 0) {
    return false;
  }

  const active = contextMenu.ownerDocument.activeElement;
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
  } else if (event.key === "Escape" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    return true;
  } else if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    event.stopPropagation();
    items[activeIndex]?.click();
    return false;
  }

  if (nextIndex !== null) {
    event.preventDefault();
    items[nextIndex]?.focus();
  }

  return false;
}

function restoreContextMenuFocus(contextMenu: HTMLElement | null, restoreTarget: HTMLElement | null) {
  if (!contextMenu || !restoreTarget) {
    return;
  }

  const active = contextMenu.ownerDocument.activeElement;
  if (active instanceof HTMLElement && contextMenu.contains(active)) {
    restoreTarget.focus();
  }
}
