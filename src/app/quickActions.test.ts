import { describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_PREFERENCES } from "./preferences";
import {
  quickCreateDestination,
  quickExtractDestination,
  runQuickActionRequest,
  uniqueQuickActionPaths,
  unsupportedQuickExtractPath,
  type QuickActionPathHelpers,
} from "./quickActions";

const pathHelpers: QuickActionPathHelpers = {
  nativeParentPath(path) {
    const normalized = path.replace(/\\/g, "/");
    const index = normalized.lastIndexOf("/");
    return index > 0 ? normalized.slice(0, index) : "";
  },
  joinNativePath(parent, child) {
    return parent ? `${parent}/${child}` : child;
  },
};

describe("quick action helpers", () => {
  it("deduplicates and trims quick-action paths", () => {
    expect(uniqueQuickActionPaths([" a ", "", "b", "a", " b "])).toEqual(["a", "b"]);
  });

  it("builds quick create destinations from preferences", () => {
    expect(
      quickCreateDestination(
        ["/tmp/photos"],
        "tzap",
        DEFAULT_APP_PREFERENCES,
        pathHelpers,
      ),
    ).toBe("/tmp/photos.tzap");

    expect(
      quickCreateDestination(
        ["/tmp/photos"],
        "zip",
        {
          ...DEFAULT_APP_PREFERENCES,
          defaultOutputLocation: "customFolder",
          customOutputFolderPath: "/archives",
        },
        pathHelpers,
      ),
    ).toBe("/archives/photos.zip");
  });

  it("uses the common source parent for quick create destinations", () => {
    expect(
      quickCreateDestination(
        ["/tmp/photos/raw/image.jpg", "/tmp/photos/edited/image.jpg"],
        "zip",
        DEFAULT_APP_PREFERENCES,
        pathHelpers,
      ),
    ).toBe("/tmp/photos/image.jpg.zip");
  });

  it("builds quick extract destinations from the extraction mode", () => {
    expect(quickExtractDestination("/tmp/archive.tar.zst", "extractHere", pathHelpers)).toBe(
      "/tmp",
    );
    expect(quickExtractDestination("/tmp/archive.tar.zst", "extractToFolder", pathHelpers)).toBe(
      "/tmp/archive",
    );
  });

  it("finds unsupported archive paths", () => {
    expect(unsupportedQuickExtractPath(["one.zip", "notes.txt", "two.tzap"])).toBe("notes.txt");
    expect(unsupportedQuickExtractPath(["one.zip", "two.tzap"])).toBeNull();
  });

  it("routes generic quick actions through preferences", async () => {
    const handlers = {
      openArchive: vi.fn().mockResolvedValue(undefined),
      openCreateReview: vi.fn().mockResolvedValue(undefined),
      startCreate: vi.fn().mockResolvedValue(undefined),
      openExtractReview: vi.fn().mockResolvedValue(undefined),
      startExtract: vi.fn().mockResolvedValue(undefined),
    };

    await runQuickActionRequest(
      { kind: "compress", paths: ["/tmp/source"] },
      {
        ...DEFAULT_APP_PREFERENCES,
        defaultArchiveFormat: "tzap",
        defaultCleanSourceEnabled: true,
      },
      handlers,
    );

    expect(handlers.openCreateReview).toHaveBeenCalledWith(["/tmp/source"], "tzap", true);
    expect(handlers.startCreate).not.toHaveBeenCalled();

    await runQuickActionRequest(
      { kind: "extract", paths: ["/tmp/archive.zip"] },
      { ...DEFAULT_APP_PREFERENCES, defaultExtractionBehavior: "extractToFolder" },
      handlers,
    );

    expect(handlers.startExtract).toHaveBeenCalledWith(["/tmp/archive.zip"], "extractToFolder");
  });

  it("routes associated archive opens to browsing by default", async () => {
    const handlers = {
      openArchive: vi.fn().mockResolvedValue(undefined),
      openCreateReview: vi.fn().mockResolvedValue(undefined),
      startCreate: vi.fn().mockResolvedValue(undefined),
      openExtractReview: vi.fn().mockResolvedValue(undefined),
      startExtract: vi.fn().mockResolvedValue(undefined),
    };

    await runQuickActionRequest(
      { kind: "open", paths: ["/tmp/archive.tzap"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );

    expect(handlers.openArchive).toHaveBeenCalledWith(["/tmp/archive.tzap"]);
    expect(handlers.openExtractReview).not.toHaveBeenCalled();
    expect(handlers.startExtract).not.toHaveBeenCalled();
  });

  it("routes fixed-format create quick actions", async () => {
    const handlers = {
      openArchive: vi.fn().mockResolvedValue(undefined),
      openCreateReview: vi.fn().mockResolvedValue(undefined),
      startCreate: vi.fn().mockResolvedValue(undefined),
      openExtractReview: vi.fn().mockResolvedValue(undefined),
      startExtract: vi.fn().mockResolvedValue(undefined),
    };

    await runQuickActionRequest(
      { kind: "compressTzap", paths: ["/tmp/source"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );
    await runQuickActionRequest(
      { kind: "compressZip", paths: ["/tmp/source"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );
    await runQuickActionRequest(
      { kind: "compressSevenZ", paths: ["/tmp/source"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );
    await runQuickActionRequest(
      { kind: "compressTarZst", paths: ["/tmp/source"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );

    expect(handlers.startCreate).toHaveBeenNthCalledWith(1, ["/tmp/source"], "tzap", false);
    expect(handlers.startCreate).toHaveBeenNthCalledWith(2, ["/tmp/source"], "zip", false);
    expect(handlers.startCreate).toHaveBeenNthCalledWith(3, ["/tmp/source"], "sevenZ", false);
    expect(handlers.startCreate).toHaveBeenNthCalledWith(4, ["/tmp/source"], "tarZst", false);
  });

  it("routes associated archive opens to browsing regardless of extraction defaults", async () => {
    const handlers = {
      openArchive: vi.fn().mockResolvedValue(undefined),
      openCreateReview: vi.fn().mockResolvedValue(undefined),
      startCreate: vi.fn().mockResolvedValue(undefined),
      openExtractReview: vi.fn().mockResolvedValue(undefined),
      startExtract: vi.fn().mockResolvedValue(undefined),
    };

    await runQuickActionRequest(
      { kind: "open", paths: ["/tmp/archive.zip"] },
      {
        ...DEFAULT_APP_PREFERENCES,
        defaultExtractionBehavior: "extractHere",
      },
      handlers,
    );

    expect(handlers.openArchive).toHaveBeenCalledWith(["/tmp/archive.zip"]);
    expect(handlers.startExtract).not.toHaveBeenCalled();
  });

  it("routes ask-every-time extraction to user review", async () => {
    const handlers = {
      openArchive: vi.fn().mockResolvedValue(undefined),
      openCreateReview: vi.fn().mockResolvedValue(undefined),
      startCreate: vi.fn().mockResolvedValue(undefined),
      openExtractReview: vi.fn().mockResolvedValue(undefined),
      startExtract: vi.fn().mockResolvedValue(undefined),
    };

    await runQuickActionRequest(
      { kind: "extract", paths: ["/tmp/archive.zip"] },
      DEFAULT_APP_PREFERENCES,
      handlers,
    );

    expect(handlers.openExtractReview).toHaveBeenCalledWith(["/tmp/archive.zip"]);
    expect(handlers.startExtract).not.toHaveBeenCalled();
  });
});
