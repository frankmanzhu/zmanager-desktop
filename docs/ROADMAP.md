# Roadmap

## Phase 0: Scaffold

- Create Tauri project.
- Connect to local `zmanager-core`.
- Show healthcheck in the UI.
- Establish docs, requirements, architecture, and handoff notes.

Exit criteria:

- `npm run tauri dev` launches.
- UI shows the Rust engine healthcheck.
- `cd src-tauri && cargo check` passes.

## Phase 1: Browse Tracer Bullet

- Add archive file picker.
- Add `list_archive` command.
- Render archive entries.
- Add loading, empty, and failure states.
- Add filtering and sorting.

Exit criteria:

- User can open and browse ZIP, TZST, 7z, and one libarchive-backed fixture.

## Phase 2: Extract

- Add whole-archive extraction.
- Add selected-entry extraction.
- Add destination picker.
- Add password-required flow.
- Add progress events and cancellation.

Exit criteria:

- User can extract supported archives with progress and cancellation.

## Phase 3: Create

- Add source picker and drag/drop.
- Add format selection for ZIP, TZST, TZAP, and 7z.
- Add clean source planning.
- Add password flow for encrypted formats.
- Add create progress and cancellation.

Exit criteria:

- User can create normal and clean source archives from the UI.

## Phase 4: Platform Integration

- Add Windows installer.
- Add Windows file associations.
- Add Windows Explorer actions.
- Add Linux portable package.
- Add Linux `.desktop` launcher.
- Add Linux MIME registration.

Exit criteria:

- Installed builds can open archives from the OS shell on Windows and Linux.

## Phase 5: Hardening

- Add command-layer integration tests.
- Add UI state tests.
- Add packaging smoke tests.
- Add release signing/checksum workflow.
- Add crash-safe temp cleanup.
- Add recent files and preferences.

Exit criteria:

- Release candidate can be tested on clean Windows and Linux machines.

## Phase 6: macOS full-target replacement

- Execute `MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md` sequentially.
- Migrate the bounded Native Host and Extension Suite; keep product GUI in React.
- Add Native Launch Inbox, Native Drag Sessions, Public Metadata FFI, and Replacement Migration.
- Unify macOS identity, packaging, signing, notarization, CI, and publication in the Release Bundle.
- Freeze the former SwiftUI product only after both completion gates pass.

Exit criteria:

- macOS Native Integration Complete and Native Product Replacement Complete both pass.
- Clean arm64 and x86_64 installed-system upgrade/rollback matrices pass.
- Exactly one canonical macOS product, extension suite, association owner, and release pipeline remain.
