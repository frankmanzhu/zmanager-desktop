# ZManager GUI Audit - 2026-06-28

## July 2026 Windows Look-And-Feel Pass

Date: 2026-07-07

Scope: refreshed the existing Playwright GUI visual scan and reviewed the screenshot set for Windows desktop look and feel.

Evidence refreshed with:

```powershell
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts
```

Result: 4 Playwright visual scan tests passed and refreshed the screenshot set in this folder.

Design findings from the refreshed screenshot set:

1. Primary work surface was too visually quiet.
   - Health before pass: usable but weak.
   - Evidence: Compress and Extract screens gave similar visual weight to toolbar, table, side panes, and status bar.
   - Fix direction: make the center table and selected rows more legible, while keeping chrome quiet.

2. Compress mode felt like a form attached to a file table.
   - Health before pass: functional but visually clunky.
   - Evidence: destination controls, action buttons, file table, and right-side options all competed.
   - Fix direction: simplify the create strip, make the empty drop zone intentional, and reserve the right rail for contextual archive options.

3. Side panes looked mechanically separated rather than native.
   - Health before pass: passing layout checks, weak hierarchy.
   - Evidence: left and right rails were separated by heavy grey resizer bars and similar backgrounds.
   - Fix direction: use quieter rail surfaces, softer resizers, and clearer table header/body separation.

4. Dialogs and job surfaces needed to share the same visual language.
   - Health before pass: passing.
   - Evidence: modal and job cards were readable but flatter than the rest of the app.
   - Fix direction: tune spacing, header weight, shadow, and progress sizing without changing behavior.

Companion guide: `docs/WINDOWS_GUI_DESIGN_GUIDE.md`.

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

9. `10-preferences-dialog.png` through `20-search-empty-results.png`
   - Health: passing.
   - Secondary surfaces now covered: Options, About, Jobs drawer with running/completed/failed jobs, empty Extract context menu, archive details, column context menu, multi-selection details, Archive Info, image-entry details, Entry Info, and search with no results.

10. `21-compact-compress-empty.png` through `24-compact-preferences-dialog.png`
    - Health: passing.
    - Compact viewport pass now covers Compress empty, Compress with sources, Extract loaded, and Options.

11. `25-compress-drop-overlay.png` through `31-flat-view-with-icons.png`
    - Health: passing.
    - Additional transient and option-heavy states covered: Compress drag overlay, Create source context menu, Create advanced/password/volume options, Extract drag overlay, empty Jobs drawer, Preferences custom output folder, and flat archive view with native icon fixtures.

12. `32-min-compress-empty.png` through `36-min-extract-dialog.png`
    - Health: passing after status-bar fix.
    - Minimum-size viewport pass covers Compress empty, long source names, Create dialog, Extract loaded, and Extract dialog.
    - Finding fixed: at 760x540, the status bar's responsive padding pushed the `No jobs` button partly outside the viewport.

## Fix Applied

- Scoped archive first-column sizing to `#entry-table`.
- Added explicit width contracts for `#compress-source-table` columns.
- Added `src/app/guiLayoutContracts.test.ts` to prevent unscoped first-column table rules and require Compress table column declarations.
- Scoped the path-bar search input minimum width so it cannot collide with the `Flat` toggle.
- Split native icon image classes from file-kind wrapper classes so image entries cannot expand row/detail icon boxes.
- Made terminal job progress determinate so completed create jobs stop at `100%` instead of showing an indeterminate progress bar.
- Reduced the small-width status bar padding so the Jobs button stays inside the fixed status row.
- Added `e2e/gui-visual-scan.spec.ts` to capture primary, secondary, transient, compact, and minimum-size GUI states. It fails on clipped labels, overlapping visible controls, page horizontal overflow, controls outside the viewport, oversized row/tree/detail icons, or terminal jobs with indeterminate progress.

## Current Verification

- `npm.cmd run test:frontend`: passed, 17 test files / 100 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run test:e2e`: passed, 14 Playwright tests.
- `npx.cmd playwright test e2e/gui-visual-scan.spec.ts`: passed, 4 GUI scan tests covering 36 screenshots.

## UX Risks Still Open

1. Dialogs still come from the older architecture and need deeper review against the two-mode model.
2. The Create Archive action is visually separated from the staged-file table but still opens the old modal, so the flow is not yet fully resolved.
3. Extract drag-out behavior needs end-to-end verification in the real Tauri shell, not browser preview.
4. More viewport variants should be added if the supported minimum window size changes.

## Accessibility Risks Still Open

1. Keyboard flow through Compress source rows and Remove buttons has not been validated.
2. Screen-reader labels for mode switching need testing with actual accessibility tooling.
3. Screen-reader behavior for the Jobs drawer and modal focus trap needs manual assistive-tech verification.

## Quality Gate Plan

1. Add real Tauri-shell visual smoke coverage for native drag-out and actual Windows system icons.
2. Keep the repeatable visual scan command covering desktop and compact widths, failing on:
   - clipped button/header text,
   - visible element overlap,
   - page horizontal overflow and visible controls outside the viewport,
   - missing main action for the active mode,
   - hidden/disabled fake actions in primary chrome,
   - oversized row/tree/detail icons,
   - terminal jobs with indeterminate progress.
3. Add CSS contract tests for global selectors that can damage unrelated tables or controls.
4. Require `npm.cmd run test:frontend`, `npm.cmd run build`, and the visual scan before GUI work is considered complete.
5. Keep audit screenshots in `docs/gui-audit/` whenever a GUI bug is fixed so reviewers can compare before/after evidence.
