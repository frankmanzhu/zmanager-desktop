# ADR-0012: Keep a bounded, secret-free local diagnostic log

- Status: Accepted
- Date: 2026-07-22

## Context

Quick actions cross process arguments, the Native Launch Inbox, frontend startup
coordination, job presentation, Disposable Task Windows, and coordinator
shutdown. A failure can therefore disappear when a short-lived window closes,
and console output is not available in normal packaged launches.

The diagnostic trail must be easy for a user to locate and share deliberately.
Runtime writes inside a signed macOS application also invalidate its sealed
code signature, even when the installation happens to be user-writable.
System-wide Linux and protected Windows installations likewise cannot assume
their executable directory is writable.

## Decision

The Rust desktop boundary owns an append-only JSON-lines Diagnostic Log. On
macOS it always uses Tauri's per-user application log directory so the signed
application bundle remains immutable after installation. On Windows and Linux,
its primary location remains `logs/zmanager-diagnostics.log` under the directory
that contains the running executable; if that location cannot be created or
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
- macOS diagnostics never mutate the signed application bundle. Windows and
  Linux retain the installation-folder location whenever permissions allow it,
  while read-only installations use an explicit per-user fallback.
- Logs are bounded but remain local until the user intentionally shares them.
- New diagnostic events must use structured, non-secret fields and prefer counts,
  kinds, state names, and decisions over paths or free-form messages.

## Verification

- Rust tests prove early buffering, JSON-lines output, secret-field redaction,
  rejection of nested frontend payloads, and the signed-bundle policy that keeps
  a writable installation directory untouched.
- Frontend tests prove desktop-only forwarding through the diagnostic adapter.
- Command contract tests keep the TypeScript wrappers aligned with the Rust
  invoke handler.
- Capability tests require every registered command, including diagnostics, to
  appear in both the main-window allowlist and Tauri permission-generation
  manifest.
