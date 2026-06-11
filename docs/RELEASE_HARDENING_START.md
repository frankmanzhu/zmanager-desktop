# Release Hardening Start Checklist

This file tracks the initial hardening work from Slice 11.

## Current state
- Command-layer tests now cover: validation, password handling, list mapping, and error normalization.
- Core integration remains in Rust boundary; frontend avoids archive logic.

## In-progress hardening tasks
- [x] Add command-boundary tests for validation, password handling, and error mapping.
- [x] Add path-edge unit tests for path normalization and archive-family detection (Windows style paths, separators, backslash paths).
- [x] Add command-boundary tests for path normalization trimming/whitespace and permission error mapping.
- [x] Add command-boundary tests for real create/extract lifecycle behavior (using fixtures).
- [x] Add Windows and Linux path edge-case tests (reserved names, long path handling, permissions, and case collision behavior against real FS semantics).
- [x] Add fixture sync from public core repository for deterministic archive test coverage.
- [x] Add dependency/license audit steps for frontend and Rust dependencies.
- [x] Pin `zmanager-core` for release (tag or vendored submodule) and document expected resolution path.
- [x] Review and tighten Tauri security policy before release.
- [x] Add crash-safe cleanup for preview directories and partial outputs.
- [ ] Capture platform smoke-test matrix outcomes (Windows + Linux install/launch/open tests).

## Fixture sync runbook

Use this when release hardening is completed and deterministic fixture coverage is required:

- `scripts/sync-core-fixtures.ps1` (Windows) and `scripts/sync-core-fixtures.sh` (Unix) copy fixtures into `docs/fixtures`.
- If `../ZManager` exists, sync selected deterministic fixtures into `docs/fixtures`:
  - `pwsh`:
    - `if (Test-Path ..\\ZManager\\cli\\tests\\fixtures) { Copy-Item -Recurse -Force ..\\ZManager\\cli\\tests\\fixtures -Destination docs\\fixtures }`
  - `bash`:
    - `if [ -d ../ZManager/cli/tests/fixtures ]; then mkdir -p docs/fixtures && cp -R ../ZManager/cli/tests/fixtures/. docs/fixtures/; fi`
- Record fixture source tag/commit in each PR where fixtures are added.
- Add fixture refresh notes into release PR checklist.
- Release note: if fixture sync is not possible in the current environment, document the skip reason and keep `docs/fixtures` in repo-sync state for future runs.

## Release dependency hardening helpers

- `scripts/run-dependency-audits.ps1` and `scripts/run-dependency-audits.sh`:
  - Run frontend and Rust dependency audits in one command.
  - Emit Markdown output under `docs/reports/` for archival.
- `scripts/pin-zmanager-core-release.ps1` and `scripts/pin-zmanager-core-release.sh`:
  - Replace local `path = "../../ZManager/cli/crates/zmanager-core"` with a pinned git tag dependency for release packaging.
  - Default repository target: `https://github.com/frankmanzhu/zmanager`.
  - Default tag fallback: `v1.0.3`.

## Release platform smoke-test outcomes

- Track final smoke-test evidence in `docs/platform-smoke-test-results.md`.
- Each run entry should include installer artifact, install version, evidence of launch, archive open, and completed extract with cleanup.
- Capture matrix rows with:
  - PowerShell: `.\scripts\append-platform-smoke-test-result.ps1 -Platform "Windows 11" -OS "Windows 11" -Artifact "<artifact>" -InstallStep "<artifact-or-run command>"`
  - Bash: `./scripts/append-platform-smoke-test-result.sh "Ubuntu 22.04" "Ubuntu 22.04" "<artifact>" "<artifact-or-run command>"`

### Release audit/runbook (seeded for slice 11)

- Frontend dependency audit:
  - `npm ls --depth 0`
  - `npm audit --audit-level high`
- Rust dependency + license audit:
  - `cd src-tauri`
  - `cargo audit` (if unavailable, install with `cargo install cargo-audit`)
  - `cargo tree --depth 1`
- Tauri security hardening review before release:
  - confirm `src-tauri/tauri.conf.json` CSP policy is intentional and not `null`
  - confirm plugin permissions and window IPC exposure are scoped to required commands only
- Preview/partial-output cleanup runbook:
  - verify `replace_preview_root` is called before writing new preview output
  - verify `cleanup_preview_roots` is called on drop or app exit hooks
  - verify the preview-root cleanup test in `src-tauri/src/job_registry.rs` remains green
- Release `zmanager-core` pin:
  - replace local `path` dependency with explicit tagged git ref or vendored submodule before release packaging
  - record tag/commit hash in `src-tauri/Cargo.toml` and PR notes

## Platform smoke-test matrix (seed)

Capture each run in release PR:

- Windows 11 clean VM
  - Install from `nsis` artifact
  - Launch app, open supported archive, run extract to an existing folder, dismiss completed job
- Ubuntu 22.04 clean VM
  - Install AppImage (`appimage` target)
  - Launch app, open supported archive, run extract to an existing folder, dismiss completed job

## Notes
- Slice 10 platform integration now has a shared runtime contract surface exposed through:
  - `src-tauri/src/platform/mod.rs`
  - `src-tauri/src/platform/windows.rs`
  - `src-tauri/src/platform/linux.rs`
- `project_contract` now exposes integration metadata:
  - `platform_integration` in `ProjectContract`
  - surfaced to settings/contract UI in `main.ts`
- Slice 11 verification commands remain pending until release branch:
  - `npm run build`
  - `cd src-tauri && cargo test`
  - `npm run tauri build`
