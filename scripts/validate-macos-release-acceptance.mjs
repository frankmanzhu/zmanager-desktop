import { readFileSync } from "node:fs";

const requiredCheckIds = [
  "bundle.release-gate",
  "install.clean",
  "launch.cold-warm-reopen",
  "associations.unique-owners",
  "menu-services.routing",
  "finder.actions",
  "quicklook.preview-thumbnail",
  "spotlight.metadata",
  "default-handlers.restore",
  "drag.file-promises",
  "migration.upgrade-retry",
  "migration.rollback",
  "uninstall.cleanup",
];
const allowedStatuses = new Set(["passed", "blocked", "failed"]);
const argv = process.argv.slice(2);
if (argv.length < 1) {
  console.error(
    "usage: validate-macos-release-acceptance.mjs RECORD [--require-passed] [--version VERSION] [--build BUILD] [--arch ARCH]",
  );
  process.exit(2);
}
const recordPath = argv.shift();
const options = {
  requirePassed: false,
  version: undefined,
  build: undefined,
  arch: undefined,
};
while (argv.length > 0) {
  const flag = argv.shift();
  if (flag === "--require-passed") {
    options.requirePassed = true;
    continue;
  }
  if (!["--version", "--build", "--arch"].includes(flag) || argv.length === 0) {
    console.error(`invalid or incomplete option: ${flag}`);
    process.exit(2);
  }
  const value = argv.shift();
  if (flag === "--version") options.version = value;
  if (flag === "--build") options.build = value;
  if (flag === "--arch") options.arch = value;
}
if (options.arch && !["arm64", "x86_64"].includes(options.arch)) {
  console.error(`unsupported architecture: ${options.arch}`);
  process.exit(2);
}

let record;
try {
  record = JSON.parse(readFileSync(recordPath, "utf8"));
} catch (error) {
  console.error(`acceptance record could not be read: ${error.message}`);
  process.exit(1);
}
const errors = [];
if (record.schemaVersion !== 2) errors.push("unsupported schemaVersion");
if (!allowedStatuses.has(record.status)) errors.push("invalid overall status");
if (!/^\d+\.\d+\.\d+$/.test(record.release?.version ?? ""))
  errors.push("invalid release version");
if (!/^[1-9]\d*$/.test(String(record.release?.buildNumber ?? "")))
  errors.push("invalid release build number");
if (options.version && record.release?.version !== options.version)
  errors.push("release version mismatch");
if (options.build && String(record.release?.buildNumber) !== options.build)
  errors.push("release build-number mismatch");

const environments = Array.isArray(record.environments)
  ? record.environments
  : [];
for (const architecture of ["arm64", "x86_64"]) {
  const matches = environments.filter(
    (environment) => environment.architecture === architecture,
  );
  if (matches.length !== 1)
    errors.push(`expected exactly one ${architecture} acceptance environment`);
}
for (const environment of environments) {
  const label = environment.architecture ?? "unknown";
  if (!allowedStatuses.has(environment.status))
    errors.push(`${label} has invalid status`);
  if (String(environment.buildNumber) !== String(record.release?.buildNumber))
    errors.push(`${label} build number differs from release`);
  for (const field of [
    "name",
    "osVersion",
    "filesystemCaseMode",
    "account",
    "signing",
  ]) {
    if (
      typeof environment[field] !== "string" ||
      environment[field].trim() === ""
    )
      errors.push(`${label} is missing ${field}`);
  }
  const checks = Array.isArray(environment.checks) ? environment.checks : [];
  const ids = checks.map((check) => check.id);
  if (new Set(ids).size !== ids.length)
    errors.push(`${label} contains duplicate check identifiers`);
  for (const required of requiredCheckIds)
    if (!ids.includes(required)) errors.push(`${label} is missing ${required}`);
  for (const id of ids)
    if (!requiredCheckIds.includes(id))
      errors.push(`${label} contains unknown check ${id}`);
  for (const check of checks) {
    if (!allowedStatuses.has(check.status))
      errors.push(`${label} ${check.id} has invalid status`);
    if (typeof check.evidence !== "string" || check.evidence.trim().length < 12)
      errors.push(`${label} ${check.id} has insufficient evidence`);
  }
}

const selected = options.arch
  ? environments.filter(
      (environment) => environment.architecture === options.arch,
    )
  : environments;
if (options.requirePassed) {
  if (record.status !== "passed")
    errors.push(`overall acceptance is ${record.status}, not passed`);
  for (const environment of selected) {
    if (environment.status !== "passed")
      errors.push(
        `${environment.architecture} acceptance is ${environment.status}`,
      );
    for (const check of environment.checks ?? []) {
      if (check.status !== "passed")
        errors.push(
          `${environment.architecture} ${check.id} is ${check.status}`,
        );
    }
  }
}
if (
  record.status === "passed" &&
  environments.some((environment) => environment.status !== "passed")
) {
  errors.push(
    "overall acceptance cannot pass while an architecture is not passed",
  );
}

if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}
console.log(
  `macOS release acceptance record valid: ${record.status}${options.arch ? ` (${options.arch})` : ""}`,
);
