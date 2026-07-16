# ADR-0003: Keep drag policy and window capabilities platform-owned

- Status: Accepted
- Date: 2026-07-15
- Superseded in part by: ADR-0004 (macOS full-target ownership) and ADR-0008
  (macOS asynchronous file-promise drag). Linux staging remains accepted.

## Context

The native drag command selected archive entries correctly but then applied
Windows separators, reserved-name rules, UTF-16 limits, and case-insensitive
collision checks before calling `NativePlatform`. Linux was therefore unable to
drag valid names such as `question?.txt` or case-distinct files. Main-window
decorations were also selected in `main.rs`, while the frontend inferred Linux
custom chrome from `navigator.userAgent`.

These leaks made the native seam incomplete and prevented a macOS adapter from
describing its own filesystem and window behavior.

## Decision

`NativePlatform` owns preparation of native drag items, including separators,
filename validity, path limits, collision comparison, and staging requirements.
The shared command owns archive request validation, entry selection, folder
expansion, preflight, and core-backed streaming only.

The platform profile exposes capability-oriented window values for native
decorations, application-owned chrome, and manual resize dispatch. Each adapter
also configures the Main Window through the shared platform interface. The
frontend consumes those capabilities during bootstrap and contains no browser
metadata operating-system detection.

Windows retains virtual `FILEDESCRIPTORW` drag behavior and Windows filename
policy. Linux stages POSIX paths with case-sensitive collision checks. macOS
stages Finder drag paths with conservative case-insensitive collision checks and
dispatches the drag through the Rust `drag` module. Archive bytes still come
only from `zmanager-core` streaming.

Integration metadata uses selected-item actions, background actions, and file
associations rather than Explorer- or freedesktop-specific flags.

## Consequences

- The command seam no longer changes when native filename rules change.
- Linux accepts names that are valid on Linux but invalid on Windows.
- Adding a supported target requires explicit drag, window, profile, and icon
  behavior before compilation succeeds.
- macOS runtime support may produce local unnotarized Tauri `.app` and `.dmg`
  bundles, but does not move Finder Sync, Quick Look, signing, notarization, or
  release packaging for the separate Swift application into this repository.
- Staged Linux and macOS drops retain temporary content briefly after a
  successful drop so the destination file manager can finish copying it.

## Verification

- Platform tests cover separators, stripping, unsafe components, collision
  semantics, Windows reserved names and path limits, and staged cleanup.
- Frontend tests prove chrome and resize classes come from profile capabilities.
- Architecture checks reject production OS selection or native imports outside
  `src-tauri::platform`, frontend navigator-based OS detection, and Windows drag
  policy in the shared command module.
- macOS host tests compile and exercise the active adapter; Windows and Linux
  adapters are compiled and tested in their native environments.
