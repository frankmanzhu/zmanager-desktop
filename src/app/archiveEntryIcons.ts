import {
  Database,
  Disc3,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileHeadphone,
  FileImage,
  FileLock,
  FileSpreadsheet,
  FileStack,
  FileSymlink,
  FileText,
  FileVideoCamera,
  FolderArchive,
  FolderClosed,
  FolderOpen,
  FolderUp,
  Package,
} from "lucide";
import type { IconNode } from "lucide";

import type { ArchiveEntryDto } from "../api/types";
import { getKnownArchiveSuffix, isSupportedArchivePath } from "./archiveFileTypes";
import type { ArchiveTableRow } from "./archiveTable";

export type ArchiveEntryIconKind =
  | "archive"
  | "audio"
  | "code"
  | "database"
  | "disk"
  | "file"
  | "folder"
  | "hardlink"
  | "image"
  | "locked"
  | "package"
  | "parent"
  | "special"
  | "spreadsheet"
  | "symlink"
  | "text"
  | "video";

export type ArchiveEntryIconDescriptor = {
  kind: ArchiveEntryIconKind;
  label: string;
  icon: IconNode;
};

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aiff",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "opus",
  "wav",
  "wma",
]);

const CODE_EXTENSIONS = new Set([
  "bat",
  "c",
  "cc",
  "cmd",
  "cpp",
  "cs",
  "css",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "lua",
  "php",
  "ps1",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "xml",
  "yaml",
  "yml",
]);

const DATABASE_EXTENSIONS = new Set([
  "db",
  "db3",
  "mdb",
  "sqlite",
  "sqlite3",
]);

const DISK_IMAGE_EXTENSIONS = new Set([
  "dmg",
  "img",
  "iso",
  "vhd",
  "vhdx",
]);

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "psd",
  "raw",
  "svg",
  "tif",
  "tiff",
  "webp",
]);

const PACKAGE_EXTENSIONS = new Set([
  "appimage",
  "appx",
  "deb",
  "msi",
  "pkg",
  "rpm",
]);

const SPREADSHEET_EXTENSIONS = new Set([
  "csv",
  "ods",
  "tsv",
  "xls",
  "xlsm",
  "xlsx",
]);

const TEXT_EXTENSIONS = new Set([
  "cfg",
  "conf",
  "doc",
  "docx",
  "ini",
  "json",
  "log",
  "md",
  "markdown",
  "odt",
  "pdf",
  "properties",
  "rtf",
  "text",
  "txt",
]);

const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "webm",
  "wmv",
]);

export function archiveRowIconDescriptor(row: ArchiveTableRow): ArchiveEntryIconDescriptor {
  if (row.rowType === "parent") {
    return { kind: "parent", label: "Parent folder", icon: FolderUp };
  }

  if (row.rowType === "folder") {
    return { kind: "folder", label: "Folder", icon: FolderClosed };
  }

  return archiveEntryIconDescriptor(row.entry);
}

export function archiveEntryIconDescriptor(entry: ArchiveEntryDto): ArchiveEntryIconDescriptor {
  switch (entry.kind) {
    case "directory":
      return { kind: "folder", label: "Folder", icon: FolderClosed };
    case "symlink":
      return { kind: "symlink", label: "Symbolic link", icon: FileSymlink };
    case "hardlink":
      return { kind: "hardlink", label: "Hard link", icon: FileStack };
    case "special":
      return { kind: "special", label: "Special file", icon: FileCog };
    case "file":
      return archiveFileIconDescriptor(entry.path, entry.encrypted);
  }
}

export function archiveFileIconDescriptor(
  path: string,
  encrypted = false,
): ArchiveEntryIconDescriptor {
  if (encrypted) {
    return { kind: "locked", label: "Encrypted file", icon: FileLock };
  }

  const archiveSuffix = getKnownArchiveSuffix(path);
  if (archiveSuffix) {
    return {
      kind: "archive",
      label: `${archiveSuffix.slice(1).toUpperCase()} archive`,
      icon: FileArchive,
    };
  }

  const extension = fileExtensionForIcon(path);
  if (!extension) {
    return { kind: "file", label: "File", icon: File };
  }

  if (DISK_IMAGE_EXTENSIONS.has(extension)) {
    return { kind: "disk", label: "Disk image", icon: Disc3 };
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { kind: "image", label: "Image file", icon: FileImage };
  }
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return { kind: "spreadsheet", label: "Spreadsheet file", icon: FileSpreadsheet };
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return { kind: "audio", label: "Audio file", icon: FileHeadphone };
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return { kind: "video", label: "Video file", icon: FileVideoCamera };
  }
  if (DATABASE_EXTENSIONS.has(extension)) {
    return { kind: "database", label: "Database file", icon: Database };
  }
  if (PACKAGE_EXTENSIONS.has(extension)) {
    return { kind: "package", label: "Package file", icon: Package };
  }
  if (CODE_EXTENSIONS.has(extension)) {
    return { kind: "code", label: "Code file", icon: FileCode };
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return { kind: "text", label: "Document file", icon: FileText };
  }

  return {
    kind: isSupportedArchivePath(path) ? "archive" : "file",
    label: isSupportedArchivePath(path) ? "Archive file" : "File",
    icon: isSupportedArchivePath(path) ? FileArchive : File,
  };
}

export function archiveTreeIconDescriptor(
  isRoot: boolean,
  isActive: boolean,
): ArchiveEntryIconDescriptor {
  if (isRoot) {
    return { kind: "archive", label: "Archive root", icon: FolderArchive };
  }

  return {
    kind: "folder",
    label: isActive ? "Open folder" : "Folder",
    icon: isActive ? FolderOpen : FolderClosed,
  };
}

export function fileExtensionForIcon(path: string): string | null {
  const name = lastPathComponent(path);
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
}

function lastPathComponent(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? normalized;
}
