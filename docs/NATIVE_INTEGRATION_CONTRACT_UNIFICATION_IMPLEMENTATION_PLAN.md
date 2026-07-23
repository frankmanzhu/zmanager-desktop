# Native Integration Contract Unification Implementation Plan

- Status: Proposed
- Date: 2026-07-23
- Scope: cross-platform native capability reporting, Quick Actions, shell and
  application menus, file associations, window policy, macOS Native Host FFI,
  packaging registration, release inspection, and installed acceptance
- Primary outcome: Windows, Linux, and macOS implement one trackable Native
  Integration Contract while retaining operating-system-specific native
  adapters
- Supersedes as the active execution source:
  - `docs/QUICK_ACTION_CONTEXT_MENU_UNIFICATION_IMPLEMENTATION_PLAN.md`
- Related documents:
  - `CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/REQUIREMENTS.md`
  - `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
  - `docs/windows-context-menu-behavior.md`
  - `docs/adr/0001-native-platform-contract.md`
  - `docs/adr/0002-versioned-shell-action-contract.md`
  - `docs/adr/0003-platform-owned-drag-and-window-capabilities.md`
  - `docs/adr/0005-native-host-runtime-and-launch-inbox.md`
  - `docs/adr/0006-finder-app-group-opaque-request-transport.md`
  - `docs/adr/0008-asynchronous-macos-file-promise-drag.md`
  - `docs/adr/0009-truthful-first-class-native-capabilities.md`
  - `docs/adr/0012-bounded-local-diagnostic-log.md`
  - `docs/adr/0013-generated-shell-action-window-disposition.md`

## Executive Decision

Do not finish the former Quick Action plan as an isolated architecture before
starting the broader native refactor. That plan's capability-reporting,
platform-profile, package-inspection, and installed-acceptance slices overlap
directly with the broader work and would otherwise produce a shell-action-only
model that must be replaced later.

Use this order instead:

1. Characterize the current installed Quick Action failure and freeze existing
   cross-platform behavior.
2. Establish the Native Integration Contract and normalized capability states.
3. Complete Quick Action unification as the first vertical proof of that
   contract.
4. Migrate the remaining `NativePlatform` responsibilities away from misleading
   no-op or empty-success implementations.
5. Generate archive association and package metadata from one catalog.
6. Unify the application-menu command surface and window-class policy.
7. Generate and verify the macOS Native Host FFI contract.
8. Standardize registration, package inspection, release evidence, and installed
   acceptance.
9. Delete all replaced ownership paths and run the complete platform matrix.

Quick Actions remain the first product priority because they contain a current
user-visible macOS no-op. The Native Integration Contract comes before their
capability-reporting slice so the fix becomes the first reusable implementation,
not a special case.

This document is a staged execution backlog. It is suitable for multiple agents,
but it is not permission to implement all work in one broad rewrite. Each Work
Package has prerequisites, proof, and deletion criteria and should be completed
and verified before dependent work begins.

## Status Reconciliation

Some common Quick Action work may already exist. Before editing a Work Package,
the assigned agent must compare its exit criteria with the current checkout:

- If the behavior and deletion criteria are already proven, record the evidence
  and do not reimplement it.
- If the behavior exists without interface-level or installed proof, add the
  missing proof before marking it complete.
- If both old and new ownership paths remain, the Work Package is incomplete.
- A passing compile-time trait test does not prove a native capability works.

The progress table starts as `Unverified`, not `Not started`, for this reason.

| Work Package | Status | Depends on | Evidence |
| --- | --- | --- | --- |
| WP0 Baseline and characterization | Complete | None | [baseline and installed Finder characterization](native-integration/WP0_BASELINE_AND_CHARACTERIZATION.md), [`native-integration-baseline.json`](../fixtures/contracts/native-integration-baseline.json), [`native-integration-baseline.test.mjs`](../scripts/native-integration-baseline.test.mjs), [`check-native-platform-architecture.test.sh`](../scripts/check-native-platform-architecture.test.sh) |
| WP1 Native Integration Contract foundation | Complete | WP0 | [implementation evidence](native-integration/WP1_NATIVE_INTEGRATION_CONTRACT_FOUNDATION.md), [`native-capabilities.json`](../manifests/native-capabilities.json), [`native-capability-contract.test.mjs`](../scripts/native-capability-contract.test.mjs), [ADR-0001](adr/0001-native-platform-contract.md) |
| WP2 Quick Action vertical slice | Implemented; installed proof in WP7/WP8 | WP1 | [implementation evidence](native-integration/WP2_QUICK_ACTION_VERTICAL_SLICE.md), [`shell-actions.json`](../manifests/shell-actions.json), [`shell-action-artifact-parity.test.mjs`](../scripts/shell-action-artifact-parity.test.mjs), [ADR-0013](adr/0013-generated-shell-action-window-disposition.md) |
| WP3 Native Platform capability migration | Complete | WP2 | [implementation evidence](native-integration/WP3_NATIVE_PLATFORM_CAPABILITY_MIGRATION.md), [ADR-0001](adr/0001-native-platform-contract.md) |
| WP4 Archive association catalog | Complete | WP3 | [implementation evidence](native-integration/WP4_ARCHIVE_ASSOCIATION.md) |
| WP5 Command surface and window policy | Unverified | WP4 | Add links when complete |
| WP6 macOS Native Host FFI contract | Unverified | WP5 | Add links when complete |
| WP7 Registration and release evidence | Unverified | WP2, WP4, WP5, WP6 | Add links when complete |
| WP8 Cross-platform acceptance and deletion | Unverified | WP0-WP7 | Add links when complete |

## Architectural Direction

### One semantic contract, multiple native adapters

The common path owns:

- capability identity and applicability;
- source implementation state;
- package inclusion and inspection expectations;
- installed registration and user-enabled state;
- normalized `available`, `unavailable`, `notApplicable`, and `failed` outcomes;
- action and command identity;
- lifecycle stages;
- expected native artifacts; and
- evidence identifiers.

Native adapters continue to own:

- Windows COM, Registry, NSIS, GDI icon extraction, ACLs, and virtual-file drag;
- Linux XDG, MIME, Nautilus, KDE, GTK drag, apt, dnf, and cache refresh;
- macOS AppKit, Launch Services, PluginKit, Finder, Services, Quick Look,
  Spotlight, App Groups, Replacement Migration, signing, notarization, and file
  promises.

The contract unifies meaning and proof. It does not force different operating
systems to use the same mechanism.

### Required capability layers

ADR-0009 requires these facts to remain distinct:

1. **Source support**: the implementation exists and is compiled.
2. **Package inclusion**: the current artifact contains the required native
   files, metadata, entitlements, or registration hooks.
3. **Installed registration**: the operating system recognizes the installed
   integration.
4. **User-enabled state**: the integration is enabled where users can disable
   it independently.
5. **Runtime readiness**: required transport or native resources are currently
   usable.

No single `enabled: boolean` may collapse these layers.

### Module depth and seams

The Native Integration Contract must be a deep module. Callers learn one small
capability and evidence model while platform-specific probes, package formats,
registration commands, and diagnostics remain behind its interface.

The platform integrations are real adapters at real seams because at least
Windows, Linux, and macOS vary. Pass-through wrappers that add no policy,
normalization, or testing leverage should be removed rather than renamed.

The deletion test applies to every Work Package: if the new module is removed,
the eliminated policy should have to reappear across multiple callers or native
adapters.

## Current Findings To Preserve As Regression Targets

### Native capability truth is currently weak

`src-tauri/src/platform/mod.rs` defines a flat `PlatformProfile` and a broad
`NativePlatform` trait. Windows and Linux satisfy several methods with no-op,
empty-success, or free-form unsupported results:

- Native Host initialization and shutdown are successful no-ops.
- Replacement Migration returns an empty successful snapshot.
- App Group token consumption returns a macOS-only string error.
- Windows owner-only file permissions return success without enforcement.
- Windows and Linux default-handler operations return platform-specific string
  errors.
- Linux system icon lookup always returns no bitmap.

The active-platform test proves compilation and static profile values, not
behavioral capability conformance.

### Quick Action execution is shared only after ingestion

The existing downstream path should be retained:

```text
NativeInboundController
  -> generated window-disposition policy
  -> QuickActionController
  -> Create Workspace, Archive Workspace, or Job
```

Native menu policy, transport, validation, and capability reporting still have
separate ownership paths.

### File association ownership is fragmented

`manifests/archive-file-types.json` generates some Rust, TypeScript, Swift,
Windows, and macOS artifacts. Tauri file associations and several Linux desktop,
MIME, KDE, Nautilus, and AppStream lists remain independently maintained and
describe different subsets.

### Application menu policy is duplicated

The macOS application menu is hard-coded in
`src-tauri/src/platform/macos.rs`. The frontend maintains a separate native-menu
command whitelist in `src/desktop/nativeMenu.ts`, while the React menu derives
from `src/app/classicCommands.ts`.

### Release proof is asymmetric

macOS has structural and installed release evidence. Windows and Linux have
shallower package checks and no equivalent common inspection record. Windows
smoke and release-gate scripts currently expect `0.1.0` installer names while
the product version is `1.1.0`.

### Architecture verification is not currently green

At plan creation, `npm run test:architecture` reports production operating-system
selection outside `src-tauri/src/platform` in:

- `src-tauri/src/native_drag_session.rs`;
- `src-tauri/src/main.rs`; and
- `src-tauri/src/commands.rs`.

Some findings may be true leaks and others may show that the guard is too broad.
WP0 must classify them before later Work Packages use the architecture suite as
proof.

## Dependency Graph

```text
WP0 Baseline and characterization
  |
  v
WP1 Native Integration Contract foundation
  |
  v
WP2 Quick Action vertical slice
  |
  v
WP3 Native Platform capability migration
  |
  v
WP4 Archive association
  |
  v
WP5 Command surface and window policy
  |
  v
WP6 macOS Native Host FFI contract
  |
  v
WP7 Registration and release evidence
  |
  v
WP8 Cross-platform acceptance and deletion
```

The primary execution path is serial because the generator and platform modules
are hotspots. An experienced integration owner may run WP4 and preparatory WP6
fixture work in parallel after WP3 only if generator entry-point and
`platform/macos.rs` ownership are disjoint. WP7 and WP8 must remain last.

## WP0: Baseline And Characterization

### Goal

Create trustworthy failing-before or characterization evidence before changing
ownership.

### Work

1. Run and record:
   - generated-contract checks;
   - focused frontend Quick Action suites;
   - Rust platform and shell-contract tests;
   - Swift Native Host and Finder tests;
   - Windows shell-extension tests on Windows;
   - Linux integration/package tests on supported Linux hosts; and
   - `npm run test:architecture`.
2. Classify every existing failure as:
   - product regression;
   - architecture violation;
   - guard false positive;
   - environment limitation; or
   - unrelated pre-existing failure.
3. Characterize the installed Finder click chain:
   - menu action invoked;
   - App Group available;
   - request written;
   - callback URL accepted;
   - token received;
   - request consumed;
   - request validated;
   - Native Launch Inbox accepted;
   - frontend acknowledged; and
   - Quick Action execution started.
4. Preserve secret-free evidence only. Never record selected paths, opaque
   tokens, passwords, or nested request payloads.
5. Add characterization fixtures for current platform profiles, file
   associations, application menus, window settings, and package artifact names.
6. Fix or narrow the native-platform architecture guard so it is green before
   it becomes a completion gate. Do not merely allowlist a real platform leak.

### Proof

- A failing test or deterministic installed reproduction localizes the current
  Finder no-op.
- Existing behavior fixtures are checked in before ownership moves.
- Architecture checks are green, or a remaining environmental limitation is
  explicitly documented with the exact skipped proof.

### Exit Criteria

- Later regressions can be distinguished from pre-existing failures.
- The installed Finder failure has a known first failing stage.
- No production behavior has been broadly rewritten.

## WP1: Native Integration Contract Foundation

### Goal

Create the common capability vocabulary and evidence model before Quick Actions
or other native features add another platform-specific profile.

### Work

1. Add a canonical native capability catalog under `manifests/`. It must cover
   at least:
   - shell selected-item actions;
   - shell background/container actions;
   - file associations;
   - system file icons;
   - default-handler control;
   - native application menu;
   - Main Window policy;
   - Disposable Task Window policy;
   - native file drag;
   - Finder token transport;
   - Native Host lifecycle;
   - Replacement Migration;
   - Quick Look;
   - Spotlight; and
   - diagnostic and installed-inspection support.
2. For each capability, record:
   - stable language-neutral identifier;
   - platform applicability: `required`, `optional`, or `notApplicable`;
   - source implementation expectation;
   - package kinds in which it must be included;
   - installed probe or explicit absence of one;
   - whether user-enabled state exists;
   - normalized failure categories; and
   - required source, package, and installed evidence identifiers.
3. Generate or contract-test aligned Rust and TypeScript types.
4. Replace ambiguous static booleans at caller seams with structured capability
   snapshots. A temporary compatibility projection is allowed only if:
   - it is named as transitional;
   - no new caller consumes it;
   - its deletion Work Package is WP3 or WP8; and
   - tests ensure it cannot claim enabled behavior from source support alone.
5. Add architecture validation that rejects:
   - an enabled first-class capability with no implementation;
   - package inclusion without expected artifact metadata;
   - successful empty fallback for a required capability; and
   - frontend platform-name checks used instead of capability state.
6. Prepare the ADR update that refines ADR-0001. Preserve compile-time adapter
   completeness, but define completeness as an explicit capability declaration
   rather than identical observable behavior for every OS.

### Proof

- Catalog schema and generator tests reject unknown capabilities, missing
  applicability, duplicate identifiers, and incomplete evidence requirements.
- Rust and TypeScript fixtures deserialize the same capability states.
- Tests distinguish source-supported, packaged, installed, user-enabled,
  runtime-ready, unavailable, failed, and not-applicable states.
- The current package type is represented explicitly rather than inferred from
  an OS name.

### Exit Criteria

- There is one capability vocabulary shared by runtime, packaging, diagnostics,
  and tests.
- Quick Actions can report Finder, Explorer, Nautilus, KDE, and Services state
  without adding shell-specific booleans.
- ADR-0001 and ADR-0009 have an implementable, non-contradictory interpretation.

## WP2: Quick Action Vertical Slice

### Goal

Finish Quick Action unification on the Native Integration Contract and eliminate
the current clickable macOS no-op.

### Canonical Context Menu

For one supported archive:

1. `Extract Here`
2. `Extract to Archive Folder`
3. `Open archive`
4. `Add to archive...`
5. `Add to .tzap`
6. `Add to .zip`
7. `Add to .7z`
8. `Add to .tzst`
9. `Add to .tgz`

For non-archive files, folders, mixed selections, and folder backgrounds:

1. `Add to archive...`
2. `Add to .tzap`
3. `Add to .zip`
4. `Add to .7z`
5. `Add to .tzst`
6. `Add to .tgz`

Multiplicity policy determines which archive actions remain available for
multiple archives. The generic `extract` and compatibility
`compressCleanSource` actions remain outside the parity context-menu matrix
unless a separate compatibility decision removes them.

### Work

#### WP2.1 Generated shell-action catalog

- Make `manifests/shell-actions.json` own:
  - action identifier;
  - canonical English label;
  - localization key;
  - presentation order by context;
  - selection applicability;
  - multiplicity;
  - supported native surfaces;
  - compatibility aliases; and
  - Main Window or Disposable Task Window disposition.
- Generate Windows COM/NSIS mappings, Linux file-manager artifacts, Finder
  policy/resources, Rust profiles, and parity fixtures.
- Migrate one native adapter at a time, compare generated and existing output,
  then delete the replaced table.

#### WP2.2 Rust-owned ingestion

- Normalize CLI, versioned request file, Finder token, and Services transports
  into one versioned `ShellActionRequest`.
- Perform version, action, multiplicity, local-path, size, and disposition
  validation once in Rust.
- Preserve legacy parsers only as compatibility adapters.
- Enqueue exactly one executable request in the Native Launch Inbox.
- Preserve ADR-0013 cold/warm disposition and no-duplication behavior.
- Remove frontend ownership of Finder token validation after Rust owns it.

#### WP2.3 Finder failure handling

- Replace optional transport and ignored `try?` results with explicit outcomes.
- Do not create actionable Finder rows when required transport is unavailable.
- Record bounded diagnostic stages using action kind, selection count,
  disposition, transport class, and stable error code only.
- Preserve one-time token consumption, cleanup, App Group validation, and
  path-free callback URLs required by ADR-0006.
- A development build either provisions a working App Group integration or
  truthfully reports the capability unavailable.

#### WP2.4 Capability and installed proof

- Report shell-action source, package, installed, user-enabled, and transport
  readiness through WP1's capability states.
- Inspect Finder bundles, entitlements, App Group identifiers, URL schemes,
  generated resources, Explorer registrations, and Linux integration artifacts.
- Prove one native selection creates one request and one workspace transition or
  Job set.

### Proof

- Generator golden tests cover every selection shape and native surface.
- Rust table tests submit equivalent CLI, file, Finder, and Services requests and
  assert the same validated result.
- Finder failure tests cover unavailable App Group, write failure, callback-open
  failure, consume failure, inbox rejection, and frontend acknowledgement
  failure.
- Installed cold and warm tests run on Windows Explorer, supported Linux file
  managers, macOS Finder, and macOS Services.
- Main Window and Disposable Task Window behavior matches generated policy.

### Exit Criteria

- No supported platform owns an independent shell-action catalog.
- macOS Services cannot bypass common Rust validation.
- No ignored result remains on the Finder delivery path.
- Every accepted click reaches either an acknowledged request or a diagnosable
  terminal failure.
- The old static shell-action profile lists and obsolete token-routing branch
  are deleted.

## WP3: Native Platform Capability Migration

### Goal

Replace the broad trait's misleading stubs with capability-specific modules and
typed applicability while retaining explicit platform adapters.

### Work

1. Identify the small set of behavior truly required on every supported target,
   including active-platform selection and essential window bootstrap.
2. Move the remaining behavior into capability families:
   - native lifecycle;
   - shell request transport;
   - system file icons;
   - default-handler control;
   - Replacement Migration;
   - secure local-file protection;
   - native file drag;
   - native application menu; and
   - installed capability inspection.
3. Make unsupported behavior explicit:
   - Windows/Linux Replacement Migration is `notApplicable`, not an empty
     successful migration.
   - Windows/Linux default-handler control reports the appropriate normalized
     capability state instead of free-form strings.
   - Linux system icons report optional presentation data unavailable without
     claiming a failed first-class feature.
   - Windows secure file protection either has a real ACL implementation or
     returns a normalized unavailable/failure result; it must not silently
     succeed.
   - Finder App Group token transport is macOS-applicable only.
4. Ensure Replacement Migration returns `notApplicable` before creating state or
   constructing macOS legacy paths on Windows/Linux.
5. Move remaining production OS selection from `main.rs`, commands, or other
   shared modules to the correct native seam.
6. Remove shallow platform wrapper functions that do not normalize policy,
   errors, state, or verification.
7. Split oversized platform files by native responsibility where doing so
   improves locality:
   - Windows icon extraction and virtual drag;
   - Linux integration and GTK staged drag;
   - macOS lifecycle/menu, JSON FFI operations, and file-promise presentation.
8. Deepen the native drag interface around its shared lifecycle:
   - validate and expand selected archive entries;
   - prepare platform-valid item descriptors;
   - start the native presentation;
   - report started, cancelled, completed, or failed outcomes; and
   - close or clean up any session or staged payload.
9. Remove implementation leakage from the shared drag interface, including a
   separate preflight boolean, registry arguments ignored by some adapters,
   optional session fields whose meaning depends on the OS, and outcome variants
   that callers must interpret by platform.
10. Preserve the distinct native drag implementations and filename policies:
    Windows virtual `FILEDESCRIPTORW`, Linux staged GTK drag, and macOS
    asynchronous file promises.
11. Update ADR-0001 and `CONTEXT.md` after the final interface is proven.

### Proof

- Compile-time tests require every supported target to declare every capability
  as implemented, optional-unavailable, or not applicable.
- Interface-level tests exercise real outcomes rather than trait satisfaction
  alone.
- Frontend snapshots derive behavior from capabilities, never OS-name checks.
- Replacement Migration tests prove no Windows/Linux state files or macOS paths
  are produced.
- Security tests prove a successful secure-file result actually enforces the
  platform policy.
- Drag interface tests exercise equivalent lifecycle outcomes while
  platform-specific tests retain filename, collision, staging, streaming,
  cancellation, and cleanup behavior.

### Exit Criteria

- No supported adapter uses successful no-op or empty-success behavior for a
  required capability.
- Platform-name-bearing unsupported strings are absent from command behavior.
- The old monolithic compatibility projection is deleted or reduced to a small,
  explicitly justified composition interface.

## WP4: Archive Association And Package Catalog

### Goal

Make one catalog own archive association semantics while native package formats
remain adapters.

### Work

1. Extend `manifests/archive-file-types.json` to own:
   - semantic archive type;
   - primary and compound extensions;
   - split-archive suffixes;
   - MIME types and aliases;
   - macOS UTI identifiers and rank;
   - Windows registration applicability;
   - Linux desktop/MIME applicability; and
   - package-specific expected association sets.
2. Reconcile existing MIME identifier disagreements before generation.
3. Generate:
   - Rust and TypeScript archive metadata;
   - Tauri `fileAssociations`;
   - Windows NSIS association rows;
   - macOS document and exported-type metadata;
   - Linux desktop MIME lists;
   - custom XDG MIME declarations;
   - KDE and Nautilus filters;
   - AppStream media types; and
   - package inspection fixtures.
4. Distinguish engine format support from associations actually registered by a
   package.
5. Delete the manual extension and MIME lists as each generated artifact is
   adopted.

### Proof

- The generator rejects duplicate aliases, conflicting MIME ownership, invalid
  compound extensions, and missing platform mappings.
- Generated artifacts are deterministic and checked by `--check`.
- Package inspectors compare actual associations with package-specific expected
  sets.
- Installed open-with checks cover representative primary, compound, split, and
  custom formats.

### Exit Criteria

- Adding or changing an associated archive type requires one catalog edit.
- Runtime reporting never presents abstract engine support as installed
  association proof.
- No independently maintained package association list remains.

## WP5: Command Surface And Window Policy

### Goal

Use shared command identity and window-class policy across native and React
presentation without forcing the same UI implementation.

### WP5.1 Application-menu command surface

Work:

- Make one command catalog own command identifier, localization key, placement,
  accelerator, applicability, and enabled-state key.
- Generate or derive the macOS native menu and React Windows/Linux menu from the
  same catalog.
- Keep standard macOS application, edit, window, and help roles native where the
  OS owns their behavior.
- Route every application-owned native menu event through the existing Command
  Router.
- Remove the Rust hard-coded application command table and TypeScript native-menu
  whitelist after parity proof.

Proof:

- Catalog tests cover identifier uniqueness, placement, accelerator conflicts,
  localization, and command-state mapping.
- React and macOS fixtures expose the same application-owned commands.
- Disabled state updates are proven for native and React presentation.

### WP5.2 Window-class policy

Work:

- Define policy for the Main Window and Disposable Task Window.
- Apply decorations, application-owned chrome, resize behavior, minimum sizing,
  activation behavior, and native-menu participation at every creation seam.
- Remove frontend platform inference and scattered default window options.
- Preserve ADR-0013 quick-action window disposition.

Proof:

- Window policy tests cover both classes on every platform.
- Linux Disposable Task Windows do not accidentally retain native decorations
  when application-owned chrome is required.
- Cold and warm Quick Action tests preserve Main Window ownership.

### Exit Criteria

- One command edit updates every application-menu presentation.
- Every window is configured by domain window class rather than creation-site
  defaults.
- Native presentation remains an adapter; command execution remains shared.

## WP6: macOS Native Host FFI Contract

### Goal

Remove manually duplicated Rust/Swift FFI operation metadata while preserving
the bounded macOS Native Host.

### Work

1. Inventory synchronous JSON operations, lifecycle callbacks, and asynchronous
   file-promise callbacks separately.
2. Create a generated contract for:
   - operation identifiers;
   - request and response fixture schemas;
   - C header declarations;
   - numeric status values;
   - byte and item limits;
   - ownership and allocation rules; and
   - normalized error mapping.
3. Generate or verify aligned Rust and Swift declarations and shared fixtures.
4. Keep Public Metadata FFI separate and pinned as required by ADR-0007.
5. Keep file-promise lifecycle asynchronous and separate as required by
   ADR-0008.
6. Remove duplicate private DTO definitions and magic status values only after
   generated parity passes.

### Proof

- Rust and Swift round-trip the same fixtures for each synchronous operation.
- Contract tests reject unknown operations, oversized payloads, invalid status
  values, and ownership violations.
- Lifecycle and file-promise tests continue to cover cancellation, host loss,
  timeout, cleanup, and secret lifetime.

### Exit Criteria

- One contract change updates both Rust and Swift declarations.
- No AppKit object or password crosses the FFI seam.
- Public Metadata FFI and asynchronous promise drag remain independently
  versioned and verified.

## WP7: Registration, Package Inspection, And Release Evidence

### Goal

Give every platform the same trackable lifecycle and evidence schema without
unifying native registration commands.

### Common Lifecycle

```text
build
  -> package
  -> inspect package
  -> install
  -> register and refresh
  -> inspect installed state
  -> exercise capability
  -> uninstall or unregister
  -> verify absence
```

### Work

1. Define one versioned evidence record containing:
   - product identity and version;
   - package kind and architecture;
   - artifact paths and hashes;
   - expected capabilities;
   - package content inspection;
   - registration results;
   - installed and user-enabled state;
   - exercised scenarios;
   - normalized failures; and
   - test command and revision metadata.
2. Implement platform package inspectors as native adapters:
   - Windows NSIS, Registry, COM classes, shell-extension architecture, and
     Explorer refresh;
   - Linux DEB/RPM contents, desktop entries, MIME database, Nautilus/KDE
     integration, and cache refresh;
   - macOS bundle topology, entitlements, Launch Services, PluginKit, Quick
     Look, Spotlight, signing, notarization, and stapling.
3. Replace hard-coded Windows `0.1.0` artifact paths with product-version-derived
   expectations and extend version-consistency checks to those scripts.
4. Make Windows shell-extension tests mandatory in the relevant package build.
5. Replace fake Linux package-content proof with actual archive inspection and
   installed registration checks on supported hosts.
6. Generate the human-readable platform smoke matrix from evidence records.
   Markdown is not the source of truth.
7. Require applicable source, package, and installed evidence before a capability
   or release target is marked complete.

### Proof

- Evidence schema fixtures validate on all three platforms.
- Negative tests prove missing artifacts, wrong architecture, version drift,
  absent registration, disabled extensions, and stale installation paths fail
  with normalized evidence.
- Release workflows consume saved evidence rather than mutable prose.
- Package and installed results remain distinguishable.

### Exit Criteria

- Windows, Linux, and macOS release jobs publish comparable evidence.
- Release publication cannot rely only on macOS installed acceptance.
- Artifact names and versions are derived from one product version.
- Registration mechanics remain platform-local.

## WP8: Cross-Platform Acceptance And Deletion

### Goal

Prove the complete Native Integration Contract and remove all transitional or
duplicated ownership.

### Acceptance Matrix

Quick Actions:

- single and multiple supported archives;
- single and multiple non-archive files;
- single and multiple folders;
- mixed files and folders;
- folder background/container;
- cold launch and warm forwarding;
- concurrent Disposable Task Windows;
- invalid, stale, replayed, and oversized requests;
- default-format and extraction preference routing.

Native capabilities:

- capability source/package/installed/user/runtime states;
- default-handler applicability and actions;
- system icon optional fallback;
- Main Window and Disposable Task Window policy;
- native drag prepare/start/cancel/failure;
- application-menu command parity and enabled state;
- primary, compound, split, and custom file associations;
- Replacement Migration applicability;
- native lifecycle startup and shutdown;
- package registration and unregistration.

Security and diagnostics:

- no paths, opaque tokens, passwords, credentials, or private keys in logs;
- owner/ACL or mode enforcement where secure local files are required;
- bounded payload, item, path-count, and log sizes;
- replay, symlink, hardlink, traversal, stale, and partial-file rejection where
  applicable.

### Deletion Checklist

- Manual Windows, Linux, and macOS shell-action catalogs.
- Frontend Finder-token validation ownership.
- Static shell-action profile lists.
- Flat capability booleans and transitional projections.
- Successful empty Replacement Migration adapters.
- Free-form platform unsupported errors.
- Silent Windows owner-only permission success.
- Manual Tauri/Linux association arrays.
- Rust macOS application-command table.
- TypeScript native-menu whitelist.
- Scattered window creation defaults.
- Duplicate Rust/Swift FFI DTOs and magic status values.
- Hard-coded package versions and mutable Markdown evidence ownership.
- Tests that only preserve obsolete duplication.

### Required Verification

Run the smallest relevant suite during each package and the complete applicable
matrix before completion:

```bash
node scripts/generate-native-contracts.mjs --check
npm run test:frontend
npm run test:e2e
npm run test:architecture
cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml
cargo test --manifest-path crates/zmanager-public-metadata-ffi/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos
scripts/test-macos-register-bundle.sh
scripts/release-gate-macos.sh <built-app> --expected-arch <architecture>
```

Also run:

- the repository Windows ARM64 release gate;
- Windows x64 package and installed integration checks;
- Ubuntu/Debian package and installed integration checks; and
- Fedora/RPM package and installed integration checks.

Run `cd src-tauri && cargo fmt` after every Rust backend change.

### Exit Criteria

- Every capability has explicit applicability and evidence across required
  layers.
- Every enabled first-class capability has a real implementation.
- Every package reports only capabilities it contains and verifies.
- Installed state is measured rather than inferred.
- Quick Actions use one catalog, request contract, ingestion seam, and frontend
  execution path.
- Application menus use one application-owned command catalog.
- File associations use one semantic catalog.
- Windows, Linux, and macOS emit comparable release evidence.
- All replacement paths in the deletion checklist are removed.
- The progress table contains evidence links for every Work Package.

## Agent Execution Contract

### Assignment rule

Assign one Work Package, or one explicitly numbered subpackage, to an agent.
Do not ask one agent to implement WP0-WP8 as one change. The plan is one source
of truth, not one transaction.

Each agent must:

1. Read `AGENTS.md`, `CONTEXT.md`, this plan, and the ADRs listed for its package.
2. Inspect current code and reconcile the package status before editing.
3. Add or identify characterization tests before moving behavior.
4. Work through the module's public interface or native adapter seam.
5. Delete the replaced ownership path in the same package when safe.
6. Run the smallest relevant proof and report pre-existing failures separately.
7. Update this plan's progress row with evidence only when the exit criteria are
   satisfied.
8. Avoid editing another package's files unless the dependency is explicitly
   recorded in this document.

### Handoff template

Every agent handoff must include:

- Work Package and exit criteria addressed;
- files changed;
- old ownership deleted;
- generated artifacts changed;
- automated tests run and results;
- installed/manual checks run and results;
- known residual risk;
- exact unverified platform or architecture;
- ADR or `CONTEXT.md` updates; and
- recommended next eligible Work Package.

### Parallel work

Safe parallelism requires disjoint ownership and completed prerequisites.
Recommended opportunities:

- Preparatory WP6 FFI fixtures alongside WP4 after WP3, provided generator and
  `platform/macos.rs` ownership is coordinated by one integration owner.
- Platform-specific package inspectors inside WP7 after the evidence schema is
  fixed.
- Installed acceptance runs on Windows, Linux, and macOS after code and packages
  are frozen.

Avoid parallel edits to:

- `src-tauri/src/platform/mod.rs`;
- `src-tauri/src/platform/macos.rs`;
- `scripts/generate-native-contracts.mjs`;
- `src/app/classicCommands.ts`;
- shared DTO and generated-contract files; or
- the progress table in this plan.

Use one integration owner to resolve and verify generated output after parallel
work.

## ADR And Documentation Updates

Implementation is expected to require:

- ADR-0001: refine complete platform conformance into complete capability
  declaration plus capability-specific implementation.
- ADR-0013: update the Finder token ordering description if token consumption
  moves fully ahead of frontend delivery.
- `CONTEXT.md`: keep Native Platform and Native Integration Contract definitions
  aligned with the final implementation.
- `docs/ARCHITECTURE.md`: document the capability, package, installed, and
  runtime-state layers.
- `docs/windows-context-menu-behavior.md`: describe the generated cross-platform
  shell-action contract rather than Windows-only ownership.

Do not revise ADR-0006, ADR-0007, or ADR-0008 merely to make native mechanisms
look more uniform. Their security and lifecycle differences are intentional.

## Principal Risks

### Oversized refactor

Combining documentation must not combine implementation transactions. Keep each
Work Package releasable, characterized, and reversible.

### Decorative capability manifest

The Native Integration Contract fails the deletion test if it merely documents
booleans while callers and packaging retain independent policy. It must drive
runtime snapshots, package expectations, architecture validation, and evidence.

### Transitional double ownership

Generated artifacts may briefly coexist with legacy lists for parity comparison.
Every such bridge must name its deletion package and must not accept new callers.

### Package versus installed truth

Finding a bundle, DLL, desktop file, or metadata entry inside an artifact proves
package inclusion only. It does not prove registration or user-enabled state.

### Platform flattening

Do not replace real native differences with lowest-common-denominator behavior.
Common interfaces own meaning, lifecycle, and outcomes; native adapters own
mechanisms and platform policy.

### Cross-platform proof availability

macOS cannot prove Explorer or Linux desktop behavior. Record the exact missing
host proof and leave the Work Package incomplete until the applicable native
environment runs it.

## Definition Of Done

This program is complete only when:

- one Native Integration Contract tracks applicability, source support, package
  inclusion, installed registration, user-enabled state, runtime readiness, and
  evidence;
- Quick Actions have one generated catalog, one versioned request contract, one
  Rust ingestion seam, one frontend execution path, and no clickable silent
  failure;
- the complete `NativePlatform` obligation is truthful and contains no
  successful required-feature stubs;
- file associations and application-owned menu commands each have one semantic
  source;
- Main Window and Disposable Task Window policy applies at every creation seam;
- Rust and Swift macOS Native Host declarations are generated or contract-tested
  from one FFI definition;
- each platform emits comparable package and installed evidence;
- all required native-host acceptance matrices pass;
- every transitional and duplicated ownership path is deleted; and
- ADRs and primary architecture documentation match the shipped code.
