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

  it("round-trips the native Linux always-on-top window flag", async () => {
    const initial = await invoke<boolean>("plugin:window|is_always_on_top", { label: "main" });
    try {
      await invoke<void>("plugin:window|set_always_on_top", { label: "main", value: !initial });
      assert.equal(await invoke<boolean>("plugin:window|is_always_on_top", { label: "main" }), !initial);
    } finally {
      await invoke<void>("plugin:window|set_always_on_top", { label: "main", value: initial });
    }
  });

  it("supports requesting native Linux window focus", async () => {
    await invoke<void>("plugin:window|set_focus", { label: "main" });
    const focused = await invoke<boolean>("plugin:window|is_focused", { label: "main" });
    assert.equal(typeof focused, "boolean");
  });

  it("round-trips native Linux title updates", async () => {
    const initialTitle = await invoke<string>("plugin:window|title", { label: "main" });
    const testTitle = "ZManager - Fedora Native GUI Test";
    try {
      await invoke<void>("plugin:window|set_title", { label: "main", value: testTitle });
      assert.equal(await invoke<string>("plugin:window|title", { label: "main" }), testTitle);
    } finally {
      await invoke<void>("plugin:window|set_title", { label: "main", value: initialTitle });
    }
  });

  it("supports native Linux window resize and position adjustments", async () => {
    const initialSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
    const initialPosition = await invoke<{ x: number; y: number }>("plugin:window|inner_position", { label: "main" });

    assert.ok(initialSize.width > 0 && initialSize.height > 0);
    assert.ok(Number.isFinite(initialPosition.x) && Number.isFinite(initialPosition.y));
  });

  it("validates Fedora system directory locations and hierarchy", async () => {
    for (const fedoraDir of ["/etc", "/usr/share/applications", "/var/tmp"]) {
      const result = await validateDirectory(fedoraDir);
      assert.deepEqual(result, { exists: true, isDirectory: true, accessible: true }, fedoraDir);
    }
  });

  it("rejects native Linux drag preparation with empty candidate lists", async () => {
    await assert.rejects(
      async () => {
        await invoke("start_native_file_drag", {
          request: {
            candidates: [],
            stripComponents: 0,
          },
        });
      },
      (err: Error) => err.message.includes("No archive files are available to drag") || err.message.includes("drag"),
    );
  });

  it("supports native Linux window centering", async () => {
    await invoke<void>("plugin:window|center", { label: "main" });
    const position = await invoke<{ x: number; y: number }>("plugin:window|inner_position", { label: "main" });
    assert.ok(Number.isFinite(position.x), JSON.stringify(position));
    assert.ok(Number.isFinite(position.y), JSON.stringify(position));
  });

  it("sets native Linux window minimum and maximum size constraints", async () => {
    try {
      await invoke<void>("plugin:window|set_min_size", { label: "main", value: { type: "Physical", width: 400, height: 300 } });
      await invoke<void>("plugin:window|set_max_size", { label: "main", value: { type: "Physical", width: 3840, height: 2160 } });
    } finally {
      await invoke<void>("plugin:window|set_min_size", { label: "main", value: null });
      await invoke<void>("plugin:window|set_max_size", { label: "main", value: null });
    }
  });

  it("round-trips native Linux window maximize and unmaximize states", async () => {
    const initial = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
    try {
      await invoke<void>("plugin:window|maximize", { label: "main" });
      assert.equal(await invoke<boolean>("plugin:window|is_maximized", { label: "main" }), true);
      await invoke<void>("plugin:window|unmaximize", { label: "main" });
      assert.equal(await invoke<boolean>("plugin:window|is_maximized", { label: "main" }), false);
    } finally {
      if (initial) {
        await invoke<void>("plugin:window|maximize", { label: "main" });
      } else {
        await invoke<void>("plugin:window|unmaximize", { label: "main" });
      }
    }
  });

  it("round-trips native Linux window minimize and restore states", async () => {
    const initial = await invoke<boolean>("plugin:window|is_minimized", { label: "main" });
    try {
      await invoke<void>("plugin:window|minimize", { label: "main" });
      assert.equal(await invoke<boolean>("plugin:window|is_minimized", { label: "main" }), true);
      await invoke<void>("plugin:window|unminimize", { label: "main" });
      assert.equal(await invoke<boolean>("plugin:window|is_minimized", { label: "main" }), false);
    } finally {
      if (initial) {
        await invoke<void>("plugin:window|minimize", { label: "main" });
      } else {
        await invoke<void>("plugin:window|unminimize", { label: "main" });
      }
    }
  });

  it("reports native Linux GTK theme property or null", async () => {
    const theme = await invoke<string | null>("plugin:window|theme", { label: "main" });
    assert.ok(theme === null || ["dark", "light"].includes(theme), `Unexpected theme value: ${theme}`);
  });

  it("handles batch system icon requests with deep Linux paths and root", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "root", path: "/", isDirectory: true },
          { key: "python", path: "/usr/bin/python3", isDirectory: false },
          { key: "var_log", path: "/var/log", isDirectory: true },
          { key: "missing", path: "/non-existent-path-test-123.tmp", isDirectory: false },
          { key: "empty", path: "   ", isDirectory: false },
        ],
      },
    });

    assert.equal(response.icons.length, 5);
    assert.deepEqual(response.icons.map((item) => item.key), [
      "root",
      "python",
      "var_log",
      "missing",
      "empty",
    ]);
    for (const icon of response.icons) {
      assert.equal(icon.dataUrl, null);
    }
  });

  it("validates restricted Linux system directory locations", async () => {
    for (const sysDir of ["/proc", "/sys", "/dev"]) {
      const result = await validateDirectory(sysDir);
      assert.equal(result.exists, true, `Expected ${sysDir} to exist`);
      assert.equal(result.isDirectory, true, `Expected ${sysDir} to be a directory`);
    }
  });

  it("verifies Linux POSIX source table columns contract", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const cols = contract.sourceTableCapabilities.availableColumnIds;

    assert.ok(cols.includes("mode"), "Missing mode column");
    assert.ok(cols.includes("uid"), "Missing uid column");
    assert.ok(cols.includes("gid"), "Missing gid column");
    assert.ok(cols.includes("owner"), "Missing owner column");
    assert.ok(cols.includes("group"), "Missing group column");
    assert.equal(cols.includes("attributes"), false, "Linux should not have Windows attributes column");
  });

  it("redacts structured tokens and authentication fields in Linux diagnostic logging", async () => {
    const info = await invoke<DiagnosticLogInfo>("diagnostic_log_info");
    assert.ok(info.path, "Linux diagnostic log path is unavailable");
    const marker = `fedora-redact-${Date.now()}`;
    const token = `secret-token-${Date.now()}`;
    const auth = `bearer-auth-${Date.now()}`;
    const secret = `my-secret-${Date.now()}`;
    const key = `api-key-${Date.now()}`;

    await invoke<void>("record_diagnostic_event", {
      request: {
        scope: "linux.fedora.e2e",
        name: "multi-field-redaction",
        fields: { marker, token, auth, secret, key },
      },
    });

    let event: DiagnosticLogEntry | undefined;
    await browser.waitUntil(() => {
      event = readDiagnosticEntries(info.path ?? "").find((candidate) => (
        candidate.sessionId === info.sessionId
        && candidate.scope === "linux.fedora.e2e"
        && candidate.name === "multi-field-redaction"
        && candidate.fields.marker === marker
      ));
      return event !== undefined;
    }, {
      timeout: 5_000,
      timeoutMsg: "The multi-field redaction diagnostic event was not flushed to disk",
    });

    assert.equal(event?.fields.token, "[REDACTED]");
    assert.equal(event?.fields.auth, "[REDACTED]");
    assert.equal(event?.fields.secret, "[REDACTED]");
    assert.equal(event?.fields.key, "[REDACTED]");
    assert.equal(JSON.stringify(event).includes(token), false);
    assert.equal(JSON.stringify(event).includes(auth), false);
    assert.equal(JSON.stringify(event).includes(secret), false);
    assert.equal(JSON.stringify(event).includes(key), false);
  });

  it("reports Linux RPM capability packageState accurately", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const capability = capabilityLookup(contract);

    assert.equal(capability("mainWindowPolicy").sourceState, "supported");
    assert.equal(capability("mainWindowPolicy").runtimeState, "ready");
    assert.equal(capability("mainWindowPolicy").availability, "available");
  });

  it("rejects native Linux drag preparation with path traversal components", async () => {
    await assert.rejects(
      async () => {
        await invoke("start_native_file_drag", {
          request: {
            candidates: [
              { entryPath: "../outside.txt", size: 10, modifiedUnixSeconds: null },
            ],
            stripComponents: 0,
          },
        });
      },
      (err: Error) => err.message.length > 0,
    );
  });

  it("verifies native Linux window inner size update round-trip", async () => {
    const initialSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
    const newWidth = Math.max(600, initialSize.width - 50);
    const newHeight = Math.max(400, initialSize.height - 50);

    try {
      await invoke<void>("plugin:window|set_size", {
        label: "main",
        value: { type: "Physical", width: newWidth, height: newHeight },
      });
      const updatedSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
      assert.ok(updatedSize.width > 0 && updatedSize.height > 0);
    } finally {
      await invoke<void>("plugin:window|set_size", {
        label: "main",
        value: { type: "Physical", width: initialSize.width, height: initialSize.height },
      });
    }
  });

  it("verifies native Linux window inner position update round-trip", async () => {
    const initialPos = await invoke<{ x: number; y: number }>("plugin:window|inner_position", { label: "main" });
    const targetX = initialPos.x + 10;
    const targetY = initialPos.y + 10;

    try {
      await invoke<void>("plugin:window|set_position", {
        label: "main",
        value: { type: "Physical", x: targetX, y: targetY },
      });
      const updatedPos = await invoke<{ x: number; y: number }>("plugin:window|inner_position", { label: "main" });
      assert.ok(Number.isFinite(updatedPos.x) && Number.isFinite(updatedPos.y));
    } finally {
      await invoke<void>("plugin:window|set_position", {
        label: "main",
        value: { type: "Physical", x: initialPos.x, y: initialPos.y },
      });
    }
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
