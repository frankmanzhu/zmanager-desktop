# Windows Native GUI Task 16 Smoke

Date: 2026-07-08

## Environment

- Host: Windows ARM64 development machine.
- App: `npm.cmd run tauri dev` launched `target\debug\zmanager-desktop.exe`.
- Native build environment: `scripts/setup-windows-static-env.ps1` with `C:\vcpkg`, `arm64-windows-static-md`.
- Test archive opened through the native picker: `src-tauri\target\release\bundle.zip`.

## Native Evidence Captured

- `docs/gui-audit/manual-tauri-01-launched.png`: real Tauri shell launched and responsive.
- `docs/gui-audit/manual-tauri-02-open-archive-picker.png`: native Windows `Open archive` picker opened from File > Open.
- `docs/gui-audit/manual-tauri-04-file-menu.png`: keyboard-accessible File menu with Open, Open in Archive, Open Outside, View, Properties, Create File, and Exit.
- `docs/gui-audit/manual-tauri-05-view-menu.png`: keyboard-accessible View menu with sort and toolbar options.
- `docs/gui-audit/manual-tauri-06-extract-loaded-native.png`: archive loaded in the Tauri shell after selecting `bundle.zip`.
- `docs/gui-audit/manual-tauri-08-tools-menu.png`: keyboard-accessible Tools menu with Options and Delete Temporary Files.
- `docs/gui-audit/manual-tauri-09-preferences-native.png`: Options dialog opened from Tools > Options.
- `docs/gui-audit/manual-tauri-10-minimum-loaded-native.png`: loaded archive resized to the 760x540 minimum-size smoke target.

## Automated Visual Audit

- `npm.cmd run test:e2e -- e2e/gui-visual-scan.spec.ts`: passed after the final visual fix.
- The refreshed browser-backed screenshots in `docs/gui-audit/*.png` cover the full, compact, and minimum surfaces listed by Tasks 13-15.
- Manual review after the final scan found no clipped table headers, clipped primary buttons, overlapping visible controls, or horizontally overflowing compact/minimum surfaces.

## Verified In Native Shell

- Tauri shell starts and renders the Windows native GUI.
- File menu is keyboard reachable.
- Native Windows file picker opens for File > Open.
- Selecting a local ZIP from the native picker loads the archive in Extract mode.
- Shell/folder/archive icons render in the loaded archive tree/table.
- View and Tools menus are keyboard reachable.
- Preferences opens from Tools > Options.
- Window can be resized to 760x540 with the loaded archive remaining visible.

## Remaining Manual Gaps

These require a hands-on smoke pass or a controllable WebView2 automation channel. In this Codex desktop session, top-level keyboard menu access worked, but injected pointer hit testing and row focus were unreliable for WebView DOM controls.

- Drag files/folders into Compress.
- Drop archive into Extract.
- Native drag-out from archive entries.
- App-specific row/source/column context menus via pointer and Shift+F10.
- Reveal in File Explorer.
- Extract destination folder picker path.
- Fine-grained focus return after closing every modal/menu.

