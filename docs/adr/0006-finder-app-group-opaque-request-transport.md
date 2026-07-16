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
It opens `zmanager://shell-action/<opaque-token>` without paths. The app validates
token syntax, ownership, permissions, size, schema version, timestamp, TTL, and
file location before one-time consumption and deletion. Tokens are random and
non-semantic. Replay, symlink, hardlink, traversal, stale, oversized, partial,
and unknown-version inputs fail closed. Services use the same request schema and
inbox rules.

## Consequences

Finder performs no archive work and carries no secrets. App Group registration
and cleanup become release/upgrade obligations.

## Verification

Shared fixtures and Swift/Rust tests cover atomic multi-selection, permissions,
malformed input, stale files, replay, concurrency, and cleanup; installed Finder
and Services tests prove one routed request.
