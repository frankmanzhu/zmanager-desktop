import type { JobState } from "../api/types";
import type { JobOutputAction } from "../app/workspaces/jobsWorkspace";
import type { ArchiveFixture } from "./runtimeArchiveFixtures";
import { localDevArchiveFixture } from "./runtimeArchiveFixtures";

export type RuntimeDevDialogName = "about" | "preferences" | "info";
export type RuntimeDevJobFixture = JobState & {
  outputActions?: JobOutputAction[];
};

export type RuntimeDevApi = Readonly<{
  loadArchiveFixture: (fixture: ArchiveFixture) => void;
  setSystemIconFixtures: (fixtures: Record<string, string | null>) => void;
  setJobFixtures: (fixtures: RuntimeDevJobFixture[]) => void;
  openSurface: (surface: RuntimeDevDialogName) => void;
  closeModal: () => void;
}>;

export type RuntimeDevWindow = Pick<Window, "location"> & {
  __zmanagerDev?: RuntimeDevApi;
};

export type RuntimeDevToolsOptions = Readonly<{
  isDev: boolean;
  windowRef: RuntimeDevWindow;
  normalWorkspaceRendered(): boolean;
  api: RuntimeDevApi;
}>;

declare global {
  interface Window {
    __zmanagerDev?: RuntimeDevApi;
  }
}

export function isLocalDevHost(isDev: boolean, hostname: string): boolean {
  return isDev && (hostname === "127.0.0.1" || hostname === "localhost");
}

export function installRuntimeDevTools(options: RuntimeDevToolsOptions): boolean {
  if (!isLocalDevHost(options.isDev, options.windowRef.location.hostname)) {
    return false;
  }

  options.windowRef.__zmanagerDev = options.api;
  return true;
}

export function loadLocalDevFixtureFromUrl(options: RuntimeDevToolsOptions): boolean {
  if (
    !isLocalDevHost(options.isDev, options.windowRef.location.hostname) ||
    !options.normalWorkspaceRendered()
  ) {
    return false;
  }

  const fixtureName = new URLSearchParams(options.windowRef.location.search).get("fixture");
  if (fixtureName !== "archive") {
    return false;
  }

  options.api.loadArchiveFixture(localDevArchiveFixture());
  return true;
}
