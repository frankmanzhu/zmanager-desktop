# Unified Compress And Extract Table Columns Implementation Plan

- Status: In Progress (WP0–WP5, Gate infrastructure, WP6 TS side, WP7 guardrails complete)
- Date: 2026-07-27
- Scope: one semantic column catalogue, global visible-column defaults,
  canonical Extract format-family filtering, Rust-reported Compress source
  capabilities, workspace-local column layout, and source metadata enrichment
- Primary outcome: Compress and Extract share column identities and global
  visibility choices while each active table exposes only columns supported by
  its scenario and capabilities
- Related documents:
  - `CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/FRONTEND_ARCHITECTURE_DEEPENING_PLAN.md`
  - `docs/COLUMN_SUPPORT_MATRIX.md`
  - `docs/IMPROVE_COLUMN_SUPPORT_MATRIX_IMPLEMNTATION_PLAN.md`

## Decisions

This plan is governed by the following decisions:

1. Global Column Options persists only versioned visibility configuration:
   global visible column IDs and optional Extract family visible-column IDs.
2. Column order and widths are transient workspace layout state. They are not
   global preferences and are not persisted.
3. The catalogue owns one canonical relative order. Compress and Extract may
   have different intrinsic widths for the same semantic column.
4. Rust reports which Compress columns the running system can support.
5. Compress distinguishes three column sets:
   - available columns are the intersection of columns applicable to Compress
     and the validated Rust capability set, or the safe-base fallback when the
     contract is unresolved or invalid;
   - configured default visibility is canonical order filtered by available
     columns and Global Column Options; and
   - current workspace visibility starts from the configured default and may be
     changed locally, but never exceeds the available set.
6. Extract makes the same distinction between format-family availability,
   configured default visibility, and current workspace visibility.
7. The configured default Compress columns are the intersection of:
   - columns applicable to Compress;
   - the validated Rust capability set or safe-base fallback; and
   - columns selected in Global Column Options.
8. The Compress header context menu offers at most the Compress columns in the
   validated Rust capability set or safe-base fallback.
9. Missing data in one row does not make an available column unavailable. The
   cell is empty.
10. The selected output archive format never changes Compress source-column
   availability.
11. Extract availability is resolved from one canonical archive format-family
   key. Physical aliases such as `.tgz` and `.tar.gz` share one family.
12. Reset Columns discards workspace-local visibility, order, and width changes,
    reapplies the configured visible defaults, and restores scenario intrinsic
    order and widths.
13. Successfully saving changed Global Column Options immediately re-resolves
    both workspaces. Reset only a workspace whose resolved configured defaults
    changed; preserve the local layout of an unaffected workspace. A reset
    intentionally discards that affected workspace's transient visibility,
    order, and width changes.
14. A configured Extract sort key that is unavailable or not currently visible
    falls back to Name ascending for that active workspace only. The fallback is
    not persisted over the configured sort preference.

## Goals

1. Replace the separate Compress and Extract column catalogues with one semantic
   catalogue.
2. Present Global Column Options in Common, Compress only, and Extract only
   sections.
3. Persist only versioned global and Extract-family visible-column IDs; do not
   persist order or widths.
4. Use a Rust-authored capability set to filter the active Compress table and
   its header context menu.
5. Use canonical format-family keys for Extract availability and per-format
   visible-column defaults.
6. Preserve Unix archive metadata when an archive is opened on Windows.
7. Add real optional source metadata to the create-plan contract without
   guessing or reading the filesystem from TypeScript.
8. Keep row DTOs and value semantics separate for Compress and Extract.
9. Delete the old Compress catalogue and the legacy persisted order/width path
   after the shared visibility path is proven.

## Non-Goals

- Persisting column order or widths.
- Adding persistent per-workspace layout overrides.
- Making Compress and Extract use identical intrinsic pixel widths.
- Replacing the existing table selection or hierarchical-row modules.
- Consolidating all React table-header behavior in this work.
- Calculating packed size, compression ratio, or CRC before compression.
- Reimplementing archive planning, metadata preservation, or filesystem
  semantics in TypeScript.
- Forcing `CreatePlanEntryDto` and `ArchiveEntryDto` into one DTO.
- Filtering Extract Unix metadata according to the host operating system.
- Detecting source hard-link identity or changing hard-link preservation
  semantics. Compress displays only the entry kinds represented by the current
  core planner.
- Introducing new Windows junction or reparse-point kinds. Existing backend
  classification is rendered truthfully without frontend inference.
- Treating output-format preservation support as a reason to hide source
  metadata from Compress.

## Current Behavior And Required Cleanup

### Extract

`src/app/archiveTable.ts` currently owns:

- `ArchiveTableColumnId`;
- `ARCHIVE_TABLE_COLUMNS`;
- default visibility and order;
- physical-suffix availability lists;
- value formatting; and
- sorting.

`src/app/preferences.ts` currently loads and saves:

- `tableVisibleColumnIds`;
- `tableColumnOrderIds`;
- `tableColumnWidths`; and
- `tableColumnsByFormat`.

Runtime Extract header resizing, reordering, and visibility changes can write
these settings through `updateCurrentTableColumnSettings()`. This persistence is
not part of the target behavior and must be removed.

The target preference state retains global visibility and optional Extract
format-family visibility. Order and widths remain in Archive Workspace state
only.

### Compress

`src/app/createTableColumns.ts` currently owns six in-memory columns:

1. Name
2. Size
3. Modified
4. Type
5. Source Path
6. Mode

Name, Size, Modified, and Type are visible by default. Source Path and Mode are
optional. Create Workspace owns transient visibility, order, and widths.

The target keeps that transient layout behavior but replaces the separate
catalogue and reset defaults with resolved shared visibility plus
Compress-specific intrinsic layout.

### Existing format-key mismatch

Current availability and preference resolution use physical suffixes, while
Preferences exposes logical groups. A single typed normalizer must replace
direct use of raw suffix strings for table-column preferences.

The family registry is exhaustive for the archive suffix manifest. It owns
aliases, a localized display-label key, Extract availability, migration
precedence, and whether a family can have a per-format visibility override.
Preferences and menus render the label through the display context; they do not
hard-code English family names.

Required mappings:

| Physical suffix | Canonical format family |
|---|---|
| `.zip`, `.zipx`, `.jar`, `.war`, `.ipa`, `.apk`, `.appx`, `.xpi` | `zip` |
| `.7z`, supported split 7z entry suffixes | `sevenZ` |
| `.tzap`, supported TZAP volume names | `tzap` |
| `.tar.zst`, `.tzst` | `tarZstd` |
| `.tar.gz`, `.tgz` | `tarGzip` |
| `.tar.bz2`, `.tbz2`, `.tbz` | `tarBzip2` |
| `.tar.xz`, `.txz` | `tarXz` |
| `.tar.br` | `tarBrotli` |
| `.tar.lz` | `tarLzip` |
| `.tar.lz4` | `tarLz4` |
| `.tar.lzma` | `tarLzma` |
| `.tar.lzo` | `tarLzo` |
| `.tar.lrz` | `tarLrzip` |
| `.tar.z` | `tarCompressZ` |
| `.tar` | `tar` |
| `.aar`, `.aea` | `appleArchive` |
| `.gz` | `gzipStream` |
| `.bz2` | `bzip2Stream` |
| `.xz` | `xzStream` |
| `.zst` | `zstdStream` |
| `.br` | `brotliStream` |
| `.lz` | `lzipStream` |
| `.lz4` | `lz4Stream` |
| `.lzma` | `lzmaStream` |
| `.lzo` | `lzoStream` |
| `.lrz` | `lrzipStream` |
| `.z` | `compressZStream` |
| `.rar`, `.cbr` | `rar` |
| `.cab` | `cab` |
| `.cpio` | `cpio` |
| `.deb` | `deb` |
| `.iso` | `iso` |
| `.rpm` | `rpm` |
| `.xar` | `xar` |

The normalizer is the only module allowed to translate a physical archive path
or suffix into a table preference key. Matching is case-insensitive and checks
the longest supported physical suffix first, so `.tar.gz` is never classified
as `gzipStream` and `.tar.zst` is never classified as `zstdStream`.

TZAP volume names (e.g. `archive.0001.tzap`, `archive.0002.tzap`) are detected
by pattern matching against the TZAP multi-volume naming convention. The
normalizer delegates to the existing `getKnownArchiveSuffix` function for suffix
extraction and adds family classification; it does not reimplement suffix
detection.

A table-driven test compares the registry with
`src/app/generated/archiveFileTypes.generated.json`. Every supported single,
compound, and split suffix must resolve to exactly one family. Adding a suffix
to the generated manifest without adding a family mapping fails the frontend
test.

An unrecognized path resolves to a non-persistable `unknown` outcome with the
conservative Extract availability set `name` and `kind`. Global Column Options
has no active family and still presents the complete catalogue. `unknown` is
never shown in the format selector and never becomes a preference key.

Model this distinction explicitly:

```typescript
type ArchiveFormatFamily =
  | "zip"
  | "sevenZ"
  | "tzap"
  | "tarZstd"
  | "tarGzip"
  | "tarBzip2"
  | "tarXz"
  | "tarBrotli"
  | "tarLzip"
  | "tarLz4"
  | "tarLzma"
  | "tarLzo"
  | "tarLrzip"
  | "tarCompressZ"
  | "tar"
  | "appleArchive"
  | "gzipStream"
  | "bzip2Stream"
  | "xzStream"
  | "zstdStream"
  | "brotliStream"
  | "lzipStream"
  | "lz4Stream"
  | "lzmaStream"
  | "lzoStream"
  | "lrzipStream"
  | "compressZStream"
  | "rar"
  | "cab"
  | "cpio"
  | "deb"
  | "iso"
  | "rpm"
  | "xar";

type ArchiveFormatFamilyResolution =
  | Readonly<{ kind: "known"; family: ArchiveFormatFamily }>
  | Readonly<{ kind: "unknown" }>;
```

`ArchiveFormatFamily` contains recognized, persistable families only. The
normalizer is the only module that translates a physical archive path or suffix
into an `ArchiveFormatFamily`. It wraps the existing `getKnownArchiveSuffix` from
`src/app/archiveFileTypes.ts` and adds the canonical-family mapping layer; direct
use of raw suffix strings for column-preference keys is removed.

## Canonical Column Catalogue

### Common columns

| Order | ID | Label | Compress source meaning | Extract archive meaning |
|---:|---|---|---|---|
| 1 | `name` | Name | Planned archive entry name | Stored archive entry name |
| 2 | `kind` | Type | Planner-reported source entry kind | Stored archive entry kind |
| 3 | `size` | Size | Source content size | Uncompressed stored size |
| 4 | `modified` | Modified | Source modification time | Stored modification time |
| 5 | `created` | Created | Source birth/creation time | Stored creation time |
| 6 | `accessed` | Accessed | Source access time | Stored access time |
| 7 | `attributes` | Attributes | Source filesystem flags | Stored platform attributes |
| 8 | `mode` | Mode | Source POSIX mode | Stored POSIX mode |
| 9 | `linkTarget` | Link Target | Source symbolic-link target | Stored link target |
| 10 | `uid` | UID | Source Unix user ID | Stored Unix user ID |
| 11 | `gid` | GID | Source Unix group ID | Stored Unix group ID |
| 12 | `owner` | Owner | Source owner name | Stored owner name |
| 13 | `group` | Group | Source Unix group name | Stored group name |

Extract renders every `ArchiveEntryKind` supplied by the archive backend,
including hard links where supported. Compress renders the kinds supplied by
the create planner. This work does not add source hard-link detection.

### Compress-only columns

| Order | ID | Label | Meaning |
|---:|---|---|---|
| 14 | `sourcePath` | Source Path | Local path from which the planned entry is read |

Source paths remain transient Create Workspace data. The path value is never
stored in preferences or diagnostics. Only the `sourcePath` column ID may be
stored as a global visibility choice.

### Extract-only columns

| Order | ID | Label | Meaning |
|---:|---|---|---|
| 15 | `compressedSize` | Packed Size | Stored compressed size |
| 16 | `encrypted` | Encrypted | Per-entry stored archive property |
| 17 | `method` | Method | Stored compression method |
| 18 | `crc` | CRC | Stored checksum |
| 19 | `comment` | Comment | Stored entry comment |
| 20 | `ratio` | Ratio | Derived from uncompressed and packed sizes |
| 21 | `solid` | Solid | Stored solid-compression property |
| 22 | `metadataDiagnostics` | Diagnostics | Stored-entry metadata diagnostics |

Creation options such as encryption, method, and solid mode are not projected
as per-row Compress values.

### Derived column-ID types

```typescript
type TableColumnId =
  | "name" | "kind" | "size" | "modified"
  | "created" | "accessed" | "attributes" | "mode"
  | "linkTarget" | "uid" | "gid" | "owner" | "group"
  | "sourcePath"
  | "compressedSize" | "encrypted" | "method" | "crc"
  | "comment" | "ratio" | "solid" | "metadataDiagnostics";

// Columns applicable to Compress: common ∪ compress-only
type CompressTableColumnId =
  | "name" | "kind" | "size" | "modified"
  | "created" | "accessed" | "attributes" | "mode"
  | "linkTarget" | "uid" | "gid" | "owner" | "group"
  | "sourcePath";

// Columns applicable to Extract: common ∪ extract-only
type ExtractTableColumnId =
  | "name" | "kind" | "size" | "modified"
  | "created" | "accessed" | "attributes" | "mode"
  | "linkTarget" | "uid" | "gid" | "owner" | "group"
  | "compressedSize" | "encrypted" | "method" | "crc"
  | "comment" | "ratio" | "solid" | "metadataDiagnostics";
```

`CompressTableColumnId` and `ExtractTableColumnId` are derived subsets of
`TableColumnId`. The catalogue owns the canonical order; filtering by scope type
or by these narrower ID types produces the same result.

`alwaysVisible?: boolean` on `TableColumnDefinition` means the column cannot be
hidden through the header context menu or preferences. Name is the only column
with `alwaysVisible: true`. The normalization layer enforces this regardless of
stored preference state.

## Column Definitions And Scenario Layout

The shared catalogue owns semantic display metadata:

```typescript
export type TableScenario = "compress" | "extract";

export type TableColumnScope = "common" | "compress" | "extract";

export type TableColumnDefinition = Readonly<{
  id: TableColumnId;
  scope: TableColumnScope;
  labelKey: MessageKey;
  align: "left" | "right" | "center";
  alwaysVisible?: boolean;
}>;
```

It does not own one shared intrinsic width. Compress and Extract layout adapters
provide scenario-specific width and minimum-width values:

```typescript
type ScenarioColumnLayout = Readonly<{
  width: number;
  minWidth?: number;
}>;
```

The catalogue owns canonical relative order. Filtering removes inapplicable IDs
without changing the order of the remaining IDs. Workspace-local reordering may
change the active table until Reset Columns or application restart.

Note: the canonical order places `kind` (Type) immediately after `name` at
position 2. In the current Extract table `kind` appears after `comment` at
position ~13. This is an intentional semantic reordering — Type is a fundamental
entry property that belongs near Name — and takes effect for both Compress and
Extract after migration, replacing any stored legacy order.

Name is always visible and is the first configurable data column. The fixed
Compress inclusion checkbox remains before Name and is not part of the
catalogue.

## Compress Source Capability Contract

### Source of truth

The running Rust application reports which Compress columns it can populate or
meaningfully attempt to populate on the current system.

Add a source-table capability record to the Rust-authored startup
`ProjectContract`:

```typescript
type SourceTableCapabilitiesDto = Readonly<{
  availableColumnIds: readonly CompressTableColumnId[];
}>;
```

The TypeScript type mirrors the Rust DTO. Generated bindings are preferred;
otherwise add an explicit Rust/TypeScript contract fixture.

The set describes implementation capability, not row completeness:

- The required safe base is:
  `name`, `kind`, `size`, `modified`, and `sourcePath`.
- Every valid capability record contains every required safe-base ID.
- A column is available when the running Rust/core implementation can
  meaningfully attempt to populate it.
- An available column may contain empty cells when a particular filesystem,
  mount, entry kind, permission context, or metadata record lacks the value.
- A column must not be advertised until its value is wired end-to-end.
- TypeScript never adds availability based on an operating-system name.
- The selected output archive format never participates in this contract.

Treat a missing capability record, an unknown ID, a duplicate ID, or omission
of any required safe-base ID as an invalid contract. Replace the complete
invalid set with the required safe base before resolving table visibility or
menu choices. Report the contract problem as a bounded diagnostic rather than
guessing optional support.

### Effective Compress columns

Let:

- `C` be all catalogue IDs applicable to Compress;
- `A` be the validated
  `ProjectContract.sourceTableCapabilities.availableColumnIds`, or the complete
  required safe base while the record is unresolved or invalid;
- `G` be the globally configured visible IDs; and
- `O` be canonical catalogue order.

The available Compress IDs are:

```text
O filtered by (C ∩ A)
```

The configured default Compress visibility is:

```text
O filtered by (C ∩ A ∩ G)
```

The current workspace visibility is initialized from that configured default.
Local header-menu changes may show or hide any ID in `C ∩ A`, except that Name
cannot be hidden. Consequently, local visibility may include a column that is
not selected in Global Column Options, but it remains transient and Reset
Columns removes the override.

The available choices in the Compress header context menu are `O` filtered by
`C ∩ A`.

Example:

- Global Options selects six Compress-applicable columns.
- The validated capability set contains five of those six on the running
  system.
- The table shows those five by default.
- The header menu offers no column outside the validated capability set.

Global Options still displays the full catalogue grouped by scope. A selection
that is unavailable on the current system may remain stored so it can become
effective on another supported system.

### Expected platform outcomes

The Rust capability implementation should normally produce these outcomes, but
the returned capability set is authoritative:

| Column | Windows | macOS | Linux |
|---|---|---|---|
| Name, Type, Size, Modified, Source Path | Available | Available | Available |
| Created | Available | Available | Available when the implementation can attempt it |
| Accessed | Optional | Available | Optional |
| Attributes | Available when implemented | Available when implemented | Available when implemented |
| Mode | Unavailable | Available | Available |
| Link Target | Available when implemented | Available | Available |
| UID, GID | Unavailable | Available | Available |
| Owner | Available when implemented | Available | Available |
| Group | Unavailable in the Unix sense | Available | Available |

Windows values must not synthesize POSIX mode, UID, GID, or Unix Group from
security identifiers. Owner may use the security descriptor with bounded
SID-to-name caching.

## Extract Format-Family Availability

Extract filtering remains independent of the host operating system. A TAR or
TZAP archive opened on Windows may contain Mode, UID, GID, Owner, and Group.

Replace physical-suffix preference keys with `ArchiveFormatFamily` and replace
the current suffix-keyed Extract support matrix with the audited canonical
family registry. The registry returns Extract-applicable column IDs.

The available Extract IDs are canonical order filtered by Extract scope and the
active format family's audited available IDs.

The configured default Extract visibility is:

```text
canonical order
  filtered by Extract scope
  filtered by the active format family's available IDs
  filtered by the configured format-family visible IDs when present,
    otherwise the global visible IDs
```

The Extract header menu offers all Extract-applicable IDs supported by the
active format family. Current workspace visibility is initialized from the
configured default and may then be changed locally within that available set,
with Name always visible.

Before re-keying the current matrix, audit every family against
`docs/COLUMN_SUPPORT_MATRIX.md` and the values actually mapped into
`ArchiveEntryDto`. The audited registry is authoritative. A column is available
only when the active backend can populate it or can compute it from populated
values. Do not carry forward a current mapping merely because it already
appears in `ARCHIVE_COLUMNS_BY_FORMAT`.

Note: Apple Archive (AAR/AEA) stores numeric UID and GID but does not store
string owner or group names. The audited registry must reflect that `uid` and
`gid` are available for `appleArchive` but `owner` and `group` are not.
Similarly, `.aea` (encrypted Apple Archive) and `.aar` share the same
availability set — encryption does not change which metadata fields are present.

Format-family migration must:

- map dotted and undotted legacy keys;
- map aliases to one canonical family;
- remove unknown IDs;
- remove Compress-only IDs;
- resolve collisions deterministically;
- be idempotent.

Migration uses a total precedence order. For each family, the first present
legacy key wins:

1. the canonical family ID;
2. the preferred undotted legacy selector key;
3. the dotted form of that preferred key;
4. each remaining physical alias in registry order, undotted before dotted; and
5. matching split or volume patterns in lexical order.

For example, `tarGzip`, `tar.gz`, `.tar.gz`, `tgz`, then `.tgz` is the complete
precedence for `tarGzip`. Lower-precedence values are ignored rather than
merged. Tests cover conflicting values at every precedence level.

## Visibility Preferences

### Persisted model

The persisted column preference model contains a schema version and visibility
only:

```typescript
type GlobalTableColumnPreferences = Readonly<{
  version: 2;
  visibleColumnIds: readonly TableColumnId[];
  visibleColumnIdsByFormatFamily: Readonly<
    Partial<Record<ArchiveFormatFamily, readonly ExtractTableColumnId[]>>
  >;
}>;
```

Use typed keys in `src/app/preferenceStorage.ts`. Do not add direct
`localStorage` access.

Order and width fields are deliberately absent.

Persist the complete object as JSON under the new typed key
`zmanager.tableColumnVisibility.v2`. Do not reuse a legacy key for the versioned
object. Loading follows these rules:

1. A valid version-2 object is normalized and used without consulting legacy
   column keys.
2. If version 2 is absent or invalid and any legacy global or per-format
   visibility key exists, migrate legacy visibility.
3. If neither version 2 nor a legacy visibility key exists, treat the profile as
   a clean installation.

Saving is failure-safe: a typed column-preference writer returns success or a
normalized failure. Write the normalized version-2 object first and read it back
through the version-2 parser. Retire the legacy order, width, global visibility,
and per-format keys only after the read-back equals the normalized value. If
storage throws or verification fails, keep the legacy keys, leave both
workspace layouts unchanged, and report a bounded preference-save failure as a
toast notification with a localized message. The diagnostic log records the
failure kind (storage, verification, or parse) without including column IDs or
preference values. The user may retry by saving again; no automatic retry is
attempted.

### Migration

The loader must distinguish a clean installation from stored legacy settings:

- With neither version-2 nor legacy global/per-format visible-column settings,
  use clean-install visibility.
- Preserve every recognized legacy visible ID.
- Remove unknown and duplicate IDs.
- Reinsert Name as visible.
- Keep newly introduced IDs hidden for migrated users.
- Migrate per-format visibility to canonical format-family keys.
- Ignore legacy persisted order and widths.
- Remove or retire `tableColumnOrder` and `tableColumnWidths` writes after the
  new model is saved successfully.
- Produce the same normalized value when migration runs repeatedly.

When only legacy per-format visibility exists, initialize global visibility from
an explicit `LEGACY_DEFAULT_VISIBLE_COLUMN_IDS` constant before migrating the
overrides. Do not use the new clean-install defaults for this case, because that
would make newly introduced IDs visible for a migrated user.

Do not persist a capability-filtered active result back into Global Options.
Unavailable IDs must survive globally for use on another system.

### Clean-install visible defaults

Global visible IDs:

1. Name
2. Type
3. Size
4. Modified
5. Packed Size

After scenario and capability filtering:

- Compress normally shows Name, Type, Size, and Modified.
- Extract normally shows Name, Type, Size, Modified, and Packed Size when the
  active format supports them.

Source Path remains hidden by default.

Note: the clean-install defaults add Type (kind) to the visible set. The current
Extract defaults show Name, Size, Packed Size, and Modified — Type is hidden by
default. This is a deliberate change because Type is a fundamental entry property
and filtering becomes the primary mechanism to remove unwanted columns. Migrated
users retain their legacy visibility selections and Type is not automatically
added for them.

## Workspace-Local Column State

Archive Workspace and Create Workspace own transient:

- visible column IDs after capability resolution;
- local visibility changes;
- local order changes; and
- local widths.

Workspaces receive resolved defaults through their creation/reset inputs. They
do not read storage and do not detect the operating system.

Snapshots expose readonly, cloned column arrays and width records. React renders
the snapshot and emits typed intents. It does not decide platform or format
support.

### Capability bootstrap and refresh

Create Workspace starts with the validated safe-base capability fallback while
the desktop bootstrap contract is unresolved. Its column state tracks whether a
local column mutation has occurred since initialization.

When `ProjectContract` arrives:

- validate the complete capability record before using it;
- if no local column mutation has occurred, reset the workspace to the newly
  resolved configured defaults;
- if a local mutation has occurred, clamp visible IDs, order IDs, and width keys
  to the newly available set, preserve the remaining local layout, and keep
  newly available optional columns hidden until Reset Columns; and
- emit a bounded diagnostic when the contract is invalid and continue with the
  safe base.

Browser preview and a failed desktop bootstrap use the safe base. A later valid
contract may follow the same refresh rules. Capability refresh never changes
the selected Compress output format.

### Preference save

After a successful changed Global Column Options save, the composition root
resolves the before/after defaults for both workspaces:

- Compress uses the current validated Rust capability set or safe-base fallback;
- Extract uses the active archive's canonical format family; and
- call `resetColumns()` only for a workspace whose resolved configured
  visibility, canonical order, or intrinsic widths changed.

An affected workspace discards local visibility, order, and widths so the saved
configuration is effective immediately. An unaffected workspace, an unrelated
Preferences save, cancellation, or a save failure leaves its local layout
unchanged.

### Reset Columns

Reset Columns performs these steps:

1. Discard active workspace visibility changes.
2. Discard active workspace reordering.
3. Discard active workspace width changes.
4. Resolve configured visible defaults:
   - Compress uses global visibility;
   - Extract uses the canonical format-family visibility override when present,
     otherwise global visibility.
5. Intersect visibility with scenario applicability and current capabilities.
6. Restore canonical order and scenario intrinsic widths.

Reset never writes preferences.

Global Options is the only surface that persists global visibility.
Format-family visibility is changed only from the explicit Extract format
selector in Global Options. Resetting a format there deletes its override and
returns it to global visibility.

### Sort resolution

Sort preference remains separately persisted, but an active sort must have a
visible header. When an archive opens, columns reset, or visibility changes,
resolve the configured sort key against the current visible Extract IDs. If it
is unavailable or hidden, use Name ascending in that Archive Workspace without
overwriting the persisted sort key. When the configured key becomes visible
again, restore it and its configured direction.

A user explicitly clicking a column header always persists the newly selected key
and direction (as today), even when the configured key is currently unavailable
or hidden. The automatic fallback to Name ascending only applies when the
configured key becomes unavailable through external events (archive open, format
change, visibility change, or Reset Columns) and the user has not initiated a
sort since those events. This means:

1. Open archive → configured key hidden → fallback to Name ascending (not persisted).
2. User clicks Size header → Size is persisted as the new sort preference.
3. Later, visibility changes hide Size → fallback to Name ascending again (not persisted).
4. User never clicked anything → when the original configured key becomes visible
   again, it is restored.

## Separate Row Value Adapters

Keep separate typed adapters:

```text
CreatePlanEntryDto
  -> Compress value adapter
  -> shared display formatting where semantics match

ArchiveEntryDto
  -> Extract value adapter
  -> shared display formatting where semantics match
```

Shared formatting may cover bytes, timestamps, modes, entry kinds, numeric IDs,
and empty values. Extract-only calculations such as ratio remain in the Extract
adapter.

Compress kind formatting must use `CreatePlanEntryDto.kind` rather than reducing
all non-folders to File. It does not infer hard links or new reparse kinds.

## Create-Plan Metadata Enrichment

Extend `CreatePlanEntryDto` incrementally with optional fields that Rust reports
as available:

```typescript
type SourceAttributeDto = Readonly<{
  namespace: "windows" | "bsd" | "portable";
  code: string;
}>;

created?: string;
accessed?: string;
attributes?: readonly SourceAttributeDto[];
linkTarget?: string;
uid?: number;
gid?: number;
owner?: string;
group?: string;
```

Mode already exists. Every advertised capability must have an end-to-end field
mapping.

Attribute codes are language-neutral allowlisted identifiers, not localized or
preformatted text. The Compress value adapter orders and translates known
codes. Define the namespace/code allowlist in the Rust/TypeScript contract and
test that Rust emits only declared values. Rust omits unknown codes and never
sends arbitrary diagnostic text in the attribute field. Extract retains its
separate existing DTO/value semantics.

`created` and `accessed` use the same serialized timestamp representation and
display formatter as the existing `modified` create-plan field.

Collection belongs in Rust and, where planning owns traversal, in
`zmanager-core`. TypeScript formats returned values but does not call filesystem
interfaces or reconstruct metadata.

Metadata collection must:

- reuse the existing planning traversal;
- avoid a second recursive walk;
- avoid following links merely to display their target;
- respect the existing `followSymlinks` planning policy;
- avoid logging source paths or owner identities;
- cache repeated UID/GID and SID-to-name resolution;
- tolerate row-level permission or filesystem gaps with absent optional values;
- avoid unbounded network-backed identity lookup; and
- preserve archive safety and planning behavior.

If a field is too expensive or not implemented reliably, omit its column ID
from the Rust capability set.

### Metadata performance budget

Use a reproducible core benchmark fixture with 100,000 planned entries,
approximately 90% regular files and 10% directories or symbolic links, and 32
repeated owner/group identities. On each target platform:

1. run one warm-up and three measured planning runs with the same release build;
2. compare the existing safe-base metadata path with each newly advertised
   metadata slice enabled and with the final cumulative advertised set enabled;
3. require the median elapsed-time regression to be no more than 20%; and
4. require additional peak resident memory to be no more than 128 MiB.

Identity caches are bounded to 4,096 positive or negative entries per plan.
At most 4 identity lookups may be in flight, and at most 4,096 distinct
identities may be submitted for resolution during one plan. After that limit,
unresolved Owner or Group values remain absent; entries are not evicted and
looked up again during the same plan.
No identity-resolution mechanism may have an unbounded network wait. If the
platform API cannot enforce a 250 ms per-lookup deadline or provide a
non-network local lookup, omit Owner and/or Group from that platform's
capability set. Record benchmark hardware, filesystem type, cold/warm cache
state, elapsed time, and peak memory without recording source paths or
identities.

## Work Packages

WP2 through WP5 are a coordinated migration sequence. Their new storage and UI
paths may be developed and tested incrementally, but the production preference
loader/writer and grouped Global Column Options must not switch to version 2
until both tables consume the shared resolver at the Migration Activation Gate
after WP5. Do not ship or release the intermediate asymmetric state.

### WP0 — Characterization

1. Characterize current Extract visibility, order, width, and per-format
   persistence.
2. Characterize current Compress transient visibility, order, width, and reset.
3. Add fixtures for current `ProjectContract`, `CreatePlanEntryDto`, and
   preference storage.
4. Add tests demonstrating the current dotted/undotted and alias format-key
   behavior.
5. Add and obtain owner acceptance of an ADR for the unified column catalogue,
   visibility-only
   persistence, Rust-authored Compress capability contract, safe-base fallback,
   and workspace-local layout ownership before changing those seams.

Exit criteria:

- Existing behavior is covered before ownership moves.
- Tests distinguish the intentional removal of order/width persistence from
  regressions.
- The accepted ADR records the durable ownership, persistence, fallback, and
  preference-save decisions before WP1 begins.

### WP1 — Catalogue, format families, and pure visibility resolver

1. Add the shared semantic catalogue and scope types.
2. Add canonical `ArchiveFormatFamily` normalization.
3. Build one exhaustive family registry and assert complete coverage of the
   generated archive suffix manifest.
4. Audit and reconcile every Extract family availability set against
   `docs/COLUMN_SUPPORT_MATRIX.md` and actual `ArchiveEntryDto` mapping.
5. Add scenario-specific intrinsic layout definitions.
6. Deepen `src/app/tableColumns.ts` to own availability, configured-default
   visibility, workspace-current visibility normalization,
   capability intersection, canonical ordering, and Name invariants.
7. Add tests for unique IDs, valid scopes, labels, family aliases,
   longest-suffix matching, case-insensitive matching, and stable relative
   order.

Exit criteria:

- No rendered behavior changes.
- `.tgz`/`.tar.gz`, `.tzst`/`.tar.zst`, ZIP aliases, split formats, and TZAP
  volumes resolve to canonical families.
- `.tar.gz` is distinct from `gzipStream`, and `.tar.zst` is distinct from
  `zstdStream`.
- Every supported suffix resolves exactly once, and an unrecognized suffix
  resolves to non-persistable `unknown`.
- Every advertised Extract column is backed by an actual value or valid derived
  calculation for that family.

### WP2 — Visibility-only preferences and migration

1. Add the version-2 visibility object and new typed storage key.
2. Migrate global and per-format visible IDs.
3. Build and test Common, Compress only, and Extract only sections in the React
   Preferences dialog for activation after WP5.
4. Keep the Extract format selector, backed by canonical family IDs and
   display-context label keys rather than hard-coded English labels.
5. Preserve unavailable global selections without presenting them as active on
   the current system.
6. Apply the documented total alias precedence and failure-safe legacy-key
   retirement.
7. Prepare the typed save result and before/after default comparison used by the
   Migration Activation Gate.

Exit criteria:

- The version-2 normalizer produces the new clean-install visible defaults.
- Migration tests preserve legacy visible selections.
- The version-2 writer never writes legacy order or width fields.
- Migration is idempotent.
- A failed version-2 write leaves legacy data recoverable.
- The version-2 loader, writer, migration, and grouped UI pass isolated tests
  without switching the production preference path early.

### WP3 — Rust Compress capability contract

1. Add `sourceTableCapabilities` to Rust and TypeScript `ProjectContract`.
2. Populate `availableColumnIds` from the running implementation.
3. Pass capabilities through startup composition to Create Workspace defaults
   and resets.
4. Add contract coverage and platform expectation tests.
5. Define the safe base-column fallback for a missing or invalid contract.
6. Implement late-contract reconciliation using the workspace local-mutation
   rule without overwriting valid local layout changes.

Exit criteria:

- The active Compress table and header menu never exceed the validated
  capability set or safe-base fallback.
- No TypeScript operating-system-name branch controls column availability.
- Changing output format does not change Compress columns.
- Before the contract resolves, browser preview and desktop startup expose only
  the safe base.
- Late contract arrival either resets an untouched layout or clamps a locally
  changed layout without adding newly available optional columns.

### WP4 — Extract migration

1. Resolve Extract visibility from the shared catalogue.
2. Resolve availability through canonical format families.
3. Convert per-format settings to visibility-only family overrides.
4. Keep sorting and row values in the Extract adapter.
5. Remove all header-triggered column-preference writes, including visibility,
   order, and widths.
6. Make Reset Columns restore configured visibility plus intrinsic layout.
7. Normalize an unavailable or hidden configured sort key to workspace-local
   Name ascending without persisting that fallback.

Exit criteria:

- Format aliases share availability and preferences.
- Stored Unix metadata remains visible on Windows when the format supports it.
- Header order and width changes remain transient.
- Hidden or unavailable configured sort columns cannot leave an unexplained
  active sort.

### WP5 — Compress tracer-bullet migration

Migrate fields already present in `CreatePlanEntryDto` first:

1. Name
2. Type
3. Size
4. Modified
5. Mode
6. Source Path

Resolve default visibility as `global ∩ Rust available ∩ Compress scope`.
Resolve menu choices as `Rust available ∩ Compress scope`.

After proof:

- delete `CREATE_SOURCE_TABLE_COLUMNS`;
- delete independent Compress visible defaults; and
- reduce `src/app/createTableColumns.ts` to the Compress value/layout adapter or
  delete it if no deep responsibility remains.

Exit criteria:

- Compress uses the shared catalogue.
- Mode appears only when Rust reports it available.
- Source Path remains Compress-only.
- Local changes do not write preferences.

### Migration Activation Gate

After WP2 through WP5 pass their package tests, activate the migration in one
production change:

1. switch the production preference loader and writer to the version-2 object;
2. activate the grouped Global Column Options and canonical family selector;
3. inject resolved configured defaults into both migrated workspaces;
4. remove header-triggered visibility, order, and width persistence;
5. on successful changed-column save, re-resolve both workspace defaults and
   reset only a workspace whose resolved defaults changed;
6. preserve unaffected layouts on unrelated save, cancellation, or save
   failure; and
7. remove any temporary activation wiring introduced solely to stage WP2
   through WP5.

Gate exit criteria:

- No runtime path mixes version-2 visibility with a legacy table catalogue or
  legacy order/width persistence.
- Saved Global Column Options take effect immediately in every affected
  workspace without resetting unaffected layouts.
- The production build and all WP2 through WP5 frontend, React, contract, and
  end-to-end tests pass before WP6 begins.

### WP6 — Incremental source metadata

Add only fields that can be implemented and advertised truthfully:

1. Created and Accessed
2. Attributes
3. Symbolic Link Target
4. UID and GID on Unix
5. Owner and Group on Unix
6. Owner on Windows

Each slice updates:

- source metadata collection in core/Rust;
- the Rust capability set;
- Rust DTO mapping;
- TypeScript DTO types;
- contract tests;
- Compress value formatting; and
- platform capability tests.

This package spans two repositories. Fields captured during traversal are added
to the sibling `../zmanager/crates/zmanager-core`; fields already present there,
such as `ManifestEntry.symlink_target`, require DTO mapping rather than a
duplicate metadata read. Land and test the compatible core contract before
advertising it from the desktop.

Run `cd src-tauri && cargo fmt` after every desktop Rust change. After core Rust
changes, run `cd ../zmanager && cargo fmt` and the direct core test commands in
the Build Verification Matrix.

Exit criteria:

- Every advertised column is backed by a real optional DTO field.
- Unsupported Unix ownership columns are not advertised on Windows.
- The 100,000-entry benchmark meets the documented elapsed-time, peak-memory,
  cache-bound, and identity-lookup limits on every platform advertising the
  affected columns.

### WP7 — Consolidation and guardrails

1. Delete the legacy Compress catalogue and default visibility path.
2. Delete all header-triggered preference writes and retire the legacy
   order/width storage keys.
3. Delete physical-suffix table preference resolution.
4. Add a guardrail preventing new product columns outside the catalogue.
5. Update `docs/COLUMN_SUPPORT_MATRIX.md` to match implemented Compress and
   Extract availability.
6. Document deliberately unavailable metadata.

Exit criteria:

- One catalogue owns column identity and scope.
- One preference seam persists visibility only.
- One Rust contract owns Compress availability.
- One canonical family normalizer owns Extract preference keys.
- No hidden order/width persistence remains.

## Test Plan

### Pure frontend tests

- catalogue ID uniqueness, scopes, labels, and canonical order;
- global visibility normalization;
- clean-install defaults;
- visibility-only legacy migration and idempotence;
- unknown and duplicate ID removal;
- Name always visible;
- stable relative order after filtering;
- Global selections surviving current-system unavailability;
- configured-default visibility versus locally overridden current visibility;
- effective Compress visibility intersection;
- Compress menu maximum availability;
- output-format changes not affecting Compress;
- complete generated-suffix-to-family coverage;
- conservative and non-persistable unknown-family handling;
- canonical family alias equivalence;
- compound suffixes resolving before raw-stream suffixes;
- case-insensitive family normalization;
- dotted/undotted legacy family migration;
- total canonical/alias collision precedence;
- version-2-first loading and failed-write legacy recovery;
- Extract filtering independent of host OS;
- audited per-family values matching actual DTO mapping;
- local workspace changes not writing preferences;
- Reset Columns restoring configured visibility and intrinsic layout;
- readonly snapshot column state;
- successful changed-column preference save resetting affected workspaces only;
- unrelated preference save, preference cancel, and save failure preserving
  unaffected workspaces;
- unavailable or hidden Extract sort falling back locally to Name ascending;
  and
- a later visibility/family change restoring the configured sort preference.

### Rust and contract tests

- `ProjectContract.sourceTableCapabilities` serialization;
- required base columns;
- invalid capability sets falling back to the complete required safe base;
- every advertised column having an end-to-end DTO field;
- source attribute namespace/code contract coverage;
- late capability arrival preserving or clamping local layout according to the
  mutation rule;
- Windows source capability mapping;
- macOS source capability mapping;
- Linux source capability mapping;
- missing birth/access time producing empty optional values;
- symbolic-link target collection without unintended traversal;
- owner/group resolution fallback;
- permission-denied metadata reads;
- bounded identity lookup; and
- Rust/TypeScript contract drift.

### React tests

- grouped Global Column Options;
- visibility checkboxes and Name lock;
- complete canonical-family selector options and localized family labels;
- active Compress headers from the visibility intersection;
- unavailable Compress columns absent from the header menu;
- Extract aliases using one format-family override;
- local resize and reorder remaining transient; and
- Reset Columns.

### End-to-end and installed checks

Automate:

1. Select global columns and verify each scenario shows the applicable,
   available intersection.
2. Select a Compress column unavailable on the current system and verify it
   remains stored globally but absent from the table and menu.
3. Enable Source Path and verify it appears only in Compress when advertised.
4. Enable Packed Size and verify it appears only in Extract.
5. Resize and reorder columns, restart, and verify intrinsic layout returns.
6. Reset active columns and verify configured visibility plus intrinsic layout.
7. Configure `.tar.gz`, then open `.tgz` and verify the same family preference.
8. Configure `.tar.zst`, then open `.tzst` and verify the same family preference.
9. Save a common Global Column Options change while both workspaces have local
   layout changes and verify both reset to the new configured defaults; then
   save an Extract-only or unrelated preference change and verify an unaffected
   Compress layout is preserved.
10. Hide the persisted sort key or open a family that does not support it,
    verify Name ascending is used without overwriting the preference, then make
    the key visible in a compatible family and verify the configured sort
    returns.

Manual installed checks remain required for:

- Windows attributes, owner, symlink, and access-time behavior;
- macOS mode, UID/GID, owner/group, flags, and symbolic links;
- Linux filesystems with and without birth-time support; and
- large source trees with repeated owner/group identities.

Record the Rust-reported capability set and tested filesystem type with manual
evidence.

## Build Verification Matrix

Before claiming implementation complete, run:

1. `npm run test:frontend`
2. `npm run build`
3. `cd ../zmanager && cargo fmt` after any `zmanager-core` Rust change
4. `cd ../zmanager && cargo test -p zmanager-core` after any
   `zmanager-core` change
5. `cd src-tauri && cargo fmt`
6. `cd src-tauri && cargo check`
7. `cd src-tauri && cargo test`
8. `cd native/macos && swift build`
9. `npm run test:e2e` for affected table and Preferences workflows

Windows metadata work must also use the repository's Parallels Windows
validation workflow and the Windows ARM64 release gate where applicable.

## Acceptance Criteria

1. Global Column Options lists Common, Compress only, and Extract only columns.
2. Global preferences persist only the schema version and global/Extract-family
   visible column IDs.
3. Order and width changes are workspace-local and do not survive restart.
4. Compress and Extract use one semantic column catalogue.
5. Rust reports the complete available Compress column set for the running
   implementation.
6. Compress default visibility equals global visibility intersected with
   Compress scope and the validated capability set or safe-base fallback.
7. The Compress header menu offers no ID outside the validated capability set
   or safe-base fallback.
8. Locally toggled Compress columns may differ from global defaults but never
   exceed the validated capability set or safe-base fallback, and Reset removes
   those local differences.
9. Missing row metadata renders as an empty value without removing an available
   column.
10. Changing the Compress output format does not change source columns.
11. Source Path never appears in Extract.
12. Extract-only columns never appear in Compress.
13. Extract can display stored Unix metadata on Windows.
14. Every generated supported archive suffix resolves to exactly one canonical
    family.
15. `.tgz` and `.tar.gz` share one format-family preference.
16. `.tzst` and `.tar.zst` share one format-family preference.
17. Name remains visible and is the first configurable data column.
18. Reset Columns restores configured visibility, canonical order, and scenario
    intrinsic widths without writing preferences.
19. Saving changed Global Column Options immediately resets every workspace
    whose resolved defaults changed, while unaffected workspaces, unrelated
    saves, cancellation, and save failure preserve local layouts.
20. An unavailable or hidden configured Extract sort uses workspace-local Name
    ascending without overwriting the persisted preference and returns when the
    key becomes visible.
21. Enabled Compress metadata contains Rust/core-provided values or empty
    optional values, never frontend guesses.
22. Existing visible-column preferences migrate without silent loss using the
    documented total alias precedence.
23. A failed version-2 preference write leaves legacy values recoverable.
24. Legacy order/width persistence and the old Compress catalogue are deleted.
25. Advertised source metadata meets the documented 100,000-entry performance
    and bounded identity-resolution budget.
26. Frontend, core Rust, desktop Rust, Swift, and relevant end-to-end
    verification pass without warnings or dead code.

## Risks And Mitigations

### Rust advertises a column before data is wired

Require a contract test for every advertised ID and add the capability only in
the same slice that completes DTO mapping and formatting.

### Capability filtering destroys global choices

Keep stored global visibility separate from the resolved active projection.
Never save the filtered active result as Global Options.

### Alias migration chooses the wrong override

Use the registry's complete precedence order, a distinct version-2 storage key,
and conflict fixtures for every alias position. Once version 2 is valid, never
consult legacy keys.

### Metadata collection slows large plans

Collect during the existing traversal, cache identity resolution, measure large
trees, and omit expensive fields from the capability set until their cost is
within the documented elapsed-time, memory, cache, and lookup limits.

### Late capability arrival destroys local layout

Track whether local layout mutation occurred. Reset an untouched workspace, but
clamp a changed workspace to the validated available set without adding newly
available optional columns.

### Format registry drifts from supported suffixes

Compare the registry with the generated archive suffix manifest in a required
frontend test. A new supported suffix fails the test until it receives exactly
one family mapping and an audited availability set.

### Optional values look broken

Advertise only fields the running implementation can attempt to populate.
Format absent row values consistently and document filesystem-specific gaps.
