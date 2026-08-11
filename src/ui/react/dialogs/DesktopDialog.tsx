import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "../../../lib/utils";
import {
  revealFirstInvalidControl,
  scrollFirstInvalidControl,
} from "./dialogInteraction";

export type DesktopDialogProps = Readonly<{
  titleId: string;
  descriptionId?: string;
  widthClassName?: string;
  minHeightClassName?: string;
  surfaceClassName?: string;
  contentClassName?: string;
  header: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
  onEscape(): void;
  focusFirstInvalidControl?: boolean;
  revealFirstInvalidControl?: boolean;
}>;

/**
 * Shared modal contract for the Desktop Shell.
 *
 * The surface is an intrinsic-height flex column capped by the viewport. The
 * content slot is the only normal application-owned scroll region; callers
 * keep headers and footers outside it.
 */
export function DesktopDialog({
  titleId,
  descriptionId,
  widthClassName = "w-[min(720px,calc(100vw-48px))]",
  minHeightClassName,
  surfaceClassName,
  contentClassName,
  header,
  content,
  footer,
  onEscape,
  focusFirstInvalidControl = false,
  revealFirstInvalidControl: shouldRevealFirstInvalidControl = false,
}: DesktopDialogProps) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !surfaceRef.current?.contains(activeElement)) {
      returnFocusRef.current = activeElement;
    }

    surfaceRef.current?.focus();
    const frame = window.requestAnimationFrame(() => surfaceRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      const returnFocusTarget = returnFocusRef.current;
      const closedMenuSummary = returnFocusTarget
        ?.closest("details:not([open])")
        ?.querySelector<HTMLElement>("summary");
      const target = returnFocusTarget?.isConnected &&
        !returnFocusTarget.closest("[hidden], #context-menu, details:not([open])")
        ? returnFocusTarget
        : closedMenuSummary?.isConnected
          ? closedMenuSummary
          : null;
      if (!target) {
        return;
      }
      window.requestAnimationFrame(() => target.focus());
    };
  }, []);

  useEffect(() => {
    if (focusFirstInvalidControl && surfaceRef.current) {
      revealFirstInvalidControl(surfaceRef.current);
    } else if (shouldRevealFirstInvalidControl && surfaceRef.current) {
      scrollFirstInvalidControl(surfaceRef.current);
    }
  }, [focusFirstInvalidControl, shouldRevealFirstInvalidControl]);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-6 backdrop-blur-[2px]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
        }
      }}
    >
      <section
        ref={surfaceRef}
        data-dialog-surface
        className={cn(
          "flex max-h-[calc(100vh-48px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50",
          widthClassName,
          minHeightClassName,
          surfaceClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="shrink-0">{header}</header>
        <div
          data-dialog-content
          className={cn("min-h-0 flex-1 overflow-y-auto", contentClassName)}
        >
          {content}
        </div>
        {footer ? <footer className="shrink-0">{footer}</footer> : null}
      </section>
    </div>
  );
}
