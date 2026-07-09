import { ArchiveDetailsPane } from "./ArchiveDetailsPane";
import { ArchivePathBar } from "./ArchivePathBar";
import { ArchiveTable } from "./ArchiveTable";
import { ArchiveTree } from "./ArchiveTree";

export function ArchiveWorkspace() {
  return (
    <>
      <ArchivePathBar />
      <section className="browser-shell" aria-label="Archive workspace">
        <ArchiveTree />
        <div
          className="pane-resizer"
          data-pane-resizer="navigation"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-controls="navigation-pane"
          aria-label="Resize folder pane"
        >
          <span className="pane-resizer-grip" aria-hidden="true" />
        </div>
        <ArchiveTable />
        <div
          className="pane-resizer"
          data-pane-resizer="details"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-controls="details-pane"
          aria-label="Resize details pane"
        >
          <span className="pane-resizer-grip" aria-hidden="true" />
        </div>
        <ArchiveDetailsPane />
      </section>
    </>
  );
}
