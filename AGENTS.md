# Repository Guidelines

## Project Structure & Module Organization

ZManager Desktop is the Windows/Linux Tauri shell for the Rust archive engine. Keep it separate from the macOS SwiftUI app; do not reimplement archive behavior in TypeScript.

- `src/`: Vite/TypeScript frontend. `src/app` owns UI state and flows, `src/api` command DTOs, `src/ui` rendering helpers, and `src/desktop` runtime/path integration.
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

## Testing Guidelines

Test command-boundary behavior first: validation, password-required flows, listing mapping, create/extract lifecycle, cancellation, normalized errors, and platform path edge cases. Frontend tests should cover state transitions and user-visible behavior. Use Vitest for `src/**/*.test.ts` and Playwright for `e2e/*.spec.ts`.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, for example `Fix context menu`. Keep commits focused. Pull requests should include a description, test commands run, linked issue or requirement, and screenshots for UI changes.

## Security & Architecture Rules

Passwords must never be logged, persisted in frontend storage, passed through command-line arguments, or included in diagnostics. Extraction safety must remain core-owned; do not bypass path normalization, collision handling, overwrite policy, symlink/hardlink checks, or zip-bomb guards. Keep command contracts small: plan, list, extract, create, test, cancel, and poll events.
