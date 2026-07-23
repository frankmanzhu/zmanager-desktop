import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildBaselineCapabilitySnapshots,
  findFrontendPlatformSelectionViolations,
  validateCapabilitySnapshots,
  validateNativeCapabilityManifest,
} from "./lib/native-capability-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(repoRoot, "manifests/native-capabilities.json"), "utf8"),
);
const clone = (value) => structuredClone(value);

test("native capability catalog is complete and valid", () => {
  assert.equal(validateNativeCapabilityManifest(manifest), manifest);
});

test("frontend platform-name branches are rejected in favor of capabilities", () => {
  assert.deepEqual(
    findFrontendPlatformSelectionViolations(
      "src/example.ts",
      'if (contract.platformIntegration.platform === "macos") run();',
    ),
    [
      'src/example.ts:1:platformIntegration.platform === "macos"',
    ],
  );
  assert.deepEqual(
    findFrontendPlatformSelectionViolations(
      "src/example.ts",
      'isNativeCapabilityAvailable(capabilities, "nativeApplicationMenu")',
    ),
    [],
  );
});

test("catalog rejects unknown, duplicate, and missing capabilities", () => {
  const unknown = clone(manifest);
  unknown.capabilities[0].id = "unknownCapability";
  assert.throws(() => validateNativeCapabilityManifest(unknown), /unknown capabilities/);

  const duplicate = clone(manifest);
  duplicate.capabilities[1].id = duplicate.capabilities[0].id;
  assert.throws(() => validateNativeCapabilityManifest(duplicate), /contains duplicates/);

  const missing = clone(manifest);
  missing.capabilities.pop();
  assert.throws(() => validateNativeCapabilityManifest(missing), /missing capabilities/);
});

test("catalog rejects missing applicability and incomplete evidence", () => {
  const applicability = clone(manifest);
  delete applicability.capabilities[0].applicability.linux;
  assert.throws(() => validateNativeCapabilityManifest(applicability), /keys must be exactly/);

  const packageEvidence = clone(manifest);
  packageEvidence.capabilities[0].evidence.package = [];
  assert.throws(
    () => validateNativeCapabilityManifest(packageEvidence),
    /package expectations without package evidence/,
  );

  const installedEvidence = clone(manifest);
  installedEvidence.capabilities[0].evidence.installed = [];
  assert.throws(
    () => validateNativeCapabilityManifest(installedEvidence),
    /installed probes without installed evidence/,
  );
});

test("baseline snapshots distinguish every contract layer and normalized outcome", () => {
  const snapshots = buildBaselineCapabilitySnapshots(manifest, "macos", "development");
  validateCapabilitySnapshots(manifest, "macos", "development", snapshots);

  const nativeMenu = snapshots.find(({ id }) => id === "nativeApplicationMenu");
  assert.deepEqual(
    {
      source: nativeMenu.sourceState,
      package: nativeMenu.packageState,
      installed: nativeMenu.installedState,
      user: nativeMenu.userEnabledState,
      runtime: nativeMenu.runtimeState,
      availability: nativeMenu.availability,
    },
    {
      source: "supported",
      package: "notInspected",
      installed: "notApplicable",
      user: "notApplicable",
      runtime: "ready",
      availability: "available",
    },
  );

  const finder = snapshots.find(({ id }) => id === "finderTokenTransport");
  assert.equal(finder.sourceState, "supported");
  assert.equal(finder.packageState, "notIncluded");
  assert.equal(finder.installedState, "notInspected");
  assert.equal(finder.userEnabledState, "notInspected");
  assert.equal(finder.runtimeState, "notInspected");
  assert.equal(finder.availability, "unavailable");

  const windowsOnly = buildBaselineCapabilitySnapshots(manifest, "windows", "development")
    .find(({ id }) => id === "finderTokenTransport");
  assert.equal(windowsOnly.availability, "notApplicable");
});

test("available snapshots fail closed without source, package, registration, user, or runtime proof", () => {
  const snapshots = buildBaselineCapabilitySnapshots(manifest, "macos", "macosApp");
  const finder = snapshots.find(({ id }) => id === "finderTokenTransport");

  for (const [field, value, expected] of [
    ["sourceState", "unavailable", /lacks source support/],
    ["packageState", "notIncluded", /is not in macosApp/],
    ["installedState", "notInspected", /is not registered/],
    ["userEnabledState", "notInspected", /is not user-enabled/],
    ["runtimeState", "notInspected", /is not runtime-ready/],
  ]) {
    const invalid = clone(snapshots);
    const candidate = invalid.find(({ id }) => id === finder.id);
    Object.assign(candidate, {
      sourceState: "supported",
      packageState: "notInspected",
      installedState: "registered",
      userEnabledState: "enabled",
      runtimeState: "ready",
      availability: "available",
      [field]: value,
    });
    assert.throws(
      () => validateCapabilitySnapshots(manifest, "macos", "macosApp", invalid),
      expected,
    );
  }
});
