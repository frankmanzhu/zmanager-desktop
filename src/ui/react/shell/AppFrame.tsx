import type { ReactNode } from "react";

import { useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { CommandToolbar } from "./CommandToolbar";
import { DropOverlay } from "./DropOverlay";
import { MenuBar } from "./MenuBar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";

const WINDOW_RESIZE_DIRECTIONS = ["North", "East", "South", "West", "NorthEast", "SouthEast", "SouthWest", "NorthWest"] as const;

export type AppFrameProps = Readonly<{
  children?: ReactNode;
  runtimeBridgeReady?: boolean;
}>;

export function AppFrame({ children, runtimeBridgeReady = true }: AppFrameProps) {
  const snapshot = useZManagerSnapshot();

  return (
    <main
      className={workspaceClassName(snapshot)}
      data-job-drawer={snapshot.shell.jobDrawerOpen ? "open" : "closed"}
      data-mode={runtimeBridgeReady ? snapshot.shell.activeMode : undefined}
      data-drop-state={snapshot.shell.dropOverlay.mode}
      data-drop-target={snapshot.shell.dropOverlay.copy?.target}
      data-quick-action-mode={quickActionModeAttribute(snapshot)}
    >
      <TitleBar />
      <WindowResizeHandles />
      <MenuBar />
      <CommandToolbar />
      {children}
      <StatusBar />
      <DropOverlay />
    </main>
  );
}

function quickActionModeAttribute(snapshot: ZManagerReactSnapshot): string | undefined {
  switch (snapshot.shell.quickActionWindow.mode) {
    case "jobOnly":
    case "background":
      return "job-only";
    case "normal":
      return undefined;
  }
}

function WindowResizeHandles() {
  return (
    <>
      {WINDOW_RESIZE_DIRECTIONS.map((direction) => (
        <div
          className={`window-resize-handle window-resize-handle-${direction.toLowerCase()}`}
          data-window-resize-direction={direction}
          aria-hidden="true"
          key={direction}
        />
      ))}
    </>
  );
}

function workspaceClassName(snapshot: ZManagerReactSnapshot): string {
  return [
    "workspace",
    snapshot.preferences.toolbarVisible ? "" : "toolbar-hidden",
  ].filter(Boolean).join(" ");
}
