# ZManager GUI Audit - 2026-06-28

## Scope

Surface audited: current desktop shell frontend at `http://127.0.0.1:5173/`.

Primary user goal: switch between Compress and Extract without fake or broken UI, then use table views for staged files or archive contents.

## Evidence

1. `01-before-compress-name-column.png`
   - Health: failing.
   - Finding: the Compress table `Name` column is clipped to `N...`, before any source rows are shown.
   - Cause confirmed in CSS: a global `td:first-child, th:first-child` rule intended for the archive table checkbox column was applied to the Compress table.

2. `03-compress-empty.png`
   - Health: passing.
   - Compress empty state renders with usable `Name`, `Location`, `Kind`, and `Action` columns.

3. `04-compress-with-sources.png`
   - Health: passing.
   - Dropped source rows render without clipped table headers or overlapping controls.

4. `05-create-dialog.png`
   - Health: passing after scan tuning.
   - Create dialog is captured with staged sources and visible action row.

5. `06-extract-empty.png`
   - Health: passing after path-bar fix.
   - Extract empty state has no overlapping search/Flat controls.

6. `07-extract-with-archive.png`
   - Health: passing.
   - Archive tree, table, and details pane are visible with fixture contents.

7. `08-extract-dialog.png`
   - Health: passing.
   - Extract dialog opens from a selected archive row and passes visible control scan.

8. `09-entry-context-menu.png`
   - Health: passing.
   - Entry context menu opens and passes visible control scan.

## Fix Applied

- Scoped archive first-column sizing to `#entry-table`.
- Added explicit width contracts for `#compress-source-table` columns.
- Added `src/app/guiLayoutContracts.test.ts` to prevent unscoped first-column table rules and require Compress table column declarations.
- Scoped the path-bar search input minimum width so it cannot collide with the `Flat` toggle.
- Added `e2e/gui-visual-scan.spec.ts` to capture key GUI states and fail on clipped labels or overlapping visible controls.

## Current Verification

- `npm.cmd run test:frontend`: passed, 16 test files / 95 tests.
- `npm.cmd run build`: passed.
- `npx.cmd playwright test e2e/gui-visual-scan.spec.ts`: passed, 1 GUI scan.

## UX Risks Still Open

1. Dialogs still come from the older architecture and need deeper review against the two-mode model.
2. The Create Archive action is visually separated from the staged-file table but still opens the old modal, so the flow is not yet fully resolved.
3. Extract drag-out behavior needs end-to-end verification in the real Tauri shell, not browser preview.
4. Responsive states below the default desktop viewport should be added to the scan.

## Accessibility Risks Still Open

1. Keyboard flow through Compress source rows and Remove buttons has not been validated.
2. Screen-reader labels for mode switching need testing with actual accessibility tooling.
3. Responsive reflow at narrow widths needs screenshot evidence.

## Quality Gate Plan

1. Add visual-state fixtures for Preferences, Jobs drawer, narrow viewport, and real Tauri drag-out.
2. Add a repeatable visual scan command that starts the app, captures every fixture at desktop and narrow widths, and fails on:
   - clipped button/header text,
   - visible element overlap,
   - horizontal overflow outside intended scroll containers,
   - missing main action for the active mode,
   - hidden/disabled fake actions in primary chrome.
3. Add CSS contract tests for global selectors that can damage unrelated tables or controls.
4. Require `npm.cmd run test:frontend`, `npm.cmd run build`, and the visual scan before GUI work is considered complete.
5. Keep audit screenshots in `docs/gui-audit/` whenever a GUI bug is fixed so reviewers can compare before/after evidence.
