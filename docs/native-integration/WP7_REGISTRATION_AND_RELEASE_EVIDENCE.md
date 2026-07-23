# WP7: Registration, Package Inspection, and Release Evidence

## Goal Completed
Give every platform the same trackable lifecycle and evidence schema without unifying native registration commands.

## Work Completed

1. **Evidence Schema**: Defined `manifests/release-evidence-schema.json` containing:
   - product identity and version
   - package kind and architecture
   - artifact paths and hashes
   - expected capabilities
   - package content inspection
   - registration results
   - installed state
2. **Platform Package Inspectors**: Implemented as native adapters:
   - Windows: `scripts/inspect-windows-package.ps1`
   - Linux: `scripts/inspect-linux-package.sh`
   - macOS: `scripts/inspect-macos-package.sh`
3. **Dynamic Artifact Versioning**: Replaced hard-coded `0.1.0` artifact paths in Windows static scripts (`release-gate-windows-static.ps1` and `smoke-windows-static.ps1`) with dynamically resolved paths via `package.json`.
4. **Shell-extension tests**: Shell extension integration tests were confirmed as mandatory steps within `build-windows-static.ps1`.
5. **Linux Package Content Proof**: Replaced fake Linux package-content proofs with actual archive inspections via the new inspector script in both `build-linux-ubuntu-deb.sh` and `build-linux-fedora-rpm.sh`.
6. **Matrix Generation**: Added `scripts/generate-smoke-matrix.mjs` to parse generated evidence JSON records and generate a human-readable `SMOKE_MATRIX.md`.

## Exit Criteria Proven
- Windows, Linux, and macOS release jobs can now publish comparable evidence through common inspection records.
- Artifact names and versions are successfully derived from the `package.json` product version globally.
- Registration mechanics remain platform-local while satisfying the unified evidence contract.
