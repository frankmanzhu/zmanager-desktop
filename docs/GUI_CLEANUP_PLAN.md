# ZManager Desktop GUI Cleanup Plan

Date: 2026-06-11

## Goal

Make ZManager Desktop feel like a real archive manager instead of a web dashboard.

The target experience is a compact, operational desktop utility for Windows and Linux:

- File-manager-first layout.
- Obvious archive actions.
- Minimal internal/debug text on the main screen.
- Fast browse, extract, create, test, and job monitoring workflows.
- Shared cross-platform structure with platform-aware polish.

This plan uses 7-Zip, PeaZip, WinZip, GNOME Archive Manager/File Roller, and KDE Ark as references, but ZManager should not directly clone any one product.

## Reference Direction

### 7-Zip

Use 7-Zip as the simplicity reference.

Relevant ideas:

- Classic menu bar.
- Compact command toolbar.
- Main file table.
- Status bar.
- Actions like Add, Extract, Test, Delete, Info.
- Utility-first presentation with very little decorative UI.

Reference: https://www.7-zip.org/

### PeaZip

Use PeaZip as the cross-platform structure reference.

Relevant ideas:

- Address/breadcrumb bar.
- Left navigation tree.
- Main archive/file browser.
- Details columns.
- Optional tabs.
- Archive tree browsing.
- System-aware light/dark behavior.

Reference: https://peazip.github.io/screenshots-peazip-1.html

### WinZip

Use WinZip only for the action/context model, not for the full ribbon visual style.

Relevant ideas:

- Clear file/archive/action panes.
- Context-sensitive actions based on selection.
- Common workflows exposed near the selected content.

Reference: https://kb.winzip.com/en/130497

## Non-Goals

- Do not make a marketing-style landing page.
- Do not show internal engine versions in the main workspace.
- Do not mimic WinZip's full ribbon-heavy UI.
- Do not create fake native GTK/KDE/Win32 chrome in CSS.
- Do not reimplement archive behavior in TypeScript.
- Do not add macOS SwiftUI, Finder Sync, Quick Look, signing, notarization, or `.app` packaging code in this repo.

## Target Shell Layout

The final shell should use this structure:

```text
Menu bar
Command toolbar
Archive/path bar
Left navigation/tree | Main archive table | Right details/actions pane
Bottom status/job bar
```

### Menu Bar

Top-level menus:

- File
- Edit
- View
- Archive
- Tools
- Help

Initial menu items can be simple and can share handlers with toolbar buttons.

### Command Toolbar

Primary actions:

- Open
- New
- Add
- Extract
- Test
- Delete
- Preview
- Info

Toolbar buttons should use icon plus short label. The icon should carry the quick-recognition load; the text should remove ambiguity.

### Archive / Path Bar

The path bar should show:

- Current archive path.
- Current folder/path inside the archive.
- Back/up navigation.
- Search entry point.

Examples:

```text
C:\Users\Frank\Downloads\photos.zip > wedding > raw
/home/frank/downloads/package.tar.zst > usr > bin
```

### Left Navigation Pane

When an archive is open:

- Show archive folder tree.
- Show a root item for the archive.
- Support selecting folders to filter/navigate the main table.

When no archive is open:

- Show recent archives.
- Show common locations if available.
- Show simple actions: Open Archive, Create Archive.

### Main Table

Default columns:

- Name
- Size
- Packed
- Type
- Modified
- Ratio

Possible later columns:

- CRC/hash
- Attributes
- Method
- Encrypted

Table behavior:

- Single row selection.
- Multi row selection.
- Double-click folder to navigate.
- Double-click file to preview/open temp copy when supported.
- Right-click context menu.
- Sort by column.
- Search/filter without losing selection unnecessarily.

### Right Details / Actions Pane

When no archive is open:

- Show recent archive actions.
- Do not show engine/version/debug information.

When archive is open and nothing is selected:

- Archive name.
- Entry count.
- Total unpacked size.
- Available actions: Extract All, Test Archive, Add Files, Info.

When one item is selected:

- Name.
- Type.
- Size.
- Packed size.
- Modified date.
- Path inside archive.
- Actions: Extract, Preview/Open, Info.

When multiple items are selected:

- Selected count.
- Selected total size if known.
- Actions: Extract Selected, Clear Selection.

### Bottom Status / Job Bar

The bottom bar should always show useful operational state:

- Ready.
- Loading archive.
- Testing archive.
- Extracting 42%.
- Create completed.
- Failed: short error message.

Clicking the job area should open a job drawer with details.

## Interaction Model

### Open Archive

1. User clicks Open.
2. Native file dialog opens.
3. App lists archive contents.
4. Main table receives focus.
5. Left tree and right details pane update.

Acceptance criteria:

- Empty app opens directly into a useful open/create state.
- No internal engine version is visible.
- Password-required errors produce a password prompt or inline password request.

### Extract

1. User selects Extract or Extract All.
2. Focused extract dialog opens.
3. User chooses destination.
4. User chooses overwrite policy.
5. Advanced options are collapsed by default.
6. Job starts and appears in bottom status/job bar.

Acceptance criteria:

- Extract does not require scanning a large form on the main screen.
- Destination is always visible before starting.
- Password is never stored.
- Job can be cancelled.

### Create Archive

1. User clicks New.
2. Focused create dialog opens.
3. User chooses destination and format.
4. User adds files/folders.
5. App shows a plan summary.
6. Advanced options are collapsed by default.
7. Job starts and appears in bottom status/job bar.

Acceptance criteria:

- ZIP/TZST/TZAP/7Z formats are visible.
- The create flow does not dominate the default browse workspace.
- Password fields use explicit "optional password" language.
- Plan warnings are visible before start.

### Test Archive

1. User clicks Test.
2. Job starts immediately if no password is required.
3. If password is required, request password.
4. Result appears in job drawer/status bar.

Acceptance criteria:

- Test result is clear: Passed, Failed, Password Required, Cancelled.
- Errors do not leak passwords.

## Visual Direction

### General

- Use small radii: 2-4px.
- Use compact spacing.
- Prefer native-feeling controls.
- Avoid large cards.
- Avoid beige/custom brand-heavy styling.
- Avoid decorative panels, hero areas, or marketing text.

### Light Theme

Base colors:

- App background: `#f3f3f3`
- Content background: `#ffffff`
- Border: `#d0d0d0`
- Text: `#1f1f1f`
- Muted text: `#666666`
- Accent: Windows-like blue, around `#0067c0`

### Dark Theme

Base colors:

- App background: `#202020`
- Content background: `#2b2b2b`
- Border: `#3a3a3a`
- Text: `#f0f0f0`
- Muted text: `#b8b8b8`
- Accent: accessible blue, around `#4aa3ff`

Dark mode should follow system preference first. A manual setting can come later.

## Implementation Slices

### Slice 1: Remove Noise And Stabilize Main Workspace

Scope:

- Remove engine/version text from the main topbar.
- Remove the visible contract/settings panel from the default workspace.
- Change topbar copy to operational status only.
- Keep existing behavior working.

Files likely touched:

- `src/main.ts`
- `src/styles.css`
- `src/app/constants.ts`

Acceptance criteria:

- Main screen says Ready/Open Archive, not `zmanager-core`.
- Settings/diagnostics are not a primary tab.
- Existing open/list/extract buttons still work.

### Slice 2: Introduce Desktop Utility Chrome

Scope:

- Add menu bar structure.
- Replace current topbar buttons with compact command toolbar.
- Add bottom status/job bar.
- Keep existing tab implementation temporarily if needed.

Files likely touched:

- `src/main.ts`
- `src/styles.css`

Acceptance criteria:

- First viewport looks like a desktop utility, not a web dashboard.
- Primary actions are visible: Open, New, Extract, Test, Jobs.
- Job state is visible at the bottom.

### Slice 3: Replace Tabs With Browser Shell

Scope:

- Replace Browse/Create/Jobs/Settings tabs with three-pane shell.
- Left pane: archive tree placeholder/recent archives.
- Center pane: existing table.
- Right pane: archive/selection details.

Files likely touched:

- `src/main.ts`
- `src/styles.css`

Acceptance criteria:

- Browse table is the center of the app.
- Create and jobs no longer look like equal top-level pages.
- No archive open state is useful and clear.

### Slice 4: Extract Dialog

Scope:

- Move extract destination, overwrite policy, strip components, and password into an extract dialog.
- Keep Extract All and Extract Selected actions.
- Use native folder dialog for destination selection.

Files likely touched:

- `src/main.ts`
- `src/styles.css`
- `src/api/types.ts` only if request shape needs cleanup.

Acceptance criteria:

- Extract workflow is focused and short.
- Advanced options are collapsed.
- Password is requested only when needed or intentionally entered.

### Slice 5: Create Archive Dialog

Scope:

- Move source list, format, destination, compression, password, volume size, and plan into a create dialog.
- Keep plan refresh inside the dialog.
- Show warnings before start.

Files likely touched:

- `src/main.ts`
- `src/styles.css`

Acceptance criteria:

- Main workspace is not occupied by create settings.
- Create flow supports current formats.
- Start button is disabled until required fields are valid.

### Slice 6: Archive Tree And Breadcrumb Navigation

Scope:

- Build archive folder tree from listed entry paths.
- Add breadcrumb path bar.
- Let users navigate folder-like views.
- Add flat view toggle.

Files likely touched:

- `src/main.ts`
- `src/styles.css`
- possibly new frontend helper module under `src/app/`.

Acceptance criteria:

- Users can browse an archive by folder.
- Breadcrumb updates as users navigate.
- Flat view still supports search across all entries.

### Slice 7: Selection Details And Context Actions

Scope:

- Right pane updates for no selection, one selection, and multi selection.
- Add row context menu for Preview, Extract, Info.
- Make toolbar enabled/disabled states selection-aware.

Files likely touched:

- `src/main.ts`
- `src/styles.css`

Acceptance criteria:

- The app always shows what selected actions will affect.
- Right-click exposes expected archive actions.
- Multi-select has clear extract selected behavior.

### Slice 8: Job Drawer

Scope:

- Replace Jobs tab with bottom job drawer.
- Show current/active job in bottom bar.
- Drawer contains logs, summaries, cancel, dismiss.

Files likely touched:

- `src/main.ts`
- `src/styles.css`

Acceptance criteria:

- Job details are available but not the main screen.
- Cancel remains reachable for running jobs.
- Completed jobs can be dismissed.

### Slice 9: Keyboard And Desktop Behaviors

Scope:

- Add keyboard shortcuts.
- Add focus handling.
- Add double-click behavior.
- Add Delete/Enter/F2 behavior where appropriate.

Suggested shortcuts:

- `Ctrl+O`: Open archive.
- `Ctrl+N`: New archive.
- `Ctrl+F`: Search.
- `F5`: Refresh listing.
- `Enter`: Open folder/preview file.
- `Backspace` or `Alt+Up`: Up one archive folder.
- `Delete`: Delete from archive later if supported.

Acceptance criteria:

- Basic keyboard navigation works without mouse.
- Search receives focus with `Ctrl+F`.
- Table focus and selection are visible.

### Slice 10: Platform Polish

Scope:

- Light/dark system theme.
- Windows spacing/icons tuned against Explorer/7-Zip expectations.
- Linux spacing/icons tuned against File Roller/Ark/PeaZip expectations.
- Keep one shared implementation.

Acceptance criteria:

- Windows build no longer looks like a styled web page.
- Linux build does not look Windows-only.
- App respects system color preference.

### Slice 11: Diagnostics And About

Scope:

- Add Help > About.
- Move engine version, commit, core dependency, platform integration contract, and diagnostics there.
- Add copy diagnostics button.

Acceptance criteria:

- Internal version info is available for bug reports.
- Normal users do not see internals in the main workspace.

### Slice 12: Package And Test

Scope:

- Build Windows installer.
- Smoke test open/list/extract/create/test flows.
- Capture screenshots for review.
- Fix obvious layout breakage.

Acceptance criteria:

- Installer builds.
- App launches.
- Main screen is visually coherent.
- Archive open/list works.
- Extract job starts and reaches terminal state.
- Create job starts and reaches terminal state for ZIP.

## Technical Notes

### Frontend Structure

The current `src/main.ts` is doing too much. During cleanup, extract small helpers only when useful:

- `src/app/archiveTree.ts`
- `src/app/formatting.ts`
- `src/app/selection.ts`
- `src/app/dialogs.ts`

Avoid a large framework migration during GUI cleanup.

### Icons

Use an icon library if added intentionally, or a small owned icon set if the dependency cost is not worth it. Prefer recognizable archive/file-manager symbols:

- Folder
- File
- Archive/package
- Extract arrow
- Plus/add
- Test/check
- Info
- Search
- Jobs/activity

### Accessibility

Minimum expectations:

- Visible focus states.
- Keyboard-reachable toolbar, table, dialogs, and job drawer.
- Dialogs trap focus while open.
- Buttons have accessible names.
- Table selection state is communicated.

### Safety

Keep these rules visible in implementation reviews:

- Passwords never persist.
- Passwords never appear in logs.
- Extraction safety remains core-owned.
- Frontend does not bypass overwrite/collision/symlink/path safety.
- Destructive archive actions require confirmation.

## Open Decisions

1. Should ZManager support editing archives in-place in the first cleanup pass, or only browse/create/extract/test?
2. Should the app show recent archives, and if so where should that data be stored?
3. Should Linux builds default to system theme only, or include an explicit theme toggle?
4. Should delete-from-archive be hidden until the Rust command layer exposes a safe operation?
5. Should Create Archive be a modal dialog or a right-side task pane?

Recommended defaults:

- No in-place archive editing in the first cleanup pass.
- Store recent archives only after a lightweight privacy review.
- Follow system theme first; add manual toggle later.
- Hide destructive archive actions until command support is explicit.
- Use modal dialogs for Create and Extract first, then reconsider task panes later.

## Success Criteria

The cleanup is done when:

- The first screen looks like an archive manager.
- The user can open an archive and understand the layout within a few seconds.
- The main view is dominated by the archive contents, not settings or implementation detail.
- Extract/create/test actions are discoverable and focused.
- Job state is visible without taking over the app.
- Windows and Linux builds share one coherent UI without looking like a marketing site.
