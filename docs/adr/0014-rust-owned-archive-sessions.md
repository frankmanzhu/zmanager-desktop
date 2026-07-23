# ADR-0014: Rust-owned bounded Archive Sessions

- Status: Accepted
- Date: 2026-07-23

## Context

The Archive Workspace currently receives and retains a complete archive entry
vector. Large listings therefore create unbounded IPC payloads and repeated
frontend scans, clones, sorts, and tree construction. Opening must become an
asynchronous bounded query without moving archive semantics or extraction
safety out of `zmanager-core`.

The staged migration and its temporary limitations are defined in
`docs/ARCHIVE_OPEN_AND_QUICK_EXTRACT_PERFORMANCE_PLAN.md`.

## Decision

Desktop Rust owns process-local Archive Session identity, lifetime, retained
status, revision publication, bounded metadata indexing, paging, and cleanup.
`zmanager-core` remains the owner of enumeration semantics and extraction
safety. A browse session is never extraction authority.

The retained session publisher uses `tokio::sync::watch`. Notifications are
latest-value invalidations; consumers recover by reading the retained snapshot
and querying the required page. Tauri sends occur outside session locks and use
the Job Feed's one-in-flight acknowledgement pattern.

Revisions are unsigned 64-bit values serialized as decimal strings. Exhaustion
fails closed. Page cursors are opaque, revision-scoped, bounded strings; a
cursor from another session, parent, sort, or revision is rejected.

Ordering is locale-independent and total:

- name ordering places folders before non-folders, compares case-folded
  numeric-aware path-name chunks, then exact UTF-8 path bytes;
- numeric and date columns place known values before unknown values and use the
  same name and exact-path tie-breakers;
- descending order reverses the requested value comparison but preserves a
  deterministic exact-path tie-breaker;
- normalization and ordering happen in Rust; localized display values never
  participate in query identity.

Initial admission and payload limits are named constants:

- 4 active sessions process-wide;
- 500,000 retained entries and 256 MiB of estimated retained metadata per
  session, whichever is reached first;
- 200 default rows and 512 maximum rows per page;
- 128 changed-parent hints per snapshot, after which the snapshot marks the
  hints truncated;
- publication after 256 entries or 50 ms, whichever occurs first, once
  progressive enumeration exists;
- no closed-session retention: close removes the session after cancelling
  publication; failed terminal state remains only while its owning workspace
  keeps the session open.

These are safety ceilings, not performance claims. Phase 0/5 measurements may
lower them. Increasing a ceiling requires benchmark and memory evidence plus a
contract test; it is not an incidental constant edit.

Exceeding the browse index limit terminates browsing with a structured bounded
error but retains the accepted archive identity so **Test** and **Extract All**
remain available through independent core Jobs.

Password retry closes the failed session and starts a replacement session with
the supplied password. The password is captured only by the new worker and is
never placed in the registry snapshot, retry facts, diagnostics, URL, or
storage.

The first progressive backend is ZIP. Other backends explicitly use
collect-then-publish until their core adapters can provide semantically
equivalent incremental entries and cancellation checkpoints. Phase 2 itself is
collect-then-publish for every backend: its in-flight core call cannot be
interrupted and its transient complete `Vec` is not bounded. Those limitations
must remain visible until Phase 3 removes them.

Global search and flat view wait for a `ready` index in the first release.
Current-folder paging and navigation over published nodes may operate while an
index is partial. Global Select All is disabled until `ready`.

## Consequences

Frontend snapshots scale with visible pages and rendered tree summaries rather
than total archive size. Stale session and page results can be rejected by
identity and revision. Opening a valid archive can be acknowledged before its
listing completes.

Desktop gains a bounded metadata cache and cursor contract that require
explicit cleanup and contract tests. Phase 2 improves responsiveness and IPC
cost but cannot claim progressive first content, interruptible backend reads,
or bounded peak enumeration memory. ZIP progression and cooperative
cancellation are Phase 3 completion requirements.

## Verification

- Rust tests cover admission, byte/entry/page limits, cursor validation,
  revision ordering/exhaustion, latest-value conflation, acknowledgement, and
  close/replacement races.
- Rust/TypeScript fixtures cover decimal revisions, enum casing, optional
  totals, cursor opacity, and normalized errors.
- Frontend tests prove stale results are ignored and snapshot size is
  proportional to visible rows and tree summaries.
- Architecture checks reject normal Archive Workspace calls to `list_archive`
  after migration and reject complete entry vectors in published workspace
  snapshots.
- Core equivalence tests compare collected progressive ZIP enumeration with the
  prior listing result and exercise cancellation checkpoints.
