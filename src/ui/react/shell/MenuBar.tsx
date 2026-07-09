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

  return (
    <nav className="app-menu" aria-label={i18n.t("workspace.menu.aria")}>
      {CLASSIC_MENU_GROUPS.map((group) => {
        const accessKey = menuGroupAccessKey(group.label);
        return (
          <details className="menu" key={group.label}>
            <summary
              data-menu-group-label={group.label}
              accessKey={accessKey}
              aria-keyshortcuts={`Alt+${accessKey.toUpperCase()}`}
            >
              {localizedMenuGroupLabel(group.label, snapshot)}
            </summary>
            <div className="menu-popover">
              {group.items.map((item, index) => (
                <MenuEntry item={item} key={`${group.label}-${index}`} />
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

function MenuEntry({ item }: Readonly<{ item: MenuItem }>) {
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
            <MenuEntry item={child} key={`${item.label}-${index}`} />
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
      onClick={() => actions.executeCommand(commandId)}
    >
      <span>{localizedCommandLabel(commandId, snapshot)}</span>
      {COMMAND_DEFINITIONS[commandId].shortcut ? <kbd>{COMMAND_DEFINITIONS[commandId].shortcut}</kbd> : null}
    </button>
  );
}
