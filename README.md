# ZManager Desktop

ZManager Desktop is the Windows and Linux graphical shell for the ZManager Rust archive engine.

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

Ubuntu/Debian builds need Rust 1.85 or newer, Node.js, npm, and Tauri's native
GTK/WebKit development packages. On a fresh Ubuntu machine, install:

```sh
sudo apt-get update
sudo apt-get install build-essential curl file libayatana-appindicator3-dev libgtk-3-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf
```

These packages provide the `pkg-config` entries required by the Rust GTK stack,
including `libsoup-3.0` and `webkit2gtk-4.1`. Without them, Cargo can fail in
`soup3-sys` or WebKit-related build scripts.

Build an Ubuntu/Debian package with:

```sh
scripts/build-linux-ubuntu-deb.sh --skip-tests
```

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
