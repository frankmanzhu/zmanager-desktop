import { describe, expect, it, vi } from "vitest";

import {
  installRuntimeDevTools,
  isLocalDevHost,
  loadLocalDevFixtureFromUrl,
  type RuntimeDevToolsOptions,
  type RuntimeDevWindow,
} from "./runtimeDevTools";

describe("runtime dev tools", () => {
  it("recognizes only local dev hosts", () => {
    expect(isLocalDevHost(true, "localhost")).toBe(true);
    expect(isLocalDevHost(true, "127.0.0.1")).toBe(true);
    expect(isLocalDevHost(true, "example.com")).toBe(false);
    expect(isLocalDevHost(false, "localhost")).toBe(false);
  });

  it("installs the dev api only on local dev hosts", () => {
    const options = createOptions({ hostname: "localhost" });

    expect(installRuntimeDevTools(options)).toBe(true);
    expect(options.windowRef.__zmanagerDev).toBe(options.api);

    const remote = createOptions({ hostname: "example.com" });
    expect(installRuntimeDevTools(remote)).toBe(false);
    expect(remote.windowRef.__zmanagerDev).toBeUndefined();
  });

  it("loads the archive fixture only after the normal workspace is rendered", () => {
    const options = createOptions({
      hostname: "localhost",
      search: "?fixture=archive",
      normalWorkspaceRendered: false,
    });

    expect(loadLocalDevFixtureFromUrl(options)).toBe(false);
    expect(options.api.loadArchiveFixture).not.toHaveBeenCalled();

    const rendered = createOptions({
      hostname: "localhost",
      search: "?fixture=archive",
      normalWorkspaceRendered: true,
    });
    expect(loadLocalDevFixtureFromUrl(rendered)).toBe(true);
    expect(rendered.api.loadArchiveFixture).toHaveBeenCalledWith(expect.objectContaining({
      archivePath: "C:/Users/Frank/Downloads/photos.zip",
    }));
  });
});

function createOptions(
  input: {
    hostname?: string;
    search?: string;
    normalWorkspaceRendered?: boolean;
  } = {},
): RuntimeDevToolsOptions {
  const windowRef: RuntimeDevWindow = {
    location: {
      hostname: input.hostname ?? "localhost",
      search: input.search ?? "",
    } as Location,
  };

  return {
    isDev: true,
    windowRef,
    normalWorkspaceRendered: () => input.normalWorkspaceRendered ?? true,
    isQuickActionJobMode: () => false,
    api: {
      loadArchiveFixture: vi.fn(),
      setSystemIconFixtures: vi.fn(),
      setJobFixtures: vi.fn(),
      openSurface: vi.fn(),
      closeModal: vi.fn(),
    },
  };
}
