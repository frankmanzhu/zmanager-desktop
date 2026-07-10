import { useEffect, useRef, type MouseEvent } from "react";

import type { ContextMenuModelItem } from "../../../app/commands/contextMenuModel";
import { contextMenuItems } from "../../contextMenuHelpers";
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
      {menu.visible ? menu.items.map((item, index) => (
        <ContextMenuRow
          // Context menu rows are rebuilt for each snapshot; index is stable enough inside one menu instance.
          key={`${menu.id}-${index}`}
          item={item}
          onAction={(payload) => {
            actions.handleContextMenuIntent({ type: "action", payload });
          }}
        />
      )) : null}
    </div>
  );
}

function ContextMenuRow({
  item,
  onAction,
}: Readonly<{
  item: ContextMenuModelItem;
  onAction: (payload: Extract<ContextMenuModelItem, { type: "action" | "checkbox" }>["payload"]) => void;
}>) {
  if (item.type === "separator") {
    return <div className="context-menu-separator" role="separator" />;
  }

  if (item.type === "caption") {
    return <div className="context-menu-caption">{item.label}</div>;
  }

  const disabled = Boolean(item.disabled);
  const commonProps = {
    type: "button" as const,
    disabled,
    title: item.title ?? item.disabledReason,
    "data-context-action": item.payload.action,
    "data-archive-path": item.payload.archivePath,
    "data-column-id": item.payload.columnId,
    "data-compress-menu-path": item.payload.compressMenuPath,
    "data-entry-path": item.payload.entryPath,
    "data-folder-path": item.payload.folderPath,
    "data-source-path": item.payload.sourcePath,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!disabled) {
        onAction(item.payload);
      }
    },
  };

  if (item.type === "checkbox") {
    return (
      <button
        {...commonProps}
        className="context-check-item"
        role="menuitemcheckbox"
        aria-checked={item.checked}
        aria-disabled={disabled || undefined}
      >
        <span className="context-check" aria-hidden="true" />
        <span className="context-menu-label">{item.label}</span>
        {item.shortcut ? <span className="context-menu-shortcut">{item.shortcut}</span> : null}
      </button>
    );
  }

  return (
    <button {...commonProps} role="menuitem" aria-disabled={disabled || undefined}>
      <span className="context-menu-label">{item.label}</span>
      {item.shortcut ? <span className="context-menu-shortcut">{item.shortcut}</span> : null}
    </button>
  );
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
