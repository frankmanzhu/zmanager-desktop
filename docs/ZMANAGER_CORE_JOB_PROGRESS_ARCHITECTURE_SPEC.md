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
- Keep event production synchronous, bounded, and runtime-neutral; keep state
  projection deterministic for a given ordered event sequence.
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

`JobEvent` remains the producer interface emitted by archive jobs through
`JobEventSink`. It must express language-neutral facts. The reusable
`JobProgressState` projection below is the normative consumer interface; CLI,
FFI, and Desktop must not each depend on backend callback shapes or reconstruct
entry counts from incidental event frequency.

Required lifecycle events:

- `Started`
- `Warning`
- `Completed`
- `Failed`
- `Cancelled`

Required activity facts:

- Whole-Job cumulative logical bytes and completed entries.
- Phase start and phase-local cumulative bytes when a backend has phases.
- The latest active archive path and bounded recent activity.
- Incremental bytes and entries represented by the aggregate for diagnostics.

The exact enum migration may retain or enrich `EntryStarted`, `BytesProcessed`,
`EntryFinished`, `PhaseStarted`, and `PhaseBytesProcessed`, or replace the hot
variants with explicit aggregate variants. Regardless of layout, emitted
aggregate activity must contain cumulative counters. Consumers must never need
to reconstruct correctness by summing callback-sized deltas that may have been
aggregated.

Per-entry callbacks are inputs to producer aggregation. They must not bypass it
and produce one public sink event per tiny or zero-byte entry. Legacy
`EntryStarted` and `EntryFinished` events may exist during migration, but
consumer correctness must not depend on receiving every one of them.

Each aggregate activity event must expose:

- The cumulative processed byte count in its applicable scope.
- The cumulative completed-entry count for the whole Job.
- The latest active archive path when one exists.
- A bounded, ordered collection of recently active paths.
- The incremental bytes and entries represented by that aggregate for
  diagnostics.

`Started` supplies authoritative whole-Job byte and entry totals when they
exist; `PhaseStarted` supplies the authoritative phase-local byte total. An
aggregate may repeat those totals for convenience, but consumers must not
require redundant totals on every event.

The newest item in `recent_paths` is the newest activity in the aggregate.
Deduplication uses the exact language-neutral archive-path string supplied by
the producer: seeing a duplicate removes its older occurrence and appends it as
newest. Aggregation does not canonicalize, localize, or perform filesystem I/O.
Both the number of paths and their total UTF-8 byte storage must be capped by
named constants. If a display copy is truncated on a UTF-8 boundary, the event
must say that it was truncated; operation paths used for archive work are never
modified by this display limit.

### Lifecycle grammar

One core execution emits exactly one `Started`, followed by zero or more
activity or warning events, followed by exactly one of `Completed`, `Failed`,
or `Cancelled`. No event is valid after the terminal event. The projection must
handle invalid sequences defensively without replacing an existing terminal
outcome, and debug/test builds should make producer violations visible.

Cancellation request and cancellation outcome are distinct. Requesting the
token is not a terminal event. If the operation observes cancellation before
success is linearized, it flushes pending progress and terminates with
`Cancelled`; if success was already linearized, a later request cannot rewrite
`Completed`. A core execution must never emit both outcomes.

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
- The first accepted terminal outcome is immutable and later events cannot
  change counters, paths, phases, or outcome.
- Running progress never implies successful completion solely because a byte
  counter reached its known total.
- Pending progress is visible before its terminal event.
- Applying the same ordered event sequence always yields the same state.

## Producer-side aggregation

Aggregation belongs in core because every consumer needs bounded callback
volume and identical cumulative semantics.

The current policy is:

- Emit the first non-zero activity immediately for the whole-Job scope and for
  each new phase scope.
- Afterwards emit when one second has elapsed or pending progress reaches
  `max(4 MiB, ceil(1% of the known job or phase total))`, or when 128 completed
  entries are pending.
- Use 4 MiB when the total is unknown.
- Retain at most ten distinct recent paths, ordered oldest to newest.
- Flush pending progress at phase changes and before terminal lifecycle events.

These thresholds must be named constants, documented, and covered by tests.
They are producer sampling policy, not transport retry timing. Consumers must
not add another aggregation timer to compensate for or reinterpret this policy.
The percentage calculation must use overflow-safe integer arithmetic.

The one-second rule is callback-driven: elapsed time is checked when activity
arrives; core does not start a timer thread merely to publish progress. A quiet
backend may therefore publish its pending aggregate at its next activity or
lifecycle transition. Aggregation uses a monotonic clock behind an internal
test seam so threshold tests do not sleep and remain deterministic.

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

- `JobEventSink::emit` must receive already-aggregated progress for all hot
  byte and entry paths.
- `JobProgressState::apply` must have bounded work per event.
- Memory used for recent activity must be bounded by named constants.
- No core progress operation may perform IPC, filesystem polling, UI work, or
  wait for a subscriber.
- Core never waits for transport acknowledgement or subscriber delivery.
  Because `JobEventSink::emit` is synchronous, its interface requires adapters
  to return promptly and do only bounded in-process work; core cannot guarantee
  progress against an arbitrary sink implementation that blocks.

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
- Tiny and zero-byte entry batches do not emit one sink event per entry, while
  cumulative completed-entry counts remain exact.
- All create and extract backends produce monotonic cumulative facts.
- Multi-pass TZAP progress does not double-count logical bytes.
- Single-pass TZAP emits only phases that actually occur.
- Cancellation/completion races produce exactly one terminal outcome according
  to the lifecycle linearization rule.
- Invalid or post-terminal event sequences cannot replace the first outcome.
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
