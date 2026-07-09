import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CLASSIC_MENU_GROUPS,
  COMMAND_DEFINITIONS,
  type CommandId,
  type MenuItem,
} from "../../../app/classicCommands";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import {
  commandStateFor,
  localizedCommandLabel,
  localizedCommandTooltip,
  localizedMenuGroupLabel,
  menuGroupAccessKey,
  translatorForSnapshot,
} from "./shellHelpers";

export function MenuBar() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const navRef = useRef<HTMLElement | null>(null);
  const groupLabels = useMemo(() => CLASSIC_MENU_GROUPS.map((group) => group.label), []);
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!openGroupLabel) {
      return;
    }

    const ownerDocument = navRef.current?.ownerDocument ?? document;
    const closeOnOutsideClick = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Node && navRef.current?.contains(event.target)) {
        return;
      }

      setOpenGroupLabel(null);
    };

    ownerDocument.addEventListener("click", closeOnOutsideClick);
    return () => ownerDocument.removeEventListener("click", closeOnOutsideClick);
  }, [openGroupLabel]);

  return (
    <nav ref={navRef} className="app-menu" aria-label={i18n.t("workspace.menu.aria")}>
      {CLASSIC_MENU_GROUPS.map((group) => {
        const accessKey = menuGroupAccessKey(group.label);
        return (
          <details
            className="menu"
            open={openGroupLabel === group.label}
            onPointerEnter={() => setOpenGroupLabel(group.label)}
            onFocus={() => setOpenGroupLabel(group.label)}
            onPointerLeave={(event) => {
              if (!event.currentTarget.matches(":focus-within")) {
                setOpenGroupLabel(null);
              }
            }}
            onKeyDown={(event) => handleMenuKeyDown(event, group.label, groupLabels, navRef.current, setOpenGroupLabel)}
            key={group.label}
          >
            <summary
              data-menu-group-label={group.label}
              accessKey={accessKey}
              aria-keyshortcuts={`Alt+${accessKey.toUpperCase()}`}
              onClick={(event) => {
                event.preventDefault();
                setOpenGroupLabel((current) => (current === group.label ? null : group.label));
              }}
            >
              {localizedMenuGroupLabel(group.label, snapshot)}
            </summary>
            <div className="menu-popover">
              {group.items.map((item, index) => (
                <MenuEntry item={item} closeMenu={() => setOpenGroupLabel(null)} key={`${group.label}-${index}`} />
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

function MenuEntry({ item, closeMenu }: Readonly<{ item: MenuItem; closeMenu: () => void }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  if (item.kind === "separator") {
    return <div className="menu-separator" role="separator" />;
  }

  if (item.kind === "submenu") {
    return (
      <div className="menu-submenu">
        <span data-command-submenu-label={item.labelKey}>{item.labelKey ? translatorForSnapshot(snapshot).t(item.labelKey) : item.label}</span>
        <div className="menu-submenu-popover">
          {item.items.map((child, index) => (
            <MenuEntry item={child} closeMenu={closeMenu} key={`${item.label}-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  const commandId = item.id;
  const state = commandStateFor(snapshot.commands.states, commandId);
  const pressed = snapshot.commands.pressed[commandId];
  const title = state.reason && !state.enabled ? state.reason : localizedCommandTooltip(commandId, snapshot);

  return (
    <button
      id={`menu-command-${commandId}`}
      className="menu-item"
      type="button"
      data-command-id={commandId}
      title={title}
      disabled={!state.enabled}
      aria-disabled={!state.enabled}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      onClick={(event) => {
        actions.executeCommand(commandId);
        closeContainingMenu(event, closeMenu);
      }}
    >
      <span>{localizedCommandLabel(commandId, snapshot)}</span>
      {COMMAND_DEFINITIONS[commandId].shortcut ? <kbd>{COMMAND_DEFINITIONS[commandId].shortcut}</kbd> : null}
    </button>
  );
}

function handleMenuKeyDown(
  event: KeyboardEvent<HTMLDetailsElement>,
  currentGroupLabel: string,
  groupLabels: readonly string[],
  navElement: HTMLElement | null,
  setOpenGroupLabel: (groupLabel: string | null) => void,
) {
  const currentIndex = groupLabels.indexOf(currentGroupLabel);
  const summary = event.currentTarget.querySelector<HTMLElement>("summary");

  if (event.key === "Escape") {
    event.preventDefault();
    setOpenGroupLabel(null);
    summary?.focus();
    return;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextGroupLabel = groupLabels[(currentIndex + offset + groupLabels.length) % groupLabels.length];
    setOpenGroupLabel(nextGroupLabel);
    focusMenuSummary(navElement, nextGroupLabel);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setOpenGroupLabel(currentGroupLabel);
    event.currentTarget.querySelector<HTMLButtonElement>(".menu-popover button:not(:disabled)")?.focus();
  }
}

function focusMenuSummary(navElement: HTMLElement | null, groupLabel: string) {
  const selector = `[data-menu-group-label="${CSS.escape(groupLabel)}"]`;
  window.requestAnimationFrame(() => {
    navElement?.querySelector<HTMLElement>(selector)?.focus();
  });
}

function closeContainingMenu(_event: MouseEvent<HTMLElement>, closeMenu: () => void) {
  closeMenu();
}
