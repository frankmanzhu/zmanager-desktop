import type { ReactNode } from "react";

import { PaneResizer } from "../interaction/PaneResizer";

export type WorkspaceBrowserShellProps = Readonly<{
  ariaLabel: string;
  navigation: ReactNode;
  table: ReactNode;
  sidePane: ReactNode;
  topPanel?: ReactNode;
}>;

export function WorkspaceBrowserShell({
  ariaLabel,
  navigation,
  table,
  sidePane,
  topPanel,
}: WorkspaceBrowserShellProps) {
  return (
    <section className="browser-shell" aria-label={ariaLabel}>
      {topPanel}
      {navigation}
      <PaneResizer pane="navigation" controls="navigation-pane" label="Resize folder pane" />
      {table}
      <PaneResizer pane="details" controls="details-pane" label="Resize details pane" />
      {sidePane}
    </section>
  );
}
