# Linux Packaging Notes

The Linux bundle uses Tauri file associations for Open With support and custom deb/rpm
desktop templates for quick-action routes.

Packaged materials:

- `zmanager.desktop.hbs`: launcher/Open With desktop entry plus desktop actions.
- `xdg-mime.xml`: MIME definitions for ZManager-owned `.tzst`, `.tar.zst`, and `.tzap`
  extensions.
- `postinstall.sh` and `postremove.sh`: refresh XDG MIME and desktop databases.
- `kde/zmanager-servicemenu.desktop`: KDE/Dolphin service-menu actions installed by
  deb/rpm packages.

Quick-action command contract:

- `zmanager-desktop --quick-action compress --path <target>`
- `zmanager-desktop --quick-action extract --path <archive>`

The actions use the app preferences for archive format, clean-source behavior,
output folder, and extraction destination behavior.

GNOME Files generally honors the MIME association for Open With, but does not reliably
consume `.desktop` quick actions as per-file context-menu actions. Use Open With,
drag/drop, or a user-installed Nautilus script that forwards to the same CLI contract.

KDE/Dolphin consumes the packaged service menu from
`/usr/share/kio/servicemenus/zmanager-servicemenu.desktop` when installed from deb/rpm.
If a distribution expects the user-level path, copy the same file to
`~/.local/share/kio/servicemenus/` and run `kbuildsycoca6` or log out and back in.

AppImage builds carry the app desktop metadata for manual registration, but system-level
Open With and service-menu installation depends on the user or distribution integration
tool installing that metadata.

