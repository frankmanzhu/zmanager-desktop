# ADR-0013: Generate and preserve shell-action window disposition

- Status: Accepted
- Date: 2026-07-22
- Process ownership amended by: ADR-0017

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

Rust consumes Finder tokens and validates the resulting versioned request before
the Native Launch Inbox accepts it. The frontend receives only a validated,
inline shell-action request and routes every startup and native-inbox request
through one disposition seam before executing it. Main-window actions reveal and retain
the normal application. Disposable actions mark coordinator ownership, keep the
Main Window hidden, and bracket request execution with activity tracking. The
coordinator may exit only after disposable activity was observed and there are
no pending requests, task windows, or jobs. ADR-0017 subsequently isolated
explicit Quick Action launches from the normal singleton process, so a normal
launch is no longer merged into a Quick Action coordinator.

## Consequences

- Fixed-format context-menu actions show only their Disposable Task Window.
- Opening an archive and launching the app retain the singleton Main Window.
  Explicit review actions such as **Add to archive...** may reveal a reusable
  Main Window in their isolated process.
- Cold startup and in-process native delivery share one generated
  classification and one frontend execution seam.
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
  normal-action reveal, request failure, and coordinator activity gating.
