import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

type NativeCapability = {
  id: string;
  sourceState: string;
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

const MIN_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 480;

describe("Windows native Tauri integration", () => {
  if (process.platform !== "win32") {
    it("runs only on Windows", () => {
      pending("Windows native Tauri coverage is not applicable on this host.");
    });
    return;
  }

  it("reports the Windows capability contract used by the running app", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    assert.equal(contract.platformIntegration.platform, "windows");
    assert.ok(contract.sourceTableCapabilities.availableColumnIds.includes("attributes"));

    const capability = (id: string) => {
      const result = contract.platformIntegration.capabilities.find((item) => item.id === id);
      assert.ok(result, `Missing native capability ${id}`);
      return result;
    };

    assert.equal(capability("systemFileIcons").availability, "available");
    assert.equal(capability("systemFileIcons").sourceState, "supported");
    assert.equal(capability("nativeApplicationMenu").availability, "notApplicable");
    assert.equal(capability("nativeHostLifecycle").availability, "notApplicable");
  });

  it("reports the required Windows runtime seams as available", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    const capability = (id: string) => {
      const result = contract.platformIntegration.capabilities.find((item) => item.id === id);
      assert.ok(result, `Missing native capability ${id}`);
      return result;
    };

    for (const id of [
      "mainWindowPolicy",
      "disposableTaskWindowPolicy",
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

  it("publishes the command seam required by the Windows shell workflow", async () => {
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

  it("reports the native Windows title and a non-empty WebView title", async () => {
    assert.equal(await invoke<string>("plugin:window|title", { label: "main" }), "ZManager");
    assert.match(await browser.getTitle(), /ZManager/);
  });

  it("keeps the Windows native window controls available", async () => {
    const flags = await Promise.all([
      invoke<boolean>("plugin:window|is_resizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_maximizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_minimizable", { label: "main" }),
      invoke<boolean>("plugin:window|is_closable", { label: "main" }),
    ]);
    assert.deepEqual(flags, [true, true, true, true]);
  });

  it("renders Windows shell icons through the real native command", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "executable", path: "sample.exe", isDirectory: false },
          { key: "archive", path: "sample.zip", isDirectory: false },
          { key: "folder", path: "", isDirectory: true },
        ],
      },
    });

    assert.deepEqual(response.icons.map((icon) => icon.key), ["executable", "archive", "folder"]);
    for (const icon of response.icons) {
      assert.match(
        icon.dataUrl ?? "",
        /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/,
        `Windows did not return a PNG shell icon for ${icon.key}`,
      );
    }
  });

  it("returns complete 32-by-32 RGBA PNGs from the Windows shell", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "unicode", path: "sample.測試", isDirectory: false },
          { key: "directory", path: "C:\\not-used-for-directory-icons", isDirectory: true },
        ],
      },
    });

    for (const icon of response.icons) {
      const png = decodePngDataUrl(icon.dataUrl, icon.key);
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(png.toString("ascii", 12, 16), "IHDR");
      assert.equal(png.readUInt32BE(16), 32);
      assert.equal(png.readUInt32BE(20), 32);
      assert.equal(png[24], 8, "Windows icon PNG should use eight-bit channels");
      assert.equal(png[25], 6, "Windows icon PNG should use RGBA color");
    }
  });

  it("uses case-insensitive Windows extension lookup for shell icons", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "lower", path: "sample.zip", isDirectory: false },
          { key: "upper", path: "sample.ZIP", isDirectory: false },
        ],
      },
    });

    assert.equal(response.icons.length, 2);
    assert.equal(response.icons[0]?.dataUrl, response.icons[1]?.dataUrl);
  });

  it("returns no invented shell icons for an empty Windows request", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", { request: { entries: [] } });
    assert.deepEqual(response, { icons: [] });
  });

  it("keeps Windows directory validation and missing-path handling distinct", async () => {
    const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
    const existing = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", {
      request: { path: windowsRoot },
    });
    assert.deepEqual(existing, {
      exists: true,
      isDirectory: true,
      accessible: true,
    });

    const missing = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", {
      request: { path: `${windowsRoot}\\zmanager-tauri-test-path-that-does-not-exist` },
    });
    assert.deepEqual(missing, {
      exists: false,
      isDirectory: false,
      accessible: false,
    });
  });

  it("distinguishes a Windows file from a directory", async () => {
    const filePath = process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe";
    const response = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", { request: { path: filePath } });
    assert.deepEqual(response, {
      exists: true,
      isDirectory: false,
      accessible: false,
    });
  });

  it("accepts Windows directory paths with alternate casing and a trailing separator", async () => {
    const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
    const alternateCase = windowsRoot.replace(/[A-Za-z]/g, (character) => (
      character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase()
    ));
    const response = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", { request: { path: `${alternateCase}\\` } });

    assert.deepEqual(response, { exists: true, isDirectory: true, accessible: true });
  });

  it("writes Windows diagnostics next to the running executable", async () => {
    const info = await invoke<DiagnosticLogInfo>("diagnostic_log_info");
    const appBinary = process.env.ZMANAGER_GUI_APP_PATH ?? path.resolve(
      "src-tauri",
      "target",
      "debug",
      "zmanager-desktop.exe",
    );
    const expectedPath = path.join(path.dirname(appBinary), "logs", "zmanager-diagnostics.log");

    assert.equal(info.enabled, true);
    assert.equal(info.location, "installation");
    assert.ok(info.path);
    assert.equal(normalizeWindowsPath(info.path), normalizeWindowsPath(expectedPath));
    assert.match(info.sessionId, /^\d+-\d+$/);
  });

  it("persists and redacts a diagnostic event through the real Windows command", async () => {
    const info = await invoke<DiagnosticLogInfo>("diagnostic_log_info");
    assert.ok(info.path, "Windows diagnostic log path is unavailable");
    const marker = `native-windows-${Date.now()}`;
    const password = `test-password-${Date.now()}`;
    const archivePath = `C:\\private\\${marker}.zip`;

    await invoke<void>("record_diagnostic_event", {
      request: {
        scope: "windows.native.e2e",
        name: "redaction-proof",
        fields: { marker, password, archivePath },
      },
    });

    let event: DiagnosticLogEntry | undefined;
    await browser.waitUntil(() => {
      event = readDiagnosticEntries(info.path ?? "").find((candidate) => (
        candidate.sessionId === info.sessionId
        && candidate.scope === "windows.native.e2e"
        && candidate.name === "redaction-proof"
        && candidate.fields.marker === marker
      ));
      return event !== undefined;
    }, {
      timeout: 5_000,
      timeoutMsg: "The Windows diagnostic event was not flushed to disk",
    });

    assert.equal(event?.fields.password, "[REDACTED]");
    assert.equal(event?.fields.archivePath, "[REDACTED_PATH]");
    assert.equal(JSON.stringify(event).includes(password), false);
    assert.equal(JSON.stringify(event).includes(archivePath), false);
  });

  it("uses the decorated Windows frame and advertises the native minimum size", async () => {
    const decorated = await invoke<boolean>("plugin:window|is_decorated", { label: "main" });
    assert.equal(decorated, true);
    assert.equal(
      await browser.execute(() => document.body.classList.contains("custom-window-chrome")),
      false,
    );
    assert.equal(await $('[data-shell-chrome="title"]').isDisplayed(), false);

    const initialMaximized = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
    let currentMaximized = initialMaximized;
    const originalSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
    try {
      if (currentMaximized) {
        await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
        await browser.waitUntil(async () => {
          currentMaximized = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
          return !currentMaximized;
        }, {
          timeout: 5_000,
          timeoutMsg: "Windows native window did not leave maximized state",
        });
      }

      const scaleFactor = await invoke<number>("plugin:window|scale_factor", { label: "main" });
      const nativeMinimum = readNativeMinimumTrackSize();
      const expectedWidth = Math.floor(MIN_WINDOW_WIDTH * scaleFactor);
      const expectedHeight = Math.floor(MIN_WINDOW_HEIGHT * scaleFactor);
      assert.ok(
        nativeMinimum.width >= expectedWidth,
        `Windows native minimum width was not advertised: ${JSON.stringify({ nativeMinimum, expectedWidth })}`,
      );
      assert.ok(
        nativeMinimum.height >= expectedHeight,
        `Windows native minimum height was not advertised: ${JSON.stringify({ nativeMinimum, expectedHeight })}`,
      );
    } finally {
      await invoke<void>("plugin:window|set_size", {
        label: "main",
        value: { Physical: originalSize },
      });
      const restoredMaximized = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
      if (restoredMaximized !== initialMaximized) {
        await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
      }
    }
  });

  it("reports a positive Windows display scale factor", async () => {
    const scaleFactor = await invoke<number>("plugin:window|scale_factor", { label: "main" });
    assert.ok(Number.isFinite(scaleFactor));
    assert.ok(scaleFactor > 0);
  });

  it("reports a valid Windows monitor topology", async () => {
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

  it("keeps the WebView viewport synchronized with the native Windows inner size", async () => {
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

  it("keeps the decorated outer frame larger than the WebView inner area", async () => {
    const [outer, inner] = await Promise.all([
      invoke<NativeWindowSize>("plugin:window|outer_size", { label: "main" }),
      invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" }),
    ]);
    assert.ok(outer.width >= inner.width, JSON.stringify({ outer, inner }));
    assert.ok(outer.height >= inner.height, JSON.stringify({ outer, inner }));
    assert.ok(outer.width > inner.width || outer.height > inner.height, JSON.stringify({ outer, inner }));
  });

  it("keeps the visible Windows window enabled", async () => {
    const [visible, enabled] = await Promise.all([
      invoke<boolean>("plugin:window|is_visible", { label: "main" }),
      invoke<boolean>("plugin:window|is_enabled", { label: "main" }),
    ]);
    assert.equal(visible, true);
    assert.equal(enabled, true);
  });

  it("starts outside fullscreen and minimized states", async () => {
    const [fullscreen, minimized] = await Promise.all([
      invoke<boolean>("plugin:window|is_fullscreen", { label: "main" }),
      invoke<boolean>("plugin:window|is_minimized", { label: "main" }),
    ]);
    assert.equal(fullscreen, false);
    assert.equal(minimized, false);
  });

  it("round-trips the native Windows resizable flag", async () => {
    const initial = await invoke<boolean>("plugin:window|is_resizable", { label: "main" });
    try {
      await invoke<void>("plugin:window|set_resizable", { label: "main", value: !initial });
      assert.equal(await invoke<boolean>("plugin:window|is_resizable", { label: "main" }), !initial);
    } finally {
      await invoke<void>("plugin:window|set_resizable", { label: "main", value: initial });
    }
  });

  it("reports a finite native window position", async () => {
    const position = await invoke<{ x: number; y: number }>("plugin:window|inner_position", { label: "main" });
    assert.ok(Number.isFinite(position.x), JSON.stringify(position));
    assert.ok(Number.isFinite(position.y), JSON.stringify(position));
  });

  it("preserves duplicate Windows shell icon request keys in order", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: {
        entries: [
          { key: "same", path: "first.exe", isDirectory: false },
          { key: "same", path: "second.zip", isDirectory: false },
        ],
      },
    });
    assert.deepEqual(response.icons.map((icon) => icon.key), ["same", "same"]);
    assert.ok(response.icons.every((icon) => icon.dataUrl?.startsWith("data:image/png;base64,")));
  });

  it("uses the generic Windows file icon for a blank file path", async () => {
    const response = await invoke<SystemFileIconResponse>("system_file_icons", {
      request: { entries: [{ key: "blank", path: "   ", isDirectory: false }] },
    });
    assert.equal(response.icons.length, 1);
    assert.match(response.icons[0]?.dataUrl ?? "", /^data:image\/png;base64,/);
  });

  it("trims whitespace before validating a Windows directory", async () => {
    const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
    const response = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", { request: { path: `  ${windowsRoot}  ` } });
    assert.deepEqual(response, { exists: true, isDirectory: true, accessible: true });
  });

  it("rejects an empty Windows directory path without probing the filesystem", async () => {
    const response = await invoke<{
      exists: boolean;
      isDirectory: boolean;
      accessible: boolean;
    }>("validate_directory", { request: { path: "   " } });
    assert.deepEqual(response, { exists: false, isDirectory: false, accessible: false });
  });

  it("round-trips the real Windows maximize state without losing the normal window", async () => {
    const initial = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
    let current = initial;

    try {
      await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
      await browser.waitUntil(async () => {
        current = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
        return current !== initial;
      }, {
        timeout: 5_000,
        timeoutMsg: "Windows native maximize state did not change",
      });

      await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
      await browser.waitUntil(async () => {
        current = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
        return current === initial;
      }, {
        timeout: 5_000,
        timeoutMsg: "Windows native maximize state did not restore",
      });
    } finally {
      if (current !== initial) {
        await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
      }
    }
  });
});

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return browser.tauri.execute(
    ({ core }, payload: { command: string; args?: Record<string, unknown> }) =>
      payload.args === undefined
        ? core.invoke(payload.command)
        : core.invoke(payload.command, payload.args),
    { command, args },
  ) as Promise<T>;
}

function readNativeMinimumTrackSize(): NativeWindowSize {
  const scriptPath = path.join(process.cwd(), "scripts", "read-windows-min-track-size.ps1");
  const output = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-ProcessName", "zmanager-desktop"],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output) as { minTrackWidth: number; minTrackHeight: number };
  return { width: result.minTrackWidth, height: result.minTrackHeight };
}

function decodePngDataUrl(dataUrl: string | null, key: string): Buffer {
  assert.ok(dataUrl, `Windows did not return an icon for ${key}`);
  const encoded = dataUrl.replace(/^data:image\/png;base64,/, "");
  assert.notEqual(encoded, dataUrl, `Windows icon ${key} is not a PNG data URL`);
  return Buffer.from(encoded, "base64");
}

function normalizeWindowsPath(value: string): string {
  return path.resolve(value).replaceAll("/", "\\").toLowerCase();
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
