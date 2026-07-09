import { CLASSIC_TOOLBAR_GROUPS } from "../../../app/classicCommands";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import {
  commandButtonId,
  commandIcon,
  commandShortcut,
  commandStateFor,
  localizedCommandLabel,
  localizedCommandTooltip,
  translatorForSnapshot,
} from "./shellHelpers";

export function CommandToolbar() {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const className = [
    "command-toolbar",
    "mode-toolbar",
    snapshot.preferences.largeToolbarButtons ? "large" : "",
    snapshot.preferences.showToolbarLabels ? "show-labels" : "",
  ].filter(Boolean).join(" ");

  return (
    <header className={className} role="toolbar" aria-label={i18n.t("workspace.toolbar.aria")}>
      <WorkspaceModeTabs />
      <div className="command-strip">
        {CLASSIC_TOOLBAR_GROUPS.map((group, index) => (
          <ToolbarGroup group={group} key={group.id} showSeparator={index > 0} />
        ))}
      </div>
      <div className="toolbar-spacer" />
    </header>
  );
}

function WorkspaceModeTabs() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const isCompress = snapshot.shell.activeMode === "compress";

  return (
    <div className="mode-switch" role="tablist" aria-label={i18n.t("workspace.mode.aria")}>
      <button
        id="mode-compress"
        className={`mode-button${isCompress ? " is-active" : ""}`}
        type="button"
        role="tab"
        data-workspace-mode="compress"
        aria-selected={isCompress}
        onClick={() => actions.setWorkspaceMode("compress")}
      >
        {i18n.t("workspace.mode.compress")}
      </button>
      <button
        id="mode-extract"
        className={`mode-button${!isCompress ? " is-active" : ""}`}
        type="button"
        role="tab"
        data-workspace-mode="extract"
        aria-selected={!isCompress}
        onClick={() => actions.setWorkspaceMode("extract")}
      >
        {i18n.t("workspace.mode.extract")}
      </button>
    </div>
  );
}

type ToolbarGroupType = (typeof CLASSIC_TOOLBAR_GROUPS)[number];

function ToolbarGroup({
  group,
  showSeparator,
}: Readonly<{ group: ToolbarGroupType; showSeparator: boolean }>) {
  return (
    <>
      {showSeparator ? <div className="toolbar-separator" aria-hidden="true" /> : null}
      <div className="toolbar-group" role="group" aria-label={group.label} data-command-group={group.id}>
        <span className="toolbar-group-label">{group.label}</span>
        {group.items.map((commandId) => (
          <ToolbarButton commandId={commandId} key={commandId} />
        ))}
      </div>
    </>
  );
}

function ToolbarButton({ commandId }: Readonly<{ commandId: ToolbarGroupType["items"][number] }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const state = commandStateFor(snapshot.commands.states, commandId);
  const Icon = commandIcon(commandId);
  const primary = snapshot.commands.primaryCommandIds.includes(commandId);
  const secondary = snapshot.commands.secondaryCommandIds.includes(commandId);
  const pressed = snapshot.commands.pressed[commandId];
  const className = [
    "tool-button",
    primary ? "is-primary-command" : "",
    secondary ? "is-secondary-command" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      id={commandButtonId(commandId)}
      className={className}
      type="button"
      data-command-id={commandId}
      aria-label={localizedCommandLabel(commandId, snapshot)}
      title={state.reason && !state.enabled ? state.reason : localizedCommandTooltip(commandId, snapshot)}
      aria-keyshortcuts={commandShortcut(commandId)}
      aria-disabled={!state.enabled}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      disabled={!state.enabled}
      onClick={() => actions.executeCommand(commandId)}
    >
      <Icon className="tool-icon" aria-hidden="true" />
      <span className="tool-label">{localizedCommandLabel(commandId, snapshot)}</span>
    </button>
  );
}
