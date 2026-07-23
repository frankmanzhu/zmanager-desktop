import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

const baseline = await readJson("fixtures/contracts/native-integration-baseline.json");

function profileFromRust(source) {
  const match = source.match(
    /fn integration_profile\(\) -> PlatformProfile \{\s*PlatformProfile \{([\s\S]*?)\n\s*}\n\s*}/,
  );
  assert.ok(match, "integration profile block should exist");
  const block = match[1];
  const boolean = (field) => {
    const fieldMatch = block.match(new RegExp(`${field}: ([A-Z_]+|true|false)`));
    assert.ok(fieldMatch, `${field} should have a characterization value`);
    if (fieldMatch[1] === "true" || fieldMatch[1] === "false") {
      return fieldMatch[1] === "true";
    }
    const constant = source.match(new RegExp(`const ${fieldMatch[1]}: bool = (true|false);`));
    assert.ok(constant, `${fieldMatch[1]} should be a literal boolean constant`);
    return constant[1] === "true";
  };
  return {
    windowDecorations: boolean("window_decorations"),
    customWindowChrome: boolean("custom_window_chrome"),
    manualWindowResize: boolean("manual_window_resize"),
    nativeMenuBar: boolean("native_menu_bar"),
  };
}

function commandIds(source) {
  return [...source.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function nativeMenuCommandIds(source) {
  return [...source.matchAll(/menu_command\(app,\s*"([^"]+)"/g)].map((match) => match[1]);
}

function numericConstant(source, name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `${name} should exist`);
  return Number(match[1]);
}

test("WP0 baseline captures the flat platform profiles before capability migration", async () => {
  for (const platform of ["windows", "linux", "macos"]) {
    const source = await readText(`src-tauri/src/platform/${platform}.rs`);
    const historical = baseline.platformProfiles[platform];
    assert.deepEqual(profileFromRust(source), {
      windowDecorations: historical.windowDecorations,
      customWindowChrome: historical.customWindowChrome,
      manualWindowResize: historical.manualWindowResize,
      nativeMenuBar: historical.nativeMenuBar,
    });
  }
});

test("generated association catalog preserves every WP0 Tauri association", async () => {
  const tauriConfig = await readJson("src-tauri/tauri.conf.json");
  const actual = tauriConfig.bundle.fileAssociations.map((entry) => ({
    extensions: entry.ext,
    mimeType: entry.mimeType,
  }));
  for (const historical of baseline.tauriFileAssociations) {
    const generated = actual.find((entry) => entry.mimeType === historical.mimeType);
    assert.ok(generated, `missing historical MIME type ${historical.mimeType}`);
    for (const extension of historical.extensions) {
      assert.ok(
        generated.extensions.includes(extension),
        `${historical.mimeType} lost ${extension}`,
      );
    }
  }
});

test("WP0 baseline captures the independently maintained application menus", async () => {
  const classicCommands = await readText("src/app/classicCommands.ts");
  const classicMenuBlock = classicCommands
    .split("export const CLASSIC_MENU_GROUPS", 2)[1]
    .split("export const CLASSIC_TOOLBAR_GROUPS", 1)[0];
  assert.deepEqual(commandIds(classicMenuBlock), baseline.applicationMenus.reactCommandIds);

  const macos = await readText("src-tauri/src/platform/macos.rs");
  const macosMenuBlock = macos.split("fn build_macos_menu", 2)[1].split("fn call_json_operation", 1)[0];
  assert.deepEqual(
    nativeMenuCommandIds(macosMenuBlock),
    baseline.applicationMenus.macosApplicationOwnedCommandIds,
  );

  const nativeMenu = await readText("src/desktop/nativeMenu.ts");
  const allowlistBlock = nativeMenu.split("const NATIVE_MENU_COMMANDS", 2)[1].split("]);", 1)[0];
  const allowlist = [...allowlistBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(allowlist, baseline.applicationMenus.frontendNativeMenuAllowlist);
});

test("WP0 baseline captures current window creation settings", async () => {
  const tauriConfig = await readJson("src-tauri/tauri.conf.json");
  const main = tauriConfig.app.windows[0];
  assert.deepEqual(
    {
      width: main.width,
      height: main.height,
      minWidth: main.minWidth,
      minHeight: main.minHeight,
      visible: main.visible,
    },
    baseline.windowSettings.main,
  );

  const windowController = await readText("src/desktop/windowController.ts");
  assert.deepEqual(
    {
      width: numericConstant(windowController, "QUICK_ACTION_WINDOW_WIDTH_PX"),
      height: numericConstant(windowController, "QUICK_ACTION_WINDOW_HEIGHT_PX"),
      minWidth: numericConstant(windowController, "QUICK_ACTION_WINDOW_MIN_WIDTH_PX"),
      minHeight: numericConstant(windowController, "QUICK_ACTION_WINDOW_MIN_HEIGHT_PX"),
    },
    baseline.windowSettings.quickActionMain,
  );

  const disposable = await readText("src/desktop/disposableTaskWindowManager.ts");
  const optionsMatch = disposable.match(/createWindow\(label, \{([\s\S]*?)\n\s*}\);/);
  assert.ok(optionsMatch, "Disposable Task Window options should exist");
  const options = optionsMatch[1];
  const value = (name) => {
    const match = options.match(new RegExp(`${name}: (\\d+|true|false)`));
    assert.ok(match, `${name} should have a literal characterization value`);
    return match[1] === "true" ? true : match[1] === "false" ? false : Number(match[1]);
  };
  assert.deepEqual(
    {
      width: value("width"),
      height: value("height"),
      minWidth: value("minWidth"),
      minHeight: value("minHeight"),
      center: value("center"),
      resizable: value("resizable"),
      visible: value("visible"),
    },
    baseline.windowSettings.disposableTask,
  );
});

test("WP0 baseline captures package artifact naming before version repair", async () => {
  const sources = {
    windowsSmoke: await readText("scripts/smoke-windows-static.ps1"),
    windowsReleaseGate: await readText("scripts/release-gate-windows-static.ps1"),
    windowsBuildGlob: await readText("scripts/build-windows-static.ps1"),
    linuxDebGlob: await readText("scripts/build-linux-ubuntu-deb.sh"),
    linuxRpmGlob: await readText("scripts/build-linux-fedora-rpm.sh"),
    macosBuildTemplate: await readText("scripts/build-macos.sh"),
  };
  for (const [key, expected] of Object.entries(baseline.packageArtifactExpectations)) {
    assert.ok(sources[key].includes(expected), `${key} should contain ${expected}`);
  }
});
