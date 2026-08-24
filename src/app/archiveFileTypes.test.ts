import { describe, expect, it } from "vitest";

import {
  ARCHIVE_OPEN_FILTER,
  SUPPORTED_ARCHIVE_FILE_SUFFIXES,
  SUPPORTED_ARCHIVE_DIALOG_EXTENSIONS,
  baseNameWithoutKnownArchiveExtension,
  getKnownArchiveSuffix,
  isSupportedArchivePath,
  isTzapVolumeArchiveName,
} from "./archiveFileTypes";

describe("archive file type helpers", () => {
  it("detects common archive extensions case-insensitively", () => {
    expect(isSupportedArchivePath("C:/tmp/report.zip")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/report.ZIPX")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/app.apk")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/image.iso")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/installer.dmg")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/installer.PKG")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/capture.WARC")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/library.LIB")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/notes.txt")).toBe(false);
  });

  it("detects compound archive extensions before their trailing single extension", () => {
    expect(isSupportedArchivePath("C:/tmp/source.tar.gz")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/source.TAR.ZST")).toBe(true);
    expect(baseNameWithoutKnownArchiveExtension("C:/tmp/source.tar.gz")).toBe("source");
    expect(getKnownArchiveSuffix("C:/tmp/source.tar.zst")).toBe(".tar.zst");
  });

  it("detects split archive names", () => {
    expect(isSupportedArchivePath("C:/tmp/photos.7z.001")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/photos.7Z.001")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/photos.7z.002")).toBe(false);
    expect(baseNameWithoutKnownArchiveExtension("C:/tmp/photos.7z.001")).toBe("photos");
    expect(getKnownArchiveSuffix("C:/tmp/photos.7z.001")).toBe(".7z.001");
  });

  it("detects TZAP volume names with ASCII digit suffixes", () => {
    expect(isSupportedArchivePath("C:/tmp/backup.vol000.tzap")).toBe(true);
    expect(isSupportedArchivePath("C:/tmp/backup.VOL042.TZAP")).toBe(true);
    expect(isTzapVolumeArchiveName("backup.vol42.tzap")).toBe(true);
    expect(isTzapVolumeArchiveName("backup.vol.tzap")).toBe(false);
    expect(isTzapVolumeArchiveName("backup.volabc.tzap")).toBe(false);
    expect(isTzapVolumeArchiveName(".vol000.tzap")).toBe(false);
    expect(baseNameWithoutKnownArchiveExtension("C:/tmp/backup.VOL042.TZAP")).toBe("backup");
  });

  it("returns base names for archive and non-archive paths", () => {
    expect(baseNameWithoutKnownArchiveExtension("C:/tmp/project.tzap")).toBe("project");
    expect(baseNameWithoutKnownArchiveExtension("C:\\tmp\\project folder")).toBe("project folder");
    expect(baseNameWithoutKnownArchiveExtension("C:/tmp/readme.txt")).toBe("readme");
    expect(baseNameWithoutKnownArchiveExtension("README")).toBe("README");
  });

  it("keeps longer suffixes ahead of shorter overlapping suffixes", () => {
    expect(SUPPORTED_ARCHIVE_FILE_SUFFIXES.indexOf(".tar.zst")).toBeLessThan(
      SUPPORTED_ARCHIVE_FILE_SUFFIXES.indexOf(".zst"),
    );
    expect(SUPPORTED_ARCHIVE_FILE_SUFFIXES.indexOf(".7z.001")).toBeLessThan(
      SUPPORTED_ARCHIVE_FILE_SUFFIXES.indexOf(".7z"),
    );
  });

  it("keeps the native open dialog filter aligned with supported archive suffixes", () => {
    expect(ARCHIVE_OPEN_FILTER).toEqual({
      name: "Archives",
      extensions: SUPPORTED_ARCHIVE_DIALOG_EXTENSIONS,
    });
    expect(SUPPORTED_ARCHIVE_DIALOG_EXTENSIONS).toEqual(
      expect.arrayContaining(["7z", "7z.001", "dmg", "pkg", "tar.gz", "tar.zst", "tzap", "zip", "zipx"]),
    );
  });
});
