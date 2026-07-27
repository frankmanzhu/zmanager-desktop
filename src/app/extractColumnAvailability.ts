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
    "size", "compressedSize", "modified", "mode",
    "encrypted", "method", "solid", "ratio", "metadataDiagnostics",
    "linkTarget", "created", "accessed", "attributes",
    "uid", "gid", "owner", "group",
  ],

  tarZstd: [
    "size", "compressedSize", "modified", "mode",
    "linkTarget", "uid", "gid", "owner", "group", "ratio",
  ],

  tarGzip: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarBzip2: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarXz: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarBrotli: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarLzip: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarLz4: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarLzma: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarLzo: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarLrzip: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tarCompressZ: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  tar: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "owner", "group", "ratio",
  ],

  appleArchive: [
    "size", "compressedSize", "modified", "mode",
    "encrypted", "method", "crc", "created",
    "linkTarget", "attributes", "uid", "gid", "ratio",
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
    "size", "compressedSize", "modified", "ratio",
  ],

  cab: [
    "size", "compressedSize", "modified", "ratio",
  ],

  cpio: [
    "size", "compressedSize", "modified", "mode",
    "uid", "gid", "ratio",
  ],

  deb: [
    "size", "compressedSize", "modified", "ratio",
  ],

  iso: [
    "size", "modified",
  ],

  rpm: [
    "size", "compressedSize", "modified", "ratio",
  ],

  xar: [
    "size", "compressedSize", "modified", "ratio",
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
