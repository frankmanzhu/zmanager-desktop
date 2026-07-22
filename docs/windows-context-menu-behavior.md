# Windows Context Menu Behavior

This records the current Windows Explorer behavior implemented by
`packaging/windows/nsis-context-menu.nsh`. Use it as the parity target for
Linux file-manager integration.

## Registration

- Registration is installer-owned and current-user scoped under
  `HKCU\Software\Classes`.
- Explorer shows one cascaded top-level menu named `ZManager`.
- The menu icon is `zmanager-desktop.exe`.
- Menu order is explicit through ordered `ExtendedSubCommandsKey` entries.
- Every registered verb uses `MultiSelectModel=Player`.
- Selected-item verbs are `IExplorerCommand` COM handlers. Explorer supplies
  the complete selection as one `IShellItemArray`.
- Folder-background verbs remain single-path executable commands using `%V`.
- Installer uninstall removes the current verbs, legacy direct verbs, and retired
  CommandStore entries, then calls `SHChangeNotify` to refresh Explorer.

## Supported Archive Selection

Right-clicking a supported archive extension shows `ZManager` with these actions
in this order:

1. `Extract Here`
2. `Extract to Archive Folder`
3. `Open archive`
4. `Add to archive...`
5. `Add to .tzap`
6. `Add to .zip`
7. `Add to .7z`
8. `Add to .tzst`
9. `Add to .tgz`

The archive extension set is generated from
`manifests/archive-file-types.json` plus `.001` split archives. The current
Windows registration covers `.001`, `.7z`, `.apk`, `.appx`, `.br`, `.bz2`,
`.cab`, `.cbr`, `.cpio`, `.deb`, `.gz`, `.ipa`, `.iso`, `.jar`, `.lrz`, `.lz`,
`.lz4`, `.lzma`, `.lzo`, `.rar`, `.rpm`, `.tar`, `.tbz2`, `.tgz`, `.txz`,
`.tzap`, `.tzst`, `.war`, `.xar`, `.xpi`, `.xz`, `.z`, `.zip`, `.zipx`, and
`.zst`.

## Non-Archive File And Folder Selection

Right-clicking a non-archive file shows the create actions through the generic
`ZManager` `*\shell` cascade. Its selected-item commands are COM handlers, so
multi-file selections arrive as one array. The current NSIS registration targets
the classic Explorer context menu. First-tier Windows 11 compact-menu placement
requires package-identity registration and does not change the atomic selection
contract.

Right-clicking a selected folder shows `ZManager` with the create actions:

1. `Add to archive...`
2. `Add to .tzap`
3. `Add to .zip`
4. `Add to .7z`
5. `Add to .tzst`
6. `Add to .tgz`

Right-clicking a folder background also shows the same create actions, using the
current folder as the target.

## Command Contract

Selected-item verbs write one versioned shell-action request and launch:

- `zmanager-desktop.exe --shell-action-request "<request.json>"`

The request contains the action and every selected path. Folder-background
verbs launch the GUI directly through quick-action arguments:

- `zmanager-desktop.exe --quick-action compress --path "%V"`
- `zmanager-desktop.exe --quick-action compress-tzap --path "%V"`
- `zmanager-desktop.exe --quick-action compress-zip --path "%V"`
- `zmanager-desktop.exe --quick-action compress-7z --path "%V"`
- `zmanager-desktop.exe --quick-action compress-tzst --path "%V"`
- `zmanager-desktop.exe --quick-action compress-tgz --path "%V"`

Legacy `%1` parsing remains available for compatibility but is not used by new
selected-item registrations.

The app validates every quick action again before starting work:

- `open` requires exactly one supported archive path.
- `extract-here` accepts one or more supported archive paths.
- `extract-to-folder` requires exactly one supported archive path.
- `compress`, `compress-tzap`, `compress-zip`, `compress-7z`,
  `compress-tzst`, and `compress-tgz` require at least one local file or
  folder path.
- Passwords must never be supplied through quick-action arguments.

## Multi-Select Limits

Static Explorer registry verbs do not receive Explorer's full selected-item data
object. They also cannot produce dynamic labels such as `Add to docs.zip`.

Selected-item actions arrive as one atomic request; the app does not use a
timing window or coalesce launches. `Add to archive...` appends the request's
paths to the singleton Main Window's active Create Workspace. Fixed-format
create actions start one job containing every path in the request.

## Window Lifecycle

The generated shell-action contract classifies each action by window
disposition:

- `open`, `compress` (**Add to archive...**), and `extract` use the singleton
  Main Window and leave it available after the operation.
- Fixed-format create actions and `extractHere`/`extractToFolder` use a
  Disposable Task Window. A cold launch keeps the Main Window hidden and exits
  its hidden coordinator after the request, task window, and job have all
  settled.
- A disposable action forwarded into an already-normal app session does not
  close that existing Main Window.

Cold-start transfer into the Native Launch Inbox preserves the disposition but
does not retain a second executable copy of the request. This prevents both a
normal-window reveal and duplicate execution.

## Linux Parity Target

Linux file-manager integration should mirror the Windows action labels, ordering,
and versioned shell-action contract wherever the desktop environment supports it:

- Archive selections should expose extraction/open actions first, followed by
  create actions.
- File and folder selections should expose the create actions.
- Unsupported combinations should be rejected by the same app-level quick-action
  validation rather than by reimplementing archive behavior in shell scripts.
- Packaging should keep desktop/file-manager registration in `packaging/linux/*`
  and Linux profile metadata in `src-tauri/src/platform/linux.rs`.
