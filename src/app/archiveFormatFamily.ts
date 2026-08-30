import { getKnownArchiveSuffix } from "./archiveFileTypes";

// ---------------------------------------------------------------------------
// Canonical archive format families
// ---------------------------------------------------------------------------

export type ArchiveFormatFamily =
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
  | "xar"
  | "lha"
  | "ar"
  | "warc"
  | "mtree"
  | "msi"
  | "vhd"
  | "vmdk"
  | "udf"
  | "dmg"
  | "pkg"
  | "genericPackage";

export const ALL_ARCHIVE_FORMAT_FAMILIES: readonly ArchiveFormatFamily[] = [
  "zip",
  "sevenZ",
  "tzap",
  "tarZstd",
  "tarGzip",
  "tarBzip2",
  "tarXz",
  "tarBrotli",
  "tarLzip",
  "tarLz4",
  "tarLzma",
  "tarLzo",
  "tarLrzip",
  "tarCompressZ",
  "tar",
  "appleArchive",
  "gzipStream",
  "bzip2Stream",
  "xzStream",
  "zstdStream",
  "brotliStream",
  "lzipStream",
  "lz4Stream",
  "lzmaStream",
  "lzoStream",
  "lrzipStream",
  "compressZStream",
  "rar",
  "cab",
  "cpio",
  "deb",
  "iso",
  "rpm",
  "xar",
  "lha",
  "ar",
  "warc",
  "mtree",
  "msi",
  "vhd",
  "vmdk",
  "udf",
  "dmg",
  "pkg",
  "genericPackage",
];

// ---------------------------------------------------------------------------
// Resolution result
// ---------------------------------------------------------------------------

export type ArchiveFormatFamilyResolution =
  | Readonly<{ kind: "known"; family: ArchiveFormatFamily }>
  | Readonly<{ kind: "unknown" }>;

// ---------------------------------------------------------------------------
// Family alias registry
//
// Physical suffix → canonical family mapping. Order matters: compound suffixes
// are checked first (longest-match wins). Case-insensitive matching.
// ---------------------------------------------------------------------------

type FamilyEntry = Readonly<{
  family: ArchiveFormatFamily;
  /** Physical suffixes that map to this family, longest first */
  physicalSuffixes: readonly string[];
  /** Display label key for the format selector */
  displayLabelKey: string;
}>;

const FAMILY_REGISTRY: readonly FamilyEntry[] = [
  // -- Compound tar families (must precede raw stream families) --
  {
    family: "tarZstd",
    physicalSuffixes: [".tar.zst", ".tzst"],
    displayLabelKey: "format.family.tarZstd",
  },
  {
    family: "tarGzip",
    physicalSuffixes: [".tar.gz", ".tgz"],
    displayLabelKey: "format.family.tarGzip",
  },
  {
    family: "tarBzip2",
    physicalSuffixes: [".tar.bz2", ".tbz2", ".tbz"],
    displayLabelKey: "format.family.tarBzip2",
  },
  {
    family: "tarXz",
    physicalSuffixes: [".tar.xz", ".txz"],
    displayLabelKey: "format.family.tarXz",
  },
  {
    family: "tarBrotli",
    physicalSuffixes: [".tar.br"],
    displayLabelKey: "format.family.tarBrotli",
  },
  {
    family: "tarLzip",
    physicalSuffixes: [".tar.lz"],
    displayLabelKey: "format.family.tarLzip",
  },
  {
    family: "tarLz4",
    physicalSuffixes: [".tar.lz4"],
    displayLabelKey: "format.family.tarLz4",
  },
  {
    family: "tarLzma",
    physicalSuffixes: [".tar.lzma", ".tlzma"],
    displayLabelKey: "format.family.tarLzma",
  },
  {
    family: "tarLzo",
    physicalSuffixes: [".tar.lzo"],
    displayLabelKey: "format.family.tarLzo",
  },
  {
    family: "tarLrzip",
    physicalSuffixes: [".tar.lrz"],
    displayLabelKey: "format.family.tarLrzip",
  },
  {
    family: "tarCompressZ",
    physicalSuffixes: [".tar.z", ".taz"],
    displayLabelKey: "format.family.tarCompressZ",
  },
  {
    family: "tar",
    physicalSuffixes: [".tar", ".cbt", ".pax", ".ustar", ".tar.uu", ".tar.b64"],
    displayLabelKey: "format.family.tar",
  },
  // -- Compound & standard CPIO (must precede raw streams) --
  {
    family: "cpio",
    physicalSuffixes: [".cpio", ".cpio.gz", ".cpgz", ".cpio.bz2", ".cpio.xz", ".cpio.lzma", ".cpio.zst"],
    displayLabelKey: "format.family.cpio",
  },
  // -- Container / multi-file formats --
  {
    family: "zip",
    physicalSuffixes: [".zip", ".zipx", ".jar", ".war", ".ipa", ".apk", ".appx", ".xpi", ".cbz", ".epub"],
    displayLabelKey: "format.family.zip",
  },
  {
    family: "sevenZ",
    physicalSuffixes: [".7z", ".cb7", ".sevenz"], // split .7z.001 matched separately below
    displayLabelKey: "format.family.sevenZ",
  },
  {
    family: "tzap",
    physicalSuffixes: [".tzap"], // split .vol000.tzap matched separately below
    displayLabelKey: "format.family.tzap",
  },
  {
    family: "appleArchive",
    physicalSuffixes: [".aar", ".aea"],
    displayLabelKey: "format.family.appleArchive",
  },
  {
    family: "rar",
    physicalSuffixes: [".rar", ".cbr"],
    displayLabelKey: "format.family.rar",
  },
  {
    family: "cab",
    physicalSuffixes: [".cab"],
    displayLabelKey: "format.family.cab",
  },
  {
    family: "deb",
    physicalSuffixes: [".deb"],
    displayLabelKey: "format.family.deb",
  },
  {
    family: "iso",
    physicalSuffixes: [".iso"],
    displayLabelKey: "format.family.iso",
  },
  {
    family: "rpm",
    physicalSuffixes: [".rpm"],
    displayLabelKey: "format.family.rpm",
  },
  {
    family: "xar",
    physicalSuffixes: [".xar"],
    displayLabelKey: "format.family.xar",
  },
  {
    family: "lha",
    physicalSuffixes: [".lha", ".lzh"],
    displayLabelKey: "format.family.lha",
  },
  {
    family: "ar",
    physicalSuffixes: [".a", ".ar", ".lib"],
    displayLabelKey: "format.family.ar",
  },
  {
    family: "warc",
    physicalSuffixes: [".warc"],
    displayLabelKey: "format.family.warc",
  },
  {
    family: "mtree",
    physicalSuffixes: [".mtree"],
    displayLabelKey: "format.family.mtree",
  },
  {
    family: "msi",
    physicalSuffixes: [".msi"],
    displayLabelKey: "format.family.msi",
  },
  {
    family: "vhd",
    physicalSuffixes: [".vhd"],
    displayLabelKey: "format.family.vhd",
  },
  {
    family: "vmdk",
    physicalSuffixes: [".vmdk"],
    displayLabelKey: "format.family.vmdk",
  },
  {
    family: "udf",
    physicalSuffixes: [".udf"],
    displayLabelKey: "format.family.udf",
  },
  {
    family: "dmg",
    physicalSuffixes: [".dmg"],
    displayLabelKey: "format.family.dmg",
  },
  {
    family: "pkg",
    physicalSuffixes: [".pkg"],
    displayLabelKey: "format.family.pkg",
  },
  {
    // Formats exposed by the core as generic package/disk containers share
    // the same conservative Extract metadata surface until a format-specific
    // column contract exists.
    family: "genericPackage",
    physicalSuffixes: [
      ".appimage", ".squashfs", ".sqfs", ".ccd", ".cdi", ".cue",
      ".ad1", ".aff4", ".dar", ".dd", ".e01", ".ex01", ".img", ".isz",
      ".mdf", ".mds", ".nrg", ".qcow", ".qcow2", ".raw", ".swm", ".vdi",
      ".vhdx", ".wim", ".dsk",
    ],
    displayLabelKey: "format.family.genericPackage",
  },
  // -- Raw stream formats (must follow compound families) --
  {
    family: "gzipStream",
    physicalSuffixes: [".gz"],
    displayLabelKey: "format.family.gzipStream",
  },
  {
    family: "bzip2Stream",
    physicalSuffixes: [".bz2"],
    displayLabelKey: "format.family.bzip2Stream",
  },
  {
    family: "xzStream",
    physicalSuffixes: [".xz"],
    displayLabelKey: "format.family.xzStream",
  },
  {
    family: "zstdStream",
    physicalSuffixes: [".zst"],
    displayLabelKey: "format.family.zstdStream",
  },
  {
    family: "brotliStream",
    physicalSuffixes: [".br"],
    displayLabelKey: "format.family.brotliStream",
  },
  {
    family: "lzipStream",
    physicalSuffixes: [".lz"],
    displayLabelKey: "format.family.lzipStream",
  },
  {
    family: "lz4Stream",
    physicalSuffixes: [".lz4"],
    displayLabelKey: "format.family.lz4Stream",
  },
  {
    family: "lzmaStream",
    physicalSuffixes: [".lzma"],
    displayLabelKey: "format.family.lzmaStream",
  },
  {
    family: "lzoStream",
    physicalSuffixes: [".lzo"],
    displayLabelKey: "format.family.lzoStream",
  },
  {
    family: "lrzipStream",
    physicalSuffixes: [".lrz"],
    displayLabelKey: "format.family.lrzipStream",
  },
  {
    family: "compressZStream",
    physicalSuffixes: [".z", ".uu", ".b64"],
    displayLabelKey: "format.family.compressZStream",
  },
];

// ---------------------------------------------------------------------------
// Lookup map: lowercase dotted suffix → family
// ---------------------------------------------------------------------------

const suffixToFamily: ReadonlyMap<string, ArchiveFormatFamily> = (() => {
  const map = new Map<string, ArchiveFormatFamily>();
  for (const entry of FAMILY_REGISTRY) {
    for (const suffix of entry.physicalSuffixes) {
      const key = suffix.toLowerCase();
      if (!map.has(key)) {
        map.set(key, entry.family);
      }
    }
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Family → preferred dotted suffix (for display)
// ---------------------------------------------------------------------------

const familyPreferredSuffix: ReadonlyMap<ArchiveFormatFamily, string> = (() => {
  const map = new Map<ArchiveFormatFamily, string>();
  for (const entry of FAMILY_REGISTRY) {
    map.set(entry.family, entry.physicalSuffixes[0]);
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Family → display label key
// ---------------------------------------------------------------------------

const familyDisplayLabelKey: ReadonlyMap<ArchiveFormatFamily, string> = (() => {
  const map = new Map<ArchiveFormatFamily, string>();
  for (const entry of FAMILY_REGISTRY) {
    map.set(entry.family, entry.displayLabelKey);
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Resolve a physical archive path to its canonical format family. */
export function resolveArchiveFormatFamily(
  archivePath: string,
): ArchiveFormatFamilyResolution {
  const suffix = getKnownArchiveSuffix(archivePath);
  if (!suffix) return { kind: "unknown" };

  // Split suffixes: .7z.001 → .7z, .vol000.tzap → .tzap
  const normalizedSuffix = normalizeSplitSuffix(suffix);

  const family = suffixToFamily.get(normalizedSuffix.toLowerCase());
  if (!family) return { kind: "unknown" };

  return { kind: "known", family };
}

/** Resolve a physical suffix string (without the path) to its canonical family. */
export function resolveSuffixToFamily(suffix: string): ArchiveFormatFamilyResolution {
  const cleanSuffix = suffix.startsWith(".") ? suffix : `.${suffix}`;
  const normalized = normalizeSplitSuffix(cleanSuffix);

  const family = suffixToFamily.get(normalized.toLowerCase());
  if (!family) return { kind: "unknown" };

  return { kind: "known", family };
}

/** Get the preferred physical suffix for a family (for display). */
export function preferredSuffixForFamily(family: ArchiveFormatFamily): string {
  return familyPreferredSuffix.get(family) ?? `.${family}`;
}

/** Get the display label key for a family. */
export function displayLabelKeyForFamily(family: ArchiveFormatFamily): string {
  return familyDisplayLabelKey.get(family) ?? "format.family.unknown";
}

/** All physical suffixes known to the registry (for coverage testing). */
export function allRegisteredSuffixes(): readonly string[] {
  const suffixes: string[] = [];
  for (const entry of FAMILY_REGISTRY) {
    suffixes.push(...entry.physicalSuffixes);
  }
  return suffixes;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize split/volume suffixes to their base family suffix.
 * .7z.001 → .7z, .vol000.tzap → .tzap, .vol042.tzap → .tzap
 */
function normalizeSplitSuffix(suffix: string): string {
  const lower = suffix.toLowerCase();

  // 7z split: .7z.001 → .7z
  if (/^\.7z\.\d{3}$/.test(lower)) return ".7z";

  // TZAP volume: .vol000.tzap → .tzap (any ASCII digit sequence)
  if (/^\.vol\d{3,}\.tzap$/.test(lower)) return ".tzap";

  return suffix;
}
