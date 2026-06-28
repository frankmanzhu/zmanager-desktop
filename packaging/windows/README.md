# Windows Packaging Notes

The Windows bundle uses the Tauri NSIS target plus `nsis-context-menu.nsh`, wired by
`src-tauri/tauri.conf.json` at `bundle.windows.nsis.installerHooks`.

The hook registers current-user Explorer verbs under `HKCU\Software\Classes` after
install and removes the same keys before uninstall. Commands launch the GUI with the
quick-action CLI contract:

- `zmanager-desktop.exe --quick-action open --path "<archive>"`
- `zmanager-desktop.exe --quick-action extract-here --path "<archive>"`
- `zmanager-desktop.exe --quick-action extract-to-folder --path "<archive>"`
- `zmanager-desktop.exe --quick-action compress --path "<target>"`
- `zmanager-desktop.exe --quick-action compress-tzap --path "<target>"`
- `zmanager-desktop.exe --quick-action compress-zip --path "<target>"`
- `zmanager-desktop.exe --quick-action compress-7z --path "<target>"`
- `zmanager-desktop.exe --quick-action compress-tzst --path "<target>"`
- `zmanager-desktop.exe --quick-action-request "<request.json>"`

Explorer shows a single `ZManager` cascaded menu. Supported archive extensions show
`Extract Here`, `Extract to Archive Folder`, and `Open archive` first, followed by `Add to archive...`,
`Add to .tzap`, `Add to .zip`, `Add to .7z`, and `Add to .tzst`, so archive files
can also be archived again. Other files, selected folders, and folder backgrounds
show the same add actions. The hook uses explicit ordered per-user
`ExtendedSubCommandsKey` entries so Explorer does not choose the
submenu order. The generic `Add to archive...` action opens the regular Create
Archive dialog with the selected item preloaded. Fixed-format actions use the same
create workflow and start with rename-on-collision enabled. Extraction is registered
for supported archive extensions through `SystemFileAssociations`.

Static registry verbs do not receive Explorer's full selection data object, so they
cannot reliably produce dynamic labels such as `Add to docs.zip` or collapse a
multi-select into one process. The app-level `--quick-action-request` contract is
available for a future ExplorerCommand/COM handler that receives the selected items
and writes one structured request file.

Release wiring:

1. Keep the NSIS target enabled in `src-tauri/tauri.conf.json`.
2. Build the installer with the existing Tauri/package scripts.
3. The installer includes `packaging/windows/nsis-context-menu.nsh` automatically via
   `installerHooks`.
4. Validate install/uninstall by checking the Explorer verbs appear after install and
   disappear after uninstall.

Next packaging steps remain code signing, WinGet metadata after public artifacts are
stable, and MSIX only if Store-style install semantics become necessary.

