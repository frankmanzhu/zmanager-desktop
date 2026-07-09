import { createContext, useContext, type ReactNode } from "react";

import { useZManagerStoreSnapshot, type ZManagerAppStore } from "./appStore";
import type { ZManagerReactActions, ZManagerReactSnapshot } from "./appRuntime";

const ZManagerAppStoreContext = createContext<ZManagerAppStore | null>(null);

export type ZManagerAppRuntimeProviderProps = Readonly<{
  store: ZManagerAppStore;
  children?: ReactNode;
}>;

export function ZManagerAppRuntimeProvider({
  store,
  children,
}: ZManagerAppRuntimeProviderProps) {
  return (
    <ZManagerAppStoreContext.Provider value={store}>
      {children}
    </ZManagerAppStoreContext.Provider>
  );
}

export function useZManagerAppStore(): ZManagerAppStore {
  const store = useContext(ZManagerAppStoreContext);
  if (!store) {
    throw new Error("ZManagerAppRuntimeProvider is missing");
  }
  return store;
}

export function useZManagerSnapshot(): ZManagerReactSnapshot {
  return useZManagerStoreSnapshot(useZManagerAppStore());
}

export function useZManagerActions(): ZManagerReactActions {
  return useZManagerAppStore().getActions();
}

export function ReactRuntimeMetadata() {
  const snapshot = useZManagerSnapshot();

  return (
    <span
      className="zmanager-react-runtime-state"
      data-active-mode={snapshot.shell.activeMode}
      data-browse-state={snapshot.archive.browseState}
      data-locale={snapshot.display.resolvedLocale}
      hidden
    />
  );
}
