# macOS Full-Target Migration Sequential Execution Plan

- Status: Proposed
- Date: 2026-07-16
- Target repository: `frankmanzhu/zmanager-desktop`
- Reference repository: sibling `ZManager` native macOS application
- Strategic plan: `docs/MACOS_FULL_TARGET_MIGRATION_IMPLEMENTATION_PLAN.md`

## Purpose

This document turns the strategic macOS migration plan into sequential,
testable implementation work. It also closes the gaps discovered during review
of that plan.

There are two independent completion gates:

1. **macOS Native Integration Complete**: the shared Desktop Shell has complete,
   packaged, and verified macOS host and extension behavior.
2. **Native Product Replacement Complete**: every supported behavior of the old
   Swift application has been implemented, deliberately retired, or migrated,
   and existing users can upgrade safely.

Passing the first gate does not authorize retirement of the old application.
The old application may be retired only after both gates pass.

This plan must be executed in order. A phase may begin only after the previous
phase's exit condition is recorded as passing. Work inside one phase may be
parallelized only when it does not change an Interface that another task in the
same phase depends on.

## Non-negotiable architecture

- The React/Tauri Desktop Shell remains the only product GUI.
- Every new application-owned GUI and every modification to an existing
  application-owned GUI uses React, shadcn/ui, and Tailwind CSS 4.
- Product GUI code must not add or extend raw CSS rules, CSS modules, inline
  style objects, legacy class-based styling, imperative HTML construction,
  `innerHTML`, manual element creation, or standalone DOM event wiring.
- Touching a legacy GUI surface requires migrating the affected surface to
  React, shadcn/ui, and Tailwind CSS 4 rather than wrapping, preserving, or
  expanding the legacy DOM/CSS ownership path.
- `zmanager-core` remains the only archive engine and safety owner.
- Swift/AppKit owns macOS host and extension integration, not archive semantics.
- SwiftUI screens and ViewModels are behavior evidence, not migration targets.
- `src/app` owns shared workflow state and decisions.
- `src/desktop` owns frontend-facing concrete desktop Adapters.
- `src-tauri` owns Rust commands, DTO mapping, job/session registries, and native
  platform selection.
- Native callbacks enter workflow state only through the startup/controller and
  command-router Seams.
- The frontend never selects behavior with `navigator.userAgent`,
  `navigator.platform`, browser-agent parsing, or equivalent operating-system
  inference. It consumes explicit platform capabilities and integration status.
- Passwords, private keys, session material, and other secrets never enter URLs,
  App Group request files, frontend storage, logs, or diagnostics.
- A migration is incomplete until the old ownership path is deleted or formally
  frozen with a retirement record.

### GUI implementation rule and native exception

Application-owned windows, workspaces, preferences, account screens, progress
views, dialogs rendered inside the webview, menus rendered inside the webview,
tables, trees, details panes, prompts, banners, and notifications are product
GUI. Their only permitted rendering Implementation is React with reusable
shadcn/ui primitives and Tailwind CSS 4 utilities.

The following operating-system-owned presentation surfaces are narrow native
exceptions because macOS supplies or requires their host process and Interface:

- Finder Sync menus;
- macOS Services and the system application menu bar;
- `NSOpenPanel`, `NSSavePanel`, and system alerts used only where the shared
  Tauri Adapter fails a recorded parity test;
- Quick Look previews and thumbnails;
- Spotlight metadata presentation controlled by macOS;
- system drag feedback, file promises, icons, and activation/window chrome.

These exceptions permit only the native presentation and lifecycle code needed
by the operating-system Interface. They do not permit SwiftUI product screens,
parallel workflow state, duplicate command routing, or native replacements for
React-owned Main Window and Disposable Task Window content. Quick Look HTML or
drawing resources remain isolated inside the Quick Look extension and must not
become a second web application or frontend styling system.

Any additional native presentation exception requires an ADR and a parity-ledger
entry proving that an operating-system Interface prevents React ownership. A
preference for AppKit or reuse of a SwiftUI screen is not sufficient.

Existing raw CSS and manual DOM code is a migration inventory, not an accepted
pattern. Add an architecture allowlist for current legacy sites, reject new
sites outside it, and reduce the allowlist whenever a listed GUI surface is
touched. The final replacement gate requires no remaining application-owned
legacy GUI site.

## Target architecture

```text
macOS lifecycle / Apple event / URL / Service
  -> Swift macOS Native Host
  -> versioned inbound-event envelope
  -> Rust Native Launch Inbox
  -> startup controller or command router
  -> shared Workspace/controller
  -> zmanager-core

Finder Sync selection
  -> versioned Shell Action Request
  -> atomic App Group request file
  -> opaque-token URL callback
  -> Rust Native Launch Inbox
  -> shared command router

Quick Look / Spotlight
  -> native extension process
  -> metadata-only core FFI
  -> bounded public-metadata result
  -> preview, thumbnail, or metadata attributes

Archive entry drag-out
  -> Rust Native Drag Session Registry
  -> Swift NSFilePromiseProvider
  -> destination supplied by Finder
  -> core streaming into promised destination
```

### Target source layout

```text
manifests/
  archive-file-types.json
  shell-actions.json
  native-inbound-events.schema.json

crates/
  zmanager-public-metadata-ffi/

native/macos/
  Package.swift
  Sources/
    ZManagerMacOSHost/
    ZManagerMacOSShared/
    ZManagerFinderExtension/
    ZManagerQuickLookPreview/
    ZManagerQuickLookThumbnail/
  Spotlight/
  Resources/
  Entitlements/
  Tests/

src-tauri/src/platform/
  macos/
    mod.rs
    host.rs
    inbox.rs
    icons.rs
    dialogs.rs
    launch_services.rs
    drag.rs

src/app/workspaces/
  account/

docs/migration/
  macos-native-capability-parity.json
  macos-replacement-parity.json
  macos-release-acceptance.json
```

The `macos.rs` to `macos/` conversion occurs only when the additional Modules
exist. Do not create pass-through files merely to match this target tree.

## Required architectural Modules

### Executable parity ledgers

Two machine-readable ledgers guard the two independent completion gates:

- `macos-native-capability-parity.json` maps every Windows/Linux native
  capability to its macOS Adapter, shared Tauri proof, or accepted
  not-applicable decision.
- `macos-replacement-parity.json` maps every retained native Swift product
  behavior and test to its replacement Module and proof.

The first ledger proves platform integration parity. The second proves product
replacement parity. Neither may substitute for the other.

### Native Platform

`NativePlatform` remains the compile-selected Interface for bounded
request/response behavior:

- build-time capability profile;
- Main Window configuration;
- system icon resolution;
- native panel operations proven necessary by parity tests;
- open/reveal operations proven necessary by parity tests;
- Launch Services queries and mutations; and
- native drag-session creation.

It must not become a broad mirror of AppKit.

### Native Host Runtime

`NativeHostRuntime` is the stateful lifecycle Module. Its Interface covers:

- initialize lifecycle observation;
- register Apple-event, open-document, URL, Services, and reopen handlers;
- attach the Tauri application emitter when it becomes available;
- deliver typed events into the Native Launch Inbox;
- report initialization and callback errors;
- remove observers and shut down safely.

The Swift Implementation may contain internal Modules, but Rust sees only a
small C-compatible Interface. No AppKit object crosses the Seam.

### Native Launch Inbox

The Rust-owned Native Launch Inbox prevents cold-start and readiness races. Its
Interface must support the equivalent of:

```text
ingest(event)
frontend_ready(window_label)
pending_events(window_label)
acknowledge(event_id)
shutdown()
```

Every event contains a schema version, unique event identifier, event kind,
timestamp, typed payload, and optional idempotency key. Typed payloads reuse
existing contracts where possible:

- `OpenPaths`;
- `ShellActionRequest`;
- non-secret `HostedAuthCallback` data; and
- `ReopenApplication`.

“Native Intent” is only an envelope term. It must not become a second generic
command language beside `ShellActionRequest` and the existing command router.

The inbox owns ordered cold-start buffering, frontend-ready draining,
acknowledgement, bounded replay, deduplication, queue limits, and shutdown. The
single-instance callback and macOS Native Host both ingest through this Module.

### Native Drag Session Registry

The Rust-owned Native Drag Session Registry owns archive handles, in-memory
password lifetime, item descriptors, cancellation, per-item completion, and
session cleanup for macOS file-promise drag. The Swift host owns the AppKit drag
session and requests streams only after Finder provides a destination.

### Public Metadata FFI

`zmanager-public-metadata-ffi` is a separate, metadata-only Module used by Quick
Look and Spotlight. Its Interface exposes only bounded public metadata parsing
and result-freeing operations. It must not expose archive jobs, account state,
identity state, private keys, mutations, or general core access.

Prefer static linking into each extension. A dynamic library is acceptable only
if the packaged linkage spike proves it safer and an ADR records the rpath,
embedding, signing, and update contract.

## Capability ownership table

This is the default routing decision. A different Adapter may be selected only
after an observable parity test fails and the decision is recorded.

| Capability | Primary owner | Replacement rule |
|---|---|---|
| Native open/save panels | Existing Tauri dialog Adapter | Add a Swift operation only for a proven gap behind the same frontend Interface |
| Open/reveal | Existing Tauri opener Adapter | Replace behind the same frontend Interface only for a proven gap |
| Input file drops | Existing Tauri file-drop Adapter | Keep workflow decisions in shared Workspaces |
| System file icons | Swift `NSWorkspace` host operation | Replace the macOS icon fallback |
| Default opener | Swift Launch Services host operation | Expose through a typed desktop Adapter/controller |
| Lifecycle and Services | Swift Native Host Runtime | Deliver through the Native Launch Inbox |
| Application menu | Tauri/AppKit presentation plus shared command router | No Swift command switch |
| Archive drag-out | Swift file promises plus Rust Drag Session Registry | Delete eager macOS staging after parity passes |
| Finder actions | Finder Sync extension | Emit `ShellActionRequest`; perform no archive work |
| Quick Look | Quick Look extensions | Use only Public Metadata FFI |
| Spotlight | Spotlight importer | Use only Public Metadata FFI |

## Capability state model

Do not overload one boolean with build, package, installation, and user state.

`PlatformProfile` is static for a build and reports:

- supported by source;
- included in this package;
- verified by the package gate.

`PlatformIntegrationStatus` is queried at runtime and reports, where observable:

- installed or registered;
- enabled;
- needs user action;
- current default-handler state; and
- the last normalized integration error.

Finder Sync may therefore be packaged correctly while disabled by the user.
Frontend behavior must derive from these capability records, never browser or
user-agent inspection.

## Sequential implementation phases

### Phase 0: freeze the baseline and collect evidence

#### Tasks

1. Record the exact `zmanager-desktop` commit and the exact last releasable
   native `ZManager` commit.
2. Run and record the existing frontend, Rust, architecture, Swift-reference,
   and local macOS package tests without changing behavior.
3. Inventory every first-party Swift/Objective-C source, test target, bundle,
   extension, entitlement, identifier, URL scheme, UTType, Services entry,
   preference key, Application Support path, and release artifact.
4. Record the last released native application version and supported macOS and
   architecture matrix.
5. Capture the current installed-app upgrade behavior on a disposable test
   account before modifying bundle identity or extension registration.

#### Proof

- Baseline commands and results are committed under the migration documentation.
- Every native source and test appears in the replacement parity inventory.
- Known failures are recorded and are not silently treated as migration
  regressions.

#### Exit condition

The starting behavior, source revisions, release identity, and test baseline are
reproducible. No implementation work begins before this gate passes.

### Phase 1: create the replacement parity ledger and decide identity

#### Tasks

1. Create `docs/migration/macos-native-capability-parity.json` from the strategic
   plan's Windows/Linux-to-macOS ledger. Give every capability an owner,
   disposition, Interface proof, package proof, installed proof, status, and
   explicit not-applicable decision where relevant.
2. Create `docs/migration/macos-replacement-parity.json` with one entry for every
   native source, user flow, and characterization test.
3. Give each replacement entry:
   - stable identifier;
   - reference source and tests;
   - observable behavior;
   - target Module and Interface;
   - disposition: `existing`, `migrate-native`, `reimplement-shared`, or
     `retire-by-decision`;
   - automated and manual proof;
   - owner and status.
   For presentation-related entries also require:
   - `presentationOwner`: `react-shell`, `os-mandated-native`, or `none`;
   - `uiTechnology`: `react-shadcn-tailwind4`, `approved-native-surface`, or
     `none`;
   - native-presentation justification and linked decision when applicable.
4. Include account authentication, hosted callback handling, certificates,
   recipient keys, contacts, document verification, encrypted sharing,
   preferences, preview cleanup, default openers, lifecycle, Finder, Quick Look,
   Spotlight, and packaging.
5. Add a validation script that rejects missing fields, duplicate identifiers,
   unknown statuses, missing proof, and retirement/not-applicable entries without
   a linked product or platform decision.
   It must also reject application-owned GUI not assigned to
   `react-shadcn-tailwind4`, native presentation without an allowlisted
   operating-system surface and decision, and migrated SwiftUI screens assigned
   to a native target.
6. Adopt `com.frankmanzhu.zmanager` as the default replacement bundle identifier,
   subject to verification against the last release and the Apple developer
   account.
7. Reserve and verify the Team ID, stable App Group identifier, extension and
   importer identifiers, `zmanager://` URL scheme, and UTType ownership.
8. Decide the minimum macOS version, sandbox/hardened-runtime posture, and initial
   release architecture. Default to preserving the previous minimum version and
   producing separate `arm64` and `x86_64` artifacts before considering a
   universal artifact.
9. Choose one canonical product version source and add a consistency check for
   npm, Cargo, Tauri, Swift bundles, nested extensions, and artifact names.

#### Proof

- Ledger validation runs in `npm run test:architecture` or an equivalent required
  repository check.
- A clean-machine identity test proves the proposed identifier and extensions can
  replace the last native release without creating two products.
- Version-consistency testing fails on an intentionally mismatched fixture.

#### Exit condition

Every old-product behavior has an explicit disposition, and identity decisions
needed by App Groups, callbacks, storage, signing, and packaging are frozen.

### Phase 2: adopt governing documentation and ADRs

#### Tasks

1. Update `AGENTS.md`, `CONTEXT.md`, `docs/ARCHITECTURE.md`, requirements,
   roadmap, setup, release, and contradictory implementation documents to make
   macOS a first-class target and this repository the replacement product.
2. Add the domain terms macOS Native Host, macOS Extension Suite, Native Launch
   Inbox, Native Drag Session, Public Metadata FFI, Release Bundle, and
   Replacement Migration.
3. Create an ADR for canonical macOS identity, distribution posture, and full
   target ownership. Explicitly supersede the conflicting clause in ADR-0003.
4. Create an ADR for the Native Host Runtime and Native Launch Inbox ordering,
   acknowledgement, replay, and shutdown contract.
5. Extend or supersede ADR-0002 with the Finder App Group/opaque-token transport.
6. Create an ADR for Public Metadata FFI scope and core revision pinning.
7. Create an ADR for asynchronous file-promise drag sessions and supersede the
   macOS eager-staging portion of ADR-0003 after the new path is proven.
8. Amend or supersede ADR-0001's allowance for unconditional observable
   fallbacks on enabled first-class capabilities.
9. Extend architecture tests to reject new long-term separate-product wording,
   frontend browser/user-agent OS detection, and macOS native imports outside
   approved Modules.
10. Add frontend architecture checks that reject new application-owned GUI using
    raw CSS, CSS modules, inline styles, imperative HTML, `innerHTML`, manual
    element creation, standalone DOM event wiring, or non-React rendering.
11. Record the existing legacy GUI allowlist and require it to shrink whenever a
    listed surface is modified. Do not allow wildcard files or directories.
    Keep any required Tailwind entrypoint and desktop event-Adapter exclusions
    tightly named; do not use them to exempt product rendering.

#### Proof

- Architecture tests fail on fixtures containing `navigator.userAgent`,
  `navigator.platform`, or equivalent frontend OS selection.
- Architecture tests fail on fixtures containing forbidden raw CSS/manual DOM
  GUI patterns outside the exact legacy allowlist.
- Every contradicted accepted ADR is linked from its superseding decision rather
  than silently rewritten.

#### Exit condition

Repository policy, domain language, and accepted decisions consistently describe
the target architecture and no longer prohibit required implementation work.

### Phase 3: centralize manifests and generated contracts

#### Tasks

1. Move canonical archive-type policy to
   `manifests/archive-file-types.json`.
2. Create `manifests/shell-actions.json` for identifiers, valid selection shapes,
   ordering, and display-key references.
3. Create `manifests/native-inbound-events.schema.json` for the versioned event
   envelope and typed payload references.
4. Generate TypeScript, Rust, Swift, Info.plist/UTType, and packaging inputs from
   these manifests.
5. Generate localization keys, but resolve labels through frontend localization
   or native `.strings`/`InfoPlist.strings` at the presentation Seam.
6. Add a `--check` mode that compares generated outputs without rewriting them.
7. Delete hand-maintained Swift archive-type and Finder action policy after
   generated Swift fixtures prove parity.

#### Proof

- Shared fixtures are consumed by Rust, TypeScript, and Swift tests.
- CI fails when a generated output, plist fragment, or package declaration
  differs from the canonical manifests.
- Compound suffixes, split volumes, action multiplicity, and ordering match the
  recorded reference behavior.

#### Exit condition

Archive types, actions, inbound-event schemas, UTTypes, and packaging declarations
have one canonical source and enforceable drift protection.

### Phase 4: prove Swift host linkage and metadata-only FFI

#### Tasks

1. Create the minimal `native/macos/Package.swift`, host/shared Modules, and Swift
   test targets.
2. Spike a static Swift host library linked into the Tauri Rust executable.
3. Prove Rust-to-Swift invocation and Swift-to-Rust asynchronous callbacks on the
   AppKit main thread.
4. Document memory ownership, string/data freeing, callback lifetime, error DTOs,
   cancellation, reentrancy, and shutdown.
5. Create `crates/zmanager-public-metadata-ffi` with only bounded metadata summary
   and result-freeing exports.
6. Add an exported-symbol allowlist and a build assertion that the host and
   metadata FFI resolve the same pinned `zmanager-core` revision.
7. Prefer static extension linkage. If it fails, prove dynamic embedding, rpaths,
   signatures, and installed loading before accepting it.
8. Package and ad-hoc sign the spike inside a Tauri `.app`; do not accept a
   development-only executable test.
9. Prove the App Group/opaque-token handoff with a minimal extension-shaped
   writer and host consumer, including atomic creation, consume, and deletion.
10. Prove an `NSFilePromiseProvider` session backed by a fake Rust stream and
    confirm the callback begins only after a destination is supplied.
11. Remove abandoned spike paths so only the selected linkage Implementation
   remains.

#### Proof

- The packaged app starts the Swift host, receives a callback, and shuts down
  without leaks, duplicate observation, or delegate conflict.
- Symbol inspection proves the metadata FFI exposes no account, key, mutation,
  or general archive-job entry points.
- Malformed and oversized metadata fixtures fail safely.
- The App Group and file-promise spikes pass from an ad-hoc-signed installed app,
  not only from unit tests.

#### Exit condition

The selected host and extension linkage model works inside a signed package and
its Interface is frozen for production implementation.

### Phase 5: implement the Native Launch Inbox and host lifecycle Seam

#### Tasks

1. Create the Rust Native Launch Inbox before Tauri application startup.
2. Initialize the Swift callback so early macOS events can enter the inbox before
   the AppHandle or webview is ready.
3. Attach the Tauri emitter during setup and expose a frontend-ready handshake.
4. Route Tauri single-instance launches through the same inbox.
5. Implement ordered drain, acknowledgement, bounded replay, queue limits,
   idempotency keys, and duplicate suppression.
6. Reject unknown event versions and secret-bearing or oversized payloads.
7. Register open-document Apple events, URL callbacks, Dock reopen, Services,
   activation, and shutdown observation in the Swift Native Host Runtime.
8. Keep typed payloads separate: open paths remain open paths, shell actions
   remain `ShellActionRequest`, and hosted authentication remains its own
   non-secret callback type.

#### Proof

- Tests cover event-before-setup, event-before-webview, event-after-ready,
  simultaneous events, repeated callbacks, unknown versions, queue overflow,
  acknowledgement/replay, multiple windows, and shutdown.
- One cold or warm operating-system action produces exactly one routed intent.
- No event mutates a Workspace directly.

#### Exit condition

All native and single-instance startup events have one durable, ordered, tested
ownership path with no readiness race.

### Phase 6: close shared product-workflow gaps

#### Tasks

1. Implement every `reimplement-shared` ledger entry before claiming native
   product replacement.
2. Create a deep Account Workspace Module for authentication state, sessions,
   certificates, recipient keys, contacts, document verification, and encrypted
   sharing when those behaviors remain supported product requirements.
3. Add Rust commands that call core-owned account/obligation behavior directly;
   do not transplant the old full Swift FFI into the Tauri host.
4. Add typed frontend DTOs, an injected account controller, immutable snapshots,
   and React rendering using reusable shadcn/ui primitives and Tailwind CSS 4
   utilities.
5. Deliver hosted-auth callbacks through the Native Launch Inbox and reject
   tokens or relay secrets embedded in callback URLs.
6. Reconcile creation, extraction, preview, password retry, preferences, quick
   extraction, and cleanup characterization tests from the old ViewModels with
   existing Workspaces/controllers.
7. Migrate compatible preference meanings into typed storage; do not introduce
   parallel `UserDefaults` for React-owned workflow settings.
8. Update ledger entries only after their target Interface tests pass.
9. Convert every touched legacy account, preferences, create, extract, jobs,
   prompt, progress, table, tree, and notification surface to React; delete the
   affected imperative DOM and raw CSS ownership path in the same slice.

#### Proof

- Each retained Swift user-flow test has an equivalent shared Interface test or
  a documented reason why installed-system verification is required.
- Account secrets never appear in frontend persistence, callback URLs, logs, or
  diagnostics.
- Characterization coverage exists before moving or changing behavior.
- Architecture checks prove that changed product GUI surfaces contain no raw
  CSS, manual DOM construction, inline styling, or parallel non-React renderer.

#### Exit condition

Every retained product workflow from the old application exists in the shared
Desktop Shell or has an accepted retirement decision.

### Phase 7: complete native host operations and Adapter parity

#### Tasks

1. Implement real batched `NSWorkspace`/UTType icon lookup and PNG output.
2. Audit every reference `NSOpenPanel` and `NSSavePanel` behavior against the
   existing Tauri dialog Adapter: types, files/folders, multiple selection,
   parent window, sheet modality, cancellation, and errors.
3. Add Swift panel operations only for failed parity cases and keep the existing
   frontend dialog Interface.
4. Audit open/reveal and activation against the existing Tauri opener Adapter;
   replace its macOS Implementation only for failed cases.
5. Implement Launch Services status, set, restore, and previous-handler storage
   behind a typed controller/desktop Interface.
6. Implement the standard application/File/Edit/Window/Help menu and route
   product actions through the shared command router.
7. Implement Services, reopen, activation, Main Window, and Disposable Task
   Window lifecycle without creating native product content or parallel
   workflow ownership in Swift. The content of both window types remains React,
   shadcn/ui, and Tailwind CSS 4.
8. Prove the existing input-drop Adapter for files, folders, multi-selection,
   invalid paths, mode decisions, and cancellation on macOS.
9. Delete any superseded or duplicate macOS Tauri/Swift ownership path after the
   selected Adapter passes parity.

#### Proof

- Swift host tests cover native operations through the same Interface used by
  Rust.
- Frontend controller tests cover dialog, opener, default-handler, drop, and menu
  result mapping.
- Installed smoke tests cover activation, sheets, menus, Services, default
  handlers, and real icons.

#### Exit condition

Every host capability has one owner and one caller path. No enabled macOS
capability remains a no-op or unconditional fallback.

### Phase 8: implement asynchronous file-promise drag

#### Tasks

1. Add the Rust Native Drag Session Registry and session command/event DTOs.
2. Validate and describe selected archive entries without extracting payload
   bytes.
3. Keep archive handles and password material only in registry-owned memory for
   the shortest required lifetime.
4. Create one `NSFilePromiseProvider` per promised top-level file or directory.
5. Begin core streaming only after Finder supplies the destination URL.
6. Support concurrent promise callbacks, nested directory materialization,
   per-item completion, cancellation, and application shutdown.
7. Resolve destination-volume case sensitivity, Unicode normalization, name
   collision, path length, overwrite behavior, and partial-output cleanup at
   destination-write time.
8. Add timeouts and cleanup for abandoned sessions without using a fixed staging
   lifetime as the delivery mechanism.
9. Delete eager macOS payload staging after installed Finder parity passes. Keep
   Linux staging and Windows virtual-file behavior platform-owned.

#### Proof

- Instrumented tests prove zero payload bytes are extracted before Finder
  requests a destination.
- Tests cover files, directories, nested contents, multiple items, concurrent
  callbacks, password-protected archives, cancel, shutdown, destination failure,
  Unicode, case collision, long names, and cleanup.
- The public command returns session state asynchronously rather than blocking
  for the complete drag lifetime.

#### Exit condition

Finder receives genuine file promises backed by on-demand core streaming and no
old eager macOS staging ownership remains.

### Phase 9: migrate Finder and Services request transport

#### Tasks

1. Migrate Finder Sync implementation, menu tests, Info.plist, entitlements, and
   localized strings.
2. Generate action identifiers, visibility, valid selection shapes, ordering,
   and labels from canonical manifests.
3. Register a stable App Group for the main application and Finder extension.
4. Write each `ShellActionRequest` with exclusive creation, owner-only
   permissions, bounded JSON, fsync, and atomic rename inside the App Group
   request directory.
5. Put only an opaque token in `zmanager://shell-request/<token>` callbacks.
6. Validate token grammar, entropy, directory containment, file type, ownership,
   permissions, size, version, timestamp, and TTL before reading.
7. Prevent replay and delete request files after success and every terminal
   failure. Add bounded cleanup for abandoned expired requests.
8. Route Finder requests through the Native Launch Inbox and existing command
   router.
9. Route host-process Services through the same `ShellActionRequest` contract
   without an unnecessary request file.
10. Keep Finder and Services implementations archive-semantic-free.

#### Proof

- Contract fixtures round-trip across Finder Swift, Rust, and frontend routing.
- Security tests cover path traversal, symlinks, wrong owner/mode, oversized
  files, stale files, replay, malformed JSON, unknown version, concurrent
  requests, and deletion failures.
- Single and multi-selection each start exactly one intended request.

#### Exit condition

Finder item, container, and Services actions use one atomic, secure, versioned
request path and never perform archive work inside an extension.

### Phase 10: migrate Quick Look, thumbnail, and Spotlight

#### Tasks

1. Migrate Quick Look preview and thumbnail implementations and characterization
   tests.
2. Migrate the Spotlight importer, schema, fixtures, and localized strings.
3. Link each extension only to Public Metadata FFI from the same pinned core
   revision as the host.
4. Enforce public, non-secret output DTOs and hostile-input limits.
5. Verify sandbox entitlements, extension points, crash isolation, architecture,
   and installed registration.
6. Add installed smoke commands for Quick Look and Spotlight that cannot pass
   against stale cached extensions.

#### Proof

- Preview, thumbnail, and metadata fixtures cover signed, unsigned, encrypted,
  multi-volume, malformed, oversized, and hostile TZAP inputs.
- Exported-symbol and entitlement checks run against packaged extension
  executables.
- Cache-isolated installed tests prove the current build produced the result.

#### Exit condition

Quick Look and Spotlight work from the installed application using only the
bounded Public Metadata FFI.

### Phase 11: implement versioned replacement migration

#### Tasks

1. Implement a native migration reader for allowlisted non-secret legacy
   `UserDefaults`, Application Support paths, preview roots, default-opener
   restoration state, and extension registration state.
2. Give migrations explicit schema versions and completion markers.
3. Make every migration idempotent and safe to retry after interruption.
4. Back up compatible non-secret values before mutation and keep legacy state
   during the initial successful migration window.
5. Define precedence when both legacy values and new typed storage values exist.
6. Keep account identities, trust data, and secrets in core-owned paths and
   migrate or reuse them only through core-owned operations.
7. Handle corrupt, unknown, partial, and future-version data without blocking a
   clean application launch.
8. Migrate default-opener restoration state before changing handlers.
9. Remove or replace stale old-app Finder, Quick Look, Spotlight, URL, and Launch
   Services registrations without affecting the new identifiers.
10. Provide a rollback procedure and record what cannot be reversed.

#### Proof

- Tests cover clean install, last-release upgrade, interruption, retry, corrupt
  data, both applications present, missing directories, partial state, rollback,
  and repeated launch.
- Migration diagnostics contain key names and normalized errors only, never
  secret values.

#### Exit condition

The migration Module is versioned, idempotent, rollback-aware, and passes its
isolated and in-application tests. Installed upgrade acceptance remains a
required Phase 13 and Phase 14 gate after the Release Bundle exists.

### Phase 12: unify packaging, signing, and release identity

#### Tasks

1. Add macOS-specific Tauri configuration using the frozen replacement identity.
2. Generate the final Info.plist, UTTypes, document types, Services, URL scheme,
   and native localization inputs from canonical manifests.
3. Embed the Swift host, Finder extension, Quick Look extensions, Spotlight
   importer, and metadata FFI outputs.
4. Verify version and build-number consistency across every nested bundle.
5. Normalize architectures, install names, and rpaths before signing.
6. Sign nested libraries/importers/extensions first and the app last; verify
   entitlements and designated requirements after signing.
7. Build architecture-labelled `.zip` and `.dmg` artifacts for the initially
   supported architecture matrix.
8. Notarize, staple, and run Gatekeeper assessment against installed artifacts.
9. Make local register/unregister scripts deterministic and isolate tests from
   stale Launch Services, Finder, Quick Look, and Spotlight caches.
10. Delete the old independent macOS packager after the unified pipeline passes
    all acceptance gates.

#### Proof

- The release gate fails for a missing slice, identifier mismatch, version
  mismatch, unsigned nested executable, unexpected executable, invalid
  entitlement, bad rpath, failed notarization, or missing staple.
- A clean test account installs and launches the packaged DMG without relying on
  build-tree files.

#### Exit condition

One reproducible pipeline owns the complete signed, notarized, stapled macOS
Release Bundle.

### Phase 13: make macOS a required CI and release target

#### Pull-request gate

1. Run frontend, architecture, Rust, Swift, manifest, contract, and metadata FFI
   tests without production credentials.
2. Build an ad-hoc-signed application and inspect bundle layout, identifiers,
   versions, architectures, entitlements, symbols, and rpaths.
3. Upload the inspection report and unsigned/ad-hoc test artifact for diagnosis.

#### Protected release gate

1. Import signing credentials into a temporary CI keychain.
2. Build architecture-specific release artifacts.
3. Sign inside-out, notarize, staple, assess, and produce checksums.
4. Clean credentials and the temporary keychain on success and failure.
5. Make publication depend on every required macOS artifact and verification
   report.

#### Installed-system gate

1. Test the signed build on a clean account or controlled macOS release machine.
2. Verify lifecycle, associations, menus, Services, Finder, Quick Look,
   Spotlight, default openers, drag promises, clean installation, upgrade from
   the last native release, migration retry, rollback, and uninstall.
3. Record OS version, architecture, filesystem case mode, build identifier,
   extension status, commands, results, and screenshots/logs where appropriate.
4. Publish the completed acceptance record as a release artifact.

#### Exit condition

macOS package and release jobs are required, credentials are isolated, and
installed-system acceptance is a publication prerequisite rather than an
unrecorded manual check.

### Phase 14: cut over and retire the old product

#### Tasks

1. Require every `macos-replacement-parity.json` entry to be `verified` or have
   an accepted retirement decision.
2. Require the macOS Native Integration Complete gate to pass.
3. Require an upgrade test from the last native release on each supported
   architecture.
4. Confirm one installed application, one URL scheme owner, one association
   owner, and one copy of each extension/importer.
5. Record the first replacement version, rollback version, migration schema, and
   support procedure.
6. Freeze the old Swift GUI repository as read-only migration evidence.
7. Remove its active build, signing, publication, and product-ownership role.
8. Monitor the first replacement release for migration, extension registration,
   callback, and default-handler failures before deleting rollback assets.

#### Exit condition

Both completion gates pass, the old application has no active product ownership,
and the replacement release can be installed, upgraded, operated, and rolled
back according to recorded procedures.

## Required verification commands

The final scripts and package names may evolve, but the Release Bundle must pass
at least:

```sh
npm run test:frontend
npm run test:architecture
npm run build
(cd src-tauri && cargo test)
cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml
cargo test --manifest-path crates/zmanager-public-metadata-ffi/Cargo.toml
swift test --package-path native/macos
scripts/build-macos.sh --no-install
scripts/release-gate-macos.sh
```

The release gate must inspect the installed or installable result, not only
build-tree outputs.

## Phase evidence record

Each phase completion record must include:

- phase and completion date;
- commit identifier;
- implemented Modules and changed Interfaces;
- characterization tests added before migration;
- automated commands and results;
- installed/manual checks and environment;
- deleted or frozen old ownership paths;
- residual risks and explicit exceptions;
- approver for security, identity, or release decisions where applicable.

## Final definition of done

### macOS Native Integration Complete

- Native Platform and Native Host Runtime contain no misleading enabled stubs.
- The Native Launch Inbox reliably handles cold and warm events.
- Icons, lifecycle, Services, menus, Launch Services, and file-promise drag pass
  their Interface and installed-system tests.
- Finder, Quick Look, thumbnail, and Spotlight modules are built from this
  repository and embedded in the Release Bundle.
- Host and extension archive behavior resolve the same pinned core revision.
- The package is signed, notarized, stapled, architecture-verified, and produced
  by required release jobs.

### Native Product Replacement Complete

- Every replacement parity entry is verified or intentionally retired by an
  accepted decision.
- Retained account, sharing, preference, preview, create, extract, and lifecycle
  behaviors exist in the shared Desktop Shell.
- All application-owned GUI is React, shadcn/ui, and Tailwind CSS 4; no raw CSS,
  manual DOM renderer, inline styling path, or SwiftUI product screen remains.
- Upgrade migration passes from the last native Swift release.
- No duplicate application, extension, association, URL scheme, or release
  pipeline remains.
- The old repository is frozen as migration evidence and no longer owns product
  behavior, packaging, signing, or publication.

Only when both definitions are satisfied is macOS a full target and
`zmanager-desktop` the safe replacement for the old native product.
