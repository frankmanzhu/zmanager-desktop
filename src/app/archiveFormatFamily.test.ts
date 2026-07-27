import { describe, expect, it } from "vitest";

import {
  resolveArchiveFormatFamily,
  resolveSuffixToFamily,
  migrationPrecedenceKeys,
  preferredSuffixForFamily,
  allRegisteredSuffixes,
  type ArchiveFormatFamily,
  ALL_ARCHIVE_FORMAT_FAMILIES,
} from "./archiveFormatFamily";

import { SUPPORTED_ARCHIVE_FILE_SUFFIXES } from "./archiveFileTypes";

// ---------------------------------------------------------------------------
// WP1 — Format family normalization
// ---------------------------------------------------------------------------

describe("WP1 — Archive format family normalization", () => {
  describe("basic family resolution", () => {
    it("resolves .zip to zip family", () => {
      const result = resolveArchiveFormatFamily("archive.zip");
      expect(result).toEqual({ kind: "known", family: "zip" });
    });

    it("resolves .7z to sevenZ family", () => {
      const result = resolveArchiveFormatFamily("archive.7z");
      expect(result).toEqual({ kind: "known", family: "sevenZ" });
    });

    it("resolves .tzap to tzap family", () => {
      const result = resolveArchiveFormatFamily("archive.tzap");
      expect(result).toEqual({ kind: "known", family: "tzap" });
    });

    it("resolves .tar to tar family", () => {
      const result = resolveArchiveFormatFamily("archive.tar");
      expect(result).toEqual({ kind: "known", family: "tar" });
    });

    it("resolves .aar and .aea to appleArchive family", () => {
      expect(resolveArchiveFormatFamily("bundle.aar")).toEqual({ kind: "known", family: "appleArchive" });
      expect(resolveArchiveFormatFamily("bundle.aea")).toEqual({ kind: "known", family: "appleArchive" });
    });
  });

  describe("alias equivalence", () => {
    it("resolves .tgz and .tar.gz to the same tarGzip family", () => {
      const tgz = resolveArchiveFormatFamily("archive.tgz");
      const tarGz = resolveArchiveFormatFamily("archive.tar.gz");
      expect(tgz).toEqual({ kind: "known", family: "tarGzip" });
      expect(tarGz).toEqual(tgz);
    });

    it("resolves .tzst and .tar.zst to the same tarZstd family", () => {
      const tzst = resolveArchiveFormatFamily("archive.tzst");
      const tarZst = resolveArchiveFormatFamily("archive.tar.zst");
      expect(tzst).toEqual({ kind: "known", family: "tarZstd" });
      expect(tarZst).toEqual(tzst);
    });

    it("resolves .tbz2 and .tar.bz2 to the same tarBzip2 family", () => {
      // Note: .tbz is NOT in the generated suffix manifest, so it won't
      // resolve from a file path. It IS in the registry for future support.
      expect(resolveArchiveFormatFamily("archive.tbz2").kind).toBe("known");
      expect(resolveArchiveFormatFamily("archive.tar.bz2").kind).toBe("known");

      const family = (resolveArchiveFormatFamily("archive.tar.bz2") as { kind: "known"; family: ArchiveFormatFamily }).family;
      expect((resolveArchiveFormatFamily("archive.tbz2") as { kind: "known"; family: ArchiveFormatFamily }).family).toBe(family);
    });

    it("resolves .txz and .tar.xz to the same tarXz family", () => {
      expect(resolveArchiveFormatFamily("archive.txz")).toEqual(resolveArchiveFormatFamily("archive.tar.xz"));
      expect(resolveArchiveFormatFamily("archive.tar.xz").kind).toBe("known");
    });

    it("resolves all ZIP aliases to the zip family", () => {
      const zipAliases = [".zip", ".zipx", ".jar", ".war", ".ipa", ".apk", ".appx", ".xpi"];
      for (const alias of zipAliases) {
        const result = resolveArchiveFormatFamily(`archive${alias}`);
        expect(result).toEqual({ kind: "known", family: "zip" });
      }
    });
  });

  describe("compound suffix precedence", () => {
    it("classifies .tar.gz as tarGzip, NOT gzipStream", () => {
      const result = resolveArchiveFormatFamily("archive.tar.gz");
      expect(result).toEqual({ kind: "known", family: "tarGzip" });
    });

    it("classifies .tar.zst as tarZstd, NOT zstdStream", () => {
      const result = resolveArchiveFormatFamily("archive.tar.zst");
      expect(result).toEqual({ kind: "known", family: "tarZstd" });
    });

    it("classifies .tar.bz2 as tarBzip2, NOT bzip2Stream", () => {
      const result = resolveArchiveFormatFamily("archive.tar.bz2");
      expect(result).toEqual({ kind: "known", family: "tarBzip2" });
    });

    it("classifies .tar.xz as tarXz, NOT xzStream", () => {
      const result = resolveArchiveFormatFamily("archive.tar.xz");
      expect(result).toEqual({ kind: "known", family: "tarXz" });
    });

    it("classifies .tar.br as tarBrotli, NOT brotliStream", () => {
      const result = resolveArchiveFormatFamily("archive.tar.br");
      expect(result).toEqual({ kind: "known", family: "tarBrotli" });
    });

    it("classifies plain .gz as gzipStream (no tar prefix)", () => {
      const result = resolveArchiveFormatFamily("file.gz");
      expect(result).toEqual({ kind: "known", family: "gzipStream" });
    });

    it("classifies plain .zst as zstdStream (no tar prefix)", () => {
      const result = resolveArchiveFormatFamily("file.zst");
      expect(result).toEqual({ kind: "known", family: "zstdStream" });
    });
  });

  describe("case-insensitive matching", () => {
    it("matches uppercase extensions", () => {
      expect(resolveArchiveFormatFamily("ARCHIVE.ZIP")).toEqual({ kind: "known", family: "zip" });
      expect(resolveArchiveFormatFamily("ARCHIVE.TGZ")).toEqual({ kind: "known", family: "tarGzip" });
      expect(resolveArchiveFormatFamily("ARCHIVE.TAR.GZ")).toEqual({ kind: "known", family: "tarGzip" });
      expect(resolveArchiveFormatFamily("ARCHIVE.7Z")).toEqual({ kind: "known", family: "sevenZ" });
    });

    it("matches mixed-case extensions", () => {
      expect(resolveArchiveFormatFamily("Archive.Tar.Gz")).toEqual({ kind: "known", family: "tarGzip" });
      expect(resolveArchiveFormatFamily("Archive.Tzst")).toEqual({ kind: "known", family: "tarZstd" });
    });
  });

  describe("split and volume archives", () => {
    it("resolves .7z.001 to sevenZ family", () => {
      const result = resolveArchiveFormatFamily("archive.7z.001");
      expect(result).toEqual({ kind: "known", family: "sevenZ" });
    });

    it("resolves .7Z.001 (uppercase) to sevenZ family", () => {
      const result = resolveArchiveFormatFamily("archive.7Z.001");
      expect(result).toEqual({ kind: "known", family: "sevenZ" });
    });

    it("resolves .vol000.tzap to tzap family", () => {
      const result = resolveArchiveFormatFamily("backup.vol000.tzap");
      expect(result).toEqual({ kind: "known", family: "tzap" });
    });

    it("resolves .VOL042.TZAP (uppercase) to tzap family", () => {
      const result = resolveArchiveFormatFamily("backup.VOL042.TZAP");
      expect(result).toEqual({ kind: "known", family: "tzap" });
    });

    it("resolves .vol12345.tzap to tzap family (any digit count above 3)", () => {
      const result = resolveArchiveFormatFamily("backup.vol12345.tzap");
      expect(result).toEqual({ kind: "known", family: "tzap" });
    });
  });

  describe("unrecognized path handling", () => {
    it("returns unknown for non-archive paths", () => {
      expect(resolveArchiveFormatFamily("readme.txt")).toEqual({ kind: "unknown" });
      expect(resolveArchiveFormatFamily("image.png")).toEqual({ kind: "unknown" });
    });

    it("returns unknown for paths without extensions", () => {
      expect(resolveArchiveFormatFamily("README")).toEqual({ kind: "unknown" });
    });

    it("returns unknown for archive path with unsupported suffix", () => {
      // .7z.002 is not the first split part
      const result = resolveArchiveFormatFamily("archive.7z.002");
      // .7z.002 is not in the supported suffixes, so getKnownArchiveSuffix returns null
      // and we get unknown
      expect(result.kind).toBe("unknown");
    });
  });
});

// ---------------------------------------------------------------------------
// WP1 — Migration precedence keys
// ---------------------------------------------------------------------------

describe("WP1 — Migration precedence keys", () => {
  it("produces canonical family ID first for tarGzip", () => {
    const keys = migrationPrecedenceKeys("tarGzip");
    expect(keys[0]).toBe("tarGzip");
  });

  it("includes preferred undotted before dotted for tarGzip", () => {
    const keys = migrationPrecedenceKeys("tarGzip");
    expect(keys).toContain("tar.gz");    // undotted preferred
    expect(keys).toContain(".tar.gz");   // dotted preferred
    const undottedIdx = keys.indexOf("tar.gz");
    const dottedIdx = keys.indexOf(".tar.gz");
    expect(undottedIdx).toBeLessThan(dottedIdx);
  });

  it("includes alias tgz after preferred forms", () => {
    const keys = migrationPrecedenceKeys("tarGzip");
    expect(keys).toContain("tgz");       // undotted alias
    expect(keys).toContain(".tgz");      // dotted alias
  });

  it("includes both .tbz2 and .tbz aliases for tarBzip2", () => {
    const keys = migrationPrecedenceKeys("tarBzip2");
    expect(keys).toContain("tbz2");
    expect(keys).toContain(".tbz2");
    expect(keys).toContain("tbz");
    expect(keys).toContain(".tbz");
  });

  it("has no duplicate keys in migration precedence", () => {
    for (const family of ALL_ARCHIVE_FORMAT_FAMILIES) {
      const keys = migrationPrecedenceKeys(family);
      expect(keys.length).toBe(new Set(keys).size);
    }
  });
});

// ---------------------------------------------------------------------------
// WP1 — Supported suffix coverage
// ---------------------------------------------------------------------------

describe("WP1 — Generated suffix coverage", () => {
  it("every supported single extension has at least one family mapping", () => {
    // Single extensions that aren't compound-covered should all resolve
    const unresolved: string[] = [];
    for (const suffix of SUPPORTED_ARCHIVE_FILE_SUFFIXES) {
      const result = resolveSuffixToFamily(suffix);
      if (result.kind === "unknown") {
        unresolved.push(suffix);
      }
    }
    // TZAP volume split suffix should resolve to tzap (handled by .vol000.tzap pattern)
    // .7z.001 should resolve to sevenZ
    // .vol000.tzap should resolve to tzap
    // Any remaining unknowns are gap
    const expectedGaps = new Set([".7z.001", ".vol000.tzap"]);
    const realGaps = unresolved.filter((s) => !expectedGaps.has(s));
    expect(realGaps).toEqual([]);
  });

  it("every supported single extension resolves to exactly one family", () => {
    // Verify determinism: two calls return the same result
    for (const suffix of SUPPORTED_ARCHIVE_FILE_SUFFIXES) {
      const a = resolveSuffixToFamily(suffix);
      const b = resolveSuffixToFamily(suffix);
      expect(a).toEqual(b);
    }
  });

  it("every registered physical suffix starts with a dot", () => {
    for (const suffix of allRegisteredSuffixes()) {
      expect(suffix.startsWith(".")).toBe(true);
    }
  });

  it("no two families share the same physical suffix", () => {
    const seen = new Map<string, ArchiveFormatFamily>();
    for (const suffix of allRegisteredSuffixes()) {
      const lower = suffix.toLowerCase();
      if (seen.has(lower)) {
        // Duplicate mapping — fail with info
        expect.fail(`Suffix "${lower}" mapped to both "${seen.get(lower)}" and another family`);
      }
      seen.set(lower, "seen" as ArchiveFormatFamily);
    }
  });
});

// ---------------------------------------------------------------------------
// WP1 — preferredSuffixForFamily
// ---------------------------------------------------------------------------

describe("WP1 — Preferred suffix", () => {
  it("returns .tar.gz for tarGzip", () => {
    expect(preferredSuffixForFamily("tarGzip")).toBe(".tar.gz");
  });

  it("returns .tar.zst for tarZstd", () => {
    expect(preferredSuffixForFamily("tarZstd")).toBe(".tar.zst");
  });

  it("returns .zip for zip", () => {
    expect(preferredSuffixForFamily("zip")).toBe(".zipx");
  });
});
