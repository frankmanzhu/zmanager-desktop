import assert from "node:assert/strict";

type NativeCapability = {
  id: string;
  sourceState: string;
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

  it("publishes the command seam required by the Windows shell workflow", async () => {
    const contract = await invoke<ProjectContract>("project_contract");
    for (const command of ["healthcheck", "project_contract"]) {
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

  it("uses the decorated Windows frame and enforces the native minimum size", async () => {
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
    let observedSize = originalSize;
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

      await invoke<void>("plugin:window|set_min_size", {
        label: "main",
        value: { Logical: { width: MIN_WINDOW_WIDTH, height: MIN_WINDOW_HEIGHT } },
      });
      await invoke<void>("plugin:window|set_size", {
        label: "main",
        value: { Logical: { width: 320, height: 240 } },
      });
      await browser.waitUntil(async () => {
        observedSize = await invoke<NativeWindowSize>("plugin:window|inner_size", { label: "main" });
        return observedSize.width >= MIN_WINDOW_WIDTH && observedSize.height >= MIN_WINDOW_HEIGHT;
      }, {
        timeout: 5_000,
        timeoutMsg: `Windows native minimum size was not enforced: ${JSON.stringify(observedSize)}`,
      });
    } finally {
      await invoke<void>("plugin:window|set_size", {
        label: "main",
        value: { Physical: originalSize },
      });
      await invoke<void>("plugin:window|set_min_size", { label: "main", value: null });
      const restoredMaximized = await invoke<boolean>("plugin:window|is_maximized", { label: "main" });
      if (restoredMaximized !== initialMaximized) {
        await invoke<void>("plugin:window|toggle_maximize", { label: "main" });
      }
    }
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
