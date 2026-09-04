import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  ReactRuntimeMetadata,
  ZManagerAppRuntimeProvider,
  useZManagerActions,
  useZManagerSnapshot,
} from "./AppProviders";
import { createZManagerAppStore } from "./appStore";
import {
  noopZManagerReactActions,
  type ZManagerReactRuntimeAdapter,
} from "./appRuntime";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { ExtractPasswordProvider } from "./archive/ExtractPasswordContext";
import { ContextMenuRoot } from "./context-menu/ContextMenuRoot";
import { CreatePasswordProvider } from "./create/CreatePasswordContext";
import { CreateWorkspace } from "./create/CreateWorkspace";
import { DialogRoot } from "./dialogs/DialogRoot";
import { LocalSendIncomingTransferBanner } from "./dialogs/LocalSendIncomingTransferBanner";
import { useBrowserFileDropHandlers } from "./interaction/BrowserFileDropAdapter";
import { ShellInteractionProvider } from "./interaction/ShellInteractionContext";
import { useShellKeyboardShortcutHandler } from "./interaction/ShellKeyboardShortcuts";
import { AppFrame } from "./shell/AppFrame";
import { AccountWorkspace } from "./account/AccountWorkspace";
import { ShareQueuePanel } from "./shell/ShareQueuePanel";

type RuntimeBridgeState = "loading" | "ready" | "failed";

type RuntimeBridgeModule = {
  getZManagerRuntimeAdapter?: () => Promise<() => ZManagerReactRuntimeAdapter>;
};

export function AppShell() {
  const [runtimeBridgeState, setRuntimeBridgeState] =
    useState<RuntimeBridgeState>("loading");
  const [store] = useState(() => createZManagerAppStore());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeRuntimeBridge: (() => void) | null = null;

    import("../../runtimeBridge")
      .then(async (runtimeModule: RuntimeBridgeModule) => {
        if (!cancelled) {
          const getAdapter = await runtimeModule.getZManagerRuntimeAdapter?.();
          if (!getAdapter) {
            throw new Error("ZManager React runtime adapter is unavailable");
          }
          const runtime = getAdapter();

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
      <ShellInteractionProvider searchInputRef={searchInputRef}>
        <AppShellSurface runtimeBridgeState={runtimeBridgeState} />
      </ShellInteractionProvider>
    </ZManagerAppRuntimeProvider>
  );
}

function AppShellSurface({
  runtimeBridgeState,
}: Readonly<{ runtimeBridgeState: RuntimeBridgeState }>) {
  const dropHandlers = useBrowserFileDropHandlers();
  const onShellKeyDown = useShellKeyboardShortcutHandler();
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      if (snapshot.preferencesDraft) {
        event.preventDefault();
        actions.handleDialogIntent({ type: "preferencesCancel" });
        return;
      }
      if (snapshot.dialog.kind !== "none") {
        event.preventDefault();
        actions.handleDialogIntent({ type: "closeCurrent" });
        return;
      }
      if (snapshot.account.visible) {
        event.preventDefault();
        actions.handleAccountIntent({ type: "close" });
        return;
      }
    }
    onShellKeyDown(event);
  };

  return (
    <div
      className="h-screen min-h-screen min-w-[320px] overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50 [color-scheme:light_dark] [&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input:not([type=checkbox]):not([type=radio])]:min-w-0 [&_input:not([type=checkbox]):not([type=radio])]:rounded-md [&_input:not([type=checkbox]):not([type=radio])]:border [&_input:not([type=checkbox]):not([type=radio])]:border-slate-300 [&_input:not([type=checkbox]):not([type=radio])]:bg-white [&_input:not([type=checkbox]):not([type=radio])]:px-2 [&_input:not([type=checkbox]):not([type=radio])]:text-sm [&_input:not([type=checkbox]):not([type=radio])]:outline-none [&_input:not([type=checkbox]):not([type=radio])]:focus:border-blue-500 [&_input:not([type=checkbox]):not([type=radio])]:focus:ring-2 [&_input:not([type=checkbox]):not([type=radio])]:focus:ring-blue-500/20 dark:[&_input:not([type=checkbox]):not([type=radio])]:border-slate-700 dark:[&_input:not([type=checkbox]):not([type=radio])]:bg-slate-950 dark:[&_input:not([type=checkbox]):not([type=radio])]:text-slate-50 [&_input[type=checkbox]]:size-4 [&_input[type=checkbox]]:accent-blue-600 [&_input[type=radio]]:size-4 [&_input[type=radio]]:accent-blue-600 [&_select]:h-8 [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:outline-none [&_select]:focus:border-blue-500 [&_select]:focus:ring-2 [&_select]:focus:ring-blue-500/20 dark:[&_select]:border-slate-700 dark:[&_select]:bg-slate-950 dark:[&_select]:text-slate-50 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:p-2 dark:[&_textarea]:border-slate-700 dark:[&_textarea]:bg-slate-950 [&_progress]:h-2 [&_progress]:w-full"
      data-runtime-bridge-state={runtimeBridgeState}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        if (!event.defaultPrevented) {
          event.preventDefault();
        }
      }}
      {...dropHandlers}
    >
      <ReactRuntimeMetadata />
      {runtimeBridgeState === "failed" ? (
        <div
          className="fixed inset-x-4 top-4 z-[200] rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          ZManager failed to start.
        </div>
      ) : null}
      <CreatePasswordProvider>
        <ExtractPasswordProvider>
          <AppFrame runtimeBridgeReady={runtimeBridgeState === "ready"}>
            <ReactWorkspaceSurfaces runtimeBridgeState={runtimeBridgeState} />
            <ShareQueuePanel />
            <ContextMenuRoot />
            <DialogRoot />
            <LocalSendIncomingTransferBanner />
            <AccountWorkspace />
          </AppFrame>
        </ExtractPasswordProvider>
      </CreatePasswordProvider>
    </div>
  );
}

function ReactWorkspaceSurfaces({
  runtimeBridgeState,
}: Readonly<{ runtimeBridgeState: RuntimeBridgeState }>) {
  const snapshot = useZManagerSnapshot();

  if (runtimeBridgeState !== "ready") {
    return null;
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {snapshot.shell.activeMode === "extract" ? (
        <ArchiveWorkspace />
      ) : (
        <CreateWorkspace />
      )}
    </div>
  );
}
