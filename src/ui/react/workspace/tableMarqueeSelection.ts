import type { PointerEvent as ReactPointerEvent } from "react";

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

export function armTableMarqueeSelectionGesture(input: TableMarqueeSelectionInput): void {
  const { event, tableBody, setMarqueeRect } = input;
  if (!input.canStart(event) || !tableBody) {
    return;
  }

  event.preventDefault();
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const additive = event.ctrlKey || event.metaKey || event.shiftKey;
  const baseSelection = new Set(input.selectedPaths);
  let started = false;

  const onPointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    const rect = viewportRectBetween(startX, startY, moveEvent.clientX, moveEvent.clientY);
    if (!started && Math.hypot(rect.width, rect.height) < MARQUEE_SELECTION_THRESHOLD_PX) {
      return;
    }

    if (!started) {
      started = true;
      document.body.classList.add("is-marquee-selecting");
      document.addEventListener("click", suppressMarqueeClick, { capture: true, once: true });
    }

    moveEvent.preventDefault();
    setMarqueeRect(rect);
    input.applySelection(applyHierarchicalMarqueeSelection({
      hitPaths: rowPathsInViewportRect(tableBody, rect, input.rowSelector, input.rowPath),
      visiblePaths: input.visiblePaths,
      baseSelection,
      additive,
    }));
  };

  const onPointerEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId !== pointerId) {
      return;
    }

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerEnd);
    document.removeEventListener("pointercancel", onPointerEnd);
    document.body.classList.remove("is-marquee-selecting");
    setMarqueeRect(null);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerEnd);
  document.addEventListener("pointercancel", onPointerEnd);
}

function viewportRectBetween(startX: number, startY: number, endX: number, endY: number): ViewportRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
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
  for (const row of Array.from(tableBody.querySelectorAll<HTMLTableRowElement>(rowSelector))) {
    const rowRect = row.getBoundingClientRect();
    const intersects = rowRect.left <= right
      && rowRect.right >= rect.left
      && rowRect.top <= bottom
      && rowRect.bottom >= rect.top;
    const path = rowPath(row);
    if (intersects && path) {
      paths.push(path);
    }
  }
  return paths;
}

function suppressMarqueeClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}
