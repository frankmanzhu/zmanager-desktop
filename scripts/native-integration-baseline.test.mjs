import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

const baseline = await readJson("fixtures/contracts/native-integration-baseline.json");



function commandIds(source) {
  return [...source.matchAll(/(?:"?id"?):\s*"([^"]+)"/g)].map((match) => match[1]);
}

function nativeMenuCommandIds(source) {
  return [...source.matchAll(/menu_command\(app,\s*"([^"]+)"/g)].map((match) => match[1]);
}

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
  const generatedTS = await readText("src/api/generated/applicationCommands.generated.ts");
  const classicMenuBlock = generatedTS
    .split("export const CLASSIC_MENU_GROUPS: any[] = ")[1]
    .split("export const CLASSIC_TOOLBAR_GROUPS")[0];
  assert.deepEqual(commandIds(classicMenuBlock), baseline.applicationMenus.reactCommandIds);

  const macosMenuBlock = await readText("src-tauri/src/generated/macos_menu.generated.rs");
  const macosIds = nativeMenuCommandIds(macosMenuBlock);
  assert.deepEqual(
    macosIds,
    baseline.applicationMenus.macosApplicationOwnedCommandIds,
  );

  // The frontend now allows any command defined in the catalog. 
  // We just verify the macOS menu commands exactly match the baseline frontend allowlist.
  assert.deepEqual([...macosIds].sort(), [...baseline.applicationMenus.frontendNativeMenuAllowlist].sort());
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
