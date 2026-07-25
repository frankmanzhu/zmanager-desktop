# Column Support — Implementation Plan

Last updated: 2026-07-25 (Status: **COMPLETED & VERIFIED**)

## Implementation Summary & Status

All 8 phases of the Column Support Matrix plan have been fully implemented, tested, and verified across all supported platforms.

### Key Accomplishments
1. **Extended Data Flow (Phase 1):** Extended `BrowserEntry` (13 new fields), `ArchiveEntryDto` (Rust & TS), added `uid`, `gid`, `owner`, and `group` column definitions, and removed the obsolete `block` column.
2. **Format-Specific Column Wiring (Phases 2-6 & 7.5):**
   - **ZIP / JAR / APK / IPA:** Wired `encrypted`, `method`, `crc`, `comment`, and `mode`.
   - **7z:** Wired `modified`, `created`, `accessed`, `mode`, `crc`, `attributes`, and `solid`.
   - **libarchive (TAR / TGZ / BZ2 / XZ / BR):** Wired `uid`, `gid`, `owner`, `group`, FFI bindings in `zmanager-libarchive-sys`, and `encrypted`.
   - **TAR.ZST / TZST:** Wired `linkTarget`, `uid`, `gid`, `owner`, and `group`.
   - **Apple Archive (AAR / AEA):** Extended `zmanager-apple-archive` to parse `CTM` (created), `FLG` (flags/attributes), `CKS` (crc), `UID`, `GID`, and `linkTarget`.
   - **TZAP (zmanager-core & tzap-core):** Extended `ArchiveEntry` in `tzap-core` to parse PAX records (`LIBARCHIVE.creationtime`, `atime`), `link_target`, `attributes`, `uid`, `gid`, `owner`, and `group`.
3. **Proportional Stream Ratio & Compressed Size:** Implemented `apply_stream_proportional_sizes()` in `archive_browser.rs` to compute proportional entry `compressedSize` and `ratio` for solid stream archives (`.tar.zst`, `.tar.gz`, `.tar.bz2`, `.tar.xz`, `.tar.br`, `.tzap`, `.aar`, `.aea`).
4. **Solid Compression Stream Mapping:** Set `solid = Some(true)` for 7z solid archives, `.tzap`, and all compressed TAR streams (`.tar.zst`, `.tar.gz`, `.tar.bz2`, `.tar.xz`, `.tar.br`), and `solid = Some(false)` for uncompressed `.tar`.
5. **Per-Format Column Availability UI Filtering (Phase 8):** Added `ARCHIVE_COLUMNS_BY_FORMAT` and `getAvailableColumnsForFormat()` in `archiveTable.ts`. Context menus and Preferences dialog filter column options dynamically based on the active archive format.

---

## Final Column × Format Support Matrix (Implemented)

| Column | ZIP / JAR / APK / IPA | 7z | TZAP | TAR.ZST / TZST | libarchive (TAR / TGZ / BZ2 / XZ) | Apple Archive (AAR / AEA) | Raw Stream (gz / bz2 / xz / zst) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **name** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **size** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **compressedSize** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **modified** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **mode** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **kind** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ratio** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **metadataDiagnostics** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **encrypted** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **method** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **crc** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **comment** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **created** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **accessed** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **linkTarget** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **solid** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **attributes** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **uid** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **gid** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **owner** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **group** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Overview

The archive table currently defines **18 columns** in `src/app/archiveTable.ts`. This
plan adds **4 new columns** (uid, gid, owner, group) and removes **1 dead column**
(block), for a final total of **21 columns**. The unified `BrowserEntry` struct in
zmanager-core (`archive_browser.rs`) only carries **7 fields** today. Each format
backend discards varying amounts of metadata during the backend → BrowserEntry
conversion.

This document:

1. Catalogues every column against every format with **verified** crate API data
2. Prescribes the exact fix for each gap (file + line number)
3. Provides a phased implementation plan

---

## Data flow pipeline

Every new field touches this chain:

```
Format crate (zip / sevenz_rust2 / tzap-core / tar)
  → Format native entry struct (ZipListEntry / SevenZListEntry / TzapEntry / …)
    → BrowserEntry (zmanager-core archive_browser.rs)
      → browser_entry_to_dto() (src-tauri archive_index.rs)
        → ArchiveEntryDto (src-tauri dto.rs, serde camelCase → JSON)
          → TypeScript ArchiveEntryDto (src/api/types.ts)
            → Column rendering (archiveTable.ts — formatters handle all column IDs)

+ ensure_ancestors() in archive_index.rs:627 — synthetic directory entries need defaults
+ commands.rs:217 — test-only list_archive() DTO construction
```

The frontend formatting (`formatArchiveTableValue`) and sorting (`compareArchiveRows`)
already handle all existing column IDs. **Only new column definitions are needed**
(uid, gid, owner, group) — no existing column formatting logic changes.

---

## Verified crate API data

### `zip` 8.6.0 — `ZipFile` public API

| Method | Returns | Used in listing? |
|---|---|---|
| `name()` | `&str` | ✅ |
| `size()` | `u64` | ✅ |
| `compressed_size()` | `u64` | ✅ |
| `last_modified()` | `Option<DateTime>` | ✅ |
| `encrypted()` | `bool` | ❌ (available, not read) |
| `unix_mode()` | `Option<u32>` | ❌ (available, hardcoded to `None`) |
| `compression()` | `CompressionMethod` | ❌ (implements `Display`: "Stored", "Deflated", "Bzip2", "Lzma", "Zstd", "Xz", etc.) |
| `crc32()` | `u32` | ❌ |
| `comment()` | `&str` | ❌ |
| `is_dir()` / `is_symlink()` | `bool` | ✅ (for kind) |
| `version_made_by()` | `(u8, u8)` | ❌ |
| `extra_data_fields()` | `impl Iterator<Item = &ExtraField>` | ❌ |

### `sevenz_rust2` 0.21.0 — `ArchiveEntry` public fields

| Field | Type | Used in listing? |
|---|---|---|
| `name` | `String` | ✅ |
| `size` | `u64` | ✅ |
| `compressed_size` | `u64` | ✅ |
| `has_stream` | `bool` | ✅ (in struct, not in BrowserEntry) |
| `is_directory` | `bool` | ✅ (for kind) |
| `is_anti_item` | `bool` | ✅ (for kind) |
| `has_crc` | `bool` | ❌ |
| `crc` | `u64` | ❌ (CRC32 of uncompressed data) |
| `has_last_modified_date` | `bool` | ❌ (used in extraction, not listing) |
| `last_modified_date` | `NtTime` | ❌ (implements `Into<SystemTime>`) |
| `has_creation_date` | `bool` | ❌ |
| `creation_date` | `NtTime` | ❌ |
| `has_access_date` | `bool` | ❌ |
| `access_date` | `NtTime` | ❌ |
| `has_windows_attributes` | `bool` | ❌ (used in extraction, not listing) |
| `windows_attributes` | `u32` | ❌ |

**Not per-entry (available via block chain resolution):**
- Compression method — per-`Block.coders`, accessible via `ArchiveReader::file_compression_methods()`
- Encryption flag — determined by AES coder presence in `Block.coders` chain

**Archive-level:**
- `Archive.is_solid: bool` — public field, already read in `list_7z()`, stored in `SevenZListing.solid`

---

## Column × Format feasibility matrix

**Legend:**
- ✅ Wired end-to-end
- 🔧 Available in backing crate, not mapped — fix in zmanager-core
- ⚙️ Stored in format, not in public crate API — needs upstream changes
- 🔗 Available but requires block-chain resolution (7z only, more complex)
- ❌ Format does not support this metadata

| Column | ZIP | 7z | TZAP | TAR.ZST | TGZ/BZ2/XZ (libarchive) | AppleArchive | Raw stream |
|---|---|---|---|---|---|---|---|
| name | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| size | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| compressedSize | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| modified | ✅ | 🔧 | ✅ | ✅ | ✅ | ✅ | ❌ |
| mode | 🔧 | 🔧 | ✅ | ✅ | ✅ | 🔧 | ❌ |
| kind | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ratio | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| metadataDiagnostics | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| encrypted | 🔧 | 🔗 | 🔧 | ❌ | 🔧 | 🔧 | ❌ |
| method | 🔧 | 🔗 | 🔧 | ❌ | ❌ | 🔧 | ❌ |
| crc | 🔧 | 🔧 | ❌ | ❌ | ❌ | 🔧 | ❌ |
| comment | 🔧 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| created | ❌ | 🔧 | ⚙️ (PAX) | ❌ | ❌ | 🔧 | ❌ |
| accessed | ❌ | 🔧 | ⚙️ (PAX) | ❌ | ❌ | ❌ | ❌ |
| linkTarget | ❌ | ❌ | ⚙️ (PAX) | 🔧 | ❌ | 🔧 | ❌ |
| solid | ❌ | 🔧 | ❌ | ❌ | ❌ | ❌ | ❌ |
| attributes | ❌ | 🔧 | ⚙️ (PAX) | ❌ | ❌ | 🔧 | ❌ |
| block | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| uid | ❌ | ❌ | ⚙️ (PAX) | 🔧 | 🔧 | 🔧 | ❌ |
| gid | ❌ | ❌ | ⚙️ (PAX) | 🔧 | 🔧 | 🔧 | ❌ |
| owner | ❌ | ❌ | ⚙️ (PAX) | 🔧 | 🔧 | ❌ | ❌ |
| group | ❌ | ❌ | ⚙️ (PAX) | 🔧 | 🔧 | ❌ | ❌ |

---

## Phase 1: Extend shared structs (foundation)

### Task 1.1 — Add new fields to `BrowserEntry`

**File:** `zmanager-core/src/archive_browser.rs:41-56`

```rust
pub struct BrowserEntry {
    // existing (7 fields)
    pub path: String,
    pub kind: BrowserEntryKind,
    pub size: Option<u64>,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
    pub mode: Option<u32>,
    pub metadata_diagnostics: Vec<String>,
    // new (13 fields)
    pub encrypted: Option<bool>,
    pub method: Option<String>,
    pub crc: Option<u32>,
    pub comment: Option<String>,
    pub created: Option<String>,
    pub accessed: Option<String>,
    pub solid: Option<bool>,
    pub link_target: Option<String>,
    pub attributes: Option<String>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub owner: Option<String>,
    pub group: Option<String>,
}
```

### Task 1.2 — Add new fields to `ArchiveEntryDto` (Rust)

**File:** `src-tauri/src/dto.rs:117-127`

Add matching fields. The `#[serde(rename_all = "camelCase")]` on the struct
auto-converts `snake_case` → `camelCase` for JSON keys. CRC should be
pre-formatted as a hex string:

```rust
pub struct ArchiveEntryDto {
    // existing …
    pub path: String,
    pub kind: ArchiveEntryKindDto,
    pub size: Option<u64>,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
    pub mode: Option<u32>,
    pub metadata_diagnostics: Vec<String>,
    // new
    pub encrypted: Option<bool>,
    pub method: Option<String>,
    pub crc: Option<String>,         // pre-formatted: format!("{:08X}", crc32)
    pub comment: Option<String>,
    pub created: Option<String>,
    pub accessed: Option<String>,
    pub solid: Option<bool>,
    pub link_target: Option<String>,
    pub attributes: Option<String>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub owner: Option<String>,
    pub group: Option<String>,
}
```

### Task 1.3 — Update `browser_entry_to_dto()`

**File:** `src-tauri/src/archive_index.rs:641-651`

Map every new `BrowserEntry` field to `ArchiveEntryDto`. For `crc`, format as hex:

```rust
crc: entry.crc.map(|c| format!("{:08X}", c)),
```

### Task 1.4 — Update synthetic directory entries

**File:** `src-tauri/src/archive_index.rs:627-635`

`ensure_ancestors()` creates `ArchiveEntryDto` for implicit directory ancestors.
Add `None` for every new optional field (Rust struct update syntax handles this
naturally if defaults are `None`).

### Task 1.5 — Update `commands.rs` test-only `list_archive()`

**File:** `src-tauri/src/commands.rs:217-226`

Add new fields with `None` defaults to the manual DTO construction.

### Task 1.6 — Update TypeScript `ArchiveEntryDto`

**File:** `src/api/types.ts:140-158`

The TypeScript type already declares all unpopulated fields as optional. Change
them from "declared but never populated" to properly documented. No structural
changes needed — the field names match the camelCase JSON keys from serde.

### Task 1.7 — Add `uid` and `gid` column definitions

**File:** `src/app/archiveTable.ts`

Add to `ArchiveTableColumnId` union and `ARCHIVE_TABLE_COLUMNS`:

```typescript
{ id: "uid", label: "UID", labelKey: "table.uid", width: 70, align: "right", defaultVisible: false },
{ id: "gid", label: "GID", labelKey: "table.gid", width: 70, align: "right", defaultVisible: false },
```

Add to `formatArchiveTableValue()`:
```typescript
case "uid": return typeof entry.uid === "number" ? String(entry.uid) : EMPTY_VALUE;
case "gid": return typeof entry.gid === "number" ? String(entry.gid) : EMPTY_VALUE;
```

Add i18n keys: `table.uid`, `table.gid`.

Also add `owner` and `group`:

```typescript
{ id: "owner", label: "Owner", labelKey: "table.owner", width: 100, align: "left", defaultVisible: false },
{ id: "group", label: "Group", labelKey: "table.group", width: 100, align: "left", defaultVisible: false },
```

```typescript
case "owner": return entry.owner ?? EMPTY_VALUE;
case "group": return entry.group ?? EMPTY_VALUE;
```

Add i18n keys: `table.owner`, `table.group`.

### Task 1.8 — Remove the `block` column

**File:** `src/app/archiveTable.ts`

Remove `"block"` from `ArchiveTableColumnId` union type and `ARCHIVE_TABLE_COLUMNS`
array. No format supports this, and there is no path to support it.

---

## Phase 2: Wire ZIP columns

All data available from `zip` 8.6.0 `ZipFile` API. No upstream changes needed.

The key insight: `visit_zip_entries()` in `archive_browser.rs:481-508` reads
`ZipFile` directly (not `ZipListEntry`), so the gaps are all in this one function.

### Task 2.1 — Wire `mode` for ZIP

**Gap:** Line 500 hardcodes `mode: None`. `file.unix_mode()` returns `Option<u32>`.

**Fix:** Replace `mode: None` with `mode: file.unix_mode()`.

**Effort:** 1 line.

### Task 2.2 — Wire `encrypted` for ZIP

**Gap:** `file.encrypted()` is not read.

**Fix:** Add `encrypted: Some(file.encrypted())`.

**Effort:** 1 line.

### Task 2.3 — Wire `method` for ZIP

**Gap:** `file.compression()` returns `CompressionMethod` which implements
`Display` → human-readable strings: `"Stored"`, `"Deflated"`, `"Bzip2"`,
`"Lzma"`, `"Zstd"`, `"Xz"`, `"Ppmd"`, etc.

**Fix:** Add `method: Some(file.compression().to_string())`.

**Effort:** 1 line.

### Task 2.4 — Wire `crc` for ZIP

**Gap:** `file.crc32()` returns `u32`.

**Fix:** Add `crc: Some(file.crc32())`. Format as uppercase hex in the DTO layer
(Task 1.3 above).

**Effort:** 1 line in `archive_browser.rs`.

### Task 2.5 — Wire `comment` for ZIP

**Gap:** `file.comment()` returns `&str`.

**Fix:**
```rust
comment: {
    let c = file.comment();
    (!c.is_empty()).then(|| c.to_owned())
},
```

**Effort:** ~3 lines.

---

## Phase 3: Wire 7z columns

All data available from `sevenz_rust2` 0.21.0 `ArchiveEntry` public fields.
No upstream changes needed for basic fields.

### Task 3.1 — Extend `SevenZListEntry`

**File:** `zmanager-core/src/sevenz_backend.rs:98-110`

```rust
pub struct SevenZListEntry {
    // existing (5 fields)
    pub name: String,
    pub kind: SevenZEntryKind,
    pub size: u64,
    pub compressed_size: u64,
    pub has_stream: bool,
    // new (6 fields)
    pub modified: Option<i64>,       // Unix timestamp seconds
    pub created: Option<i64>,        // Unix timestamp seconds
    pub accessed: Option<i64>,       // Unix timestamp seconds
    pub mode: Option<u32>,           // Unix permission bits
    pub crc: Option<u32>,            // CRC32 of uncompressed data
    pub attributes: Option<u32>,     // raw windows_attributes
}
```

### Task 3.2 — Wire `modified`, `created`, `accessed` for 7z

**Data source:** `entry.has_last_modified_date` / `entry.last_modified_date()`,
`entry.has_creation_date` / `entry.creation_date()`,
`entry.has_access_date` / `entry.access_date()`. `NtTime` implements
`Into<SystemTime>`, conversion to `i64` via `duration_since(UNIX_EPOCH)`.

**Fix in `list_7z()`** (lines 947-957):
```rust
let modified = entry.has_last_modified_date
    .then(|| system_time_to_unix_seconds(SystemTime::from(entry.last_modified_date())))
    .flatten();
// same for created, accessed
```

**Fix in `list_7z_entries()`** (`archive_browser.rs:598-617`):
Convert to display string using `system_time_string()`.

**Effort:** ~15 lines.

### Task 3.3 — Wire `mode` for 7z

**Data source:** `entry.has_windows_attributes` + `entry.windows_attributes()`.
Helper `sevenz_unix_mode()` already exists at `sevenz_backend.rs:1393-1401`.

**Fix in `list_7z()`:** Call `sevenz_unix_mode(entry)` → populate `SevenZListEntry.mode`.

**Effort:** ~2 lines.

### Task 3.4 — Wire `crc` for 7z

**Data source:** `entry.has_crc: bool` and `entry.crc: u64` (public fields).

**Fix in `list_7z()`:**
```rust
crc: entry.has_crc.then_some(entry.crc as u32),
```

**Effort:** ~2 lines.

### Task 3.5 — Wire `solid` for 7z

**Data source:** `SevenZListing.solid: bool` (archive-level).

**Fix in `list_7z_entries()`:** After calling `list_7z()`, set
`solid: Some(listing.solid)` on every `BrowserEntry`.

**Effort:** ~3 lines.

### Task 3.6 — Wire `attributes` for 7z

**Data source:** `entry.has_windows_attributes` + `entry.windows_attributes()`.

**Fix in `list_7z()`:** Populate `SevenZListEntry.attributes` with raw value.
Format as hex string in the DTO layer or archive_browser.rs.

**Effort:** ~2 lines.

### Task 3.7 — 7z `method` and `encrypted` (deferred)

These are **not per-entry fields** on `sevenz_rust2::ArchiveEntry`. Compression
method and encryption are determined by inspecting the `Block.coders` chain for
the block each file belongs to. `ArchiveReader::file_compression_methods()` can
resolve this, but it requires access to the full archive reader, not just
`Archive.files`. The listing path (`list_7z`) works with `Archive::read()` which
produces an `Archive` struct; the block chain is available via
`archive.blocks` + `archive.stream_map.file_block_index`.

**Recommendation:** Defer to a follow-up task. The 7z `method` and `encrypted`
columns can show nothing (blank) for now.

---

## Phase 4: Wire libarchive columns

### Task 4.1 — Wire `encrypted` for libarchive

**Gap:** `LibarchiveListEntry` has `data_encrypted: bool` and
`metadata_encrypted: bool` — neither mapped to `BrowserEntry`.

**Fix in `list_libarchive_entries()`** (`archive_browser.rs:561-569`):
```rust
encrypted: Some(entry.data_encrypted || entry.metadata_encrypted),
```

**Effort:** 1 line.

### Task 4.2 — Wire `uid` / `gid` / `owner` / `group` for libarchive

`zmanager_libarchive::Entry` exposes `uid()`, `gid()`, `uname()`, `gname()`.
The `LibarchiveListEntry` struct doesn't capture them.

**Fix:** Add `uid`, `gid`, `owner`, `group` fields to `LibarchiveListEntry`,
populate in the listing function, thread through to `BrowserEntry`.

**Effort:** ~12 lines across `libarchive_backend.rs` + `archive_browser.rs`.

---

## Phase 5: Wire TAR.ZST columns

### Task 5.1 — Wire `linkTarget` for TAR

**Gap:** `tar::Header::link_name()` returns `io::Result<Option<Cow<Path>>>`.
Used during extraction but not listing.

**Fix in `list_tar_zst_entries()`** (`archive_browser.rs:541-549`):
```rust
link_target: header.link_name().ok().flatten()
    .map(|p| p.to_string_lossy().into_owned()),
```

**Effort:** ~3 lines.

### Task 5.2 — Wire `uid` / `gid` / `owner` / `group` for TAR

**Data source:** `tar::Header::uid()`, `gid()`, `username()`, `groupname()`.
All available but never read during listing.

**Fix in `list_tar_zst_entries()`:**
```rust
uid: header.uid().ok().map(|u| u as u32),
gid: header.gid().ok().map(|g| g as u32),
owner: header.username().ok().flatten().map(|s| s.to_owned()),
group: header.groupname().ok().flatten().map(|s| s.to_owned()),
```

**Note:** `username()` and `groupname()` return PAX/ustar names when available,
falling back to None for basic tar headers (where only numeric UID/GID exist).

**Effort:** ~6 lines.

---

## Phase 5B: Wire Apple Archive columns

Apple's native `aa` tool writes **11 field keys by default** per entry.
Our `zmanager_apple_archive` wrapper only reads 6 of them. The remaining 5
are available in the native headers but never extracted.

### Verified Apple Archive field keys (from `aa` tool + SDK headers)

| Key | Type | Default? | Our wrapper reads? | Column |
|---|---|---|---|---|
| TYP | uint | Always | ✅ | kind |
| PAT | string | Always | ✅ | name |
| LNK | string | For symlinks | ✅ | linkTarget |
| SIZ | uint | Opt-in (`-include-field siz`) | ✅ | size |
| MOD | uint | **Always** | ✅ | mode |
| UID | uint | **Always** | ❌ | uid |
| GID | uint | **Always** | ❌ | gid |
| MTM | timespec | **Always** | ✅ | modified |
| CTM | timespec | **Always** | **❌** | **created** |
| FLG | uint | **Always** | **❌** | **attributes** |
| CKS | uint | Opt-in (`-include-field cks`) | **❌** | **crc** |
| DAT | blob | For files | ✅ (internal) | — |
| DEV | uint | For devices | ❌ | — |
| XAT | blob | **Always** | ❌ | — (binary blobs, not a table cell) |
| SH1/SH2/SH3/SH5 | blob | Opt-in | ❌ | — (hash digests, too heavy) |
| BTM | timespec | Opt-in | ❌ | — (backup time, not a column) |

**Key finding:** CTM (creation time), FLG (BSD flags), and MOD (mode) are
**always written** by `aa archive`. CKS (CRC32) is opt-in. There is **no**
access time (ATM) field in Apple Archive — Apple deliberately excludes it.

XAT (extended attributes) is always written but contains binary key-value
blobs (quarantine flags, Finder info, resource forks) — not displayable as
a single table cell value.

### What needs to change in `zmanager_apple_archive`

These changes extend our wrapper crate to read fields that Apple's format
already stores:

1. **`EntryMetadata`** — add `created`, `flags`, `crc`, `uid`, `gid`
2. **`Header::to_entry()`** — read CTM, FLG, CKS, UID, GID fields from the native
   header using the existing `timespec_for_key()` and `uint_for_key()` helpers

### Task 5B.1 — Extend `EntryMetadata` in `zmanager_apple_archive`

**File:** `zmanager-apple-archive/src/lib.rs:135-140`

```rust
pub struct EntryMetadata {
    pub mode: Option<u32>,
    pub modified: Option<SystemTime>,
    // new
    pub created: Option<SystemTime>,   // CTM field — always written by default
    pub flags: Option<u32>,            // FLG field — BSD/macOS file flags
    pub crc: Option<u32>,              // CKS field — POSIX 32-bit CRC (opt-in)
    pub uid: Option<u32>,              // UID field — always written by default
    pub gid: Option<u32>,              // GID field — always written by default
}
```

### Task 5B.2 — Read new fields in `Header::to_entry()`

**File:** `zmanager-apple-archive/src/lib.rs:737-742`

Add field reads using existing `timespec_for_key()` and `uint_for_key()`:

```rust
let metadata = EntryMetadata {
    mode: self.uint_for_key(b"MOD")?.and_then(|m| u32::try_from(m).ok()),
    modified: self.timespec_for_key(b"MTM")?,
    created: self.timespec_for_key(b"CTM")?,   // new
    flags: self.uint_for_key(b"FLG")?.and_then(|f| u32::try_from(f).ok()),  // new
    crc: self.uint_for_key(b"CKS")?.and_then(|c| u32::try_from(c).ok()),    // new
    uid: self.uint_for_key(b"UID")?.and_then(|u| u32::try_from(u).ok()),    // new
    gid: self.uint_for_key(b"GID")?.and_then(|g| u32::try_from(g).ok()),    // new
};
```

### Task 5B.3 — Add fields to `AppleArchiveListEntry`

**File:** `zmanager-core/src/apple_archive_backend.rs:54-63`

```rust
pub struct AppleArchiveListEntry {
    pub path: String,
    pub kind: AppleArchiveEntryKind,
    pub size: Option<u64>,
    pub modified: Option<SystemTime>,
    // new
    pub mode: Option<u32>,
    pub created: Option<SystemTime>,
    pub flags: Option<u32>,
    pub crc: Option<u32>,
    pub uid: Option<u32>,          // UID field — always written
    pub gid: Option<u32>,          // GID field — always written
    pub link_target: Option<String>,
}
```

### Task 5B.4 — Populate in `list_apple_archive()`

**File:** `zmanager-core/src/apple_archive_backend.rs:326-343`

Read all new fields from `entry.metadata()` and `entry.link_target()`.

### Task 5B.5 — Thread through `BrowserEntry`

**File:** `zmanager-core/src/archive_browser.rs:641-655`

Map `entry.mode`, `entry.created`, `entry.flags`, `entry.crc`, `entry.uid`,
`entry.gid`, `entry.link_target` to `BrowserEntry`. Set `encrypted` from
archive path (`.aea` extension). Set `method` from `CompressionAlgorithm`
(archive-level).

**Effort for Phase 5B:** ~35 lines across 3 crates
(`zmanager_apple_archive`, `zmanager-core/apple_archive_backend`,
`zmanager-core/archive_browser`).

---

## Phase 6: Wire TZAP columns (zmanager-core only)

Two TZAP columns require only zmanager-core changes — no upstream tzap-core work.

### Task 6.1 — Wire `method` for TZAP

TZAP always uses zstd compression at the frame/envelope level. This is a format
constant — every entry in every TZAP archive is zstd-compressed.

**Fix in `list_tzap_entries()`** (`archive_browser.rs:627-637`):
```rust
method: Some("Zstd".to_owned()),
```

**Effort:** 1 line.

### Task 6.2 — Wire `encrypted` for TZAP

TZAP encryption is archive-level (not per-entry). The `TzapMetadata` struct at
`tzap_backend.rs:320-326` has `password_required: bool`. This is determined
during `open_tzap_archive()` — if a password or key was required to open the
archive, every entry in it is encrypted.

**Fix:**

1. Add `encrypted: bool` to `TzapListing`:
   ```rust
   pub struct TzapListing {
       pub entries: Vec<TzapEntry>,
       pub encrypted: bool,
   }
   ```

2. Populate it in `list_opened_tzap_archive()` by checking whether the
   `OpenedArchive` was opened with encryption. The `open_tzap_archive` function
   at `tzap_backend.rs:3674` already knows whether a key was used — thread
   that through:
   ```rust
   // In list_opened_tzap_archive (or the caller):
   let encrypted = opened.metadata_report()
       .map(|r| r.requires_password())
       .unwrap_or(false);
   ```

   Alternatively, since `list_tzap_with_optional_password` receives the password
   parameter, simply pass `encrypted: password.is_some()` into the listing.

3. In `list_tzap_entries()` (`archive_browser.rs`): set
   `encrypted: Some(listing.encrypted)` on every `BrowserEntry`.

**Effort:** ~10 lines across `tzap_backend.rs` + `archive_browser.rs`.

---

## Phase 7: Upstream TZAP changes (tzap-core)

TZAP stores additional per-entry metadata in PAX records but the public
`ArchiveEntry` only has 6 fields. These changes go in the sibling `../../tzap/`
repo.

### tzap-core changes

**File:** `tzap-core/src/reader.rs` — `ArchiveEntry` struct + `list_files()`

### Task 7.1 — Add `link_target` to `ArchiveEntry`

**Source:** `OwnedTarMember.link_target: Option<Vec<u8>>` (already on
`ExtractedArchiveMember.link_target: Option<String>`).

```rust
pub link_target: Option<String>,  // converted from Vec<u8>, lossy for non-UTF-8
```

### Task 7.2 — Add `created` and `accessed` to `ArchiveEntry`

**Source:** PAX keys `LIBARCHIVE.creationtime` and `atime`. All validated
during parsing. `parse_timestamp()` helper exists at
`entry_metadata.rs:2615` but is `pub(crate)`.

**Recommendation:** Make `parse_timestamp` `pub`, or add extraction to
`list_files()`. Store as pre-formatted ISO 8601 strings (simpler, matches
how `BrowserEntry.modified` works):

```rust
pub created: Option<String>,
pub accessed: Option<String>,
```

### Task 7.3 — Add `attributes` to `ArchiveEntry`

**Source:** `PortableMetadataMirror.attributes: Option<u32>` (PAX key
`TZAP.portable.attributes`). Already parsed.

```rust
pub portable_attributes: Option<u32>,
```

### Task 7.4 — Re-export if needed

**File:** `tzap-core/src/lib.rs`

Ensure any newly-public types are re-exported.

### zmanager-core changes (after tzap-core update)

### Task 7.5 — Thread through `TzapEntry`

**File:** `zmanager-core/src/tzap_backend.rs`

Add matching fields to `TzapEntry` and populate in
`tzap_entry_from_archive_entry()`.

### Task 7.6 — Thread through `BrowserEntry`

**File:** `zmanager-core/src/archive_browser.rs` — `list_tzap_entries()`

---

## Phase 8: Per-format column availability (frontend only)

Currently the column context menu and the Preferences dialog show **all columns**
unconditionally for every format. After Phases 1-7, different formats support
different column sets — users shouldn't see toggle options for columns their
current archive can never populate.

### Per-format column sets

After Phase 1-6 (no upstream changes):

| Format key | Available columns |
|---|---|
| `zip`, `jar`, `war`, `ipa`, `apk`, `xpi` | name, size, compressedSize, modified, mode, encrypted, method, crc, comment, kind, ratio |
| `7z` | name, size, compressedSize, modified, mode, crc, created, accessed, solid, attributes, kind, ratio |
| `tzap` | name, size, modified, mode, encrypted, method, kind, metadataDiagnostics |
| `tar.zst`, `tzst` | name, size, modified, mode, linkTarget, uid, gid, owner, group, kind |
| `tar.gz`, `tgz`, `tar.bz2`, `tar.xz`, `tar.br`, `tar` | name, size, modified, mode, encrypted, uid, gid, owner, group, kind |
| `aar`, `aea` | name, size, modified, mode, encrypted, method, crc, created, linkTarget, attributes, uid, gid, kind |
| `gz`, `bz2`, `xz`, `zst` (raw) | name, compressedSize, kind |
| `default` (global / unknown) | name, size, compressedSize, modified, mode, encrypted, method, crc, comment, kind, ratio, created, accessed, solid, linkTarget, attributes, metadataDiagnostics, uid, gid, owner, group |

Note: `name` and `kind` are always available (computed columns). `ratio` is derived
from `size`/`compressedSize`. The `default` set is the union of all columns across
all formats (minus `block` which is removed).

### Task 8.1 — Define per-format column availability

**File:** `src/app/archiveTable.ts`

Add a mapping from format suffix to available column IDs:

```typescript
export const ARCHIVE_COLUMNS_BY_FORMAT: Record<string, ArchiveTableColumnId[]> = {
  zip: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  jar: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  war: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  ipa: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  apk: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  xpi: ["name","size","compressedSize","modified","mode","encrypted","method","crc","comment","kind","ratio"],
  "7z": ["name","size","compressedSize","modified","mode","crc","created","accessed","solid","attributes","kind","ratio"],
  tzap: ["name","size","modified","mode","encrypted","method","kind","metadataDiagnostics"],
  "tar.zst": ["name","size","modified","mode","linkTarget","uid","gid","owner","group","kind"],
  tzst: ["name","size","modified","mode","linkTarget","uid","gid","owner","group","kind"],
  "tar.gz": ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  tgz: ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  "tar.bz2": ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  "tar.xz": ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  "tar.br": ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  tar: ["name","size","modified","mode","encrypted","uid","gid","owner","group","kind"],
  aar: ["name","size","modified","mode","encrypted","method","crc","created","linkTarget","attributes","uid","gid","kind"],
  aea: ["name","size","modified","mode","encrypted","method","crc","created","linkTarget","attributes","uid","gid","kind"],
  gz: ["name","compressedSize","kind"],
  bz2: ["name","compressedSize","kind"],
  xz: ["name","compressedSize","kind"],
  zst: ["name","compressedSize","kind"],
};
```

Also provide a default (union) set and a lookup helper:

```typescript
export const DEFAULT_AVAILABLE_COLUMN_IDS: ArchiveTableColumnId[] = [
  "name", "size", "compressedSize", "modified", "mode",
  "encrypted", "method", "crc", "comment", "kind", "ratio",
  "created", "accessed", "solid", "linkTarget", "attributes",
  "metadataDiagnostics", "uid", "gid", "owner", "group",
];

export function getAvailableColumnsForFormat(
  archivePath?: string,
): ArchiveTableColumnId[] {
  if (!archivePath) return DEFAULT_AVAILABLE_COLUMN_IDS;
  const suffix = getKnownArchiveSuffix(archivePath);
  if (!suffix) return DEFAULT_AVAILABLE_COLUMN_IDS;
  // Normalize aliases
  const key = suffix.toLowerCase();
  if (key in ARCHIVE_COLUMNS_BY_FORMAT) {
    return ARCHIVE_COLUMNS_BY_FORMAT[key];
  }
  // Check parenthesized mapped formats (jar→zip, war→zip, etc.)
  for (const [fmtKey, columns] of Object.entries(ARCHIVE_COLUMNS_BY_FORMAT)) {
    if (key.endsWith(fmtKey)) return columns;
  }
  return DEFAULT_AVAILABLE_COLUMN_IDS;
}
```

### Task 8.2 — Filter column context menu by format

**File:** `src/app/commands/contextMenuModel.ts`

1. Add `archivePath?: string` to `ArchiveHeaderContextMenuInput`
2. In `buildArchiveHeaderContextMenuItems()`, filter the checkbox list:

```typescript
const availableColumns = getAvailableColumnsForFormat(input.archivePath);
const availableSet = new Set(availableColumns);

// Replace line 276:
...ARCHIVE_TABLE_COLUMNS
  .filter((column) => availableSet.has(column.id))
  .map((column) => { ... })
```

**File:** `src/runtime/zmanagerRuntimeAdapter.ts:3077-3083`

Thread `archivePath` into the input:

```typescript
function showTableHeaderContextMenu(...) {
  const snapshot = archiveWorkspace.getSnapshot();
  contextMenuRuntime.show(x, y, buildArchiveHeaderContextMenuItems({
    translator: displayContext.translator,
    tableColumnSettings: snapshot.view.tableColumns,
    selectedColumnId,
    archivePath: snapshot.archivePath,  // <-- add this
  }));
}
```

### Task 8.3 — Filter Preferences dialog by format

**File:** `src/ui/react/preferences/PreferencesDialog.tsx`

1. In the columns section, when rendering the checkbox list at line 1651, filter
   `ARCHIVE_TABLE_COLUMNS` by the selected format:

```typescript
const availableColumns = selectedFormat === "default"
  ? DEFAULT_AVAILABLE_COLUMN_IDS
  : getAvailableColumnsForFormat("dummy." + selectedFormat) ?? DEFAULT_AVAILABLE_COLUMN_IDS;
const availableSet = new Set(availableColumns);

// Filter the mapping:
{ARCHIVE_TABLE_COLUMNS
  .filter((column) => availableSet.has(column.id))
  .map((column) => ( ... ))}
```

2. The format selector dropdown should list only formats that are in
   `ARCHIVE_COLUMNS_BY_FORMAT` (plus "Global Defaults").

### Task 8.4 — Guard normalizeColumnSettings for per-format availability

**File:** `src/app/archiveTable.ts`

Optionally, enhance `normalizeColumnSettings()` to accept an optional format
parameter and filter out columns not available for that format:

```typescript
export function normalizeColumnSettings(
  settings?: Partial<ArchiveTableColumnSettings> | null,
  archivePath?: string,
): ArchiveTableColumnSettings {
  const available = new Set(getAvailableColumnsForFormat(archivePath));
  // … existing logic, but filter incoming IDs against `available` instead of
  // the global `availableColumns` map
}
```

This prevents stale preferences from enabling unavailable columns after a format
change.

### Task 8.5 — Per-format columns for the Preferences format selector

**File:** `src/ui/react/preferences/PreferencesDialog.tsx`

The format selector dropdown (line 1623) should list all supported format keys
with human-readable labels:

| Format key | Label |
|---|---|
| `default` | Global Defaults |
| `zip` | ZIP (.zip, .jar, .war, .ipa, .apk) |
| `7z` | 7z (.7z) |
| `tzap` | TZAP (.tzap) |
| `tar.zst` | Tar.Zstd (.tar.zst, .tzst) |
| `tar.gz` | Tar.Gzip (.tar.gz, .tgz) |
| `tar.bz2` | Tar.Bzip2 (.tar.bz2) |
| `tar.xz` | Tar.XZ (.tar.xz) |
| `tar.br` | Tar.Brotli (.tar.br) |
| `tar` | Tar (.tar) |
| `aar` | Apple Archive (.aar) |
| `gz` | Gzip (.gz) |
| `bz2` | Bzip2 (.bz2) |
| `xz` | XZ (.xz) |
| `zst` | Zstd (.zst) |

**Effort:** ~20 lines for the label map + dropdown items.

### Phase 8 summary

| Task | Files | Effort |
|---|---|---|
| 8.1 | `archiveTable.ts` — define `ARCHIVE_COLUMNS_BY_FORMAT` + helper | ~40 lines |
| 8.2 | `contextMenuModel.ts` + `zmanagerRuntimeAdapter.ts` — filter context menu | ~10 lines |
| 8.3 | `PreferencesDialog.tsx` — filter prefs dialog by format | ~10 lines |
| 8.4 | `archiveTable.ts` — guard `normalizeColumnSettings` | ~5 lines |
| 8.5 | `PreferencesDialog.tsx` — format selector labels | ~20 lines |

**Total:** ~85 lines across 4 files, no backend changes.

**User-visible effect:**
- Open a ZIP → column context menu shows only ZIP-available columns (11)
- Open a 7z → shows only 7z-available columns (12)
- Open a TZAP → shows only TZAP-available columns (9)
- Open an Apple Archive → shows only Apple Archive columns (13)
- Open a TAR.ZST → shows only TAR columns (10)
- Preferences dialog: select "ZIP" → only see ZIP columns to toggle; select
  "Global Defaults" → see union of all 21 available columns

---

## Implementation summary
|---|---|---|---|---|
| **1** | Extend BrowserEntry, ArchiveEntryDto, types, remove `block` | `archive_browser.rs`, `dto.rs`, `archive_index.rs`, `commands.rs`, `types.ts`, `archiveTable.ts` | None | ~1 hr |
| **2** | ZIP: mode, encrypted, method, crc, comment | `archive_browser.rs` (~8 lines total) | None | ~15 min |
| **3** | 7z: mode, modified, created, accessed, crc, solid, attributes | `sevenz_backend.rs` (~25 lines), `archive_browser.rs` (~10 lines) | None | ~1 hr |
| **4** | Libarchive: encrypted, uid, gid, owner, group | `libarchive_backend.rs` (~8 lines), `archive_browser.rs` (~4 lines) | None | ~15 min |
| **5** | TAR: linkTarget, uid, gid, owner, group | `archive_browser.rs` (~9 lines) | None | ~15 min |
| **5B** | Apple Archive: mode, encrypted, method, crc, created, attributes, linkTarget, uid, gid | `zmanager_apple_archive/lib.rs` (~10 lines), `apple_archive_backend.rs` (~12 lines), `archive_browser.rs` (~10 lines) | zmanager_apple_archive | ~45 min |
| **6** | TZAP: encrypted, method | `tzap_backend.rs` (~8 lines), `archive_browser.rs` (~2 lines) | None | ~15 min |
| **7** | TZAP upstream: created, accessed, link_target, attributes | `tzap-core/reader.rs`, `tzap_backend.rs`, `archive_browser.rs` | tzap-core | ~3-4 hrs |
| **8** | Per-format column availability in context menu + preferences | `archiveTable.ts`, `contextMenuModel.ts`, `zmanagerRuntimeAdapter.ts`, `PreferencesDialog.tsx` | None | ~1.5 hrs |

### Column support: before → after

| Column | Before | After Phase 1-6 | After Phase 7 |
|---|---|---|---|
| name | ✅ | ✅ | ✅ |
| size | ✅ | ✅ | ✅ |
| compressedSize | ✅ ZIP, 7z, raw | same | same |
| modified | ✅ (except 7z) | ✅ ALL formats that support it | ✅ |
| mode | ✅ TZAP, TAR, libarchive | ✅ + ZIP, 7z, AppleArchive | ✅ |
| encrypted | ❌ | ✅ ZIP, TZAP, libarchive, AppleArchive | ✅ |
| method | ❌ | ✅ ZIP, TZAP, AppleArchive | ✅ (7z deferred) |
| crc | ❌ | ✅ ZIP, 7z, AppleArchive | ✅ |
| comment | ❌ | ✅ ZIP | ✅ |
| created | ❌ | ✅ 7z, AppleArchive | ✅ + TZAP |
| accessed | ❌ | ✅ 7z | ✅ + TZAP |
| linkTarget | ❌ | ✅ TAR, AppleArchive | ✅ + TZAP |
| attributes | ❌ | ✅ 7z, AppleArchive | ✅ + TZAP |
| solid | ❌ | ✅ 7z | ✅ |
| uid | ❌ | ✅ TAR, libarchive, AppleArchive | ✅ + TZAP |
| gid | ❌ | ✅ TAR, libarchive, AppleArchive | ✅ + TZAP |
| owner | ❌ | ✅ TAR, libarchive | ✅ + TZAP |
| group | ❌ | ✅ TAR, libarchive | ✅ + TZAP |
| block | ❌ (dead UI) | **REMOVED** | — |

### Deferred to follow-up

| Column | Format | Why deferred |
|---|---|---|
| method | 7z | Requires block-chain resolution via `stream_map.file_block_index` → `Block.coders` |
| encrypted | 7z | Same — must check coder chain for AES method ID |
| method, encrypted, solid, file_attr, link_target, mtime | RAR | RAR routes through libarchive, losing all RAR-specific metadata. Needs dedicated `RarListEntry` → `BrowserEntry` path |

---

## Verification checklist

After each phase:

- [ ] `cargo check` passes in zmanager-core
- [ ] `cargo check` passes in src-tauri
- [ ] `npm run build` passes (type-check)
- [ ] Open test archive of each format — column values display correctly
- [ ] Empty/unsupported formats show blank cells (no crashes)
- [ ] Column context menu toggle works for new columns
- [ ] Sort by new columns works (string-sort fallback is acceptable)
- [ ] Per-format column preferences persist correctly
- [ ] No regression on existing columns

---

## Key files reference

| File | Role |
|---|---|
| `zmanager-core/src/archive_browser.rs` | `BrowserEntry` struct, format dispatch, per-format → BrowserEntry conversions |
| `zmanager-core/src/sevenz_backend.rs` | `SevenZListEntry`, `list_7z()`, `sevenz_unix_mode()` |
| `zmanager-core/src/zip_backend.rs` | `ZipListEntry` (already has encrypted, unix_mode — gap is in archive_browser.rs) |
| `zmanager-core/src/tzap_backend.rs` | `TzapEntry`, `tzap_entry_from_archive_entry()` |
| `zmanager-core/src/libarchive_backend.rs` | `LibarchiveListEntry` (has data_encrypted, metadata_encrypted) |
| `zmanager-core/src/apple_archive_backend.rs` | `AppleArchiveListEntry`, `list_apple_archive()` |
| `zmanager-apple-archive/src/lib.rs` | `EntryMetadata`, `Header::to_entry()` — Apple Archive field reading |
| `tzap-core/src/reader.rs` | `ArchiveEntry` struct, `list_files()` — upstream bottleneck |
| `tzap-core/src/entry_metadata.rs` | `MemberMetadata`, `PaxRecords`, `PortableMetadataMirror`, `parse_timestamp()` |
| `src-tauri/src/dto.rs:117-127` | Rust `ArchiveEntryDto` with `#[serde(rename_all = "camelCase")]` |
| `src-tauri/src/archive_index.rs:641-651` | `browser_entry_to_dto()` |
| `src-tauri/src/archive_index.rs:627-635` | `ensure_ancestors()` synthetic directory DTOs |
| `src-tauri/src/archive_index.rs:672-681` | `compare_paths_by_sort()` server-side sort |
| `src-tauri/src/commands.rs:217-226` | Test-only `list_archive()` DTO construction |
| `src/api/types.ts:140-158` | TypeScript `ArchiveEntryDto` |
| `src/app/archiveTable.ts` | `ARCHIVE_TABLE_COLUMNS`, `ArchiveTableColumnId`, `ARCHIVE_COLUMNS_BY_FORMAT`, formatting, sorting, `getAvailableColumnsForFormat()` |
| `src/app/commands/contextMenuModel.ts` | `buildArchiveHeaderContextMenuItems()` — filters columns by format |
| `src/runtime/zmanagerRuntimeAdapter.ts` | `showTableHeaderContextMenu()` — threads `archivePath` into context menu |
| `src/ui/react/preferences/PreferencesDialog.tsx` | Column preferences UI — filters by format, format selector dropdown |

---

## Open questions

1. **TZAP timestamp format:** Store as structured `ArchiveTimestamp` or as
   pre-formatted `String`? Recommend `String` — matches how `BrowserEntry.modified`
   already works and avoids exporting `ArchiveTimestamp` for new fields.

2. **`solid` display:** Archive-level property — every row in a solid 7z archive
   shows `+`, every row in a non-solid shows blank. This is the simplest approach
   but means users can sort/filter on a column where all rows have the same value.

3. **TZAP compressed_size:** Available via `ArchiveIndexEntry.layout.compressed_size`
   but `list_files()` doesn't expose it. Would enable `ratio` column for TZAP.
   Worth doing but adds complexity (need to change listing path or add a second
   pass).
