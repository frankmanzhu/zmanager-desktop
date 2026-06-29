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

Ubuntu/Debian package build:

```sh
scripts/build-linux-ubuntu-deb.sh
```

Ubuntu is best served by a `.deb` package. It integrates with `dpkg`/apt,
desktop launchers, MIME associations, and the post-install hooks in this
directory. AppImage remains useful for portable manual installs, but `.deb` is
the primary Ubuntu distribution artifact.

Fresh Ubuntu builders must install Tauri's native GTK/WebKit dependencies:

```sh
sudo apt-get update
sudo apt-get install build-essential cmake curl file libayatana-appindicator3-dev libgtk-3-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf
```

These packages provide `cmake` for the bundled libarchive build and required
`pkg-config` entries such as `gtk+-3.0`, `libsoup-3.0`, and `webkit2gtk-4.1`.
If they are missing, Cargo fails before packaging, often in
`zmanager-libarchive-sys`, `soup3-sys`, or WebKit build scripts. A missing
libsoup package looks like:

```text
pkg-config --libs --cflags libsoup-3.0 'libsoup-3.0 >= 3.0'
No package 'libsoup-3.0' found
```

A missing `cmake` package looks like:

```text
failed to execute command: No such file or directory (os error 2)
is `cmake` not installed?
```

You can also run `scripts/build-linux-ubuntu-deb.sh --install-deps`, but it
requires an interactive sudo session. The script expects Rust 1.85 or newer
because the Tauri crate uses the Rust 2024 edition. Node.js 20 or newer is
required when running the default test path.

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
