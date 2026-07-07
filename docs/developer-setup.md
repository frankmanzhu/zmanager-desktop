# ZManager Desktop developer setup

This document contains technical setup, build, packaging, and release-procedure
information that was previously in the repository front page.

## Release notes workflow

For each release, update [`ReadMe.txt`](../ReadMe.txt) with the notes that should appear in GitHub release assets/description.

## Repository relationship

This project is intentionally separate from the macOS app repository.

```text
ZManager/
  private macOS SwiftUI app repo
  cli/ -> public zmanager Rust CLI/core submodule

zmanager-desktop/
  Windows/Linux Tauri shell
  consumes zmanager-core from the public Rust repo
```

The local bootstrap dependency points at the sibling macOS checkout by default:

```text
../ZManager/cli/crates/zmanager-core
```

When this becomes a standalone repository, replace the local path dependency with
a Git dependency or a checked-out submodule of the public CLI/core repository.

## Product direction (engineering)

- Keep one shared Windows/Linux GUI project.
- Keep platform-specific integration in isolated Windows and Linux modules.
- Do not move SwiftUI, Finder Sync, Quick Look, signing, or notarization work into this repo.
- Do not duplicate archive logic; keep core archive behavior in `zmanager-core`.
- Keep the GUI as orchestration and presentation over the Rust job model.

## Stack

- Tauri 2 for Windows and Linux shell.
- Vite and TypeScript for UI state and shared logic.
- Rust Tauri commands for app-facing operations.
- `zmanager-core` for planning, listing, testing, extraction, creation, safety, and job events.

## Local development

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

## Linux build prerequisites

Ubuntu/Debian builds need Rust 1.85+ and native dependencies for the Tauri and
archiving stack.

```sh
sudo apt-get update
sudo apt-get install build-essential ca-certificates cmake curl file gnupg libacl1-dev libayatana-appindicator3-dev libbz2-dev libexpat1-dev libgtk-3-dev liblz4-dev libxml2-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf
```

These packages provide `cmake` for the bundled libarchive build and the GTK/WebKit
`pkg-config` dependencies required by the Rust build.

## Debian package build

```sh
scripts/build-linux-ubuntu-deb.sh
```

- `--install-deps`: installs Ubuntu packages, Node.js 20, and Rust via rustup when needed.
- `--skip-tests`: packaging-only mode.
- Build output is staged to `/tmp/zmanager-desktop-deb/`.
- Install via:

```sh
sudo apt-get install --reinstall /tmp/zmanager-desktop-deb/ZManager_0.1.0_amd64.deb
```

## Fedora RPM build

```sh
scripts/build-linux-fedora-rpm.sh
```

- `--install-deps`: installs Fedora Tauri/packaging dependencies, Node.js, and Rust when needed.
- `--no-install`: stop before host install, leave artifacts staged.
- Build output is staged to `/tmp/zmanager-desktop-rpm/`.

## Repository layout

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

## Current milestone focus

- healthcheck
- open archive
- browse entries
- extract archive
- create ZIP/TZST/TZAP/7Z
- password prompt through non-logging UI state
- progress and cancellation
- platform packaging

