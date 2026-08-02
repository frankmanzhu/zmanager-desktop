# Unified Table Columns

One semantic column catalogue shared by Compress and Extract tables. Each scenario shows the subset of columns applicable to it, with scenario-specific intrinsic widths.

## Column Catalogue

### Common columns (IDs 1–13)

| Order | ID | Label | Compress meaning | Extract meaning |
|---:|---|---|---|---|
| 1 | `name` | Name | Planned entry name | Stored entry name |
| 2 | `kind` | Type | Source entry kind | Stored entry kind |
| 3 | `size` | Size | Source content size | Uncompressed stored size |
| 4 | `modified` | Modified | Source modification time | Stored modification time |
| 5 | `created` | Created | Source creation time | Stored creation time |
| 6 | `accessed` | Accessed | Source access time | Stored access time |
| 7 | `attributes` | Attributes | Source filesystem flags | Stored platform attributes |
| 8 | `mode` | Mode | Source POSIX mode | Stored POSIX mode |
| 9 | `linkTarget` | Link Target | Source symlink target | Stored link target |
| 10 | `uid` | UID | Source Unix user ID | Stored Unix user ID |
| 11 | `gid` | GID | Source Unix group ID | Stored Unix group ID |
| 12 | `owner` | Owner | Source owner name | Stored owner name |
| 13 | `group` | Group | Source Unix group name | Stored group name |

### Compress-only (ID 14)

| Order | ID | Label | Meaning |
|---:|---|---|---|
| 14 | `sourcePath` | Source Path | Local path the planned entry is read from |

### Extract-only (IDs 15–22)

| Order | ID | Label | Meaning |
|---:|---|---|---|
| 15 | `compressedSize` | Packed Size | Exact stored compressed size when reported by the backend |
| 16 | `encrypted` | Encrypted | Per-entry encryption flag |
| 17 | `method` | Method | Stored compression method |
| 18 | `crc` | CRC | Stored checksum |
| 19 | `comment` | Comment | Stored entry comment |
| 20 | `ratio` | Ratio | Derived from uncompressed and packed sizes |
| 21 | `solid` | Solid | Stored solid-compression flag |
| 22 | `metadataDiagnostics` | Diagnostics | Stored metadata diagnostics |

### Clean-install visible defaults

1. Name
2. Type
3. Size
4. Modified
5. Packed Size

After scenario filtering:
- **Compress** shows Name, Type, Size, Modified (Packed Size is extract-only)
- **Extract** shows Name, Type, Size, Modified, Packed Size

Name is always visible and cannot be hidden.

## Source files

| File | Role |
|---|---|
| `src/app/tableColumnCatalogue.ts` | Canonical column IDs, scope types, catalogue array, clean-install defaults |
| `src/app/tableColumns.ts` | Generic column settings helpers (normalize, toggle, resize, reorder, visibility resolver) |
| `src/app/scenarioColumnLayout.ts` | Compress and Extract intrinsic pixel widths per column |
| `src/app/createTableColumns.ts` | Compress column array built from catalogue + Compress widths; thin wrappers over generic helpers |
| `src/app/archiveTable.ts` | Extract column array built from catalogue + Extract widths; value formatting and sort helpers |
| `src/app/archiveFormatFamily.ts` | Physical suffix → canonical format family normalization (34 families, alias resolution) |
| `src/app/extractColumnAvailability.ts` | Audited per-family Extract column availability |

## Format family registry

Physical archive suffixes map to canonical format families. Compound suffixes (`.tar.gz`, `.tar.zst`) resolve before raw stream suffixes (`.gz`, `.zst`). Aliases share one family: `.tgz` and `.tar.gz` both resolve to `tarGzip`.

See `src/app/archiveFormatFamily.ts` for the complete 34-family registry and alias mappings.

## Scenario-specific widths

Compress and Extract have different intrinsic pixel widths for the same semantic column. Widths are defined in `src/app/scenarioColumnLayout.ts`. The catalogue does not own pixel widths.

## Extract per-family availability

Each format family supports a specific subset of Extract columns. For example, stream formats (`.gz`, `.bz2`) only expose compressed size, while TAR and TZAP expose Unix metadata. The audited availability matrix is in `src/app/extractColumnAvailability.ts`.

## Compress source capabilities

Rust reports which Compress columns the running system can populate via `ProjectContract.sourceTableCapabilities.availableColumnIds`. The safe-base fallback (always available) is: name, kind, size, modified, sourcePath.

TypeScript never adds availability based on OS detection. The selected output format does not change Compress column availability.

### Implemented capability sets

| Platform | Columns | Count |
|---|---|---|
| **macOS** | name, kind, size, modified, sourcePath, created, accessed, attributes, mode, linkTarget, uid, gid, owner, group | 14 |
| **Linux** | name, kind, size, modified, sourcePath, created, accessed, mode, linkTarget, uid, gid, owner, group | 13 |
| **Windows** | name, kind, size, modified, sourcePath, created, accessed, attributes, linkTarget | 9 |

**Metadata sources** (collected from `source_path` via `std::fs::symlink_metadata` during DTO mapping):
- `created` — `Metadata::created()` (all platforms)
- `accessed` — `Metadata::accessed()` (all platforms)
- `attributes` — human-readable BSD `st_flags` on macOS and `FILE_ATTRIBUTE_*` values on Windows during source file scanning
- `mode` — `PermissionSnapshot.unix_mode` from core planner (Unix)
- `linkTarget` — `ManifestEntry.symlink_target` from core planner (Unix)
- `uid`, `gid` — `MetadataExt::uid()`/`gid()` (Unix)
- `owner`, `group` — `getpwuid_r`/`getgrgid_r` name resolution (Unix)

> [!NOTE]
> **Platform Attribute Semantics (`attributes` vs `st_flags`)**:
> - **Compress Table (Source Files)**: `attributes` is populated from local filesystem metadata during scanning — BSD `st_flags` on macOS and `FILE_ATTRIBUTE_*` on Windows.
> - **Extract Table (`zm list`)**: `attributes` in fast index listing (`zm list --json`) models portable Windows-compatible attributes (`FILE_ATTRIBUTE_*`). For `.tzap` archives on macOS, native BSD `st_flags` are stored in PAX header extensions (`TZAP.macos.st-flags`) and fully restored on disk during extraction (`zm extract`), while fast index listing exposes `attributes: null` unless portable Windows attributes exist.
