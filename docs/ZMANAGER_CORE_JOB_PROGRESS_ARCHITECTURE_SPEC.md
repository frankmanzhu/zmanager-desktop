# ZManager Core Job Progress Architecture Specification

- Status: Proposed
- Scope: `zmanager-core`, including archive backend adapters and reusable CLI/FFI consumers
- Companion: [`ZMANAGER_DESKTOP_JOB_PROGRESS_ARCHITECTURE_SPEC.md`](ZMANAGER_DESKTOP_JOB_PROGRESS_ARCHITECTURE_SPEC.md)

## Purpose

This specification defines the progress semantics owned by `zmanager-core`.
Core must expose accurate, format-neutral facts about archive work without
depending on a desktop runtime, transport, subscriber, or presentation policy.

The same semantic contract must be usable by Desktop, CLI, FFI, tests, and any
future consumer. A consumer must not need to understand ZIP, 7z, TAR.ZST, TZAP,
libarchive, UnRAR, Apple Archive, or raw-stream implementation details to
interpret progress correctly.

## Goals

- Give every consumer one authoritative definition of archive progress.
- Keep event production synchronous, deterministic, bounded, and runtime-neutral.
- Aggregate high-frequency backend activity before it crosses the core seam.
- Preserve enough recent activity to keep filenames responsive for batches of
  small files.
- Provide a reusable pure projection of events into current raw progress facts.
- Keep archive lifecycle and cancellation semantics independent of UI policy.

## Non-goals

Core does not own:

- Job IDs allocated by an application process.
- Job retention, dismissal, retry prompts, or output actions.
- Subscribers, channels, event buses, threads, async runtimes, or Tauri.
- Windows, Linux, Main Window, or Disposable Task Window lifecycle.
- DTO serialization for a particular application.
- Composite percentage weights, ETA formatting, localization, or animation.
- Delivery retries, reconnect behavior, or transport backpressure.

## Ownership rule

Behavior belongs in core when changing it could change the meaning of archive
progress for more than one consumer.

Examples owned by core:

- Whether bytes represent source bytes, output bytes, or phase-local bytes.
- When a phase begins and ends.
- Whether repeated TZAP reads are separate phases rather than unique file bytes.
- How cumulative counters advance and saturate.
- Which paths belong to one aggregate and which path is most recent.
- When pending progress must be flushed before a lifecycle transition.

Behavior belongs to a consumer when it concerns delivery, retention, process
lifecycle, or presentation.

## Core interface

### Semantic events

`JobEvent` remains the event interface emitted by archive jobs through
`JobEventSink`. It must express language-neutral facts.

Required lifecycle events:

- `Started`
- `Warning`
- `Completed`
- `Failed`
- `Cancelled`

Required activity events:

- `EntryStarted`
- `BytesProcessed`
- `EntryFinished`
- `PhaseStarted`
- `PhaseBytesProcessed`

`BytesProcessed` and `PhaseBytesProcessed` must contain cumulative counters.
Consumers must never need to reconstruct correctness by summing callback-sized
deltas that may have been aggregated.

Each aggregate activity event must expose:

- The cumulative processed byte count in its applicable scope.
- The latest active archive path when one exists.
- A bounded, ordered collection of recently active paths.
- The incremental bytes represented by that aggregate for diagnostics.

The surrounding `Started` or `PhaseStarted` context supplies an authoritative
known total when one exists. An aggregate may repeat that total for convenience,
but consumers must not require redundant totals on every event.

The newest item in `recent_paths` is the newest activity in the aggregate.

### Job phases

`JobPhase` defines observable archive-work phases. A backend may omit phases
that do not exist in its execution strategy.

TZAP creation currently uses:

1. `PlanningPayload`
2. `PlanningMetadata`
3. `EmittingPayload`
4. `EmittingMetadata`
5. `CommittingOutput`

Phase byte counters are cumulative within one named phase only. Consumers must
not combine repeated source reads from separate phases as unique logical bytes.

### Pure progress projection

Core should provide a pure `JobProgressState` module that folds `JobEvent`
values into current raw facts:

```rust
pub struct JobProgressState {
    pub processed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub processed_entries: u64,
    pub total_entries: Option<u64>,
    pub current_path: Option<String>,
    pub recent_paths: Vec<String>,
    pub active_phase: Option<JobPhase>,
    pub phase_processed_bytes: u64,
    pub phase_total_bytes: Option<u64>,
    pub warning_count: u64,
    pub outcome: Option<JobOutcome>,
}

impl JobProgressState {
    pub fn apply(&mut self, event: &JobEvent);
}
```

The exact Rust layout may change during implementation, but the module must
remain deterministic, synchronous, runtime-neutral, and free of presentation
policy. CLI, FFI, and Desktop adapters should reuse it rather than independently
interpreting aggregate semantics.

Core lifecycle outcome does not include Desktop-only states such as queued,
paused, dismissible, retry-prompted, or closing.

## Projection invariants

- Counters never decrease within their scope.
- Counter addition saturates rather than overflowing.
- `current_path` reflects the newest available activity path.
- `recent_paths` preserves producer order and remains bounded.
- A new phase resets phase-local facts without resetting whole-job facts.
- Generic logical byte progress is not advanced by TZAP planning passes.
- `Completed` is the only successful completion outcome.
- Running progress never implies successful completion solely because a byte
  counter reached its known total.
- Pending progress is visible before its terminal event.
- Applying the same ordered event sequence always yields the same state.

## Producer-side aggregation

Aggregation belongs in core because every consumer needs bounded callback
volume and identical cumulative semantics.

The current policy is:

- Emit the first non-zero activity immediately.
- Afterwards emit when one second has elapsed or pending progress reaches
  `max(4 MiB, 1% of the known job or phase total)`.
- Use 4 MiB when the total is unknown.
- Retain at most ten distinct recent paths, ordered oldest to newest.
- Flush pending progress at phase changes and before terminal lifecycle events.

These thresholds must be named constants, documented, and covered by tests.
They are producer sampling policy, not transport retry timing. Consumers must
not add another aggregation timer to compensate for or reinterpret this policy.

## Backend adapter responsibilities

Each archive backend adapter must:

- Report progress at the point where the relevant work occurs.
- Use logical source-byte semantics consistently with other backends.
- Supply totals only when they are authoritative.
- Check cancellation at bounded intervals.
- Flush activity before returning or emitting a terminal event.
- Avoid exposing backend-private handles, buffers, or paths outside the selected
  archive operation.

Backends must not calculate Desktop percentages or emit localized status text.

## Performance requirements

- `JobEventSink::emit` must receive already-aggregated progress for hot byte paths.
- `JobProgressState::apply` must have bounded work per event.
- Memory used for recent activity must be bounded by named constants.
- No core progress operation may perform IPC, filesystem polling, UI work, or
  wait for a subscriber.
- A missing or slow consumer must not slow archive creation or extraction.

## Error and security requirements

- Events must never contain passwords, secrets, key material, or command lines.
- Paths may identify only user-selected sources or logical archive entries that
  the consuming application is already authorized to display.
- Structured application recovery codes remain application-owned unless the
  code describes a reusable core failure contract.
- Backend error text must not be treated as a stable presentation interface.

## Compatibility and evolution

- Adding an event field should preserve existing cumulative semantics.
- Removing or redefining a field requires coordinated consumer migration.
- New phases must document ordering, counter scope, and behavior for consumers
  that do not yet recognize the phase.
- Core must maintain focused contract documentation alongside code changes.
- Desktop should pin a reviewed core revision until the contract is released.

## Verification

Core tests must prove:

- First activity is emitted immediately.
- Byte and time thresholds flush aggregates correctly.
- Recent paths are ordered, deduplicated as specified, and capped.
- Progress is flushed at phase and terminal transitions.
- All create and extract backends produce monotonic cumulative facts.
- Multi-pass TZAP progress does not double-count logical bytes.
- Single-pass TZAP emits only phases that actually occur.
- Cancellation produces no later successful completion.
- The pure projection produces identical results for CLI, FFI, and Desktop
  adapter fixtures.
- Property tests or equivalent loops cannot make counters decrease or overflow.

## Completion criteria

Core ownership is complete when:

- Aggregate semantics live in one core implementation.
- A reusable pure progress projection exists or an explicit ADR rejects it.
- CLI, FFI, and Desktop do not duplicate phase/counter interpretation.
- Core has no dependency on Desktop transport or presentation concepts.
- The companion Desktop specification can consume core facts without importing
  backend-specific behavior.
