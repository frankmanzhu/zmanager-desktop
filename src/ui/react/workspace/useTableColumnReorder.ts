import {
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";

const COLUMN_REORDER_THRESHOLD_PX = 5;
const COLUMN_HEADER_SELECTOR = "[data-table-column-id]";

type ColumnReorderGesture<TColumnId extends string> = {
  pointerId: number;
  sourceColumnId: TColumnId;
  startX: number;
  startY: number;
  started: boolean;
  targetColumnId: TColumnId | null;
};

type ColumnReorderState<TColumnId extends string> = Readonly<{
  dropPosition: "after" | "before" | null;
  sourceColumnId: TColumnId;
  targetColumnId: TColumnId | null;
}>;

type ColumnHeaderPointerHandlers = Pick<
  HTMLAttributes<HTMLTableCellElement>,
  | "onClickCapture"
  | "onLostPointerCapture"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
>;

export type TableColumnReorderController<TColumnId extends string> = Readonly<{
  dragState: ColumnReorderState<TColumnId> | null;
  headerPointerHandlers(
    columnId: TColumnId,
    movable: boolean,
  ): ColumnHeaderPointerHandlers;
}>;

export function tableColumnReorderClassName(input: Readonly<{
  dropPosition: "after" | "before" | null;
  isSource: boolean;
  movable: boolean;
}>): string {
  const movableClassName = input.movable
    ? "cursor-grab active:cursor-grabbing"
    : "";
  const sourceClassName = input.isSource
    ? "z-20 scale-[0.98] bg-blue-100/90 text-blue-800 opacity-70 shadow-inner ring-2 ring-inset ring-blue-500/60 dark:bg-blue-950/90 dark:text-blue-200"
    : "";
  const insertionMarkerClassName = input.dropPosition
    ? `z-20 bg-blue-50/90 dark:bg-blue-950/80 before:pointer-events-none before:absolute before:inset-y-0 before:z-30 before:w-1 before:animate-pulse before:rounded-full before:bg-blue-500 before:shadow-[0_0_10px_rgba(59,130,246,0.9)] before:content-[''] ${
        input.dropPosition === "before"
          ? "before:-left-0.5"
          : "before:-right-0.5"
      }`
    : "";
  return `${movableClassName} ${sourceClassName} ${insertionMarkerClassName}`;
}

export function useTableColumnReorder<TColumnId extends string>(
  movableColumnIds: readonly TColumnId[],
  onReorder: (sourceColumnId: TColumnId, targetColumnId: TColumnId) => void,
): TableColumnReorderController<TColumnId> {
  const movableIdsRef = useRef(new Set(movableColumnIds));
  const movableOrderRef = useRef([...movableColumnIds]);
  movableIdsRef.current = new Set(movableColumnIds);
  movableOrderRef.current = [...movableColumnIds];
  const gestureRef = useRef<ColumnReorderGesture<TColumnId> | null>(null);
  const suppressClickRef = useRef(false);
  const [dragState, setDragState] =
    useState<ColumnReorderState<TColumnId> | null>(null);

  const finishGesture = (
    event: ReactPointerEvent<HTMLTableCellElement>,
    commit: boolean,
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    if (!gesture.started) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    if (
      commit &&
      gesture.targetColumnId &&
      gesture.targetColumnId !== gesture.sourceColumnId
    ) {
      onReorder(gesture.sourceColumnId, gesture.targetColumnId);
    }
  };

  return {
    dragState,
    headerPointerHandlers(columnId, movable) {
      return {
        onPointerDown(event) {
          if (
            !movable ||
            event.button !== 0 ||
            (event.target instanceof Element &&
              event.target.closest("[data-column-resizer]"))
          ) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          gestureRef.current = {
            pointerId: event.pointerId,
            sourceColumnId: columnId,
            startX: event.clientX,
            startY: event.clientY,
            started: false,
            targetColumnId: null,
          };
        },
        onPointerMove(event) {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== event.pointerId) return;
          if (
            !gesture.started &&
            Math.hypot(
              event.clientX - gesture.startX,
              event.clientY - gesture.startY,
            ) < COLUMN_REORDER_THRESHOLD_PX
          ) {
            return;
          }

          event.preventDefault();
          gesture.started = true;
          const targetColumnId = columnIdAtPoint<TColumnId>(
            event.clientX,
            event.clientY,
            movableIdsRef.current,
          );
          gesture.targetColumnId =
            targetColumnId === gesture.sourceColumnId ? null : targetColumnId;
          setDragState({
            dropPosition: gesture.targetColumnId
              ? dropPositionForColumns(
                  gesture.sourceColumnId,
                  gesture.targetColumnId,
                  movableOrderRef.current,
                )
              : null,
            sourceColumnId: gesture.sourceColumnId,
            targetColumnId: gesture.targetColumnId,
          });
        },
        onPointerUp(event) {
          finishGesture(event, true);
        },
        onPointerCancel(event) {
          finishGesture(event, false);
        },
        onLostPointerCapture(event) {
          if (gestureRef.current?.pointerId === event.pointerId) {
            gestureRef.current = null;
            setDragState(null);
          }
        },
        onClickCapture(event) {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        },
      };
    },
  };
}

function columnIdAtPoint<TColumnId extends string>(
  x: number,
  y: number,
  movableColumnIds: ReadonlySet<TColumnId>,
): TColumnId | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>(COLUMN_HEADER_SELECTOR);
  const columnId = element?.dataset.tableColumnId as TColumnId | undefined;
  return columnId && movableColumnIds.has(columnId) ? columnId : null;
}

function dropPositionForColumns<TColumnId extends string>(
  sourceColumnId: TColumnId,
  targetColumnId: TColumnId,
  columnOrder: readonly TColumnId[],
): "after" | "before" {
  return columnOrder.indexOf(sourceColumnId) <
    columnOrder.indexOf(targetColumnId)
    ? "after"
    : "before";
}
