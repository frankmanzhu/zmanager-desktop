import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run version:set -- <major.minor.patch[-prerelease][+build]>");
  process.exit(2);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = readJson("package.json");
packageJson.version = version;
writeJson("package.json", packageJson);

const packageLock = readJson("package-lock.json");
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;
writeJson("package-lock.json", packageLock);

const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf8");
const cargoVersionPattern = /(\[workspace\.package\][\s\S]*?^version\s*=\s*")[^"]+(")/m;
if (!cargoVersionPattern.test(cargo)) throw new Error("[workspace.package] version is missing from src-tauri/Cargo.toml");
const updatedCargo = cargo.replace(
  cargoVersionPattern,
  `$1${version}$2`,
);
writeFileSync(cargoPath, updatedCargo);

const tauri = readJson("src-tauri/tauri.conf.json");
tauri.version = version;
writeJson("src-tauri/tauri.conf.json", tauri);

for (const path of [
  "crates/zmanager-shell-contract/Cargo.toml",
  "native/windows-shell-extension/Cargo.toml",
]) {
  const manifestPath = resolve(root, path);
  const manifest = readFileSync(manifestPath, "utf8");
  const manifestVersionPattern = /^(version\s*=\s*")[^"]+(")/m;
  if (!manifestVersionPattern.test(manifest)) throw new Error(`package version is missing from ${path}`);
  const updatedManifest = manifest.replace(manifestVersionPattern, `$1${version}$2`);
  writeFileSync(manifestPath, updatedManifest);
}

const finderInfoPath = resolve(root, "packaging/macos/FinderExtension/Info.plist");
const finderInfo = readFileSync(finderInfoPath, "utf8");
const finderVersionPattern = /(<key>CFBundleShortVersionString<\/key><string>)[^<]+(<\/string>)/;
if (!finderVersionPattern.test(finderInfo)) throw new Error("Finder extension product version is missing");
const updatedFinderInfo = finderInfo.replace(
  finderVersionPattern,
  `$1${version}$2`,
);
writeFileSync(finderInfoPath, updatedFinderInfo);

const generated = spawnSync(process.execPath, ["scripts/generate-native-contracts.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (generated.status !== 0) process.exit(generated.status ?? 1);

const consistency = spawnSync(process.execPath, ["scripts/check-product-version-consistency.mjs"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(consistency.status ?? 1);
