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

describe("desktop startup window", () => {
  it("starts hidden so quick actions can choose the compact panel before first show", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "src-tauri", "tauri.conf.json"), "utf8"),
    ) as { app?: { windows?: Array<{ visible?: boolean }> } };
    const mainWindow = config.app?.windows?.[0];

    expect(mainWindow?.visible).toBe(false);
  });

  it("does not show the native window from Rust setup before frontend startup routing", () => {
    const mainRs = readFileSync(join(process.cwd(), "src-tauri", "src", "main.rs"), "utf8");
    const setupStart = mainRs.indexOf(".setup(move |app|");
    expect(setupStart).toBeGreaterThan(-1);
    const invokeHandlerStart = mainRs.indexOf(".invoke_handler", setupStart);
    expect(invokeHandlerStart).toBeGreaterThan(setupStart);

    expect(mainRs.slice(setupStart, invokeHandlerStart)).not.toContain(".show()");
  });

  it("uses app-owned Linux chrome without changing Windows native decorations", () => {
    const mainRs = readFileSync(join(process.cwd(), "src-tauri", "src", "main.rs"), "utf8");

    expect(mainRs).toContain("#[cfg(target_os = \"linux\")]\n                let _ = window.set_decorations(false);");
    expect(mainRs).not.toContain("#[cfg(target_os = \"windows\")]\n                let _ = window.set_decorations(false);");
  });
});
