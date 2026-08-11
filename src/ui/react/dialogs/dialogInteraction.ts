const OWNED_SCROLL_REGION_SELECTOR =
  "[data-dialog-content], [data-workspace-content]";

export function firstInvalidControl(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    '[aria-invalid="true"]:not([disabled])',
  );
}

export function revealFirstInvalidControl(root: HTMLElement): HTMLElement | null {
  const control = firstInvalidControl(root);
  if (!control) {
    return null;
  }

  control.focus({ preventScroll: true });
  scrollControlIntoOwnedRegion(control);
  return control;
}

export function scrollFirstInvalidControl(root: HTMLElement): HTMLElement | null {
  const control = firstInvalidControl(root);
  if (!control) {
    return null;
  }

  scrollControlIntoOwnedRegion(control);
  return control;
}

export function scrollControlIntoOwnedRegion(control: HTMLElement): void {
  const region = control.closest<HTMLElement>(OWNED_SCROLL_REGION_SELECTOR);
  if (!region) {
    return;
  }

  const controlRect = control.getBoundingClientRect();
  const regionRect = region.getBoundingClientRect();
  const topOverflow = controlRect.top - regionRect.top;
  const bottomOverflow = controlRect.bottom - regionRect.bottom;
  const delta = topOverflow < 0 ? topOverflow : bottomOverflow > 0 ? bottomOverflow : 0;
  if (!delta) {
    return;
  }

  region.scrollTop += delta;
}
