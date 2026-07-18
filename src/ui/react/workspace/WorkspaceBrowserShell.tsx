import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import { PaneResizer } from "../interaction/PaneResizer";
import { DropOverlay } from "../shell/DropOverlay";
import {
  ResizablePaneProvider,
  resizablePaneWidthClass,
  useResizablePaneLayout,
} from "../interaction/ResizablePaneContext";

export type WorkspaceBrowserShellProps = Readonly<{
  ariaLabel: string;
  navigation: ReactNode;
  table: ReactNode;
  sidePane: ReactNode;
}>;

export function WorkspaceBrowserShell({
  ariaLabel,
  navigation,
  table,
  sidePane,
}: WorkspaceBrowserShellProps) {
  return (
    <ResizablePaneProvider>
      <WorkspaceBrowserLayout
        ariaLabel={ariaLabel}
        navigation={navigation}
        table={table}
        sidePane={sidePane}
      />
    </ResizablePaneProvider>
  );
}

function WorkspaceBrowserLayout({
  ariaLabel,
  navigation,
  sidePane,
  table,
}: WorkspaceBrowserShellProps) {
  const layout = useResizablePaneLayout();
  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden max-[760px]:flex-col"
      data-workspace-browser
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "min-h-0 shrink-0 overflow-hidden max-[760px]:h-14 max-[760px]:w-full [&>*]:h-full [&>*]:w-full",
          resizablePaneWidthClass("navigation", layout.navigationWidth),
        )}
      >
        {navigation}
      </div>
      <PaneResizer
        pane="navigation"
        controls="navigation-pane"
        label="Resize folder pane"
      />
      <div className="min-h-0 min-w-[360px] flex-1 overflow-hidden max-[760px]:min-h-24 max-[760px]:min-w-0 [&>*]:h-full [&>*]:w-full">
        {table}
      </div>
      <PaneResizer
        pane="details"
        controls="details-pane"
        label="Resize details pane"
      />
      <div
        className={cn(
          "min-h-0 shrink-0 overflow-hidden max-[1100px]:w-[220px] max-[760px]:max-h-44 max-[760px]:w-full [&>*]:h-full [&>*]:w-full",
          resizablePaneWidthClass("details", layout.detailsWidth),
        )}
      >
        {sidePane}
      </div>
      <DropOverlay />
    </section>
  );
}
