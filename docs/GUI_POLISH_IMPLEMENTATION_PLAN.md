# ZManager Desktop GUI Polish Implementation Plan

Date: 2026-06-12

This is the execution checklist for `docs/GUI_POLISH_PLAN.md`. The goal is to finish the polish work end to end, with the macOS app as the workflow reference and ease of use as the primary constraint.

## Workstream A: File Intent Foundation

Owner scope:

- `src/app/archiveFileTypes.ts`
- `src/app/archiveFileTypes.test.ts`
- `src/app/dropIntent.ts`
- `src/app/dropIntent.test.ts`
- small imports from these helpers only after the helpers exist

Implementation steps:

1. Port the macOS `ArchiveFileTypes` behavior into TypeScript.
2. Recognize single extensions, compound extensions, and split suffixes.
3. Add `baseNameWithoutKnownArchiveExtension`.
4. Add drop intent classification for browse/create/dialog contexts.
5. Test ordinary archives, compound archive names, TZAP volumes, 7z split files, folders, unsupported files, and mixed drops.

Done when:

- `npm run test:frontend` includes the new helper tests.
- Drop and quick-action code can import one canonical archive type detector.

## Workstream B: Frontend Drag/Drop And UI Polish

Owner scope:

- `src/main.ts`
- `src/styles.css`
- imports from `src/app/archiveFileTypes.ts` and `src/app/dropIntent.ts`

Implementation steps:

1. Add Tauri webview/window drag/drop listener with browser-preview fallback.
2. Add global drag-over state and specific drop copy for browse/create surfaces.
3. Route one supported archive drop to the existing open/list flow.
4. Route file/folder drops to the create dialog source list.
5. Add a mixed-drop chooser when archive and source intents conflict.
6. Add in-app context actions:
   - archive table: Preview, Extract Selected, Extract Here, Extract To, Info
   - create source rows: Remove Source, Reveal in File Manager, Clear All
7. Tighten the empty state, drop affordance, status/job chip, and dialog hierarchy.

Done when:

- Dropping an archive opens it.
- Dropping sources opens/appends to Create Archive.
- Busy drops show a recoverable status.
- UI remains compact at the configured minimum window size.

## Workstream C: Quick Action Contract

Owner scope:

- `src-tauri/src/quick_action.rs`
- `src-tauri/src/dto.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/main.rs`
- `src-tauri/build.rs`
- `src/api/types.ts`
- `src/api/commands.ts`
- generated permission/capability updates for new commands

Implementation steps:

1. Add `QuickActionKind` matching macOS:
   - compress zip
   - compress clean source
   - extract here
   - extract to folder
2. Add request parsing from command-line args.
3. Add validation equivalent to macOS `FinderActionSelection`.
4. Add startup state command so frontend can consume pending launch quick actions.
5. Add job-start command for validated quick actions where enough defaults exist.
6. Add Rust command-boundary tests for parsing and validation.
7. Add TypeScript DTO wrappers for the frontend.

Done when:

- Quick actions can be represented, validated, and exposed to the frontend without passwords in args.
- `cd src-tauri && cargo test` covers the contract.

## Workstream D: Platform Integration

Owner scope:

- `src-tauri/tauri.conf.json`
- `src-tauri/src/platform/windows.rs`
- `src-tauri/src/platform/linux.rs`
- `packaging/windows/*`
- `packaging/linux/*`
- installer hook assets/scripts if needed

Implementation steps:

1. Add bundle file associations for supported archive extensions.
2. Add NSIS installer hook or packaging script for Windows Explorer verbs.
3. Register Windows verbs for:
   - Compress using ZManager
   - Extract using ZManager
4. Route both verbs through saved app preferences.
5. Add uninstall cleanup for current and legacy Explorer verbs.
6. Add Linux desktop action/service-menu materials where reliable.
7. Update platform profile booleans to reflect packaged support.
8. Document manual fallback if a given Linux file manager cannot consume packaged actions.

Done when:

- Windows installer can register and remove context-menu actions.
- Linux packaging has at least Open With plus documented quick-action routes.
- Platform integration docs describe the exact commands.

## Workstream E: Preferences And Defaults

Owner scope:

- `src/app/preferences.ts`
- `src/app/preferences.test.ts`
- preference UI in `src/main.ts`
- quick-action default selection in frontend/Rust boundary

Implementation steps:

1. Add non-sensitive preference storage for:
   - default archive format
   - clean-source default
   - default output location
   - default extraction behavior
   - quick open extraction enabled
   - preview cleanup policy
2. Add a compact Preferences dialog under Tools.
3. Apply defaults to create dialog and quick actions.
4. Never persist passwords.

Done when:

- Defaults are testable outside the DOM.
- Quick actions do not require form scanning for common paths.

## Workstream F: Verification

Implementation steps:

1. Run `npm run test:frontend`.
2. Run `npm run build`.
3. Run `cd src-tauri && cargo test`.
4. Run `powershell -ExecutionPolicy Bypass -File scripts/smoke-windows-static.ps1` if a packaged build is available.
5. Run `powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-static.ps1` for final release confidence.
6. Manually inspect the app at the minimum window size and normal desktop size.

Done when:

- All feasible checks pass.
- Any environment-only blocker is documented with the exact command and failure.

## Parallel Agent Split

The initial parallel split should avoid overlapping writes:

- Agent 1: Workstream A only.
- Agent 2: Workstream C only, with new Rust module preferred.
- Agent 3: Workstream D only.

Main thread owns:

- Workstream B integration after Agent 1 returns.
- Workstream E after quick-action shape stabilizes.
- Final merge, verification, and cleanup.

## Risk Controls

- Do not revert unrelated existing work. The working tree is already dirty.
- Do not reimplement archive behavior in TypeScript.
- Do not place passwords in logs, URLs, persisted preferences, or command-line args.
- Prefer small helper modules over growing `src/main.ts` further when logic is testable.
- For Explorer registration, validate in the app even if the shell tries to hide invalid actions.
