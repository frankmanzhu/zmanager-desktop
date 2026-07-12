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
- A retained Job catalog so a restored Main Window can discover Jobs created by
  other windows without polling.
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
| Queued, paused, cancelling, retry, dismiss, and output-action state | Desktop |
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
  -> retained Job catalog latest-value publisher
       -> Main Window discovers created, dismissed, and evicted Jobs
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

The Job Feed also owns a process-wide retained Job catalog containing bounded
Job descriptors and a catalog revision. Creation, dismissal, and retention
eviction update this catalog atomically with the corresponding per-Job record
change. This is discovery state, not an archive event history.

## Desktop snapshot contract

Every delivered message is a complete immutable snapshot, not a delta:

```text
DesktopJobSnapshot
  revision (unsigned 64-bit decimal string)
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
    activeElapsedMillis / phaseElapsedMillis
  latestFailure
    code / hint / severity / retryable / message
  boundedNotices
  availableActions / outputArtifacts
  retryDescriptor (optional, secret-free)
  terminalSummary
```

The exact DTO nesting may change during implementation, but these invariants do
not:

- `revision` increases for every externally observable snapshot change.
- `revision` is serialized as a decimal string and compared as an unsigned
  integer (for example with `BigInt`) so JavaScript's numeric precision cannot
  collapse distinct Rust revisions.
- A snapshot is self-sufficient; consumers do not require an earlier revision.
- Mutable Rust collections are serialized as plain immutable frontend data.
- Secrets are absent.
- Terminal snapshots remain available until explicit dismissal or the bounded
  retention policy below evicts them.

`availableActions`, `outputArtifacts`, and `retryDescriptor` are typed,
language-neutral facts, not localized labels. If reconnecting subscribers must
be able to retry a password failure, the Job Feed retains the non-secret retry
recipe and exposes an opaque action identifier; a password is supplied only to
the retry command and is never copied into a snapshot or retained recipe.

Elapsed facts use a monotonic clock and exclude paused duration. Wall-clock
`createdAt` and `updatedAt` are display/audit facts and must not be used for
ordering or rate math. A complete snapshot must contain enough retained facts
to derive an average transfer rate after a late subscription; consumers must
not need raw event history.

### Desktop lifecycle state machine

The Job Feed enforces, rather than merely documents, valid status transitions:

```text
queued -> running | paused | cancelling | failed | cancelled
running -> paused | cancelling | completed | failed | cancelled
paused -> queued | running | cancelling | failed | cancelled
cancelling -> completed | failed | cancelled
completed | failed | cancelled -> no later status
```

`paused -> queued` is valid only when a Job was paused before its worker
started. The prior active status is internal state, not frontend merge logic.
A late core `Started` event must not overwrite `paused` or `cancelling`.
Capability flags are pure derivations of status, Job kind, and retained action
facts; they are not independently mutable booleans that can drift.

Accepting a cancel command publishes `cancelling`, not terminal `cancelled`.
The core worker publishes the one terminal outcome according to the companion
specification's linearization rule. This prevents a late completion from being
silently discarded after work actually committed.

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

Snapshot revision allocation, record replacement, and `send_replace` form one
serialized Job Feed mutation. Revision exhaustion must fail closed rather than
wrap or saturate into duplicate revisions. Snapshot construction and watch
publication may occur under the Job record lock because both are bounded, but
Tauri channel sends, task spawning, and subscriber cleanup callbacks must occur
after releasing that lock.

## Job discovery subscription

The Main Window must not rely only on start-command responses: Jobs can be
created by Disposable Task Windows or shell actions while the Main Window is
closed or reloading. Desktop therefore exposes a latest-value catalog
subscription conceptually equivalent to:

```text
subscribe_job_catalog(channel) -> subscriptionId
```

Its current value contains `catalogRevision` plus bounded descriptors with
`jobId`, per-Job `revision`, `kind`, `status`, and retention metadata. The Main
Window receives the current catalog atomically, then creates or removes per-Job
subscriptions. Catalog revisions use the same decimal-string rule as Job
revisions. This command is for discovery only; progress still comes from each
Job's snapshot, and the catalog must not grow into a second copy of every
snapshot.

Catalog delivery follows the same one-in-flight acknowledgement rule as Job
snapshot delivery.

## Tauri subscription seam

Desktop should expose coarse commands conceptually equivalent to:

```text
subscribe_job(jobId, channel) -> subscriptionId
unsubscribe_job(subscriptionId)
ack_subscription(subscriptionId, revision)
```

The JavaScript adapter creates a Tauri `Channel<DesktopJobSnapshotDto>` and
passes it to `subscribe_job`.

Every channel message uses an envelope containing `subscriptionId`, revision,
and the complete payload. The first callback can therefore acknowledge its
message even if it runs before the subscribe command promise resolves; it must
not depend on a separately returned ID becoming visible first.

The subscription implementation must:

1. Validate the Job ID.
2. Obtain a receiver whose current value is the retained snapshot.
3. Send the current snapshot first.
4. Keep at most one unacknowledged channel message for that subscriber.
5. After acknowledgement, forward the newest retained revision if it is newer;
   intermediate revisions remain conflated.
6. End on explicit unsubscribe, Job dismissal, channel failure, or application
   shutdown.
7. Remove its subscription record exactly once.

Subscription creation must not have a gap between reading current state and
joining live updates. The forwarding task creates the watch receiver first,
sends `receiver.borrow_and_update()` as the initial value, and marks that
revision in flight. While it is unacknowledged, `changed()` only makes a newer
watch value available; it does not send another channel message. On an exact
acknowledgement of the in-flight revision, the task sends
`borrow_and_update()` only if a newer value exists. Updates conflated before the
initial send therefore appear in that initial value or a later higher revision.
A separate "subscribe, then fetch" sequence is not acceptable.

Every subscription record owns a cancellation handle and its originating
window label. Explicit unsubscribe, window destruction, Job dismissal or
eviction, channel failure, and application shutdown all converge on one
idempotent cleanup path. Named per-Job and process-wide subscriber limits reject
excess subscriptions with a structured error; they never evict an unrelated
live subscriber silently.

`tokio::sync::watch` bounds the Rust publisher, but it does not by itself prove
that Tauri or the WebView has a bounded message queue: a synchronous
`Channel::send` may only enqueue work. The acknowledgement rule above is the
default cross-IPC backpressure mechanism. It is not polling and does not fetch
state. It may be omitted only if the selected Tauri transport is proven by an
integration test to provide equivalent one-in-flight or bounded latest-value
delivery. A subscriber that never acknowledges can retain one in-flight message
and one current watch value, never an unbounded queue.

Acknowledgements are subscription-scoped and idempotent. A duplicate or stale
acknowledgement cannot release a different in-flight revision; a revision newer
than the one sent is a structured protocol error.

### Cross-window authorization

Job IDs and subscription IDs are identifiers, not authorization tokens. Each
subscription command derives the caller's window label and role from the Tauri
command context; it never trusts a window label supplied by JavaScript. The Main
Window may subscribe to the catalog and retained Jobs. A Disposable Task Window
may subscribe only to the Job IDs bound to its immutable bootstrap record.
`ack_subscription` and `unsubscribe_job` verify the same subscription owner.
Unguessable IDs are defense in depth, not a substitute for these checks.

## Ordering and idempotency

Frontend consumers store the highest accepted revision for each Job.

```text
if BigInt(incoming.revision) <= BigInt(current.revision):
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
- Tauri channel forwarding runs outside the Job mutation lock and outside the
  archive worker call stack. A blocked or failed channel can delay only its own
  forwarding task.
- No transport debounce or periodic progress polling is permitted.
- Subscriber count and retained notices must have explicit limits or cleanup.
- Snapshot construction must be bounded by capped recent paths and notices.
- Large historical event arrays must not cross Tauri IPC.

Performance acceptance targets on a normally idle supported desktop are:

- When no message is in flight, no artificial delay between Job Feed publication
  and channel forwarding.
- 95th-percentile publication-to-JavaScript callback latency below 50 ms for a
  small snapshot when no earlier message awaits acknowledgement.
- 95th-percentile publication-to-visible-render latency below 100 ms, excluding
  the aggregation interval already owned by core.
- Stable memory use during a long-running Job with millions of backend callbacks.

### Retention bound

Per-Job bounds are insufficient if every terminal Job remains forever. The Job
Feed must define a named process-wide maximum for retained terminal Jobs and a
deterministic oldest-terminal eviction policy, ordered by terminal sequence and
then Job ID. Eviction is a visible Job catalog change, ends that Job's
subscriptions, and never removes a non-terminal Job.
Explicit dismissal may remove a terminal Job earlier. This bounded session
history is not durable persistence; if durable history is later required, it
belongs in a separate module with an explicit storage and privacy contract.

The catalog and active set also require named process-wide admission limits.
Job creation first evicts eligible terminal records, then returns a structured
capacity error rather than admitting an unbounded number of queued or running
Jobs.

Benchmarks must identify environment and workload; these numbers are regression
budgets, not claims about archive throughput.

## Main Window behavior

- The Main Window subscribes directly after accepting a start-Job response.
- On startup or restoration it subscribes to the Job catalog first, then to the
  retained Jobs it discovers.
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
the same Job Feed seam. Their responses acknowledge the resulting Job revision
or return a structured rejection; they are not an alternate snapshot path.
Control commands must not issue an immediate poll after returning.

Terminal behavior:

- Success, failure, and cancellation publish terminal snapshots.
- A successful terminal snapshot publishes its required summary, output
  artifacts, and available actions atomically. If core emits `Completed` before
  the worker returns the report used to build those facts, the collector stages
  the event and the worker completion path performs the one terminal commit.
  This prevents auto-close or dismissal from racing ahead of output facts.
- Optional post-completion notices may publish later increasing revisions, but
  consumers must remain correct without them.
- Dismissal removes the Job only after it is terminal, updates the Job catalog,
  ends subscriptions, and prevents future publication.

## Failure and recovery

- A failed subscription command returns a structured Desktop command error.
- A failed channel send terminates and cleans up that subscription only.
- One broken window cannot stop publication to other subscribers.
- Reconnection creates a new subscription and receives current retained state.
- A restored Main Window discovers current Jobs from the catalog subscription;
  it does not need previously cached Job IDs.
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
- Add the retained Job catalog and its direct subscription.
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
- Without acknowledgement, a subscriber receives at most one channel message;
  acknowledging it sends the newest retained revision rather than every gap.
- The first message envelope can be acknowledged before the subscribe command
  promise resolves.
- Snapshot memory remains bounded over a long synthetic Job.
- Pause, resume, cancel, failure, and terminal summary changes publish.
- Dismissal ends subscriptions and removes retained state.
- A channel failure does not affect another subscriber.
- Revision serialization and frontend comparison remain ordered above
  JavaScript's maximum safe integer, and exhaustion cannot wrap.
- Pausing before `Started` remains paused, cancelling is non-terminal until the
  worker outcome, and the first terminal state is immutable.
- Catalog subscription discovers Jobs created by another window and reflects
  dismissal and deterministic retention eviction.
- Admission limits reject excess active Jobs without exceeding catalog bounds.
- Window destruction and explicit unsubscribe race through one cleanup path.
- A task window cannot subscribe, acknowledge, or unsubscribe another window's
  Job or subscription, and cannot subscribe to the Main Window catalog.
- `Completed` is not published before its required summary and output actions.

Frontend tests must prove:

- Newer revisions replace state and stale revisions are ignored.
- Main Window and Disposable Task Window derive identical progress from the same
  snapshot.
- Current filename uses the newest recent path.
- Password-required and retry state survive the new projection.
- A restored workspace can execute an advertised retry or output action from
  retained secret-free facts; no password appears in fixtures or snapshots.
- Presentation clocks do not invoke Desktop commands.

End-to-end tests must prove:

- A long-running create and extract Job updates a Disposable Task Window without
  an active Main Window relay.
- A task opened after completion immediately renders terminal state.
- A restored Main Window discovers a Job started by a Disposable Task Window
  without polling.
- Closing a task window leaves a background Job running.
- Multiple task windows remain independent.

## Architecture guardrails

After migration, automated checks should reject:

- New calls to `poll_job_events`.
- New Job polling intervals.
- Main Window code that republishes Job progress to task windows.
- Tauri imports in Jobs Workspace or Task Workspace.
- Unbounded Job event arrays in frontend snapshots.
- Numeric Job revisions that can lose precision in JavaScript.
- Percentage or localization policy in Rust Job DTO mapping.

## Completion criteria

The Desktop architecture is complete when:

- The Rust Job Feed is the single owner of retained Desktop Job state.
- Every window subscribes directly through the same seam.
- Delivery correctness has no debounce, sleep, or polling dependency.
- Slow subscribers cannot create unbounded work or memory growth.
- Retained current and terminal state are recoverable through subscription
  alone.
- Main Window Job discovery is recoverable through the catalog subscription.
- Old polling and relay ownership paths are deleted.
- The verification suite proves correctness, performance, lifecycle cleanup, and
  parity between Main Window and Disposable Task Window.
