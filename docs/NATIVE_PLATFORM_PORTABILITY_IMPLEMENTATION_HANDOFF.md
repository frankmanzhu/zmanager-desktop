# Native Platform Portability Implementation Handoff

> Status: Superseded by `MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md` and
> ADR-0004 through ADR-0009. Retained as portability history.

- Status: Ready for implementation
- Date: 2026-07-15
- Primary environment: Linux
- Repository: `frankmanzhu/zmanager-desktop`

## Outcome

Make the native platform seam truthful and useful for adding another supported
desktop operating system. After this work:

- in-process operating-system selection and native behavior route through the
  Rust `NativePlatform` interface;
- shared command code contains only platform-neutral archive and request logic;
- the frontend consumes explicit native capabilities instead of detecting an
  operating system from browser metadata;
- external shell integrations use the shared shell-action contract where their
  host mechanism permits it; and
- architecture checks prevent platform behavior from leaking back into shared
  modules.

This is a portability and maintainability change. It must preserve current
Windows behavior while correcting Linux drag-out behavior that is currently
constrained by Windows filename rules.

## Authoritative context

Read these before changing code:

- [`CONTEXT.md`](../CONTEXT.md), especially **Native Platform** and the
  architectural invariants.
- [`docs/adr/0001-native-platform-contract.md`](adr/0001-native-platform-contract.md).
- [`docs/adr/0002-versioned-shell-action-contract.md`](adr/0002-versioned-shell-action-contract.md).
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
- [`AGENTS.md`](../AGENTS.md), especially the frontend technology,
  maintainability, testing, and platform rules.

Do not re-litigate the accepted ADRs during implementation. Deepen their seams
so the implementation actually matches them.

## Current state

The Rust contract in [`src-tauri/src/platform/mod.rs`](../src-tauri/src/platform/mod.rs)
is compiler-enforced for four declared capabilities:

1. Tauri platform service registration.
2. Platform integration metadata.
3. System file icons.
4. Native archive-entry drag-out.

`WindowsPlatform` and `LinuxPlatform` implement that interface, unsupported
targets fail compilation, and callers use platform-neutral wrapper functions.
That part is sound.

The broader claim that all native behavior uses the seam is currently false:

- Linux window decoration is selected directly in
  [`src-tauri/src/main.rs`](../src-tauri/src/main.rs).
- The frontend detects Linux using `navigator.userAgent` in
  [`src/runtime/browserDocumentAdapter.ts`](../src/runtime/browserDocumentAdapter.ts).
- Shared command code in [`src-tauri/src/commands.rs`](../src-tauri/src/commands.rs)
  applies Windows drag-out filename, separator, path-length, and collision rules
  before calling the active adapter.
- Windows and Linux shell/installer integrations are necessarily external to the
  in-process Rust trait. Windows selected-item integration uses the versioned
  contract; Linux integrations still primarily use legacy quick-action
  arguments.
- Platform-specific packaging, Cargo dependencies, and CI jobs remain explicit
  platform configuration. They cannot and should not be hidden behind a runtime
  Rust interface.

## Required interpretation of the platform rule

Use this rule during implementation:

> All in-process operating-system selection, native policy, and direct native
> calls must live behind `src-tauri::platform`. Platform-neutral Tauri features
> remain behind TypeScript adapters in `src/desktop`. External shell extensions,
> installers, and package metadata are platform adapters at the serialized
> shell-action or packaging seams.

The following are documented exceptions, not violations:

- the crate-level Windows subsystem attribute in `src-tauri/src/main.rs`;
- target-specific dependency declarations in `src-tauri/Cargo.toml`;
- `native/`, `packaging/`, and platform build scripts;
- explicit platform entries in Tauri bundle configuration, permissions, and CI;
- platform-neutral use of Tauri APIs through modules under `src/desktop` and
  command wrappers under `src/api`.

Do not move packaging or a COM shell extension into `NativePlatform` merely to
make the rule appear uniform.

## Scope and non-goals

### In scope

- Native drag-out path preparation and collision policy.
- Linux and Windows adapter ownership of their own filename semantics.
- Main-window native configuration.
- Explicit frontend window-chrome capabilities.
- Removal of frontend operating-system detection.
- Architecture guardrails for the native platform seam.
- Linux shell-action contract convergence where feasible without a new daemon or
  privileged installer architecture.
- Tests proving Linux behavior and preserving Windows policy.

### Non-goals

- Reimplementing archive planning, extraction, creation, or safety in TypeScript.
- Moving archive semantic decisions out of `zmanager-core`.
- Replacing Tauri's cross-platform dialog, opener, window, event, or file-drop
  interfaces.
- Redesigning all packaging formats in the same change.
- Adding macOS SwiftUI, Finder Sync, Quick Look, `.app` packaging, signing, or
  notarization code.
- Broad frontend restyling.

## Implementation sequence

Implement in small, reviewable slices. Add characterization or regression
coverage before or in the same change as each behavior move. Delete the old
ownership path as soon as the new seam is proven.

### 1. Add regression coverage and architecture checks

Before moving logic, add tests for the public native drag seam or the closest
stable platform interface.

Required Linux cases:

- `Foo.txt` and `foo.txt` may coexist in one drag operation.
- Linux-valid characters rejected by Windows, such as `?`, are accepted by the
  Linux path policy.
- nested paths remain nested after `strip_components` is applied.
- empty paths after stripping, `.` and `..` components, and NUL bytes are
  rejected.
- duplicate paths according to Linux path semantics are rejected before files
  are staged.
- staged temporary content is cleaned after failure or a non-drop outcome.

Required Windows characterization cases:

- comparison remains case-insensitive;
- reserved names such as `CON` remain rejected;
- trailing space/dot and Windows-invalid characters remain rejected;
- the `FILEDESCRIPTORW` UTF-16 path-length limit remains enforced; and
- virtual descriptor paths retain Windows separators.

Keep pure Windows path-policy code free of Win32 imports so it can be compiled
and tested on Linux. A private module under `src-tauri/src/platform/` is an
appropriate internal seam. Do not expose a second public platform interface
solely for tests.

Extend `npm run test:architecture` with a source check that:

- rejects production `target_os`/`cfg(windows)` selection outside
  `src-tauri/src/platform/`, except the documented crate-level Windows subsystem
  attribute;
- rejects direct Win32, GTK/GDK/GIO, or other OS-native imports outside approved
  platform modules and external `native/` or `packaging/` adapters; and
- rejects frontend operating-system detection through `navigator.userAgent` or
  `navigator.platform`.

Prefer an `ast-grep` rule where syntax-aware matching helps. A small explicit
script is acceptable for Rust source scanning because the current ast-grep
configuration only covers TypeScript.

### 2. Move native drag policy into the adapters

The current shared flow selects archive entries correctly, but then creates a
Windows-shaped `display_path`, lowercases collision keys, and applies Windows
filename rules in `commands.rs`. Remove those platform decisions from shared
command code.

Keep these responsibilities shared:

- request validation;
- archive listing through `zmanager-core`;
- expansion of a selected archive folder to its regular-file descendants;
- archive-entry identity and selection deduplication;
- `strip_components` as a language-neutral operation over archive path
  components;
- preflight and streaming through `zmanager-core`; and
- command error DTO mapping.

Move these responsibilities behind `NativePlatform`:

- output path representation and separators;
- platform filename validity;
- collision comparison semantics;
- native descriptor/path length limits; and
- any staging rules required by the target file manager or native drag protocol.

Recommended data shape: replace the Windows-shaped `display_path: String` passed
through the common seam with platform-neutral relative path components. The
shared layer may split archive paths and reject universally unsafe traversal,
but each adapter should render and validate those components for its own native
protocol.

The Linux adapter should use case-sensitive `PathBuf` semantics. The Windows
adapter should produce the same `FILEDESCRIPTORW` paths and validation behavior
it does today. Do not weaken extraction safety: drag-out streaming must continue
to use the core-owned streaming/extraction path rather than writing archive
contents through new TypeScript or ad hoc parsing logic.

When this slice is complete, `src-tauri/src/commands.rs` must contain no
`WINDOWS_*` drag constants, Windows-reserved filename list, Windows-only error
messages, or lowercase collision policy for native drag paths.

### 3. Move main-window native configuration behind `NativePlatform`

Add a platform capability for configuring the Main Window, then make
`src-tauri/src/main.rs` call only the platform-neutral wrapper during Tauri
setup.

The Linux adapter must continue to disable native decorations. The Windows
adapter must preserve native decorations. Avoid swallowing unexpected errors
without a documented reason; decide whether failure is fatal or best-effort and
cover that decision through the interface.

After this change, `main.rs` should not contain a Linux `target_os` branch. The
crate-level Windows subsystem attribute remains an explicit exception because it
is compile-time crate configuration, not a runtime native operation.

### 4. Expose capability-neutral window chrome metadata

Extend the platform profile/command DTO with capability-oriented values rather
than asking the frontend to infer behavior from the platform name. The
capabilities need to answer at least:

- whether the application draws its own window chrome; and
- whether manual resize handles should dispatch native resize dragging.

Keep the platform name only for diagnostics/display. Do not use it as a command
switch in the frontend.

Feed these capabilities through the existing project-contract/startup seam into
the browser document and React runtime adapters. Remove `navigator.userAgent`
Linux detection and rename behavior-oriented methods such as
`usesLinuxWindowChrome` to capability-oriented language.

If this change touches legacy raw CSS for Linux chrome, migrate the affected UI
surface toward React and Tailwind CSS 4 as required by `AGENTS.md`. Do not add
new raw CSS rules or expand the legacy class-based styling system. Keep this
migration limited to the chrome/resize surface.

### 5. Make integration metadata future-neutral

`PlatformProfile` currently exposes Windows/Linux-shaped flags such as
`explorer_integration_enabled` and `desktop_actions_enabled`. Replace or augment
these with capability-oriented shell integration metadata, for example whether
the installed platform supports selected-item actions, background actions, and
file associations.

Update Rust DTO mapping, TypeScript types, diagnostics, and contract tests
together. Preserve language-neutral action identifiers. Do not localize or build
command requests from shell labels.

This slice should make a future adapter able to describe its capabilities
without pretending to be Explorer or a freedesktop desktop action.

### 6. Converge Linux shell actions on the versioned contract

Treat this as a separate slice after the in-process seam is fixed.

For the Nautilus Python extension, write one version-1 shell-action JSON request
for the complete native selection, create the request file securely, and launch
the desktop once with `--shell-action-request`. The desktop already consumes and
removes this file. Preserve selected path order and never include passwords.

KDE service-menu and `.desktop` `Exec` entries cannot conveniently create a JSON
request file themselves. Keep the legacy atomic `%F` launch as a documented
compatibility adapter unless a small, well-tested shell-handoff executable is
introduced. Do not add shell quoting pipelines or temporary-file logic directly
to desktop entries.

Do not remove legacy quick-action parsing until every shipped integration has a
safe replacement and its compatibility window is explicitly approved.

### 7. Reduce duplicated integration manifests

As a follow-up, make action identifiers, labels, supported archive associations,
and multiplicity constraints derive from one language-neutral manifest where
practical. Generated Windows registry/COM metadata and Linux desktop/Nautilus/KDE
artifacts may remain platform-specific implementations.

The deletion test applies: generation should remove duplicated ownership, not
add another manifest beside unchanged hand-maintained copies.

## Acceptance criteria

The work is complete only when all of the following are true:

- Every in-process production `target_os` selection is inside
  `src-tauri/src/platform`, except the documented crate attribute.
- Direct Win32 and GTK/GDK/GIO calls remain local to their platform adapters.
- `main.rs` configures the Main Window through a platform-neutral wrapper.
- Shared native drag command code contains no Windows filename/path policy.
- Linux native drag accepts case-distinct paths and Linux-valid names that
  Windows rejects.
- Windows native drag retains its current case-insensitive and filename safety
  behavior.
- The frontend contains no user-agent or navigator-platform OS detection.
- Frontend window chrome and resize behavior derive from explicit native
  capabilities.
- Platform integration metadata no longer requires future systems to masquerade
  as Windows Explorer or Linux desktop actions.
- Unsupported targets still fail compilation until they provide a complete
  adapter and explicit `ActivePlatform` selection.
- Platform-specific shell and packaging code remains outside the runtime seam
  and is covered by its own contract/packaging tests.
- No passwords are logged, persisted, added to diagnostics, or passed through
  command-line arguments.
- No parallel legacy ownership path remains hidden behind a wrapper.

## Automated verification on Linux

Run from the repository root:

```bash
npm install
npm run test:frontend
npm run test:architecture
npm run build
(cd src-tauri && cargo test)
cargo test --manifest-path crates/zmanager-shell-contract/Cargo.toml
scripts/test-linux-packaging-scripts.sh
```

Run the focused Playwright native-drag coverage if its desktop prerequisites are
available:

```bash
npm run test:e2e -- e2e/native-drag.spec.ts
```

Tests for moved behavior should exercise the public module interface or native
command seam. Do not prove the change only through helpers extracted for tests.

## Manual Linux smoke checks

Automated tests remain the primary proof. Also record manual results for native
window-manager and file-manager interactions that cannot be fully represented in
unit tests:

1. Launch the Tauri application and confirm the Linux Main Window is undecorated.
2. Verify minimize, maximize/restore, close, title-bar drag, and every resize edge
   and corner.
3. Drag archive entries containing `Foo.txt`, `foo.txt`, `question?.txt`, and a
   nested directory into a Linux file manager.
4. Confirm both case-distinct files arrive with their exact names and nested
   structure.
5. Exercise successful drop, cancellation/no-drop, and failure; confirm temporary
   staging cleanup follows the documented lifecycle.
6. Exercise Nautilus and KDE multi-selection actions and confirm one selection
   produces one application request/job as appropriate.

State the desktop environment, display protocol (X11 or Wayland), file manager,
and distribution used for the smoke check.

## Required Windows verification

Linux tests do not compile or execute the Windows adapter. Because the drag data
shape and `NativePlatform` interface affect Windows, do not present the change as
complete until Windows CI compiles the adapter and its tests pass.

Run or obtain a passing result for:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-static.ps1
```

At minimum, the package workflow for Windows x64 and ARM64 must pass. Manually
smoke native drag-out and Main Window decorations on Windows when the adapter or
window setup changes. Record any verification gap explicitly in the PR.

## Suggested implementation commits

Keep commits focused and imperative. A reasonable sequence is:

1. `Add native platform architecture checks`
2. `Move drag path policy into platform adapters`
3. `Route native window setup through platform adapter`
4. `Use explicit window chrome capabilities`
5. `Generalize platform integration metadata`
6. `Use versioned Linux shell action requests`

Do not create a feature branch without explicit user permission. If a bug fix is
split from the architecture work, ensure the Linux drag regression test lands
with the fix.

## Suggested skills for the implementor

- `tdd` for the drag regression and red-green-refactor sequence.
- `diagnose` if Linux native drag behavior differs between X11, Wayland, GTK, or
  file managers.
- `parallels-windows-testing` for Windows validation when running from the
  configured macOS/Parallels environment.
- `github:yeet` only when explicitly asked to commit, push, and open a draft PR.

## Handoff warning

The current local macOS environment cannot compile the desktop crate by design:
unsupported targets hit the `NativePlatform` compile error. The shared
`zmanager-shell-contract` tests passed during the audit, but targeted frontend
tests could not run because `node_modules` was not installed. Re-run the full
verification set above in the Linux implementation environment.
