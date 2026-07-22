# ADR-0013: Generate and preserve shell-action window disposition

- Status: Accepted
- Date: 2026-07-22

## Context

The shell-action kind reached Rust correctly, but cold-start forwarding moved
the request into the Native Launch Inbox and replaced startup state with
`NotRequested`. The frontend consequently classified the process as a normal
launch, revealed the singleton Main Window, and retained it after a fixed-format
quick action. Independently maintained action lists also made Rust and
TypeScript classification liable to drift.

## Decision

Every entry in `manifests/shell-actions.json` declares either `mainWindow` or
`disposableTask`. Contract generation emits that policy for Rust and TypeScript.

When Rust transfers a cold-start request into the Native Launch Inbox, startup
state becomes a non-executable forwarded marker carrying the action's window
disposition. The inbox remains the single owner of the executable request, so
the request is not duplicated.

The frontend routes every startup, native-inbox, and shell-token request through
one disposition seam before executing it. Main-window actions reveal and retain
the normal application. Disposable actions mark coordinator ownership, keep the
Main Window hidden, and bracket request execution with activity tracking. The
coordinator may exit only after disposable activity was observed and there are
no pending requests, task windows, or jobs. A previously observed normal launch
always wins, preserving an already-open Main Window.

## Consequences

- Fixed-format context-menu actions show only their Disposable Task Window.
- **Add to archive...**, generic extract, opening an archive, and launching the
  app retain the singleton Main Window.
- Cold and warm delivery paths share one generated classification and one
  frontend execution seam.
- Validation or job-start failure still settles disposable ownership instead of
  leaving a hidden coordinator running.
- Passwords, selected paths, and opaque request tokens remain excluded from
  lifecycle diagnostics.

## Verification

- Generator tests prove every action has a valid emitted disposition.
- Rust tests prove cold forwarding preserves disposable disposition, enqueues
  exactly one request, and exposes no duplicate executable request in startup
  state.
- Frontend tests cover cold forwarded startup, fixed-format hidden routing,
  normal-action reveal, warm quick actions in normal sessions, request failure,
  and coordinator activity gating.
