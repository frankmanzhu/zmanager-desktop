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

  it("centers normal startup when no saved geometry is available", () => {
    const mainTs = readWorkspaceFile("src", "main.ts");

    expect(mainTs).toContain("async function placeNormalAppWindowBeforeShow()");
    expect(mainTs).toContain("const restored = await restoreWindowGeometry();");
    expect(mainTs).toContain("if (!restored) {\n    await getCurrentWindow().center();\n  }");
    expect(mainTs).toContain("await placeNormalAppWindowBeforeShow();\n    await getCurrentWindow().show();");
  });

  it("persists desktop window geometry in logical pixels", () => {
    const mainTs = readWorkspaceFile("src", "main.ts");

    expect(mainTs).toContain("restorableWindowGeometry");
    expect(mainTs).toContain("const scaleFactor = await currentWindow.scaleFactor();");
    expect(mainTs).toContain("monitors = await availableMonitors();");
    expect(mainTs).toContain("const size = (await currentWindow.innerSize()).toLogical(scaleFactor);");
    expect(mainTs).toContain("const position = (await currentWindow.innerPosition()).toLogical(scaleFactor);");
    expect(mainTs).toContain('unit: "logical"');
  });

  it("falls back to centering when saved geometry is not restorable on the current monitors", () => {
    const mainTs = readWorkspaceFile("src", "main.ts");

    expect(mainTs).toContain("const geometry = restorableWindowGeometry(storedGeometry, monitors, scaleFactor);");
    expect(mainTs).toContain("if (!geometry) {\n    return false;\n  }");
    expect(mainTs).toContain("if (!restored) {\n    await getCurrentWindow().center();\n  }");
  });
});
