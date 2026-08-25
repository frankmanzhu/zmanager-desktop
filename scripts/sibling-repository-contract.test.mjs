import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(scriptsDirectory, "..");

const shellBootstrap = readFileSync(join(scriptsDirectory, "ensure-sibling-repos.sh"), "utf8");
const powershellBootstrap = readFileSync(join(scriptsDirectory, "ensure-sibling-repos.ps1"), "utf8");
const cargoManifest = readFileSync(join(repositoryRoot, "src-tauri", "Cargo.toml"), "utf8");

test("sibling bootstrap provisions the LocalSend path dependency", () => {
  for (const [name, content] of [
    ["shell", shellBootstrap],
    ["PowerShell", powershellBootstrap],
  ]) {
    assert.match(content, /localsend-rs/,
      `${name} bootstrap must mention the localsend-rs sibling repository`);
    assert.match(content, /ZMANAGER_LOCALSEND_REPO/,
      `${name} bootstrap must expose the LocalSend repository override`);
    assert.match(content, /ZMANAGER_LOCALSEND_REF/,
      `${name} bootstrap must expose the LocalSend ref override`);
    assert.match(content, /ZMANAGER_LOCALSEND_DIR/,
      `${name} bootstrap must expose the LocalSend directory override`);
  }
});

test("LocalSend Cargo path dependency has a matching sibling bootstrap entry", () => {
  assert.match(cargoManifest, /zmanager-localsend\s*=\s*\{\s*path\s*=\s*"\.\.\/\.\.\/zmanager\/crates\/zmanager-localsend"/);
  assert.match(shellBootstrap, /ensure_sibling_repo\s+"localsend-rs"/);
  assert.match(powershellBootstrap, /Ensure-SiblingRepo\s+-Name\s+"localsend-rs"/);
});
