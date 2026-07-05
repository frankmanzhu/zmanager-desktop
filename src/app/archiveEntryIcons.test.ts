import { describe, expect, it } from "vitest";

import {
  archiveEntryIconDescriptor,
  archiveFileIconDescriptor,
  archiveRowIconDescriptor,
  archiveTreeIconDescriptor,
  fileExtensionForIcon,
} from "./archiveEntryIcons";
import type { ArchiveTableRow } from "./archiveTable";
import { createTranslatorFromCatalog } from "./i18n/translator";
import { zhCnMessages } from "./i18n/messages.zh-CN";

describe("archive entry icon descriptors", () => {
  it("uses folder artwork for navigable archive folders", () => {
    const row: ArchiveTableRow = {
      rowType: "folder",
      path: "docs",
      name: "docs",
    };

    expect(archiveRowIconDescriptor(row)).toMatchObject({
      kind: "folder",
      label: "Folder",
    });
  });

  it("uses parent folder artwork for the parent navigation row", () => {
    const row: ArchiveTableRow = {
      rowType: "parent",
      path: "",
      name: "..",
    };

    expect(archiveRowIconDescriptor(row)).toMatchObject({
      kind: "parent",
      label: "Parent folder",
    });
  });

  it("recognizes supported archive files by their exact archive suffix", () => {
    expect(archiveFileIconDescriptor("C:/tmp/source.tar.gz")).toMatchObject({
      kind: "archive",
      label: "TAR.GZ archive",
    });
  });

  it("recognizes common file categories by extension", () => {
    expect(archiveFileIconDescriptor("photos/cover.png").kind).toBe("image");
    expect(archiveFileIconDescriptor("src/main.ts").kind).toBe("code");
    expect(archiveFileIconDescriptor("reports/table.csv").kind).toBe("spreadsheet");
    expect(archiveFileIconDescriptor("media/song.flac").kind).toBe("audio");
    expect(archiveFileIconDescriptor("media/movie.mkv").kind).toBe("video");
  });

  it("preserves link and special entry kinds instead of treating them as ordinary files", () => {
    expect(archiveEntryIconDescriptor({ path: "linked", kind: "symlink" })).toMatchObject({
      kind: "symlink",
      label: "Symbolic link",
    });
    expect(archiveEntryIconDescriptor({ path: "device", kind: "special" })).toMatchObject({
      kind: "special",
      label: "Special file",
    });
  });

  it("uses a distinct icon hint for encrypted file entries", () => {
    expect(archiveEntryIconDescriptor({ path: "secret.txt", kind: "file", encrypted: true })).toMatchObject({
      kind: "locked",
      label: "Encrypted file",
    });
  });

  it("extracts display extensions without treating dotfiles as typed files", () => {
    expect(fileExtensionForIcon("C:/tmp/readme.txt")).toBe("txt");
    expect(fileExtensionForIcon("C:/tmp/.gitignore")).toBeNull();
  });

  it("distinguishes archive root and active folder tree icons", () => {
    expect(archiveTreeIconDescriptor(true, false)).toMatchObject({
      kind: "archive",
      label: "Archive root",
    });
    expect(archiveTreeIconDescriptor(false, true)).toMatchObject({
      kind: "folder",
      label: "Open folder",
    });
  });

  it("localizes descriptor labels without changing stable icon kinds", () => {
    const zhCn = createTranslatorFromCatalog("zh-CN", zhCnMessages);

    expect(archiveEntryIconDescriptor({ path: "photos/cover.png", kind: "file" }, zhCn)).toMatchObject({
      kind: "image",
      label: "图像文件",
    });
  });
});
