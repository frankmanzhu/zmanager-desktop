import type { ReactNode } from "react";

import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type {
  ZManagerReactSnapshot,
  ZManagerWindowResizeDirection,
} from "../appRuntime";
import { CommandToolbar } from "./CommandToolbar";
import { MenuBar } from "./MenuBar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";

const WINDOW_RESIZE_DIRECTIONS = [
  "North",
  "East",
  "South",
  "West",
  "NorthEast",
  "SouthEast",
  "SouthWest",
  "NorthWest",
] as const satisfies readonly ZManagerWindowResizeDirection[];

export type AppFrameProps = Readonly<{
  children?: ReactNode;
  runtimeBridgeReady?: boolean;
}>;

export function AppFrame({
  children,
  runtimeBridgeReady = true,
}: AppFrameProps) {
  const snapshot = useZManagerSnapshot();

  return (
    <main
      className="flex h-screen min-h-screen min-w-[320px] flex-col overflow-hidden bg-slate-100 text-[13px] leading-[1.35] text-slate-950 [font-family:'Segoe_UI',system-ui,-apple-system,BlinkMacSystemFont,Ubuntu,Cantarell,'Noto_Sans',Arial,sans-serif] dark:bg-slate-950 dark:text-slate-50"
      data-mode={runtimeBridgeReady ? snapshot.shell.activeMode : undefined}
      data-drop-state={snapshot.shell.dropOverlay.mode}
      data-drop-target={snapshot.shell.dropOverlay.copy?.target}
    >
      <TitleBar />
      <WindowResizeHandles />
      <MenuBar />
      <CommandToolbar />
      {children}
      <StatusBar />
    </main>
  );
}

function WindowResizeHandles() {
  const actions = useZManagerActions();

  return (
    <>
      {WINDOW_RESIZE_DIRECTIONS.map((direction) => (
        <div
          className={windowResizeHandleClass(direction)}
          data-window-resize-direction={direction}
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.preventDefault();
            actions.handleDesktopIntent({
              type: "beginWindowResize",
              direction,
            });
          }}
          key={direction}
        />
      ))}
    </>
  );
}

function windowResizeHandleClass(
  direction: ZManagerWindowResizeDirection,
): string {
  const base = "fixed z-[1000] hidden [body.manual-window-resize_&]:block";
  const directions: Record<ZManagerWindowResizeDirection, string> = {
    North: "inset-x-3 top-0 h-1.5 cursor-ns-resize",
    East: "inset-y-3 right-0 w-1.5 cursor-ew-resize",
    South: "inset-x-3 bottom-0 h-1.5 cursor-ns-resize",
    West: "inset-y-3 left-0 w-1.5 cursor-ew-resize",
    NorthEast: "right-0 top-0 size-3 cursor-nesw-resize",
    SouthEast: "bottom-0 right-0 size-3 cursor-nwse-resize",
    SouthWest: "bottom-0 left-0 size-3 cursor-nesw-resize",
    NorthWest: "left-0 top-0 size-3 cursor-nwse-resize",
  };
  return `${base} ${directions[direction]}`;
}
