import {
  type KeyboardEvent,
  type MouseEvent,
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
  const groupLabels = useMemo(
    () => CLASSIC_MENU_GROUPS.map((group) => group.label),
    [],
  );
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null);

  return (
    <nav
      ref={navRef}
      className="flex h-[30px] min-h-[30px] shrink-0 select-none items-center gap-0.5 border-b border-slate-200 bg-white px-2.5 text-left dark:border-slate-800 dark:bg-slate-900 [body.native-menu-bar_&]:hidden"
      data-shell-chrome="menu"
      aria-label={i18n.t("workspace.menu.aria")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpenGroupLabel(null);
        }
      }}
    >
      {CLASSIC_MENU_GROUPS.map((group) => {
        const accessKey = menuGroupAccessKey(group.label);
        return (
          <details
            className="group relative"
            open={openGroupLabel === group.label}
            onPointerEnter={() => setOpenGroupLabel(group.label)}
            onFocus={() => setOpenGroupLabel(group.label)}
            onPointerLeave={(event) => {
              if (!event.currentTarget.matches(":focus-within")) {
                setOpenGroupLabel(null);
              }
            }}
            onKeyDown={(event) =>
              handleMenuKeyDown(
                event,
                group.label,
                groupLabels,
                navRef.current,
                setOpenGroupLabel,
              )
            }
            key={group.label}
          >
            <summary
              className="flex min-h-[26px] cursor-pointer list-none items-center rounded px-2.5 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
              data-menu-group-label={group.label}
              accessKey={accessKey}
              aria-keyshortcuts={`Alt+${accessKey.toUpperCase()}`}
              onClick={(event) => {
                event.preventDefault();
                setOpenGroupLabel(group.label);
              }}
            >
              {localizedMenuGroupLabel(group.label, snapshot)}
            </summary>
            <div className="absolute left-0 top-full z-[70] grid min-w-[220px] rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {group.items.map((item: MenuItem, index: number) => (
                <MenuEntry
                  item={item}
                  closeMenu={() => setOpenGroupLabel(null)}
                  key={`${group.label}-${index}`}
                />
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

function MenuEntry({
  item,
  closeMenu,
}: Readonly<{ item: MenuItem; closeMenu: () => void }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  if (item.kind === "separator") {
    return (
      <div
        className="my-1 h-px bg-slate-200 dark:bg-slate-700"
        role="separator"
      />
    );
  }

  if (item.kind === "submenu") {
    return (
      <div className="group/submenu relative flex min-h-7 items-center px-7 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
        <span data-command-submenu-label={item.labelKey}>
          {item.labelKey
            ? translatorForSnapshot(snapshot).t(item.labelKey)
            : item.label}
        </span>
        <div className="absolute left-full top-0 z-[71] hidden min-w-[220px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl group-hover/submenu:grid group-focus-within/submenu:grid dark:border-slate-700 dark:bg-slate-900">
          {item.items.map((child, index) => (
            <MenuEntry
              item={child}
              closeMenu={closeMenu}
              key={`${item.label}-${index}`}
            />
          ))}
        </div>
      </div>
    );
  }

  const commandId = item.id;
  const state = commandStateFor(snapshot.commands.states, commandId);
  const pressed = snapshot.commands.pressed[commandId];
  const title =
    state.reason && !state.enabled
      ? state.reason
      : localizedCommandTooltip(commandId, snapshot);

  return (
    <button
      id={`menu-command-${commandId}`}
      className="relative flex min-h-7 w-full items-center justify-between rounded border-0 bg-transparent px-7 py-1 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 aria-pressed:before:absolute aria-pressed:before:left-3 aria-pressed:before:content-['✓'] dark:hover:bg-slate-800"
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
      {COMMAND_DEFINITIONS[commandId].shortcut ? (
        <kbd>{COMMAND_DEFINITIONS[commandId].shortcut}</kbd>
      ) : null}
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
    const nextGroupLabel =
      groupLabels[
        (currentIndex + offset + groupLabels.length) % groupLabels.length
      ];
    setOpenGroupLabel(nextGroupLabel);
    focusMenuSummary(navElement, nextGroupLabel);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setOpenGroupLabel(currentGroupLabel);
    event.currentTarget
      .querySelector<HTMLButtonElement>(".menu-popover button:not(:disabled)")
      ?.focus();
  }
}

function focusMenuSummary(navElement: HTMLElement | null, groupLabel: string) {
  const selector = `[data-menu-group-label="${CSS.escape(groupLabel)}"]`;
  window.requestAnimationFrame(() => {
    navElement?.querySelector<HTMLElement>(selector)?.focus();
  });
}

function closeContainingMenu(
  _event: MouseEvent<HTMLElement>,
  closeMenu: () => void,
) {
  closeMenu();
}
