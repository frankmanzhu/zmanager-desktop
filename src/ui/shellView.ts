import type {
  DropOverlayMessageParams,
  DropOverlaySnapshot,
} from "../app/shell/shellWorkspace";
import type { MessageKey } from "../app/i18n/translator";

export type ShellViewMessage = (key: MessageKey, params?: DropOverlayMessageParams) => string;

export type ShellViewElements = {
  workspace: HTMLElement;
  dropOverlay: HTMLElement;
  dropOverlayCard: HTMLElement;
  dropOverlayTitle: HTMLElement;
  dropOverlayMessage: HTMLElement;
  dropOverlaySupport: HTMLElement;
  dropOverlayActions: HTMLElement;
  dropOpenArchiveButton: HTMLButtonElement;
};

export type DropOverlayAction = "openArchive" | "addToCompress" | "cancel";

export type DropOverlayActionHandlers = {
  onChoice: (action: DropOverlayAction) => void;
};

export function renderDropOverlay(
  elements: ShellViewElements,
  snapshot: DropOverlaySnapshot,
  message: ShellViewMessage,
): void {
  const { mode, copy } = snapshot;
  elements.workspace.dataset.dropState = mode;
  if (copy?.target) {
    elements.workspace.dataset.dropTarget = copy.target;
  } else {
    delete elements.workspace.dataset.dropTarget;
  }

  const visible = mode !== "idle";
  elements.dropOverlay.setAttribute("aria-hidden", visible ? "false" : "true");
  elements.dropOverlayTitle.textContent = copy ? message(copy.titleKey) : message("drop.title");
  elements.dropOverlayMessage.textContent = copy
    ? message(copy.messageKey, copy.messageParams)
    : message("drop.defaultMessage");

  const supportText = copy?.supportKey ? message(copy.supportKey) : "";
  elements.dropOverlaySupport.textContent = supportText;
  elements.dropOverlaySupport.hidden = !supportText;
  elements.dropOverlayActions.hidden = !copy?.showActions;
  elements.dropOverlayCard.setAttribute("role", copy?.showActions ? "dialog" : "status");
  if (copy?.showActions) {
    elements.dropOverlayCard.setAttribute("aria-modal", "false");
  } else {
    elements.dropOverlayCard.removeAttribute("aria-modal");
  }
}

export function bindDropOverlayActions(
  elements: ShellViewElements,
  handlers: DropOverlayActionHandlers,
): () => void {
  const onClick = (event: MouseEvent) => {
    const action = dropOverlayActionFromEventTarget(event.target);
    if (!action) {
      return;
    }

    event.preventDefault();
    handlers.onChoice(action);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    handlers.onChoice("cancel");
  };

  elements.dropOverlayActions.addEventListener("click", onClick);
  elements.dropOverlay.addEventListener("keydown", onKeydown);

  return () => {
    elements.dropOverlayActions.removeEventListener("click", onClick);
    elements.dropOverlay.removeEventListener("keydown", onKeydown);
  };
}

export function focusDropOverlayPrimaryAction(elements: ShellViewElements): void {
  elements.dropOpenArchiveButton.focus();
}

export function dropOverlayActionFromChoice(choice: string | undefined): DropOverlayAction | null {
  switch (choice) {
    case "open-archive":
      return "openArchive";
    case "add-compress":
      return "addToCompress";
    case "cancel":
      return "cancel";
    default:
      return null;
  }
}

type ClosestElement = {
  closest: (selector: string) => { dataset?: Record<string, string | undefined> } | null;
};

function dropOverlayActionFromEventTarget(target: EventTarget | null): DropOverlayAction | null {
  if (!target || typeof (target as Partial<ClosestElement>).closest !== "function") {
    return null;
  }

  const button = (target as unknown as ClosestElement).closest("[data-drop-choice]");
  return dropOverlayActionFromChoice(button?.dataset?.dropChoice);
}
