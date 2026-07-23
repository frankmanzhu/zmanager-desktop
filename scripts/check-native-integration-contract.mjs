import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findFrontendPlatformSelectionViolations,
  validateNativeCapabilityManifest,
} from "./lib/native-capability-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(repoRoot, "manifests/native-capabilities.json"), "utf8"),
);
validateNativeCapabilityManifest(manifest);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(absolute));
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

const violations = [];
for (const absolute of await sourceFiles(path.join(repoRoot, "src"))) {
  const relative = path.relative(repoRoot, absolute);
  violations.push(
    ...findFrontendPlatformSelectionViolations(relative, await readFile(absolute, "utf8")),
  );
}

const transitionalOwners = new Set([
  "src/api/types.ts",
  "src/app/display/dialogSnapshots.ts",
  "src/runtime/zmanagerRuntimeAdapter.ts",
]);
for (const absolute of await sourceFiles(path.join(repoRoot, "src"))) {
  const relative = path.relative(repoRoot, absolute);
  const source = await readFile(absolute, "utf8");
  if (source.includes("transitionalPlatformProfile") && !transitionalOwners.has(relative)) {
    violations.push(`${relative}: transitional platform profile has a new production caller`);
  }
}

if (violations.length) {
  throw new Error(
    `Native Integration Contract architecture violations:\n${violations.join("\n")}`,
  );
}

console.log(
  `Native Integration Contract valid: ${manifest.capabilities.length} capabilities, no frontend platform selection`,
);
