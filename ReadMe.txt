# zmanager-desktop v0.1.0

## What's New

- First release of the Windows and Linux Tauri desktop shell for the ZManager Rust archive engine.
- Added multi-platform packaging in CI:
  - Windows x64 installer + portable executable
  - Windows ARM64 installer + portable executable
  - Linux x64 and ARM64 DEB packages
  - Linux x64 and ARM64 RPM packages
- Included SHA256SUMS manifest for artifact integrity verification.
- Release workflow now normalizes artifact names for easier distribution and selection.

## Download Assets

Use the release assets on GitHub:

- `zmanager-desktop-0.1.0-windows-x64-installer.exe`
- `zmanager-desktop-0.1.0-windows-x64-portable.exe`
- `zmanager-desktop-0.1.0-windows-arm64-installer.exe`
- `zmanager-desktop-0.1.0-windows-arm64-portable.exe`
- `zmanager-desktop-0.1.0-linux-x64.deb`
- `zmanager-desktop-0.1.0-linux-arm64.deb`
- `zmanager-desktop-0.1.0-linux-x64.rpm`
- `zmanager-desktop-0.1.0-linux-arm64.rpm`
- `zmanager-desktop-0.1.0-SHA256SUMS.txt`

## Verification

Validate the download integrity with:

```bash
sha256sum -c zmanager-desktop-0.1.0-SHA256SUMS.txt
```

## Verification Notes

- Use SHA256SUMS output in the same directory as downloaded assets.
- If an artifact mismatches checksum, do not use that file and report the issue.
