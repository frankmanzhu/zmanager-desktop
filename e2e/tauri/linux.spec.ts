import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

type NativeCapability = {
  id: string;
  sourceState: string;
  packageState: string;
  runtimeState: string;
  availability: string;
};

type ProjectContract = {
  commands: string[];
  platformIntegration: {
    platform: string;
    capabilities: NativeCapability[];
  };
  sourceTableCapabilities: {
    availableColumnIds: string[];
  };
};

type SystemFileIconResponse = {
  icons: Array<{
    key: string;
    dataUrl: string | null;
  }>;
};

type NativeWindowSize = {
  width: number;
  height: number;
};

type NativeMonitor = {
  name: string | null;
  scaleFactor: number;
  position: { x: number; y: number };
  size: NativeWindowSize;
};

type DiagnosticLogInfo = {
  enabled: boolean;
  path: string | null;
  sessionId: string;
  location: string;
};

type DiagnosticLogEntry = {
  sessionId: string;
  scope: string;
  name: string;
  fields: Record<string, unknown>;
};

describe("Linux native Tauri integration", () => {
  if (process.platform !== "linux") {
    it("runs only on Linux", () => {
      pending("Linux native Tauri coverage is not applicable on this host.");
    });
    return;
  }

  it("reports the Linux capability and source-column contract", async () => {
    const contract = await invoke<ProjectContract>("project_contract");

    assert.equal(contract.platformIntegration.platform, "linux");
    assert.deepEqual(
      contract.sourceTableCapabilities.availableColumnIds.filter((id) => (
        ["mode", "uid", "gid", "owner", "group"].includes(id)
      )),
      ["mode", "uid", "gid", "owner", "group"],
    );
    assert.equal(contract.sourceTableCapabilities.availableColumnIds.includes("attributes"), false);
  });

  it("reports the required Linux runtime seams as available", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const capability = capabilityLookup(contract);

    for (const id of [
      "mainWindowPolicy",
      "disposableTaskWindowPolicy",
      "secureLocalFileProtection",
      "nativeFileDrag",
      "diagnosticLog",
    ]) {
      assert.deepEqual(
        {
          sourceState: capability(id).sourceState,
          runtimeState: capability(id).runtimeState,
          availability: capability(id).availability,
        },
        { sourceState: "supported", runtimeState: "ready", availability: "available" },
        id,
      );
    }
  });

  it("distinguishes unavailable Linux shell packaging from runtime readiness", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const capability = capabilityLookup(contract);

    for (const id of ["shellSelectedItemActions", "shellBackgroundActions"]) {
      assert.deepEqual(
        {
          sourceState: capability(id).sourceState,
          packageState: capability(id).packageState,
          runtimeState: capability(id).runtimeState,
          availability: capability(id).availability,
        },
        {
          sourceState: "supported",
          packageState: "notIncluded",
          runtimeState: "ready",
          availability: "unavailable",
        },
        id,
      );
    }
  });

  it("marks non-Linux native surfaces as not applicable", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const capability = capabilityLookup(contract);

    for (const id of [
      "nativeApplicationMenu",
      "finderTokenTransport",
      "nativeHostLifecycle",
      "quickLook",
      "spotlight",
    ]) {
      assert.equal(capability(id).availability, "notApplicable", id);
    }
  });

  it("publishes the command seam required by the Linux shell workflow", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    for (const command of [
      "healthcheck",
      "project_contract",
      "start_archive_index",
      "wait_archive_index",
      "get_archive_children",
      "search_archive_index",
      "close_archive_index",
      "preview_entry",
      "start_native_file_drag",
      "cleanup_preview_roots",
    ]) {
      assert.ok(contract.commands.includes(command), `Missing command contract entry ${command}`);
    }
  });

  it("starts with one addressable native main window", async () => {
    assert.deepEqual(await browser.getWindowHandles(), ["main"]);
  });

  it("reports the native Linux title and WebView title", async () => {
    assert.equal(await invoke<string>("plugin:window|title", { label: "main" }), "ZManager");
    assert.match(await browser.getTitle(), /ZManager/);
  });

  it("keeps the Linux native window controls available", async () => {
    const flags = await Promise.all([
      invoke<boolean>("plugin:window|is_resizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_maximizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_minimizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_closable", { label: "main" }),
    ]);
    assert.deepEqual(flags, [true, true, true, true]);
  });

  it("uses application chrome over the undecorated Linux window", async () => {
    assert.equal(await invoke<boolean>("plugin:window|is_decorated", { label: "main" }), false);
    assert.equal(
      await browser.execute(() => document.body.classList.contains("custom-window-chrome")),
      true,
    );
    assert.equal(await $('[data-shell-chrome="title"]').isDisplayed(), true);
  });

  it("returns ordered null icon data instead of inventing Linux shell bitmaps", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "executable", path: "/usr/bin/sh", isDirectory: false },
          { key: "archive", path: "sample.zip", isDirectory: false },
          { key: "folder", path: "/tmp", isDirectory: true },
        ],
      },
    });

    assert.deepEqual(response, {
      icons: [
        { key: "executable", dataUrl: null },
        { key: "archive", dataUrl: null },
        { key: "folder", dataUrl: null },
      ],
    });
  });

  it("preserves duplicate Linux icon request keys", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "same", path: "first.zip", isDirectory: false },
          { key: "same", path: "second.tar", isDirectory: false },
        ],
      },
    });

    assert.deepEqual(response.icons, [
      { key: "same", dataUrl: null },
      { key: "same", dataUrl: null },
    ]);
  });

  it("returns no invented icon entries for an empty Linux request", async () => {
    assert.deepEqual(
      await invoke<SystemFileIconResponse>("system_file_icons", { request: { entries: [] } }),
      { icons: [] },
    );
  });

  it("keeps Linux directory validation and missing paths distinct", async () => {
    const existing = await validateDirectory("/tmp");
    assert.deepEqual(existing, { exists: true, isDirectory: true, accessible: true });

    const missing = await validateDirectory(`/tmp/zmanager-native-missing-${process.pid}`);
    assert.deepEqual(missing, { exists: false, isDirectory: false, accessible: false });
  });

  it("distinguishes a Linux executable file from a directory", async () => {
    assert.deepEqual(await validateDirectory(process.execPath), {
      exists: true,
      isDirectory: false,
      accessible: false,
    });
  });

  it("normalizes whitespace around Linux directory paths", async () => {
    assert.deepEqual(await validateDirectory("  /tmp/../tmp  "), {
      exists: true,
      isDirectory: true,
      accessible: true,
    });
  });

  it("rejects an empty Linux directory path without probing the filesystem", async () => {
    assert.deepEqual(await validateDirectory("   "), {
      exists: false,
      isDirectory: false,
      accessible: false,
    });
  });

  it("writes Linux diagnostics next to the running executable", async () => {
    const info = await invoke<DiagnosticLogInfo>("diagnostic_log_info");
    const appBinary = process.env.ZMANAGER_GUI_APP_PATH ?? path.resolve(
      "src-tauri",
      "target",
      "debug",
      "zmanager-desktop",
    );
    const expectedPath = path.join(path.dirname(appBinary), "logs", "zmanager-diagnostics.log");

    assert.equal(info.enabled, true);
    assert.equal(info.location, "installation");
    assert.ok(info.path);
    assert.equal(path.resolve(info.path), path.resolve(expectedPath));
    assert.match(info.sessionId, /^\d+-\d+$/);
  });

  it("persists and redacts a diagnostic event through the real Linux command", async () => {
    const info = await invoke<DiagnosticLogInfo>("diagnostic_log_info");
    assert.ok(info.path, "Linux diagnostic log path is unavailable");
    const marker = `native-linux-${Date.now()}`;
    const password = `test-password-${Date.now()}`;
    const archivePath = `/private/${marker}.zip`;

    await invoke<void>("record_diagnostic_event", {
      request: {
        scope: "linux.native.e2e",
        name: "redaction-proof",
        fields: { marker, password, archivePath },
      },
    });

    let event: DiagnosticLogEntry | undefined;
    await browser.waitUntil(() => {
      event = readDiagnosticEntries(info.path ?? "").find((candidate) => (
        candidate.sessionId === info.sessionId
        && candidate.scope === "linux.native.e2e"
        && candidate.name === "redaction-proof"
        && candidate.fields.marker === marker
      ));
      return event !== undefined;
    }, {
      timeout: 5_000,
      timeoutMsg: "The Linux diagnostic event was not flushed to disk",
    });

    assert.equal(event?.fields.password, "[REDACTED]");
    assert.equal(event?.fields.archivePath, "[REDACTED_PATH]");
    assert.equal(JSON.stringify(event).includes(password), false);
    assert.equal(JSON.stringify(event).includes(archivePath), false);
  });

  it("reports a positive Linux display scale factor", async () => {
    const scaleFactor = await invoke<number>("plugin:window|scale_factor", { label: "main" });
    assert.ok(Number.isFinite(scaleFactor));
    assert.ok(scaleFactor > 0);
  });

  it("reports a valid Linux monitor topology", async () => {
    const monitors = await invoke<NativeMonitor[]>("plugin:window|available_monitors");

    assert.ok(monitors.length >= 1);
    for (const monitor of monitors) {
      assert.ok(Number.isFinite(monitor.position.x), JSON.stringify(monitor));
      assert.ok(Number.isFinite(monitor.position.y), JSON.stringify(monitor));
      assert.ok(monitor.size.width > 0, JSON.stringify(monitor));
      assert.ok(monitor.size.height > 0, JSON.stringify(monitor));
      assert.ok(Number.isFinite(monitor.scaleFactor) && monitor.scaleFactor > 0, JSON.stringify(monitor));
    }
  });

  it("keeps the WebView viewport synchronized with the native Linux inner size", async () => {
    const nativeSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
    const scaleFactor = await invoke<number>("plugin:window|scale_factor", { label: "main" });
    const viewport = await browser.execute(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.clientWidth,
      documentHeight: document.documentElement.clientHeight,
    }));

    assert.equal(viewport.width, viewport.documentWidth);
    assert.equal(viewport.height, viewport.documentHeight);
    assert.ok(Math.abs(nativeSize.width - viewport.width * scaleFactor) <= 2, JSON.stringify({
      nativeSize,
      scaleFactor,
      viewport,
    }));
    assert.ok(Math.abs(nativeSize.height - viewport.height * scaleFactor) <= 2, JSON.stringify({
      nativeSize,
      scaleFactor,
      viewport,
    }));
  });

  it("keeps undecorated Linux outer and inner dimensions coherent", async () => {
    const [outer, inner] = await Promise.all([
      invoke<NativeWindowSize>("plugin:window|outer_size", { label: "main" }),
      invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" }),
    ]);

    assert.ok(outer.width >= inner.width, JSON.stringify({ outer, inner }));
    assert.ok(outer.height >= inner.height, JSON.stringify({ outer, inner }));
  });

  it("keeps the visible Linux window enabled and normally stacked", async () => {
    const [visible, enabled, alwaysOnTop] = await Promise.all([
      invoke<boolean>("plugin:window|is_visible", { label: "main" }),
      invoke<boolean>("plugin:window|is_enabled", { label: "main" }),
      invoke<boolean>("plugin:window|is_always_on_top", { label: "main" }),
    ]);
    assert.deepEqual({ visible, enabled, alwaysOnTop }, {
      visible: true,
      enabled: true,
      alwaysOnTop: false,
    });
  });

  it("starts outside fullscreen and minimized Linux states", async () => {
    const [fullscreen, minimized] = await Promise.all([
      invoke<boolean>("plugin:window|is_fullscreen", { label: "main" }),
      invoke<boolean>("plugin:window|is_minimized", { label: "main" }),
    ]);
    assert.deepEqual({ fullscreen, minimized }, { fullscreen: false, minimized: false });
  });

  it("round-trips the native Linux resizable flag", async () => {
    const initial = await invoke<boolean>("plugin:window|is_resizable", { label: "main" });
    try {
      await invoke<void>("plugin:window|set_resizable", { label: "main", value: !initial });
      assert.equal(await invoke<boolean>("plugin:window|is_resizable", { label: "main" }), !initial);
    } finally {
      await invoke<void>("plugin:window|set_resizable", { label: "main", value: initial });
    }
  });

  it("reports a finite native Linux window position", async () => {
    const position = await invoke<{ x: number; y: number }>(
      "plugin:window|inner_position",
      { label: "main" },
    );
    assert.ok(Number.isFinite(position.x), JSON.stringify(position));
    assert.ok(Number.isFinite(position.y), JSON.stringify(position));
  });
});

function capabilityLookup(contract: ProjectContract): (id: string) => NativeCapability {
  return (id) => {
    const capability = contract.platformIntegration.capabilities.find((item) => item.id === id);
    assert.ok(capability, `Missing native capability ${id}`);
    return capability;
  };
}

async function validateDirectory(pathValue: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
  accessible: boolean;
}> {
  return invoke("validate_directory", { request: { path: pathValue } });
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return browser.tauri.execute(
    ({ core }, payload: { command: string; args?: Record<string, unknown> }) => (
      payload.args === undefined
        ? core.invoke(payload.command)
        : core.invoke(payload.command, payload.args)
    ),
    { command, args },
  ) as Promise<T>;
}

function readDiagnosticEntries(logPath: string): DiagnosticLogEntry[] {
  return readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as DiagnosticLogEntry];
      } catch {
        return [];
      }
    });
}
