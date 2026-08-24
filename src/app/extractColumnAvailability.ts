import type { ArchiveFormatFamily } from "./archiveFormatFamily";
import type { ExtractTableColumnId } from "./tableColumnCatalogue";
import { EXTRACT_APPLICABLE_IDS } from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// Audited Extract column availability per canonical format family.
//
// Each entry lists every ExtractTableColumnId the active backend can populate
// or compute from populated values for that family.
//
// Name and kind are always available (omitted for brevity — the resolver adds
// them unconditionally).
//
// Audit basis: docs/COLUMN_SUPPORT_MATRIX.md (final implemented matrix),
// ARCHIVE_COLUMNS_BY_FORMAT in archiveTable.ts, and actual ArchiveEntryDto
// field mapping verified in the prior implementation.
// ---------------------------------------------------------------------------

const EXTRACT_AVAILABILITY: Readonly<Record<ArchiveFormatFamily, readonly ExtractTableColumnId[]>> = {
  zip: [
    "size", "compressedSize", "modified", "mode",
    "encrypted", "method", "crc", "comment", "ratio",
  ],

  sevenZ: [
    "size", "compressedSize", "modified", "mode",
    "crc", "created", "accessed", "solid", "attributes", "ratio",
  ],

  tzap: [
    "size", "modified", "mode",
    "encrypted", "method", "solid", "metadataDiagnostics",
    "linkTarget", "created", "accessed", "attributes",
    "uid", "gid", "owner", "group",
  ],

  tarZstd: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarGzip: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarBzip2: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarXz: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarBrotli: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarLzip: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarLz4: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarLzma: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarLzo: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarLrzip: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tarCompressZ: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  tar: [
    "size", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group",
  ],

  appleArchive: [
    "size", "modified", "mode",
    "encrypted", "method", "crc", "created",
    "linkTarget", "attributes", "uid", "gid",
    // Note: Apple Archive stores numeric uid/gid but NOT owner/group names
  ],

  gzipStream: [
    "compressedSize",
  ],

  bzip2Stream: [
    "compressedSize",
  ],

  xzStream: [
    "compressedSize",
  ],

  zstdStream: [
    "compressedSize",
  ],

  brotliStream: [
    "compressedSize",
  ],

  lzipStream: [
    "compressedSize",
  ],

  lz4Stream: [
    "compressedSize",
  ],

  lzmaStream: [
    "compressedSize",
  ],

  lzoStream: [
    "compressedSize",
  ],

  lrzipStream: [
    "compressedSize",
  ],

  compressZStream: [
    "compressedSize",
  ],

  // These families have limited backend support; availability reflects current capability
  rar: [
    "size", "modified",
  ],

  cab: [
    "size", "modified",
  ],

  cpio: [
    "size", "modified", "mode",
    "uid", "gid",
  ],

  deb: [
    "size", "modified",
  ],

  iso: [
    "size", "modified",
  ],

  rpm: [
    "size", "modified",
  ],

  xar: [
    "size", "modified",
  ],

  lha: [
    "size", "modified",
  ],

  ar: [
    "size", "modified",
  ],

  warc: [
    "size", "modified",
  ],

  mtree: [
    "size", "modified",
  ],

  msi: [
    "size", "modified",
  ],

  vhd: [
    "size", "modified",
  ],

  vmdk: [
    "size", "modified",
  ],

  udf: [
    "size", "modified",
  ],

  dmg: [
    "size", "modified",
  ],

  pkg: [
    "size", "modified",
  ],
};

// ---------------------------------------------------------------------------
// Conservative availability for unrecognized paths
// ---------------------------------------------------------------------------

const UNKNOWN_AVAILABILITY: readonly ExtractTableColumnId[] = ["name", "kind"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the audited set of Extract-applicable columns available for a given
 * format family. Name and kind are always present (added unconditionally).
 */
export function getExtractAvailableColumns(
  family: ArchiveFormatFamily,
): readonly ExtractTableColumnId[] {
  const familyColumns = EXTRACT_AVAILABILITY[family] ?? [];
  const result: ExtractTableColumnId[] = ["name", "kind"];
  for (const id of familyColumns) {
    if (id !== "name" && id !== "kind") {
      result.push(id);
    }
  }
  return result;
}

/**
 * Get the conservative availability set for unknown/unrecognized formats.
 */
export function getUnknownExtractAvailableColumns(): readonly ExtractTableColumnId[] {
  return UNKNOWN_AVAILABILITY;
}

/**
 * Get the full set of Extract-applicable columns (union across all families).
 */
export function getAllExtractColumnIds(): readonly ExtractTableColumnId[] {
  return EXTRACT_APPLICABLE_IDS;
}
