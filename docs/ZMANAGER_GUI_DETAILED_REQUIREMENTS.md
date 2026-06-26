# Classic ZManager GUI Detailed Requirements

## Goal

Build the ZManager desktop GUI so it closely resembles the classic 7-Zip File Manager experience. The interface should feel like a compact desktop file utility: menu bar, toolbar, path bar, details table, optional folder/details panes, status bar, modal operation dialogs, and strong drag/drop support.

This document is an implementation-facing GUI specification. It describes the visible layout, controls, columns, formats, menus, dialogs, states, and interactions expected from the application.

Shared archive engine behavior and common GUI logic should remain shared in the current Rust/Tauri/frontend framework where that stays clean. Native work that cannot be implemented cleanly through shared abstractions must be split into Windows-owned and Linux-owned paths.

## Visual Style

- Overall style: classic Windows desktop utility, dense, calm, functional.
- Primary font: system UI font. On Windows this should visually match Segoe UI at 9-10pt or 12-13px.
- Backgrounds:
  - app chrome: light gray, similar to standard Windows tool windows
  - table/content: white
  - selected row: standard system selection blue or a close equivalent
  - disabled controls: muted gray
- Borders:
  - thin 1px separators between menu, toolbar, path bar, table area, panes, and status bar
  - table header uses standard grid/header styling
- Controls:
  - buttons are compact, rectangular, and plain
  - toolbar buttons use icons above or beside short text labels
  - dialogs use grouped fields, checkboxes, combo boxes, edit fields, and OK/Cancel button rows
- Avoid marketing-page styling, oversized cards, decorative gradients, rounded promotional panels, or hero sections.

## Main Window

### Window Title

- Default title: `ZManager`
- When an archive is open: `{archive file name} - ZManager`
- When browsing inside a folder within an archive: `{archive file name}\{current archive path} - ZManager`
- When a long operation is active, do not replace the title with progress text. Progress belongs in the job/progress UI.

### Overall Layout

The main window must contain these vertical regions in order:

1. Menu bar
2. Main toolbar
3. Path/navigation bar
4. Main browser area
5. Status bar

Recommended desktop sizing:

| Region | Height | Notes |
| --- | ---: | --- |
| Menu bar | 24-28px | Top-level text menus |
| Toolbar | 38-54px | Icon buttons, optional labels |
| Path bar | 30-36px | Up button, path field, search, flat view |
| Browser area | flexible | Main table dominates |
| Status bar | 22-26px | Selection and focused item details |

Default first-launch window:

- Width: 960-1100px
- Height: 620-760px
- Minimum width: 720px
- Minimum height: 480px

The layout must remain usable at the minimum size. At narrow widths, side panes may collapse before the archive table loses basic usability.

## Menu Bar

Menus must be visible at the top of the app, not hidden behind a hamburger button on desktop.

### File Menu

Required items in order:

| Label | Shortcut | Behavior |
| --- | --- | --- |
| Open... | Enter or Ctrl+O | Open selected item or choose archive when no row is selected |
| Open Inside | Ctrl+PageDown | Open selected archive/folder inside the current panel |
| Open Outside | Shift+Enter | Open selected file with system handler or external app |
| View | F3 | Preview selected file entry |
| Edit | F4 | Open selected file for edit only if update-back behavior exists |
| separator |  |  |
| Rename | F2 | Enabled only for mutable filesystem/archive views |
| Copy To... | F5 | Copy/extract selected entries to destination |
| Move To... | F6 | Enabled only for mutable filesystem/archive views |
| Delete | Delete | Enabled only for mutable filesystem/archive views |
| separator |  |  |
| Split file... |  | Post-MVP utility |
| Combine files... |  | Post-MVP utility |
| separator |  |  |
| Properties | Alt+Enter | Show archive or entry properties |
| Comment... | Ctrl+Z | Enabled only if comments are supported |
| CRC | submenu | Hash/checksum commands |
| Diff |  | Post-MVP utility |
| separator |  |  |
| Create Folder | F7 | Enabled only for mutable filesystem views |
| Create File | Ctrl+N | In archive app, may map to New Archive when no filesystem panel exists |
| separator |  |  |
| Exit | Alt+F4 | Close app |

CRC submenu items:

- CRC-32
- CRC-64
- XXH64
- MD5
- SHA-1
- SHA-256
- SHA-384
- SHA-512
- SHA3-256
- BLAKE2sp
- All

### Edit Menu

Required items:

| Label | Shortcut | Behavior |
| --- | --- | --- |
| Select All | Ctrl+A or Shift+Numpad Plus | Select all visible/operable rows |
| Deselect All | Shift+Numpad Minus | Clear selection |
| Invert Selection | Numpad Star | Invert visible row selection |
| Select... | Numpad Plus | Select by pattern/mask |
| Deselect... | Numpad Minus | Deselect by pattern/mask |
| Select by Type | Alt+Numpad Plus | Select rows matching focused row extension/type |
| Deselect by Type | Alt+Numpad Minus | Deselect rows matching focused row extension/type |

### View Menu

Required items:

| Label | Shortcut | Behavior |
| --- | --- | --- |
| Large Icons | Ctrl+1 | Optional view mode |
| Small Icons | Ctrl+2 | Optional view mode |
| List | Ctrl+3 | Optional view mode |
| Details | Ctrl+4 | Default view mode |
| separator |  |  |
| Name | Ctrl+F3 | Sort by name |
| Type | Ctrl+F4 | Sort by extension/type |
| Date | Ctrl+F5 | Sort by modified date |
| Size | Ctrl+F6 | Sort by size |
| Unsorted | Ctrl+F7 | Clear explicit sort when supported |
| separator |  |  |
| Flat View |  | Toggle recursive flattened archive entries |
| 2 Panels | F9 | Toggle dual-pane mode if implemented |
| separator |  |  |
| Toolbars | submenu | Toolbar visibility and style |
| Open Root Folder | Backslash | Go to root |
| Up One Level | Backspace | Go to parent folder |
| Folders History... | Alt+F12 | Show folder/path history |
| Refresh | Ctrl+R | Reload current listing |
| Auto Refresh |  | Enabled only for filesystem browsing |

Toolbars submenu:

- Archive Toolbar
- Standard Toolbar
- Large Buttons
- Show Buttons Text

### Favorites Menu

Required shell:

- Add folder to Favorites as
- separator
- dynamic favorite entries

Favorites may be post-MVP, but the menu location should be reserved if matching the classic layout is important.

### Tools Menu

Required items:

| Label | Behavior |
| --- | --- |
| Options... | Open preferences/options dialog |
| separator |  |
| Benchmark | Optional benchmark utility |
| separator |  |
| Delete Temporary Files... | Cleanup temporary preview/extraction roots |

### Help Menu

Required items:

- Contents... (`F1`)
- separator
- About ZManager...

## Main Toolbar

The main toolbar must be immediately below the menu bar and contain two logical button groups.

### Archive Toolbar Group

These buttons must appear first:

| Button | Icon Meaning | Text Label | Enabled When |
| --- | --- | --- | --- |
| Add | plus/folder/archive | Add | sources can be added or create flow can start |
| Extract | downward arrow/folder | Extract | archive is open or entries are selected |
| Test | checkmark | Test | archive is open |

### Standard Toolbar Group

These buttons follow after a separator:

| Button | Icon Meaning | Text Label | Enabled When |
| --- | --- | --- | --- |
| Copy | two files or arrow | Copy | rows are selected |
| Move | arrow | Move | mutable source/destination exists |
| Delete | X/trash | Delete | mutable rows are selected |
| Info | information symbol | Info | archive or rows are available |

Implementation notes:

- Button labels should be one word.
- Icons should be visually simple and recognizable at 16px, 24px, and optionally 32px.
- Toolbar must support settings for large buttons and show/hide text labels.
- Disabled buttons remain visible but muted.
- Tooltip for each button must include the command and shortcut when applicable, for example `Extract (F5)`.

## Path And Navigation Bar

The path bar sits below the toolbar. It contains:

| Control | Requirement |
| --- | --- |
| Up button | Small icon button, navigates to parent folder |
| Path combo/text field | Shows current filesystem path, archive path, or virtual archive path |
| Path dropdown/history | Shows recent archive paths and visited internal folders |
| Search/filter field | Filters visible rows by substring or pattern |
| Flat view checkbox/toggle | Shows all nested entries in one list |

Path display format:

- Filesystem archive: `C:\Users\me\Downloads\archive.7z`
- Inside archive root: `C:\Users\me\Downloads\archive.7z\`
- Inside archive folder: `C:\Users\me\Downloads\archive.7z\folder\subfolder\`
- Flat view should preserve the archive path and indicate flat mode through the toggle, not by rewriting the path.

The path control should accept typed paths where feasible. Pressing Enter in the path control attempts navigation/opening.

## Main Browser Area

### Single-Pane Mode

Default mode is one main panel:

- Optional left folder/navigation pane: 180-240px wide
- Main archive table: takes most available width
- Optional right details pane: 220-300px wide

If side panes exist, they must not visually dominate the table. They should be collapsible.

### Two-Panel Mode

Two-panel mode is optional but should match classic behavior if implemented:

- Left and right panels separated by a draggable vertical splitter.
- Minimum panel width: 120px.
- One panel is active/focused at a time.
- Tab moves focus between panels.
- F9 toggles one-panel/two-panel mode.
- Copy/Move defaults to the opposite panel as destination.

## Archive Table

The details table is the core of the application and must be the default view.

### Default Columns

Use this baseline column order for archive browsing:

| Order | Column Header | Width | Align | Visible By Default | Value Format |
| ---: | --- | ---: | --- | --- | --- |
| 1 | Name | 160px minimum | left | yes | icon + file/folder name |
| 2 | Size | 100px | right | yes | human-readable bytes, blank for unknown |
| 3 | Packed Size | 100px | right | yes | human-readable bytes, blank for unknown |
| 4 | Modified | 140px | left | yes | local date/time, blank for unknown |
| 5 | Created | 140px | left | optional | local date/time, blank for unknown |
| 6 | Accessed | 140px | left | optional | local date/time, blank for unknown |
| 7 | Attributes | 90px | left | optional | archive/fs attributes string |
| 8 | Encrypted | 80px | center | optional | `+`, `Yes`, or blank |
| 9 | Method | 120px | left | optional | compression method text |
| 10 | CRC | 90px | right | optional | uppercase hex checksum |
| 11 | Block | 70px | right | optional | numeric block index |
| 12 | Comment | 120px | left | optional | comment marker or text |

For a very close 7-Zip-like implementation, support dynamic additional columns exposed by the archive listing layer. Dynamic columns must follow these rules:

- `Name` is always visible and always first.
- Default width is 160px for `Name`, 100px for most other columns.
- Numeric columns are right aligned.
- Date/time columns are left aligned.
- Boolean columns are centered or displayed as blank/marked values.
- Unknown values are blank, not `null`, `undefined`, or `0`.
- Column order, width, visibility, and sort state must persist per view/archive type where practical.

### Common Optional Property Columns

The column chooser/properties model should allow these labels where data exists:

- Path
- Name
- Extension
- Folder
- Size
- Packed Size
- Attributes
- Created
- Accessed
- Modified
- Solid
- Commented
- Encrypted
- Split Before
- Split After
- Dictionary
- CRC
- Type
- Anti
- Method
- Host OS
- File System
- User
- Group
- Block
- Comment
- Position
- Path Prefix
- Folders
- Files
- Version
- Volume
- Multivolume
- Offset
- Links
- Blocks
- Volumes
- Physical Size
- Headers Size
- Checksum
- Mode
- Symbolic Link
- Error
- Alternate Stream
- SHA-1
- SHA-256
- Warnings
- Streams
- Alternate Streams
- Virtual Size
- Unpack Size
- Link
- Hard Link
- iNode

### Name Column

The Name column must:

- show a small file/folder icon before the name
- show `..` as a parent-folder row when not at root, if the setting is enabled
- append or visually mark folders consistently
- use the final path segment in normal folder view
- use full relative archive path in flat view
- sort directories and files consistently; folders should not jump unpredictably during refresh

### Size Formatting

Table size columns:

- Right aligned.
- Use compact human-readable values by default, for example `1 KB`, `25 MB`, `3.4 GB`.
- Do not show `0` for unknown size.
- Exact byte count may be shown in tooltip or properties panel.
- Status/properties text may use exact format such as `{0} bytes`.

### Date Formatting

Date/time columns:

- Left aligned.
- Use local date/time.
- Recommended format: `YYYY-MM-DD HH:mm` or platform short date + short time.
- Unknown date/time must be blank.
- Tooltips may show seconds/time zone if known.

### Ratio Formatting

If a Ratio column is included:

- Display packed/unpacked ratio as a percentage with 0-1 decimal places.
- Blank when size or packed size is unknown.
- For zero-byte files, display blank or `0%` consistently; do not show `NaN`.

### Sorting

Required sorting behavior:

- Clicking a column header sorts by that column.
- Clicking the same column toggles ascending/descending.
- Initial sort is by `Name` ascending.
- Keyboard sort shortcuts:
  - Ctrl+F3: Name
  - Ctrl+F4: Type/Extension
  - Ctrl+F5: Modified
  - Ctrl+F6: Size
  - Ctrl+F7: Unsorted, if supported
- Sort indicators must be visible in the header.
- Numeric sort must sort by numeric value, not formatted string.
- Date sort must sort by timestamp, not displayed text.

### Selection

Required selection behavior:

- Click selects one row.
- Ctrl+click toggles row selection.
- Shift+click extends selection range.
- Ctrl+A selects all visible rows except parent-folder row.
- Select All, Deselect All, Invert Selection commands must operate on visible rows.
- Pattern selection should support simple wildcard masks when implemented, such as `*.txt`.
- Status bar must update after selection changes.

### Row Activation

Required row activation:

- Enter or double-click on folder: enter folder.
- Enter or double-click on archive-like entry: open inside if supported.
- Enter or double-click on file: preview/open action.
- Shift+Enter: open outside with system handler.
- Backspace: go up one level.
- Backslash: go to root.

### Empty And Loading Rows

States:

- No archive: table shows a single full-width row: `Open or create an archive to begin.`
- Loading: table shows a single full-width row: `Loading...`
- Empty archive/folder: table shows a single full-width row: `No items.`
- Error: table shows a single full-width row with error text and retry action nearby.
- Password required: table area should show password prompt or command to enter password.

## Status Bar

The status bar is fixed at the bottom and split into four parts.

| Part | Width | Content |
| --- | ---: | --- |
| Selection count | 220px | `{selected} / {total} object(s) selected` |
| Selection size | 100px | total selected size, blank if none |
| Focused item size | 100px | focused item size, blank if none |
| Focused item modified date | fills rest | focused item modified date/time, blank if none |

Examples:

- `0 / 128 object(s) selected`
- `3 / 128 object(s) selected | 15 MB | 4 MB | 2026-06-26 14:33`

The status bar must update on selection, focus, navigation, refresh, and listing load.

## Details Pane

If present, the details pane should show:

### No Selection

- Archive name
- Archive full path
- Format/type if known
- Entry count
- Total unpacked size if known
- Packed/physical size if known
- Last tested status if any

### Single Selection

- Name
- Path
- Type/kind
- Size
- Packed Size
- Modified
- Created if known
- Attributes/mode if known
- Method if known
- CRC/checksum if known
- Encrypted/Solid flags if known
- Link target for symlink/hardlink if known

### Multiple Selection

- Number selected
- Files selected
- Folders selected
- Total selected size if known
- Selected paths preview, truncated after a reasonable number of rows

## Drag And Drop

### Drop Onto Main Window

Required:

- Dropping a supported archive file opens it.
- Dropping multiple archives should open the first and offer recent/open-list behavior for the rest, or show a choice dialog.
- Dropping files/folders when no archive is open starts the Create/Add dialog with those sources.
- Dropping files/folders when an archive is open offers:
  - Add to current archive, only if update-in-place is supported
  - Create new archive from dropped items
  - Cancel

### Drop Onto Create Dialog

- Dropped files/folders are appended to the source list.
- Duplicate source paths are ignored or de-duplicated visibly.
- Invalid/inaccessible sources show a warning row.

### Drag Out Of Table

If supported:

- Dragging selected entries out to the file manager extracts them to the drop destination.
- Drag cursor must indicate copy, move, or blocked state.
- If destination cannot be resolved safely, open Extract dialog instead.
- Temporary extraction files must be cleaned up after failed/cancelled drag.

### Context Menu During Right-Button Drop

When the platform supports right-button drop, show a compact menu:

- Copy here / Extract here
- Add to archive
- Cancel

Do not perform destructive moves by default.

## Context Menus

### Table Row Context Menu

Required items:

- Open
- Open Inside
- Open Outside
- View
- Extract...
- Test
- Copy To...
- Properties
- separator
- Select by Type
- Deselect by Type

Only show or enable mutation items when supported:

- Rename
- Delete
- Move To...
- Comment...

### Table Header Context Menu

Required:

- list all available columns with checkmarks
- Name column cannot be hidden
- choosing a column toggles visibility
- Reset columns

## Extract Dialog

Title: `Extract`

Required controls in order:

| Control | Type | Requirement |
| --- | --- | --- |
| Extract to | editable combo box | Destination folder, supports recent destinations |
| Browse | button `...` | Opens native folder picker |
| Extract to subfolder | checkbox + text field | Optional archive-name subfolder |
| Path mode | combo box | Full paths, current folder, no paths, or strip-components equivalent |
| Eliminate duplication of root folder | checkbox | Removes duplicate top-level folder when applicable |
| Overwrite mode | combo box | Ask, Skip, Rename, Replace |
| Password | password field | Empty by default |
| Show Password | checkbox | Toggles password visibility |
| Restore file security | checkbox | Only visible/enabled where supported |
| OK | default button | Starts extraction |
| Cancel | button | Closes dialog |
| Help | button | Opens help/info |

Default values:

- Destination defaults to last extraction folder or archive folder.
- Overwrite defaults to Ask or Skip, depending on safety policy.
- Path mode defaults to full paths.
- Password is never prefilled from persisted storage.

Validation:

- Destination is required.
- Destination must be a valid local path or a platform-supported destination.
- Password may be empty unless retrying after password-required.

## Add/Create Archive Dialog

Title: `Add to Archive`

Required controls:

| Control | Type | Requirement |
| --- | --- | --- |
| Archive | editable combo box | Output archive path |
| Browse | button `...` | Opens native save dialog |
| Source list | list/table | Files/folders to include |
| Add source | button | Opens native file/folder picker |
| Remove source | button | Removes selected sources |
| Archive format | combo box | Supported create formats |
| Compression level | combo box | Store, Fastest, Fast, Normal, Maximum, Ultra where applicable |
| Compression method | combo box | Format-specific method when applicable |
| Dictionary size | combo box | Format-specific when applicable |
| Word size | combo box | Format-specific when applicable |
| Solid block size | combo box | Format-specific when applicable |
| CPU threads | combo box | Number of worker threads if supported |
| Split to volumes, bytes | editable combo box | Optional volume size |
| Parameters | text field | Advanced raw parameters only if supported |
| Update mode | combo box | Add/replace, Update/add, Freshen, Synchronize if supported |
| Path mode | combo box | Relative/full path behavior |
| Options group | checkboxes | Format-specific flags |
| Encryption group | password fields and encryption controls | Visible for formats supporting encryption |
| OK/Create | default button | Starts create job |
| Cancel | button | Closes dialog |
| Help | button | Opens help/info |

Compression level values:

- Store
- Fastest
- Fast
- Normal
- Maximum
- Ultra

Update mode values:

- Add and replace files
- Update and add files
- Freshen existing files
- Synchronize files

Options group:

- Create SFX archive, only if supported
- Compress shared files, only if supported
- Delete files after compression, off by default and must require confirmation
- Clean source mode, if building from source folders
- Respect ignore files, if supported

Encryption group:

- Enter password
- Reenter password
- Show Password
- Encryption method
- Encrypt file names

Validation:

- Archive path is required.
- At least one source is required.
- Password and reentered password must match.
- Password must not be logged or persisted.
- If output exists, require replace confirmation or use selected overwrite behavior.
- Volume size must be valid and smaller than relevant source/archive size when split behavior requires it.

## Copy/Extract-To Dialog

Title should be `Copy` for copy operations and `Extract` for archive extraction.

Required controls:

- destination editable combo box
- browse `...` button
- info area showing selected counts, sizes, and path preview
- OK
- Cancel

Info area content:

- number of folders
- number of files
- total size if known
- current source path
- selected item names, truncated with `...` when long

## Overwrite Dialog

Title: `Confirm File Replace`

Required text:

- `Destination folder already contains processed file.`
- `Would you like to replace the existing file`
- existing file details
- `with this one?`
- new file details

Existing and new file details must include:

- icon
- filename/path
- size
- modified date/time when known

Buttons:

- Yes
- Yes to All
- Auto Rename
- No
- No to All
- Cancel

Default focus should be the safest non-destructive option unless the platform convention strongly expects `Yes`. Prefer `No` or `Cancel` for safety-critical extraction.

## Progress Dialog / Job View

Title: `Progress`

A classic modal progress dialog or a docked job drawer may be used, but it must expose the same information.

Required fields:

| Label | Meaning |
| --- | --- |
| Elapsed time | Time since operation started |
| Remaining time | Estimated time remaining, blank/unknown if not available |
| Files | Processed file count |
| Errors | Error count |
| Total size | Total bytes expected |
| Speed | Current throughput |
| Processed | Bytes processed |
| Compressed size | Packed bytes written/read when known |
| Compression ratio | Ratio/percentage when known |
| Status | Current operation status text |
| File name | Current file path/name |
| Progress bar | Overall progress |
| Messages list | Warnings/errors, newest visible |

Required buttons:

- Background, hides modal progress but keeps job running
- Pause, only if pause is implemented
- Cancel, requests cancellation

Progress behavior:

- Progress bar uses determinate mode when total is known.
- Progress bar uses indeterminate mode when total is unknown.
- Cancel changes state immediately to cancelling/cancel requested.
- Completed jobs show a terminal summary before dismissal.
- Failed jobs show error message, hint, and retry when safe.

## Password Dialog

Title: `Enter Password`

Required controls:

- password input
- Show Password checkbox
- OK
- Cancel

Behavior:

- Shown when opening/listing/extracting/testing requires a password.
- Re-shown with invalid-password message when retry fails.
- Password is held only in memory for the active operation.
- Password must never appear in logs, diagnostics, recent lists, persisted settings, URLs, or command-line arguments.

## Options Dialog

Options should use tabs or pages.

### System Page

Controls:

- file association list
- current-user association button
- all-users association button when privileges allow

Association list columns:

- checkbox
- extension
- description/type
- current association if known

### 7-Zip/Menu Page Equivalent

Controls:

- Integrate to shell context menu
- Cascaded context menu
- Icons in context menu
- Eliminate duplication of root folder
- Propagate Zone.Id stream, if supported
- Context menu items list with checkboxes

### Folders Page

Working folder choices:

- System temp folder
- Current
- Specified path
- Browse `...`
- Use for removable drives only

### Settings Page

Controls:

- Show `..` item
- Show real file icons
- Full row select
- Show grid lines
- Single-click to open an item
- Alternative selection mode
- Show system menu
- Use large memory pages, only if meaningful
- Maximum RAM memory usage allowed to unpack archives

### Language Page

Optional:

- language list
- selected language
- restart-required message if applicable

## Browse Temp Files Dialog

If temporary preview/extraction files can remain:

- Title: `Browse Temp Files`
- Shows list of temp roots/files.
- Includes filter combo.
- Includes Delete/Clean action.
- Includes Close.

## Interaction Shortcuts

Required shortcuts:

| Shortcut | Action |
| --- | --- |
| Ctrl+O | Open archive |
| Ctrl+N | New archive/create file depending active context |
| Ctrl+F | Focus search/filter |
| Ctrl+R | Refresh |
| Ctrl+A | Select all visible rows |
| Enter | Open selected row |
| Shift+Enter | Open selected row outside |
| Ctrl+PageDown | Open selected item inside |
| Ctrl+PageUp | Open parent folder |
| Backspace | Up one level |
| F2 | Rename when supported |
| F3 | View/preview |
| F4 | Edit when supported |
| F5 | Copy/extract to |
| F6 | Move to when supported |
| F7 | Create folder when supported |
| F9 | Toggle two-panel mode |
| Alt+Enter | Properties |
| Alt+F12 | Folder history |
| Delete | Delete when supported |
| Shift+Delete | Permanent delete when supported |
| Numpad Plus | Select by mask |
| Numpad Minus | Deselect by mask |
| Numpad Star | Invert selection |

Unsupported shortcuts must not trigger partial behavior. Disable the matching menu item or show a clear unsupported-operation message.

## File And Archive Opening Behavior

Opening a selected row:

- Folder: enter folder.
- Archive file: open inside current panel if supported.
- Regular file: preview by temporary extraction.
- Unsupported file: open outside with system handler or show unsupported message.

Opening from command line/file association:

- If path is an archive, open and list.
- If path is a folder, show filesystem-like folder view only if filesystem browsing is implemented.
- If path is unsupported, show actionable error.

## Error And Message Requirements

Messages should be short, specific, and actionable.

Common messages:

- `Operation is not supported.`
- `You must select one file.`
- `Too many items.`
- `Cannot start editor.`
- `File already exists.`
- `Error deleting file or folder.`
- `Error renaming file or folder.`
- `The operation cannot be called from a folder that has a long path.`

Do not show raw stack traces in user-facing UI. Keep technical detail in expandable diagnostics if needed.

## Persistence Requirements

Persist:

- window position and maximized state
- number of panels and active panel
- splitter position
- toolbar visibility and large/text button settings
- list view mode
- flat view setting
- table column order, width, visibility, and sort
- last panel/archive path
- folder history
- copy/extract destination history
- favorites
- safe options dialog settings

Never persist:

- passwords
- temporary extracted file contents
- secret-bearing diagnostics
- command arguments containing passwords

## Acceptance Checklist

An implementation satisfies this GUI spec when:

- Product chrome, window titles, About labels, and diagnostics use `ZManager`.
- The first visible screen has a menu bar, toolbar, path bar, archive table, and status bar.
- The archive table defaults to Details view with Name, Size, Packed Size, and Modified columns.
- The table can show the optional property columns listed above when data exists.
- The toolbar shows Add, Extract, Test, Copy, Move, Delete, and Info in that order.
- The menu bar contains the File, Edit, View, Favorites, Tools, and Help groups with the listed commands.
- Opening an archive displays entries in the table with icons, formatted sizes, formatted dates, sorting, and selection.
- Backspace, Enter, F3, F5, Ctrl+A, Ctrl+R, and Alt+Enter behave as specified.
- Extract uses the detailed Extract dialog or equivalent fields.
- Create/Add uses the detailed Add to Archive dialog or equivalent fields.
- Long operations show elapsed time, remaining time, files, errors, total size, speed, processed bytes, current file, progress bar, messages, and cancellation.
- The bottom status bar shows selected count, selected size, focused item size, and focused item date.
- Dragging archives into the app opens them.
- Dragging files/folders into the app starts the create/add flow.
- Password prompts are transient and never persisted.
- Disabled or unsupported mutation commands remain visible but unavailable.
