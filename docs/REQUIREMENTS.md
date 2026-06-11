# Requirements

## Product Requirements

- Provide a Windows/Linux GUI over the existing ZManager Rust archive engine.
- Preserve archive safety behavior from `zmanager-core`.
- Support broad archive opening and extraction through the same format routing as the CLI.
- Support creation of ZIP, TZST, TZAP, and 7z archives.
- Support clean source archive planning and creation.
- Support encrypted archive workflows without logging or persisting passwords.
- Show job lifecycle, progress, diagnostics, warnings, cancellation, completion, and failure.
- Keep Windows and Linux as one shared desktop product with isolated platform integration.

## Functional Requirements

### Browse

- Open an archive through file picker, drag/drop, command-line open, and file association.
- List archive entries with path, type, size, packed size when known, and modified time when known.
- Filter and sort listed entries.
- Show safe, actionable errors when listing fails.

### Extract

- Extract whole archives to a selected destination.
- Extract selected entries to a selected destination.
- Support overwrite policy choices exposed by the core.
- Preserve safe extraction checks from the core.
- Prompt for passwords when required.
- Show progress and support cancellation.

### Create

- Create ZIP, TZST, TZAP, and 7z archives.
- Support multiple input files/directories.
- Support clean source mode.
- Show a pre-create plan with included and excluded entries when available.
- Support password entry for encrypted formats.
- Show progress and support cancellation.

### Jobs

- Maintain a visible job list.
- Show current entry, bytes processed, total bytes when known, throughput when available, warnings, and terminal status.
- Keep completed job summaries visible until dismissed.
- Do not leave the UI stuck when the backend returns an error.

### Preferences

- Store safe preferences only: default output directory behavior, default create format, theme choice, recent files count, and update channel if added.
- Do not store passwords.
- Do not store archive entry contents.

## Platform Requirements

### Windows

- Build native Windows installers.
- Support Explorer context menu actions for compress and extract.
- Support archive file associations.
- Support high-DPI displays.
- Handle Windows path rules, reserved names, long paths, drive letters, and case-insensitive collisions.
- Prepare for code signing before public release.

### Linux

- Build portable packages.
- Register `.desktop` launcher metadata.
- Register MIME associations for supported archive formats.
- Support common XDG desktop behavior.
- Treat file-manager extensions as optional follow-up because Linux file managers are fragmented.

## Nonfunctional Requirements

- The app must remain responsive during long archive operations.
- Long-running work must be cancelable.
- Archive operations must not run on the frontend thread.
- Error messages must be actionable and not leak secrets.
- Release builds must pin the Rust engine version.
- Dependencies must be auditable for license and supply-chain risk.
- Generated release artifacts must be reproducible enough for maintainer validation.

## Security Requirements

- Never pass passwords through process arguments.
- Never log passwords.
- Never persist passwords.
- Never bypass core extraction safety.
- Never trust archive paths from backend metadata without core validation.
- Keep temporary preview/extraction roots scoped and cleaned up.
- Keep platform shell integrations narrow and auditable.

## Acceptance Criteria For MVP

- The app launches on Windows and Linux.
- The app displays a successful `zmanager-core` healthcheck.
- A user can open and browse a ZIP archive.
- A user can extract a ZIP archive to a selected destination.
- A user can create a TZST archive from a folder.
- A user can cancel a long-running job.
- A password-required archive produces a password prompt instead of a silent failure.
- Packaging produces at least one Windows installer and one Linux portable package.

