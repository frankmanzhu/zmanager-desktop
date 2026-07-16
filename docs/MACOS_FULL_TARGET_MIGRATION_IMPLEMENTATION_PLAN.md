# macOS Full-Target Migration Implementation Plan

- Status: Proposed
- Date: 2026-07-15
- Target repository: `frankmanzhu/zmanager-desktop`
- Reference implementation: sibling `ZManager` macOS SwiftUI repository

## Outcome

Make macOS a first-class build, integration, packaging, and release target of
ZManager Desktop alongside Windows and Linux. This repository becomes the one
desktop product repository and replaces the separately maintained SwiftUI GUI
after migration and parity verification.

The shared React/Tauri Desktop Shell remains the product UI. Proven native
macOS code from the existing `ZManager` project is migrated into this repository
as Swift/AppKit handlers, Finder and Quick Look extensions, Spotlight support,
and packaging inputs. Archive planning, listing, creation, extraction, safety,
and job behavior continue to be owned by the same `zmanager-core` used by the
Tauri command layer.

This is not a rewrite of the SwiftUI GUI inside Tauri. SwiftUI screens and
ViewModels are reference behavior and characterization evidence. Native macOS
integration code is migrated; shared workflow and rendering ownership stays in
the existing Desktop Shell.

## Corrected baseline

The initial macOS portability slice established a compile-enforced adapter and
local Tauri packaging, but it did not establish complete macOS support.

| Capability | Current implementation | Honest status |
|---|---|---|
| Platform registration | `MacOsPlatform::register_services` returns the builder unchanged | Scaffold only |
| Platform profile | Static values, with Finder/background actions disabled | Metadata only |
| System file icons | `macos_system_file_icon_data_url` always returns `None` | Missing |
| Native drag path policy | Rust POSIX preparation with macOS collision policy | Implemented, limited |
| Native drag dispatch | Eagerly stages archive entries, then calls the Rust `drag` crate | Partial; native AppKit dispatch but no file promises |
| Main Window decoration | Calls Tauri `set_decorations(true)` | Basic only |
| Dialogs, opener, windows, file drops | Shared Tauri/TypeScript adapters | Present but not macOS-parity audited |
| File associations | Tauri bundle declarations | Declared; launch and replacement behavior not fully proven |
| Finder integration | None | Missing |
| Services integration | None | Missing |
| Quick Look preview/thumbnail | None | Missing |
| Spotlight importer | None | Missing |
| Default-opener management | None | Missing |
| Packaging | Local unnotarized `.app` and `.dmg` | Development-only |
| Signing/notarization/release | Explicitly excluded | Missing |

The previous interpretation allowed an interface method returning a fallback to
count as an implementation. That is no longer sufficient for a first-class
target. A capability is complete only when its observable behavior is implemented
and verified on macOS.

## Product and repository decision

The following decisions govern the migration:

1. `zmanager-desktop` is the canonical desktop product repository for Windows,
   Linux, and macOS.
2. The existing sibling `ZManager` macOS GUI is the migration source and
   behavior reference, not the long-term owner of a separate product.
3. macOS receives the same first-class treatment as Windows and Linux in source
   layout, automated tests, package workflows, release workflows, and manual
   smoke evidence.
4. Each Windows/Linux native capability must have an explicit macOS disposition:
   a macOS adapter, a migrated native extension/handler, or a verified shared
   Tauri implementation. `None`, a no-op, or an undocumented omission does not
   satisfy parity.
5. Swift/AppKit code and the existing Objective-C Spotlight importer own macOS
   host and extension behavior. They do not own archive semantics or duplicate
   the React workspaces.
6. `zmanager-core` remains the only archive engine. The Tauri host calls it
   directly from Rust. Sandboxed extensions that need core behavior use a narrow
   C ABI built from the exact same pinned core revision.
7. The old macOS product is retired only after replacement, data migration, and
   release acceptance criteria pass.

## Phase 0: change the governing repository policy first

No implementation slice should begin while repository instructions still forbid
the intended architecture.

### `AGENTS.md`

Rewrite the repository guidance so that it:

- identifies Windows, Linux, and macOS as full targets;
- permits and requires Swift/AppKit, Finder Sync, Quick Look, Spotlight,
  Developer ID signing, notarization, and macOS packaging under owned macOS
  modules;
- adds `native/macos/` to the project structure;
- requires native macOS handlers to stay thin and archive-semantic-free;
- requires the Swift host handler and every extension to use generated/shared
  language-neutral manifests rather than duplicate format or action policy;
- requires Swift Testing coverage for migrated Swift modules;
- requires macOS host, extension, signing, and package verification in final
  implementation reports;
- preserves the rule that `zmanager-core` owns archive behavior and safety; and
- preserves the React, shadcn/ui, Tailwind CSS 4, command-router, controller,
  and workspace ownership rules for the shared GUI.

### `CONTEXT.md`

Replace the separate-product language and add these domain terms:

- **macOS Native Host**: the first-party Swift/AppKit module embedded into the
  Tauri application. It owns application lifecycle hooks, Apple events,
  Services, Launch Services operations, native panels when required, system
  icons, AppKit drag sessions, and native activation/window behavior.
- **macOS Extension Suite**: the Finder Sync, Quick Look preview, Quick Look
  thumbnail, and Spotlight modules embedded in the signed application bundle.
- **Native Intent**: a language-neutral request emitted by a host handler or
  extension and consumed through the existing command router/startup seam. It
  never contains passwords or archive semantics.
- **Release Bundle**: the signed and notarized macOS application, nested native
  binaries, extensions, importer, frameworks, and distribution artifacts that
  must be verified as one unit.
- **Replacement Migration**: the one-time migration of identity, settings, and
  supported user data from the old native app to ZManager Desktop.

Update the ownership section so macOS host and extension code is owned here,
and state that the sibling SwiftUI repository becomes read-only migration
evidence after cutover.

### `docs/ARCHITECTURE.md`

Replace the current limited macOS section with the full architecture described
in this plan. Document both native flows:

```text
AppKit/Finder/Services event
  -> macOS Native Host or Finder extension
  -> versioned Native Intent / ShellActionRequest
  -> Rust startup or command seam
  -> shared command router and workspace/controller
  -> zmanager-core job
```

```text
Quick Look / Spotlight request
  -> sandboxed macOS extension
  -> narrow extension-safe zmanager-core C ABI
  -> public, non-secret metadata DTO
  -> native preview, thumbnail, or metadata attributes
```

Document that Tauri retains ownership of the webview and shared window handles;
the macOS Native Host augments the existing application rather than replacing
Tauri's application delegate without proof that doing so is safe.

### Supersede contradictory documents and ADR clauses

Create a new ADR establishing macOS as a full target and explicitly superseding
the macOS exclusions in ADR-0003. Do not silently rewrite historical decisions.
Update or mark superseded the contradictory statements in:

- `docs/PRD.md`
- `docs/REQUIREMENTS.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `docs/IMPLEMENTATION_STEPS.md`
- `docs/developer-setup.md`
- GUI polish/cleanup plans that say Finder, Quick Look, or packaging must remain
  outside this repository

Add an architecture check that rejects new claims that the native Swift app is
a separate long-term product or that macOS release integration is out of scope.

## Target source layout

Use one explicit macOS native root rather than scattering Swift, entitlements,
and bundle metadata through frontend or Rust modules:

```text
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
    ZManagerMacOSHostTests/
    ZManagerMacOSSharedTests/
    ZManagerFinderExtensionTests/
    ZManagerQuickLookTests/

src-tauri/src/platform/
  macos.rs                 Rust NativePlatform adapter and Swift bridge owner

scripts/
  build-macos-native.sh    native targets and extension-safe core FFI
  package-macos.sh         bundle assembly, signing, notarization, stapling
  release-gate-macos.sh    automated package verification
```

Exact build-script names may reuse `scripts/build-macos.sh`, but one script must
own the end-to-end order. Do not leave a Tauri bundler followed by undocumented
manual bundle mutation.

## Native module architecture

### macOS Native Host

Build a deep Swift/AppKit module behind a small Rust-to-Swift interface. Before
porting all behavior, complete a build spike proving that the selected Swift
library form can be linked into the Tauri Rust executable, invoked on the AppKit
main thread, packaged, and signed.

The interface must cover these operations without exposing AppKit objects to
Rust:

- initialize and tear down lifecycle observation;
- register Apple-event, open-document, URL, reopen, and Services handling;
- emit typed Native Intents back to Rust/Tauri;
- configure native window/application behavior;
- resolve batches of system file icons;
- present native panels where the shared Tauri dialog is insufficient;
- open/reveal paths and activate the application;
- query, set, and restore Launch Services default handlers; and
- start and complete native file-promise drag sessions.

The bridge must document:

- main-thread requirements;
- callback ordering and lifetime;
- ownership and freeing of strings/data;
- asynchronous completion and cancellation;
- error DTOs safe to show to users;
- application shutdown behavior; and
- the prohibition on passwords in bridge payloads or diagnostics.

Prefer JSON or small C-compatible DTOs at the seam. Do not expose a broad mirror
of AppKit through FFI. The interface is the integration-test surface.

### Tauri/Rust macOS adapter

`src-tauri/src/platform/macos.rs` remains the only in-process Rust selector for
macOS behavior. It should become an adapter over the macOS Native Host, not a
collection of fallbacks.

Split internally by capability when implementations become substantial, while
keeping one external `NativePlatform` interface. A method may report an
unsupported capability only when the product profile also reports it disabled
and an explicit product decision says it is not applicable.

### Shared manifests and contracts

Generate Swift inputs from the same language-neutral sources used by Rust and
TypeScript:

- archive extensions and split-volume recognition from
  `src/app/archiveFileTypes.manifest.json` or its successor;
- shell action identifiers and multiplicity rules from one action manifest;
- the versioned `ShellActionRequest` schema and shared conformance fixtures;
- UTType declarations and package document-type metadata; and
- user-visible action ordering, with localized labels resolved at the native
  presentation seam.

The existing `ArchiveFileTypes.swift` and Finder action enums are migration
sources. They must not become a fourth hand-maintained policy copy.

## Reference Swift migration map

The reference GUI is a SwiftPM package with 20 first-party Swift sources and one
Objective-C Spotlight importer. It has no Xcode project; its release script
assembles the app, extensions, importer, frameworks, signatures, and disk image
manually. Preserve the working sources and tests, but replace the hand-assembled
dual-product pipeline with one reproducible Tauri Release Bundle pipeline.

| Reference source in sibling `ZManager` | Behavior to preserve | Destination/disposition |
|---|---|---|
| `gui/Sources/ZManagerTracer/ZManagerTracerApp.swift` | open documents, URL callbacks, Services provider, reopen, activation, background-action lifecycle | Extract into `ZManagerMacOSHost`; replace SwiftUI model calls with Native Intents into the shared command/startup seam |
| `gui/Sources/ZManagerFinderExtension/ZManagerFinderSync.swift` | Finder selection/container menus, multi-selection, action ordering | Migrate into `ZManagerFinderExtension`; emit the shared versioned shell-action contract |
| `gui/Sources/ZManagerShared/FinderActionRequest.swift` | validation and callback round trips | Replace URL-encoded path payloads with generated versioned request DTOs and shared fixtures |
| `gui/Sources/ZManagerShared/ArchiveFileTypes.swift` | extension, compound suffix, and split-volume recognition | Generate Swift from the canonical manifest |
| `gui/Sources/ZManagerTracer/DefaultOpenerManager.swift` | Launch Services status, set, restore, previous-handler storage | Migrate behind the macOS Native Host interface and typed frontend preference/controller seam |
| `gui/Sources/ZManagerTracer/DefaultOpenerArchiveTypes.swift` | grouped file-type choices | Generate from the canonical archive-type manifest; keep grouping as display metadata |
| `gui/Sources/ZManagerQuickLookPreview/TzapPreviewProvider.swift` | TZAP preview and thumbnail rendering | Migrate substantially intact, preserving extension-safe DTO parsing and tests |
| `gui/Spotlight/ZManagerSpotlightImporter.m` | TZAP public metadata indexing | Migrate substantially intact; link to the same extension-safe core ABI |
| `gui/Sources/ZManagerTracer/QuickArchiveProgressWindow.swift` | real system icons and background progress-window behavior | Use icon lookup as host-handler evidence; represent progress with existing Disposable Task Windows rather than porting SwiftUI UI |
| native `NSOpenPanel`/`NSSavePanel` call sites | allowed types, file/folder selection, identity/certificate selection | Consolidate behavior into typed macOS panel operations where Tauri dialogs cannot prove parity |
| `scripts/package-macos-app.sh` | document types, URL scheme, Services, embedded extensions/importer, rpaths, signing order, notarization, install registration | Adapt into the Tauri package pipeline rather than copy as an unrelated second packager |
| Swift tests under `gui/Tests/` | observable behavior and regression coverage | Copy first as characterization tests, then update only at changed seams |

Do not migrate `ContentView`, `ArchiveBrowserView`, `ArchiveJobViewModel`, or
other SwiftUI rendering/workflow ownership into the product. Their behavior is
already owned by React workspaces, controllers, the Rust job registry, and
`zmanager-core`. Use them to identify missing acceptance cases.

## Windows/Linux-to-macOS parity ledger

Every row must be closed before macOS is considered complete.

| Existing native capability | Required macOS treatment | Proof |
|---|---|---|
| Platform registration | Initialize macOS Native Host, lifecycle observers, Services, and native intent callback | Swift host tests plus packaged launch smoke |
| Integration profile | Report packaged Finder, Services, association, Quick Look, Spotlight, menu, and drag capabilities truthfully | Rust DTO/contract tests inspect installed profile |
| System file icons | Resolve `NSWorkspace`/UTType icons and return PNG data for files, folders, known and unknown suffixes | Swift unit tests and React rendering test |
| Native filename/path policy | Preserve valid macOS names, Unicode normalization behavior, path limits, and target-volume collision semantics | Rust policy tests on macOS fixtures |
| Native drag dispatch | Replace eager staging with `NSFilePromiseProvider` or an equivalent Finder file-promise implementation backed by core streaming | Host integration test plus Finder drag smoke |
| Native window behavior | Preserve standard decorations; add tabbing policy, reopen, activation, fullscreen/minimize/close, and Disposable Task Window behavior | host tests and manual window matrix |
| Selected-item shell actions | Embed signed Finder Sync extension with all supported actions and atomic multi-selection | extension tests plus Finder smoke |
| Background/container actions | Finder container menu and macOS Services use the same Native Intent contract | service/extension tests |
| File associations | Preserve the old product identity where required, declare UTTypes/document roles, and route cold/warm open events | Info.plist tests plus Finder open smoke |
| Dialogs | Verify Tauri native panels against reference behavior; use host handler for gaps | controller tests and manual panel matrix |
| Open/reveal | Route macOS operations through `NSWorkspace` handler or prove Tauri behavior is equivalent | Swift tests and Finder reveal smoke |
| File drops | Prove the shared Tauri adapter preserves file URLs, multi-selection, and mode decisions on macOS | frontend tests plus host E2E |
| Native application menu | Provide standard macOS application/File/Edit/Window/Help behavior and route product commands through the command router | menu-event contract tests and keyboard smoke |
| Package integration | Embed all nested binaries and metadata in `.app`/`.dmg` | bundle-layout release gate |
| Signing/release | Sign inside-out, notarize, staple, and publish macOS artifacts and checksums | automated release job and Gatekeeper verification |

An explicitly verified shared Tauri implementation may close a row. The reason
and proof must be recorded; “cross-platform” alone is not proof.

## Implementation sequence

### 1. Land policy, ADR, and parity tests

- Complete Phase 0.
- Add the parity ledger as an executable test/manifest so a capability cannot
  silently return to a stub.
- Add characterization tests for the current Rust macOS profile, path policy,
  drag staging behavior, startup behavior, and package layout before changing
  them.
- Add the migrated Swift test suite in its own package without yet wiring it to
  production.

Exit condition: repository instructions uniformly describe the new product
direction, and tests distinguish declared, implemented, packaged, and verified
capabilities.

### 2. Establish the Swift host build and bridge

- Create `native/macos/Package.swift` and the host/shared test targets.
- Prove Rust-to-Swift calls and Swift-to-Rust asynchronous intent callbacks.
- Integrate the native build into `scripts/build-macos.sh` and Cargo/Tauri linking.
- Add main-thread, memory, error, and shutdown contract tests.
- Extend architecture checks so AppKit/Finder/Quick Look imports are confined to
  `native/macos` and the Rust bridge remains confined to the macOS platform module.

Exit condition: an ad-hoc signed Tauri `.app` starts the Swift host, emits a test
intent, and shuts down without leaks, duplicate handlers, or delegate conflicts.

### 3. Migrate host lifecycle and native application behavior

- Adapt open-document Apple events and URL callbacks from
  `ZManagerApplicationDelegate` without replacing Tauri's delegate blindly.
- Route cold and warm file opens through the startup controller and Archive
  Workspace.
- Implement Dock reopen, activation, app termination cleanup, Services provider,
  and native Main/Disposable Task Window behavior.
- Add the standard macOS menu bar and route its actions through the existing
  command router. Do not create a second command switch in Swift.
- Migrate default-opener management and typed preference integration.
- Add a one-time migration reader for compatible old native-app preferences.

Exit condition: launch, open, reopen, Services, menu, window, and default-opener
flows pass automated tests and macOS smoke checks with one ownership path each.

### 4. Complete native icons, panels, opener, drops, and drag-out

- Replace the icon stub with batched `NSWorkspace`/UTType lookup and PNG output.
- Audit every reference `NSOpenPanel`/`NSSavePanel` behavior against the shared
  dialog adapter; add native handler operations only for observable gaps.
- Migrate `NSWorkspace` open/reveal behavior where the Tauri opener does not meet
  the reference contract.
- Run macOS file-drop E2E coverage for files, folders, archives, multi-selection,
  invalid paths, and drag cancellation.
- Replace eager ten-minute drag staging with native file promises backed by
  `zmanager-core` stream callbacks. Preserve folder expansion, cancellation,
  filename policy, errors, and cleanup.

The reference SwiftUI project has input drops but no archive-entry output drag
or file-promise implementation. Native file-promise drag is therefore new macOS
work, not a source migration.

Exit condition: no macOS icon fallback stub remains and Finder drag-out does not
materialize all selected contents before the destination requests them.

### 5. Migrate Finder and Services integration

- Copy Finder menu builder tests before adapting the implementation.
- Migrate Finder Sync source, Info.plist, and entitlements.
- Generate action identifiers, format choices, validation, and labels from the
  canonical manifests.
- Use one atomic versioned request for one Finder selection.
- Prefer an App Group request directory plus an opaque callback token so raw
  selected paths are not placed in custom URLs. Securely create, consume, and
  remove request files.
- Route extension and Services requests through the same startup/command seam as
  Windows and Linux shell actions.
- Support concurrent quick actions using existing Disposable Task Windows and
  job ownership rather than porting SwiftUI progress windows.

Exit condition: Finder item and container actions work for single and multiple
selections, start exactly one intended request per action, and never perform
archive work inside the extension.

### 6. Migrate Quick Look, thumbnail, and Spotlight modules

- Build an extension-safe `zmanager-ffi` artifact from the same pinned source and
  revision as the host's `zmanager-core`.
- Migrate Quick Look preview and thumbnail providers with their Swift tests.
- Migrate the Objective-C Spotlight importer, schema, strings, and tests/fixtures.
- Limit extension output to public, non-secret metadata. Passwords, private keys,
  and mutable host state must remain inaccessible.
- Verify sandbox entitlements, rpaths, extension registration, crash isolation,
  malformed archive behavior, and multi-volume TZAP behavior.

Exit condition: Finder Quick Look, thumbnails, and Spotlight metadata work from
the installed signed app and fail safely on hostile or malformed inputs.

### 7. Unify macOS packaging, identity, signing, and notarization

- Add a macOS-specific Tauri configuration where necessary.
- Preserve the existing native product identity
  `com.frankmanzhu.zmanager` for the replacement macOS app unless a separately
  documented migration proves a new identifier is safe. Do not ship both the
  old and `.desktop` identifiers as competing macOS products.
- Preserve extension identifiers, URL scheme, UTType ownership, and Launch
  Services ranks deliberately.
- Generate the final Info.plist from canonical file/action manifests.
- Embed the Finder extension, Quick Look extensions, Spotlight importer, Swift
  host/native libraries, and extension-safe core FFI.
- Normalize install names and rpaths before signing.
- Sign nested libraries, importers, and extensions first, then the app; verify
  entitlements and designated requirements.
- Build `.zip` and `.dmg`, notarize, staple, and run Gatekeeper assessment.
- Register and unregister local development bundles and extensions predictably
  so smoke tests do not use stale copies.

Exit condition: the release gate rejects a missing/unsigned nested artifact and
accepts a clean signed, notarized, stapled application installed on a clean test
account.

### 8. Add macOS CI and release artifacts

- Add macOS package jobs to `.github/workflows/package.yml` for supported Intel
  and Apple Silicon targets.
- Add macOS release jobs and make publication depend on them.
- Build and test Swift, Rust, frontend, extension fixtures, bundle layout, code
  signatures, and notarization inputs.
- Publish architecture-labelled macOS artifacts or a proven universal artifact,
  plus checksums, alongside Windows and Linux.
- Store signing and notarization credentials only in the CI secret store.

Exit condition: macOS is a required package and release job, not an optional
local script.

### 9. Replacement migration and old-project retirement

- Inventory old bundle identifiers, UserDefaults keys, App Support data,
  identities/trust data, default-opener restore state, preview roots, and URL
  scheme ownership.
- Migrate only compatible non-secret settings automatically. Use core-owned
  paths for identities/trust data and never copy secrets through frontend
  storage or diagnostics.
- Test upgrade from the last released native SwiftUI app to the new Tauri app.
- Verify old Finder/Quick Look/Spotlight registrations are replaced rather than
  duplicated.
- Freeze the old GUI repository, record the replacement version, and remove old
  build/release ownership only after production acceptance.

Exit condition: existing users upgrade without two competing ZManager apps,
lost supported settings, duplicate extensions, or broken file associations.

## Verification strategy

### Automated tests

Run at minimum:

```sh
npm run test:frontend
npm run test:architecture
npm run build
(cd src-tauri && cargo test)
cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml
swift test --package-path native/macos
scripts/build-macos.sh --no-install
scripts/release-gate-macos.sh
```

Add contract fixtures consumed by Rust, TypeScript, and Swift for:

- archive file type recognition;
- Finder action visibility and ordering;
- versioned shell-action encoding/decoding;
- cold/warm open-document intents;
- default-opener result mapping;
- system icon request/result mapping;
- native drag file-promise success, cancellation, and error outcomes; and
- Quick Look/Spotlight public metadata.

### Package verification

The release gate must inspect:

- app, extension, importer, and library presence;
- architectures of every nested executable;
- Info.plist identifiers, document types, UTTypes, URL schemes, Services, and
  extension points;
- entitlements and sandbox rules;
- dylib install names and rpaths;
- inside-out code signatures;
- notarization and stapling state; and
- absence of unexpected unsigned executables.

### Manual macOS smoke matrix

Record macOS version, architecture, filesystem case mode, and installed build:

1. Cold launch, warm launch, Dock reopen, close, quit, minimize, fullscreen, and
   multiple Disposable Task Windows.
2. Open every supported archive family through Finder association, including
   while the application is already running.
3. Use Finder item and container menus with one item, multiple files, multiple
   archives, folders, unsupported files, and mixed selections.
4. Invoke macOS Services for compression and extraction.
5. Verify native open/save panels, file type filters, cancellation, and folder
   selection.
6. Verify real file/folder icons for known, unknown, compound, and split suffixes.
7. Drag files and folders from an archive to Finder; exercise success, cancel,
   name collision, Unicode, case collision, long names, and destination failure.
8. Verify Quick Look preview, thumbnail, and Spotlight metadata for signed,
   unsigned, encrypted, multi-volume, malformed, and hostile TZAP fixtures.
9. Set and restore default openers and confirm previous handlers are preserved.
10. Install the signed/notarized DMG on a clean account and verify Gatekeeper,
    extension enablement, file associations, upgrade migration, and uninstall.

## Architecture guardrails

- No SwiftUI product screen or ViewModel may become a parallel workflow owner.
- No Swift handler or extension may plan, list, create, extract, or validate
  archive safety independently of `zmanager-core`.
- No action identifiers, archive suffix lists, UTTypes, or multiplicity rules may
  be hand-maintained independently in Rust, TypeScript, Swift, and packaging.
- No frontend operating-system detection; behavior continues to derive from
  explicit capabilities.
- No platform capability may be marked enabled solely because an interface
  method exists.
- No AppKit object crosses the Rust/Swift interface.
- No native callback bypasses the command router or startup controller to mutate
  workflow state directly.
- No passwords, private keys, or secret-bearing DTOs enter UserDefaults, App
  Group request files, URLs, logs, diagnostics, or extension payloads.
- No second macOS packager may survive after the unified release pipeline works.
- No migration is complete until the old ownership path is deleted or formally
  frozen with a retirement record.

## Principal risks and required spikes

1. **Tauri application-delegate ownership**: prove lifecycle observation and
   Apple-event interception without destabilizing Wry/Tauri.
2. **Rust/Swift linking**: choose static versus dynamic host linkage based on a
   signed packaged spike, not development-only execution.
3. **Sandbox handoff**: prove Finder extension to host communication with App
   Group entitlements and atomic request deletion.
4. **Core revision drift**: enforce one pinned source revision for the host Rust
   dependency and extension-safe FFI.
5. **File promises**: prove asynchronous core streaming, cancellation, folder
   structure, and session lifetime under Finder before deleting staged drag.
6. **Bundle identity**: test replacement of `com.frankmanzhu.zmanager` and its
   extension registrations before changing production identifiers.
7. **Nested signing/rpaths**: validate installed artifacts, not merely build-tree
   binaries.
8. **System caches**: isolate Launch Services, Finder, Quick Look, and Spotlight
   cache effects so smoke tests cannot pass against an older installed build.

## Definition of done

macOS is a full target only when:

- governing documentation names it as a first-class product and release target;
- every Windows/Linux native capability has a closed macOS parity-ledger row;
- `MacOsPlatform` contains no misleading no-op or unconditional fallback for an
  enabled capability;
- the macOS Native Host handles lifecycle, open/reopen, Services, menus, icons,
  panels/opener gaps, Launch Services, and native file-promise drag;
- Finder Sync, Quick Look preview, Quick Look thumbnail, and Spotlight modules
  are built from this repository and embedded in the app;
- all host and extension archive behavior uses the same pinned `zmanager-core`;
- the package is signed, notarized, stapled, architecture-verified, and released
  by required CI jobs;
- replacement migration passes from the last native SwiftUI release;
- the old SwiftUI GUI repository no longer owns active product behavior or
  release packaging; and
- automated tests and recorded manual smoke evidence cover the installed macOS
  Release Bundle.
