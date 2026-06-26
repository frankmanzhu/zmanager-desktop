# ZManager Desktop Production Recovery Plan

Date: 2026-06-11

## Current Finding

The app is not ready for users until the real desktop workflows are verified end to end:

- Open archive through the native file dialog.
- Add source files and source folders through native dialogs.
- Choose a new archive destination through a save dialog.
- Create an archive and see the job reach a terminal state.
- Open/list the created archive.
- Extract an archive and see files written to disk.
- Preview/open an extracted temporary file.
- Cancel and dismiss jobs.

The Windows ARM64 static build entry point works:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-windows-arm64-static.ps1
```

It produced:

- `src-tauri/target/release/zmanager-desktop.exe`
- `src-tauri/target/release/bundle/nsis/ZManager_0.1.0_arm64-setup.exe`

`AGENTS.md` now records this build script so future verification uses the project-owned entry point.

## Implementation Status

Completed on 2026-06-11.

Subphase breakdown used to close the plan:

1. Desktop access and command permissions: added Tauri capabilities, generated app command permissions, and kept only job-based extraction plus scoped preview open-path access.
2. Create/open/extract repair: fixed native dialog error handling, create save dialog behavior, create extension normalization, open/list retry behavior, and selected extraction through `start_extract`.
3. Job lifecycle stabilization: serialized poll batches, preserved terminal summaries, added selected-extract cancellation events, and removed the direct `extract_entry` command surface.
4. Frontend responsibility split: extracted DOM-free helpers into `src/app/dialogs.ts`, `src/app/createFlow.ts`, `src/app/extractFlow.ts`, and `src/app/jobs.ts`.
5. Test coverage: added frontend Vitest tests and Rust recovery smoke tests for create/open/list/test/extract plus password-required/invalid/valid extraction.
6. Release gate: added `scripts/smoke-windows-arm64.ps1` and `scripts/release-gate-windows-arm64.ps1`; the release gate passed locally and recorded the result in `docs/platform-smoke-test-results.md`.

Release-gate command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1
```

Latest verified artifacts:

- `src-tauri/target/release/zmanager-desktop.exe`
- `src-tauri/target/release/bundle/nsis/ZManager_0.1.0_arm64-setup.exe`

## Likely Breakpoints To Fix First

### 1. Tauri Capability Permissions

The repo has no checked-in `src-tauri/capabilities` file. Tauri v2 uses capabilities to grant webviews access to IPC and plugin commands. The app uses:

- custom commands through `invoke`
- `@tauri-apps/plugin-dialog` for file/folder dialogs
- `@tauri-apps/plugin-opener` for preview/open-path behavior

Add a default capability for the main window and grant only the permissions the app actually needs:

- `core:default`
- `dialog:allow-open`
- `dialog:allow-save`
- `opener:allow-open-path`
- Add reveal-in-folder only through a scoped app command if that feature is added later.

Acceptance:

- `fetchHealthcheck()` succeeds in the Tauri app.
- Open archive dialog opens.
- Add files dialog opens.
- Add folder dialog opens.
- Extract destination folder dialog opens.
- Preview/open path works.

### 2. Create Destination Uses The Wrong Dialog

`src/main.ts` currently chooses the output archive path with `openDialog({ directory: false })`. That asks the user to select an existing file. Creating a new archive needs a save dialog, otherwise the user cannot naturally choose `new-archive.zip`.

Fix:

- import `save` from `@tauri-apps/plugin-dialog`
- use save dialog for create destination
- set the extension/default path based on selected format
- keep manual path entry as a fallback

Acceptance:

- User can choose a new `.zip`, `.tar.zst`, `.tzst`, `.tzap`, or `.7z` output path without pre-creating the file.
- Create button enables after sources, destination, and plan are valid.

### 3. Dialog Errors Are Currently Hidden

`openNativeDialog()` catches every error and shows only "Native dialogs are unavailable in browser preview." That hides real Tauri permission errors, plugin failures, and platform dialog failures.

Fix:

- only use the browser-preview message when not running in Tauri
- show the actual command/plugin error in desktop mode
- log no passwords and no sensitive paths beyond user-selected paths already visible in the UI

Acceptance:

- If dialog permission is missing, the UI says permission/plugin access failed.
- If the user cancels the dialog, the UI stays quiet.

### 4. Command Boundary Must Be The Source Of Truth

The Rust command layer already has the right broad operations:

- `list_archive`
- `plan_create`
- `start_create`
- `start_extract`
- `preview_entry`
- `test_archive`
- `poll_job_events`
- `cancel_job`
- `dismiss_job`

Do not move archive behavior into TypeScript. The frontend should only collect inputs, call commands, render state, and poll jobs.

Acceptance:

- Frontend never decides extraction safety, overwrite collision behavior, archive parsing, or archive creation internals.
- Passwords are passed only to command calls and cleared after use.

## Phase 0: Establish A Reliable Repro Harness

Goal: make broken flows reproducible without manual guessing.

Build a smoke fixture folder under a temp directory during tests:

```text
source/
  hello.txt
  nested/readme.md
```

Smoke flow:

1. Launch the Tauri app.
2. Use native dialog or test hook to add the source folder.
3. Use save dialog or test hook to choose `created.zip`.
4. Create ZIP.
5. Poll until completed.
6. Open `created.zip`.
7. Verify expected entries.
8. Extract to `extracted/`.
9. Poll until completed.
10. Verify files exist with expected content.

Acceptance:

- This smoke flow can run on Windows ARM64.
- Failures produce actionable logs/screenshots.
- It is documented as the release gate.

## Phase 1: Restore Native Desktop Access

Scope:

- Add `src-tauri/capabilities/default.json`.
- Grant dialog/open/save/opener permissions.
- Verify all current `invoke` calls still work.
- Fix hidden error handling in `openNativeDialog()`.

Acceptance:

- Open Archive button opens a file picker.
- Add Files opens a file picker.
- Add Folder opens a folder picker.
- Extract destination opens a folder picker.
- Preview can open a temp file path.

## Phase 2: Fix Create Archive End To End

Scope:

- Replace create destination `openDialog` with `save`.
- Add extension/default-name handling by archive format.
- Re-run plan when sources or plan options change.
- Make validation visible: sources, destination, plan, warnings.
- Start create job only after the plan is current.
- Poll until terminal state and preserve terminal summary.

Acceptance:

- User can create a new ZIP from a folder.
- User can create from selected files.
- Destination overwrite behavior matches `replaceExisting`.
- Completed job writes an actual archive to disk.
- Failed job shows normalized error and remains dismissible.

## Phase 3: Fix Open/List Archive End To End

Scope:

- Verify archive filters include formats the core can list.
- Validate unsupported formats produce a clear error.
- Password-required and invalid-password flows prompt once and retry.
- Main table, tree, breadcrumbs, details pane update after load.

Acceptance:

- Open created ZIP and list expected entries.
- Open password-protected archive and recover after password entry.
- Open unsupported/corrupt archive and show a useful error.
- No password text appears in UI diagnostics or job events.

## Phase 4: Fix Extract End To End

Scope:

- Verify extract-all uses `start_extract`.
- Verify extract-selected uses `start_extract` with selected `entry_paths`, so it participates in jobs, polling, retry, and cancellation.
- Ensure destination folder is required and visibly selected.
- Keep overwrite policy, strip components, and password mapping in the command contract.
- Poll extract jobs until terminal state.

Acceptance:

- Extract all writes expected files.
- Extract selected writes only selected entries.
- Password-required extract can retry.
- Cancel stops an active job and updates UI.
- Unsafe archive errors stay core-owned and visible.

## Phase 5: Stabilize Jobs And Status

Scope:

- Make job polling deterministic.
- Do not lose terminal summaries after events drain.
- Keep active job status in the bottom bar.
- Job drawer shows started/progress/warning/completed/failed/cancelled.
- Dismiss removes only terminal jobs.

Acceptance:

- Create/extract/test all show terminal status.
- Failed jobs show code/message/hint where available.
- Cancel and dismiss buttons do what they say.

## Phase 6: Split The Frontend By Responsibility

`src/main.ts` is too large for safe production work. Split only after the core flows work.

Suggested modules:

- `src/app/dialogs.ts`: native dialog wrappers and desktop/browser distinction.
- `src/app/createFlow.ts`: create form state and request building.
- `src/app/extractFlow.ts`: extract dialog state and request building.
- `src/app/jobs.ts`: job polling, retry, cancel, dismiss.
- `src/app/archiveTree.ts`: keep existing tree/navigation helpers.
- `src/app/formatting.ts`: keep existing formatting helpers.

Acceptance:

- Behavior remains unchanged after each extraction.
- Unit tests can cover state transitions without a full DOM.

## Phase 7: Add Tests At The Right Boundaries

Rust command tests:

- request validation
- password-required vs invalid-password mapping
- archive listing mapping
- create job lifecycle
- extract job lifecycle
- cancellation
- unsupported/corrupt archive errors
- Windows path edge cases

Frontend tests:

- create button enablement
- save-dialog destination selection
- source file/folder selection
- open archive load state
- extract dialog validation
- job polling terminal states
- error rendering

End-to-end smoke:

- create ZIP
- open ZIP
- extract ZIP
- test ZIP
- password-protected archive flow

Acceptance:

- Windows ARM64 build script passes.
- Rust command-boundary tests pass in the native environment.
- E2E smoke passes against the built app or Tauri dev app.

## Phase 8: Production Release Gate

No release until all of these pass:

- `powershell -ExecutionPolicy Bypass -File scripts/build-windows-arm64-static.ps1`
- native dialog smoke on Windows ARM64
- create/open/extract/test smoke
- password-required smoke
- corrupt archive smoke
- cancel smoke
- installer launches the app
- no passwords in logs, diagnostics, or persisted frontend state

## Priority Order

1. Add capabilities and fix native dialog errors.
2. Replace create destination open dialog with save dialog.
3. Prove create ZIP end to end.
4. Prove open/list created ZIP end to end.
5. Prove extract created ZIP end to end.
6. Prove password and error flows.
7. Add automated smoke coverage.
8. Refactor `src/main.ts` after behavior is protected.

This order is intentional: first restore the app's ability to talk to the desktop, then prove archive workflows, then clean architecture.
