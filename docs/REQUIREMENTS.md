# Requirements

## Product Requirements

- Provide one Windows, Linux, and macOS GUI over the existing ZManager Rust archive engine.
- Preserve archive safety behavior from `zmanager-core`.
- Support broad archive opening and extraction through the same format routing as the CLI.
- Support creation of ZIP, TZST, TZAP, and 7z archives.
- Support clean source archive planning and creation.
- Support encrypted archive workflows without logging or persisting passwords.
- Show job lifecycle, progress, diagnostics, warnings, cancellation, completion, and failure.
- Retain a bounded local Diagnostic Log for packaged lifecycle troubleshooting;
  prefer the installation `logs/` directory, report any per-user fallback, and
  never include passwords, opaque request tokens, or selected paths.
- Keep all three platforms as one shared desktop product with isolated native integration.

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

- Open one Disposable Task Window for every accepted create, extract, or test Job,
  whether it was launched by the Main Window or a shell Quick Action.
- Keep the Main Window reusable while Jobs run. After Job Handoff, clear the
  submitted operation state and return the Main Window to a browse-ready state
  without waiting for completion.
- Allow multiple create, extract, and test Jobs to run concurrently, each with an
  independent task window.
- Show current entry, bytes processed, total bytes when known, throughput when
  available, warnings, controls, and terminal status in that Job's task window.
- Auto-close successful and cancelled task windows after brief acknowledgement.
  Keep failed task windows visible until the user dismisses them.
- Do not show a Main Window job drawer, shared job history, focused-progress
  mode, or in-workspace progress overlay.
- Do not leave either the manager or a task window stuck when the backend
  returns an error.

### Process and Window Lifecycle

- Register the single-instance plugin only for normal application and archive
  file-association launches.
- Run every explicit shell Quick Action in an independent application process
  that owns and consumes its request; Quick Actions must not join the normal
  singleton process or another Quick Action process.
- Keep the coordinator webview hidden for disposable Quick Actions, open one
  Disposable Task Window per accepted Job, and force-destroy the idle hidden
  coordinator after pending requests, active Jobs, and task windows settle.
- Auto-close successful and cancelled Disposable Task Windows after brief
  acknowledgement. Keep failed task windows visible for error inspection and
  recovery.
- Leave normal Main Window closure under explicit user control.

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

### macOS

- Replace the last native Swift release in place under `org.tzap-org.zmanager`.
- Build and embed the macOS Native Host and Finder, Quick Look, thumbnail, and Spotlight targets.
- Deliver cold and warm lifecycle, URL, document, Services, and reopen events through the Native Launch Inbox.
- Stream archive drag-out through asynchronous file promises and a Native Drag Session.
- Preserve default openers, preferences, preview cleanup, account/sharing flows, and upgrade state.
- Produce separate arm64 and x86_64 Developer ID signed, notarized, stapled artifacts.

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

## Acceptance Criteria

- The app launches on Windows, Linux, and macOS.
- The app displays a successful `zmanager-core` healthcheck.
- A user can open and browse a ZIP archive.
- A user can extract a ZIP archive to a selected destination.
- A user can create a TZST archive from a folder.
- A user can cancel a long-running job.
- A password-required archive produces a password prompt instead of a silent failure.
- Packaging produces verified Windows, Linux, macOS arm64, and macOS x86_64 artifacts.
- A clean macOS upgrade leaves one canonical application and preserves supported non-secret state.
