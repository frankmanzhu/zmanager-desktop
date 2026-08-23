import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("macOS build bootstraps generated UniFFI Swift sources before Cargo", () => {
  const build = readFileSync(resolve(root, "scripts/build-macos.sh"), "utf8");
  const sync = build.indexOf("scripts/sync-uniffi-swift-bindings.sh");
  const cargoTest = build.indexOf("(cd src-tauri && cargo test)");
  const tauriBuild = build.indexOf("npm run tauri");

  assert.notEqual(sync, -1, "macOS build must sync UniFFI Swift sources");
  assert.ok(cargoTest === -1 || sync < cargoTest, "sync must precede macOS Cargo tests");
  assert.ok(sync < tauriBuild, "sync must precede the Tauri macOS build");
});

test("macOS package CI syncs UniFFI Swift sources before Cargo validation", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/package.yml"), "utf8");
  const sync = workflow.indexOf("scripts/sync-uniffi-swift-bindings.sh");
  const cargo = workflow.indexOf("cargo clippy");

  assert.notEqual(sync, -1, "package CI must sync UniFFI Swift sources");
  assert.ok(sync < cargo, "package CI sync must precede Cargo validation");
});

test("macOS release CI syncs UniFFI Swift sources before Cargo validation", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8");
  const sync = workflow.indexOf("scripts/sync-uniffi-swift-bindings.sh");
  const cargo = workflow.indexOf("cargo clippy");

  assert.notEqual(sync, -1, "release CI must sync UniFFI Swift sources");
  assert.ok(sync < cargo, "release CI sync must precede Cargo validation");
});
