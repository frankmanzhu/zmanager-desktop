# ZManager Desktop Windows Native GUI Requirements

Date: 2026-07-07

Evidence source: screenshots refreshed by `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts` on July 7, 2026.

## Designer Concept

ZManager Desktop should become a Windows-native archive workbench: Explorer-like file browsing, a compact command bar, predictable split panes, native dialogs, shell icons, and direct manipulation through drag/drop and context menus.

The concept is not "modern web app." It is "Windows file utility." The app should feel closer to File Explorer, 7-Zip File Manager, and Windows properties/task dialogs than to a browser dashboard.

## North Star

Users should understand the app without reading helper copy:

1. Compress mode stages files, chooses an output archive, and creates it.
2. Extract mode opens an archive, browses entries, selects entries, and extracts them.
3. Right-click, double-click, keyboard navigation, column resizing, drag/drop, and dialogs behave like Windows users expect.
4. The UI looks like one product across full, compact, and minimum-size screenshots.

## Native Windows Design Requirements

### Shell And Chrome

- The top command area must look like a Windows command bar: compact, icon-led, grouped, and stateful.
- The menu bar must remain keyboard accessible with Alt accelerators.
- Toolbar commands must expose tooltip text and disabled reasons where the state is not obvious.
- Mode switching must feel like a native segmented control or tab strip, not a web pill.
- Status messages should use the status bar and task center, not floating web-style banners.

### Panes

- The app has three native regions: folder/source pane, file table, details/options pane.
- Splitters must be draggable, keyboard reachable, and visibly similar to Windows split panes.
- Details panes should wrap full values and align labels/values like Windows Properties details.
- At compact widths, panes must collapse intentionally into sections or toggles; they must not simply crowd the main table.

### Tables

- Tables are the primary surface and must look like file lists.
- Header cells must support sort state, resize, right-click column menu, and keyboard focus.
- Rows must have native selection behavior: single click selects, Ctrl toggles, Shift ranges, Space toggles focused row, Enter opens/default action, ContextMenu/Shift+F10 opens menu.
- Full-row selection must be visually clear, including a non-color-only cue.
- File and folder icons must use real shell icons in desktop runtime when available.
- Empty/search/no-results rows must stay inside the table surface and preserve columns.

### Dialogs

- Dialogs must behave like Windows task dialogs/property sheets:
  - Enter activates the default button when safe.
  - Escape closes/cancels.
  - Initial focus lands on the first required decision.
  - Tab order follows visual order.
  - Footer buttons remain visible at minimum window size.
- Dialog contents must be grouped into native-looking sections, not broad web-form grids.
- Password values must never be stored, logged, copied into diagnostics, or displayed by default.

### Menus

- Context menus must use expected Windows verbs: Open, Open with, Extract, Extract to..., Test, Properties, Reveal in File Explorer where applicable.
- Destructive or irreversible actions must be separated.
- Column menus must match Explorer expectations: sort, group/visibility, resize/reset, and column chooser behavior.
- Menus must close on Escape, outside click, command activation, and focus loss.

### Drag And Drop

- File drop affordances must be local to the likely target when possible, with a full-window state only while dragging over the app.
- Drop copy/action text must say what will happen: "Add to archive", "Open archive", or "Choose a mode".
- Dragging entries out should use native drag-out in the desktop app and a clear unavailable state in browser preview.

### Jobs And Progress

- Jobs must feel like a task center, not raw diagnostics.
- Failed jobs must show a short error, the affected item, and the recovery action.
- Running jobs must show determinate progress when possible and cancel/pause affordances when supported.
- Completed jobs must summarize output and provide reveal/open actions when possible.

## Screenshot Requirements

### 00-readme-hero.png

Current role: Compress empty state used as the README hero.

Requirements:

- The hero screenshot must show the real intended first-run experience, not a half-configured browser preview.
- Browser-preview text must be absent from release/README imagery.
- The empty state must include one primary next action and one secondary drop affordance.
- The right options pane must not dominate the hero; it should read as contextual settings.
- Acceptance: reviewer can identify the primary task in under 3 seconds.

### 01-before-compress-name-column.png

Current role: Historical regression evidence for a clipped Compress table header.

Requirements:

- Keep this as a regression reference only; do not use it as current product imagery.
- Add/keep contract tests that prevent global table column selectors from damaging unrelated tables.
- Acceptance: no screenshot in the active audit set may show clipped table headers or a `N...` style header.

### 03-compress-empty.png

Current role: Default Compress workspace.

Requirements:

- Compress mode must feel like a file staging surface, not a settings page.
- Destination should use native path/browse affordances and support recent locations.
- Add Sources should be the obvious primary action until files are present.
- Create Archive must remain disabled until destination and plan are valid, with a discoverable reason.
- The options pane should show only defaults initially; advanced and plan details should be quiet until needed.
- Acceptance: with no sources, the user can immediately tell whether to drop files or click Add Sources.

### 04-compress-with-sources.png

Current role: Compress workspace after sources are staged.

Requirements:

- Source rows must behave like a native file list: select, multi-select, right-click, delete/remove key, and reveal.
- Folder tree/source pane must show staged roots and nested folders consistently.
- The Create Archive button should become the dominant action once the plan is valid.
- Staged archive sources should be visually distinguished from ordinary files/folders.
- Acceptance: a user can stage files, remove one source, reveal a source, and create without opening a separate modal.

### 05-create-dialog.png

Current role: Duplicate of create-ready Compress state.

Requirements:

- Decide whether create review is in-window or modal; do not maintain two primary create surfaces.
- If in-window, this state must show the plan preview and validation inline.
- If modal, the modal must replace the right-rail controls and look like a native task dialog.
- Acceptance: there is exactly one canonical create workflow visible to users.

### 06-extract-empty.png

Current role: Default Extract workspace.

Requirements:

- Empty Extract must present Open Archive as the primary action.
- The empty table should not require reading helper text to understand the next step.
- Search should be disabled or visually inert until an archive is open.
- Details pane should say "No archive open" and offer the same Open Archive action.
- Acceptance: the user can open an archive from toolbar, empty state, context menu, or Ctrl+O.

### 07-extract-with-archive.png

Current role: Archive loaded with folders in list and tree.

Requirements:

- Loaded archive must look like a native Explorer file list.
- Breadcrumb/path field must support copy path and keyboard navigation.
- Tree selection and table current folder must stay synchronized.
- Refresh should not compete visually with table contents.
- The details pane should support copyable values for path, size, format, and counts.
- Acceptance: mouse and keyboard navigation both update tree, table, details, and status consistently.

### 08-extract-dialog.png

Current role: Extract Selected dialog.

Requirements:

- Dialog must focus destination first and require a valid destination before Extract is primary.
- Destination browse button should use a native folder picker in Tauri runtime.
- Checkbox labels must sit beside their controls; no orphan checkboxes.
- Password and advanced fields should be hidden unless relevant or expanded.
- Contents preview should either work or be removed from disabled footer actions.
- Acceptance: Enter extracts only when required fields are valid; Escape cancels; Tab order is visual.

### 09-entry-context-menu.png

Current role: Context menu on selected folder entry.

Requirements:

- Menu must match Windows expectations: Open, Open in Archive, Extract..., Extract Here, Test, Properties.
- Include Reveal/Open Outside only when the action is actually supported for the selected entry.
- Default action must be first and match double-click behavior.
- Multi-selection menu must include Extract Selected and Properties.
- Acceptance: Shift+F10 opens the same menu on the focused row.

### 10-preferences-dialog.png

Current role: Options dialog.

Requirements:

- Convert Options into a native settings/property sheet with categories or a left navigation list.
- Group settings by Folders, Archive Defaults, Extraction Defaults, Interface, and Safety.
- Keep defaults clear and show which settings apply to quick actions.
- Avoid long scroll-heavy forms at normal desktop sizes.
- Save/Cancel should remain visible; Apply is optional if changes are immediate-preview.
- Acceptance: all settings have labels, descriptions where needed, keyboard focus, and no clipped rows at 1000x700.

### 11-about-dialog.png

Current role: About/diagnostics dialog.

Requirements:

- About should show app name, version, shell/runtime, and support diagnostics in clear groups.
- Copy Diagnostics must exclude secrets, passwords, and local personal paths unless explicitly allowed.
- Close should be the default safe action.
- Acceptance: diagnostics can be copied, and the copied text matches visible fields without sensitive data.

### 12-jobs-drawer-with-terminal-and-running.png

Current role: Jobs drawer with failed/running terminal job examples.

Requirements:

- Redesign Jobs as a native task center with compact job cards.
- Failed jobs must show a concise error title, message, failed item, and recovery action.
- Running jobs must show determinate progress, current file, speed, remaining time, and Cancel/Pause when available.
- Completed jobs must show output summary and Reveal/Open action where possible.
- Avoid raw metric grids as the first thing users see.
- Acceptance: a failed job can be understood and dismissed/retried without reading raw event data.

### 13-extract-empty-context-menu.png

Current role: Context menu on empty Extract surface.

Requirements:

- Empty context menu should appear near pointer and include Open Archive, Paste Path/Open Recent if supported.
- It should not look like a floating web card.
- Empty state, toolbar, and context menu must all trigger the same open flow.
- Acceptance: right-click empty Extract, choose Open Archive, and native picker opens in desktop runtime.

### 14-extract-archive-details.png

Current role: Archive loaded; details pane shows archive summary.

Requirements:

- Details pane should look like a Windows Details/Properties panel.
- Labels and values must align consistently, with copy on value context menu.
- Long paths should wrap or middle-truncate predictably.
- Folder/root selection in tree must update details.
- Acceptance: details remain readable at normal and compact widths.

### 15-column-context-menu.png

Current role: Column customization context menu.

Requirements:

- Column menu should include Sort Ascending/Descending when relevant.
- Move, width, visibility, and reset commands must be grouped and disabled only with clear state.
- Checked columns must be visually clear and keyboard accessible.
- Menu should fit viewport or scroll internally.
- Acceptance: keyboard can open menu, toggle a column, and restore defaults.

### 16-multi-selection-details.png

Current role: Multi-select archive entries.

Requirements:

- Multi-selection details should prioritize actions and summary: Extract Selected, Test Selected, Properties.
- Status bar and details pane counts must match.
- Selection must support Ctrl, Shift, Select All, invert selection, and clear selection.
- Acceptance: selecting multiple folders/files updates toolbar enabled states and context menu commands immediately.

### 17-multi-selection-info-dialog.png

Current role: Archive Info dialog opened while multiple entries are selected.

Requirements:

- Info command must clarify whether it shows archive properties or selected-entry properties.
- For multi-selection, dialog title should be "Selection Properties" if it describes selected entries.
- Archive-level Info should remain available as a separate command.
- Acceptance: selected-entry info and archive info cannot be confused.

### 18-image-entry-details.png

Current role: Image entry selected.

Requirements:

- Image entries should use native image icons or thumbnails only when cheap/safe.
- Details should include type, path, size, packed size, modified, ratio, and preview action if supported.
- Double-click behavior must be defined: preview inside app or open/extract to temp and open externally.
- Acceptance: selecting an image exposes one obvious view/preview/open action.

### 19-image-entry-info-dialog.png

Current role: Entry Info dialog for image file.

Requirements:

- Entry Info should use the same property layout as details pane.
- Add Copy Path and Copy Details actions if useful.
- Dialog should not duplicate both header Close and footer Close unless that is a deliberate native pattern.
- Acceptance: values align and wrap correctly; Escape closes; Close returns focus to the source row.

### 20-search-empty-results.png

Current role: Search with no matching entries.

Requirements:

- Search results should preserve the table shell and show a no-results row.
- Provide a clear search-clear button and count: `0 results`.
- Details pane should either retain current selection with "not visible in current search" or clear selection predictably.
- Acceptance: clearing search restores rows, selection, details, and status consistently.

### 21-compact-compress-empty.png

Current role: Compact Compress empty.

Requirements:

- Compact layout must not clip empty-state copy behind the options pane.
- At widths near 1000px, details/options pane should collapse, become tabbed, or move below intentionally.
- Primary work table should keep enough width for meaningful file names.
- Acceptance: no instruction text is partially hidden, and Add Sources/Create Archive remain reachable.

### 22-compact-compress-with-sources.png

Current role: Compact Compress with staged sources/planning.

Requirements:

- Planning/loading state must show progress or a short native busy indicator, not just centered text.
- Source rows should remain visible once planning completes.
- Options should not hide the staged source list.
- Acceptance: compact users can still verify sources before creating.

### 23-compact-extract-loaded.png

Current role: Compact Extract loaded archive.

Requirements:

- Compact Extract should preserve archive browsing first; details can move below or collapse.
- Search, path, and table controls must remain aligned.
- Tree pane should become a collapsible folder strip or hidden side pane with a toggle.
- Acceptance: at 1000x700, user can browse, select, search, and extract without horizontal scrolling.

### 24-compact-preferences-dialog.png

Current role: Options dialog at compact viewport.

Requirements:

- Preferences must avoid clipped lower content behind the footer.
- Category navigation or tabs should replace one long form.
- Footer must remain fixed, and content must scroll inside the dialog body.
- Acceptance: every visible setting is fully readable and reachable by keyboard at compact size.

### 25-compress-drop-overlay.png

Current role: Compress drop overlay.

Requirements:

- Drop overlay must look like a Windows drop target, not a washed-out modal.
- The overlay copy must state the exact action: "Add sources to archive."
- The full-window outline should stay within the app bounds and not cover status controls awkwardly.
- Acceptance: dragging files into Compress clearly communicates Add, Copy, or blocked state.

### 26-create-source-context-menu.png

Current role: Old Add to Archive modal with source context menu.

Requirements:

- Retire or restyle this old modal to match the canonical create workflow.
- Source context menu must work in the in-window source list if modal is removed.
- Source list must support Remove, Reveal in File Explorer, Clear All, and keyboard Delete.
- OK/Help disabled footer pattern should be removed unless Help is implemented.
- Acceptance: no user-facing create state uses an older visual system.

### 27-create-dialog-advanced-options.png

Current role: Compress with advanced create options open in right rail.

Requirements:

- Advanced options should be grouped by format capability and hidden when unsupported.
- Password fields must not remain visible after changing to an unsupported format.
- Show Password must default off and never persist.
- Plan summary should show validation status and refresh/progress.
- Acceptance: changing format updates visible controls, disabled states, and destination extension immediately.

### 28-extract-drop-overlay.png

Current role: Extract drop overlay requiring mode choice.

Requirements:

- Mixed/ambiguous drops must offer explicit action buttons, not only explanatory text.
- Overlay should include Open Archive and Add to Compress choices when both are possible.
- The selected target mode must be reachable by keyboard.
- Acceptance: dropping mixed files produces a deterministic chooser with keyboard and pointer support.

### 29-jobs-drawer-empty.png

Current role: Empty Jobs drawer.

Requirements:

- Empty Jobs should be a compact task-center state, not a large blank lower panel.
- It should explain what appears there and offer no fake actions.
- Drawer height should be proportional to content when empty.
- Acceptance: opening Jobs with no jobs does not obscure most of the workspace.

### 30-preferences-custom-output.png

Current role: Preferences with custom output path.

Requirements:

- Custom path row must use native folder picker behavior.
- Long paths must middle-truncate in the input when unfocused and be editable when focused.
- Validation should indicate missing/inaccessible paths.
- Acceptance: Save is disabled or warns when the custom output folder is invalid.

### 31-flat-view-with-icons.png

Current role: Flat archive view with file icons and secondary row paths.

Requirements:

- Flat view should visually distinguish filename from containing path.
- The view toggle should be visible and stateful in toolbar/menu.
- Row height may grow only by design, not from icon/image sizing accidents.
- Acceptance: flat view supports sort, selection, context menu, and details consistently with folder view.

### 32-min-compress-empty.png

Current role: Minimum-size Compress empty.

Requirements:

- Minimum-size layout must become an intentional single-column utility layout.
- Options must be collapsed by default, not fully expanded below an empty table.
- Destination and action buttons must fit without awkward full-width disabled bars unless that is a deliberate command-bar pattern.
- Acceptance: at 760x540, the primary next action is visible and no major section feels cut off.

### 33-min-compress-long-sources.png

Current role: Minimum-size Compress with long destination/source names.

Requirements:

- Long archive names must middle-truncate in display while preserving editable full text on focus.
- Clear and Create controls should align as commands, not isolated text in the row.
- Planning state must not hide the staged source list indefinitely.
- Acceptance: long paths do not push controls out of alignment and remain inspectable.

### 34-min-create-dialog.png

Current role: Minimum-size create-ready state.

Requirements:

- Same as 33, but with create validation visible.
- If Create Archive is disabled, the reason must be available via status text or tooltip.
- Options should collapse below a "Create options" disclosure.
- Acceptance: minimum-size user can determine why Create is disabled.

### 35-min-extract-loaded.png

Current role: Minimum-size Extract loaded archive.

Requirements:

- Folder pane, table, and details must reflow as intentional stacked regions.
- Details should have a collapsible header; table should remain the primary region.
- Toolbar commands should collapse into an overflow menu if space is tight.
- Acceptance: at 760x540, table headers, rows, details, and Jobs button remain usable without visual crowding.

### 36-min-extract-dialog.png

Current role: Minimum-size Extract Selected dialog.

Requirements:

- Dialog must fit minimum window height without hiding password/footer controls.
- Footer must remain fixed; body scrolls internally.
- Optional fields should collapse under Advanced at minimum size.
- Acceptance: destination, path mode, overwrite policy, primary action, and Cancel are visible without page-level scroll.

## Implementation Slices

### Slice 1: Native Shell Model

- Convert toolbar/mode/header behavior into a Windows command-bar model.
- Define command groups, overflow behavior, shortcut labels, tooltips, and disabled reasons.
- Add tests for command enabled states.

### Slice 2: Canonical Create Workflow

- Remove duplicate create modal or fully restyle it behind the same component model.
- Make in-window Compress the canonical flow.
- Add source-list keyboard/context behavior.

### Slice 3: Native Dialog System

- Build shared dialog layout primitives for task dialogs and property dialogs.
- Enforce focus trap, Escape, Enter/default button, fixed footer, internal scroll.
- Replace Options/About/Info/Extract/Create modal styling with shared primitives.

### Slice 4: File Table And Details Polish

- Make archive/source tables match Explorer-like file list behavior.
- Add copyable details values, consistent label/value alignment, and selected-row action summaries.
- Strengthen column menu behavior and keyboard access.

### Slice 5: Responsive Windows Layout

- Define intentional layouts for 1280x800, 1000x700, and 760x540.
- Collapse panes and command groups intentionally.
- Update visual scan to fail on partially hidden instruction text, not only element overflow.

### Slice 6: Native Runtime Behavior

- Verify Tauri runtime behavior for native file dialogs, shell icons, drag-out, reveal in File Explorer, keyboard shortcuts, and window focus return.
- Keep browser-preview fallbacks visibly distinct from release UI.

## Acceptance Gates

- `npm.cmd run test:frontend`
- `npm.cmd run build`
- `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts`
- Manual Windows Tauri smoke:
  - Open archive with picker and Ctrl+O.
  - Drop archive into Extract.
  - Drop files/folders into Compress.
  - Right-click rows, empty surfaces, source rows, and column headers.
  - Resize panes and window down to 760x540.
  - Test keyboard navigation, Shift+F10, Escape, Enter, Tab, Space, Ctrl+A.
  - Verify native folder/file pickers, shell icons, Reveal in File Explorer, and drag-out behavior.

## Evidence Limits

These requirements are based on browser-preview screenshots plus the Playwright visual scan. They are enough to identify visual, layout, and flow requirements, but they do not prove real Windows shell behavior. Native file dialogs, system icons, drag-out, Explorer integration, focus return, and assistive-technology behavior still require a real Tauri Windows smoke pass.
