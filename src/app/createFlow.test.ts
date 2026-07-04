import { describe, expect, it } from "vitest";

import {
  buildStartCreateRequest,
  commonSourceParentDirectory,
  createFormatSupportsPassword,
  createStateAfterDestinationEdit,
  getCreateArchiveExtension,
  normalizeCreateVolumeSize,
  normalizeTzapRecoveryPercentage,
  suggestedCreateArchiveName,
  withCreateArchiveExtension,
} from "./createFlow";

const pathHelpers = {
  nativeParentPath(path: string): string {
    const trimmed = path.trim().replace(/[\\/]+$/, "");
    const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
    return slash > 0 ? trimmed.slice(0, slash) : "";
  },
};

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

  it("finds the common parent directory for selected source paths", () => {
    expect(commonSourceParentDirectory(["C:/work/docs"], pathHelpers)).toBe("C:/work");
    expect(
      commonSourceParentDirectory(
        ["C:/work/docs/readme.md", "C:/work/docs/images/logo.png"],
        pathHelpers,
      ),
    ).toBe("C:/work/docs");
    expect(
      commonSourceParentDirectory(
        ["C:\\work\\docs\\readme.md", "C:\\work\\assets\\logo.png"],
        pathHelpers,
      ),
    ).toBe("C:\\work");
  });

  it("restores a ready create state after destination edits when a plan still exists", () => {
    expect(createStateAfterDestinationEdit("error", true)).toBe("ready");
    expect(createStateAfterDestinationEdit("error", false)).toBe("error");
    expect(createStateAfterDestinationEdit("loading", true)).toBe("loading");
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

  it("scopes passwords to formats that support archive passwords", () => {
    expect(createFormatSupportsPassword("zip")).toBe(true);
    expect(createFormatSupportsPassword("tzap")).toBe(true);
    expect(createFormatSupportsPassword("sevenZ")).toBe(true);
    expect(createFormatSupportsPassword("tarZst")).toBe(false);

    expect(
      buildStartCreateRequest({
        sources: ["C:/work/source"],
        destinationPath: "C:/tmp/output",
        format: "tarZst",
        cleanSource: false,
        replaceExisting: true,
        preserveMetadata: false,
        password: "secret",
      }),
    ).not.toHaveProperty("password");
  });

  it("adds clamped recovery percentage only for TZAP requests", () => {
    expect(normalizeTzapRecoveryPercentage(105)).toBe(100);
    expect(normalizeTzapRecoveryPercentage(-1)).toBe(0);

    const tzapRequest = buildStartCreateRequest({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output",
      format: "tzap",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
      tzapRecoveryPercentage: 12,
    });
    const zipRequest = buildStartCreateRequest({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output",
      format: "zip",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
      tzapRecoveryPercentage: 12,
    });

    expect(tzapRequest.tzapRecoveryPercentage).toBe(12);
    expect(zipRequest).not.toHaveProperty("tzapRecoveryPercentage");
  });

  it("treats zero volume size as no split request", () => {
    expect(normalizeCreateVolumeSize(0)).toBeUndefined();
    expect(normalizeCreateVolumeSize(-1)).toBeUndefined();
    expect(normalizeCreateVolumeSize(1024.8)).toBe(1024);

    const request = buildStartCreateRequest({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output",
      format: "tzap",
      cleanSource: false,
      replaceExisting: true,
      preserveMetadata: false,
      volumeSize: 0,
      tzapRecoveryPercentage: 0,
    });

    expect(request).not.toHaveProperty("volumeSize");
    expect(request.tzapRecoveryPercentage).toBe(0);
  });

  it("includes destination collision strategy when requested", () => {
    const request = buildStartCreateRequest({
      sources: ["C:/work/source"],
      destinationPath: "C:/tmp/output",
      format: "tzap",
      cleanSource: false,
      replaceExisting: false,
      destinationCollisionStrategy: "rename",
      preserveMetadata: false,
    });

    expect(request.destinationCollisionStrategy).toBe("rename");
  });
});
