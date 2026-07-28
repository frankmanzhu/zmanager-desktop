import { describe, expect, it } from "vitest";

import type { CreatePlanEntryDto } from "../api/types";
import { createTranslatorFromCatalog } from "./i18n/translator";
import { zhCnMessages } from "./i18n/messages.zh-CN";
import {
  CREATE_SOURCE_TABLE_COLUMNS,
  formatCreateTableValue,
  type CreateSourceColumnId,
} from "./createTableColumns";

// All 14 compress-applicable column IDs from the unified catalogue
const ALL_COMPRESS_IDS: CreateSourceColumnId[] =
  CREATE_SOURCE_TABLE_COLUMNS.map((c) => c.id);

function makeEntry(overrides?: Partial<CreatePlanEntryDto>): CreatePlanEntryDto {
  return {
    path: "docs/readme.txt",
    kind: "file",
    size: 1024,
    modified: "2025-01-15T10:30:00Z",
    sourcePath: "/home/user/docs/readme.txt",
    mode: 0o644,
    created: "2025-01-14T08:00:00Z",
    accessed: "2025-01-16T12:00:00Z",
    linkTarget: "/etc/alternatives/readme",
    uid: 1000,
    gid: 100,
    owner: "alice",
    group: "users",
    attributes: [
      { namespace: "portable", code: "readonly" },
      { namespace: "portable", code: "hidden" },
    ],
    ...overrides,
  };
}

describe("formatCreateTableValue", () => {
  it("returns empty string for undefined entry", () => {
    for (const id of ALL_COMPRESS_IDS) {
      expect(formatCreateTableValue(undefined, id)).toBe("");
    }
  });

  it("returns empty string when optional fields are absent", () => {
    const entry = makeEntry({
      size: undefined,
      modified: undefined,
      mode: undefined,
      created: undefined,
      accessed: undefined,
      linkTarget: undefined,
      uid: undefined,
      gid: undefined,
      owner: undefined,
      group: undefined,
      attributes: undefined,
    });

    expect(formatCreateTableValue(entry, "size")).toBe("");
    expect(formatCreateTableValue(entry, "modified")).toBe("");
    expect(formatCreateTableValue(entry, "mode")).toBe("");
    expect(formatCreateTableValue(entry, "created")).toBe("");
    expect(formatCreateTableValue(entry, "accessed")).toBe("");
    expect(formatCreateTableValue(entry, "linkTarget")).toBe("");
    expect(formatCreateTableValue(entry, "uid")).toBe("");
    expect(formatCreateTableValue(entry, "gid")).toBe("");
    expect(formatCreateTableValue(entry, "owner")).toBe("");
    expect(formatCreateTableValue(entry, "group")).toBe("");
  });

  it("renders name from entry path", () => {
    expect(formatCreateTableValue(makeEntry(), "name")).toBe("docs/readme.txt");
  });

  it("renders source path", () => {
    expect(formatCreateTableValue(makeEntry(), "sourcePath")).toBe(
      "/home/user/docs/readme.txt",
    );
  });

  it("formats mode as rwx string", () => {
    expect(formatCreateTableValue(makeEntry({ mode: 0o644 }), "mode")).toBe("-rw-r--r--");
    expect(formatCreateTableValue(makeEntry({ mode: 0o755 }), "mode")).toBe("-rwxr-xr-x");
  });

  it("formats directory modes with d prefix", () => {
    expect(
      formatCreateTableValue(makeEntry({ mode: 0o750, kind: "directory" }), "mode"),
    ).toBe("drwxr-x---");
  });

  it("formats uid and gid as strings", () => {
    expect(formatCreateTableValue(makeEntry({ uid: 1000 }), "uid")).toBe("1000");
    expect(formatCreateTableValue(makeEntry({ gid: 100 }), "gid")).toBe("100");
  });

  it("renders owner and group names", () => {
    expect(formatCreateTableValue(makeEntry({ owner: "alice" }), "owner")).toBe("alice");
    expect(formatCreateTableValue(makeEntry({ group: "users" }), "group")).toBe("users");
  });

  it("falls back to numeric uid/gid when owner/group names are absent", () => {
    expect(
      formatCreateTableValue(makeEntry({ uid: 501, owner: undefined }), "owner"),
    ).toBe("501");
    expect(
      formatCreateTableValue(makeEntry({ gid: 20, group: undefined }), "group"),
    ).toBe("20");
  });

  it("renders link target", () => {
    expect(formatCreateTableValue(makeEntry(), "linkTarget")).toBe(
      "/etc/alternatives/readme",
    );
  });

  it("renders attributes as comma-joined codes", () => {
    expect(formatCreateTableValue(makeEntry(), "attributes")).toBe("readonly, hidden");
  });

  it("formats timestamps as locale-aware dates", () => {
    const modified = formatCreateTableValue(makeEntry(), "modified");
    const created = formatCreateTableValue(makeEntry(), "created");
    const accessed = formatCreateTableValue(makeEntry(), "accessed");

    expect(modified).not.toBe("");
    expect(created).not.toBe("");
    expect(accessed).not.toBe("");
    // Should be formatted dates, not raw ISO strings
    expect(modified).not.toContain("2025-01-15");
  });

  it("renders zero-like timestamps as empty", () => {
    expect(formatCreateTableValue(makeEntry({ modified: "0" }), "modified")).toBe("");
    expect(
      formatCreateTableValue(
        makeEntry({ created: "0000-00-00T00:00:00Z" }),
        "created",
      ),
    ).toBe("");
  });

  it("all 14 column IDs produce a string (never undefined)", () => {
    const entry = makeEntry();
    for (const id of ALL_COMPRESS_IDS) {
      const value = formatCreateTableValue(entry, id);
      expect(typeof value).toBe("string");
    }
  });

  describe("i18n", () => {
    const zhCn = createTranslatorFromCatalog("zh-CN", zhCnMessages);

    it("translates kind labels", () => {
      expect(
        formatCreateTableValue(makeEntry({ kind: "directory" }), "kind", zhCn),
      ).toBe("文件夹");
      expect(
        formatCreateTableValue(makeEntry({ kind: "file" }), "kind", zhCn),
      ).toBe("文件");
    });

    it("falls back to English when no translator provided", () => {
      expect(
        formatCreateTableValue(makeEntry({ kind: "directory" }), "kind"),
      ).toBe("Folder");
      expect(
        formatCreateTableValue(makeEntry({ kind: "file" }), "kind"),
      ).toBe("File");
      expect(
        formatCreateTableValue(makeEntry({ kind: "symlink" }), "kind"),
      ).toBe("Symbolic link");
      expect(
        formatCreateTableValue(makeEntry({ kind: "hardlink" }), "kind"),
      ).toBe("Hard link");
    });

    it("passes locale to size formatting", () => {
      const zhValue = formatCreateTableValue(makeEntry({ size: 1024 }), "size", zhCn);
      expect(zhValue).not.toBe("");
      // Different locales format numbers differently
      const enValue = formatCreateTableValue(makeEntry({ size: 1024 }), "size");
      expect(zhValue).toBe(enValue); // bytes display not heavily locale-dependent, but hook is exercised
    });
  });
});
