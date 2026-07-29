# ZManager Desktop

[![Package](https://github.com/frankmanzhu/zmanager-desktop/actions/workflows/package.yml/badge.svg?branch=main)](https://github.com/frankmanzhu/zmanager-desktop/actions/workflows/package.yml)
[![Release](https://github.com/frankmanzhu/zmanager-desktop/actions/workflows/release.yml/badge.svg)](https://github.com/frankmanzhu/zmanager-desktop/actions/workflows/release.yml)
[![Release version](https://img.shields.io/github/v/release/frankmanzhu/zmanager-desktop?include_prereleases&label=release)](https://github.com/frankmanzhu/zmanager-desktop/releases)
[![Latest tag](https://img.shields.io/github/v/tag/frankmanzhu/zmanager-desktop?sort=semver&label=latest%20tag)](https://github.com/frankmanzhu/zmanager-desktop/tags)
[![Downloads](https://img.shields.io/github/downloads/frankmanzhu/zmanager-desktop/total)](https://github.com/frankmanzhu/zmanager-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A fast, open-source archive manager for Windows, Linux, and macOS, built on
`zmanager-core`.

![ZManager Desktop first-run Compress workflow](docs/gui-audit/00-readme-hero.png)

## Why this feels trustworthy

- Open-source, so archive behavior can be reviewed in code.
- Security-first handling stays in the Rust core (`zmanager-core`): path checks, overwrite policy, and normalization.
- Password input is handled in app state and is not logged.
- Every release includes checksums for verification.

## Get started in 60 seconds

1. Open [GitHub Releases](https://github.com/frankmanzhu/zmanager-desktop/releases/latest).
2. Download the latest installer for your OS:
   - **Windows:** `zmanager-desktop-<version>-windows-x64-installer.exe` or `...-windows-arm64-installer.exe`
   - **Linux:** `zmanager-desktop-<version>-linux-x64` or `...-linux-arm64` (`.deb` / `.rpm`)
   - **macOS:** `ZManager-<version>-macos-arm64.dmg` or `...-macos-x86_64.dmg`
3. Install and open the app.
4. Open or create an archive. Each accepted operation gets its own task window,
   while the reusable manager stays ready for more work.

### Package quick lookup

| Platform | Recommended package | Alt package |
|---|---|---|
| Windows x64 | `zmanager-desktop-<version>-windows-x64-installer.exe` | `zmanager-desktop-<version>-windows-x64-portable.exe` |
| Windows ARM64 | `zmanager-desktop-<version>-windows-arm64-installer.exe` | `zmanager-desktop-<version>-windows-arm64-portable.exe` |
| Linux x64 | `zmanager-desktop-<version>-linux-x64.deb` or `.rpm` | - |
| Linux ARM64 | `zmanager-desktop-<version>-linux-arm64.deb` or `.rpm` | - |
| macOS ARM64 | `ZManager-<version>-macos-arm64.dmg` | `.zip` |
| macOS x86_64 | `ZManager-<version>-macos-x86_64.dmg` | `.zip` |

## Formats and positioning

- ZIP, TZST, TZAP, 7Z
- 7-Zip is historically Windows-first.
- `TZAP` is the cross-platform format this project targets for resilient,
  secure, and fast workflows.

## For users who want to go deeper

- Release notes: [`ReadMe.txt`](./ReadMe.txt)
- Engine context: [`zmanager` README](https://github.com/frankmanzhu/zmanager/blob/main/README.md)
- TZAP context: [`TZAP` README](https://github.com/frankmanzhu/tzap/blob/main/README.md)

## Developer docs

- [Developer setup and build details](./docs/developer-setup.md)
- [Architecture overview](./docs/ARCHITECTURE.md)
- [Requirements](./docs/REQUIREMENTS.md)
