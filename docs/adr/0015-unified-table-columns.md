# ADR-0015: Unified table column catalogue with visibility-only persistence

- Status: Accepted
- Date: 2026-07-27

## Context

Compress and Extract currently use separate column catalogues (`CreateSourceColumnId`
with 6 columns, `ArchiveTableColumnId` with 21 columns) with independent default
visibility, separate intrinsic widths, and no shared column identity. Extract
persists per-format column visibility, order, and widths keyed by physical archive
suffixes (`.tgz` and `.tar.gz` are separate keys with duplicated configuration).
Compress columns are in-memory only with no persistence. Extract writes column
order, width, and visibility on every header action.

The prior Column Support Matrix implementation (`docs/COLUMN_SUPPORT_MATRIX.md`,
`docs/IMPROVE_COLUMN_SUPPORT_MATRIX_IMPLEMNTATION_PLAN.md`) wired end-to-end
metadata for all supported formats and established `ARCHIVE_COLUMNS_BY_FORMAT`
keyed by physical suffix. The implementation plan for unified columns is in
`docs/UNIFIED_TABLE_COLUMNS_IMPLEMENTATION_PLAN.md`.

## Decision

### 1. One semantic column catalogue

A single `TableColumnId` union owns column identity. Derived subsets
`CompressTableColumnId` and `ExtractTableColumnId` express scenario
applicability. The catalogue owns canonical relative order and scope
classification (common, compress-only, extract-only). Compress and Extract
layout adapters provide scenario-specific intrinsic widths; the catalogue does
not own one shared intrinsic pixel width.

### 2. Visibility-only persistence

Global Column Options persists only a schema version and global visible column
IDs with optional per-format-family Extract overrides. Column order and widths
are workspace-local transient state and are not persisted. `tableColumnOrder`
and `tableColumnWidths` preference keys are retired after successful migration.

### 3. Rust-authored Compress capability contract

The running Rust application reports which Compress columns it can populate via
a `sourceTableCapabilities` field added to `ProjectContract`. The set describes
implementation capability, not per-row completeness. A required safe base
(`name`, `kind`, `size`, `modified`, `sourcePath`) is the fallback when the
contract is unresolved or invalid. TypeScript never adds availability based on
an operating-system name.

### 4. Safe-base fallback

When `ProjectContract.sourceTableCapabilities` is missing, has an unknown ID,
a duplicate ID, or omits any required safe-base ID, the entire set is replaced
with the safe base before resolving table visibility or menu choices. The
contract problem is reported as a bounded diagnostic.

### 5. Workspace-local layout ownership

Archive Workspace and Create Workspace own transient visible column IDs (after
capability resolution), local visibility changes, local order changes, and local
widths. Workspaces receive resolved defaults through their creation/reset inputs.
They do not read storage and do not detect the operating system. Reset Columns
discards workspace-local changes and restores configured visibility plus
scenario intrinsic order and widths without writing preferences.

### 6. Canonical format-family Extract keys

A typed `ArchiveFormatFamily` normalizer replaces direct use of physical
archive suffixes for table-column preferences. `.tgz` and `.tar.gz` share one
`tarGzip` family; `.tzst` and `.tar.zst` share one `tarZstd` family. The
normalizer is exhaustive for the generated archive suffix manifest and owns
aliases, localized display-label keys, Extract availability, and migration
precedence. A table-driven test compares the registry with the generated
manifest.

### 7. Preference save semantics

Saving changed Global Column Options immediately re-resolves both workspace
configured defaults. Only a workspace whose resolved defaults changed is reset;
the other workspace's local layout is preserved. An unrelated save, cancellation,
or save failure leaves local layouts unchanged. Saving is failure-safe:
write-then-read-back-then-retire-legacy pattern with toast notification on
failure.

### 8. Sort fallback

A configured Extract sort key that is unavailable or hidden falls back to Name
ascending for that active workspace only. The fallback is not persisted over the
configured sort preference. An explicit user header click always persists.

## Consequences

- One catalogue owns column identity, scope, and canonical order. New columns
  must be added to the catalogue; a guardrail test enforces this.
- One preference seam persists visibility only, under a new versioned key
  `zmanager.tableColumnVisibility.v2`.
- One Rust contract owns Compress availability. The selected output format
  never changes Compress source columns.
- One canonical family normalizer owns Extract preference keys. Physical
  suffix resolution for table columns is deleted.
- Workspace-local column order and widths do not survive application restart.
- Header-triggered preference writes are removed. Reset Columns restores
  configured visibility without writing preferences.
- The old Compress catalogue and legacy order/width persistence are deleted
  after the shared visibility path is proven through the Migration Activation
  Gate.
