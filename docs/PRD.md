# Product Requirements: ZManager Desktop For Windows And Linux

> Status: Superseded by `MACOS_FULL_TARGET_MIGRATION_EXECUTION_PLAN.md` and
> ADR-0004 for platform scope. Retained as historical Windows/Linux inception
> context; its separate-macOS constraints are not governing policy.

## Problem Statement

ZManager already has a complete Rust CLI/core and a complete native macOS GUI. Users on Windows and Linux can use the CLI, but they do not have a graphical archive manager that exposes ZManager's safe extraction, broad archive listing, clean source creation, encrypted archive workflows, and progress UI in a desktop-native way.

The macOS GUI should remain a Mac-native SwiftUI product. Windows and Linux need a separate shell that shares the Rust archive engine without duplicating product logic or splitting the Windows and Linux experience into two unrelated applications.

## Solution

Build one Windows/Linux desktop project using Tauri. The app provides a shared archive manager workspace for both platforms, backed by the existing Rust `zmanager-core` job model. Platform-specific work is isolated to shell integration and packaging modules.

The desktop shell should support the same core workflows as the macOS app:

- open and inspect archives
- extract whole archives
- extract selected entries
- create ZIP, TZST, TZAP, and 7z archives
- create clean source archives
- handle passwords safely
- show progress, diagnostics, cancellation, and completion
- integrate with platform file associations and context menus

## User Stories

1. As a Windows user, I want to open an archive from the app, so that I can inspect its contents before extracting it.
2. As a Linux user, I want to open an archive from the app, so that I can inspect its contents without using the terminal.
3. As a desktop user, I want to drag an archive into the app, so that I can quickly browse or extract it.
4. As a desktop user, I want to double-click a supported archive file, so that ZManager opens it directly.
5. As a desktop user, I want to see archive entries in a sortable table, so that I can find files quickly.
6. As a desktop user, I want to filter archive entries by path text, so that large archives remain navigable.
7. As a desktop user, I want to see entry type, size, packed size, and modified time, so that I can understand archive contents.
8. As a desktop user, I want to extract a full archive to a chosen destination, so that I control where files are written.
9. As a desktop user, I want to extract selected entries, so that I do not need to unpack an entire archive.
10. As a desktop user, I want unsafe archive paths to be blocked by default, so that downloaded archives cannot escape the destination.
11. As a desktop user, I want overwrite conflicts to be handled deliberately, so that extraction does not destroy existing files unexpectedly.
12. As a desktop user, I want case-collision issues to be detected, so that extraction behaves safely on case-insensitive filesystems.
13. As a desktop user, I want symlink and hardlink escapes to be blocked, so that archives cannot write outside the destination through links.
14. As a desktop user, I want zip-bomb-like archives to be rejected or guarded, so that extraction cannot consume unbounded disk space.
15. As a desktop user, I want to create ZIP archives, so that I can share files broadly.
16. As a desktop user, I want to create TZST archives, so that I can create fast modern compressed archives.
17. As a desktop user, I want to create TZAP archives, so that I can create encrypted recoverable archives.
18. As a desktop user, I want to create 7z archives, so that I can create high-compression encrypted archives.
19. As a developer, I want to create clean source archives, so that `.git`, dependencies, caches, and build outputs are excluded.
20. As a developer, I want to preview clean source exclusions, so that I trust what will be included before creating an archive.
21. As a desktop user, I want password prompts to avoid logs and command arguments, so that secrets stay private.
22. As a desktop user, I want the app to prompt when an archive requires a password, so that extraction can continue without restarting.
23. As a desktop user, I want visible job progress, so that I know whether long operations are moving.
24. As a desktop user, I want cancellation, so that I can stop a long operation.
25. As a desktop user, I want clear failure messages, so that I can decide what to do next.
26. As a desktop user, I want recent archives, so that I can return to files I used recently.
27. As a Windows user, I want Explorer context menu actions, so that I can compress or extract from the file manager.
28. As a Linux user, I want MIME associations and desktop-file registration, so that archives open with ZManager.
29. As a Linux user, I want a portable package, so that I can run ZManager across distributions.
30. As a Windows user, I want a signed installer, so that installation feels trustworthy.
31. As a maintainer, I want one shared Windows/Linux shell, so that product behavior does not diverge unnecessarily.
32. As a maintainer, I want platform integration isolated, so that Windows and Linux packaging can evolve independently.
33. As a maintainer, I want command-boundary tests, so that UI changes do not break archive behavior.
34. As a maintainer, I want release artifacts tied to a pinned Rust core version, so that app releases are reproducible.
35. As a maintainer, I want the app to preserve the existing open CLI/closed GUI boundary, so that public and private source boundaries remain clear.

## Implementation Decisions

- Build one Windows/Linux GUI project, not two separate projects.
- Keep the existing macOS SwiftUI app in its current repository.
- Use Tauri 2 as the Windows/Linux shell.
- Use TypeScript and Vite for the shared UI.
- Call `zmanager-core` from Rust Tauri commands rather than reimplementing archive logic in the frontend.
- Keep a small app-facing command layer with stable operations: healthcheck, list, test, plan create, start create, start extract, extract entry, preview entry, cancel job, poll events.
- Keep archive job state in Rust where practical, with frontend state focused on presentation.
- Return normalized, serializable DTOs from Tauri commands.
- Keep passwords in transient command payloads only. Do not store them in app preferences, logs, recent files, or persisted frontend state.
- Keep Windows Explorer integration in a Windows-owned module.
- Keep Linux `.desktop`, MIME, and file-manager integration in a Linux-owned module.
- Start Linux packaging with AppImage and either `.deb`/`.rpm` or Flatpak after the MVP is stable.
- Start Windows packaging with NSIS or MSIX, then add WinGet metadata after signing decisions are made.
- Do not add macOS packaging, Finder Sync, Quick Look, or notarization code to this repo.

## Testing Decisions

- Command-layer tests should cover external behavior and serialized responses.
- Tests should validate request mapping, error normalization, password-required flow, cancellation, and job event ordering.
- Platform path tests should cover Windows drive letters, reserved names, backslashes, long paths, case collisions, and Linux permission behavior.
- Integration tests should reuse the existing fixture corpus from the public CLI/core repository where possible.
- UI tests should cover visible state transitions: empty workspace, listing loaded, job running, password required, job completed, job failed, and cancelled.
- Packaging smoke tests should verify file associations, context menu registration where available, and launch from installed package.

## Out Of Scope

- Rewriting the macOS SwiftUI app.
- Moving Finder Sync or Quick Look code into this repository.
- Creating separate Windows-only and Linux-only GUI products.
- Reimplementing archive parsing or extraction in TypeScript.
- Adding cloud storage, sync, or collaboration workflows.
- Supporting mobile platforms.
- Creating legacy archive formats beyond what `zmanager-core` already supports.

## Further Notes

The Windows/Linux app should feel like a quiet operational utility. The value is reliability, safety, broad extraction, clean source creation, and clear progress. It does not need a marketing-heavy UI.
