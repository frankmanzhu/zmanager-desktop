import { describe, expect, it } from "vitest";

import {
  buildStartCreateRequest,
  getCreateArchiveExtension,
  suggestedCreateArchiveName,
  withCreateArchiveExtension,
} from "./createFlow";

describe("create flow helpers", () => {
  it("normalizes archive extensions to the selected format", () => {
    expect(withCreateArchiveExtension("C:/tmp/backup", "zip")).toBe("C:/tmp/backup.zip");
    expect(withCreateArchiveExtension("C:/tmp/backup.7z", "zip")).toBe("C:/tmp/backup.zip");
    expect(withCreateArchiveExtension("C:/tmp/backup.zip", "sevenZ")).toBe("C:/tmp/backup.7z");
    expect(withCreateArchiveExtension("C:/tmp/backup.tar.zst", "tarZst")).toBe("C:/tmp/backup.tar.zst");
    expect(withCreateArchiveExtension("C:/tmp/backup.zip", "tarZst")).toBe("C:/tmp/backup.tzst");
  });

  it("detects known create extensions case-insensitively", () => {
    expect(getCreateArchiveExtension("C:/tmp/report.TAR.ZST")).toBe("tar.zst");
    expect(getCreateArchiveExtension("C:/tmp/report.ZIP")).toBe("zip");
    expect(getCreateArchiveExtension("C:/tmp/report.txt")).toBeNull();
  });

  it("suggests a safe archive name from the first source", () => {
    expect(suggestedCreateArchiveName(["C:/work/my:folder"], "zip")).toBe("my_folder.zip");
    expect(suggestedCreateArchiveName([], "sevenZ")).toBe("archive.7z");
  });

  it("builds create requests without blank optional fields", () => {
    const request = buildStartCreateRequest({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output",
      format: "zip",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
      password: "",
      compressionLevel: undefined,
      volumeSize: undefined,
    });

    expect(request).toEqual({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output.zip",
      format: "zip",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
    });
  });
});
