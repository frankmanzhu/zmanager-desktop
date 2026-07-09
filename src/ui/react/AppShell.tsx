import { useEffect, useState } from "react";

import { ReactRuntimeMetadata, ZManagerAppRuntimeProvider } from "./AppProviders";
import { createZManagerAppStore } from "./appStore";
import { noopZManagerReactActions, type ZManagerReactRuntimeAdapter } from "./appRuntime";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { useZManagerSnapshot } from "./AppProviders";
import { CreateWorkspace } from "./create/CreateWorkspace";
import { DialogRoot } from "./dialogs/DialogRoot";
import { JobsDrawer, QuickActionProgress } from "./jobs/JobsSurfaces";
import { AppFrame } from "./shell/AppFrame";

type LegacyState = "loading" | "ready" | "failed";

type LegacyMainModule = {
  getLegacyReactRuntimeAdapter?: () => ZManagerReactRuntimeAdapter;
};

export function AppShell() {
  const [legacyState, setLegacyState] = useState<LegacyState>("loading");
  const [store] = useState(() => createZManagerAppStore());

  useEffect(() => {
    let cancelled = false;
    let unsubscribeLegacy: (() => void) | null = null;

    import("../../legacyMain")
      .then((legacyModule: LegacyMainModule) => {
        if (!cancelled) {
          const runtime = legacyModule.getLegacyReactRuntimeAdapter?.();
          if (!runtime) {
            throw new Error("legacy React runtime adapter is unavailable");
          }

          store.setActions(runtime.actions);
          store.publish(runtime.getSnapshot());
          unsubscribeLegacy = runtime.subscribe((snapshot) => {
            store.publish(snapshot);
          });
          setLegacyState("ready");
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to start ZManager legacy shell", error);
        if (!cancelled) {
          setLegacyState("failed");
        }
      });

    return () => {
      cancelled = true;
      unsubscribeLegacy?.();
      store.setActions(noopZManagerReactActions);
    };
  }, [store]);

  return (
    <ZManagerAppRuntimeProvider store={store}>
      <div className="zmanager-react-shell" data-legacy-state={legacyState}>
        <ReactRuntimeMetadata />
        {legacyState === "failed" ? (
          <div className="startup-failure" role="alert">
            ZManager failed to start.
          </div>
        ) : null}
        <AppFrame>
          <QuickActionProgress />
          <ReactWorkspaceSurfaces legacyState={legacyState} />
          <div id="zmanager-legacy-root" />
          <JobsDrawer />
          <DialogRoot />
        </AppFrame>
      </div>
    </ZManagerAppRuntimeProvider>
  );
}

function ReactWorkspaceSurfaces({ legacyState }: Readonly<{ legacyState: LegacyState }>) {
  const snapshot = useZManagerSnapshot();

  if (legacyState !== "ready") {
    return null;
  }

  return snapshot.shell.activeMode === "extract" ? <ArchiveWorkspace /> : <CreateWorkspace />;
}
