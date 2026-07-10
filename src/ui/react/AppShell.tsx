import { useEffect, useState } from "react";

import { ReactRuntimeMetadata, ZManagerAppRuntimeProvider } from "./AppProviders";
import { createZManagerAppStore } from "./appStore";
import { noopZManagerReactActions, type ZManagerReactRuntimeAdapter } from "./appRuntime";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { ExtractPasswordProvider } from "./archive/ExtractPasswordContext";
import { useZManagerSnapshot } from "./AppProviders";
import { ContextMenuRoot } from "./context-menu/ContextMenuRoot";
import { CreatePasswordProvider } from "./create/CreatePasswordContext";
import { CreateWorkspace } from "./create/CreateWorkspace";
import { DialogRoot } from "./dialogs/DialogRoot";
import { BrowserFileDropAdapter } from "./interaction/BrowserFileDropAdapter";
import { ShellKeyboardShortcuts } from "./interaction/ShellKeyboardShortcuts";
import { JobsDrawer, QuickActionProgress } from "./jobs/JobsSurfaces";
import { AppFrame } from "./shell/AppFrame";

type RuntimeBridgeState = "loading" | "ready" | "failed";

type RuntimeBridgeModule = {
  getZManagerRuntimeAdapter?: () => ZManagerReactRuntimeAdapter;
};

export function AppShell() {
  const [runtimeBridgeState, setRuntimeBridgeState] = useState<RuntimeBridgeState>("loading");
  const [store] = useState(() => createZManagerAppStore());

  useEffect(() => {
    let cancelled = false;
    let unsubscribeRuntimeBridge: (() => void) | null = null;

    import("../../runtimeBridge")
      .then((runtimeModule: RuntimeBridgeModule) => {
        if (!cancelled) {
          const runtime = runtimeModule.getZManagerRuntimeAdapter?.();
          if (!runtime) {
            throw new Error("ZManager React runtime adapter is unavailable");
          }

          store.setActions(runtime.actions);
          store.publish(runtime.getSnapshot());
          unsubscribeRuntimeBridge = runtime.subscribe((snapshot) => {
            store.publish(snapshot);
          });
          setRuntimeBridgeState("ready");
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to start ZManager runtime bridge", error);
        if (!cancelled) {
          setRuntimeBridgeState("failed");
        }
      });

    return () => {
      cancelled = true;
      unsubscribeRuntimeBridge?.();
      store.setActions(noopZManagerReactActions);
    };
  }, [store]);

  return (
    <ZManagerAppRuntimeProvider store={store}>
      <div className="zmanager-react-shell" data-runtime-bridge-state={runtimeBridgeState}>
        <ReactRuntimeMetadata />
        <BrowserFileDropAdapter />
        <ShellKeyboardShortcuts />
        {runtimeBridgeState === "failed" ? (
          <div className="startup-failure" role="alert">
            ZManager failed to start.
          </div>
        ) : null}
        <CreatePasswordProvider>
          <ExtractPasswordProvider>
            <AppFrame runtimeBridgeReady={runtimeBridgeState === "ready"}>
            <QuickActionProgress />
            <ReactWorkspaceSurfaces runtimeBridgeState={runtimeBridgeState} />
            <JobsDrawer />
            <ContextMenuRoot />
            <DialogRoot />
            </AppFrame>
          </ExtractPasswordProvider>
        </CreatePasswordProvider>
      </div>
    </ZManagerAppRuntimeProvider>
  );
}

function ReactWorkspaceSurfaces({ runtimeBridgeState }: Readonly<{ runtimeBridgeState: RuntimeBridgeState }>) {
  const snapshot = useZManagerSnapshot();

  if (runtimeBridgeState !== "ready") {
    return null;
  }

  return snapshot.shell.activeMode === "extract" ? <ArchiveWorkspace /> : <CreateWorkspace />;
}
