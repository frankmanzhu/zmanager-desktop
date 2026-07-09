import { describe, expect, it } from "vitest";

declare const process: {
  cwd(): string;
};

declare function require(id: "fs"): {
  readFileSync(path: string, encoding: string): string;
};

declare function require(id: "path"): {
  join(...parts: string[]): string;
};

const { readFileSync } = require("fs");
const { join } = require("path");

function readWorkspaceFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8").replace(/\r\n/g, "\n");
}

describe("desktop startup window", () => {
  it("starts hidden so quick actions can choose the compact panel before first show", () => {
    const config = JSON.parse(
      readWorkspaceFile("src-tauri", "tauri.conf.json"),
    ) as { app?: { windows?: Array<{ visible?: boolean }> } };
    const mainWindow = config.app?.windows?.[0];

    expect(mainWindow?.visible).toBe(false);
  });

  it("defaults to a size that fits the desktop panes without initial scrollbars", () => {
    const config = JSON.parse(
      readWorkspaceFile("src-tauri", "tauri.conf.json"),
    ) as { app?: { windows?: Array<{ width?: number; height?: number }> } };
    const mainWindow = config.app?.windows?.[0];

    expect(mainWindow?.width).toBeGreaterThanOrEqual(1280);
    expect(mainWindow?.height).toBeGreaterThanOrEqual(900);
  });

  it("does not show the native window from Rust setup before frontend startup routing", () => {
    const mainRs = readWorkspaceFile("src-tauri", "src", "main.rs");
    const setupStart = mainRs.indexOf(".setup(move |app|");
    expect(setupStart).toBeGreaterThan(-1);
    const invokeHandlerStart = mainRs.indexOf(".invoke_handler", setupStart);
    expect(invokeHandlerStart).toBeGreaterThan(setupStart);

    expect(mainRs.slice(setupStart, invokeHandlerStart)).not.toContain(".show()");
  });

  it("uses app-owned Linux chrome without changing Windows native decorations", () => {
    const mainRs = readWorkspaceFile("src-tauri", "src", "main.rs");

    expect(mainRs).toContain("#[cfg(target_os = \"linux\")]\n                let _ = window.set_decorations(false);");
    expect(mainRs).not.toContain("#[cfg(target_os = \"windows\")]\n                let _ = window.set_decorations(false);");
  });

  it("provides Linux custom chrome resize handles for undecorated windows", () => {
    const legacyMainTs = readWorkspaceFile("src", "legacyMain.ts");
    const appFrameTsx = readWorkspaceFile("src", "ui", "react", "shell", "AppFrame.tsx");
    const windowControllerTs = readWorkspaceFile("src", "desktop", "windowController.ts");
    const styles = readWorkspaceFile("src", "styles.css");

    expect(appFrameTsx).toContain("function WindowResizeHandles()");
    expect(appFrameTsx).toContain("data-window-resize-direction");
    expect(legacyMainTs).toContain("appWindowController.beginResizeDrag(direction)");
    expect(windowControllerTs).toContain("startResizeDragging(direction: AppWindowResizeDirection)");
    expect(styles).toContain("body.linux-window-chrome .window-resize-handle");
  });

  it("centers normal startup when no saved geometry is available", () => {
    const legacyMainTs = readWorkspaceFile("src", "legacyMain.ts");
    const windowControllerTs = readWorkspaceFile("src", "desktop", "windowController.ts");

    expect(legacyMainTs).toContain("await appWindowController.revealNormalWindow();");
    expect(windowControllerTs).toContain("async function restoreNormalWindowGeometryOrCenter()");
    expect(windowControllerTs).toContain("const restored = await restoreNormalWindowGeometry();");
    expect(windowControllerTs).toContain("await dependencies.getCurrentWindow().center();");
    expect(windowControllerTs).toContain("await restoreNormalWindowGeometryOrCenter();");
    expect(windowControllerTs).toContain("await dependencies.getCurrentWindow().show();");
  });

  it("keeps Tauri window and geometry ownership in the desktop adapter", () => {
    const mainTs = readWorkspaceFile("src", "main.ts");
    const legacyMainTs = readWorkspaceFile("src", "legacyMain.ts");
    const windowControllerTs = readWorkspaceFile("src", "desktop", "windowController.ts");

    expect(mainTs).not.toContain("@tauri-apps/api/window");
    expect(legacyMainTs).not.toContain("@tauri-apps/api/window");
    expect(mainTs).not.toMatch(/\bgetCurrentWindow\(/);
    expect(legacyMainTs).not.toMatch(/\bgetCurrentWindow\(/);
    expect(mainTs).not.toMatch(/\bavailableMonitors\(/);
    expect(legacyMainTs).not.toMatch(/\bavailableMonitors\(/);
    expect(mainTs).not.toContain("zmanager.windowGeometry");
    expect(legacyMainTs).not.toContain("zmanager.windowGeometry");
    expect(windowControllerTs).toContain('from "@tauri-apps/api/window"');
    expect(windowControllerTs).toContain('export const WINDOW_GEOMETRY_KEY = "zmanager.windowGeometry";');
    expect(windowControllerTs).toContain("restorableWindowGeometry");
    expect(windowControllerTs).toContain("const scaleFactor = await currentWindow.scaleFactor();");
    expect(windowControllerTs).toContain("monitors = await dependencies.availableMonitors();");
    expect(windowControllerTs).toContain("const size = (await currentWindow.innerSize()).toLogical(scaleFactor);");
    expect(windowControllerTs).toContain("const position = (await currentWindow.innerPosition()).toLogical(scaleFactor);");
    expect(windowControllerTs).toContain('unit: "logical"');
  });

  it("falls back to centering when saved geometry is not restorable on the current monitors", () => {
    const windowControllerTs = readWorkspaceFile("src", "desktop", "windowController.ts");

    expect(windowControllerTs).toContain("const geometry = restorableWindowGeometry(storedGeometry, monitors, scaleFactor);");
    expect(windowControllerTs).toContain("if (!geometry) {\n      return false;\n    }");
    expect(windowControllerTs).toContain("if (!restored) {\n      await dependencies.getCurrentWindow().center();\n    }");
  });
});
