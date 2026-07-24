const REQUIRED_CAPABILITY_IDS = [
  "shellSelectedItemActions",
  "shellBackgroundActions",
  "fileAssociations",
  "systemFileIcons",
  "defaultHandlerControl",
  "nativeApplicationMenu",
  "mainWindowPolicy",
  "disposableTaskWindowPolicy",
  "secureLocalFileProtection",
  "nativeFileDrag",
  "finderTokenTransport",
  "nativeHostLifecycle",
  "quickLook",
  "spotlight",
  "diagnosticLog",
  "installedCapabilityInspection",
];

const APPLICABILITY = new Set(["required", "optional", "notApplicable"]);
const SOURCE_EXPECTATIONS = new Set(["implemented", "optionalUnavailable", "notApplicable"]);

function fail(message) {
  throw new Error(`native capability manifest: ${message}`);
}

function requireExactKeys(record, expected, label) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys must be exactly ${wanted.join(", ")}`);
  }
}

function requireUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value)) {
    fail(`${label} must be an array of non-empty strings`);
  }
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) {
    fail(`${label} contains duplicates: ${[...new Set(duplicates)].join(", ")}`);
  }
}

export function validateNativeCapabilityManifest(manifest) {
  requireExactKeys(
    manifest,
    ["schemaVersion", "platforms", "packageKinds", "failureCategories", "capabilities"],
    "root",
  );
  if (manifest.schemaVersion !== 1) fail("schemaVersion must be 1");
  requireUniqueStrings(manifest.platforms, "platforms");
  if (JSON.stringify(manifest.platforms) !== JSON.stringify(["windows", "linux", "macos"])) {
    fail("platforms must be windows, linux, and macos in canonical order");
  }
  requireUniqueStrings(manifest.packageKinds, "packageKinds");
  requireUniqueStrings(manifest.failureCategories, "failureCategories");
  if (!Array.isArray(manifest.capabilities)) fail("capabilities must be an array");

  const ids = manifest.capabilities.map((capability) => capability?.id);
  requireUniqueStrings(ids, "capability identifiers");
  const unknown = ids.filter((id) => !REQUIRED_CAPABILITY_IDS.includes(id));
  const missing = REQUIRED_CAPABILITY_IDS.filter((id) => !ids.includes(id));
  if (unknown.length) fail(`unknown capabilities: ${unknown.join(", ")}`);
  if (missing.length) fail(`missing capabilities: ${missing.join(", ")}`);

  for (const capability of manifest.capabilities) {
    const label = `capability ${capability.id}`;
    requireExactKeys(
      capability,
      [
        "id",
        "firstClass",
        "applicability",
        "sourceExpectation",
        "packageKinds",
        "installedProbe",
        "installedRegistrationRequired",
        "userEnabledState",
        "runtimeProbeRequired",
        "failureCategories",
        "evidence",
      ],
      label,
    );
    if (typeof capability.firstClass !== "boolean") fail(`${label}.firstClass must be boolean`);
    for (const field of [
      "applicability",
      "sourceExpectation",
      "packageKinds",
      "installedProbe",
      "installedRegistrationRequired",
      "userEnabledState",
      "runtimeProbeRequired",
    ]) {
      requireExactKeys(capability[field], manifest.platforms, `${label}.${field}`);
    }
    requireExactKeys(capability.evidence, ["source", "package", "installed"], `${label}.evidence`);
    requireUniqueStrings(capability.failureCategories, `${label}.failureCategories`);
    requireUniqueStrings(capability.evidence.source, `${label}.evidence.source`);
    requireUniqueStrings(capability.evidence.package, `${label}.evidence.package`);
    requireUniqueStrings(capability.evidence.installed, `${label}.evidence.installed`);
    if (!capability.failureCategories.length) fail(`${label} must declare failure categories`);
    for (const category of capability.failureCategories) {
      if (!manifest.failureCategories.includes(category)) {
        fail(`${label} uses unknown failure category ${category}`);
      }
    }

    let applicableCount = 0;
    let packageExpectationCount = 0;
    let installedProbeCount = 0;
    for (const platform of manifest.platforms) {
      const applicability = capability.applicability[platform];
      const source = capability.sourceExpectation[platform];
      if (!APPLICABILITY.has(applicability)) {
        fail(`${label}.applicability.${platform} is invalid`);
      }
      if (!SOURCE_EXPECTATIONS.has(source)) {
        fail(`${label}.sourceExpectation.${platform} is invalid`);
      }
      if (!Array.isArray(capability.packageKinds[platform])) {
        fail(`${label}.packageKinds.${platform} must be an array`);
      }
      requireUniqueStrings(
        capability.packageKinds[platform],
        `${label}.packageKinds.${platform}`,
      );
      for (const packageKind of capability.packageKinds[platform]) {
        if (!manifest.packageKinds.includes(packageKind)) {
          fail(`${label} uses unknown package kind ${packageKind}`);
        }
      }
      const probe = capability.installedProbe[platform];
      if (probe !== null && (typeof probe !== "string" || !probe)) {
        fail(`${label}.installedProbe.${platform} must be a non-empty string or null`);
      }
      for (const field of [
        "installedRegistrationRequired",
        "userEnabledState",
        "runtimeProbeRequired",
      ]) {
        if (typeof capability[field][platform] !== "boolean") {
          fail(`${label}.${field}.${platform} must be boolean`);
        }
      }

      if (applicability === "notApplicable") {
        if (
          source !== "notApplicable"
          || capability.packageKinds[platform].length
          || probe !== null
          || capability.installedRegistrationRequired[platform]
          || capability.userEnabledState[platform]
          || capability.runtimeProbeRequired[platform]
        ) {
          fail(`${label}.${platform} notApplicable layers must all be not applicable`);
        }
        continue;
      }

      applicableCount += 1;
      packageExpectationCount += capability.packageKinds[platform].length;
      installedProbeCount += probe === null ? 0 : 1;
      if (applicability === "required" && source !== "implemented") {
        fail(`${label}.${platform} is required but not implemented`);
      }
      if (applicability === "optional" && source === "notApplicable") {
        fail(`${label}.${platform} is optional but declares notApplicable source`);
      }
      if (capability.installedRegistrationRequired[platform] && probe === null) {
        fail(`${label}.${platform} requires registration without an installed probe`);
      }
    }
    if (applicableCount && !capability.evidence.source.length) {
      fail(`${label} has no source evidence identifiers`);
    }
    if (packageExpectationCount && !capability.evidence.package.length) {
      fail(`${label} has package expectations without package evidence identifiers`);
    }
    if (installedProbeCount && !capability.evidence.installed.length) {
      fail(`${label} has installed probes without installed evidence identifiers`);
    }
  }
  return manifest;
}

export function buildBaselineCapabilitySnapshots(manifest, platform, packageKind) {
  validateNativeCapabilityManifest(manifest);
  if (!manifest.platforms.includes(platform)) fail(`unknown platform ${platform}`);
  if (!manifest.packageKinds.includes(packageKind)) fail(`unknown package kind ${packageKind}`);

  return manifest.capabilities.map((capability) => {
    const applicability = capability.applicability[platform];
    if (applicability === "notApplicable") {
      return {
        id: capability.id,
        applicability,
        firstClass: capability.firstClass,
        sourceState: "notApplicable",
        packageState: "notApplicable",
        installedState: "notApplicable",
        userEnabledState: "notApplicable",
        runtimeState: "notApplicable",
        availability: "notApplicable",
        failureCategory: null,
        evidence: capability.evidence,
      };
    }

    const sourceState = capability.sourceExpectation[platform] === "implemented"
      ? "supported"
      : "unavailable";
    const expectedPackages = capability.packageKinds[platform];
    const packageState = expectedPackages.length === 0
      ? "notApplicable"
      : expectedPackages.includes(packageKind)
        ? "notInspected"
        : "notIncluded";
    const installedState = capability.installedProbe[platform] === null
      ? "notApplicable"
      : "notInspected";
    const userEnabledState = capability.userEnabledState[platform]
      ? "notInspected"
      : "notApplicable";
    const runtimeState = sourceState === "unavailable"
      ? "unavailable"
      : capability.runtimeProbeRequired[platform]
        ? "notInspected"
        : "ready";
    const available = sourceState === "supported"
      && packageState !== "notIncluded"
      && (!capability.installedRegistrationRequired[platform] || installedState === "registered")
      && (!capability.userEnabledState[platform] || userEnabledState === "enabled")
      && (!capability.runtimeProbeRequired[platform] || runtimeState === "ready");

    return {
      id: capability.id,
      applicability,
      firstClass: capability.firstClass,
      sourceState,
      packageState,
      installedState,
      userEnabledState,
      runtimeState,
      availability: available ? "available" : "unavailable",
      failureCategory: available ? null : inferredFailureCategory({
        sourceState,
        packageState,
        installedState,
        userEnabledState,
        runtimeState,
      }),
      evidence: capability.evidence,
    };
  });
}

function inferredFailureCategory(snapshot) {
  if (snapshot.sourceState === "unavailable") return "sourceMissing";
  if (snapshot.packageState === "notIncluded") return "packageMissing";
  if (snapshot.installedState === "notInspected") return "notRegistered";
  if (snapshot.userEnabledState === "notInspected") return "userDisabled";
  if (snapshot.runtimeState !== "ready") return "runtimeUnavailable";
  return "probeFailed";
}

export function validateCapabilitySnapshots(manifest, platform, packageKind, snapshots) {
  validateNativeCapabilityManifest(manifest);
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  if (byId.size !== snapshots.length) throw new Error("capability snapshots contain duplicates");
  for (const capability of manifest.capabilities) {
    const snapshot = byId.get(capability.id);
    if (!snapshot) throw new Error(`capability snapshot missing ${capability.id}`);
    if (snapshot.applicability !== capability.applicability[platform]) {
      throw new Error(`capability snapshot applicability drift for ${capability.id}`);
    }
    if (snapshot.availability === "available") {
      if (snapshot.sourceState !== "supported") {
        throw new Error(`available capability ${capability.id} lacks source support`);
      }
      if (snapshot.packageState === "notIncluded" || snapshot.packageState === "failed") {
        throw new Error(`available capability ${capability.id} is not in ${packageKind}`);
      }
      if (
        capability.installedRegistrationRequired[platform]
        && snapshot.installedState !== "registered"
      ) {
        throw new Error(`available capability ${capability.id} is not registered`);
      }
      if (
        capability.userEnabledState[platform]
        && snapshot.userEnabledState !== "enabled"
      ) {
        throw new Error(`available capability ${capability.id} is not user-enabled`);
      }
      if (
        capability.runtimeProbeRequired[platform]
        && snapshot.runtimeState !== "ready"
      ) {
        throw new Error(`available capability ${capability.id} is not runtime-ready`);
      }
    }
    if (
      snapshot.applicability === "notApplicable"
      && snapshot.availability !== "notApplicable"
    ) {
      throw new Error(`not-applicable capability ${capability.id} has observable availability`);
    }
  }
  return snapshots;
}

export function findFrontendPlatformSelectionViolations(relativePath, source) {
  const violations = [];
  const pattern = /\b(?:platformIntegration\.platform|nativePlatform|platform)\s*(?:===|!==|==|!=)\s*["'](?:windows|linux|macos)["']/g;
  for (const match of source.matchAll(pattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line}:${match[0]}`);
  }
  return violations;
}

export { REQUIRED_CAPABILITY_IDS };
