# ADR 0018: Separate TZAP public inventory from secure secret material

## Status

Accepted for implementation; hosted authentication remains disabled until the
Gate B criteria in `docs/TZAP_ACCOUNT_CONSOLIDATION_PLAN.md` and ADR 0011's
successor review are complete.

## Context

The current desktop account flow reads a core inventory whose JSON
representation can contain private DER key material. Create selections also
retain legacy signing paths in preferences. This makes a GUI snapshot a
secret-bearing object and prevents Rust from revalidating the selected
identity at job handoff.

The consolidation plan requires a local inventory that can ship while the
hosted certificate service is incomplete. Local public metadata and private
material therefore need different ownership, storage, and lifecycles.

## Decision

The desktop and `zmanager-core` will use two explicit stores:

- a versioned public catalog containing certificate chains, public recipient
  keys, fingerprints, aliases, lifecycle/status metadata, trusted contact
  records, and opaque `SecretRef` values;
- a purpose-specific native secure store containing private signing keys,
  recipient keys, and hosted session material.

Persistent archive selections use opaque local IDs. Rust resolves and
revalidates those IDs immediately before a job starts, then resolves only the
private material required by that operation. The React layer receives only
immutable public snapshots and render-ready option records.

The catalog and secure store are not committed atomically. Mutations use a
recoverable intent protocol: record the intent, create or retire secure
material, atomically commit the public catalog reference, then reconcile the
intent. Deletion first removes a record from selection, retains recipient
keys needed for old-archive recovery unless the user explicitly confirms
destructive loss, and only then deletes secure material.

Hosted sign-in is capability-gated. Until the normative one-time
`handoff_code` + state + PKCE exchange passes Gate B, callback processing may
report launch/cancellation/failure but cannot claim an authenticated session.
The old `native_app_relay`/`relay_body` contract is not an allowed fallback.

## Consequences

- Normal inventory snapshots no longer need to hydrate private bytes.
- Existing file-based signing can remain as an operation-scoped advanced
  migration input, but it is not a persistent account identity.
- Native platform smoke tests are required in addition to in-memory store
  tests because secure-store availability and locking are platform behavior.
- Local-only contact, signing, recipient, and archive flows can be enabled
  without pretending that hosted Account or enrollment capabilities exist.

## Non-goals

This ADR does not enable hosted authentication, certificate enrollment,
renewal, revocation, or online status. Those capabilities remain behind their
normative server-contract gates and require an ADR 0011 security review.
