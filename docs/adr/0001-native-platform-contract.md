# ADR-0001: Enforce a complete native platform contract

- Status: Accepted
- Date: 2026-07-11
- Extended by: ADR-0009 (first-class capabilities must report unavailable,
  never return an unconditional observable fallback while enabled)

## Context

The Desktop Shell calls a small set of native operations for platform
registration, integration metadata, system file icons, and native file drag.
Windows and Linux previously exposed matching free functions through conditional
re-exports. Their matching shape was conventional rather than compiler-enforced,
and every non-Windows target was incorrectly routed to the Linux module.

Maintainers need to be able to move platform work between Windows and Linux and
immediately see the complete implementation checklist. A future supported target
must not compile until it implements the same native capabilities.

## Decision

`src-tauri::platform` owns a `NativePlatform` interface containing the complete
native capability set required by the Desktop Shell. Each supported operating
system supplies one adapter that implements the interface. `ActivePlatform` is
selected only with an explicit `target_os` condition, and platform-neutral
wrapper functions are the sole interface used by commands and application setup.

Targets without an adapter fail compilation with a descriptive error. An
individual native operation may still return its documented fallback result,
such as no system icon bitmap, but the operation itself must be implemented.

## Consequences

- Missing adapter methods are compiler errors on that platform.
- Callers remain independent of platform selection and native implementation
  details.
- Windows, Linux, and macOS behavior stays local to their respective adapter modules.
- Supporting another operating system requires an explicit module, adapter, and
  `ActivePlatform` selection; it can never silently use Linux behavior.
- The contract is static and does not support runtime platform switching, which
  matches Rust target compilation and Tauri packaging.

## Verification

- `cargo test platform::tests` proves the active target satisfies the complete
  interface and retains its integration profile.
- `cargo test` on every supported operating system compiles that operating
  system's adapter through `ActivePlatform`.
- Host and VM builds compile each supported adapter; packaging remains explicit
  for the platforms that this repository ships.
