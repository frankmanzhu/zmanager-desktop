# Phase 8 — Asynchronous Finder file promises

- Completed: 2026-07-18
- Source revision: `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b` plus the recorded working-tree migration
- Result: PASS

## Implemented ownership path

macOS drag-out now creates a bounded Rust `NativeDragSessionRegistry` entry and
one `NSFilePromiseProvider` for each promised top-level file or directory. The
command returns `pending` and a session identifier immediately. Archive bytes
are streamed by the pinned core only after Finder supplies a destination URL;
macOS no longer performs eager payload staging.

Registry-owned closures retain the archive path and optional password only for
the promise lifetime. Promise callbacks claim an item before streaming so a
duplicate callback cannot race it. Separate top-level promises can stream
concurrently. Cancellation and shutdown set a shared cancellation flag checked
by the destination writer, interrupt active streams, and remove partial output.

Directory promises materialize nested contents under a create-new root.
Existing destinations are never overwritten or deleted. Path validation rejects
parent traversal, empty/overlong components, case-fold collisions, and Unicode
normalization collisions before bytes are written. Sessions are bounded to 16,
expire after 15 minutes, and the Swift lease releases Rust context exactly once
after completion, cancellation, or abandonment.

## Automated proof

`cargo test native_drag_session` passes 9 tests covering:

- zero stream calls before a destination exists;
- files and nested directory materialization;
- concurrent top-level callbacks;
- duplicate callback exclusion;
- active cancellation and partial-output cleanup;
- idempotent cancellation and shutdown;
- destination conflict/no-overwrite behavior;
- case and Unicode-equivalent top-level and nested collisions; and
- overlong path components.

The command code skips payload preflight on macOS while retaining it for the
Linux staging and Windows virtual-file implementations. Frontend tests prove
that pending session outcomes are reconciled from the asynchronous native event.
The Swift host test and installed linkage gate prove the file-promise delegate
does not start the fake Rust stream until a destination is supplied.

## Installed proof and ownership deletion

The installed v6 application in VM snapshot
`{6d9cc999-31a1-4801-8b16-50035986663e}` passes the deferred file-promise host
self-test from the packaged executable. The macOS `drag` crate path and eager
payload staging were deleted. Linux and Windows retain their platform-owned
delivery implementations.
