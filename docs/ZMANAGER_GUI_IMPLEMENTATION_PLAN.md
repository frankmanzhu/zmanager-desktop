# 7-Zip File Manager-Style ZManager GUI Implementation Plan

## Purpose

This plan turns `docs/ZMANAGER_GUI_DETAILED_REQUIREMENTS.md` into self-contained implementation milestones for the ZManager desktop app. Each milestone should leave the app in a runnable, demonstrably better state. The implementor should be able to complete, verify, and review each milestone independently before starting the next one.

The target result is a dense classic ZManager GUI modeled closely on 7-Zip File Manager: menu bar, toolbar, path bar, details table, status bar, operation dialogs, progress/job UI, and drag/drop behavior. The product name shown to users remains `ZManager`; avoid introducing generic placeholder app names in window titles, dialog titles, About labels, or diagnostics product names.

When the GUI requirements or this plan are ambiguous, use the local 7-Zip source tree at `C:\Users\frankzhu\Projects\7z2601-src` as a UX and behavior reference for 7-Zip File Manager-like desktop interactions. Treat that source as a reference only: do not copy 7-Zip code into this repository, do not add 7-Zip as an app dependency, and do not reimplement archive engine behavior in TypeScript.

## Implementation Rules

- Keep archive behavior behind the existing command layer. The UI may format, filter, sort, select, and display data, but must not parse or extract archives itself.
- Keep UI text, command labels, shortcuts, column labels, option labels, and default values in named constants or owned modules.
- Make disabled and unsupported commands visible when they are part of the classic layout, but do not wire them to partial behavior.
- Keep each milestone small enough to verify manually and, where practical, with automated tests.
- Do not persist passwords or temporary extracted contents.
- Prefer table-first desktop ergonomics over card-heavy layouts.
- Keep user-visible app naming as `ZManager`. Generic phrases like "archive", "archive entry", and "archive manager workflow" are fine, but product chrome should say `ZManager`.

## Native Platform Ownership Rules

Native behavior must be split by platform as soon as platform-specific behavior appears. Shared archive core behavior and GUI logic should stay in the current shared framework when it remains clean and maintainable; split only the native pieces that cannot be implemented cleanly through shared abstractions. Do not hide Windows/Linux differences in random frontend call sites.

- Keep shared frontend code platform-neutral. It may call owned abstractions such as `desktop/runtime.ts`, Tauri command DTOs, or command-state helpers, and it may own common GUI state, reducers, command mapping, table formatting, filtering, sorting, selection, and job presentation.
- Keep shared Rust command contracts platform-neutral where practical. DTOs should use normalized strings and explicit fields rather than platform-shaped ad hoc payloads.
- Keep Windows-specific native behavior under Windows-owned modules and packaging:
  - `src-tauri/src/platform/windows.rs`
  - `packaging/windows/`
  - Windows file picker filters, system opener behavior, drag/drop path handling, long-path and separator edge cases, Explorer integration, and installer/shell integration.
- Keep Linux-specific native behavior under Linux-owned modules and packaging:
  - `src-tauri/src/platform/linux.rs`
  - `packaging/linux/`
  - Linux file picker behavior, system opener behavior, drag/drop URI/file-manager formats, symlink-heavy paths, MIME, `.desktop`, service menus, and desktop/file-manager integration.
- If a milestone touches native file dialogs, system open/reveal, drag/drop, shell integration, file associations, installer behavior, temp cleanup, or OS path semantics, include a Windows path and a Linux path in that milestone's implementation and verification notes.
- Platform-specific fixes must not regress the other platform. Add shared command-boundary tests for platform-neutral DTO behavior and platform-owned smoke notes for OS behavior.

## Milestone 1: Static Classic Shell

### Goal

Create the visible application shell with no archive behavior required yet.

### Scope

- Main window vertical layout:
  - menu bar
  - toolbar
  - path/navigation bar
  - browser area
  - status bar
- Classic visual style:
  - compact system font
  - gray chrome
  - white table area
  - thin separators
  - rectangular controls
- Window title behavior for empty state: `ZManager`.

### Implementation Tasks

- Add layout constants for region heights, minimum window dimensions, pane widths, and status bar parts.
- Add centralized menu/toolbar command definitions with label, shortcut, tooltip, enabled state, and command id.
- Render the menu bar with File, Edit, View, Favorites, Tools, and Help.
- Render toolbar groups:
  - Add, Extract, Test
  - Copy, Move, Delete, Info
- Render path bar with Up button, path field, search field, and Flat toggle.
- Render browser area with placeholder table.
- Render four-part status bar.

### Verification

- Launching the app shows all five main regions in order.
- The toolbar button order is Add, Extract, Test, Copy, Move, Delete, Info.
- The menu bar contains all top-level menu names.
- Product chrome and default window title consistently show `ZManager`.
- Empty table text is `Open or create an archive to begin.`
- Status bar shows `0 / 0 object(s) selected` or equivalent empty state.
- Window remains usable at 720x480.

### Suggested Tests

- Snapshot or DOM test for presence/order of main regions.
- DOM test for toolbar command order.
- DOM test for top-level menu labels.

## Milestone 2: Menu And Command State Model

### Goal

Make the classic command surface consistent and state-driven, even before all commands are implemented.

### Scope

- Full menu contents from the requirements.
- Disabled/enabled state based on app context.
- Shortcut metadata.
- Unsupported-operation handling.

### Implementation Tasks

- Define command ids for every visible menu and toolbar command.
- Implement a command state selector that derives enabled/disabled state from:
  - no archive open
  - archive loaded
  - row focused
  - one row selected
  - multiple rows selected
  - mutable operation supported
  - job running
- Populate File, Edit, View, Favorites, Tools, and Help menus with required items.
- Name Help/About items with the product name, for example `About ZManager...`.
- Add CRC submenu items as disabled or post-MVP if backend support is missing.
- Add visible disabled mutation commands for Rename, Move, Delete, Comment, Create Folder, and Create File when not supported.
- Route unsupported enabled commands to a single user-facing message: `Operation is not supported.`

### Verification

- With no archive open, Open/Add/New-style commands are enabled and Extract/Test/Info are disabled.
- With a loaded archive and no selection, Test and Info are enabled.
- With selected rows, Extract/Copy/Info/View are enabled.
- Mutation commands are visible but disabled unless explicitly supported.
- Menu labels and shortcuts match the detailed requirement document, with product-name labels consistently using `ZManager`.

### Suggested Tests

- Unit tests for command state selector.
- DOM tests for menu item visibility and disabled states across fixture app states.

## Milestone 3: Archive Table Baseline âœ…

### Goal

Implement the details table as the primary archive browser surface.

### Scope

- Default columns.
- Empty/loading/error/password states.
- Row rendering.
- Basic icons.
- Size/date formatting.

### Implementation Tasks

- Define table column metadata:
  - Name
  - Size
  - Packed Size
  - Modified
  - Created
  - Accessed
  - Attributes
  - Encrypted
  - Method
  - CRC
  - Block
  - Comment
- Make Name, Size, Packed Size, and Modified visible by default.
- Implement value formatters:
  - compact human-readable size
  - blank unknown values
  - local date/time
  - uppercase checksum strings
  - boolean marker display
- Render small icons for file, folder, archive, symlink/hardlink/special when known.
- Render table states:
  - no archive
  - loading
  - empty
  - error
  - password required
  - loaded

### Verification

- A fixture archive listing renders rows in a details table.
- Default visible headers are Name, Size, Packed Size, and Modified.
- Unknown size/date values are blank, not `0`, `null`, or `undefined`.
- Size values are right aligned.
- Date values are left aligned.
- No archive/loading/empty/error states each show one full-width table row.

### Suggested Tests

- Formatter unit tests for size/date/ratio/unknown values.
- DOM tests for default headers.
- DOM tests for empty/loading/error state rows.

## Milestone 4: Sorting, Selection, And Status Bar ✅

### Goal

Make table interaction feel like a classic file manager.

### Scope

- Column sorting.
- Multi-select.
- Select/deselect/invert.
- Focused row.
- Status bar updates.

### Implementation Tasks

- Implement sort state with default `Name` ascending.
- Implement column header click sorting and sort direction toggle.
- Implement numeric/date sorting by raw value, not rendered text.
- Implement row focus.
- Implement selection behaviors:
  - click selects one row
  - Ctrl+click toggles
  - Shift+click range selects
  - Ctrl+A selects visible rows except parent folder row
  - clear selection
  - invert selection
- Wire Edit menu commands to selection actions.
- Implement status bar parts:
  - `{selected} / {total} object(s) selected`
  - selected size
  - focused item size
  - focused item modified date

### Verification

- Clicking Size sorts numerically.
- Clicking Modified sorts chronologically.
- Ctrl+A selects all visible entries except `..`.
- Invert Selection flips all visible selectable rows.
- Status bar updates after selection and focus changes.
- Focused item size/date fields match the focused row.

### Suggested Tests

- Unit tests for sort comparators.
- Unit tests for selection reducer/state machine.
- DOM tests for status bar values after fixture interactions.

## Milestone 5: Archive Opening And Listing Integration ✅

### Goal

Connect the shell to real archive listing behavior through the command layer.

### Scope

- Open archive via file picker.
- Load listing into table.
- Refresh listing.
- Password-required retry path.
- Window title update.

### Implementation Tasks

- Wire Open command to native file picker through a platform-owned abstraction:
  - Windows file picker behavior belongs to the Windows platform module.
  - Linux file picker behavior belongs to the Linux platform module.
  - The frontend calls only the shared abstraction.
- Call list archive command with selected path.
- Map listing DTOs into table row model.
- Display archive path in path bar.
- Update window title to `{archive file name} - ZManager`.
- Implement Refresh command.
- Handle normalized errors.
- Handle password-required and invalid-password states with transient password prompt.
- Ensure password is not persisted in app state, URL, local storage, logs, or recent paths.

### Verification

- Opening a valid archive displays entries.
- Refresh reloads entries without losing table structure.
- Opening a password-protected archive shows a password prompt.
- Entering a wrong password shows invalid-password message and allows retry.
- Window title changes after opening an archive.
- Windows and Linux native file picker handling are split into platform-owned modules when behavior differs.
- No password value appears in persisted storage or console diagnostics.

### Suggested Tests

- Integration test with fixture archive.
- UI test for password-required flow using mocked command responses.
- Unit test for archive path/title formatting.

## Milestone 6: Folder Navigation And Flat View ✅

### Goal

Support browsing inside archive folder hierarchy and flattened archive view.

### Scope

- Parent folder row.
- Enter/double-click navigation.
- Backspace and root navigation.
- Path bar updates.
- Flat view toggle.
- Search/filter.

### Implementation Tasks

- Build archive tree from listing paths.
- Render current folder entries in normal mode.
- Show `..` parent row when not at root and setting is enabled.
- Implement Enter/double-click:
  - folder enters folder
  - file previews or opens action
  - archive-like entry opens inside only when supported
- Implement Backspace to parent folder.
- Implement Backslash/Open Root to root.
- Update path display for current archive path.
- Implement Flat view to show all nested entries with full relative paths.
- Implement search/filter field over visible rows.
- Preserve selection/focus when refresh can match row paths.

### Verification

- Opening a fixture with nested folders shows top-level folders first.
- Double-clicking a folder enters it.
- `..` row appears inside subfolders.
- Backspace returns to parent.
- Root command returns to archive root.
- Flat view shows nested files in one list.
- Search filters visible rows and status bar total follows visible row count.

### Suggested Tests

- Unit tests for archive tree builder.
- Unit tests for current-folder row derivation.
- UI tests for folder navigation and flat toggle.

## Milestone 7: Details Pane And Properties ✅

### Goal

Show useful archive and selection metadata without leaving the main window.

### Scope

- No-selection archive summary.
- Single-selection details.
- Multiple-selection aggregate.
- Properties command/dialog.

### Implementation Tasks

- Implement details pane layout or collapsible right pane.
- Show no-selection archive details:
  - archive name
  - full path
  - format/type if known
  - entry count
  - total unpacked size if known
  - packed/physical size if known
  - last test status if any
- Show single-selection details:
  - name, path, kind/type
  - size, packed size
  - modified/created
  - attributes/mode
  - method
  - CRC/checksum
  - encrypted/solid flags
  - link target if known
- Show multiple-selection details:
  - selected count
  - file/folder counts
  - total selected size
  - truncated path preview
- Wire Info/Properties command to details pane focus or a modal properties dialog.

### Verification

- No selection shows archive summary.
- Selecting one row updates details with that row data.
- Selecting multiple rows shows aggregate count and size.
- Info toolbar/menu opens or focuses the details view.
- Unknown fields are omitted or blank, not rendered as raw nullish values.

### Suggested Tests

- Unit tests for aggregate selection details.
- DOM tests for no/single/multiple selection details.

## Milestone 8: Extract Dialog And Extract Jobs ✅

### Goal

Provide a complete classic Extract workflow.

### Scope

- Extract dialog.
- Whole archive extraction.
- Selected entries extraction.
- Overwrite mode.
- Password field.
- Job creation/progress.

### Implementation Tasks

- Implement Extract dialog with:
  - destination editable combo
  - browse button
  - optional subfolder field
  - path mode or strip-components equivalent
  - eliminate duplicated root folder option
  - overwrite mode
  - password input
  - show password toggle
  - restore file security when supported
  - OK, Cancel, Help
- Route destination browsing through platform-owned native paths when behavior differs:
  - Windows folder picker behavior belongs to the Windows platform module.
  - Linux folder picker behavior belongs to the Linux platform module.
- Wire toolbar/menu/F5 extraction commands.
- For no selection, default to whole archive extraction.
- For selection, pass selected entry paths.
- Start extract through command layer.
- Create job entry immediately after start.
- Poll job events and update status bar/job UI.
- Handle cancellation.
- Keep destination history.

### Verification

- Extract button opens dialog with correct fields.
- Destination is required.
- Browse button fills destination.
- Show Password toggles password visibility.
- Starting extraction creates a visible running job.
- Selected-entry extraction passes only selected paths.
- Whole-archive extraction works with no selected rows.
- Windows and Linux destination picker behavior are verified through platform-owned paths where native behavior differs.
- Cancel requests job cancellation and updates UI state.

### Suggested Tests

- DOM test for extract dialog controls.
- Unit test for extract request mapping.
- UI test with mocked job lifecycle.

## Milestone 9: Progress Dialog Or Job Drawer ✅

### Goal

Expose classic progress information for all long operations.

### Scope

- Job list/drawer or progress dialog.
- Progress fields.
- Messages list.
- Background/cancel behavior.

### Implementation Tasks

- Implement a job model that stores:
  - id
  - kind
  - status
  - created time
  - current file
  - processed bytes
  - total bytes
  - processed files
  - errors
  - warnings/messages
  - terminal summary
- Render required progress fields:
  - Elapsed time
  - Remaining time
  - Files
  - Errors
  - Total size
  - Speed
  - Processed
  - Compressed size
  - Compression ratio
  - Status
  - File name
  - Progress bar
  - Messages list
- Implement Background action if using modal progress.
- Implement Cancel.
- Keep completed/failed jobs visible until dismissed.

### Verification

- Running jobs display all required labels.
- Determinate progress is used when total bytes are known.
- Indeterminate progress is used when total bytes are unknown.
- Warnings/errors appear in messages list.
- Completed job shows terminal summary.
- Failed job shows error/hint.
- Dismiss removes completed/failed job from visible list.

### Suggested Tests

- Unit tests for job event reducer.
- DOM tests for running/completed/failed/cancelled jobs.

## Milestone 10: Add/Create Archive Dialog

### Goal

Implement a classic Add to Archive flow for creating archives from files/folders.

### Scope

- Add/Create dialog UI.
- Source list.
- Native file/folder picker.
- Format/options/encryption fields.
- Create plan preview if available.
- Start create job.

### Implementation Tasks

- Implement Add to Archive dialog with:
  - archive path editable combo
  - save browse button
  - source list/table
  - add source button
  - remove source button
  - archive format
  - compression level
  - compression method when supported
  - dictionary size when supported
  - word size when supported
  - solid block size when supported
  - CPU threads when supported
  - split volume size
  - update mode when supported
  - path mode
  - options group
  - encryption group
  - OK/Create, Cancel, Help
- Route source picker and save-dialog behavior through platform-owned native paths:
  - Windows file/folder/save behavior belongs to the Windows platform module.
  - Linux file/folder/save behavior belongs to the Linux platform module.
  - The frontend receives normalized selected paths through the shared abstraction.
- Support dropping files/folders onto the dialog source list.
- Validate archive path and at least one source.
- Validate password confirmation.
- Call plan-create when available and show included/excluded counts, bytes, and warnings.
- Start create through command layer.
- Add create job to job UI.
- Keep create destination/source history where safe.

### Verification

- Add toolbar/menu opens Add to Archive dialog.
- Source picker adds files/folders.
- Windows and Linux picker/save behavior are verified through platform-owned paths where native behavior differs.
- Dragging files/folders into dialog adds sources.
- Remove source removes selected source rows.
- Password mismatch blocks Create with visible message.
- Create with valid inputs starts a visible job.
- Plan summary displays counts/warnings when backend returns them.

### Suggested Tests

- DOM tests for create dialog controls.
- Unit tests for create request mapping and validation.
- UI test for drag source list using mocked file paths where possible.

## Milestone 11: Test Archive And Preview/View ✅

### Goal

Implement non-extract inspection commands.

### Scope

- Test archive.
- Preview selected file.
- Open outside selected file.
- Temporary preview cleanup.

### Implementation Tasks

- Wire Test toolbar/menu command to command layer.
- Show test as a job with progress/messages.
- Implement Preview/View command for exactly one selected file row.
- If no row or multiple rows selected, show `You must select one file.`
- Use temporary extraction command for preview.
- Open preview path with the platform-owned system opener:
  - Windows system opener behavior belongs to the Windows platform module.
  - Linux system opener behavior belongs to the Linux platform module.
- Track cleanup root returned by preview command.
- Add Delete Temporary Files command for cleanup view/action.
- Implement Open Outside through the same platform-owned system opener when a real path or preview path is available.

### Verification

- Test command starts a job and displays result.
- Preview with one file opens a temporary preview path.
- Preview with no selection or multiple selection shows a clear message.
- Temporary preview roots are tracked.
- Delete Temporary Files command can clean tracked preview roots.
- Windows and Linux Open Outside behavior are split and verified through platform-owned opener paths.

### Suggested Tests

- Unit tests for preview command eligibility.
- UI test for test job mocked lifecycle.
- Unit test for temp cleanup registry/state.

## Milestone 12: Context Menus And Header Column Chooser âœ…

### Goal

Match classic right-click workflows.

### Scope

- Row context menu.
- Header context menu.
- Column visibility persistence.

### Implementation Tasks

- Implement table row context menu with:
  - Open
  - Open Inside
  - Open Outside
  - View
  - Extract...
  - Test
  - Copy To...
  - Properties
  - Select by Type
  - Deselect by Type
  - supported mutation items where applicable
- Implement table header context menu:
  - all available columns with checkmarks
  - Name always checked and disabled
  - Reset columns
- Implement column visibility updates.
- Persist column order, width, visibility, and sort state.

### Verification

- Right-click row opens row context menu.
- Disabled mutation items are unavailable.
- Right-click header opens column menu.
- Toggling Packed Size hides/shows the column.
- Name cannot be hidden.
- Reset columns restores default visible columns.
- Column settings survive app reload.

### Suggested Tests

- DOM tests for context menu contents.
- Unit tests for column settings reducer.
- Persistence test for column settings.

## Milestone 13: Drag/Drop On Main Window ✅

### Goal

Make drag/drop a first-class main-window workflow.

### Scope

- Drop archive to open.
- Drop files/folders to create flow.
- Ambiguous drop choices.
- Windows/Linux drop payload normalization.

### Implementation Tasks

- Add drop target to main workspace.
- Normalize native drop payloads in platform-owned code before the frontend classifies the drop:
  - Windows handles file-system paths and Explorer-originated drops in the Windows platform module.
  - Linux handles file paths, file-manager URI formats, and symlink-heavy drops in the Linux platform module.
- Detect dropped archive files by extension/capability after platform normalization.
- Opening a single dropped archive loads listing.
- Dropping multiple archive files opens the first and shows a non-blocking note or choice for the rest.
- Dropping files/folders with no archive open opens Add to Archive dialog with sources preloaded.
- Dropping files/folders over an open archive shows a choice:
  - Add to current archive, only if supported
  - Create new archive
  - Cancel
- Ensure drag-over visual state is clear but subtle.

### Verification

- Dropping an archive opens it.
- Dropping a folder opens Add to Archive dialog with that folder as a source.
- Dropping files while an archive is open shows a choice instead of guessing.
- Unsupported drops show a clear message and do not change current archive state.
- Windows and Linux drop payload differences are covered by platform-owned smoke notes or tests.

### Suggested Tests

- Unit tests for drop classification.
- UI test for drop state using mocked file paths if environment supports it.

## Milestone 14: Options And Safe Persistence ✅

### Goal

Persist safe classic preferences and expose them in an Options dialog.

### Scope

- Options pages.
- Safe preference storage.
- Apply settings to UI.
- Platform-owned options for shell/file associations.

### Implementation Tasks

- Implement Options dialog with pages:
  - System
  - Menu/Shell integration
  - Folders
  - Settings
  - Language, optional
- Keep platform-owned settings split:
  - Windows association and Explorer/menu integration settings belong to the Windows module and Windows packaging.
  - Linux MIME, `.desktop`, service menu, and file-manager integration settings belong to the Linux module and Linux packaging.
- Implement settings:
  - Show `..` item
  - Show real file icons
  - Full row select
  - Show grid lines
  - Single-click to open
  - Alternative selection mode
  - toolbar visibility
  - large toolbar buttons
  - show toolbar labels
  - working folder preference
  - max memory limit if supported
- Persist:
  - window geometry
  - toolbar settings
  - list view mode
  - flat view
  - folder/recent histories
  - safe dialog defaults
- Exclude passwords and temp content from persistence.

### Verification

- Changing Show grid lines updates table style.
- Changing Show `..` item affects subfolder display.
- Toolbar label/large button preferences update toolbar.
- Closing/reopening app preserves safe preferences.
- Windows/Linux shell integration settings are shown only through platform-owned capability data.
- Search of persisted preference data shows no password values after password workflows.

### Suggested Tests

- Unit tests for preference serialization allowlist.
- UI tests for applying table/toolbar settings.
- Persistence test for safe preferences.

## Milestone 15: Keyboard Shortcuts And Accessibility Pass ✅

### Goal

Make the app efficient for keyboard-heavy users and usable with assistive tech.

### Scope

- Required shortcut bindings.
- Focus order.
- ARIA labels.
- Visible focus.
- Menu keyboard behavior.

### Implementation Tasks

- Implement required shortcuts from the GUI requirements.
- Ensure shortcuts respect text-field focus where appropriate.
- Add visible focus outlines for menu items, toolbar buttons, path field, table, dialogs, and context menu items.
- Ensure dialogs trap focus while open and restore focus on close.
- Add accessible names to icon buttons.
- Add table semantics for headers, rows, and selected state.
- Ensure disabled controls expose disabled state.
- Ensure status/job updates use polite live regions only where useful.

### Verification

- Keyboard-only user can open archive, navigate rows, select all, extract, and close dialog.
- Backspace, Enter, F3, F5, Ctrl+A, Ctrl+R, and Alt+Enter work.
- Focus does not get lost after closing dialogs.
- Tab order follows visual order.
- Screen reader labels exist for toolbar buttons and fields.

### Suggested Tests

- UI tests for shortcut dispatch.
- Accessibility lint if available.
- Manual keyboard-only smoke test.

## Milestone 16: Polish, Responsiveness, And Shared Release Readiness ✅

### Goal

Bring the shared GUI from functionally complete to release-candidate quality before platform-specific validation.

### Scope

- Layout QA.
- Responsive minimum-size behavior.
- Error polish.
- Performance on large listings.
- Shared smoke checks that do not require platform-owned native integration.

### Implementation Tasks

- Verify layouts at:
  - 720x480
  - 960x640
  - 1280x800
  - high-DPI scaling
- Ensure table handles large listings without blocking interaction.
- Add virtualization if needed for large archives.
- Audit all user-facing text for consistency and confirm product naming is `ZManager`.
- Audit all disabled/unsupported commands.
- Audit password handling.
- Audit temporary preview cleanup.
- Confirm all native behavior discovered during shared polish has an explicit Windows or Linux owner before proceeding to platform release readiness.
- Add screenshots to review artifact or QA notes if the workflow supports it.

### Verification

- No incoherent overlap at minimum size.
- Text fits in toolbar, path bar, dialogs, status bar, and table headers.
- Large fixture archive remains responsive.
- Product chrome consistently uses `ZManager`.
- No password appears in logs, persistent storage, diagnostics, or job messages.

### Suggested Tests

- Playwright or equivalent screenshot checks for key viewports.
- Large-listing performance smoke test.
- Shared release-readiness checklist.

## Milestone 17: Windows Platform Release Readiness

### Goal

Verify the Windows-owned native integration path and fix Windows-only issues without changing Linux behavior.

### Scope

- Windows native file picker behavior.
- Windows system opener behavior.
- Windows drag/drop behavior.
- Windows path and Explorer-adjacent edge cases surfaced by the GUI.

### Implementation Tasks

- Run the desktop shell on Windows.
- Verify Open uses the expected Windows file picker filters and returns usable archive paths.
- Verify Open Outside launches the selected or previewed file through the Windows system opener.
- Verify main-window drag/drop with:
  - a single archive file
  - multiple archive files
  - folders and loose files
  - unsupported dropped items
- Verify Windows paths with spaces, Unicode characters, long paths where supported, and mixed separators are displayed and passed through command DTOs correctly.
- Confirm Windows Explorer integration remains owned by the Windows module if any follow-up work is discovered.
- Record Windows smoke-test notes and screenshots if the workflow supports it.

### Verification

- Opening a valid archive through the Windows file picker displays entries.
- Open Outside works from a selected row or preview path without leaking temporary content after cleanup.
- Dragging a supported archive into the window opens it.
- Dragging files/folders into the window starts the intended create/add choice flow.
- Unsupported drops show a clear message and do not alter the current archive.
- Windows path edge cases do not corrupt displayed paths or command payloads.
- Windows smoke test passes.

### Suggested Tests

- Windows platform smoke-test checklist.
- Manual Windows drag/drop checks.
- Command-boundary tests for Windows path mapping where practical.

## Milestone 18: Linux Platform Release Readiness

### Goal

Verify the Linux-owned native integration path and fix Linux-only issues without changing Windows behavior.

### Scope

- Linux native file picker behavior.
- Linux system opener behavior.
- Linux drag/drop behavior.
- Linux desktop, MIME, and file-manager edge cases surfaced by the GUI.

### Implementation Tasks

- Run the desktop shell on Linux.
- Verify Open uses the expected Linux file picker filters and returns usable archive paths.
- Verify Open Outside launches the selected or previewed file through the Linux system opener.
- Verify main-window drag/drop with:
  - a single archive file
  - multiple archive files
  - folders and loose files
  - unsupported dropped items
- Verify Linux paths with spaces, Unicode characters, symlink-heavy locations, and file-manager URI/drop formats are displayed and passed through command DTOs correctly.
- Confirm Linux desktop, MIME, and file-manager integration remains owned by the Linux module if any follow-up work is discovered.
- Record Linux smoke-test notes and screenshots if the workflow supports it.

### Verification

- Opening a valid archive through the Linux file picker displays entries.
- Open Outside works from a selected row or preview path without leaking temporary content after cleanup.
- Dragging a supported archive into the window opens it.
- Dragging files/folders into the window starts the intended create/add choice flow.
- Unsupported drops show a clear message and do not alter the current archive.
- Linux path and URI/drop edge cases do not corrupt displayed paths or command payloads.
- Linux smoke test passes.

### Suggested Tests

- Linux platform smoke-test checklist.
- Manual Linux drag/drop checks.
- Command-boundary tests for Linux path and file URI mapping where practical.

## Milestone Dependency Map

Recommended order:

1. Static Classic Shell
2. Menu And Command State Model
3. Archive Table Baseline
4. Sorting, Selection, And Status Bar
5. Archive Opening And Listing Integration
6. Folder Navigation And Flat View
7. Details Pane And Properties
8. Extract Dialog And Extract Jobs
9. Progress Dialog Or Job Drawer
10. Add/Create Archive Dialog
11. Test Archive And Preview/View
12. Context Menus And Header Column Chooser
13. Drag/Drop On Main Window
14. Options And Safe Persistence
15. Keyboard Shortcuts And Accessibility Pass
16. Polish, Responsiveness, And Shared Release Readiness
17. Windows Platform Release Readiness
18. Linux Platform Release Readiness

Milestones 7, 10, 12, and 13 can be developed after Milestone 5 in parallel if command state and table row models are stable.
Milestones 17 and 18 can be completed in either order after Milestone 16.

## Definition Of Done For Each Milestone

Each milestone is complete only when:

- The app launches without regressions.
- The milestone verification checklist passes.
- Automated tests listed as suggested tests are added where practical.
- Unsupported functionality is visibly disabled or produces a clear unsupported message.
- No unrelated files or behaviors are changed.
- User-facing strings introduced by the milestone live in named constants or an owned text module.
- Passwords and temporary file contents are not persisted.

## Final Acceptance

The implementation is complete when all milestone verification sections pass and the app satisfies the acceptance checklist in `docs/ZMANAGER_GUI_DETAILED_REQUIREMENTS.md`, applying this plan's explicit naming rule: the user-visible product name is `ZManager`.

