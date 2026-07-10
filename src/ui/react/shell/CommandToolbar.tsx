import { FolderOpen } from "lucide-react";

import { CLASSIC_TOOLBAR_GROUPS } from "../../../app/classicCommands";
import { Button } from "../../components/ui/button";
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
      <Button
        id="mode-compress"
        variant="mode"
        size="unset"
        className={`mode-button${isCompress ? " is-active" : ""}`}
        type="button"
        role="tab"
        data-workspace-mode="compress"
        aria-selected={isCompress}
        onClick={() => actions.setWorkspaceMode("compress")}
      >
        {i18n.t("workspace.mode.compress")}
      </Button>
      <Button
        id="mode-extract"
        variant="mode"
        size="unset"
        className={`mode-button${!isCompress ? " is-active" : ""}`}
        type="button"
        role="tab"
        data-workspace-mode="extract"
        aria-selected={!isCompress}
        onClick={() => actions.setWorkspaceMode("extract")}
      >
        {i18n.t("workspace.mode.extract")}
      </Button>
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
        {group.id === "compress" ? <CompressDestinationToolbarControls /> : null}
      </div>
    </>
  );
}

function CompressDestinationToolbarControls() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const history = snapshot.pathHistory.createDestinationHistory;

  if (snapshot.shell.activeMode !== "compress") {
    return null;
  }

  return (
    <>
      <Button
        id="browse-create-destination"
        variant="toolbar"
        size="unset"
        className="tool-button"
        type="button"
        title={i18n.t("create.destination.browse.title")}
        onClick={() => actions.handleCreateIntent({ type: "browseDestination" })}
      >
        <FolderOpen className="tool-icon" aria-hidden="true" />
        <span className="tool-label">{i18n.t("common.browse")}</span>
      </Button>
      <select
        id="create-destination-recent"
        className="toolbar-select recent-location-select"
        aria-label={i18n.t("create.destination.recent.aria")}
        title={i18n.t("create.destination.recent.title")}
        disabled={!history.length}
        value=""
        onChange={(event) => {
          const destinationPath = event.currentTarget.value;
          if (destinationPath) {
            actions.handleCreateIntent({ type: "setDestinationPath", destinationPath });
          }
        }}
      >
        <option value="">{i18n.t("create.destination.recent")}</option>
        {history.map((entry) => (
          <option value={entry} key={entry}>{entry}</option>
        ))}
      </select>
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
    <Button
      id={commandButtonId(commandId)}
      variant="toolbar"
      size="unset"
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
    </Button>
  );
}
