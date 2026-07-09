import {
  APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  APP_DETAILS_PANE_MAX_WIDTH_PX,
  APP_DETAILS_PANE_MIN_WIDTH_PX,
  APP_NAV_PANE_DEFAULT_WIDTH_PX,
  APP_NAV_PANE_MAX_WIDTH_PX,
  APP_NAV_PANE_MIN_WIDTH_PX,
} from "../../../app/constants";

type ResizablePane = "navigation" | "details";

const PANE_RESIZE_CENTER_MIN_WIDTH_PX = 360;
const PANE_RESIZE_GUTTER_TOTAL_PX = 10;
const PANE_RESIZE_KEYBOARD_STEP_PX = 16;
const PANE_RESIZE_KEYBOARD_LARGE_STEP_PX = 48;

export function PaneResizer({
  controls,
  label,
  pane,
}: Readonly<{
  controls: string;
  label: string;
  pane: ResizablePane;
}>) {
  const bounds = paneWidthBounds(pane);

  return (
    <div
      className="pane-resizer"
      data-pane-resizer={pane}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      onPointerDown={(event) => startPaneResize(event.currentTarget, event.nativeEvent, pane)}
      onKeyDown={(event) => resizePaneByKeyboard(event.currentTarget, event.nativeEvent, pane)}
    >
      <span className="pane-resizer-grip" aria-hidden="true" />
    </div>
  );
}

function paneWidthBounds(pane: ResizablePane): { min: number; max: number } {
  return pane === "navigation"
    ? { min: APP_NAV_PANE_MIN_WIDTH_PX, max: APP_NAV_PANE_MAX_WIDTH_PX }
    : { min: APP_DETAILS_PANE_MIN_WIDTH_PX, max: APP_DETAILS_PANE_MAX_WIDTH_PX };
}

function paneDefaultWidth(pane: ResizablePane): number {
  return pane === "navigation" ? APP_NAV_PANE_DEFAULT_WIDTH_PX : APP_DETAILS_PANE_DEFAULT_WIDTH_PX;
}

function paneCssVariable(pane: ResizablePane): string {
  return pane === "navigation" ? "--zmanager-nav-pane-width" : "--zmanager-details-pane-width";
}

function paneElements(resizer: HTMLElement): {
  browserShell: HTMLElement;
  detailsPane: HTMLElement;
  navigationPane: HTMLElement;
} | null {
  const browserShell = resizer.closest<HTMLElement>(".browser-shell");
  const navigationPane = browserShell?.querySelector<HTMLElement>("#navigation-pane") ?? null;
  const detailsPane = browserShell?.querySelector<HTMLElement>("#details-pane") ?? null;
  if (!browserShell || !navigationPane || !detailsPane) {
    return null;
  }

  return { browserShell, detailsPane, navigationPane };
}

function paneElementForResize(resizer: HTMLElement, pane: ResizablePane): HTMLElement | null {
  const elements = paneElements(resizer);
  if (!elements) {
    return null;
  }

  return pane === "navigation" ? elements.navigationPane : elements.detailsPane;
}

function currentResizablePaneWidth(resizer: HTMLElement, pane: ResizablePane): number {
  const width = paneElementForResize(resizer, pane)?.getBoundingClientRect().width ?? 0;
  return width > 0 ? width : paneDefaultWidth(pane);
}

function setResizablePaneWidth(resizer: HTMLElement, pane: ResizablePane, width: number): number {
  const elements = paneElements(resizer);
  const { min, max } = paneWidthBounds(pane);
  if (!elements) {
    return Math.max(min, Math.min(width, max));
  }

  const shellWidth = elements.browserShell.getBoundingClientRect().width;
  const otherPaneWidth = pane === "navigation"
    ? elements.detailsPane.getBoundingClientRect().width
    : elements.navigationPane.getBoundingClientRect().width;
  const maxWidthFromShell = shellWidth - otherPaneWidth - PANE_RESIZE_CENTER_MIN_WIDTH_PX - PANE_RESIZE_GUTTER_TOTAL_PX;
  const nextWidth = Math.max(min, Math.min(width, max, Math.max(min, maxWidthFromShell)));
  document.documentElement.style.setProperty(paneCssVariable(pane), `${Math.round(nextWidth)}px`);
  resizer.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
  return nextWidth;
}

function startPaneResize(resizer: HTMLElement, event: PointerEvent, pane: ResizablePane) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add("is-resizing-pane");

  const startX = event.clientX;
  const startWidth = currentResizablePaneWidth(resizer, pane);

  const onPointerMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX;
    setResizablePaneWidth(resizer, pane, pane === "navigation" ? startWidth + delta : startWidth - delta);
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-pane");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
}

function resizePaneByKeyboard(resizer: HTMLElement, event: KeyboardEvent, pane: ResizablePane) {
  const { min, max } = paneWidthBounds(pane);
  const currentWidth = currentResizablePaneWidth(resizer, pane);
  const step = event.shiftKey ? PANE_RESIZE_KEYBOARD_LARGE_STEP_PX : PANE_RESIZE_KEYBOARD_STEP_PX;
  let nextWidth: number | null = null;

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    nextWidth = pane === "navigation" ? currentWidth - step : currentWidth + step;
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    nextWidth = pane === "navigation" ? currentWidth + step : currentWidth - step;
  } else if (event.key === "Home") {
    nextWidth = min;
  } else if (event.key === "End") {
    nextWidth = max;
  }

  if (nextWidth === null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  setResizablePaneWidth(resizer, pane, nextWidth);
}
