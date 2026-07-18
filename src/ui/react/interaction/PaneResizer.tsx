import {
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  APP_DETAILS_PANE_MAX_WIDTH_PX,
  APP_DETAILS_PANE_MIN_WIDTH_PX,
  APP_NAV_PANE_MAX_WIDTH_PX,
  APP_NAV_PANE_MIN_WIDTH_PX,
} from "../../../app/constants";
import {
  useResizablePaneLayout,
  type ResizablePane,
} from "./ResizablePaneContext";

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
  const dragRef = useRef<PaneResizeDrag | null>(null);
  const layout = useResizablePaneLayout();
  const width =
    pane === "navigation" ? layout.navigationWidth : layout.detailsWidth;

  return (
    <div
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent outline-none max-[760px]:hidden focus-visible:bg-blue-500/20"
      data-pane-resizer={pane}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={Math.round(width)}
      onPointerDown={(event) => startPaneResize(event, width, dragRef)}
      onPointerMove={(event) =>
        continuePaneResize(event, pane, layout.setWidth, dragRef)
      }
      onPointerUp={(event) => endPaneResize(event, dragRef)}
      onPointerCancel={(event) => endPaneResize(event, dragRef)}
      onKeyDown={(event) =>
        resizePaneByKeyboard(event.nativeEvent, pane, width, layout.setWidth)
      }
    >
      <span
        className="pointer-events-none absolute inset-y-1/2 left-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 group-hover:bg-blue-500 dark:bg-slate-700"
        aria-hidden="true"
      />
    </div>
  );
}

function paneWidthBounds(pane: ResizablePane): { min: number; max: number } {
  return pane === "navigation"
    ? { min: APP_NAV_PANE_MIN_WIDTH_PX, max: APP_NAV_PANE_MAX_WIDTH_PX }
    : {
        min: APP_DETAILS_PANE_MIN_WIDTH_PX,
        max: APP_DETAILS_PANE_MAX_WIDTH_PX,
      };
}

function clampResizablePaneWidth(pane: ResizablePane, width: number): number {
  const { min, max } = paneWidthBounds(pane);
  return Math.max(min, Math.min(width, max));
}

type PaneResizeDrag = Readonly<{
  pointerId: number;
  startWidth: number;
  startX: number;
}>;

function startPaneResize(
  event: ReactPointerEvent<HTMLElement>,
  width: number,
  dragRef: MutableRefObject<PaneResizeDrag | null>,
) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  dragRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: width,
  };
}

function continuePaneResize(
  event: ReactPointerEvent<HTMLElement>,
  pane: ResizablePane,
  setWidth: (pane: ResizablePane, width: number) => void,
  dragRef: MutableRefObject<PaneResizeDrag | null>,
) {
  const drag = dragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const delta = event.clientX - drag.startX;
  setWidth(
    pane,
    clampResizablePaneWidth(
      pane,
      pane === "navigation" ? drag.startWidth + delta : drag.startWidth - delta,
    ),
  );
}

function endPaneResize(
  event: ReactPointerEvent<HTMLElement>,
  dragRef: MutableRefObject<PaneResizeDrag | null>,
) {
  if (dragRef.current?.pointerId !== event.pointerId) return;
  dragRef.current = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function resizePaneByKeyboard(
  event: KeyboardEvent,
  pane: ResizablePane,
  currentWidth: number,
  setWidth: (pane: ResizablePane, width: number) => void,
) {
  const { min, max } = paneWidthBounds(pane);
  const step = event.shiftKey
    ? PANE_RESIZE_KEYBOARD_LARGE_STEP_PX
    : PANE_RESIZE_KEYBOARD_STEP_PX;
  let nextWidth: number | null = null;

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    nextWidth =
      pane === "navigation" ? currentWidth - step : currentWidth + step;
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    nextWidth =
      pane === "navigation" ? currentWidth + step : currentWidth - step;
  } else if (event.key === "Home") {
    nextWidth = min;
  } else if (event.key === "End") {
    nextWidth = max;
  }

  if (nextWidth === null) return;
  event.preventDefault();
  event.stopPropagation();
  setWidth(pane, clampResizablePaneWidth(pane, nextWidth));
}
