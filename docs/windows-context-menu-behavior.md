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

The archive extension set is generated from
`src/app/archiveFileTypes.manifest.json` plus `.001` split archives. The current
Windows registration covers `.001`, `.7z`, `.apk`, `.appx`, `.br`, `.bz2`,
`.cab`, `.cbr`, `.cpio`, `.deb`, `.gz`, `.ipa`, `.iso`, `.jar`, `.lrz`, `.lz`,
`.lz4`, `.lzma`, `.lzo`, `.rar`, `.rpm`, `.tar`, `.tbz2`, `.tgz`, `.txz`,
`.tzap`, `.tzst`, `.war`, `.xar`, `.xpi`, `.xz`, `.z`, `.zip`, `.zipx`, and
`.zst`.

## Non-Archive File And Folder Selection

Right-clicking a non-archive file does not register a generic `ZManager`
`*\shell` cascade. Windows 11's compact context menu can surface that static
cascade as an empty `ZManager` submenu during archive multi-selection, while the
classic `Show more options` menu resolves the archive submenu correctly. Retiring
the generic file cascade removes the broken compact-menu entry until ZManager has
a future ExplorerCommand/COM handler that can receive the full selected-item data
object.

Right-clicking a selected folder shows `ZManager` with the create actions:

1. `Add to archive...`
2. `Add to .tzap`
3. `Add to .zip`
4. `Add to .7z`
5. `Add to .tzst`

Right-clicking a folder background also shows the same create actions, using the
current folder as the target.

## Command Contract

Explorer verbs launch the GUI through quick-action arguments:

- `zmanager-desktop.exe --quick-action extract-here --path "%1"`
- `zmanager-desktop.exe --quick-action extract-to-folder --path "%1"`
- `zmanager-desktop.exe --quick-action open --path "%1"`
- `zmanager-desktop.exe --quick-action compress --path "%1"`
- `zmanager-desktop.exe --quick-action compress-tzap --path "%1"`
- `zmanager-desktop.exe --quick-action compress-zip --path "%1"`
- `zmanager-desktop.exe --quick-action compress-7z --path "%1"`
- `zmanager-desktop.exe --quick-action compress-tzst --path "%1"`

Folder-background create actions use `%V` instead of `%1`.

The app validates every quick action again before starting work:

- `open` requires exactly one supported archive path.
- `extract-here` accepts one or more supported archive paths.
- `extract-to-folder` requires exactly one supported archive path.
- `compress`, `compress-tzap`, `compress-zip`, `compress-7z`, and
  `compress-tzst` require at least one local file or folder path.
- Passwords must never be supplied through quick-action arguments.

## Multi-Select Limits

Static Explorer registry verbs do not receive Explorer's full selected-item data
object. They also cannot produce dynamic labels such as `Add to docs.zip`.

Create quick actions may arrive as separate launches. `Add to archive...`
forwards each launch immediately and appends its paths to the singleton Main
Window's active Create Workspace. Fixed-format create actions coalesce pending
launches by action before starting one job, so a multi-selection produces one
archive containing all selected sources. The structured
`--quick-action-request` JSON contract remains available for a future
ExplorerCommand or COM handler that receives the full selection in one process.

## Linux Parity Target

Linux file-manager integration should mirror the Windows action labels, ordering,
and quick-action contract wherever the desktop environment supports it:

- Archive selections should expose extraction/open actions first, followed by
  create actions.
- File and folder selections should expose the create actions.
- Unsupported combinations should be rejected by the same app-level quick-action
  validation rather than by reimplementing archive behavior in shell scripts.
- Packaging should keep desktop/file-manager registration in `packaging/linux/*`
  and Linux profile metadata in `src-tauri/src/platform/linux.rs`.
