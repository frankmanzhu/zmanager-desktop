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

test("macOS linkers include SystemConfiguration for system proxy support", () => {
  const rustBuild = readFileSync(resolve(root, "src-tauri/build.rs"), "utf8");
  const nativeBuild = readFileSync(resolve(root, "scripts/build-macos-native-targets.sh"), "utf8");

  assert.match(
    rustBuild,
    /cargo:rustc-link-lib=framework=SystemConfiguration/,
    "Tauri's macOS final link must include SystemConfiguration",
  );
  assert.match(
    nativeBuild,
    /-framework CoreFoundation -framework Security -framework SystemConfiguration/,
    "UniFFI extension linkers must include SystemConfiguration",
  );
});

test("macOS artifact packaging reports and validates every post-build boundary", () => {
  const build = readFileSync(resolve(root, "scripts/build-macos.sh"), "utf8");

  assert.match(build, /run_packaging_step "stage application" ditto/);
  assert.match(build, /run_packaging_step "create ZIP" ditto/);
  assert.match(build, /run_packaging_step "stage application for DMG" ditto/);
  assert.match(build, /run_packaging_step "create DMG" hdiutil/);
  assert.match(build, /Staged macOS application is incomplete/);
  assert.match(build, /macOS ZIP was not created/);
  assert.match(build, /macOS DMG was not created/);
});

test("release packaging scripts validate Rust in the release profile", () => {
  const scripts = [
    "scripts/build-macos.sh",
    "scripts/build-linux-ubuntu-deb.sh",
    "scripts/build-linux-fedora-rpm.sh",
  ];

  for (const scriptPath of scripts) {
    const script = readFileSync(resolve(root, scriptPath), "utf8");
    assert.match(script, /cargo test --release\)/, `${scriptPath} must run release tests`);
    if (!scriptPath.endsWith("build-macos.sh")) {
      assert.match(
        script,
        /cargo clippy --release --all-targets --all-features/,
        `${scriptPath} must run release clippy`,
      );
    }
  }
});
