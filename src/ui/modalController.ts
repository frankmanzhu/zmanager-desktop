export type ModalControllerOptions = {
  dialogs: () => readonly HTMLElement[];
  fallbackFocus: (dialog: HTMLElement) => HTMLElement | null;
  ignoredReturnFocusRoots?: () => readonly HTMLElement[];
  onClose?: (dialog: HTMLElement) => void;
  activeElement?: () => Element | null;
};

export type ModalDefaultActivationOptions = {
  isDefaultSafeTextEntry?: (dialog: HTMLElement, target: HTMLElement) => boolean;
};

export type ModalController = ReturnType<typeof createModalController>;

export function createModalController(options: ModalControllerOptions) {
  let focusedBeforeDialog: HTMLElement | null = null;

  function currentActiveElement(): Element | null {
    return options.activeElement?.()
      ?? options.dialogs()[0]?.ownerDocument?.activeElement
      ?? (typeof document === "undefined" ? null : document.activeElement);
  }

  function getOpenModal(): HTMLElement | null {
    for (const dialog of options.dialogs()) {
      if (!dialog.hidden) {
        return dialog;
      }
    }
    return null;
  }

  function resolveReturnFocus(dialog: HTMLElement): HTMLElement | null {
    const active = currentActiveElement();
    if (
      isElement(active) &&
      !dialog.contains(active) &&
      !(options.ignoredReturnFocusRoots?.() ?? []).some((root) => root.contains(active)) &&
      isVisibleElement(active)
    ) {
      return active;
    }
    return options.fallbackFocus(dialog);
  }

  function open(dialog: HTMLElement, focusSelector = "button, input, select", returnFocusOverride: HTMLElement | null = null) {
    focusedBeforeDialog = returnFocusOverride ?? resolveReturnFocus(dialog);
    dialog.hidden = false;
    const surface = getDialogSurface(dialog);
    const focusTarget = surface.querySelector<HTMLElement>(focusSelector)
      ?? getFocusableElements(surface, currentActiveElement())[0]
      ?? surface;
    focusTarget.focus();
    focusTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function close(dialog: HTMLElement) {
    dialog.hidden = true;
    options.onClose?.(dialog);
    const restoreTarget = focusedBeforeDialog && isVisibleElement(focusedBeforeDialog)
      ? focusedBeforeDialog
      : options.fallbackFocus(dialog);
    restoreTarget?.focus();
    focusedBeforeDialog = null;
  }

  function trapFocus(event: KeyboardEvent, dialog: HTMLElement) {
    const surface = getDialogSurface(dialog);
    const focusable = getFocusableElements(surface, currentActiveElement());
    if (!focusable.length) {
      event.preventDefault();
      surface.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = currentActiveElement();

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function activateDefault(
    event: KeyboardEvent,
    dialog: HTMLElement,
    activationOptions: ModalDefaultActivationOptions = {},
  ): boolean {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return false;
    }

    const target = eventTargetElement(event.target);
    const isSafeTextEntry = target
      ? activationOptions.isDefaultSafeTextEntry?.(dialog, target) ?? false
      : false;
    if (target?.closest("button, a, summary") || (target && isTextEntryElement(target) && !isSafeTextEntry)) {
      return false;
    }

    const button = dialogButtonFromSelector(dialog, "dialogDefault");
    if (!button || button.disabled || !isVisibleElement(button)) {
      return false;
    }

    event.preventDefault();
    button.click();
    return true;
  }

  function cancel(event: KeyboardEvent, dialog: HTMLElement): boolean {
    const button = dialogButtonFromSelector(dialog, "dialogCancel");
    event.preventDefault();
    if (button && !button.disabled && isVisibleElement(button)) {
      button.click();
    } else {
      close(dialog);
    }
    return true;
  }

  function keepFocusInsideOpenModal(event: FocusEvent) {
    const openDialog = getOpenModal();
    const target = eventTargetElement(event.target);
    if (!openDialog || !target) {
      return;
    }

    if (openDialog.contains(target)) {
      return;
    }

    const surface = getDialogSurface(openDialog);
    const focusTarget = getFocusableElements(surface, currentActiveElement())[0] ?? surface;
    focusTarget.focus();
  }

  return {
    activateDefault,
    cancel,
    close,
    getOpenModal,
    keepFocusInsideOpenModal,
    open,
    trapFocus,
  };
}

export function getFocusableElements(root: HTMLElement, activeElement: Element | null = currentDocumentActiveElement(root)): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "button:not(:disabled)",
        "input:not(:disabled)",
        "select:not(:disabled)",
        "textarea:not(:disabled)",
        "a[href]",
        "summary",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => isVisibleElement(element) || element === activeElement);
}

export function isVisibleElement(element: HTMLElement): boolean {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

export function getDialogSurface(dialog: HTMLElement): HTMLElement {
  return dialog.querySelector<HTMLElement>("[role='dialog']") ?? dialog;
}

export function dialogButtonFromSelector(
  dialog: HTMLElement,
  selectorAttribute: "dialogDefault" | "dialogCancel",
): HTMLButtonElement | null {
  const surface = getDialogSurface(dialog);
  const selector = surface.dataset[selectorAttribute];
  if (selector) {
    return surface.querySelector<HTMLButtonElement>(selector);
  }

  const dataAttribute = selectorAttribute === "dialogDefault"
    ? "[data-dialog-default-button]"
    : "[data-dialog-cancel-button]";
  return surface.querySelector<HTMLButtonElement>(dataAttribute);
}

function currentDocumentActiveElement(root: HTMLElement): Element | null {
  return root.ownerDocument?.activeElement ?? (typeof document === "undefined" ? null : document.activeElement);
}

function eventTargetElement(target: EventTarget | null): HTMLElement | null {
  return isElement(target) ? target : null;
}

function isElement(value: unknown): value is HTMLElement {
  return Boolean(value && typeof value === "object" && "contains" in value && "focus" in value);
}

function isTextEntryElement(element: HTMLElement): boolean {
  const tagName = element.tagName?.toLowerCase();
  return tagName === "textarea" || tagName === "input" || tagName === "select" || element.isContentEditable;
}
