# Archive Open And Quick Extract Performance Implementation Plan

- Status: Proposed
- Date: 2026-07-22
- Scope: Archive Workspace opening and browsing, whole-archive extraction,
  shell quick actions, Desktop Rust command contracts, and `zmanager-core`
  archive enumeration/progress integration
- Primary requirement: keep the application responsive during long archive
  operations without weakening core-owned extraction safety
- Related documents:
  - `CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/REQUIREMENTS.md`
  - `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
  - `docs/ZMANAGER_DESKTOP_JOB_PROGRESS_ARCHITECTURE_SPEC.md`
  - `docs/ZMANAGER_CORE_JOB_PROGRESS_ARCHITECTURE_SPEC.md`
  - `docs/gui-audit/extraction-flow-proposal/PROPOSAL.md`

## Executive Summary

ZManager currently pays the cost of a complete archive listing before the
Archive Workspace can display any entries. The complete entry vector then
crosses the Tauri boundary and is repeatedly scanned, cloned, sorted, and
transformed on the frontend. This makes large archives slow to open and can
block the webview during the final state commit even when the native archive
read itself runs outside the frontend.

Whole-archive extraction has a separate critical-path problem. The Desktop
`start_extract` command performs a complete archive listing to estimate progress
before it creates a Job. Several `zmanager-core` extraction wrappers perform
another listing for progress totals before the real extraction pass. These
progress-only scans delay the `StartJobResponseDto`, which also delays creation
of the Disposable Task Window used by **Extract Here** and **Extract to Archive
Folder**.

The target design separates browsing from whole-archive extraction:

- Whole-archive extraction creates a Job immediately with unknown totals and
  performs all required enumeration and safety work inside the cancellable Job.
- Opening an archive creates a Rust-owned Archive Session immediately and
  indexes entries on a worker.
- The Archive Workspace renders the archive identity and opening status first,
  then root-level nodes and visible pages as they become available.
- The complete archive index remains behind the Rust session boundary. React
  receives bounded, immutable pages and tree summaries rather than the complete
  archive entry vector.
- Search, flat view, global selection, and final totals are enabled only when
  their data requirements are satisfied.

This plan must not move archive parsing, extraction planning, path safety,
collision behavior, link checks, overwrite rules, or archive-bomb protection
into TypeScript.

## Problem Statement

### User-visible symptoms

Users can observe one or more of the following with large archives:

- **Open Archive with ZManager** shows little useful content until the entire
  archive listing has completed.
- The window can appear unresponsive while the complete listing is converted
  into frontend state.
- **Extract Here** and **Extract to Archive Folder** can pause before their
  Disposable Task Window appears.
- Progress can appear late because the application waits to calculate totals
  before showing the Job.
- Expanding or navigating a large archive can repeatedly incur full-entry-array
  derivation costs even though the UI only displays one folder.

### Product outcome

The application must always acknowledge an open or extraction request quickly,
keep navigation and window controls responsive, and expose cancellation as soon
as meaningful work begins. Exact percentages are secondary to prompt, truthful
feedback.

### Engineering outcome

Archive enumeration must become an asynchronous, bounded, revisioned data
source. Whole-archive extraction must not depend on a browse listing or a
progress-only pre-scan. Frontend snapshots must scale with what is visible, not
with the total number of archive entries.

## Current Behavior And Evidence

### Open Archive path

The current flow is:

```text
Open command / quick action
  -> archiveOpenController.openArchiveFromPath
  -> archiveLoadController.loadArchive
  -> Archive Workspace beginLoading snapshot
  -> list_archive Tauri command
  -> zmanager_core::archive_browser::list_entries_with_options
  -> complete BrowserListing with every entry
  -> complete Vec<ArchiveEntryDto>
  -> one serialized ArchiveListingResponse
  -> Archive Workspace loadSucceeded
  -> complete frontend entry clone
  -> visible-row derivation over all entries
  -> complete folder-tree construction over all entries
  -> selection and details derivation
  -> another complete entry clone into the published snapshot
  -> React render
```

Relevant current seams:

- `src/app/controllers/archiveOpenController.ts`
- `src/app/controllers/archiveLoadController.ts`
- `src/api/commands.ts`
- `src-tauri/src/commands.rs::list_archive`
- `crates/zmanager-core/src/archive_browser.rs::list_entries_with_options`
- `src/app/workspaces/archiveWorkspace.ts::loadSucceeded`
- `src/app/workspaces/archiveWorkspace.ts::snapshotFromState`
- `src/app/archiveTree.ts::buildArchiveTree`
- `src/app/hierarchicalTable.ts::buildHierarchicalRows`

The loading snapshot is useful, but it does not solve the complete-response and
complete-commit costs that follow it.

### Whole-archive extraction path

The current direct extraction flow is:

```text
Extract Here / Extract to Archive Folder
  -> quickActionController.startQuickExtract
  -> start_extract Tauri command
  -> archive_extract_progress_estimate
  -> complete archive listing for totals
  -> create Job Registry record
  -> return StartJobResponseDto
  -> create Disposable Task Window
  -> extraction worker starts
  -> core extraction wrapper may list again for totals
  -> extraction backend enumerates and extracts entries
```

Relevant current seams:

- `src/app/controllers/quickActionController.ts::startQuickExtract`
- `src-tauri/src/commands.rs::start_extract_internal`
- `src-tauri/src/commands.rs::archive_extract_progress_estimate`
- `src/desktop/disposableTaskWindowManager.ts::open`
- extraction wrappers under `crates/zmanager-core/src/jobs.rs`

The existing `e2e/quick-actions.spec.ts` test correctly proves that the
frontend does not call `list_archive` for an Extract Here context action. It
does not cover the progress-only listing performed inside `start_extract` or
the additional listing performed inside some core extraction wrappers.

### Safety distinction

The progress-only listings are not the authoritative extraction safety check.
They exist to calculate entry and byte totals. The extraction backends still
have to inspect entry metadata and apply core-owned safety decisions before or
while materializing output.

Some formats can validate entries incrementally. Other formats may need a
complete safety plan before writes can safely begin, especially for collision,
hardlink, or global archive-limit behavior. This plan does not prescribe one
validation strategy for every format. It only removes unrelated browse and
progress work from the Job creation path.

## Goals

- Return a `StartJobResponseDto` for whole-archive extraction without first
  enumerating the archive for progress totals.
- Request the Disposable Task Window as soon as the Job ID exists.
- Display an indeterminate but truthful extraction phase until authoritative
  totals become available.
- Paint the Archive Workspace immediately after the user chooses an archive.
- Run archive indexing away from the frontend thread and outside synchronous
  request presentation work.
- Show root-level archive contents before the complete frontend browse model is
  available when the backend can publish entries progressively.
- Keep the Rust Archive Session authoritative for indexed archive metadata.
- Send bounded pages and summaries over Tauri IPC.
- Keep frontend work per update bounded and independent of total archive size.
- Preserve password retry, cancellation, job retention, diagnostics, and
  platform window behavior.
- Preserve every `zmanager-core` extraction safety guarantee.
- Delete the old complete-list frontend ownership path when the migration is
  proven.

## Non-goals

- Do not make extraction begin before core safety requirements are satisfied.
- Do not reproduce archive parsing or hierarchy semantics in TypeScript.
- Do not make guessed progress appear smoother.
- Do not guarantee that every archive format can produce root nodes before its
  complete metadata stream has been read.
- Do not persist archive entry metadata across application launches in the
  first implementation.
- Do not add a general database, state framework, or frontend worker merely for
  this migration.
- Do not change archive overwrite, collision, strip-components, link, or bomb
  policies.
- Do not use a frontend-provided listing as trusted input to extraction.
- Do not keep the legacy `list_archive` flow indefinitely as a second browse
  implementation.

## Architectural Invariants

1. `zmanager-core` owns archive enumeration semantics and extraction safety.
2. Desktop Rust owns Archive Session identity, lifetime, cancellation, IPC,
   paging, revision delivery, and bounded retention.
3. `src/app/workspaces/archiveWorkspace.ts` owns deterministic user-facing
   browse state and command readiness.
4. An application controller owns asynchronous session orchestration through
   injected API effects.
5. `src/ui` renders immutable snapshots and emits typed intents only.
6. `src/main.ts` remains a composition root. No session state, entry cache,
   batch merge logic, or command switch is added there.
7. Passwords never enter snapshots, diagnostics, URLs, storage, or process
   arguments.
8. Archive paths and selected entry paths are revalidated by the core before
   extraction; a browse session is not a safety authority.
9. Every stream or subscription is revisioned and recoverable from a missed or
   conflated notification.
10. Every IPC payload and frontend render update is bounded.

## Target User Experience

### Open Archive

#### Step 1: immediate acknowledgement

After file selection, association launch, drop, or **Open Archive with
ZManager**, the Main Window should immediately:

- switch to the Extract Workspace;
- show the archive name and path;
- retain the normal window chrome and navigation responsiveness;
- show `Opening archive...` in the archive status surface;
- leave unrelated app commands, Jobs, Preferences, and window controls usable.

The existing table can display a small skeleton or empty loading row. Loading
must not replace the whole window with a modal overlay.

#### Step 2: session accepted

After Desktop Rust validates the request and creates an Archive Session, the
workspace enters `indexing`. The archive is now the active archive even if no
entries have been published yet.

If the archive needs a password, the session publishes a password-required
failure. The controller prompts once and restarts or retries the session with
the supplied password. The password is never stored in workspace state.

#### Step 3: root ready

When the first root page is available:

- render discovered root folders and files;
- enable folder navigation for published nodes;
- show a status such as `Indexing archive... 12,450 entries found`;
- keep incomplete counts visually distinguishable from final counts;
- avoid changing keyboard focus when new nodes arrive.

Root contents may grow while indexing continues. Batch publication must be
debounced and atomically replace a page rather than append one React row at a
time.

#### Step 4: background indexing

The current folder and expanded tree branches request bounded pages from the
session. If a requested folder is only partially indexed, its page reports that
fact and the UI shows a local loading affordance without clearing already
published rows.

The user may start **Extract All** during indexing once the archive request is
valid. The extraction Job performs its own core-owned safety work.

#### Step 5: index ready

When enumeration completes:

- publish final entry and byte totals where known;
- mark all child-page completeness flags final;
- enable complete-index features;
- replace `Indexing archive...` with the existing loaded or valid-empty status;
- preserve the current folder, expanded nodes, sort, and valid selection.

### Command readiness while indexing

| Command or surface | Opening | Root ready / indexing | Ready |
| --- | --- | --- | --- |
| Close Archive | Enabled | Enabled | Enabled |
| Open another archive | Enabled | Enabled | Enabled |
| Extract All | Disabled until session accepted | Enabled | Enabled |
| Extract Selected | Disabled | Enabled for fully resolved selections | Enabled |
| Navigate published folders | Disabled | Enabled | Enabled |
| Refresh | Cancel/restart only after session exists | Enabled | Enabled |
| Search current published page | Optional; avoid ambiguous semantics | Optional | Enabled |
| Global search | Disabled | Disabled or explicitly partial | Enabled |
| Flat View | Disabled | Disabled or explicitly partial | Enabled |
| Select All archive entries | Disabled | Disabled | Enabled |
| Test archive | Enabled after session accepted | Enabled | Enabled |

The first implementation should disable global operations during partial
indexing rather than silently applying them to incomplete data.

### Extract Here And Extract All

The direct whole-archive extraction flow should be:

```text
Shell or workspace action
  -> cheap request and destination validation
  -> create Job Registry record
  -> return StartJobResponseDto
  -> show/focus Disposable Task Window or Job surface
  -> worker emits "Preparing safe extraction..." with unknown totals
  -> core enumerates and validates according to format requirements
  -> worker extracts with cancellation and progress
  -> totals become determinate only when authoritative
  -> terminal completion, failure, cancellation, or password retry
```

The user must be able to see and cancel the Job while enumeration or safety
planning is in progress. Unknown totals render as indeterminate progress, not
`0%` with a false ETA.

### Accessibility behavior

- Opening and indexing statuses use the existing polite status mechanism and
  must not repeatedly announce every batch.
- A root-ready transition may announce once that archive contents are
  available while indexing continues.
- Background batches must not steal focus or reset the focused row.
- Incomplete-count text must not rely on color alone.
- Skeleton rows are presentation-only and excluded from the accessibility
  tree.
- Disabled global operations expose a concise reason through the established
  command-state tooltip or description seam.

## Target Architecture

### Overview

```text
Open intent
  -> Archive Open Controller
  -> start_archive_index
  -> Desktop Archive Session Registry
       -> zmanager-core archive entry source on worker
       -> bounded Rust index store
       -> retained revisioned session snapshot
       -> latest-value subscription
  -> Archive Index Controller
       -> fetch current root/current-folder pages
       -> ignore stale session or revision results
  -> Archive Workspace
       -> bounded render-ready snapshot
  -> React Archive Workspace

Whole-archive extract intent
  -> Extract Start Controller / Quick Action Controller
  -> start_extract
  -> immediate Job Registry record and response
  -> Disposable Task Window / Job Feed subscription
  -> zmanager-core extraction worker
       -> safety planning or incremental validation
       -> extraction and authoritative progress
```

### Desktop Archive Session Registry

Add a deep Rust module under `src-tauri/src/archive_index.rs` or an equivalently
explicit name. It owns:

- opaque Archive Session IDs;
- the canonical archive path associated with each session;
- session lifecycle and cancellation tokens;
- session status and monotonically increasing revision;
- the bounded metadata index built from core entries;
- aggregate discovered/final entry and byte counts;
- per-parent child indexes needed for paging;
- subscriber creation and cleanup;
- terminal error state and secret-free retry facts;
- closing and bounded retention.

The registry must not own archive parsing rules. It consumes typed archive
entries produced by a `zmanager-core` listing/enumeration API.

The Main Window currently owns one active Archive Workspace, but the registry
must still use explicit session IDs. Explicit identity prevents results from a
cancelled or superseded open from overwriting a newer archive.

### Retained latest-value session snapshot

Follow the same correctness principles as the Job Feed: retain authoritative
current state and use notifications as invalidation, not as an irreplaceable
delta log.

Conceptual snapshot:

```text
ArchiveIndexSnapshotDto
  revision: unsigned 64-bit decimal string
  sessionId: opaque string
  archivePath: string
  status: opening | indexing | ready | empty | failed | cancelled
  discoveredEntries: integer
  discoveredBytes: optional integer
  finalEntryCount: optional integer
  finalTotalBytes: optional integer
  rootRevision: unsigned 64-bit decimal string
  changedParentPaths: bounded string array
  latestFailure: optional secret-free CommandErrorDto
```

Requirements:

- A new subscriber immediately receives the retained current snapshot.
- Slow subscribers receive the latest snapshot, not an unbounded batch queue.
- Revisions never wrap or reuse a visible value.
- A snapshot is small and does not contain every archive entry.
- `changedParentPaths` is an optimization hint. Consumers can always recover by
  querying the current folder against the retained revision.
- Tauri channel sends happen outside registry locks.

### Command contract

Exact DTO names may change during implementation, but the boundary should
provide these capabilities:

```text
start_archive_index(request)
  -> ArchiveIndexStartResponseDto { sessionId, snapshot }

subscribe_archive_index({ sessionId, onSnapshot })
  -> subscriptionId

get_archive_children({
  sessionId,
  parentPath,
  cursor,
  limit,
  sort,
  expectedRevision?
})
  -> ArchiveChildrenPageDto

search_archive_index({
  sessionId,
  query,
  cursor,
  limit,
  sort,
  expectedRevision?
})
  -> ArchiveSearchPageDto

close_archive_index({ sessionId })
  -> void
```

`ArchiveChildrenPageDto` should contain:

- the session and index revision used for the page;
- normalized parent path;
- bounded rows;
- a continuation cursor rather than a numeric offset where practical;
- whether the page and parent are complete;
- discovered child count and final child count when known;
- enough entry metadata for the visible table and details pane;
- no password or mutable backend handle.

Continuation tokens are opaque and validated by Desktop Rust. The frontend
must not construct offsets into internal vectors or depend on storage layout.

The current `list_archive` command may remain only during a named migration
phase. Completion requires removing it from normal Archive Workspace execution,
removing the complete `ArchiveListingDto.entries` ownership path, and deleting
the corresponding compatibility code and tests that no longer express the
target contract.

### Core enumeration API

The first Archive Session implementation can wrap the existing
`list_entries_with_options` call on a worker. This immediately removes native
enumeration from the synchronous UI flow and avoids sending the full result to
React, but root contents will still wait for core listing completion.

True progressive root display requires a core-owned enumeration seam, for
example:

```rust
pub trait ArchiveEntrySink {
    fn entry(&mut self, entry: BrowserEntry) -> Result<(), ArchiveBrowserError>;
    fn checkpoint(&mut self) -> Result<(), ArchiveBrowserError>;
}

pub fn visit_entries_with_options(
    path: impl AsRef<Path>,
    options: BrowserListOptions<'_>,
    sink: &mut dyn ArchiveEntrySink,
) -> Result<BrowserListingSummary, ArchiveBrowserError>;
```

The exact Rust API is a core decision. It must provide:

- the same format routing and normalized metadata as the existing listing API;
- cancellation or checkpoints at bounded intervals;
- entry delivery without requiring a complete `Vec` first where the backend
  permits it;
- one final summary containing authoritative counts and totals;
- equivalent error and password behavior;
- a compatibility collector so the existing full-list API can be implemented
  from the new enumeration seam during core migration;
- per-backend equivalence tests proving collected progressive output matches the
  existing listing behavior.

Do not implement format-specific archive readers in Desktop Rust to obtain
earlier root nodes. If a backend cannot stream entries safely, it may publish
only after its complete list is ready while still keeping the UI responsive.

### Bounded Rust index

The index should normalize each core entry once and maintain structures needed
for the product queries:

- entry metadata keyed by normalized archive path;
- child identities grouped by normalized parent path;
- folder summaries including whether discovered children exist;
- aggregate discovered/final counts and known sizes;
- stable ordering keys for paged results;
- optional search keys built during enumeration.

Do not repeatedly rebuild the complete tree for every query or subscriber.
Updating one entry should touch only its path, required ancestor summaries, and
aggregate counters.

Memory and payload budgets must be named constants selected from Phase 0
measurements. The implementation must define:

- maximum active sessions;
- maximum retained metadata bytes or entry count per session;
- maximum page size;
- maximum changed-parent hint count;
- minimum publication interval or entry threshold;
- terminal and closed-session retention duration.

If a valid archive exceeds the browse index budget, fail browsing with an
actionable bounded-index error while leaving **Extract All** available. Do not
allow an unbounded allocation merely because the previous full-list path was
also unbounded.

### Ordering and paging

Paging requires a stable backend ordering contract. Characterize the current
folder-first, numeric-aware path ordering before moving it across the boundary.
Then define a language-neutral stable key with an exact-path tie-breaker.

Do not sort each page independently in TypeScript; that would make pagination
globally incorrect. Display localization may format dates and sizes, but it
must not change query identity, persisted paths, cursors, or ordering keys.

If entries arriving during indexing would sort before an already returned
cursor, the page response must expose its revision and partial status. The
controller should atomically refresh the visible page when its parent revision
changes rather than splice entries into uncertain positions.

### Frontend Archive Workspace state

Deepen the existing Archive Workspace rather than adding a parallel browse
store. Its durable state should become conceptually:

```text
archive identity
  archivePath
  sessionId
  sessionRevision

index state
  idle | opening | indexing | ready | empty | error
  discovered/final counts
  latest secret-free error

navigation state
  currentFolder
  breadcrumbs
  navigation history
  expanded folder paths

bounded browse data
  visible folder page
  visible page cursor/completeness
  bounded tree summaries for rendered branches
  page request revision

view state
  sort
  search query/mode
  flat-view mode
  row options

selection state
  selected visible paths
  focused path
  anchor path
```

The workspace must not contain:

- the complete archive entry array;
- a mutable session object;
- a Tauri Channel or Promise;
- a password;
- a mutable `Map` or `Set` in its published snapshot;
- async request or cancellation handles.

State transitions must reject stale results by both `sessionId` and request or
index revision. Closing or replacing an archive clears bounded pages and makes
late results inert.

### Archive Index Controller

Refactor `archiveLoadController.ts` into, or replace it with, a controller that
coordinates:

- starting and closing sessions;
- subscribing and unsubscribing;
- password retry;
- fetching the current root/folder/search page;
- coalescing repeated invalidations for the same visible parent;
- committing success/failure intents to Archive Workspace;
- ignoring stale results;
- preserving view state across Refresh when valid;
- cleanup on archive close, window unload, and application shutdown.

All API, dialog, and timer behavior remains injected. The controller must not
import Tauri directly.

### React rendering

Continue using the existing React components, shadcn/ui primitives, and
Tailwind CSS 4 utilities.

The UI changes should be limited to:

- opening/indexing status presentation;
- bounded root and folder pages;
- partial-folder loading affordances;
- command disabled reasons;
- optional load-more or automatic paging behavior;
- row virtualization only when a single folder can exceed the safe render
  budget.

Do not add raw CSS, imperative DOM construction, or a second hidden rendering
path. Existing Archive Workspace components should render the new snapshot
contract directly.

### System icon loading

System icon lookup must follow the same bounded-page rule. Request icons only
for visible rows or a small look-ahead page, deduplicate by the existing icon
key contract, and ignore results for stale session/page revisions. Do not issue
an icon request for every indexed entry.

## Whole-Archive Extraction Changes

### Desktop Job creation boundary

Change `start_extract_internal` so the synchronous portion performs only:

- non-empty request validation;
- destination collision-root selection that does not enumerate archive
  contents;
- entry-path request normalization;
- archive family routing;
- Job Registry allocation;
- secret-free retry/output-action configuration;
- worker input capture;
- worker spawn.

It must not call `archive_extract_progress_estimate` before
`registry.try_create_job`. Remove that helper when no remaining caller needs it.

The Job Registry should publish a queued or preparing snapshot immediately.
`addJobState` can then create the Disposable Task Window without waiting for an
archive scan.

### Core extraction wrappers

Review each extraction wrapper in `crates/zmanager-core/src/jobs.rs` for a pre-list
whose only purpose is calculating `total_bytes` or `total_entries`.

For each backend:

1. Emit `Started` or an equivalent preparation phase with unknown totals.
2. Prefer totals available cheaply from an already-open authoritative backend
   structure.
3. If enumeration is inherently part of safety planning, update totals from
   that same pass rather than opening the archive for a separate progress pass.
4. Never perform a second archive traversal solely to make progress
   determinate.
5. Keep cancellation checks active during planning/enumeration.
6. Keep terminal failures and password-required errors authoritative.

If the core Job event contract cannot add totals after `Started`, initially
leave totals unknown. A later companion-spec change may add an authoritative
totals update; it must not block this performance fix.

### Extract All from an open session

Do not send the frontend browse index back to Rust as extraction authority.
The normal `StartExtractRequest` remains sufficient for whole-archive
extraction.

A future optimization may let extraction reuse a Rust-owned archive handle or
trusted metadata from the Archive Session, but only if `zmanager-core` exposes
an explicit safe reuse contract. It is not required for this plan and must not
couple Job lifetime to React state.

### Password behavior

Removing the pre-scan can move password detection later, from command return to
the running Job. The retained Job Feed already supports a secret-free retry
descriptor. Ensure the UX is:

- Job becomes visible immediately;
- Job reports password required;
- retry action prompts for the password;
- retry starts a replacement or resumed Job according to existing Job policy;
- no password is retained in the descriptor, snapshot, diagnostic event, URL,
  or storage.

Do not preserve synchronous password prompting merely by keeping the expensive
pre-list.

## Error, Cancellation, And Lifecycle Rules

### Archive Session errors

Map errors through existing normalized command error categories. At minimum,
support:

- invalid request or unsupported archive;
- source not found or inaccessible;
- password required or invalid password;
- corrupt archive;
- unsafe or rejected metadata if listing enforces it;
- browse index limit exceeded;
- cancelled;
- unknown operation failure.

Errors remain visible in the Archive Workspace without disabling unrelated app
surfaces. If the session is readable enough for whole-archive extraction but
the browse index exceeds its configured budget, provide **Extract All** as a
recovery action.

### Cancellation

- Closing an archive cancels its index worker and releases its session.
- Opening another archive closes the previous session before or immediately
  after the new session becomes authoritative.
- Refresh replaces the session or resets it through one documented path; it
  does not run two uncoordinated indexers.
- Subscriber removal does not necessarily cancel an active session while the
  owning workspace remains open.
- Application/window shutdown closes owned sessions.
- Extraction cancellation continues through the Job Feed and core
  `CancellationToken` path.

### Revisions and stale work

Every async result is accepted only when all relevant identities match:

- active Archive Session ID;
- session revision or a compatible expected revision;
- visible parent/search request ID;
- active Archive Workspace generation.

Tests must deliberately deliver old session snapshots and old page responses
after a replacement open to prove they are ignored.

## Diagnostics And Performance Measurement

Add bounded, secret-free lifecycle facts before optimizing so improvements are
measurable. Suggested events:

```text
archiveIndex.requested
archiveIndex.sessionCreated
archiveIndex.firstEntryObserved
archiveIndex.firstRootPageReady
archiveIndex.completed
archiveIndex.failed
archiveIndex.cancelled
archiveIndex.closed
extract.jobRegistered
extract.workerStarted
extract.firstProgressObserved
```

Allowed fields include:

- archive family, not selected path;
- discovered/final entry counts;
- page size;
- elapsed milliseconds for named phases;
- result/error code;
- whether totals were initially known;
- whether the backend used progressive or collect-then-publish enumeration.

Do not log paths, passwords, opaque request/session tokens, raw archive
metadata, or entry names.

### Performance budgets

Phase 0 must establish release-hardware baselines and set named constants. The
following are initial acceptance targets, measured after the process and
frontend have received the action:

- `start_extract` returns a Job response without archive enumeration and within
  100 ms on the benchmark fixture.
- a Disposable Task Window is requested within 250 ms of the frontend
  receiving a direct extraction action;
- the Archive Workspace paints its opening state within one animation frame of
  accepting the selected path;
- no archive-index frontend commit creates a task longer than 50 ms on the
  benchmark machine;
- no single archive page or subscription payload exceeds the documented page
  and byte budget;
- navigation among already indexed folders completes within 100 ms;
- memory remains within the named per-session and process-wide index limits;
- cancellation becomes visible within one bounded worker checkpoint interval.

Time to first root content is format and storage dependent. Record it
separately from UI responsiveness and do not fail a slow compressed-stream
format against a central-directory ZIP target.

## Implementation Phases

### Phase 0: characterization and benchmark harness

Purpose: prove current behavior before changing ownership.

Tasks:

- Add generated benchmark archives covering:
  - 100,000 shallow entries;
  - deeply nested paths;
  - one folder with a very large child count;
  - mixed files and explicit/implicit directories;
  - encrypted archive behavior where supported;
  - at least one streaming format and one central-directory format.
- Keep generated archive artifacts out of source control when they are large;
  check in deterministic generators and small semantic fixtures.
- Record current open/list/DTO/frontend-commit timings.
- Count backend archive enumerations for whole-archive extraction.
- Add characterization tests for current ordering, synthetic folders,
  selection, navigation preservation, password retry, and error mapping.
- Select and document page, publication, memory, and retention constants.

Exit criteria:

- baseline timings and enumeration counts are reproducible;
- current user-visible behavior has characterization coverage;
- performance budgets have named test or diagnostic owners.

### Phase 1: immediate extraction Job creation

Purpose: remove the highest-impact quick-action delay with minimal browse
architecture change.

Tasks:

- Add a failing Rust regression test proving Job creation does not call archive
  listing/progress estimation.
- Move Job allocation ahead of all archive enumeration.
- delete `archive_extract_progress_estimate` from the command critical path;
- open the Disposable Task Window from the immediate Job response;
- render truthful indeterminate preparation progress;
- remove progress-only pre-lists from core wrappers backend by backend;
- preserve retry descriptors and password-required terminal behavior;
- add diagnostic timestamps from request receipt to Job registration and task
  window request.

Exit criteria:

- direct extraction has no progress-only enumeration before Job creation;
- the task surface appears before archive enumeration completes;
- all extraction safety and backend tests pass;
- missing/invalid password retry remains usable;
- Rust formatting and focused frontend tests pass.

### Phase 2: background Archive Session with existing core listing

Purpose: keep the app responsive before progressive core enumeration is ready.

Tasks:

- introduce the Desktop Archive Session Registry;
- add start, subscribe, page, and close commands with explicit contract tests;
- run existing full core listing on a cancellable blocking worker;
- build the Rust index after listing completes;
- send only a bounded root/current-folder page to the frontend;
- introduce revision and stale-session handling;
- update Archive Workspace/controller states to opening/indexing/ready;
- keep the current UI responsive and preserve already rendered application
  surfaces.

Limitation:

- first root content still waits for the complete core list in this phase;
- the limitation must be named in release notes or implementation status and
  must not be presented as completed progressive indexing.

Exit criteria:

- complete archive entry vectors no longer cross into normal React state;
- frontend work per session update is bounded;
- closing/reopening cancels or invalidates old work;
- navigation uses paged Rust queries;
- existing open, refresh, password, and error behavior passes.

### Phase 3: progressive core enumeration

Purpose: publish root contents while enumeration is still running.

Tasks:

- add the core entry sink/visitor abstraction;
- convert each backend or provide an explicit collect-then-publish fallback;
- prove progressive collection equivalence with the existing listing result;
- feed entries incrementally into the Desktop Rust index;
- publish debounced retained session snapshots;
- atomically refetch current-folder and visible-tree summaries on revision
  invalidation;
- expose partial/final page completeness;
- support cancellation at bounded checkpoints;
- prevent a fast producer from generating an unbounded notification queue.

Exit criteria:

- at least the primary ZIP path publishes root content before complete
  enumeration on the large-entry fixture;
- every supported format remains responsive and identifies whether it is truly
  progressive or collect-then-publish;
- a slow frontend subscriber receives current state without memory growth;
- collected output remains semantically equivalent to the prior list API.

### Phase 4: complete frontend ownership migration

Purpose: remove complete-entry-array assumptions and old browse ownership.

Tasks:

- remove complete `entries` from Archive Workspace durable and published state;
- replace full-array row/tree/details derivation with bounded page and summary
  acceptance;
- route folder navigation, tree expansion, search, flat view, selection, and
  refresh through typed Archive Workspace intents and controller effects;
- preserve command routing across toolbar, menu, shortcut, context menu,
  details pane, tree, and row actions;
- bound system icon lookup to visible pages;
- add virtualization only if measured folder render cost requires it;
- delete the normal-workspace `list_archive` invocation and compatibility
  render path;
- keep `src/main.ts` limited to composition and bindings.

Exit criteria:

- no complete archive entry collection is stored or cloned in frontend
  snapshots;
- deleting the new Archive Session path would remove browsing rather than reveal
  a hidden legacy fallback;
- all command surfaces use the same workspace/router decisions;
- large fixture navigation remains within the frontend task budget.

### Phase 5: hardening and rollout

Tasks:

- run Windows, Linux, and macOS smoke tests;
- test cold and warm shell quick actions;
- test Main Window and Disposable Task Window coexistence;
- test malformed, encrypted, split, remote/inaccessible, and huge-entry-count
  archives;
- test application shutdown and session cleanup;
- compare diagnostic performance facts against Phase 0 baselines;
- document any backend still using collect-then-publish;
- update architecture and requirements documents if command names or durable
  ownership differ from this plan;
- create and accept the Archive Session ADR before declaring the migration
  complete.

Exit criteria:

- performance budgets pass on release-class hardware;
- no safety, password, window-lifecycle, or command-surface regression remains;
- no feature flag or parallel legacy path is required for normal operation;
- the old full-list frontend path is deleted.

## Test Strategy

### Desktop Rust tests

- `start_extract` allocates and returns a Job without calling a listing
  dependency.
- unknown progress totals still produce a valid retained Job snapshot.
- worker-start failure becomes a terminal Job failure rather than a command
  hang.
- Archive Session IDs are opaque and unique.
- new subscriptions immediately receive the current retained snapshot.
- slow subscribers observe the latest revision without an unbounded queue.
- closing a session cancels work and rejects later page queries.
- stale expected revisions produce a typed retry/refetch result.
- page size and memory limits are enforced.
- password and error snapshots are secret-free.
- diagnostic records contain counts and codes, not paths or secrets.

Inject an archive-entry source into the registry/command tests. Do not test
enumeration counts through a private helper created only for the test.

### `zmanager-core` tests

- collecting progressive entries matches `list_entries_with_options` for each
  supported backend.
- entry order and metadata normalization remain characterized.
- cancellation is observed during long enumeration.
- password-required and invalid-password results remain equivalent.
- extraction wrappers do not pre-list solely for progress.
- safety planning and extraction reject all previously covered path,
  collision, link, overwrite, and bomb cases.
- unknown initial totals do not prevent byte/entry progress from advancing.

### Frontend Vitest coverage

- opening publishes an immediate opening snapshot without entries.
- session acceptance enables only the intended commands.
- root-ready indexing state preserves focus and current workspace mode.
- partial pages do not enable global selection or complete-index search.
- ready state enables complete-index commands.
- old session and old page revisions are ignored.
- Refresh preserves view state only when paths remain valid.
- closing clears session-owned pages and command readiness.
- password retry never places a password in a snapshot.
- selection/focus cleanup is correct when a visible page changes.
- snapshot size is proportional to visible rows/tree summaries.

### Contract coverage

- Add generated bindings or explicit Rust/TypeScript serialization fixtures for
  every new command and snapshot.
- Verify decimal-string revisions round-trip and compare correctly with
  `BigInt`.
- Verify enum casing, optional counts, cursor opacity, and normalized errors.
- Remove old `list_archive` contract fixtures after the migration deletion
  gate.

### Playwright coverage

- Open Archive shows an immediate opening state while the stubbed index is
  delayed.
- root contents appear before a delayed completion snapshot.
- window/menu controls remain interactive during indexing.
- opening a second archive ignores late results from the first.
- Extract All becomes available at session acceptance, before index completion.
- global search and Select All remain disabled while results are partial.
- Extract Here requests a task window before the delayed worker reports its
  first progress.
- password-required extraction exposes retry without leaking the password.
- cancellation during preparation updates the task surface.

### Manual native checks

- Windows Explorer **Open archive**, **Extract Here**, and **Extract to Archive
  Folder** on cold and warm launch.
- Linux file-manager equivalents where installed.
- macOS document open/Finder action flow and normal Main Window coexistence.
- native password prompts and task-window focus behavior.
- slow local disk, network-mounted local path where supported, and removable
  media behavior.
- keyboard navigation and screen-reader status announcements during indexing.

Manual checks supplement, but do not replace, automated state and contract
tests.

## File-Level Change Map

Expected Desktop changes:

```text
src-tauri/src/archive_index.rs                  new deep session/index module
src-tauri/src/commands.rs                       new session commands; extract hot-path fix
src-tauri/src/dto.rs                            bounded session/page contracts
src-tauri/src/main.rs                           command registration/composition only
src/api/types.ts                                generated or contract-covered DTOs
src/api/commands.ts                             invoke/subscription wrappers only
src/app/workspaces/archiveWorkspace.ts          progressive deterministic state
src/app/controllers/archiveLoadController.ts    replace/deepen into session orchestration
src/app/controllers/extractStartController.ts   retain immediate Job start behavior
src/app/controllers/quickActionController.ts    retain action routing and Job presentation
src/app/commands/*                              updated readiness, shared execution
src/ui/react/archive/*                          bounded page/status rendering
src/desktop/*                                   channel/session cleanup adapters if required
e2e/quick-actions.spec.ts                       task-window timing regression
e2e/*                                           progressive open behavior
docs/adr/0014-*.md                              proposed Archive Session ownership ADR
```

Expected core changes in the pinned sibling repository:

```text
crates/zmanager-core/src/archive_browser.rs     progressive enumeration seam
crates/zmanager-core/src/jobs.rs                no progress-only extract pre-list
crates/zmanager-core/src/*_backend.rs            backend enumeration adapters/tests
```

Names are illustrative. Do not create a file when the responsibility belongs
cleanly in an existing deep module.

## Migration And Deletion Gates

Temporary compatibility is allowed only when it is explicit and short-lived.

During migration:

- mark the old `list_archive` controller path as legacy compatibility;
- do not add new behavior to it;
- keep one owner for command readiness;
- do not publish both complete and paged archive data in the same normal
  snapshot;
- do not render a hidden old table to preserve control behavior;
- record the phase that deletes each compatibility seam.

Migration is complete only when:

- the normal Archive Workspace never requests the complete `list_archive`
  response;
- the frontend does not retain a complete entry vector;
- tree, table, details, selection, and commands consume the bounded session
  snapshot;
- quick whole-archive extraction returns a Job before enumeration;
- progress-only pre-lists are removed or justified per backend;
- old tests are deleted or rewritten against the new public seam;
- the accepted ADR and architecture docs describe the actual implementation.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Progressive batches reorder visible rows and disrupt focus | Publish atomic revisioned pages; preserve focus by stable path identity |
| Paging changes current sort behavior | Characterize ordering first and define one backend stable ordering contract |
| Session metadata becomes another unbounded cache | Enforce named entry/byte/session limits and bounded retention |
| A slow subscriber accumulates updates | Use retained latest-value snapshots and bounded invalidation hints |
| Old results overwrite a newly opened archive | Require session ID plus revision/request identity on every acceptance path |
| Password detection occurs later than today | Show the Job immediately and use the retained secret-free retry descriptor |
| Unknown totals reduce perceived progress quality | Show truthful preparation phase; add totals later only when authoritative |
| Core backends differ in streaming ability | Support explicit collect-then-publish fallback without blocking the UI |
| Frontend paging accidentally becomes archive semantics | Keep normalization, enumeration, and ordering contracts in Rust/core |
| Browse index is reused as extraction authority | Require core revalidation for every extraction request |
| Temporary migration creates two architectures | Define deletion gates and prohibit new behavior on the legacy path |

## Review Decisions Required Before Phase 2

The implementation owner should record these decisions in the proposed Archive
Session ADR:

1. Whether the retained session snapshot uses `tokio::sync::watch` directly or
   an equivalent latest-value primitive.
2. The stable ordering contract used for paged children and search results.
3. The measured page, publication, memory, active-session, and retention
   limits.
4. Whether a session that exceeds the browse index limit remains usable for
   Test and Extract All.
5. Whether password retry restarts a session or retries the existing worker.
6. Which core backends are progressive in the first release and which use the
   collect-then-publish fallback.
7. Whether global search waits for `ready` in the first release or queries
   explicitly partial results.

These decisions affect command contracts, memory safety, or user-visible
semantics and should not remain implicit in controller code.

## Definition Of Done

The work is complete when a large archive can be opened without freezing the
application, useful root contents appear progressively where the core backend
supports it, and whole-archive extraction creates a visible cancellable Job
without a browse or progress-only pre-list.

Completion requires automated proof, measured performance evidence, native
smoke coverage, preserved core safety tests, bounded resource behavior, and
deletion of the old complete-list frontend ownership path.
