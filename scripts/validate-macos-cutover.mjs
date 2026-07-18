import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const replacement = read("docs/migration/macos-replacement-parity.json");
const native = read("docs/migration/macos-native-capability-parity.json");
const acceptance = read("docs/migration/macos-release-acceptance.json");
const cutover = read("docs/migration/macos-cutover.json");
const legacy = read("docs/migration/frontend-legacy-gui-allowlist.json");
const errors = [];

for (const entry of replacement.entries) {
  if (!["verified", "retired"].includes(entry.status)) errors.push(`replacement parity ${entry.id} is ${entry.status}`);
}
for (const entry of native.entries) {
  if (!["verified", "not-applicable"].includes(entry.status)) errors.push(`native parity ${entry.id} is ${entry.status}`);
}
if (acceptance.status !== "passed") errors.push(`release acceptance is ${acceptance.status}`);
for (const environment of acceptance.environments ?? []) {
  if (environment.status !== "passed") errors.push(`release acceptance ${environment.architecture} is ${environment.status}`);
  for (const check of environment.checks ?? []) {
    if (check.status !== "passed") errors.push(`release acceptance ${environment.architecture} ${check.id} is ${check.status}`);
  }
}
if (legacy.entries.length !== 0) errors.push(`legacy GUI allowlist still contains ${legacy.entries.length} files`);
if (legacy.legacyCss !== null || existsSync(resolve(root, "src/styles.css"))) errors.push("legacy raw CSS ownership still exists");
if (readFileSync(resolve(root, "src/styles.tailwind.css"), "utf8").includes("styles.css")) errors.push("Tailwind still imports legacy raw CSS");
if (cutover.status !== "authorized") errors.push(`cutover record is ${cutover.status}`);
for (const [key, value] of Object.entries(cutover.oldRepository ?? {})) if (value !== true) errors.push(`old repository retirement step ${key} is not complete`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("macOS replacement cutover gate passed");
