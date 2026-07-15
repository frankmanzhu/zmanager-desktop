# ZManager Desktop context

ZManager Desktop is the cross-platform Tauri archive manager built on
`zmanager-core`. Windows and Linux are the packaged product targets; macOS is a
supported Desktop Shell runtime target while the separately maintained native
SwiftUI app continues to own Finder extensions, Quick Look, signing, and macOS
packaging. This repository owns the shared shell and application-facing
integration. Archive semantics and extraction safety remain core-owned.

## Domain glossary

### Desktop Shell

The complete cross-platform Tauri application: React user interface, application
state machines, Tauri command integration, native window behavior, platform
integration, and packaging.

### Main Window

The singleton, persistent application window opened by launching the app or by
an explicit **Add to archive** shell action. It hosts the normal Compress and
Extract workspaces and remains available after individual jobs finish.

### Disposable Task Window

A short-lived window dedicated to one quick action, such as **Compress to ZIP**
or **Extract here**. Multiple task windows may coexist. A task window may close
after its job completes according to the applicable completion policy; it does
not replace or duplicate the Main Window.

### Quick Action

A shell or startup request that begins a specific operation with its inputs and
destination already implied. Quick actions normally use a Disposable Task
Window. The general **Add to archive** action targets the singleton Main Window.

### Shell Action Request

The atomic, versioned request produced from one operating-system shell
selection. It contains a language-neutral action and every selected local path.
Windows builds it from `IShellItemArray`; Linux integrations may build the same
contract from their native multi-selection mechanism. Shell integrations never
perform archive operations themselves.

### Compress Workspace / Create Workspace

**Compress** is the user-facing mode for choosing sources, reviewing the
authoritative archive plan, configuring creation options, and starting an
archive job. Internal architecture may call its state module the **Create
Workspace**. These names describe the same workflow at different boundaries.

### Extract Workspace / Archive Workspace

The user-facing mode for opening an archive, navigating its entries, choosing
an extraction destination and options, previewing entries, and starting extract
or test jobs. Internal architecture may use **Archive Workspace** for the
listing, navigation, selection, and extraction state owned by this workflow.

### Archive Plan

The authoritative, core-produced representation of the sources and entries
that will be archived after ignore and clean-source rules are applied. The GUI
may display and select the plan but must not independently reproduce archive
planning semantics. During replanning, keep the current tree visible, show a
subtle refreshing state, and atomically replace it when the new plan arrives.

### Job

A long-running create, extract, preview, or test operation registered by the
Rust job layer. Jobs expose normalized progress and terminal events and support
cancellation where the core operation permits it.

TZAP create jobs also expose phase-native progress for planning payload,
planning metadata, emitting payload, emitting metadata, and committing output.
Repeated source-byte totals belong to different phases and must not be merged
as unique file bytes; only a terminal completed event represents 100%.

### Preview

A temporary extraction of one archive entry for viewing. The desktop layer
owns launching the associated application and tracking temporary preview paths;
the core owns safe extraction.

### Global Defaults

Persisted, non-secret preferences used to prepopulate archive-creation and
extraction options. Passwords and archive-specific secrets are never global
defaults. A workflow may override a default without mutating the stored value.

### Native Platform

The operating-system adapter that supplies the complete native capability set
required by the Desktop Shell. Every supported platform implements the shared
Rust `NativePlatform` interface; callers use platform-neutral wrapper functions
and never select or invoke operating-system-specific implementations directly.

## Ownership boundaries

### `src/app`

Owns deterministic workflow state, state transitions, command readiness, pure
derivations, and interfaces for injected effects. It may depend on DTO types but
does not invoke Tauri directly.

### `src/ui`

Owns React rendering and DOM event decoding. UI components render immutable
snapshots and emit typed intents; they do not duplicate workflow decisions or
archive behavior.

### `src/api`

Owns serializable application command DTOs and Tauri invoke wrappers.

### `src/desktop`

Owns concrete adapters for native dialogs, paths, windows, file-manager actions,
Tauri events, file drops, drag-out, clipboard, timers, and preview cleanup.

### `src-tauri`

Owns app-facing Rust commands, validation at the desktop boundary, DTO mapping,
the job registry, and Windows/Linux/macOS platform modules. It delegates archive
semantics to `zmanager-core`.

### `zmanager-core`

Owns archive planning, listing, creation, extraction, testing, format routing,
normalization, collision and overwrite handling, link safety, and archive-bomb
guards. Do not reimplement these behaviors in TypeScript.

## Architectural invariants

- `src/main.ts` is a composition root, not a home for durable workflow state or
  command switches.
- Workspaces are deterministic state machines where practical. Controllers
  coordinate asynchronous effects through injected interfaces.
- Toolbar, menu, shortcut, context-menu, tree, details-pane, and row actions
  route through shared typed command seams rather than separate behavior.
- Workflow snapshots are immutable, render-ready plain data. They never contain
  passwords, DOM nodes, mutable collections, or pending Tauri promises.
- Passwords are never logged, persisted, placed in diagnostics, or passed via
  command-line arguments.
- Stable workflow and DTO values remain language-neutral. Localization and
  formatting occur at display boundaries.
- Storage-backed preferences and path histories use typed normalization modules;
  do not add ad hoc `localStorage` ownership.
- Platform behavior stays behind desktop adapters, Rust platform modules, or
  packaging code. The supported Tauri runtimes remain one product surface. Every supported Rust
  platform must provide a complete `NativePlatform` adapter; unsupported targets
  must fail compilation instead of inheriting another operating system's code.
- Rust and TypeScript command contracts require generated bindings or explicit
  contract coverage when changed.
- A regression fix requires failing-before/passing-after coverage when feasible.
  Architecture moves require characterization coverage and deletion of the old
  ownership path.

## Primary documentation

- `AGENTS.md`: repository working rules and maintainability constraints
- `docs/ARCHITECTURE.md`: high-level runtime layering and command boundary
- `docs/REQUIREMENTS.md`: functional, platform, security, and acceptance requirements
- `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`: target frontend module ownership
- `docs/windows-context-menu-behavior.md`: Windows shell action contract
- `docs/adr/`: durable architectural decisions
