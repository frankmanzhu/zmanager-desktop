import { ArchiveDetailsPane } from "./ArchiveDetailsPane";
import { ArchivePathBar } from "./ArchivePathBar";
import { ArchiveTable } from "./ArchiveTable";
import { ArchiveTree } from "./ArchiveTree";
import { PaneResizer } from "../interaction/PaneResizer";

export function ArchiveWorkspace() {
  return (
    <>
      <ArchivePathBar />
      <section className="browser-shell" aria-label="Archive workspace">
        <ArchiveTree />
        <PaneResizer pane="navigation" controls="navigation-pane" label="Resize folder pane" />
        <ArchiveTable />
        <PaneResizer pane="details" controls="details-pane" label="Resize details pane" />
        <ArchiveDetailsPane />
      </section>
    </>
  );
}
