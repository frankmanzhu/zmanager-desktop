# Handoff For Next Agent

> Status: Superseded by `MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md` and
> ADR-0004. This scaffold handoff is historical evidence only.

## Current State

This is a fresh scaffold for the Windows/Linux GUI shell. The existing ZManager CLI/core and macOS GUI are already done. This project should not absorb the macOS app.

The initial Tauri scaffold includes:

- Vite/TypeScript frontend shell.
- Tauri 2 Rust app entry point.
- A `healthcheck` command calling `zmanager-core`.
- A `project_contract` command that documents the intended app command surface.
- Planning docs for product requirements, architecture, roadmap, and packaging.

## First Implementation Slice

Read `docs/IMPLEMENTATION_STEPS.md` before coding. It contains the detailed command contracts, DTOs, backend APIs, tests, and done criteria for each slice.

Start with the smallest vertical tracer bullet:

1. Run `npm install`.
2. Run `cd src-tauri && cargo check`.
3. Fix any dependency or local-path issues.
4. Run `npm run tauri dev`.
5. Confirm the UI displays the Rust engine healthcheck.
6. Add the first real command: archive listing.
7. Wire an Open Archive button through the Tauri dialog plugin.
8. Render entries in the Browse tab.

## Local Dependency Note

`src-tauri/Cargo.toml` currently points at:

```text
../../ZManager/cli/crates/zmanager-core
```

That is correct for the current local sibling checkout:

```text
/Users/frankzhu/IdeaProjects/ZManager
/Users/frankzhu/IdeaProjects/zmanager-desktop
```

Before publishing this as its own repository, decide between:

- Git dependency on `frankmanzhu/zmanager`.
- Git submodule under `vendor/zmanager`.
- Workspace sibling checkout documented for local development.

The cleanest release model is probably a Git dependency pinned by tag for releases, with a local path override for active development.

## Important Boundaries

- Do not edit `/Users/frankzhu/IdeaProjects/ZManager/gui` for this work.
- Do not copy SwiftUI app code.
- Do not reimplement archive parsing in TypeScript.
- Do not create separate Windows and Linux GUI apps unless there is a proven reason.
- Keep shell integration platform-specific, but keep the archive workspace shared.

## Open Questions

- Should the Windows/Linux UI visually match the macOS app or only match the workflow model?
- Should this repo stay private like the macOS GUI or become public like the CLI?
- Should packaging target MSIX first or NSIS first on Windows?
- Should Linux distribution start with AppImage, Flatpak, or both?
- Should Explorer context menu actions launch the GUI first, or directly run background operations with notification handoff?

## Good Next Commit

`Bootstrap Windows Linux desktop shell`
