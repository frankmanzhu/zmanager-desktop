# ZManager Desktop Job Feed Architecture Specification

- Status: Proposed
- Scope: ZManager Desktop Rust command layer, Job Registry, desktop adapters,
  application workspaces, Main Window, and Disposable Task Windows
- Companion: [`ZMANAGER_CORE_JOB_PROGRESS_ARCHITECTURE_SPEC.md`](ZMANAGER_CORE_JOB_PROGRESS_ARCHITECTURE_SPEC.md)

## Purpose

This specification defines how ZManager Desktop retains and delivers Job state
to every window. The design replaces drain-on-read polling and Main Window
relays with direct, latest-value subscriptions backed by one authoritative Rust
Job Feed.

The architecture must be correct without transport timers. It must remain fast
when archives contain large files, thousands of small files, multiple concurrent
jobs, or multiple Disposable Task Windows.

## Goals

- One authoritative retained Desktop snapshot per Job.
- Direct subscription from every interested window.
- Immediate current state for late and reconnecting subscribers.
- Latest-value backpressure instead of an unbounded event backlog.
- Deterministic ordering through monotonically increasing revisions.
- No Main Window dependency for Disposable Task progress.
- No periodic polling in the normal progress path.
- Bounded memory and work per Job and subscriber.
- Shared progress presentation for Main Window and Disposable Task Window.

## Non-goals

Desktop does not:

- Reimplement archive planning, creation, extraction, or safety.
- Decide when archive bytes or phases semantically advance.
- Aggregate raw backend callbacks independently of core.
- Persist passwords or include them in snapshots.
- Guarantee that a Job shorter than window startup displays every intermediate
  state; it must always display the retained terminal state correctly.
- Manufacture progress between authoritative core updates.

## Ownership split

| Concern | Owner |
| --- | --- |
| Archive progress meaning and phase semantics | `zmanager-core` |
| Producer-side activity aggregation | `zmanager-core` |
| Pure raw progress projection shared by consumers | `zmanager-core` |
| Desktop Job ID and lifecycle record | Desktop Rust Job Registry |
| Queued, paused, retry, dismiss, and output-action state | Desktop |
| Retained Desktop snapshot and revision | Desktop Rust Job Feed |
| Subscriber registration and latest-value delivery | Desktop Rust Job Feed |
| Tauri IPC channels and window cleanup | Desktop adapters |
| Percentage weighting, ETA, formatting, and localization | `src/app` and display seams |
| DOM rendering and event decoding | `src/ui` |

## Target data flow

```text
Archive backend
  -> zmanager-core JobEventSink
  -> core JobProgressState
  -> Desktop Job Registry folds desktop lifecycle facts
  -> retained DesktopJobSnapshot revision N
  -> per-Job latest-value watch sender
       -> Tauri Channel -> Main Window subscription
       -> Tauri Channel -> Disposable Task Window subscription
  -> workspace accepts revision N
  -> shared presentation derivation
  -> React render
```

There is no Main Window-to-task progress relay.

## Deep Job Feed module

The Rust Job Registry should deepen into the Job Feed rather than adding a
second event manager beside it. Its interface owns:

- Job creation and retained identity.
- Core event ingestion through `JobEventCollector`.
- Desktop lifecycle and control transitions.
- Current immutable snapshot projection.
- Per-Job revision assignment.
- Latest-value subscription creation.
- Subscription cleanup.
- Terminal retention and dismissal.
- Preview-root cleanup only if that responsibility remains intentionally part of
  the registry; otherwise it should move to a separate deep module.

Callers must not manipulate subscriber collections, event queues, or revisions.

## Desktop snapshot contract

Every delivered message is a complete immutable snapshot, not a delta:

```text
DesktopJobSnapshot
  revision
  jobId
  kind
  status
  createdAt
  updatedAt
  canPause / canResume / canCancel / canDismiss
  progressFacts
    processedBytes / totalBytes
    processedEntries / totalEntries
    currentPath
    recentPaths
    activePhase
    phaseProcessedBytes / phaseTotalBytes
    warningCount
  latestFailure
    code / hint / severity / retryable / message
  boundedNotices
  terminalSummary
```

The exact DTO nesting may change during implementation, but these invariants do
not:

- `revision` increases for every externally observable snapshot change.
- A snapshot is self-sufficient; consumers do not require an earlier revision.
- Mutable Rust collections are serialized as plain immutable frontend data.
- Secrets are absent.
- Terminal snapshots remain available until explicit dismissal.

## Latest-value subscription implementation

Each Job record should own a latest-value publisher such as:

```rust
tokio::sync::watch::Sender<Arc<DesktopJobSnapshotDto>>
```

The Job Feed updates the retained snapshot and calls `send_replace` after each
externally observable change.

`watch` semantics are required because they provide:

- An atomic current value for a new receiver.
- Independent receivers for Main Window and Disposable Task Windows.
- Conflation when a receiver is slower than the producer.
- Bounded retained state rather than an event backlog.
- No debounce, retry interval, or polling cadence.

An equivalent latest-value primitive is acceptable only if it preserves these
semantics and has equivalent tests.

## Tauri subscription seam

Desktop should expose coarse commands conceptually equivalent to:

```text
subscribe_job(jobId, channel) -> subscriptionId
unsubscribe_job(subscriptionId)
```

The JavaScript adapter creates a Tauri `Channel<DesktopJobSnapshotDto>` and
passes it to `subscribe_job`.

The subscription implementation must:

1. Validate the Job ID.
2. Obtain a receiver whose current value is the retained snapshot.
3. Send the current snapshot first.
4. Forward each newer latest value.
5. End on explicit unsubscribe, Job dismissal, channel failure, or application
   shutdown.
6. Remove its subscription record exactly once.

Subscription creation must not have a gap between reading current state and
joining live updates. The watch receiver is the atomic handshake; a separate
“subscribe, then fetch” sequence is not acceptable.

## Ordering and idempotency

Frontend consumers store the highest accepted revision for each Job.

```text
if incoming.revision <= current.revision:
    ignore incoming
else:
    replace current snapshot
```

Revision gaps are safe because snapshots are complete. Gaps may be recorded by
development diagnostics, but must not initiate polling or event replay.

Revisions are scoped to one Job. They do not establish ordering between
different Jobs.

## Backpressure and performance

- Core performs producer-side aggregation.
- The Job Feed retains one current snapshot per Job.
- A slow subscriber receives the newest snapshot, not every intermediate value.
- Subscriber delivery must never block archive work.
- No transport debounce or periodic progress polling is permitted.
- Subscriber count and retained notices must have explicit limits or cleanup.
- Snapshot construction must be bounded by capped recent paths and notices.
- Large historical event arrays must not cross Tauri IPC.

Performance acceptance targets on a normally idle supported desktop are:

- No artificial delay between Job Feed publication and channel forwarding.
- 95th-percentile publication-to-JavaScript callback latency below 50 ms for a
  small snapshot.
- 95th-percentile publication-to-visible-render latency below 100 ms, excluding
  the aggregation interval already owned by core.
- Stable memory use during a long-running Job with millions of backend callbacks.

Benchmarks must identify environment and workload; these numbers are regression
budgets, not claims about archive throughput.

## Main Window behavior

- The Main Window subscribes directly after accepting a start-Job response.
- Jobs Workspace stores the latest snapshot by Job ID and revision.
- Opening or closing the Jobs drawer does not start or stop correctness-critical
  delivery.
- Rendering may be skipped while a surface is hidden, but the workspace still
  accepts the latest snapshot.
- Window restoration does not require reconstructing state from event history.

## Disposable Task Window behavior

- A Disposable Task Window subscribes directly using its bootstrap Job ID.
- It never receives progress republished by the Main Window.
- It may open before, during, or after Job execution.
- Its first message is the current retained snapshot.
- Reloading the window establishes a new independent subscription.
- Closing the window unsubscribes without cancelling the Job unless the user
  explicitly chooses cancellation.
- Multiple task windows may observe separate Jobs concurrently.

## Workspace and presentation ownership

Jobs Workspace and Task Workspace should accept complete snapshots rather than
merge poll responses or replay raw events.

Shared application presentation derives:

- Composite percentage, including TZAP phase weights.
- Elapsed and estimated remaining time.
- Transfer rate and compression ratio.
- User-visible current activity.
- Retry and output-action readiness from Desktop facts.

The display seam owns formatting and localization.

The elapsed-time display may use a local one-second render clock. That clock is
presentation-only and must not fetch, merge, publish, or repair Job state.

Progress bars may use a short CSS transition between authoritative values.
Displayed numbers and filenames must never be synthetically interpolated.

## Controls and terminal transitions

Cancel, pause, and resume commands update the retained Desktop snapshot through
the same Job Feed seam. Control commands must not issue an immediate poll after
returning.

Terminal behavior:

- Success, failure, and cancellation publish terminal snapshots.
- Required terminal summary and output facts should become visible atomically
  where practical.
- If a core terminal event and Desktop summary are produced separately, the Job
  Feed may publish two increasing complete revisions; consumers must remain
  correct after either revision.
- Dismissal removes the Job only after it is terminal, ends subscriptions, and
  prevents future publication.

## Failure and recovery

- A failed subscription command returns a structured Desktop command error.
- A failed channel send terminates and cleans up that subscription only.
- One broken window cannot stop publication to other subscribers.
- Reconnection creates a new subscription and receives current retained state.
- The architecture does not use periodic polling as hidden recovery.
- Development diagnostics should record subscription ID, Job ID, revision, and
  lifecycle transitions without recording passwords or sensitive inputs.

## Browser and test adapters

The frontend subscription seam is real because it has two adapters:

- Tauri Channel adapter for the Desktop Shell.
- In-memory adapter for browser fixtures, deterministic unit tests, and visual
  tests.

Tests and callers use the same subscription interface. Tests must not reach into
subscriber maps or private revision counters.

## Migration plan

### Slice 1: Characterize existing behavior

- Preserve tests for progress math, password retry, controls, terminal summaries,
  output actions, quick actions, and task auto-close.
- Add contract fixtures for aggregate events from the pinned core revision.

### Slice 2: Introduce retained snapshots

- Add the pure core progress projection or consume it when available.
- Fold core events into `DesktopJobSnapshot` inside the Job Registry.
- Add revision and projection tests.
- Keep the old polling path temporarily as a clearly named compatibility adapter.

### Slice 3: Add direct subscriptions

- Add latest-value publishers and Tauri Channel commands.
- Subscribe the Main Window directly.
- Subscribe Disposable Task Windows directly.
- Prove late subscription, multiple subscribers, conflation, and cleanup.

### Slice 4: Delete old ownership

- Remove `poll_job_events` from the normal command interface.
- Remove drain-on-read event queues.
- Remove Job polling timers and polling concurrency flags.
- Remove `JobPollingController`.
- Remove Main Window-to-task progress republishing.
- Remove frontend raw-event accumulation and merge logic.
- Remove compatibility documentation and tests.

The migration is not complete while polling and subscription remain parallel
production paths.

## Required verification

Rust tests must prove:

- A late subscriber immediately receives current state.
- Two subscribers receive independent ordered revisions.
- A slow subscriber conflates updates and reaches the newest revision.
- Snapshot memory remains bounded over a long synthetic Job.
- Pause, resume, cancel, failure, and terminal summary changes publish.
- Dismissal ends subscriptions and removes retained state.
- A channel failure does not affect another subscriber.

Frontend tests must prove:

- Newer revisions replace state and stale revisions are ignored.
- Main Window and Disposable Task Window derive identical progress from the same
  snapshot.
- Current filename uses the newest recent path.
- Password-required and retry state survive the new projection.
- Presentation clocks do not invoke Desktop commands.

End-to-end tests must prove:

- A long-running create and extract Job updates a Disposable Task Window without
  an active Main Window relay.
- A task opened after completion immediately renders terminal state.
- Closing a task window leaves a background Job running.
- Multiple task windows remain independent.

## Architecture guardrails

After migration, automated checks should reject:

- New calls to `poll_job_events`.
- New Job polling intervals.
- Main Window code that republishes Job progress to task windows.
- Tauri imports in Jobs Workspace or Task Workspace.
- Unbounded Job event arrays in frontend snapshots.
- Percentage or localization policy in Rust Job DTO mapping.

## Completion criteria

The Desktop architecture is complete when:

- The Rust Job Feed is the single owner of retained Desktop Job state.
- Every window subscribes directly through the same seam.
- Delivery correctness has no debounce, sleep, or polling dependency.
- Slow subscribers cannot create unbounded work or memory growth.
- Current and terminal state are recoverable through subscription alone.
- Old polling and relay ownership paths are deleted.
- The verification suite proves correctness, performance, lifecycle cleanup, and
  parity between Main Window and Disposable Task Window.
