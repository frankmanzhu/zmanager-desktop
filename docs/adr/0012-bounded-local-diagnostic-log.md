# ADR-0012: Keep a bounded, secret-free local diagnostic log

- Status: Accepted
- Date: 2026-07-22

## Context

Quick actions cross process arguments, the Native Launch Inbox, frontend startup
coordination, job presentation, Disposable Task Windows, and coordinator
shutdown. A failure can therefore disappear when a short-lived window closes,
and console output is not available in normal packaged launches.

The diagnostic trail must be easy for a user to locate and share deliberately,
but an installed application cannot assume its executable directory is writable
on macOS, system-wide Linux installations, or protected Windows installations.

## Decision

The Rust desktop boundary owns an append-only JSON-lines Diagnostic Log. Its
primary location is `logs/zmanager-diagnostics.log` under the directory that
contains the running executable. If that directory cannot be created or
written, the logger uses Tauri's per-user application log directory and records
that fallback. The About dialog reports the actual active path and location.

The log records structured lifecycle facts such as launch classification,
inbound transport, action kind, path count, selected window target, job kind,
Disposable Task Window state, completion policy, and coordinator shutdown
decisions. It does not record selected paths, opaque request tokens, passwords,
passphrases, credentials, private keys, or arbitrary nested frontend payloads.
The Rust boundary redacts secret-bearing field names as a second line of
defense.

The active log rotates at 4 MiB and retains one previous file. Logging failures
must not interrupt archive work. Early startup events are buffered until the
active path is initialized.

## Consequences

- Packaged launches retain enough evidence to reconstruct quick-action window
  lifecycle decisions after a Disposable Task Window closes.
- The requested installation-folder location is used whenever permissions allow
  it, while read-only installations retain diagnostics through an explicit
  fallback instead of silently losing them.
- Logs are bounded but remain local until the user intentionally shares them.
- New diagnostic events must use structured, non-secret fields and prefer counts,
  kinds, state names, and decisions over paths or free-form messages.

## Verification

- Rust tests prove early buffering, JSON-lines output, secret-field redaction,
  and rejection of nested frontend payloads.
- Frontend tests prove desktop-only forwarding through the diagnostic adapter.
- Command contract tests keep the TypeScript wrappers aligned with the Rust
  invoke handler.
