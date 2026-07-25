# Column Support Matrix

Last updated: 2026-07-25

## Overview

The archive table supports 18 columns defined in `src/app/archiveTable.ts`. However, the
unified `BrowserEntry` struct in `zmanager-core` (`archive_browser.rs`) only has **7
fields**, and each format backend discards varying amounts of metadata during the
backend → BrowserEntry conversion.

This document catalogues every column against every archive format, identifies the
root cause of each gap, and prescribes the exact fix.

---

## Current state

### BrowserEntry (the bottleneck)

```rust
// zmanager-core/src/archive_browser.rs:41-56
pub struct BrowserEntry {
    pub path: String,
    pub kind: BrowserEntryKind,
    pub size: Option<u64>,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,   // display string, not structured
    pub mode: Option<u32>,
    pub metadata_diagnostics: Vec<String>,
}
```

### ArchiveEntryDto (the serialization bottleneck)

```rust
// src-tauri/src/dto.rs:117-127
pub struct ArchiveEntryDto {
    pub path: String,
    pub kind: ArchiveEntryKindDto,
    pub size: Option<u64>,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
    pub mode: Option<u32>,
    pub metadata_diagnostics: Vec<String>,
}
```

### TypeScript type (optimistic but never populated)

```typescript
// src/api/types.ts:140-158
export type ArchiveEntryDto = {
  path: string;
  kind: ArchiveEntryKind;
  size?: number;
  compressedSize?: number;
  modified?: string;
  mode?: number;
  metadataDiagnostics?: string[];
  created?: string;      // never populated
  accessed?: string;     // never populated
  attributes?: string;   // never populated
  encrypted?: boolean;   // never populated
  method?: string;       // never populated
  crc?: string;          // never populated
  block?: number;        // never populated
  comment?: string;      // never populated
  solid?: boolean;       // never populated
  linkTarget?: string;   // never populated
};
```

---

## Column × Format matrix

**Legend:**
- ✅ — Data available and wired end-to-end
- 🔧 — Data available in the format/crate but **not mapped** to BrowserEntry (fix in zmanager-core)
- ⚙️ — Data stored in the format but **not exposed** by the backing crate's public API (needs upstream changes)
- ❌ — Format does not support this metadata at all

| Column | ZIP | 7z | TZAP | TAR.ZST | TGZ/BZ2/XZ/BR (libarchive) | AppleArchive | Raw stream |
|---|---|---|---|---|---|---|---|
| **name** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **size** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **compressedSize** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **modified** | ✅ | 🔧 | ✅ | ✅ (u64 sec) | ✅ (u64 sec) | ✅ (u64 sec) | ❌ |
| **mode** | 🔧 | 🔧 | ✅ | ✅ | ✅ | ❌ | ❌ |
| **kind** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ratio** | ✅ (derived) | ✅ (derived) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **metadataDiagnostics** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **encrypted** | 🔧 | 🔧 | ❌ (archive-level) | ❌ | 🔧 | ❌ | ❌ |
| **method** | 🔧 | 🔧 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **crc** | 🔧 | 🔧 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **modified (7z)** | — | 🔧 | — | — | — | — | — |
| **comment** | 🔧 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **created** | ❌ | ❌ | ⚙️ (in PAX) | ❌ | ❌ | ❌ | ❌ |
| **accessed** | ❌ | ❌ | ⚙️ (in PAX) | ❌ | ❌ | ❌ | ❌ |
| **linkTarget** | ❌ | ❌ | ⚙️ (in PAX) | 🔧 | ❌ | ❌ | ❌ |
| **solid** | ❌ | 🔧 (archive-level) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **attributes** | ❌ | 🔧 (win attrs) | ⚙️ (PAX portable.attributes) | ❌ | ❌ | ❌ | ❌ |
| **block** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Per-column detail

### 🔧 `mode` (Unix permissions)

| Format | Data source | Gap |
|---|---|---|
| **ZIP** | `ZipFile::unix_mode() -> Option<u32>` available. `ZipListEntry` struct already has `unix_mode: Option<u32>`. | `visit_zip_entries()` in `archive_browser.rs:500` **hardcodes `mode: None`**. One-line fix. |
| **7z** | `entry.windows_attributes()` with `SEVENZ_UNIX_ATTRIBUTES_FLAG` (bit 31). `sevenz_unix_mode()` helper already exists at `sevenz_backend.rs:1393` and is used during extraction. | `list_7z()` at line 939 never calls `sevenz_unix_mode()`. `SevenZListEntry` has no `mode` field. |
| **TAR.ZST** | `tar::Header::mode()` | ✅ Already wired |
| **Libarchive** | `LibarchiveListEntry.mode: u32` | ✅ Already wired (masked to `0o7777`) |

**Fix:** Add `mode: Option<u32>` to `SevenZListEntry`, populate in `list_7z()`, map in `list_7z_entries()`. Wire `file.unix_mode()` in `visit_zip_entries()`.

---

### 🔧 `modified` (7z)

The 7z format stores per-file modification timestamps. The `sevenz_rust2` crate exposes them via `entry.has_last_modified_date` and `entry.last_modified_date()`. The extraction code at `sevenz_backend.rs:1529-1534` already reads these fields to restore timestamps after extraction.

**Gap:** `list_7z()` at line 939 ignores timestamps entirely. `SevenZListEntry` has no timestamp field.

**Fix:** Add `modified: Option<SystemTime>` (or `Option<i64>`) to `SevenZListEntry`, populate in `list_7z()`, convert to display string in `list_7z_entries()`.

---

### 🔧 `encrypted`

| Format | Data source | Gap |
|---|---|---|
| **ZIP** | `ZipFile::encrypted() -> bool`. `ZipListEntry.encrypted: bool` already exists. | `visit_zip_entries()` in `archive_browser.rs` reads `ZipFile` directly and never reads `encrypted`. |
| **7z** | `sevenz_rust2::ArchiveEntry` has per-file encryption info. | Not captured in `SevenZListEntry`. (Needs verification against `sevenz_rust2` API.) |
| **Libarchive** | `LibarchiveListEntry` has `data_encrypted: bool` and `metadata_encrypted: bool`. | Not mapped to `BrowserEntry`. |

**Fix:** Add `encrypted: Option<bool>` to `BrowserEntry`. Wire from each format.

---

### 🔧 `method` (compression method)

| Format | Data source | Gap |
|---|---|---|
| **ZIP** | `ZipFile::compression() -> CompressionMethod` (enum: Stored, Deflated, BZip2, LZMA, Zstd, etc.) | Not in `ZipListEntry`, not in `BrowserEntry`. |
| **7z** | `sevenz_rust2` exposes per-file compression method. (Needs verification.) | Not in `SevenZListEntry`. |

**Fix:** Add `method: Option<String>` to `BrowserEntry` (human-readable like `"Deflate"`, `"LZMA2"`). Populate from ZIP and 7z.

---

### 🔧 `crc`

| Format | Data source | Gap |
|---|---|---|
| **ZIP** | `ZipFile::crc32() -> u32` | Not in `ZipListEntry`, not in `BrowserEntry`. |
| **7z** | 7z stores per-file CRC. `sevenz_rust2` likely exposes it. | Not in `SevenZListEntry`. |

**Fix:** Add `crc: Option<u32>` to `BrowserEntry`. Populate from ZIP (`crc32()`) and 7z. Display as 8-char uppercase hex.

---

### 🔧 `comment` (per-file comment)

| Format | Data source | Gap |
|---|---|---|
| **ZIP** | `ZipFile::comment() -> &str` | Not in `ZipListEntry`, not in `BrowserEntry`. |

**Fix:** Add `comment: Option<String>` to `BrowserEntry`. Populate from ZIP only.

---

### 🔧 `linkTarget` (symlink/hardlink target)

| Format | Data source | Gap |
|---|---|---|
| **TAR.ZST / TAR** | `tar::Header::link_name() -> io::Result<Option<Cow<Path>>>` | Used during extraction but not in listing. |
| **TZAP** | PAX `linkpath` key. `OwnedTarMember.link_target: Option<Vec<u8>>` exists internally. Already on `ExtractedArchiveMember`. | Not on `ArchiveEntry` (needs tzap-core change). |

**Fix:** For TAR: populate during `list_tar_zst_entries()`. For TZAP: add to `tzap-core::ArchiveEntry`.

---

### 🔧 `solid` (solid compression flag)

| Format | Data source | Gap |
|---|---|---|
| **7z** | `SevenZListing.solid: bool` — archive-level property. | Not threaded through to `BrowserEntry`. Would ideally be per-entry (all entries in a solid archive have the same value). |

**Fix:** Add `solid: Option<bool>` to `BrowserEntry`. Thread from `SevenZListing.solid`.

---

### 🔧 `attributes` (platform file attributes)

| Format | Data source | Gap |
|---|---|---|
| **7z** | `entry.windows_attributes() -> u32` | Not in `SevenZListEntry`. Could expose raw value. |
| **TZAP** | PAX `TZAP.portable.attributes` key. Parsed into `PortableMetadataMirror.attributes: Option<u32>`. | Not exposed on `ArchiveEntry`. |

**Fix:** For 7z: add to `SevenZListEntry`. For TZAP: add to `tzap-core::ArchiveEntry`.

---

### ⚙️ `created` / `accessed` (timestamps beyond mtime)

| Format | Data source | Gap |
|---|---|---|
| **TZAP** | PAX keys: `atime`, `LIBARCHIVE.creationtime`, `TZAP.unix.ctime-observed`. Validated during parsing. `parse_timestamp()` exists in `entry_metadata.rs`. | Not exposed on `tzap-core::ArchiveEntry`. Needs upstream changes in tzap-core. |
| **TAR (GNU)** | `tar::Header::atime()` and `ctime()` | Not used in listing. |
| **All others** | Not supported by the format. | ❌ |

**Fix for TZAP:** Add `atime: Option<ArchiveTimestamp>`, `creation_time: Option<ArchiveTimestamp>`, `ctime: Option<ArchiveTimestamp>` to `tzap-core::ArchiveEntry`. Extract from `MemberMetadata.primary_records` PaxRecords. Thread through `TzapEntry` → `BrowserEntry` → `ArchiveEntryDto`.

---

### ❌ `block` — no format supports this

This column has no corresponding data in any supported archive format. It should be removed from `ARCHIVE_TABLE_COLUMNS` in `src/app/archiveTable.ts`.

---

## Format-specific native structs vs. what reaches BrowserEntry

### ZIP

`zip` crate 8.6.0 `ZipFile` exposes, but we discard:
- `crc32()`, `compression()`, `comment()`, `encrypted()`, `unix_mode()`, `version_made_by()`, `extra_data()`, `extra_data_fields()`

`ZipListEntry` captures 6 of ~15 available fields. `BrowserEntry` conversion drops `encrypted` and `unix_mode`.

### 7z

`sevenz_rust2::ArchiveEntry` exposes, but we discard:
- `has_last_modified_date` / `last_modified_date()` — timestamp
- `has_windows_attributes` / `windows_attributes()` — Unix mode + attributes
- Per-file CRC and compression method (needs verification)
- `has_stream()`

`SevenZListEntry` captures 5 fields. `BrowserEntry` conversion drops `has_stream` and leaves `modified`/`mode` as `None`.

The extraction code at `sevenz_backend.rs:1529-1534` and `1393-1401` proves these fields are available.

### TZAP

`tzap-core::ArchiveEntry` only exposes 6 fields: path, file_data_size, kind, mode, mtime, diagnostics.

The internal `MemberMetadata` (not publicly exported) holds:
- Raw `PaxRecords` (BTreeMap of all PAX keys): atime, ctime, creationtime, uid, gid, uname, gname, linkpath, device major/minor, portable attributes, Linux/BSD/macOS flags, ACLs, Windows attributes
- `PortableMetadataMirror`: uid, gid, uname, gname, attributes (already parsed)
- `AuxiliaryRecord` streams: xattr values, resource forks, ACLs, security descriptors, reparse data

The `ArchiveIndexEntry` (separate listing path) provides `compressed_size` via `ArchiveIndexEntryLayout`, but `list_files()` uses the simpler `list_files()` path.

All TZAP-specific fields in `TzapEntry` are faithfully mapped to `BrowserEntry`.

### TAR.ZST

`tar::Header` exposes, but we discard:
- `uid()`, `gid()`, `username()`, `groupname()`
- `link_name()` (symlink/hardlink target)
- `device_major()`, `device_minor()`
- `atime()`, `ctime()` (GNU extensions)
- PAX nanosecond timestamps

### Libarchive (TGZ, TAR.BZ2, TAR.XZ, TAR.BR, CPIO, etc.)

`LibarchiveListEntry` has `data_encrypted` and `metadata_encrypted` — both dropped in BrowserEntry conversion.

### RAR

Has its own rich `RarListEntry` with 9 fields (dictionary_size, link_target, encrypted, solid, file_attr, mtime), but currently routes through libarchive which loses all RAR-specific metadata.

### AppleArchive

Sparse native entry (path, kind, size, modified). No mode, no compressed size, no encryption flags.

### Raw stream (gzip, bzip2, xz, zstd single files)

Minimal by nature — single file, filesystem metadata only.

---

## Implementation plan

### Phase 1 — Wire what's already there (zmanager-core only)

No upstream changes needed. All data is already available from the backing crates.

| # | Task | Files changed | Effort |
|---|---|---|---|
| 1.1 | Add new fields to `BrowserEntry` | `archive_browser.rs` | Small |
| 1.2 | Wire `mode` for ZIP | `archive_browser.rs` (`visit_zip_entries`) | 1 line |
| 1.3 | Wire `mode` for 7z | `sevenz_backend.rs` (`SevenZListEntry` + `list_7z`) + `archive_browser.rs` | ~10 lines |
| 1.4 | Wire `modified` for 7z | `sevenz_backend.rs` + `archive_browser.rs` | ~10 lines |
| 1.5 | Wire `encrypted` for ZIP | `archive_browser.rs` | 1 line |
| 1.6 | Wire `encrypted` for libarchive | `archive_browser.rs` | 2 lines |
| 1.7 | Wire `method` for ZIP | `archive_browser.rs` + `BrowserEntry` | ~10 lines |
| 1.8 | Wire `crc` for ZIP | `archive_browser.rs` + `BrowserEntry` | ~10 lines |
| 1.9 | Wire `comment` for ZIP | `archive_browser.rs` + `BrowserEntry` | ~5 lines |
| 1.10 | Wire `linkTarget` for TAR | `archive_browser.rs` + `BrowserEntry` | ~5 lines |
| 1.11 | Wire `solid` for 7z | `archive_browser.rs` + `BrowserEntry` | ~5 lines |
| 1.12 | Add new fields to `ArchiveEntryDto` | `src-tauri/src/dto.rs` | ~15 lines |
| 1.13 | Wire new DTO fields in `browser_entry_to_dto()` | `src-tauri/src/archive_index.rs` | ~15 lines |
| 1.14 | Update TypeScript `ArchiveEntryDto` | `src/api/types.ts` | ~10 lines |
| 1.15 | Remove `block` column | `src/app/archiveTable.ts` | 1 line |

### Phase 2 — Upstream TZAP changes (tzap-core + zmanager-core)

| # | Task | Repo | Effort |
|---|---|---|---|
| 2.1 | Add `link_target` to `ArchiveEntry` | tzap-core | Small |
| 2.2 | Add `atime`, `creation_time`, `ctime` to `ArchiveEntry` | tzap-core | Medium |
| 2.3 | Add `uid`, `gid`, `uname`, `gname` to `ArchiveEntry` | tzap-core | Small |
| 2.4 | Add `portable_attributes` to `ArchiveEntry` | tzap-core | Small |
| 2.5 | Re-export `ArchiveEntry` changes in tzap-core public API | tzap-core | Small |
| 2.6 | Thread new fields through `TzapEntry` | zmanager-core `tzap_backend.rs` | Medium |
| 2.7 | Thread through `BrowserEntry` + `ArchiveEntryDto` | zmanager-core + desktop | Medium |

### Phase 3 — 7z deeper metadata

| # | Task | Effort |
|---|---|---|
| 3.1 | Verify `sevenz_rust2` exposes per-file CRC and compression method | Research |
| 3.2 | Add CRC and method fields to `SevenZListEntry` | Medium |
| 3.3 | Wire `attributes` from `windows_attributes()` | Small |

---

## Related files

| File | Role |
|---|---|
| `zmanager-core/src/archive_browser.rs` | Unified BrowserEntry, format dispatch, per-format → BrowserEntry conversions |
| `zmanager-core/src/zip_backend.rs` | ZipListEntry, ZIP listing/extraction |
| `zmanager-core/src/sevenz_backend.rs` | SevenZListEntry, 7z listing/extraction |
| `zmanager-core/src/tzap_backend.rs` | TzapEntry, TZAP listing/extraction |
| `zmanager-core/src/tar_zst_backend.rs` | TAR.ZST creation/extraction (listing is inline in archive_browser.rs) |
| `zmanager-core/src/libarchive_backend.rs` | LibarchiveListEntry, catch-all listing/extraction |
| `zmanager-core/src/rar_backend.rs` | RarListEntry (not routed through BrowserEntry) |
| `zmanager-core/src/apple_archive_backend.rs` | AppleArchiveListEntry |
| `tzap-core/src/reader.rs` | ArchiveEntry (public API — the upstream bottleneck for TZAP metadata) |
| `tzap-core/src/entry_metadata.rs` | MemberMetadata, PaxRecords, PortableMetadataMirror, PAX key registry |
| `tzap-core/src/tar_model.rs` | OwnedTarMember (internal, not publicly exported) |
| `src-tauri/src/dto.rs` | ArchiveEntryDto (Rust → JSON serialization) |
| `src-tauri/src/archive_index.rs` | ArchiveIndex, browser_entry_to_dto() |
| `src/api/types.ts` | TypeScript ArchiveEntryDto |
| `src/app/archiveTable.ts` | ARCHIVE_TABLE_COLUMNS, column formatting, sorting |
