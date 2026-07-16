# ADR-0008: Stream macOS drag-out through file promises

- Status: Accepted
- Date: 2026-07-16
- Supersedes: the macOS eager-staging decision in ADR-0003 after parity passes

## Context

Eagerly extracting drag payloads before Finder chooses a destination wastes I/O,
extends password lifetime, and cannot model asynchronous per-item completion.

## Decision

Rust owns a Native Drag Session Registry containing the archive handle,
in-memory password, descriptors, cancellation, completion, and cleanup. Swift
owns `NSFilePromiseProvider` presentation and requests a bounded stream only
after Finder supplies a destination. Each item resolves once; names and
collisions follow macOS target-volume policy. Cancellation, timeout, host loss,
partial failure, and shutdown close streams, release handles, and zero secrets.
No password enters arguments, files, logs, events, or diagnostics.

## Consequences

Linux staging remains independent. The existing macOS staging path is deleted
only after installed Finder parity proves promises.

## Verification

Registry and Swift host tests cover multi-item, folders, collisions, ordering,
passwords, cancel, timeout, partial failure, and cleanup; Finder drag smoke is
required before deletion of staging.
