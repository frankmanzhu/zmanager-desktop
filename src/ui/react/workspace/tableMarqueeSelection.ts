import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  applyHierarchicalMarqueeSelection,
  type HierarchicalTableSelectionResult,
} from "../../../app/hierarchicalTable";

const MARQUEE_SELECTION_THRESHOLD_PX = 5;

export type ViewportRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type TableMarqueeSelectionInput = Readonly<{
  event: ReactPointerEvent<HTMLElement>;
  tableBody: HTMLTableSectionElement | null;
  selectedPaths: readonly string[] | ReadonlySet<string>;
  visiblePaths: readonly string[];
  rowSelector: string;
  rowPath(row: HTMLTableRowElement): string | undefined;
  canStart(event: ReactPointerEvent<HTMLElement>): boolean;
  setMarqueeRect(rect: ViewportRect | null): void;
  applySelection(selection: HierarchicalTableSelectionResult): void;
}>;

export type TableMarqueeSelectionGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean;
  additive: boolean;
  baseSelection: Set<string>;
  tableBody: HTMLTableSectionElement;
  input: Omit<
    TableMarqueeSelectionInput,
    "event" | "selectedPaths" | "tableBody"
  >;
};

export function armTableMarqueeSelectionGesture(
  input: TableMarqueeSelectionInput,
  gestureRef: MutableRefObject<TableMarqueeSelectionGesture | null>,
): void {
  const { event, tableBody } = input;
  if (!input.canStart(event) || !tableBody) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  gestureRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    additive: event.ctrlKey || event.metaKey || event.shiftKey,
    baseSelection: new Set(input.selectedPaths),
    tableBody,
    input,
  };
}

export function continueTableMarqueeSelectionGesture(
  event: ReactPointerEvent<HTMLElement>,
  gestureRef: MutableRefObject<TableMarqueeSelectionGesture | null>,
): void {
  const gesture = gestureRef.current;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const rect = viewportRectBetween(
    gesture.startX,
    gesture.startY,
    event.clientX,
    event.clientY,
  );
  if (
    !gesture.started &&
    Math.hypot(rect.width, rect.height) < MARQUEE_SELECTION_THRESHOLD_PX
  )
    return;
  if (!gesture.started) {
    gesture.started = true;
  }
  event.preventDefault();
  gesture.input.setMarqueeRect(rect);
  gesture.input.applySelection(
    applyHierarchicalMarqueeSelection({
      hitPaths: rowPathsInViewportRect(
        gesture.tableBody,
        rect,
        gesture.input.rowSelector,
        gesture.input.rowPath,
      ),
      visiblePaths: gesture.input.visiblePaths,
      baseSelection: gesture.baseSelection,
      additive: gesture.additive,
    }),
  );
}

export function endTableMarqueeSelectionGesture(
  event: ReactPointerEvent<HTMLElement>,
  gestureRef: MutableRefObject<TableMarqueeSelectionGesture | null>,
): boolean {
  const gesture = gestureRef.current;
  if (!gesture || gesture.pointerId !== event.pointerId) return false;
  gestureRef.current = null;
  gesture.input.setMarqueeRect(null);
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return gesture.started;
}

function viewportRectBetween(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): ViewportRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  return { left, top, width: right - left, height: bottom - top };
}

function rowPathsInViewportRect(
  tableBody: HTMLTableSectionElement,
  rect: ViewportRect,
  rowSelector: string,
  rowPath: (row: HTMLTableRowElement) => string | undefined,
): string[] {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const paths: string[] = [];
  for (const row of Array.from(
    tableBody.querySelectorAll<HTMLTableRowElement>(rowSelector),
  )) {
    const rowRect = row.getBoundingClientRect();
    const intersects =
      rowRect.left <= right &&
      rowRect.right >= rect.left &&
      rowRect.top <= bottom &&
      rowRect.bottom >= rect.top;
    const path = rowPath(row);
    if (intersects && path) paths.push(path);
  }
  return paths;
}
