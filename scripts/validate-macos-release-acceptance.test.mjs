import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("..", import.meta.url);
const validator = new URL(
  "validate-macos-release-acceptance.mjs",
  import.meta.url,
);
const baseline = JSON.parse(
  readFileSync(
    new URL("docs/migration/macos-release-acceptance.json", root),
    "utf8",
  ),
);

function validate(record, ...args) {
  const directory = mkdtempSync(join(tmpdir(), "zmanager-acceptance-test-"));
  const path = join(directory, "record.json");
  try {
    writeFileSync(path, `${JSON.stringify(record)}\n`);
    return spawnSync(process.execPath, [validator.pathname, path, ...args], {
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function passedRecord() {
  const record = structuredClone(baseline);
  record.status = "passed";
  for (const environment of record.environments) {
    environment.status = "passed";
    for (const check of environment.checks) check.status = "passed";
  }
  return record;
}

test("accepts the blocked evidence record structurally and rejects it as release proof", () => {
  assert.equal(validate(baseline).status, 0);
  const result = validate(baseline, "--require-passed", "--arch", "arm64");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /arm64 acceptance is blocked/);
});

test("requires a complete check matrix for each architecture", () => {
  const missingEnvironment = structuredClone(baseline);
  missingEnvironment.environments = missingEnvironment.environments.filter(
    ({ architecture }) => architecture !== "x86_64",
  );
  assert.match(validate(missingEnvironment).stderr, /exactly one x86_64/);

  const missingCheck = structuredClone(baseline);
  missingCheck.environments[0].checks.pop();
  assert.match(validate(missingCheck).stderr, /missing uninstall\.cleanup/);
});

test("binds architecture evidence to the release build and rejects unknown checks", () => {
  const wrongBuild = structuredClone(baseline);
  wrongBuild.environments[1].buildNumber = "999";
  assert.match(validate(wrongBuild).stderr, /x86_64 build number differs/);

  const unknownCheck = structuredClone(baseline);
  unknownCheck.environments[0].checks.push({
    id: "unrecorded.check",
    status: "passed",
    evidence: "should be rejected",
  });
  assert.match(
    validate(unknownCheck).stderr,
    /unknown check unrecorded\.check/,
  );
});

test("accepts only a fully passed record for protected publication", () => {
  const record = passedRecord();
  assert.equal(
    validate(
      record,
      "--require-passed",
      "--version",
      "1.1.0",
      "--build",
      record.release.buildNumber,
      "--arch",
      "arm64",
    ).status,
    0,
  );
  record.environments[1].status = "blocked";
  assert.match(
    validate(record, "--require-passed", "--arch", "x86_64").stderr,
    /x86_64 acceptance is blocked/,
  );
});
