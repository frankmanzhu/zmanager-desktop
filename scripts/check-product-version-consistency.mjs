import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function checkVersionConsistency(records) {
  const expected = records.find((record) => record.name === "package.json")?.version;
  if (!expected) throw new Error("package.json canonical version is missing");
  const mismatches = records.filter((record) => record.version !== expected);
  if (mismatches.length) {
    throw new Error(`product version mismatch; expected ${expected}: ${mismatches.map(({ name, version }) => `${name}=${version}`).join(", ")}`);
  }
  return expected;
}

export function readWorkspaceVersions(workspaceRoot = root) {
  const packageJson = JSON.parse(readFileSync(resolve(workspaceRoot, "package.json"), "utf8"));
  const tauri = JSON.parse(readFileSync(resolve(workspaceRoot, "src-tauri/tauri.conf.json"), "utf8"));
  const cargo = readFileSync(resolve(workspaceRoot, "src-tauri/Cargo.toml"), "utf8");
  const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  return [
    { name: "package.json", version: packageJson.version },
    { name: "src-tauri/Cargo.toml", version: cargoVersion },
    { name: "src-tauri/tauri.conf.json", version: tauri.version }
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const version = checkVersionConsistency(readWorkspaceVersions());
    console.log(`product version is consistent: ${version}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
