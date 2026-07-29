# Architecture

## Layering

```text
Cross-platform Tauri desktop shell
  TypeScript UI, window state, dialogs, filtering, presentation

Tauri command layer
  app-facing command DTOs, job registry, platform integration

zmanager-core
  archive planning, listing, extraction, creation, safety, format routing

backend crates
  zip, tar/zstd, TZAP, 7z, libarchive, UnRAR
```

The frontend must not implement archive parsing or extraction. It calls Tauri commands and renders command results.

## Command Boundary

The command boundary should be stable and coarse-grained:

- `healthcheck`
- `list_archive`
- `test_archive`
- `plan_create`
- `start_create`
- `start_extract`
- `preview_entry`
- `poll_job_events`
- `cancel_job`
- `dismiss_job`

Commands should return serializable DTOs. The DTOs are allowed to differ from core structs when the UI needs a stable presentation contract.

## Deep Modules

### Desktop Command Core

Owns request validation, calls into `zmanager-core`, maps core errors into UI-safe errors, and returns DTOs.

### Job Registry

Owns long-running job handles, cancellation, event polling, and cleanup. The frontend should never hold raw core handles.

### Archive Workspace UI

Owns the main workspace modes: Browse and Create. It renders state and
dispatches Tauri commands. Long-running compress and extract operations
open a Disposable Task Window — a separate OS window (620×460) that shows
live progress, handles pause/cancel, and auto-closes on completion. There is
no job drawer, no shared job history, and no in-workspace progress overlay.
Each operation is an independent fire-and-forget unit, like 7-Zip's 7zG.exe.
See [`adr/0016-pure-7z-job-architecture.md`](adr/0016-pure-7z-job-architecture.md).

User-visible text belongs at the display boundary. Keep internal state, command DTOs,
job events, and archive behavior language-neutral, then render labels and messages
through the frontend localization layer. See
[`I18N_DISPLAY_ISOLATION_PLAN.md`](I18N_DISPLAY_ISOLATION_PLAN.md).

### Windows Shell Integration

Owns Explorer context menu registration, file associations, installer hooks, and Windows path integration.

### Linux Shell Integration

Owns `.desktop` files, MIME registration, AppImage/Flatpak/deb/rpm packaging hooks, and XDG integration.

### macOS Runtime Integration

`src-tauri::platform::macos` owns the bounded Rust Adapter. The Swift/AppKit
macOS Native Host owns lifecycle, Services, menus, Launch Services, icons, and
file-promise presentation. The Native Launch Inbox buffers typed callbacks until
the React shell is ready. Native Drag Sessions retain core handles and secrets
only for the lifetime of asynchronous promises. The Finder, Quick Look,
thumbnail, and Spotlight Extension Suite is built under `native/macos` and uses
generated contracts or the Public Metadata FFI. One Release Bundle pipeline
owns nesting, identity, signing, notarization, stapling, installation, and
replacement migration.

Swift/AppKit contains no application-owned product screen and no archive
semantics. Quick Look and Spotlight can parse only bounded public metadata.

### Native Integration Contract

`manifests/native-capabilities.json` is the semantic catalog for native
capabilities across Windows, Linux, and macOS. It records applicability, source
expectations, package kinds, installed probes, user-enabled state, runtime
readiness requirements, normalized failures, and evidence identifiers.

`project_contract` reports the current package kind explicitly and exposes one
snapshot per catalog capability. These layers remain independent:

1. source support;
2. package inclusion;
3. installed registration;
4. user-enabled state; and
5. runtime readiness.

The normalized capability outcome is `available`, `unavailable`, `failed`, or
`notApplicable`. An available first-class capability must have real source
support and every layer required by its catalog declaration. Package or
installed state is never inferred from the operating-system name.

The frontend branches on capability identity and state. It may display the
platform name as diagnostic information, but it must not use that name to
select behavior. Native adapters retain their operating-system mechanisms while
the contract provides shared meaning and comparable evidence.

## Data Flow

```text
User action
  -> TypeScript view command
  -> Tauri invoke
  -> Rust command DTO validation
  -> zmanager-core operation or job start
  -> normalized result or job id
  -> frontend state update
  -> poll events for long-running work
```

Native macOS callbacks enter through a second, typed ingress:

```text
AppKit/Finder/single-instance callback
  -> versioned native event or ShellActionRequest
  -> Native Launch Inbox (ordered, bounded, deduplicated)
  -> frontend-ready drain and acknowledgement
  -> shared command router/workspace/controller
```

## Error Model

Errors should include:

- short code
- user-facing message
- optional recovery hint
- severity
- whether retry is useful

Errors must not include passwords, raw command-line strings, or sensitive path data beyond what the user selected.

## Platform Strategy

Windows, Linux, and macOS share the app workspace. In-process platform selection
and behavior live behind `src-tauri::platform`; packaging scripts and external
shell integrations remain explicit platform adapters at their own seams.

Do not create separate products until a platform requirement cannot be cleanly isolated.
