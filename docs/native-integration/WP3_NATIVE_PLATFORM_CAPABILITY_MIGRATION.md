# WP3 Native Platform Capability Migration

- Status: complete
- Date: 2026-07-23

## Reconciled result

The former broad `NativePlatform` trait was replaced with capability-family
interfaces for profile composition, capability inspection, main-window
configuration, system icons, default-handler control, Replacement Migration,
secure local-file protection, and native drag. macOS-only lifecycle, menu, URL
event, Finder transport, and shutdown operations remain in the macOS adapter
instead of requiring successful no-ops from Windows and Linux.

Native operations use typed `notApplicable`, `unavailable`, and `failed`
outcomes. Windows and Linux Replacement Migration no longer return empty
successes, default-handler control no longer emits platform-name-bearing
unsupported strings, and Windows owner-only protection reports its missing ACL
implementation rather than succeeding. Linux and macOS owner-only success is
verified as mode `0600`.

Replacement Migration checks applicability before resolving application data,
home, temporary, or legacy macOS paths. Native drag no longer exposes a
preflight boolean; preflight policy is contained by the native platform seam.
Its start result is explicitly either a pending session or a settled outcome,
so callers do not interpret an optional session identifier by operating system.

The capability catalog now includes `secureLocalFileProtection`, making this
security obligation visible in the same layered contract.

## Automated proof

- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml platform::`
- `cargo test --manifest-path src-tauri/Cargo.toml replacement_migration::`
- `cargo test --manifest-path src-tauri/Cargo.toml default_handlers::`
- Native capability manifest and generated-contract architecture tests

Windows-specific `notApplicable` and ACL-unavailable assertions are compiled and
run by the Windows matrix in WP8. Linux runs the same interface assertions plus
the real owner-only mode proof.
