import type { ArchiveEntryDto } from "../api/types";

export type ArchiveFixture = Readonly<{
  archivePath: string;
  entries: readonly ArchiveEntryDto[];
  entryCount?: number;
  totalSize?: number;
}>;

export function localDevArchiveFixture(): ArchiveFixture {
  return {
    archivePath: "C:/Users/Frank/Downloads/photos.zip",
    entries: [
      {
        path: "wedding/",
        kind: "directory",
        size: 0,
        compressedSize: 0,
        modified: "1781085600",
      },
      {
        path: "wedding/raw/photo01.jpg",
        kind: "file",
        size: 5_242_880,
        compressedSize: 3_145_728,
        modified: "1781085660",
      },
      {
        path: "wedding/raw/photo02.jpg",
        kind: "file",
        size: 6_291_456,
        compressedSize: 4_194_304,
        modified: "1781085720",
      },
      {
        path: "docs/readme.txt",
        kind: "file",
        size: 1_200,
        compressedSize: 600,
        modified: "1780995600",
      },
    ],
  };
}
