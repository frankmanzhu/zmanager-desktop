# Phase 5 — Native Launch Inbox and host lifecycle

- Completed: 2026-07-16
- Source revision: working tree based on the Phase 0 recorded revision
- Result: PASS

## Implemented ownership path

All cold-start, warm single-instance, AppKit open-document, URL, Services, and
reopen events now enter `NativeLaunchInbox`. The inbox is constructed before
Tauri, receives the Swift host callback before an `AppHandle` exists, attaches
its emitter during setup, and drains only after the frontend subscribes and
calls `native_frontend_ready`.

Events are versioned and typed. The queue is ordered and bounded to 256 events,
payloads are bounded to 1 MiB, paths and tokens have explicit limits, duplicate
event identifiers and idempotency keys are suppressed, delivery is capped at
three attempts, and successful frontend handling is acknowledged explicitly.
Unknown versions, mismatched payload kinds, remote paths, malformed identifiers,
oversized inputs, and secret-bearing authentication URLs fail closed.

The obsolete `zmanager-quick-action` warm-launch producer/listener path was
removed from runtime ownership. Startup compatibility errors remain available
through the legacy query command, while valid actions use the inbox.

## Automated proof

- `cargo test native_launch_inbox`: 9 passed
- `cargo check`: passed
- `swift test --package-path native/macos`: 8 passed
- Native frontend controller and desktop event adapter: 6 passed
- Tauri command contract suite: 2 passed
- `npm run build`: passed

Coverage includes events before setup/webview, after readiness, 32 simultaneous
producers, duplicate callbacks, unknown versions, overflow, oversize input,
acknowledgement and bounded replay, multiple windows, wrong-window
acknowledgement, shutdown, typed secret-free quick actions, listener-before-ready
ordering, acknowledgement only after successful handling, AppKit URL filtering,
and a startup/shutdown lifecycle with no synthetic workflow event.

## Ownership deletion and residual scope

No event mutates a Workspace directly. Hosted-auth result consumption belongs
to Phase 6 and opaque Finder request-token consumption belongs to Phase 9; until
those phase-specific consumers are installed, the frontend deliberately does
not acknowledge those event kinds. This preserves the inbox item instead of
silently dropping it.
