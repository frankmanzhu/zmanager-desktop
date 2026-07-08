# Repository Guidelines

## Project Structure & Module Organization

ZManager Desktop is the Windows/Linux Tauri shell for the Rust archive engine. Keep it separate from the macOS SwiftUI app; do not reimplement archive behavior in TypeScript.

- `src/`: Vite/TypeScript frontend. `src/app` owns workflow state, pure behavior, and effect interfaces; `src/api` owns command DTOs and invoke wrappers; `src/ui` owns rendering and DOM event adapters; `src/desktop` owns concrete runtime/path/window/native integration.
- `src/app/shell/`: target home for app-wide shell state such as active workspace mode, status, drop decisions, quick-action startup state, preview cleanup metadata, and path-history snapshots.
- `src/app/workspaces/`: target home for deep workflow modules such as Archive Workspace, Create Workspace, and Jobs Workspace.
- `src/app/commands/`: target home for command routing that unifies toolbar, menu, shortcut, context-menu, details-pane, tree, and row-action execution.
- `src/app/controllers/`: target home for async orchestration that uses injected API, desktop, dialog, storage, timer, clipboard, and window adapters. Controllers must not import Tauri directly.
- `src/app/display/`: target home for display context such as resolved locale, translator, and formatting state. Workflow state and command DTOs stay language-neutral.
- `src/app/pathHistory.ts`: target module for recent archive and destination history normalization before persistence.
- `src-tauri/`: Rust Tauri commands, job registry, DTO mapping, and platform modules. Keep OS code in `platform/windows.rs` and `platform/linux.rs`.
- `e2e/`: Playwright end-to-end and visual tests.
- `scripts/`, `packaging/`, `docs/`: release tooling, installer assets, architecture notes, and audits.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: run the Vite frontend at `127.0.0.1`.
- `npm run build`: generate archive type metadata, type-check, and build the frontend.
- `npm run test:frontend`: run Vitest tests.
- `npm run test:e2e`: run Playwright tests.
- `npm run tauri dev`: run the desktop shell.
- `cd src-tauri && cargo check`: check the Rust command layer.
- `cd src-tauri && cargo test`: run Rust tests.
- `scripts/build-linux-ubuntu-deb.sh`: build Ubuntu/Debian `.deb`.
- `scripts/build-linux-fedora-rpm.sh`: build Fedora `.rpm`.
- `powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1`: run the Windows ARM64 release gate.

Use package scripts instead of direct `tsc`, `vite`, or Tauri CLI calls unless debugging requires it.

## Coding Style & Naming Conventions

Use explicit TypeScript module names such as `extractFlow.ts` and `archiveTable.ts`, with matching `*.test.ts` files. Prefer named constants and shared helpers over hard-coded text, limits, paths, or command names.

Rust code should keep app-facing mapping in Tauri commands and leave archive behavior in `zmanager-core`. Do not add macOS SwiftUI, Finder Sync, Quick Look, signing, notarization, or `.app` packaging code.

## Frontend Architecture Goals

Treat `src/main.ts` as the composition root, not the application architecture. It may query stable DOM roots, instantiate adapters/controllers/workspaces, bind top-level startup, and connect render functions to snapshots. Do not add new durable workflow state, table row derivation, command execution switches, selection/focus logic, job lifecycle state, password retry state, preview cleanup state, drop decision state, path-history normalization, preference patching, locale/display refresh, or desktop request construction to `main.ts`.

Prefer deep modules with small interfaces over shallow helper extraction. The current architecture target is documented in `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`: Shell Workspace, Archive Workspace, Create Workspace, Jobs Workspace, Command Router, shared Hierarchical Table, controllers, display context, path histories, and desktop adapters.

Keep ownership clear:

- `src/app`: workflow state, state transitions, request readiness, pure derivations, and interfaces for injected effects. App modules may depend on DTO types but should not call Tauri directly.
- `src/ui`: HTML rendering and DOM event decoding. UI modules emit typed intents and render snapshots; they should not duplicate workflow decisions.
- `src/api`: serializable DTOs and Tauri invoke wrappers only.
- `src/desktop`: concrete runtime adapters for native dialogs, file manager actions, Tauri events, window control, native drag-out, file drop, preview cleanup, clipboard, timers, and platform path helpers.

Workspaces should be mostly deterministic state machines. Controllers coordinate async effects with injected adapters, then feed success/failure intents back into workspaces. Snapshots passed to `src/ui` should be immutable, render-ready plain data and must not contain passwords, mutable `Set`/`Map` instances, DOM nodes, or Tauri promises.

For table-like folder panes, reuse or deepen the planned `hierarchicalTable` module. Do not add new archive/create row builders, selection globals, focus globals, or table-specific event listeners in `main.ts`.

For commands, route new toolbar, menu, shortcut, context-menu, details-pane, and row-action behavior through a command router rather than wiring each surface separately.

For preferences, localization, and formatting, keep stable workflow values language-neutral. Use the display context at render seams; do not sort, filter, persist, or build command DTOs from localized labels.

For path histories and storage-backed UI state, use typed storage and normalization modules. Do not add ad hoc `localStorage` keys or history arrays in `main.ts`.

## Testing Guidelines

Test command seam behavior first: validation, password-required flows, listing mapping, create/extract lifecycle, cancellation, normalized errors, and platform path edge cases. Frontend tests should cover state transitions and user-visible behavior. Use Vitest for `src/**/*.test.ts` and Playwright for `e2e/*.spec.ts`.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, for example `Fix context menu`. Keep commits focused. Pull requests should include a description, test commands run, linked issue or requirement, and screenshots for UI changes.

## Security & Architecture Rules

Passwords must never be logged, persisted in frontend storage, passed through command-line arguments, or included in diagnostics. Extraction safety must remain core-owned; do not bypass path normalization, collision handling, overwrite policy, symlink/hardlink checks, or zip-bomb guards. Keep command contracts small: plan, list, extract, create, test, cancel, and poll events.

Do not reimplement archive planning, listing, extraction, creation, or safety behavior in TypeScript. The frontend may assemble command DTOs and derive presentation state, but Rust and `zmanager-core` own archive semantics.
