import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const capability = readJson(
  "docs/migration/macos-native-capability-parity.json",
);
const replacement = readJson("docs/migration/macos-replacement-parity.json");
const identity = readJson("docs/migration/macos-identity-decision.json");
const acceptance = readJson("docs/migration/macos-release-acceptance.json");

const errors = [];
const requireText = (entry, field, ledger) => {
  if (typeof entry[field] !== "string" || entry[field].trim() === "") {
    errors.push(`${ledger}:${entry.id ?? "<missing-id>"} requires ${field}`);
  }
};
const requireArray = (entry, field, ledger) => {
  if (!Array.isArray(entry[field]))
    errors.push(`${ledger}:${entry.id ?? "<missing-id>"} requires ${field}`);
};
const validateUniqueIds = (ledger, name) => {
  const seen = new Set();
  for (const entry of ledger.entries ?? []) {
    requireText(entry, "id", name);
    if (seen.has(entry.id)) errors.push(`${name} has duplicate id ${entry.id}`);
    seen.add(entry.id);
  }
};

validateUniqueIds(capability, "capability");
validateUniqueIds(replacement, "replacement");

const capabilityDispositions = new Set([
  "existing",
  "migrate-native",
  "reimplement-shared",
  "not-applicable",
]);
for (const entry of capability.entries ?? []) {
  for (const field of [
    "capability",
    "owner",
    "disposition",
    "interfaceProof",
    "packageProof",
    "installedProof",
    "status",
  ]) {
    requireText(entry, field, "capability");
  }
  if (!capabilityDispositions.has(entry.disposition))
    errors.push(
      `capability:${entry.id} has unknown disposition ${entry.disposition}`,
    );
  if (!capability.allowedStatuses?.includes(entry.status))
    errors.push(`capability:${entry.id} has unknown status ${entry.status}`);
  if (
    (entry.disposition === "not-applicable" ||
      entry.status === "not-applicable") &&
    !entry.notApplicableDecision
  ) {
    errors.push(
      `capability:${entry.id} requires a linked not-applicable decision`,
    );
  }
}

const replacementDispositions = new Set([
  "existing",
  "migrate-native",
  "reimplement-shared",
  "retire-by-decision",
]);
const presentationOwners = new Set([
  "react-shell",
  "os-mandated-native",
  "none",
]);
const uiTechnologies = new Set([
  "react-shadcn-tailwind4",
  "approved-native-surface",
  "none",
]);
const allowedNativeTargets =
  /Finder|Quick Look|Spotlight|Native Host|Launch Services/;
const swiftUiProductSources = new Set([
  "gui/Sources/ZManagerTracer/ArchiveBrowserView.swift",
  "gui/Sources/ZManagerTracer/ContentView.swift",
  "gui/Sources/ZManagerTracer/PreferencesView.swift",
  "gui/Sources/ZManagerTracer/QuickArchiveProgressWindow.swift",
  "gui/Sources/ZManagerTracer/TzapAccountView.swift",
]);

for (const entry of replacement.entries ?? []) {
  for (const field of [
    "kind",
    "observableBehavior",
    "targetModule",
    "targetInterface",
    "disposition",
    "automatedProof",
    "manualProof",
    "owner",
    "status",
    "presentationOwner",
    "uiTechnology",
  ]) {
    requireText(entry, field, "replacement");
  }
  requireArray(entry, "referenceSources", "replacement");
  requireArray(entry, "referenceTests", "replacement");
  if (!replacementDispositions.has(entry.disposition))
    errors.push(
      `replacement:${entry.id} has unknown disposition ${entry.disposition}`,
    );
  if (!replacement.allowedStatuses?.includes(entry.status))
    errors.push(`replacement:${entry.id} has unknown status ${entry.status}`);
  if (!presentationOwners.has(entry.presentationOwner))
    errors.push(`replacement:${entry.id} has unknown presentationOwner`);
  if (!uiTechnologies.has(entry.uiTechnology))
    errors.push(`replacement:${entry.id} has unknown uiTechnology`);
  if (entry.disposition === "retire-by-decision" && !entry.decision)
    errors.push(
      `replacement:${entry.id} retirement requires a linked decision`,
    );
  if (entry.decision && !entry.decision.startsWith("http")) {
    const decisionPath = entry.decision.split("#", 1)[0];
    if (!existsSync(join(root, decisionPath)))
      errors.push(
        `replacement:${entry.id} links missing decision ${decisionPath}`,
      );
  }
  if (
    entry.presentationOwner === "react-shell" &&
    entry.uiTechnology !== "react-shadcn-tailwind4"
  ) {
    errors.push(
      `replacement:${entry.id} application GUI must use React/shadcn/Tailwind 4`,
    );
  }
  if (entry.presentationOwner === "os-mandated-native") {
    if (
      entry.uiTechnology !== "approved-native-surface" ||
      !entry.nativePresentationJustification ||
      !entry.decision
    ) {
      errors.push(
        `replacement:${entry.id} native presentation requires approved technology, justification, and decision`,
      );
    }
    if (!allowedNativeTargets.test(entry.targetModule))
      errors.push(
        `replacement:${entry.id} uses a non-allowlisted native surface`,
      );
  }
  if (entry.presentationOwner === "none" && entry.uiTechnology !== "none")
    errors.push(
      `replacement:${entry.id} non-presentational entry must use uiTechnology none`,
    );
  if (
    entry.referenceSources.some((source) =>
      swiftUiProductSources.has(source),
    ) &&
    entry.presentationOwner === "os-mandated-native"
  ) {
    errors.push(
      `replacement:${entry.id} migrates an application-owned SwiftUI screen to a native target`,
    );
  }
}

const expectedSources = [
  "gui/Sources/ZManagerFinderExtension/ZManagerFinderSync.swift",
  "gui/Sources/ZManagerQuickLookPreview/TzapPreviewProvider.swift",
  "gui/Sources/ZManagerShared/ArchiveExtractionDestinations.swift",
  "gui/Sources/ZManagerShared/ArchiveFileTypes.swift",
  "gui/Sources/ZManagerShared/FinderActionRequest.swift",
  "gui/Sources/ZManagerTracer/AppPreferences.swift",
  "gui/Sources/ZManagerTracer/ArchiveBrowserView.swift",
  "gui/Sources/ZManagerTracer/ArchiveJobViewModel.swift",
  "gui/Sources/ZManagerTracer/ContentView.swift",
  "gui/Sources/ZManagerTracer/CreateViewConfiguration.swift",
  "gui/Sources/ZManagerTracer/DefaultOpenerArchiveTypes.swift",
  "gui/Sources/ZManagerTracer/DefaultOpenerManager.swift",
  "gui/Sources/ZManagerTracer/MonotonicProgress.swift",
  "gui/Sources/ZManagerTracer/PreferencesView.swift",
  "gui/Sources/ZManagerTracer/PreviewTempCleanup.swift",
  "gui/Sources/ZManagerTracer/QuickArchiveProgressWindow.swift",
  "gui/Sources/ZManagerTracer/TzapAccountView.swift",
  "gui/Sources/ZManagerTracer/TzapAccountViewModel.swift",
  "gui/Sources/ZManagerTracer/TzapObligationBridge.swift",
  "gui/Sources/ZManagerTracer/ZManagerTracerApp.swift",
  "gui/Spotlight/ZManagerSpotlightImporter.m",
];
const expectedTests = [
  "gui/Tests/ZManagerFinderExtensionTests/FinderMenuBuilderTests.swift",
  "gui/Tests/ZManagerQuickLookPreviewTests/TzapPreviewProviderTests.swift",
  "gui/Tests/ZManagerSharedTests/FinderActionRequestTests.swift",
  "gui/Tests/ZManagerTracerTests/AppDelegateTests.swift",
  "gui/Tests/ZManagerTracerTests/AppPreferencesTests.swift",
  "gui/Tests/ZManagerTracerTests/ArchiveBrowserViewModelTests.swift",
  "gui/Tests/ZManagerTracerTests/ArchiveJobViewModelTests.swift",
  "gui/Tests/ZManagerTracerTests/DefaultOpenerManagerTests.swift",
  "gui/Tests/ZManagerTracerTests/TestSupport.swift",
  "gui/Tests/ZManagerTracerTests/TzapAccountViewModelTests.swift",
  "gui/Tests/ZManagerTracerTests/TzapObligationBridgeTests.swift",
];
const inventoriedSources = new Set(
  replacement.entries
    .filter((entry) => entry.kind === "source")
    .flatMap((entry) => entry.referenceSources),
);
const inventoriedTests = new Set(
  replacement.entries
    .filter((entry) => entry.kind === "characterization-test")
    .flatMap((entry) => entry.referenceTests),
);
for (const source of expectedSources)
  if (!inventoriedSources.has(source))
    errors.push(`replacement ledger omits native source ${source}`);
for (const test of expectedTests)
  if (!inventoriedTests.has(test))
    errors.push(`replacement ledger omits characterization test ${test}`);

const requiredFlows = [
  "account-authentication",
  "hosted-callback",
  "certificates-recipient-keys",
  "contacts",
  "document-verification",
  "encrypted-sharing",
  "preferences-cleanup",
  "default-openers",
  "lifecycle-services",
  "finder",
  "quicklook-spotlight",
  "packaging-release",
];
for (const flow of requiredFlows)
  if (!replacement.entries.some((entry) => entry.id === `flow.${flow}`))
    errors.push(`replacement ledger omits required flow ${flow}`);

if (capability.entries?.length !== 15)
  errors.push(
    `capability ledger must contain the 15 strategic rows; found ${capability.entries?.length ?? 0}`,
  );
if (identity.status !== "frozen")
  errors.push("macOS identity decision is not frozen");
if (identity.product?.bundleIdentifier !== "com.frankmanzhu.zmanager")
  errors.push("canonical bundle identifier changed");
if (identity.product?.applicationBundleName !== "Z-Manager.app")
  errors.push("canonical installed bundle name changed");
if (identity.product?.appGroupIdentifier !== "group.com.frankmanzhu.zmanager")
  errors.push("stable App Group changed");
if (identity.product?.teamIdentifier !== "9PMA523YY4")
  errors.push("Team ID changed");

const acceptanceStatuses = new Set(["pending", "passed", "failed", "blocked"]);
const requiredAcceptanceChecks = [
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
if (acceptance.schemaVersion !== 2)
  errors.push("release acceptance has an unsupported schema version");
if (!acceptanceStatuses.has(acceptance.status))
  errors.push("release acceptance has an invalid overall status");
if (!Array.isArray(acceptance.environments))
  errors.push("release acceptance requires environments");
for (const architecture of ["arm64", "x86_64"]) {
  const matches = (acceptance.environments ?? []).filter(
    (environment) => environment.architecture === architecture,
  );
  if (matches.length !== 1)
    errors.push(
      `release acceptance requires exactly one ${architecture} environment`,
    );
}
for (const environment of acceptance.environments ?? []) {
  const ledger = `acceptance:${environment.architecture ?? "unknown"}`;
  for (const field of [
    "name",
    "architecture",
    "buildNumber",
    "osVersion",
    "filesystemCaseMode",
    "account",
    "signing",
    "status",
  ]) {
    requireText(environment, field, ledger);
  }
  if (!acceptanceStatuses.has(environment.status))
    errors.push(`${ledger} has invalid status ${environment.status}`);
  if (
    String(environment.buildNumber) !== String(acceptance.release?.buildNumber)
  )
    errors.push(`${ledger} build number differs from release`);
  if (!Array.isArray(environment.checks))
    errors.push(`${ledger} requires checks`);
  const acceptanceIds = new Set();
  for (const check of environment.checks ?? []) {
    requireText(check, "id", ledger);
    requireText(check, "status", ledger);
    requireText(check, "evidence", ledger);
    if (!acceptanceStatuses.has(check.status))
      errors.push(`${ledger}:${check.id} has invalid status ${check.status}`);
    if (acceptanceIds.has(check.id))
      errors.push(`${ledger} has duplicate check ${check.id}`);
    acceptanceIds.add(check.id);
  }
  for (const id of requiredAcceptanceChecks)
    if (!acceptanceIds.has(id)) errors.push(`${ledger} omits ${id}`);
  if (acceptance.status === "passed" && environment.status !== "passed") {
    errors.push(
      `release acceptance cannot pass while ${environment.architecture} is not passed`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `macOS migration ledgers valid: ${capability.entries.length} native capabilities, ${replacement.entries.length} replacement entries`,
);
