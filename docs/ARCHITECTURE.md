# Architecture

## Layering

```text
Windows/Linux desktop shell
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
- `extract_entry`
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

Owns the main tabs: Browse, Create, Jobs, Settings. It renders state and dispatches Tauri commands.

### Windows Shell Integration

Owns Explorer context menu registration, file associations, installer hooks, and Windows path integration.

### Linux Shell Integration

Owns `.desktop` files, MIME registration, AppImage/Flatpak/deb/rpm packaging hooks, and XDG integration.

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

## Error Model

Errors should include:

- short code
- user-facing message
- optional recovery hint
- severity
- whether retry is useful

Errors must not include passwords, raw command-line strings, or sensitive path data beyond what the user selected.

## Platform Strategy

Windows and Linux share the app workspace. Platform-specific behavior should be behind `cfg(target_os = "...")` Rust modules or packaging scripts.

Do not create separate products until a platform requirement cannot be cleanly isolated.

