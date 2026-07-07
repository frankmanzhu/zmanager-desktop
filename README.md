# ZManager Desktop

ZManager Desktop is the Windows and Linux graphical shell for the ZManager Rust archive engine.

## Release Notes

For each release, update [`ReadMe.txt`](./ReadMe.txt) with the release notes that should appear in the GitHub release assets/description.
The latest release package is currently `v0.1.0` and includes normalized cross-platform
artifact names plus `zmanager-desktop-<version>-SHA256SUMS.txt`.

This project is intentionally separate from the existing macOS app repository. The current macOS app remains a native SwiftUI/Finder/Quick Look product. This project owns the shared Windows/Linux desktop experience, while reusing the public Rust engine from `frankmanzhu/zmanager`.

## Repository Relationship

```text
ZManager/
  private macOS SwiftUI app repo
  cli/ -> public zmanager Rust CLI/core submodule

zmanager-desktop/
  Windows/Linux Tauri shell
  consumes zmanager-core from the public Rust repo
```

The local bootstrap dependency points at the sibling macOS checkout:

```text
../ZManager/cli/crates/zmanager-core
```

When this becomes a standalone repository, replace the local path dependency with a Git dependency or a checked-out submodule of the public CLI/core repository.

## Product Direction

- Keep one shared Windows/Linux GUI project.
- Keep platform-specific integration in isolated Windows and Linux modules.
- Do not move SwiftUI, Finder Sync, Quick Look, signing, or notarization work into this repo.
- Do not duplicate archive logic. Archive behavior belongs in `zmanager-core`.
- Treat the GUI as a thin orchestration and presentation layer over the Rust job model.

## Proposed Stack

- Tauri 2 for the Windows/Linux desktop shell.
- Vite and TypeScript for the shared UI.
- Rust Tauri commands for app-facing operations.
- `zmanager-core` for archive planning, listing, testing, extraction, creation, safety, and job events.

## First Local Commands

```sh
npm install
npm run dev
npm run tauri dev
```

Rust command-layer check:

```sh
cd src-tauri
cargo check
```

## Linux Build Prerequisites

Ubuntu/Debian builds need Rust 1.85 or newer, Node.js, npm, Tauri's native
GTK/WebKit development packages, and native archive/link dependencies. On a
fresh Ubuntu machine, install:

```sh
sudo apt-get update
sudo apt-get install build-essential ca-certificates cmake curl file gnupg libacl1-dev libayatana-appindicator3-dev libbz2-dev libexpat1-dev libgtk-3-dev liblz4-dev libxml2-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf
```

These packages provide `cmake` for the bundled libarchive build and the
`pkg-config` entries required by the Rust GTK stack, including `libsoup-3.0`
and `webkit2gtk-4.1`. They also provide native link libraries such as `acl`,
`bz2`, `expat`, `lz4`, and `xml2` for archive tests and packaging. Without
them, Cargo can fail in `zmanager-libarchive-sys`, `soup3-sys`, WebKit-related
build scripts, or the final Rust link step.

The repository includes a Linux Cargo config that appends `-lexpat` as a final
link argument. Keep `libexpat1-dev` installed; it prevents GNU ld ordering
failures when the bundled libarchive references Expat symbols on ARM64.

Build an Ubuntu/Debian package with:

```sh
scripts/build-linux-ubuntu-deb.sh
```

On a fresh machine, `scripts/build-linux-ubuntu-deb.sh --install-deps` installs
the Ubuntu packages above, Node.js 20, and Rust through rustup before building.
Use `--skip-tests` only when you need a packaging-only build.

The build script also stages a copy under `/tmp/zmanager-desktop-deb/` so apt's
`_apt` sandbox user can read it. Install from that staged path, not directly
from a private home/project directory:

```sh
sudo apt-get install --reinstall /tmp/zmanager-desktop-deb/ZManager_0.1.0_amd64.deb
```

Fedora RPM builds use Fedora package names and stage installable artifacts under
`/tmp/zmanager-desktop-rpm/`:

```sh
scripts/build-linux-fedora-rpm.sh
```

On a fresh Fedora machine, `scripts/build-linux-fedora-rpm.sh --install-deps`
installs Tauri's Fedora GTK/WebKit packages, RPM build tooling, Node.js, the
native archive/link dependencies, and Rust through rustup when needed. Use
`--no-install` when you only want to build and stage the `.rpm` artifact.

## Layout

```text
docs/
  ARCHITECTURE.md
  HANDOFF.md
  PRD.md
  REQUIREMENTS.md
  ROADMAP.md
packaging/
  linux/
  windows/
src/
  TypeScript UI shell
src-tauri/
  Tauri app, Rust command layer, platform integration modules
```

## Immediate Goal

Build a working Windows/Linux MVP with:

- healthcheck
- open archive
- browse entries
- extract archive
- create ZIP/TZST/TZAP/7z
- password prompt through non-logging UI state
- progress and cancel
- platform packaging

Read `docs/HANDOFF.md` first before implementing.
