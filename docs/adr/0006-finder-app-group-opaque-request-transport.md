# ADR-0006: Transport Finder requests through App Group opaque tokens

- Status: Accepted
- Date: 2026-07-16
- Extends: ADR-0002

## Context

Finder Sync is sandboxed. Putting selected paths in URLs exposes data, exceeds
URL limits, and makes replay and validation ambiguous.

## Decision

Finder writes one atomic, versioned ShellActionRequest to a mode-0600 file in a
dedicated App Group inbox using create-exclusive, write, sync, and atomic rename.
It opens `zmanager://shell-request/<opaque-token>` without paths. The macOS
native adapter validates token syntax, ownership, permissions, size, schema
version, timestamp, TTL, and file location during one-time consumption and
deletion, then submits only the validated inline request to the Native Launch
Inbox. Tokens never cross the frontend command boundary. Tokens are random and
non-semantic. Replay, symlink, hardlink, traversal, stale, oversized, partial,
and unknown-version inputs fail closed. Services use the same request schema
and Rust validation seam without requiring a Finder token.

## Consequences

Finder performs no archive work and carries no secrets. App Group registration
and cleanup become release/upgrade obligations.

## Verification

Shared fixtures and Swift/Rust tests cover atomic multi-selection, permissions,
malformed input, stale files, replay, concurrency, and cleanup; installed Finder
and Services tests prove one routed request.
