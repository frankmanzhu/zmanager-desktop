import { ArchiveDetailsPane } from "./ArchiveDetailsPane";
import { ArchivePathBar } from "./ArchivePathBar";
import { ArchiveTable } from "./ArchiveTable";
import { ArchiveTree } from "./ArchiveTree";
import { WorkspaceBrowserShell } from "../workspace/WorkspaceBrowserShell";

export function ArchiveWorkspace() {
  return (
    <>
      <ArchivePathBar />
      <WorkspaceBrowserShell
        ariaLabel="Archive workspace"
        navigation={<ArchiveTree />}
        table={<ArchiveTable />}
        sidePane={<ArchiveDetailsPane />}
      />
    </>
  );
}
