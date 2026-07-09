# React GUI Critical Review - 2026-07-09

## Scope

Reviewed the migrated React GUI against the previous GUI audit evidence in
`docs/gui-audit/`, with extra focus on the Compress/Create options panel and
the frontend architecture seams.

## Evidence Captured

- `01-live-compress-empty.png`: in-app browser capture from the already-running
  Vite preview on `127.0.0.1:5174`.
- Refreshed Playwright scan screenshots in `docs/gui-audit/`, including:
  - `03-compress-empty.png`
  - `04-compress-with-sources.png`
  - `21-compact-compress-empty.png`
  - `32-min-compress-empty.png`
  - `34-min-create-dialog.png`

## Findings

1. Fixed: compact/minimum Compress options looked functionally empty.
   At desktop size, Archive Options are visible and usable. At compact and
   minimum sizes, the panel previously collapsed to a bottom strip labeled
   `Archive Options`. The React Create options panel now starts open at all
   viewports, the empty advanced-options disclosure is hidden for formats that
   do not support passwords, compact CSS keeps core archive options visible, and
   Playwright asserts the format and compression controls are visible in compact
   and minimum screenshots.

2. Remaining architecture debt: `src/main.ts` is now a small React composition root, but
   `src/runtimeBridge.ts` remains a large bridge with hidden legacy DOM,
   legacy ID privatization, string HTML, DOM queries, and event listeners.
   That is much cleaner than the old all-in-main architecture, but it is not a
   fully clean React/controller architecture yet.

3. Fixed: React Create submit no longer copies passwords through hidden legacy
   inputs. React now passes transient submit passwords directly to the Create
   start controller, which trims and validates them through the workspace
   request seam. A controller test and GUI contract prevent the old hidden-input
   bridge from returning. The advanced-options audit screenshot also captures
   masked password fields.

4. Fixed after independent review: React Create passwords no longer survive
   after format changes, after the password UI becomes hidden, or after submit.
   Create Workspace now ignores password input for formats that do not support
   archive passwords before mismatch validation, and the React surface clears
   transient password state plus the Show Password toggle on format/visibility
   changes and submit dispatch.

5. App/controller/workspace seams are substantially improved.
   Controllers are Tauri-free and DOM-free in the reviewed scan, direct Tauri
   imports are concentrated in `src/api` and `src/desktop`, and Create/Archive
   workspace tests cover request construction, state transitions, and
   password-safety related snapshot behavior.

## Verification Run

- `npm.cmd run test:frontend`: passed, 62 files / 534 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run ast:lint`: passed.
- `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts`: passed, 6 tests.
- Current focused regression coverage:
  `npm.cmd run test:frontend -- src\app\workspaces\createWorkspace.test.ts src\app\controllers\createStartController.test.ts src\ui\react\create\CreateWorkspace.test.tsx src\app\guiLayoutContracts.test.ts`
  passed, 4 files / 85 tests.
- Password lifecycle regression:
  `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts --grep "create password fields clear"`
  passed, 1 test.
- Full end-to-end suite:
  `npm.cmd run test:e2e` passed, 32 tests.

## Evidence Limits

- I did not run the native Tauri shell in this pass.
- `cargo check` was attempted but blocked by the existing Windows
  libarchive/vcpkg environment requirement:
  `Set VCPKG_INSTALLATION_ROOT or VCPKG_ROOT, or set CMAKE_TOOLCHAIN_FILE to vcpkg.cmake`.
  I did not run `cargo test`.
- The Playwright GUI scan is browser-stubbed; it does not prove real native
  dialogs, real OS drag-out, or packaged app behavior.
