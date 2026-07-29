# Repository Guidelines

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `frankmanzhu/zmanager-desktop`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical workflow labels defined for this repository. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with `CONTEXT.md` at the root and architectural decisions under `docs/adr/`. See `docs/agents/domain.md`.

## Project Structure & Module Organization

ZManager Desktop is the single cross-platform Tauri product for Windows, Linux,
and macOS. This repository owns the replacement macOS host, extensions,
packaging, signing, notarization, and migration; the former SwiftUI repository
is reference evidence only. Never reimplement archive behavior in TypeScript.

- `src/`: Vite/TypeScript frontend. `src/app` owns workflow state, pure behavior, and effect interfaces; `src/api` owns command DTOs and invoke wrappers; `src/ui` owns React rendering and UI event adapters; `src/desktop` owns concrete runtime/path/window/native integration.
- `src/app/shell/`: target home for app-wide shell state such as active workspace mode, status, drop decisions, quick-action startup state, preview cleanup metadata, and path-history snapshots.
- `src/app/workspaces/`: target home for deep workflow modules such as Archive Workspace, Create Workspace, and Jobs Workspace.
- `src/app/commands/`: target home for command routing that unifies toolbar, menu, shortcut, context-menu, details-pane, tree, and row-action execution.
- `src/app/controllers/`: target home for async orchestration that uses injected API, desktop, dialog, storage, timer, clipboard, and window adapters. Controllers must not import Tauri directly.
- `src/app/display/`: target home for display context such as resolved locale, translator, and formatting state. Workflow state and command DTOs stay language-neutral.
- `src/app/pathHistory.ts`: target module for recent archive and destination history normalization before persistence.
- `src-tauri/`: Rust Tauri commands, job registry, DTO mapping, and platform modules. Keep OS code in `platform/windows.rs`, `platform/linux.rs`, and `platform/macos/`.
- `native/macos/`: Swift/AppKit Native Host and operating-system-mandated Finder, Quick Look, and Spotlight targets. It contains no SwiftUI product screens or archive semantics.
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
- `cd src-tauri && cargo fmt`: format the Rust code to pass CI.
- `cd src-tauri && cargo test`: run Rust tests.
- `scripts/build-linux-ubuntu-deb.sh`: build Ubuntu/Debian `.deb`.
- `scripts/build-linux-fedora-rpm.sh`: build Fedora `.rpm`.
- `scripts/build-macos.sh`: build unnotarized macOS Tauri `.app` and `.dmg` artifacts without Developer ID signing and install the app into `/Applications` by default.
- `powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1`: run the Windows ARM64 release gate.

Use package scripts instead of direct `tsc`, `vite`, or Tauri CLI calls unless debugging requires it.

## Coding Style & Naming Conventions

Use explicit TypeScript module names such as `extractFlow.ts` and `archiveTable.ts`, with matching `*.test.ts` files. Prefer named constants and shared helpers over hard-coded text, limits, paths, or command names.

Rust code should keep app-facing mapping in Tauri commands and leave archive
behavior in `zmanager-core`. macOS Swift/AppKit code is allowed only in the
bounded Native Host and Extension Suite under `native/macos`; application-owned
GUI remains React. One Release Bundle pipeline owns Developer ID signing,
notarization, stapling, and artifacts.

## Frontend UI Technology Rule

All new frontend UI and all modifications to existing frontend UI must use React, shadcn/ui components, and Tailwind CSS 4 utilities.

- Build rendering and interaction surfaces as React components. Do not add or extend vanilla DOM rendering, imperative HTML construction, `innerHTML`, manual element creation, or standalone DOM event wiring for product UI.
- Prefer existing shadcn/ui components under `src/ui/components/ui`. When a required primitive is missing, add the standard shadcn/ui-style component backed by its normal Radix dependency, then reuse it rather than creating a one-off control.
- Style new and modified UI with Tailwind CSS 4 utility classes. Do not add raw CSS rules, CSS modules, inline style objects, or new legacy class-based styling for product UI.
- Existing vanilla DOM and raw CSS are legacy migration surfaces, not patterns to copy. Changes touching them must move the affected UI toward React, shadcn/ui, and Tailwind CSS 4 rather than expanding the legacy implementation.
- TypeScript remains the implementation language for React components, application state, controllers, adapters, DTOs, and tests. This rule prohibits vanilla TypeScript DOM UI, not typed non-UI application logic.

## Frontend Architecture Goals

Treat `src/main.ts` as the composition root, not the application architecture. It may query stable DOM roots, instantiate adapters/controllers/workspaces, bind top-level startup, and connect render functions to snapshots. Do not add new durable workflow state, table row derivation, command execution switches, selection/focus logic, job lifecycle state, password retry state, preview cleanup state, drop decision state, path-history normalization, preference patching, locale/display refresh, or desktop request construction to `main.ts`.

Prefer deep modules with small interfaces over shallow helper extraction. The current architecture target is documented in `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`: Shell Workspace, Archive Workspace, Create Workspace, Jobs Workspace, Command Router, shared Hierarchical Table, controllers, display context, path histories, and desktop adapters.

Keep ownership clear:

- `src/app`: workflow state, state transitions, request readiness, pure derivations, and interfaces for injected effects. App modules may depend on DTO types but should not call Tauri directly.
- `src/ui`: React rendering and UI event decoding. UI modules emit typed intents and render snapshots; they should not duplicate workflow decisions. New and modified UI must follow the React, shadcn/ui, and Tailwind CSS 4 rule above.
- `src/api`: serializable DTOs and Tauri invoke wrappers only.
- `src/desktop`: concrete runtime adapters for native dialogs, file manager actions, Tauri events, window control, native drag-out, file drop, preview cleanup, clipboard, timers, and platform path helpers.

Workspaces should be mostly deterministic state machines. Controllers coordinate async effects with injected adapters, then feed success/failure intents back into workspaces. Snapshots passed to `src/ui` should be immutable, render-ready plain data and must not contain passwords, mutable `Set`/`Map` instances, DOM nodes, or Tauri promises.

For table-like folder panes, reuse or deepen the planned `hierarchicalTable` module. Do not add new archive/create row builders, selection globals, focus globals, or table-specific event listeners in `main.ts`.

For commands, route new toolbar, menu, shortcut, context-menu, details-pane, and row-action behavior through a command router rather than wiring each surface separately.

For preferences, localization, and formatting, keep stable workflow values language-neutral. Use the display context at render seams; do not sort, filter, persist, or build command DTOs from localized labels.

For path histories and storage-backed UI state, use typed storage and normalization modules. Do not add ad hoc `localStorage` keys or history arrays in `main.ts`.

## Maintainability Hardening Rules

Maintainability is the primary project constraint. Prefer proof over confidence, characterization over broad rewrites, and enforced seams over architecture diagrams.

- Act like a long-term senior owner of the codebase, not a short-term contractor. Do not hide messy behavior behind new filenames, wrappers, React facades, or "temporary" bridges and then present the result as clean architecture.
- Treat "vibe-coded" glue, hidden duplicate state, hidden DOM control channels, and god-file relocation as architecture failures, not acceptable migration steps. If a transition needs temporary scaffolding, name it explicitly, keep it small, add a deletion plan, and remove it as soon as the new seam is proven.
- A migration is not complete until the old ownership path is deleted or reduced to a clearly named adapter with a small interface. Moving logic from `main.ts` into another large file, preserving hidden legacy DOM, or keeping parallel render/control systems is debt relocation, not architecture progress.
- Prefer deletion and consolidation over concealment. When refactoring, measure whether the change actually reduces code paths, hidden state, direct DOM wiring, broad interfaces, or duplicated responsibilities.
- Do not claim a bug is fixed unless the changed behavior is covered by a failing-before/passing-after test, or unless you explicitly state why the behavior cannot be automated and describe the manual verification performed.
- When fixing a regression, add the regression test first or add it in the same change. The test should exercise the public module interface or command seam that failed, not a private helper extracted only for testing.
- Before refactoring a workflow, add or identify characterization tests for the current behavior. Refactors that move behavior without characterization tests should be treated as high risk.
- Prefer deep, testable modules over shallow helper movement. A new module must improve locality or leverage; if deleting it would only inline one pass-through call, do not add it.
- Keep `src/main.ts` shrinking toward a composition root. Do not add new durable state, command switches, selection/focus logic, async job decisions, request construction, or storage normalization there.
- Keep Tauri imports concentrated in `src/api` and `src/desktop`. Controllers and workspaces should use injected adapters so their behavior can be tested without a Tauri runtime.
- Treat Rust/TypeScript DTO drift as a maintainability risk. Prefer generated bindings such as `tauri-specta`, or add explicit contract tests when commands or DTOs change.
- Add architecture guardrails when a rule keeps being broken. Good candidates include `ast-grep`/lint rules for forbidden Tauri imports, workflow state in `main.ts`, direct `localStorage` keys, or command surfaces bypassing the router.
- Route new toolbar, menu, shortcut, context-menu, details-pane, tree, and row-action behavior through the command router. Do not wire separate behavior per surface.
- Use Playwright for end-to-end confidence and Vitest/Rust tests for workflow proof. Do not rely on UI click-through tests as the only proof of pure workflow behavior.
- If a requested change cannot be safely proven in the current turn, say so plainly. Include the residual risk and the exact verification gap instead of presenting the change as complete.
- When borrowing ideas from templates or external projects, adapt the concept only if it strengthens testability, contract safety, or locality. Do not adopt a framework or state library merely because it is modern.

## Testing Guidelines

Test command seam behavior first: validation, password-required flows, listing mapping, create/extract lifecycle, cancellation, normalized errors, and platform path edge cases. Frontend tests should cover state transitions and user-visible behavior. Use Vitest for `src/**/*.test.ts` and Playwright for `e2e/*.spec.ts`.

For every bug fix, include the test that proves the fix whenever feasible. For every architecture move, include characterization coverage before moving behavior and interface-level tests after the move. A final agent response should name the tests run and distinguish automated proof from manual smoke checks.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, for example `Fix context menu`. Keep commits focused. Pull requests should include a description, test commands run, linked issue or requirement, and screenshots for UI changes.

> **CRITICAL: Always run `cd src-tauri && cargo fmt` after making ANY Rust backend code changes.** 
> This checks and applies the correct format. If this is skipped, the CI pipeline will fail immediately. DO NOT claim a task is complete until you have formatted the code.

Before claiming a fix is complete, you must explicitly check and resolve all compilation errors and warnings by running the complete build verification matrix:
1. `npm run build` for the frontend (to catch strict TypeScript errors that `npm run test:frontend` misses).
2. `cargo check` and `cargo test` for the Rust backend.
3. `swift build` for the macOS native code.

Do not leave dead code, unused imports, or unused variables behind.

Use the repository's configured SSH remote for Git pushes. A missing `gh` CLI login
does not block committing or pushing when SSH authentication is available; require
`gh` authentication only for GitHub API operations such as creating a pull request.

Do not create or leave feature branches without explicit user permission. If a
feature branch is used with permission, merge it into `main` and delete the local
and remote branch after verification unless the user explicitly requests that it
remain available.

## Security & Architecture Rules

Passwords must never be logged, persisted in frontend storage, passed through command-line arguments, or included in diagnostics. Extraction safety must remain core-owned; do not bypass path normalization, collision handling, overwrite policy, symlink/hardlink checks, or zip-bomb guards. Keep command contracts small: plan, list, extract, create, test, cancel, and poll events.

Do not reimplement archive planning, listing, extraction, creation, or safety behavior in TypeScript. The frontend may assemble command DTOs and derive presentation state, but Rust and `zmanager-core` own archive semantics.

## Diagnosing Issues via Logs

When investigating a reported bug or failure, always attempt to diagnose the issue using the application's diagnostic logs before resorting to blind searching or trial-and-error.

- **Windows:** Logs are located in the `logs` directory next to the `.exe` file in the installation directory.
- **macOS:** Logs are always located at `~/Library/Logs/org.tzap-org.zmanager/zmanager-diagnostics.log`. Never write runtime data inside the signed `.app` bundle because doing so invalidates its code-signature seal.

If the existing logs do not provide enough data to identify the cause of the failure, your immediate next step should be to enhance the code by printing or logging additional diagnostic data to capture the missing context.

### Writing diagnostic instrumentation

Use the structured `DiagnosticLog` service (`diagnostics.record(scope, name, fields)`) for Rust backend logging instead of ad-hoc `eprintln!` or `println!`. The pipeline provides structured fields, rotation, secret redaction, and consistent platform locations. Use `eprintln!` only for build-script integration markers where the log has not been initialized yet (e.g. `--postinstall` begin/complete).
