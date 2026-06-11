# Release Hardening Start Checklist

This file tracks the initial hardening work from Slice 11.

## Current state
- Command-layer tests now cover: validation, password handling, list mapping, and error normalization.
- Core integration remains in Rust boundary; frontend avoids archive logic.

## In-progress hardening tasks
- [x] Add command-boundary tests for validation, password handling, and error mapping.
- [x] Add path-edge unit tests for path normalization and archive-family detection (Windows style paths, separators, backslash paths).
- [x] Add command-boundary tests around path normalization trimming/whitespace and permission error mapping.
- [ ] Add command-boundary tests for real create/extract lifecycle behavior (using fixtures).
- [ ] Add Windows and Linux path edge-case tests (reserved names, long path handling, permissions, and case collision behavior against real FS semantics).
- [ ] Add fixture sync from public core repository for deterministic archive test coverage.
- [ ] Add dependency/license audit steps for frontend and Rust dependencies.
- [ ] Pin `zmanager-core` for release (tag or vendored submodule) and document expected resolution path.
- [ ] Review and tighten Tauri security policy before release.
- [ ] Add crash-safe cleanup for preview directories and partial outputs.
- [ ] Capture platform smoke-test matrix outcomes (Windows + Linux install/launch/open tests).

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
- Release `zmanager-core` pin:
  - replace local `path` dependency with explicit tagged git ref or vendored submodule before release packaging
  - record tag/commit hash in `src-tauri/Cargo.toml` and PR notes

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
