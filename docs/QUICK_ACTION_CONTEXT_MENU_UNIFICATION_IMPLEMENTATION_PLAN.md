# Quick Action Context Menu Unification Implementation Plan

> Superseded as the active execution source by
> `docs/NATIVE_INTEGRATION_CONTRACT_UNIFICATION_IMPLEMENTATION_PLAN.md`.
> Its quick-action requirements and acceptance matrix are incorporated there.
> Retain this document as investigation history; do not implement its slices as
> a separate parallel architecture.

- Status: Superseded
- Date: 2026-07-23
- Scope: Windows Explorer, Linux file-manager, macOS Finder and Services shell
  actions; Shell Action Request ingestion; Native Launch Inbox delivery;
  capability reporting; and shared frontend quick-action execution
- Primary outcome: every supported shell surface presents the same applicable
  actions and submits the same versioned Shell Action Request for the Desktop
  Shell to process
- Related documents:
  - `CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/REQUIREMENTS.md`
  - `docs/windows-context-menu-behavior.md`
  - `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
  - `docs/adr/0001-native-platform-contract.md`
  - `docs/adr/0002-versioned-shell-action-contract.md`
  - `docs/adr/0005-native-host-runtime-and-launch-inbox.md`
  - `docs/adr/0006-finder-app-group-opaque-request-transport.md`
  - `docs/adr/0009-truthful-first-class-native-capabilities.md`
  - `docs/adr/0012-bounded-local-diagnostic-log.md`
  - `docs/adr/0013-generated-shell-action-window-disposition.md`

## Executive Summary

ZManager already has a shared frontend execution path after a valid Quick Action
reaches the Desktop Shell:

```text
NativeInboundController
  -> quick-action window-disposition seam
  -> QuickActionController
  -> Create Workspace, Archive Workspace, or Job
```

The divergence is before that path. Windows, Linux, and macOS separately own
parts of the action catalog, presentation rules, native transport, validation,
and capability reporting:

- Windows installer and COM-extension files hard-code menu labels, ordering,
  and action mappings.
- Linux desktop actions and Nautilus integration maintain separate lists.
- macOS Finder uses generated action identifiers but separate localized labels
  and selection-shape filtering.
- macOS Services emit an inline request through a different validation path.
- Finder uses an optional App Group transport and currently discards failures,
  which can make a click produce no visible result.
- The macOS Native Platform profile reports Finder actions as disabled and
  exposes no shell-action list even when the extension is packaged and enabled.

The target architecture has one generated shell-action contract, one Rust-owned
ingestion seam, and one frontend execution seam. Platform-native code remains
only as transport and presentation adapters. Finder retains the opaque App
Group token required by ADR-0006; unification does not mean weakening that
security decision or forcing every operating system to launch the executable in
the same way.

## Goals

1. Present the same applicable action labels and ordering in Windows Explorer,
   supported Linux file managers, and macOS Finder.
2. Make `manifests/shell-actions.json` the source of truth for shell action
   identity, presentation policy, selection applicability, multiplicity,
   aliases, supported surfaces, and window disposition.
3. Normalize every native transport into the same versioned
   `ShellActionRequest`.
4. Validate each request once through a Rust-owned ingestion seam before it
   reaches frontend workflow execution.
5. Make Finder transport failures fail closed and become observable without
   logging selected paths, opaque tokens, passwords, or other sensitive data.
6. Report Finder and Services capabilities truthfully as build, package,
   installed, and user-enabled facts.
7. Prove cold and warm shell action behavior, atomic multi-selection, request
   uniqueness, and window disposition through interface-level and installed
   tests.
8. Delete the hand-maintained platform action lists after generated replacements
   are proven.

## Non-Goals

- Reimplementing archive planning, listing, creation, extraction, collision
  handling, overwrite policy, or safety behavior in TypeScript or native shell
  extensions.
- Giving Finder direct access to Tauri commands or archive jobs.
- Replacing the secure App Group token transport with paths embedded in a URL.
- Making every operating system use the same native registration mechanism.
- Removing legacy quick-action argument parsing before compatibility usage is
  measured and an explicit retirement decision is made.
- Unifying the in-application React context menu with operating-system shell
  registration. Both may use the same command vocabulary, but they are distinct
  product surfaces.

## Current Behavior And Evidence

### Shared downstream execution

Once a valid request reaches the frontend, all platforms use the same modules:

- `src/app/controllers/nativeInboundController.ts`
- `src/app/shell/quickActionLaunchDisposition.ts`
- `src/app/controllers/quickActionController.ts`
- `src/app/quickActions.ts`
- `src/runtime/zmanagerRuntimeAdapter.ts`

The frontend selects Main Window or Disposable Task Window behavior from the
generated policy, then invokes the same Create Workspace, Archive Workspace,
and Job behavior. This shared path should be retained and tested through its
existing interfaces.

### Silent macOS failure path

`native/macos/Sources/ZManagerFinderExtension/FinderSyncExtension.swift` creates
its `FinderRequestTransport` optionally. App Group lookup failure produces
`nil`, but Finder still builds menu items. The action handler calls the optional
transport through `try?`, discarding:

- unavailable App Group errors;
- request-write errors;
- callback URL construction errors; and
- `NSWorkspace.open` failures.

The resulting user-visible behavior is a menu click followed by no action. The
current Diagnostic Log cannot distinguish whether the menu callback ran, the
request was written, the URL was opened, the token reached the Native Host, the
request was consumed, or the Native Launch Inbox rejected it.

This is a concrete no-op path. The first implementation slice must capture a
failing installed reproduction before claiming the symptom is fixed.

### Menu catalog drift

The existing platform lists disagree:

- Windows and Linux use labels such as `Add to archive...`, `Add to .zip`, and
  `Add to .tzst`.
- macOS uses labels such as `Compress with ZManager...`, `Compress to ZIP`, and
  `Compress to TAR.ZST`.
- Windows archive selections show extraction actions, Open, and all applicable
  Add-to actions.
- Finder archive selections currently show Open and extraction actions but omit
  Add-to actions.
- Finder exposes `Compress and remove source` for a single folder; Windows and
  Linux do not expose an equivalent context-menu item.
- `manifests/shell-actions.json` order describes contract order, but Windows and
  Linux separately encode a different presentation order.

The duplicated ownership lives in:

- `manifests/shell-actions.json`
- `scripts/generate-native-contracts.mjs`
- `native/windows-shell-extension/src/lib.rs`
- `packaging/windows/nsis-context-menu.nsh`
- `packaging/linux/zmanager.desktop.hbs`
- `packaging/linux/nautilus/zmanager_nautilus.py`
- `packaging/linux/kde/*`
- `packaging/macos/FinderExtension/*/FinderActions.strings`
- `native/macos/Sources/ZManagerGenerated/ShellActions.generated.swift`
- `native/macos/Sources/ZManagerFinderExtensionSupport/FinderActionSupport.swift`
- `src-tauri/src/platform/windows.rs`
- `src-tauri/src/platform/linux.rs`
- `src-tauri/src/platform/macos.rs`

### Ingestion drift

The native paths currently differ:

```text
Windows selected items
  -> versioned request file
  -> Rust parsing and validation

Windows folder background / Linux desktop actions
  -> legacy quick-action arguments
  -> Rust parsing and validation

macOS Finder
  -> App Group request file
  -> opaque URL token
  -> Native Launch Inbox token event
  -> frontend consume_shell_action_request command
  -> Rust parsing and validation

macOS Services
  -> inline Native Launch Inbox request
  -> frontend quick-action execution
```

The Finder transport difference is required. The Services validation difference
is not. Every route should reach one Rust-owned request validation and enqueue
decision before frontend execution.

### Capability-reporting contradiction

`src-tauri/src/platform/macos.rs` currently reports:

- selected-item actions disabled;
- background actions disabled; and
- an empty shell-action list.

The build nevertheless embeds and registers the Finder extension. This
contradicts ADR-0009 and prevents diagnostics from representing the installed
state truthfully.

## Canonical Menu Matrix

The canonical context-menu presentation follows the existing Windows/Linux
wording. The manifest must distinguish contract identity from presentation
order and supported surface.

### Supported archive selection

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

For multiple supported archives:

- Keep actions whose multiplicity accepts multiple archives.
- Omit or disable `Open archive` and `Extract to Archive Folder` according to
  the native surface's normal convention.
- Keep all Add-to actions because archives are valid creation sources.

### Non-archive file, folder, mixed, and folder-background selection

1. `Add to archive...`
2. `Add to .tzap`
3. `Add to .zip`
4. `Add to .7z`
5. `Add to .tzst`
6. `Add to .tgz`

### Actions outside the parity context menu

- The generic `extract` action remains available to Services or other explicit
  surfaces where user preferences decide between review and direct extraction.
- `compressCleanSource` remains a compatibility contract action until usage is
  reviewed, but it is not part of the cross-platform context-menu matrix.
- Removing either action from the serialized contract is a separate
  compatibility decision and is not required for this refactor.

## Target Architecture

```text
manifests/shell-actions.json
  -> generated action policies and platform artifacts

Windows Explorer adapter ──────┐
Linux file-manager adapter ────┼─> versioned ShellActionRequest
macOS Finder token adapter ────┤
macOS Services adapter ────────┘
                                      |
                                      v
                         Rust shell-action ingestion
                           - decode transport
                           - validate contract/version
                           - validate action and paths
                           - classify window disposition
                           - enqueue exactly once
                                      |
                                      v
                           Native Launch Inbox
                                      |
                                      v
                     shared frontend disposition seam
                                      |
                                      v
                         QuickActionController
                           - Create Workspace
                           - Archive Workspace
                           - Jobs Workspace
```

### Module depth

The generated shell-action contract should be a deep module:

- its interface is the action catalog consumed by native adapters and tests;
- its implementation hides label, ordering, applicability, alias, and
  disposition generation;
- callers do not maintain their own parallel action tables.

The Rust shell-action ingestion module should also be deep:

- its interface accepts a decoded versioned request and transport
  classification;
- its implementation owns common validation, diagnostic outcomes,
  deduplication handoff, and Native Launch Inbox enqueue behavior;
- callers do not need to know frontend readiness or workspace behavior.

The platform integrations are real adapters at real seams because Windows,
Linux, Finder, and Services use different native mechanisms. They should not
own archive semantics or duplicate request policy.

## Implementation Slices

### Slice 0: Characterize the installed failure

Goal: identify the first missing step in the real Finder click chain and create
a failing-before test or deterministic installed reproduction.

Work:

- Install the current macOS application using the normal development build.
- Verify the exact Finder extension registration and user-enabled state.
- Exercise one file, one folder, one archive, multiple files, and a folder
  background.
- Record only secret-free lifecycle stages and normalized error codes.
- Determine whether the current failure is:
  - Finder callback not invoked;
  - App Group unavailable;
  - request write rejected;
  - URL callback rejected;
  - Native Host URL event missing;
  - request consume rejected;
  - Native Launch Inbox ingest rejected; or
  - frontend delivery or execution rejected.

Proof:

- A regression test fails at the narrowest automatable seam.
- If the Finder UI click itself cannot be automated reliably, retain an exact
  installed smoke procedure and automate every step immediately after the click.

Exit criteria:

- The failure is localized without logging paths or tokens.
- The implementation plan is updated if the observed failure contradicts the
  expected optional-transport no-op.

### Slice 1: Characterize and extend the generated contract

Goal: make the complete menu matrix explicit before changing generators.

Work:

- Add fixture rows for each selection shape and shell surface.
- Extend `manifests/shell-actions.json` with the minimum fields required to own:
  - canonical English context-menu label;
  - display/localization key;
  - presentation order by context;
  - selection applicability;
  - multiplicity;
  - supported surfaces;
  - window disposition; and
  - compatibility aliases.
- Keep serialized action IDs and request version stable.
- Distinguish unavailable actions from disabled actions where native surfaces
  support disabled menu rows.

Proof:

- Generator tests reject missing labels, duplicate order values within a
  context, invalid surfaces, invalid multiplicity, and actions without window
  disposition.
- Golden fixtures assert the canonical menu matrix for every selection shape.
- Existing request round-trip and disposition tests remain green.

Exit criteria:

- The manifest contains enough policy to generate every platform action table.
- No generator depends on localized text to identify an action.

### Slice 2: Generate platform presentation artifacts

Goal: replace separately maintained menu catalogs with generated artifacts.

Work:

- Generate Windows COM action mappings and NSIS registration rows.
- Generate Linux desktop-action and file-manager action metadata.
- Generate Finder action policy and localization keys/resources.
- Generate Rust Native Platform shell-action profiles.
- Preserve native registration code as an adapter around generated data.
- Update the Windows/Linux context-menu behavior document to reference the
  canonical manifest rather than hard-coded ownership.

Migration sequence:

1. Generate new artifacts alongside the current lists.
2. Add parity tests comparing generated and current outputs.
3. Switch one platform adapter at a time to generated data.
4. Delete the replaced hand-maintained lists immediately after each switch.

Proof:

- One contract fixture produces matching action ID, label, order,
  applicability, multiplicity, and disposition rows for all platforms.
- Windows packaging tests, Linux integration tests, and Swift menu-builder tests
  read generated expectations.
- `node scripts/generate-native-contracts.mjs --check` detects drift.

Exit criteria:

- Changing one context-menu label or action order requires editing the manifest,
  not three or more platform files.
- The deletion test succeeds: removing the generated contract would force the
  full menu policy to reappear across platform adapters.

### Slice 3: Deepen Rust-owned shell-action ingestion

Goal: ensure every native route uses the same version, action, path, and
disposition validation before frontend execution.

Work:

- Concentrate versioned request parsing and validation currently spread through
  `src-tauri/src/quick_action.rs`, commands, startup argument parsing, and macOS
  token consumption.
- Preserve legacy argument and legacy request-file parsing as compatibility
  adapters that produce the versioned internal request.
- Consume Finder tokens through the macOS Native Platform adapter, then submit
  the decoded request through the common Rust ingestion module.
- Convert macOS Services pasteboard input into the same versioned request and
  submit it through the same module.
- Enqueue one executable request in the Native Launch Inbox.
- Preserve ADR-0013's no-duplicate cold-start forwarding and generated window
  disposition.
- Normalize ingestion failures into stable, secret-free codes.

Proof:

- Table-driven Rust tests submit every action through CLI, request file, Finder
  token, and Services adapters and assert the same validated request result.
- A multi-selection request remains atomic and ordered.
- Unknown versions, unknown actions, remote URLs, empty paths, oversized
  requests, stale tokens, and invalid multiplicity fail through the same
  validation rules.
- Cold-start forwarding enqueues exactly one executable request.
- Warm forwarding into an existing normal session does not close the Main
  Window.

Exit criteria:

- Frontend code no longer decides how an opaque Finder token is validated.
- macOS Services cannot bypass Rust request validation.
- Platform adapters contain transport conversion only.

ADR note:

Moving Finder token consumption fully ahead of frontend delivery changes the
specific shell-token routing described in ADR-0013, although it preserves that
ADR's single disposition seam and no-duplication outcome. Update ADR-0013 when
the final ordering is implemented. ADR-0006 remains unchanged.

### Slice 4: Make Finder transport fail closed and observable

Goal: eliminate clickable no-op Finder menu items.

Work:

- Replace optional `FinderRequestTransport` use and `try?` suppression with
  explicit result handling.
- Do not construct actionable menu rows when the required App Group transport
  is unavailable.
- Record bounded native diagnostic stages:
  - menu action invoked;
  - request written;
  - callback open accepted or rejected;
  - token received;
  - request consumed;
  - request validated;
  - inbox accepted or rejected; and
  - frontend acknowledged.
- Use action kind, selection count, window disposition, transport class, and
  normalized error code only. Never record selected paths or opaque tokens.
- Surface a user-visible error only through a safe installed mechanism; do not
  show modal UI from Finder merely to compensate for missing diagnostics.
- Define the development-build policy:
  - provision App Groups correctly for an enabled Finder extension; or
  - report the extension unavailable and omit dead menu actions.
- Keep callback-open failure cleanup and one-time token consumption.

Proof:

- Unit tests cover unavailable App Group, write failure, callback-open failure,
  token consumption failure, and inbox rejection.
- A failure at each stage produces a stable diagnostic code and no sensitive
  fields.
- The installed smoke shows either a working action or a truthful unavailable
  state, never a silent no-op.

Exit criteria:

- No `try?` or ignored result remains on the Finder action delivery path.
- Every accepted menu click reaches either an acknowledged request or a
  diagnosable terminal failure.

### Slice 5: Report native capabilities truthfully

Goal: align the Native Platform profile with packaged and installed reality.

Work:

- Represent these facts separately:
  - build support;
  - package inclusion;
  - installed registration;
  - user-enabled state; and
  - transport readiness.
- Populate the macOS shell-action list from generated policies.
- Keep selected-item and background/container capability reporting distinct.
- Update About/diagnostic snapshots to show the capability state without
  inferring it from browser metadata.
- Add architecture checks rejecting an enabled capability backed by an empty
  action list or unavailable implementation.

Proof:

- Rust tests cover packaged-but-disabled, installed-and-enabled,
  transport-unavailable, and fully available states.
- Package inspection verifies the expected Finder bundle, entitlements, App
  Group identifier, URL scheme, and generated action resources.
- Installed checks compare `pluginkit` state with the reported profile.

Exit criteria:

- macOS no longer reports Finder actions disabled while exposing live menus.
- An unavailable transport cannot masquerade as enabled behavior.

### Slice 6: Cross-platform acceptance and deletion

Goal: prove parity and remove the old ownership paths.

Automated matrix:

- single supported archive;
- multiple supported archives;
- single non-archive file;
- multiple files;
- single folder;
- multiple folders;
- mixed files and folders;
- folder background/container;
- cold application launch;
- warm forwarding into an existing Main Window;
- concurrent Disposable Task Windows;
- invalid and stale request transport;
- default-format and default-extraction preference routing.

Required assertions:

- expected label and ordering;
- one operating-system selection produces one request;
- selected path order is preserved;
- one request produces one workspace transition or Job set;
- Main Window and Disposable Task Window disposition matches generated policy;
- failures settle disposable ownership;
- no passwords, paths, or tokens appear in diagnostics; and
- existing Main Windows survive warm disposable actions.

Installed smoke targets:

- Windows Explorer selected-item and folder-background menus.
- Linux Nautilus plus the packaged desktop-action integration.
- macOS Finder selected-item and container menus.
- macOS Services for Open, Compress, and Extract.

Deletion checklist:

- Remove hard-coded Windows label/action tables replaced by generated output.
- Remove hard-coded Linux label/action tables replaced by generated output.
- Remove separately ordered Finder action lists.
- Remove static Windows/Linux/macOS Rust shell-action profile lists.
- Remove the frontend Finder-token validation branch after Rust ingestion owns
  it.
- Remove tests that only lock obsolete platform-specific duplication.
- Keep only native transport adapters, generated artifacts, common ingestion,
  and interface-level tests.

Exit criteria:

- No supported platform maintains an independent context-menu action catalog.
- All installed smoke checks pass on release-supported architectures.
- `docs/windows-context-menu-behavior.md` describes the canonical
  cross-platform contract rather than a Windows-only parity target.

## Testing Strategy

### Characterization tests

Add tests before changing ownership:

- preserve current request serialization and legacy alias acceptance;
- preserve current startup and single-instance ordering;
- preserve Quick Action preference behavior;
- preserve Main Window versus Disposable Task Window behavior; and
- capture the current installed Finder no-op at the narrowest reproducible seam.

### Contract tests

The generated contract is the primary test surface. Tests should verify:

- every action ID is unique and versioned;
- every context-menu surface has a canonical label;
- action order is total and deterministic within each context;
- selection applicability and multiplicity agree;
- every action has a generated window disposition;
- every native adapter can map its selected paths without archive semantics; and
- generated Rust, TypeScript, Swift, Windows, and Linux artifacts match the
  shared fixture.

### Ingestion tests

The Rust ingestion interface should cover:

- all transport adapters;
- atomic multi-selection;
- request size and path-count limits;
- unknown versions and actions;
- local-path validation;
- archive applicability;
- exactly-once enqueue behavior;
- Native Launch Inbox overflow and replay behavior; and
- normalized secret-free errors.

### Frontend tests

Retain and extend:

- `src/app/quickActions.test.ts`
- `src/app/controllers/quickActionController.test.ts`
- `src/app/controllers/nativeInboundController.test.ts`
- `src/app/shell/quickActionLaunchDisposition.test.ts`
- `src/app/shell/disposableTaskLifecycle.test.ts`
- `e2e/quick-actions.spec.ts`

Frontend tests should receive already validated requests. They should prove
workflow and window behavior, not native transport parsing.

### Native and package tests

Retain and extend:

- `native/macos/Tests/ZManagerFinderExtensionSupportTests/`
- `native/windows-shell-extension` tests
- Windows NSIS context-menu tests
- Linux desktop/Nautilus/KDE integration tests
- macOS bundle, entitlement, registration, and release-gate tests

Unit tests do not replace the installed click matrix.

## Verification Commands

Run the smallest relevant commands during each slice and the complete set before
declaring the refactor complete:

```bash
node scripts/generate-native-contracts.mjs --check
npm run test:frontend
npm run test:e2e
cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos
scripts/test-macos-register-bundle.sh
scripts/release-gate-macos.sh <built-app> --expected-arch <architecture>
```

Run the repository's Windows ARM64 release gate and Linux package/integration
checks on their supported hosts. Run `cd src-tauri && cargo fmt` after any Rust
change.

## Migration And Rollout Risks

### Finder App Group readiness

The most likely silent-no-op source is unavailable or mismatched App Group
state. Do not add an insecure fallback directory or path-bearing URL. A
development build that cannot satisfy App Group requirements must report the
capability unavailable.

### Operating-system menu constraints

Native surfaces differ in whether unsupported actions are omitted or disabled.
The contract owns applicability; each adapter may choose the native presentation
convention without changing action identity or execution behavior.

### Compatibility aliases

Existing `--quick-action` aliases and request files may be used by installed
desktop integrations. Keep parsing adapters until package migrations and
installed checks show they can be retired.

### Generated installer complexity

Generating NSIS, desktop files, or extension source can produce hard-to-review
outputs. Keep generated files deterministic, checked into source where
packaging requires them, and guarded by `--check`.

### Window lifecycle regressions

Changing when Finder tokens are consumed can reintroduce duplicate execution or
incorrect Main Window reveal. Preserve ADR-0013's exactly-once forwarding and
disposition tests throughout the migration.

### Existing unrelated test failure

At plan creation, focused frontend quick-action suites, Rust quick-action tests,
and generated-contract checks pass. The full Swift suite contains one unrelated
Replacement Migration test failure. Track that failure separately and do not
mistake it for evidence about Finder action behavior.

## Definition Of Done

The refactor is complete only when:

- one manifest owns every context-menu action ID, label, order, applicability,
  multiplicity, supported surface, alias, and window disposition;
- Windows, Linux, and macOS generated menu fixtures match the canonical matrix;
- every native path produces the same versioned Shell Action Request;
- one Rust module validates and enqueues requests exactly once;
- macOS Services no longer bypass common validation;
- Finder has no optional or ignored delivery failure path;
- Finder diagnostics identify the terminal delivery stage without sensitive
  data;
- Native Platform capability reporting matches build, package, installed,
  user-enabled, and transport-ready state;
- cold and warm installed shell-action checks pass;
- Main Window and Disposable Task Window behavior remains correct;
- all replaced hand-maintained action tables and token-routing branches are
  deleted; and
- automated tests plus installed smoke results are recorded in the final
  implementation handoff.
