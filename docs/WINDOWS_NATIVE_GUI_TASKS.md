# ZManager Desktop Windows Native GUI Tasks

Date: 2026-07-07

Source requirements: `docs/WINDOWS_NATIVE_GUI_REQUIREMENTS.md`

This task list turns the Windows native GUI requirements into independently reviewable implementation slices. Each slice should leave the app runnable, improve a visible workflow end to end, and refresh the matching visual evidence after completion.

## Validation Contract For Every Visual Task

Every task below has the same visual validation requirement:

1. Run the relevant automated checks for the touched area.
2. Run the visual scan after the implementation:

```powershell
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts
```

3. Treat the refreshed files in `docs/gui-audit/*.png` as the after pictures.
4. Review the listed screenshots for the task and confirm the requirement is visually satisfied.
5. Record the command result and the after-picture names in the PR, handoff, or issue notes.

If a task changes real Windows runtime behavior that browser Playwright cannot prove, also take a manual Tauri screenshot after the smoke pass and note the exact workflow used.

## Task 0: Baseline And Visual Evidence Hygiene

Type: AFK

Blocked by: None

Goal: Make sure future visual work has clean before/after evidence and does not accidentally promote regression screenshots as product imagery.

Implementation tasks:

- Confirm `docs/gui-audit/00-readme-hero.png` represents the intended first-run Compress experience.
- Keep `01-before-compress-name-column.png` as regression reference only, not current product imagery.
- Add or keep contract coverage that prevents global table column selectors from clipping unrelated table headers.
- Confirm the visual scan catches clipped headers, clipped labels, overlaps, horizontal overflow, oversized icons, and hidden footer controls.

Acceptance criteria:

- No active audit screenshot has clipped table headers or a `N...` style header.
- README/release imagery does not show browser-preview-only text.
- The current screenshot set is refreshed and reviewable.

After-picture validation:

- Re-run the visual scan and review `00-readme-hero.png`, all current active audit screenshots, and the historical `01-before-compress-name-column.png` reference.

## Task 1: Native Command Bar, Mode Switching, And Status Surface

Type: AFK

Blocked by: Task 0

Goal: Replace web-dashboard chrome with a compact Windows command-bar model that owns commands, mode switching, disabled reasons, shortcuts, overflow, and status messages.

Implementation tasks:

- Define command groups for Compress, Extract, table actions, jobs, settings, and help.
- Make the top command area compact, icon-led, grouped, stateful, and keyboard reachable.
- Keep the menu bar accessible with Alt accelerators.
- Replace web-pill mode switching with a native segmented control or tab-strip feel.
- Move transient status messages into the status bar and task center rather than floating banners.
- Add disabled reasons and tooltip text where state is not obvious.
- Add tests for command enabled states across empty, loaded, selected, multi-selected, and running-job states.

Acceptance criteria:

- Commands expose a consistent enabled/disabled state model.
- Mode switching looks native and does not compete with the file table.
- Status and job messages appear in durable Windows-style surfaces.

After-picture validation:

- Re-run the visual scan and review `00-readme-hero.png`, `03-compress-empty.png`, `04-compress-with-sources.png`, `06-extract-empty.png`, `07-extract-with-archive.png`, `16-multi-selection-details.png`, `21-compact-compress-empty.png`, `23-compact-extract-loaded.png`, `32-min-compress-empty.png`, and `35-min-extract-loaded.png`.

## Task 2: Three-Pane Windows Workspace And Splitter Behavior

Type: AFK

Blocked by: Task 1

Goal: Make the app read as three native regions: folder/source pane, file table, and details/options pane, with intentional collapse behavior at compact and minimum sizes.

Implementation tasks:

- Implement draggable, keyboard reachable splitters with Windows-like visible affordances.
- Keep the table as the primary work surface in both Compress and Extract.
- Make details/options panes contextual and visually secondary.
- Align details labels and values like a Windows Properties/details panel.
- Wrap or middle-truncate long values predictably.
- Collapse, tab, or move panes intentionally at 1000x700 and 760x540.

Acceptance criteria:

- Full-width layouts show clear source/tree, table, and details/options regions.
- Compact layouts do not crowd the table or hide instruction text.
- Minimum-size layouts become deliberate single-column or stacked utility layouts.

After-picture validation:

- Re-run the visual scan and review `03-compress-empty.png`, `04-compress-with-sources.png`, `07-extract-with-archive.png`, `14-extract-archive-details.png`, `21-compact-compress-empty.png`, `22-compact-compress-with-sources.png`, `23-compact-extract-loaded.png`, `32-min-compress-empty.png`, `33-min-compress-long-sources.png`, `34-min-create-dialog.png`, and `35-min-extract-loaded.png`.

## Task 3: Explorer-Like File Table Baseline

Type: AFK

Blocked by: Task 1

Goal: Make source and archive tables behave like Windows file lists.

Implementation tasks:

- Add native-feeling full-row selection for click, Ctrl, Shift, Space, Enter, ContextMenu, and Shift+F10.
- Add a non-color-only cue for selected rows.
- Support header sort state, keyboard focus, column resize, and column right-click menu.
- Keep empty, search-empty, and no-results rows inside the table shell while preserving columns.
- Use real shell icons in Tauri runtime when available, with browser-preview fallbacks.
- Prevent icon or thumbnail sizing from changing row height accidentally.

Acceptance criteria:

- Mouse and keyboard selection behavior matches Windows expectations.
- Table headers are never clipped in active screenshots.
- Empty/search states preserve the table structure.

After-picture validation:

- Re-run the visual scan and review `04-compress-with-sources.png`, `07-extract-with-archive.png`, `09-entry-context-menu.png`, `15-column-context-menu.png`, `16-multi-selection-details.png`, `18-image-entry-details.png`, `20-search-empty-results.png`, `31-flat-view-with-icons.png`, `33-min-compress-long-sources.png`, and `35-min-extract-loaded.png`.

## Task 4: Canonical Compress And Create Workflow

Type: HITL for workflow decision, then AFK

Blocked by: Task 1, Task 2, Task 3

Goal: Decide and implement one canonical Create Archive workflow so users do not see competing create surfaces.

Implementation tasks:

- Decide whether create review is in-window or modal.
- If in-window, show plan preview and validation inline in the Compress workspace.
- If modal, replace the right-rail controls with a native task dialog using the shared dialog system.
- Make Add Sources primary until sources exist.
- Make Create Archive dominant once destination and plan are valid.
- Show a discoverable disabled reason when Create Archive is unavailable.
- Use native path/browse affordances and recent locations for destination selection.
- Keep advanced and plan details quiet until needed.
- Make staged archive sources visually distinct from ordinary files and folders.
- Remove or restyle the old Add to Archive modal so no user-facing create state uses the older visual system.

Acceptance criteria:

- There is exactly one canonical create workflow visible to users.
- A user can stage files, remove a source, reveal a source, and create without opening an unrelated modal.
- Minimum-size users can tell why Create Archive is disabled.

After-picture validation:

- Re-run the visual scan and review `03-compress-empty.png`, `04-compress-with-sources.png`, `05-create-dialog.png`, `21-compact-compress-empty.png`, `22-compact-compress-with-sources.png`, `26-create-source-context-menu.png` if restored to the scan, `27-create-dialog-advanced-options.png`, `32-min-compress-empty.png`, `33-min-compress-long-sources.png`, and `34-min-create-dialog.png`.

## Task 5: Compress Source List Actions And Context Menu

Type: AFK

Blocked by: Task 4

Goal: Make staged sources manageable directly in the Compress workspace.

Implementation tasks:

- Support source row select, multi-select, right-click, Delete/Remove, Reveal in File Explorer, and Clear All.
- Keep the folder/source pane synchronized with staged roots and nested folders.
- Make source context menu actions work in the canonical in-window source list if the modal is removed.
- Remove disabled OK/Help footer patterns unless Help is implemented.

Acceptance criteria:

- Source rows behave like a native file list.
- Users can stage, inspect, remove, reveal, clear, and create from the same workspace.

After-picture validation:

- Re-run the visual scan and review `04-compress-with-sources.png`, `22-compact-compress-with-sources.png`, `26-create-source-context-menu.png` if restored to the scan, and `33-min-compress-long-sources.png`.

## Task 6: Native Dialog And Property Sheet System

Type: AFK

Blocked by: Task 1

Goal: Build shared Windows-like dialog primitives and migrate Options, About, Info, Extract, and any Create modal onto them.

Implementation tasks:

- Implement task-dialog and property-dialog layout primitives.
- Enforce focus trap, Escape close/cancel, safe Enter/default-button behavior, fixed footer, internal body scroll, and visual tab order.
- Keep footer buttons visible at minimum window size.
- Group dialog content into native-looking sections rather than broad web-form grids.
- Keep passwords hidden by default and never persisted, logged, copied into diagnostics, or displayed by default.
- Return focus to the invoking row/control after close.

Acceptance criteria:

- Dialogs are keyboard operable and visually consistent.
- Minimum-size dialogs keep required fields and footer actions reachable.
- Password and diagnostic safety rules are preserved.

After-picture validation:

- Re-run the visual scan and review `08-extract-dialog.png`, `10-preferences-dialog.png`, `11-about-dialog.png`, `17-multi-selection-info-dialog.png`, `19-image-entry-info-dialog.png`, `24-compact-preferences-dialog.png`, and `36-min-extract-dialog.png`.

## Task 7: Extract Empty And Loaded Archive Workflow

Type: AFK

Blocked by: Task 1, Task 2, Task 3

Goal: Make Extract mode understandable when empty and Explorer-like when an archive is loaded.

Implementation tasks:

- Make Open Archive the primary action in empty Extract mode.
- Disable or visually inert search until an archive is open.
- Make the details pane say `No archive open` and offer Open Archive.
- Support Open Archive from toolbar, empty state, context menu, and Ctrl+O.
- Synchronize tree selection, current folder, table rows, details, and status.
- Add copyable breadcrumb/path behavior and keyboard navigation.
- Keep Refresh visually secondary.
- Make details values for path, size, format, and counts copyable.

Acceptance criteria:

- The next step is obvious when no archive is open.
- Mouse and keyboard navigation update tree, table, details, and status consistently.

After-picture validation:

- Re-run the visual scan and review `06-extract-empty.png`, `07-extract-with-archive.png`, `13-extract-empty-context-menu.png`, `14-extract-archive-details.png`, `20-search-empty-results.png`, `23-compact-extract-loaded.png`, and `35-min-extract-loaded.png`.

## Task 8: Extract Selected Dialog And Destination Flow

Type: AFK

Blocked by: Task 6, Task 7

Goal: Make Extract Selected a native task flow with safe validation and correct keyboard behavior.

Implementation tasks:

- Focus destination first.
- Require a valid destination before Extract becomes primary.
- Use the native folder picker in Tauri runtime.
- Place checkbox labels beside their controls.
- Hide password and advanced fields unless relevant or expanded.
- Remove disabled preview/footer actions unless they work.
- Keep body internally scrollable at minimum height.

Acceptance criteria:

- Enter extracts only when required fields are valid.
- Escape cancels.
- Tab order follows visual order.
- Destination, path mode, overwrite policy, Extract, and Cancel are visible at 760x540.

After-picture validation:

- Re-run the visual scan and review `08-extract-dialog.png` and `36-min-extract-dialog.png`.
- Also take a manual Tauri after screenshot for the native folder picker path.

## Task 9: Windows Context Menus And Column Menus

Type: AFK

Blocked by: Task 3, Task 7

Goal: Make right-click menus match Windows file utility expectations and remain keyboard accessible.

Implementation tasks:

- Entry menu: Open, Open in Archive, Extract..., Extract Here, Test, Properties.
- Include Reveal/Open Outside only when supported for the selected entry.
- Keep the default action first and aligned with double-click behavior.
- Multi-selection menu includes Extract Selected and Properties.
- Empty Extract menu appears near pointer and includes Open Archive plus Paste Path/Open Recent if supported.
- Column menu includes Sort Ascending/Descending, move, width, visibility, reset, and column chooser behavior.
- Group destructive or irreversible actions separately.
- Close menus on Escape, outside click, activation, and focus loss.

Acceptance criteria:

- Shift+F10 opens the same entry menu on the focused row.
- Keyboard can open the column menu, toggle a column, and restore defaults.
- Empty state, toolbar, and context menu trigger the same open flow.

After-picture validation:

- Re-run the visual scan and review `09-entry-context-menu.png`, `13-extract-empty-context-menu.png`, `15-column-context-menu.png`, and `16-multi-selection-details.png`.
- Also take a manual Tauri after screenshot for right-click Open Archive opening the native picker.

## Task 10: Drag And Drop Affordances

Type: AFK

Blocked by: Task 1, Task 4, Task 7

Goal: Make drag/drop local, explicit, deterministic, and native-feeling.

Implementation tasks:

- Show local target affordances where possible.
- Use full-window drag state only while dragging over the app.
- State the exact drop action: `Add sources to archive`, `Open archive`, or `Choose a mode`.
- For mixed or ambiguous drops, show explicit action buttons for Open Archive and Add to Compress.
- Keep target mode reachable by keyboard.
- Support native drag-out in desktop runtime and a clear unavailable state in browser preview.
- Keep the overlay within app bounds and avoid awkwardly covering status controls.

Acceptance criteria:

- Compress drop clearly communicates Add, Copy, or blocked state.
- Mixed Extract drops produce a deterministic chooser with keyboard and pointer support.

After-picture validation:

- Re-run the visual scan and review `25-compress-drop-overlay.png` and `28-extract-drop-overlay.png`.
- Also take manual Tauri after screenshots for dropping files/folders into Compress, dropping an archive into Extract, and drag-out behavior if supported.

## Task 11: Jobs Task Center

Type: AFK

Blocked by: Task 1, Task 6

Goal: Redesign Jobs as a compact Windows task center rather than raw diagnostics.

Implementation tasks:

- Use compact job cards with clear status, current item, progress, and actions.
- Failed jobs show concise error title, message, failed item, and recovery action.
- Running jobs show determinate progress when possible, current file, speed, remaining time, and Cancel/Pause when available.
- Completed jobs show output summary and Reveal/Open action where possible.
- Empty Jobs is compact and proportional to content.
- Avoid raw metric grids as the first visible content.

Acceptance criteria:

- Failed jobs can be understood and dismissed or retried without reading raw event data.
- Opening empty Jobs does not obscure most of the workspace.

After-picture validation:

- Re-run the visual scan and review `12-jobs-drawer-with-terminal-and-running.png` and `29-jobs-drawer-empty.png`.

## Task 12: Preferences And About Native Property Sheets

Type: AFK

Blocked by: Task 6

Goal: Convert Options and About into Windows-native settings/property surfaces.

Implementation tasks:

- Convert Options into a settings/property sheet with categories or left navigation.
- Group settings by Folders, Archive Defaults, Extraction Defaults, Interface, and Safety.
- Keep defaults clear and show which settings apply to quick actions.
- Avoid long scroll-heavy forms at normal desktop sizes.
- Keep Save/Cancel visible; use Apply only if changes are immediate-preview.
- Use native folder picker behavior for custom output paths.
- Middle-truncate long paths when unfocused and allow full editing when focused.
- Validate missing or inaccessible custom output paths.
- About shows app name, version, shell/runtime, and support diagnostics in clear groups.
- Copy Diagnostics excludes secrets, passwords, and local personal paths unless explicitly allowed.

Acceptance criteria:

- All settings have labels, descriptions where needed, keyboard focus, and no clipped rows at 1000x700.
- Save is disabled or warns when custom output folder is invalid.
- Diagnostics copied text matches visible fields without sensitive data.

After-picture validation:

- Re-run the visual scan and review `10-preferences-dialog.png`, `11-about-dialog.png`, `24-compact-preferences-dialog.png`, and `30-preferences-custom-output.png`.

## Task 13: Selection, Info, Details, And Entry Preview

Type: AFK

Blocked by: Task 3, Task 6, Task 7

Goal: Make selected-entry, multi-selection, archive-info, and image-entry surfaces unambiguous and useful.

Implementation tasks:

- Multi-selection details prioritize Extract Selected, Test Selected, and Properties.
- Keep status bar and details pane counts synchronized.
- Support Ctrl, Shift, Select All, invert selection, and clear selection.
- Clarify whether Info shows archive properties or selected-entry properties.
- Use `Selection Properties` for multi-selection if the dialog describes selected entries.
- Keep archive-level Info available separately.
- Image entries use native image icons or thumbnails only when cheap and safe.
- Details include type, path, size, packed size, modified, ratio, and preview/open action if supported.
- Define double-click image behavior: in-app preview or extract-to-temp and open externally.
- Entry Info uses the same property layout as the details pane and supports Copy Path/Copy Details if useful.
- Avoid duplicate header Close and footer Close unless deliberately matching a native pattern.

Acceptance criteria:

- Selected-entry info and archive info cannot be confused.
- Selecting an image exposes one obvious view, preview, or open action.
- Values align and wrap correctly; Escape closes; Close returns focus to the source row.

After-picture validation:

- Re-run the visual scan and review `16-multi-selection-details.png`, `17-multi-selection-info-dialog.png`, `18-image-entry-details.png`, and `19-image-entry-info-dialog.png`.

## Task 14: Search And Flat View

Type: AFK

Blocked by: Task 3, Task 7

Goal: Make search and flat view preserve file-list behavior rather than becoming separate UI modes.

Implementation tasks:

- Search results preserve the table shell and show a no-results row.
- Provide a clear search button and `0 results` count.
- Clearing search restores rows, selection, details, and status consistently.
- Details either retain current selection with `not visible in current search` or clear selection predictably.
- Flat view visually distinguishes filename from containing path.
- Make the view toggle visible and stateful in toolbar/menu.
- Keep flat view sort, selection, context menu, and details behavior consistent with folder view.

Acceptance criteria:

- No-results search is understandable and reversible.
- Flat view behaves like the same file table, not a different component.

After-picture validation:

- Re-run the visual scan and review `20-search-empty-results.png` and `31-flat-view-with-icons.png`.

## Task 15: Responsive Layout Gates

Type: AFK

Blocked by: Tasks 1-14

Goal: Make full, compact, and minimum screenshots look like one intentional Windows product.

Implementation tasks:

- Define layout behavior for 1280x800, 1000x700, and 760x540.
- Collapse panes and command groups intentionally.
- Keep toolbar commands in overflow when space is tight.
- Keep table names meaningful at compact/minimum widths.
- Ensure options/details collapse under disclosures where needed.
- Update visual scan assertions so partially hidden instruction text fails, not only element overflow.

Acceptance criteria:

- At 1000x700, users can browse, select, search, and extract without horizontal scrolling.
- At 760x540, the primary next action remains visible and no major section feels cut off.
- Minimum Extract keeps table headers, rows, details, and Jobs usable without visual crowding.

After-picture validation:

- Re-run the visual scan and review all compact and minimum screenshots: `21-compact-compress-empty.png`, `22-compact-compress-with-sources.png`, `23-compact-extract-loaded.png`, `24-compact-preferences-dialog.png`, `32-min-compress-empty.png`, `33-min-compress-long-sources.png`, `34-min-create-dialog.png`, `35-min-extract-loaded.png`, and `36-min-extract-dialog.png`.

## Task 16: Native Runtime Smoke Pass

Type: HITL

Blocked by: Tasks 1-15

Goal: Verify the real Windows Tauri shell behavior that browser screenshots cannot prove.

Implementation tasks:

- Open archive with native picker and Ctrl+O.
- Drop archive into Extract.
- Drop files/folders into Compress.
- Right-click rows, empty surfaces, source rows, and column headers.
- Resize panes and window down to 760x540.
- Test keyboard navigation, Shift+F10, Escape, Enter, Tab, Space, and Ctrl+A.
- Verify native folder/file pickers, shell icons, Reveal in File Explorer, drag-out behavior, and focus return.
- Confirm browser-preview fallbacks remain visibly distinct from release UI.

Acceptance criteria:

- Native dialogs, shell icons, drag-out, Reveal in File Explorer, focus return, and keyboard behavior work in the desktop shell.
- Any behavior that cannot be validated in the current environment is documented with the exact blocker.

After-picture validation:

- Take manual Tauri after screenshots for Open Archive, Compress with dropped sources, Extract with loaded archive, Extract dialog with native destination picker path, context menus, Jobs, Preferences, and minimum-size layout.
- Re-run `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts` after any follow-up visual fixes.

## Final Acceptance Gate

Run these before considering the Windows native GUI requirements complete:

```powershell
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts
cd src-tauri
cargo check
cargo test
```

Then complete the manual Windows Tauri smoke pass from Task 16 and attach or list the after-picture evidence.

