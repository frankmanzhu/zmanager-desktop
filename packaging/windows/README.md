# Windows Packaging Notes

The Windows bundle uses the Tauri NSIS target plus `nsis-context-menu.nsh`, wired by
`src-tauri/tauri.conf.json` at `bundle.windows.nsis.installerHooks`.

The hook registers current-user Explorer verbs under `HKCU\Software\Classes` after
install and removes the same keys before uninstall. Commands launch the GUI with the
quick-action CLI contract:

- `zmanager-desktop.exe --quick-action compress --path "<target>"`
- `zmanager-desktop.exe --quick-action extract --path "<archive>"`

Explorer shows only `Compress using ZManager` and `Extract using ZManager`.
Compression uses the app's default format, output location, and clean-source
preference. Extraction uses the app's default extraction behavior: ask every time,
extract here, or extract to a sibling folder. Extraction is registered for supported
archive extensions through `SystemFileAssociations`.

Release wiring:

1. Keep the NSIS target enabled in `src-tauri/tauri.conf.json`.
2. Build the installer with the existing Tauri/package scripts.
3. The installer includes `packaging/windows/nsis-context-menu.nsh` automatically via
   `installerHooks`.
4. Validate install/uninstall by checking the Explorer verbs appear after install and
   disappear after uninstall.

Next packaging steps remain code signing, WinGet metadata after public artifacts are
stable, and MSIX only if Store-style install semantics become necessary.

