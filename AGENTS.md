# Repository Guidelines

## Project Shape

This repository is the Windows/Linux desktop shell for ZManager. It must stay separate from the macOS SwiftUI app repository. The GUI should consume the public Rust archive engine and must not reimplement archive behavior in TypeScript.

The macOS app remains in `/Users/frankzhu/IdeaProjects/ZManager`. The public Rust engine currently lives at `/Users/frankzhu/IdeaProjects/ZManager/cli`.

## Build And Development Commands

- `npm install`: install frontend and Tauri CLI dependencies.
- `npm run dev`: run the Vite frontend only.
- `npm run build`: type-check and build the frontend.
- `npm run test:frontend`: run DOM-free frontend flow and reducer tests.
- `npm run tauri dev`: run the desktop shell.
- `powershell -ExecutionPolicy Bypass -File scripts/smoke-windows-arm64.ps1`: run the Windows ARM64 recovery smoke after a package build.
- `powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1`: run the Windows ARM64 release gate, including frontend tests, Rust tests, package build, smoke, and installer launch.
- `powershell -ExecutionPolicy Bypass -File scripts/build-windows-arm64-static.ps1`: build the Windows ARM64 static desktop app, including the required native environment setup.
- `cd src-tauri && cargo check`: check the Rust command layer.
- `cd src-tauri && cargo test`: run Rust command-layer tests when added.

Use the package scripts in `package.json` for frontend and Tauri verification instead of bypassing them with direct `tsc`, `vite`, or Tauri CLI invocations, unless the user explicitly asks for a lower-level command.

## Architecture Rules

- Keep archive behavior in `zmanager-core`.
- Keep app-facing command mapping in Rust Tauri commands.
- Keep frontend state focused on presentation, interaction, filtering, and view state.
- Keep Windows Explorer integration under a Windows-owned module.
- Keep Linux desktop/MIME/file-manager integration under a Linux-owned module.
- Do not add macOS SwiftUI, Finder Sync, Quick Look, signing, notarization, or `.app` packaging code here.

## Engineering Quality Rules

Do not hard-code product behavior, protocol names, command names, file names, limits, paths, or user-facing text in random call sites. Put them in named constants, shared helpers, or clearly owned modules.

Prefer a small, coherent command contract over many narrow UI-driven commands. The shell should expose operations like plan, list, extract, create, test, cancel, and poll events.

Passwords must never be logged, stored in frontend persistence, passed through command-line arguments, or included in diagnostics.

Extraction safety must remain core-owned. Do not bypass path normalization, collision handling, overwrite policy, symlink/hardlink checks, or zip-bomb guards for UI convenience.

## Frontend Guidance

Build the usable app surface, not a marketing page. The first screen should be the archive manager workspace with open/create/job controls.

Use ordinary controls for ordinary work: tabs for workspace modes, icon buttons for toolbar actions when icons are available, menus for option sets, checkboxes/toggles for binary options, and native file dialogs through Tauri plugins.

Keep the UI dense, calm, and operational. ZManager is an archive utility, not a promotional site.

## Testing Guidance

Test behavior at the command boundary first:

- request validation
- password-required flow
- archive listing mapping
- create/extract job lifecycle
- cancellation
- error normalization
- platform path edge cases

Frontend tests should cover state transitions and user-visible behavior, not implementation details.

