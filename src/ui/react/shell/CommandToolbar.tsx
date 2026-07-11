import {
  ArchiveRestore,
  CheckSquare,
  FileArchive,
  FolderOpen,
  SquareMinus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { createPlanRowInclusionState } from "../../../app/createFlow";
import {
  toolbarGroupsForWorkspaceMode,
  type CommandBarGroup,
  type CommandId,
} from "../../../app/classicCommands";
import type { CommandRouterPayload } from "../../../app/commands/commandRouter";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { useCreatePasswordState } from "../create/CreatePasswordContext";
import { useExtractPasswordState } from "../archive/ExtractPasswordContext";
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
  const toolbarGroups = toolbarGroupsForWorkspaceMode(snapshot.shell.activeMode);
  const className = [
    "command-toolbar",
    "mode-toolbar",
    snapshot.preferences.showToolbarLabels ? "show-labels" : "",
  ].filter(Boolean).join(" ");

  return (
    <header className={className} role="toolbar" aria-label={i18n.t("workspace.toolbar.aria")}>
      <WorkspaceModeTabs />
      <div className="command-strip">
        {snapshot.shell.activeMode === "compress"
          ? <CompressToolbarGroups />
          : <ExtractToolbarGroups groups={toolbarGroups} />}
      </div>
      <div className="toolbar-spacer" />
    </header>
  );
}

function ExtractToolbarGroups({ groups }: Readonly<{ groups: readonly CommandBarGroup[] }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const passwordState = useExtractPasswordState();
  const canExtract = snapshot.archive.command.canUseArchive && Boolean(snapshot.extract.destinationPath.trim());
  const selectedCount = snapshot.archive.view.selection.selectedCount;

  return (
    <>
      <div className="toolbar-group" role="group" aria-label="Extract" data-command-group="extract">
        <span className="toolbar-group-label">Extract</span>
        <ToolbarButton commandId="open" />
        <ToolbarButton commandId="closeArchive" />
        <ToolbarActionButton
          id="extract-all"
          label={i18n.t("extract.allAction")}
          title={canExtract ? i18n.t("extract.allAction") : i18n.t("extract.chooseDestinationFirst")}
          Icon={ArchiveRestore}
          primary={canExtract}
          disabled={!canExtract}
          onClick={() => {
            actions.handleArchiveIntent({ type: "runExtract", mode: "archive", password: passwordState.password });
            passwordState.reset();
          }}
        />
        <ToolbarActionButton
          id="extract-selected"
          label={i18n.t("extract.selectedCountAction", { count: selectedCount })}
          title={selectedCount ? i18n.t("extract.selectedAction") : i18n.t("extract.selectEntryFirst")}
          Icon={ArchiveRestore}
          disabled={!canExtract || selectedCount === 0}
          onClick={() => {
            actions.handleArchiveIntent({ type: "runExtract", mode: "selection", password: passwordState.password });
            passwordState.reset();
          }}
        />
        <ToolbarButton commandId="test" />
      </div>
      {groups.slice(1).map((group) => (
        <ToolbarGroup group={group} key={group.id} showSeparator />
      ))}
    </>
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

function ToolbarGroup({
  group,
  showSeparator,
}: Readonly<{ group: CommandBarGroup; showSeparator: boolean }>) {
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

function CompressToolbarGroups() {
  return (
    <>
      <div className="toolbar-group" role="group" aria-label="Compress" data-command-group="compress">
        <span className="toolbar-group-label">Compress</span>
        <ToolbarButton commandId="add" />
        <CompressDestinationToolbarButton />
        <CreateArchiveToolbarButton />
      </div>
      <div className="toolbar-separator" aria-hidden="true" />
      <div className="toolbar-group" role="group" aria-label="Table actions" data-command-group="table">
        <span className="toolbar-group-label">Table actions</span>
        <CompressTableToolbarButtons />
      </div>
    </>
  );
}

function CompressDestinationToolbarButton() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);

  if (snapshot.shell.activeMode !== "compress") {
    return null;
  }

  return (
    <ToolbarActionButton
      id="browse-create-destination"
      label={i18n.t("compress.outputFolder")}
      title={i18n.t("create.destination.browse.title")}
      Icon={FolderOpen}
      onClick={() => actions.handleCreateIntent({ type: "browseDestination" })}
    />
  );
}

function CreateArchiveToolbarButton() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const createPassword = useCreatePasswordState();
  const canSubmitPassword = snapshot.create.options.password.visible && !snapshot.create.options.password.disabled;
  const canCreate = snapshot.create.options.readiness.canCreate;

  if (snapshot.shell.activeMode !== "compress") {
    return null;
  }

  return (
    <ToolbarActionButton
      id="start-create"
      label={i18n.t("compress.createArchive")}
      title={canCreate ? i18n.t("compress.createArchive") : createToolbarUnavailableText(snapshot)}
      Icon={FileArchive}
      primary={canCreate}
      disabled={!canCreate}
      onClick={() => {
        actions.handleCreateIntent({
          type: "runCreate",
          password: canSubmitPassword ? createPassword.password : "",
          passwordConfirm: canSubmitPassword ? createPassword.passwordConfirm : "",
          signingIdentityPassword: createPassword.signingIdentityPassword,
        });
        createPassword.reset();
      }}
    />
  );
}

function CompressTableToolbarButtons() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const create = snapshot.create;
  const tableInclusion = compressTableInclusionSummary(snapshot);

  if (snapshot.shell.activeMode !== "compress") {
    return null;
  }

  return (
    <>
      <ToolbarActionButton
        id="include-all-sources"
        label={i18n.t("compress.includeAll")}
        title={i18n.t("compress.includeAll")}
        Icon={CheckSquare}
        disabled={!tableInclusion.canInclude}
        onClick={() => actions.handleCreateIntent({ type: "setVisibleRowsIncluded", included: true })}
      />
      <ToolbarActionButton
        id="exclude-all-sources"
        label={i18n.t("compress.excludeAll")}
        title={i18n.t("compress.excludeAll")}
        Icon={SquareMinus}
        disabled={!tableInclusion.canExclude}
        onClick={() => actions.handleCreateIntent({ type: "setVisibleRowsIncluded", included: false })}
      />
      <ToolbarActionButton
        id="clear-sources"
        label={i18n.t("command.clearAllSources")}
        title={i18n.t("command.clearAllSources")}
        Icon={Trash2}
        disabled={create.isEmpty}
        onClick={() => actions.handleCreateIntent({ type: "clearSources" })}
      />
    </>
  );
}

function compressTableInclusionSummary(snapshot: ZManagerReactSnapshot): Readonly<{
  canInclude: boolean;
  canExclude: boolean;
}> {
  const currentPlan = snapshot.create.plan.current;
  const visibleRows = snapshot.create.view.rows.filter((row) => row.rowType !== "parent");
  if (!currentPlan || visibleRows.length === 0) {
    return { canInclude: false, canExclude: false };
  }

  let canInclude = false;
  let canExclude = false;
  for (const row of visibleRows) {
    const inclusion = createPlanRowInclusionState(
      row,
      currentPlan.planEntries,
      snapshot.create.inclusion.excludedArchivePaths,
    );
    if (inclusion !== "included") {
      canInclude = true;
    }
    if (inclusion !== "excluded") {
      canExclude = true;
    }
  }

  return { canInclude, canExclude };
}

function ToolbarActionButton({
  disabled,
  Icon,
  id,
  label,
  onClick,
  primary,
  title,
}: Readonly<{
  disabled?: boolean;
  Icon: LucideIcon;
  id: string;
  label: string;
  onClick(): void;
  primary?: boolean;
  title?: string;
}>) {
  const className = [
    "tool-button",
    primary ? "is-primary-command" : "",
  ].filter(Boolean).join(" ");

  return (
    <Button
      id={id}
      variant="toolbar"
      size="unset"
      className={className}
      type="button"
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      onClick={onClick}
    >
      <Icon className="tool-icon" aria-hidden="true" />
      <span className="tool-label">{label}</span>
    </Button>
  );
}

function ToolbarButton({ commandId }: Readonly<{ commandId: CommandId }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const state = commandStateFor(snapshot.commands.states, commandId);
  const Icon = commandIcon(commandId);
  const primary = snapshot.commands.primaryCommandIds.includes(commandId);
  const secondary = snapshot.commands.secondaryCommandIds.includes(commandId);
  const pressed = snapshot.commands.pressed[commandId];
  const label = toolbarCommandLabel(commandId, snapshot);
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
      aria-label={label}
      title={state.reason && !state.enabled ? state.reason : localizedCommandTooltip(commandId, snapshot)}
      aria-keyshortcuts={commandShortcut(commandId)}
      aria-disabled={!state.enabled}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      disabled={!state.enabled}
      onClick={(event) => actions.executeCommand(commandId, toolbarCommandPayload(commandId, event.currentTarget))}
    >
      <Icon className="tool-icon" aria-hidden="true" />
      <span className="tool-label">{label}</span>
    </Button>
  );
}

function toolbarCommandLabel(commandId: CommandId, snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);

  if (snapshot.shell.activeMode === "extract") {
    if (commandId === "open") {
      return i18n.t("commands.openArchive");
    }

    if (commandId === "extract") {
      return i18n.t("extract.allAction");
    }
  }

  if (snapshot.shell.activeMode === "compress" && commandId === "add") {
    return i18n.t("compress.addSources");
  }

  return localizedCommandLabel(commandId, snapshot);
}

function createToolbarUnavailableText(snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);
  const reason = snapshot.create.options.readiness.unavailableReason;

  switch (reason) {
    case "needsSources":
      return i18n.t("create.status.needsSources");
    case "needsIncludedEntries":
      return i18n.t("create.status.needsIncludedEntries");
    case "needsDestination":
      return i18n.t("create.status.needsDestination");
    case "planning":
      return i18n.t("create.status.planning");
    case "starting":
      return i18n.t("create.status.starting");
    case "needsPlan":
      return i18n.t("create.status.needsPlan");
    case null:
      return i18n.t("compress.createArchive");
  }
}

function toolbarCommandPayload(commandId: CommandId, button: HTMLElement): CommandRouterPayload | undefined {
  if (commandId === "add") {
    const rect = button.getBoundingClientRect();

    return {
      addSourcesMenuAnchor: {
        x: rect.left,
        y: rect.bottom + 4,
      },
    };
  }

  if (commandId === "extract") {
    return { extractMode: "archive" };
  }

  return undefined;
}
