# Phase 11 — Versioned replacement migration

- Completed: 2026-07-18
- Source revision: `2a897c408ce82bdf1d7b86a8a1b80967ea039f7b` plus the recorded working-tree migration
- Migration schema: `1`
- Result: PASS

## Ownership and ordering

The migration runs from the four-line runtime bridge before the runtime adapter
module is imported. This guarantees migrated typed preferences exist before
display context, Shell Workspace, Archive Workspace, Create Workspace, table
state, or path histories are constructed. Browser preview skips the desktop
operation.

Swift reads a fixed allowlist from the legacy `UserDefaults` domain, checks the
known legacy Application Support directory, identifies stale preview roots,
decodes default-opener restoration state, records current association owners,
and validates exact legacy application candidates. It never reads auth or
secret-shaped keys. Diagnostics contain normalized key and code fields only.

Rust owns the schema, atomic owner-only state file, per-step markers,
interruption recovery, backups, default-handler mapping, cleanup, registration
reconciliation, and completion acknowledgement. The frontend applies each
preference only when the corresponding replacement key is absent; mere presence
of a newer value wins even if that value is later normalized by the normal
preference loader.

Account identity migration uses `FileTzapLocalIdentityStore` to decode,
validate, and re-save through `zmanager-core`. A non-empty replacement
inventory wins, the old inventory remains, and raw secret files and pending
auth relay state are never copied.

## Failure, retry, and rollback behavior

Each durable step is written atomically before the next step. The stale preview
candidate list is itself persisted before deletion, so a crash at that boundary
resumes safely. Corrupt schema-1 state is preserved under a timestamped name
and replaced; future-version state is left untouched and does not block launch.
Missing directories are clean no-ops. Registration removal is exact-path based;
an already-absent old extension is successful idempotent state, not an error.

The rollback record retains compatible non-secret values and original owners.
The full procedure and irreversible limits are recorded in
`docs/migration/phase-11-rollback.md`. Only stale preview material is deleted;
old preferences, the old app, and the old identity directory remain during the
initial migration window.

## Automated proof

- Swift tests cover allowlisting, invalid/corrupt values, missing directories,
  secret-free diagnostics, live versus stale preview roots, both-app path
  filtering, and safe registration command ordering.
- Rust tests cover atomic versioned owner-only state, partial/interrupted state,
  future and corrupt state, normalized diagnostics, core-owned identity
  migration, new-inventory precedence, and repeated safe inventory migration.
- TypeScript tests cover full mapping, legacy-profile fallback, replacement
  precedence, rollback preservation of changed values, pre-runtime command
  ordering, clean browser startup, command failure, and command-contract parity.
- `cargo test` passed 119 tests.
- `swift test --package-path native/macos` passed 25 tests.
- Focused Vitest migration/contract/architecture suites passed 49 tests.
- `npm run build` and `npm run test:architecture` passed.
- The unified Phase 11 application build passed with the Native Host and every
  nested native target embedded and signed ad hoc.

## Installed upgrade proof

The Parallels macOS 26.5.2 arm64 VM was seeded with last-release preferences,
legacy default-opener state, a stale preview root, and a coexisting
`/Applications/ZManager.app`. The Phase 11 app was then installed at
`/Applications/Z-Manager.app` and launched without an interactive login step.

The owner-only state record reported every step complete, the seven expected
typed preference keys, and no diagnostics. The new default-handler restore file
contains the prior ZIP handler. The stale preview root is gone; the old app,
old defaults plist, and old Application Support state remain. `pluginkit`
resolves the Finder, preview, and thumbnail identifiers only to the installed
replacement paths. A second launch preserved the migration record SHA-256
`25e88efd421abfa47e894350cbb031916039f85804db6b9e41f24940bc6beeb5`
unchanged.

The reusable VM fixture and verifier are
`scripts/macos-replacement-migration-vm-smoke.sh`.
