import type {
  CommandDefinition,
  CommandId,
  CommandStateMap,
  MenuGroup,
} from "../app/classicCommands";
import type { MessageKey } from "../app/i18n/translator";

export type CommandSurfaceRoot = Pick<ParentNode, "querySelectorAll"> & Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export type CommandSurfaceDefinitions = Record<CommandId, Pick<CommandDefinition, "unsupported">>;

export type CommandSurfaceBindOptions = {
  commandDefinitions: CommandSurfaceDefinitions;
  onCommand: (commandId: CommandId) => void;
  onMenuPopoverCommand?: () => void;
};

export type CommandSurfaceTextOptions = {
  commandDefinitions: CommandSurfaceDefinitions;
  commandLabel: (commandId: CommandId) => string;
  commandTooltip: (commandId: CommandId) => string;
  menuGroupLabel: (label: MenuGroup["label"]) => string;
  submenuLabel: (key: MessageKey) => string;
};

export type CommandSurfacePressedState = Partial<Record<CommandId, boolean>>;

export type CommandSurfaceClassState = Partial<Record<CommandId, {
  primary?: boolean;
  secondary?: boolean;
}>>;

export type CommandSurfaceStateOptions = {
  commandDefinitions: CommandSurfaceDefinitions;
  commandState: CommandStateMap;
  commandTooltip: (commandId: CommandId) => string;
  commandStateReason: (reason?: string) => string | undefined;
  pressedState?: CommandSurfacePressedState;
  classState?: CommandSurfaceClassState;
};

export function bindCommandSurface(
  root: CommandSurfaceRoot,
  options: CommandSurfaceBindOptions,
): () => void {
  const onClick = (event: Event) => {
    const button = closestElement<HTMLButtonElement>(event.target, "[data-command-id]");
    const commandId = knownCommandId(button?.dataset.commandId, options.commandDefinitions);
    if (!button || !commandId) {
      return;
    }

    event.preventDefault();
    options.onCommand(commandId);
    if (button.closest(".menu-popover")) {
      options.onMenuPopoverCommand?.();
    }
  };

  root.addEventListener("click", onClick);

  return () => {
    root.removeEventListener("click", onClick);
  };
}

export function refreshCommandSurfaceText(
  root: CommandSurfaceRoot,
  options: CommandSurfaceTextOptions,
): void {
  for (const summary of root.querySelectorAll<HTMLElement>("[data-menu-group-label]")) {
    const label = summary.dataset.menuGroupLabel as MenuGroup["label"] | undefined;
    if (label) {
      summary.textContent = options.menuGroupLabel(label);
    }
  }

  for (const submenu of root.querySelectorAll<HTMLElement>("[data-command-submenu-label]")) {
    const key = submenu.dataset.commandSubmenuLabel as MessageKey | undefined;
    if (key) {
      submenu.textContent = options.submenuLabel(key);
    }
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-command-id]")) {
    const commandId = knownCommandId(button.dataset.commandId, options.commandDefinitions);
    if (!commandId) {
      continue;
    }

    const label = options.commandLabel(commandId);
    const textElement = button.querySelector<HTMLElement>(".tool-label, .context-menu-label")
      ?? button.querySelector<HTMLElement>("span:not(.sort-indicator)");
    if (textElement) {
      textElement.textContent = label;
    } else if (!button.querySelector("svg")) {
      button.textContent = label;
    }
    button.setAttribute("aria-label", label);
    button.title = options.commandTooltip(commandId);
  }
}

export function applyCommandSurfaceState(
  root: CommandSurfaceRoot,
  options: CommandSurfaceStateOptions,
): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-command-id]")) {
    const commandId = knownCommandId(button.dataset.commandId, options.commandDefinitions);
    if (!commandId) {
      continue;
    }

    const state = options.commandState[commandId];
    const command = options.commandDefinitions[commandId];
    button.disabled = !state.enabled;
    button.title = options.commandStateReason(state.reason) ?? options.commandTooltip(commandId);
    button.setAttribute("aria-disabled", String(!state.enabled));

    const pressedState = options.pressedState;
    if (pressedState && hasOwn(pressedState, commandId)) {
      button.setAttribute("aria-pressed", String(pressedState[commandId]));
    } else {
      button.removeAttribute("aria-pressed");
    }

    if (command.unsupported && !state.enabled) {
      button.dataset.unsupported = "true";
    } else {
      delete button.dataset.unsupported;
    }

    const classState = options.classState?.[commandId];
    button.classList.toggle("is-primary-command", Boolean(classState?.primary));
    button.classList.toggle("is-secondary-command", Boolean(classState?.secondary));
  }
}

function knownCommandId(
  value: string | undefined,
  commandDefinitions: CommandSurfaceDefinitions,
): CommandId | null {
  if (!value || !hasOwn(commandDefinitions, value)) {
    return null;
  }

  return value as CommandId;
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

function hasOwn<T extends object>(object: T | undefined, key: PropertyKey): boolean {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}
