# WP4 Archive Association And Package Catalog

- Status: complete
- Date: 2026-07-23

## Reconciled result

The scattered, independently maintained lists of file extensions and MIME types have been unified into a single semantic catalog in `manifests/archive-file-types.json`. This catalog now owns the primary extensions, compound extensions, split suffixes, MIME types, macOS UTI descriptors, and platform applicability.

From this single source of truth, we now generate:
- Rust and TypeScript metadata (`src-tauri/src/generated/archive_file_types.generated.rs`, `src/app/generated/archiveFileTypes.generated.json`).
- Cross-platform packaging configurations:
  - Tauri `fileAssociations` in `tauri.conf.json`.
  - Windows NSIS definitions in `packaging/windows/nsis-shell-actions.generated.nsh`.
  - macOS `Info.plist` document types and exported types in `native/macos/Generated/InfoPlist.archive-types.generated.plist`.
  - Linux desktop MIME files and desktop entry handlers (`packaging/linux/nautilus/zmanager_shell_actions_generated.py`, `zmanager-archive-servicemenu.desktop`).

We also explicitly separate archive *engine support* from the *package registration profile*. `archive-file-types.json` declares which types are actually registered for Windows, Linux, and macOS packages via `packageAssociationProfiles`, ensuring that runtime reporting does not hallucinate registered capabilities that the package didn't configure.

## Automated proof

- `node --test scripts/archive-association-contract.test.mjs` validates the contract, rejecting duplicate aliases, missing mappings, and invalid compound extensions.
- `npm run check:generated-contracts` ensures all derived packaging, frontend, and Rust files match the single catalog.
- `npm run test:architecture` ensures that the unified file extensions completely partition the legacy static tests without regressions (including baseline compatibility).
