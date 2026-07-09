import { describe, expect, it } from "vitest";

import {
  buildStartExtractRequest,
  resolveExtractStartInput,
} from "./extractFlow";

describe("extract flow helpers", () => {
  it("builds full archive extract requests without selected entry paths", () => {
    expect(
      buildStartExtractRequest({
        archivePath: "C:/tmp/archive.zip",
        destinationPath: "C:/tmp/out",
        overwrite: "replace",
        stripComponents: 0,
        password: "",
      }),
    ).toEqual({
      archivePath: "C:/tmp/archive.zip",
      destinationPath: "C:/tmp/out",
      overwrite: "replace",
      stripComponents: 0,
    });
  });

  it("builds selected extract requests with copied entry paths and password", () => {
    const entryPaths = ["source/hello.txt"];
    const request = buildStartExtractRequest({
      archivePath: "C:/tmp/archive.zip",
      destinationPath: "C:/tmp/out",
      overwrite: "rename",
      entryPaths,
      stripComponents: 1,
      password: "secret",
    });

    entryPaths.push("source/late.txt");

    expect(request).toEqual({
      archivePath: "C:/tmp/archive.zip",
      destinationPath: "C:/tmp/out",
      overwrite: "rename",
      entryPaths: ["source/hello.txt"],
      stripComponents: 1,
      password: "secret",
    });
  });

  it("includes destination collision strategy when requested", () => {
    const request = buildStartExtractRequest({
      archivePath: "C:/tmp/archive.zip",
      destinationPath: "C:/tmp/out",
      overwrite: "rename",
      destinationCollisionStrategy: "rename",
      stripComponents: 0,
    });

    expect(request.destinationCollisionStrategy).toBe("rename");
  });

  it("resolves explicit dialog input into request-ready destination and strip depth", () => {
    const resolved = resolveExtractStartInput({
      destinationBasePath: " C:/tmp/out ",
      useSubfolder: true,
      subfolder: "review",
      pathMode: "current",
      overwrite: "ask",
      stripComponents: "1",
      deduplicateRoot: false,
      password: " secret ",
    }, {
      currentFolder: "docs/releases",
      allEntryPaths: ["root/docs/releases/readme.txt"],
      entryReferences: ["root/docs/releases/readme.txt"],
      joinNativePath: (parent, child) => `${parent}/${child}`,
    });

    expect(resolved).toEqual({
      destination: "C:/tmp/out/review",
      destinationValid: true,
      overwrite: "ask",
      stripComponents: 2,
      password: "secret",
      entryReferences: ["root/docs/releases/readme.txt"],
    });
  });

  it("rejects empty base destinations before subfolder joining", () => {
    const resolved = resolveExtractStartInput({
      destinationBasePath: " ",
      useSubfolder: true,
      subfolder: "ignored",
      pathMode: "full",
      overwrite: "refuse",
      stripComponents: "0",
      deduplicateRoot: false,
    }, {
      currentFolder: "",
      allEntryPaths: ["root/readme.txt"],
      entryReferences: ["root/readme.txt"],
      joinNativePath: (parent, child) => `${parent}/${child}`,
    });

    expect(resolved.destination).toBeNull();
    expect(resolved.destinationValid).toBe(false);
  });

  it("resolves no-paths and duplicated-root stripping from archive references", () => {
    const resolved = resolveExtractStartInput({
      destinationBasePath: "C:/tmp/out",
      useSubfolder: false,
      subfolder: "",
      pathMode: "none",
      overwrite: "rename",
      stripComponents: "0",
      deduplicateRoot: true,
    }, {
      currentFolder: "",
      allEntryPaths: [
        "bundle/docs/readme.txt",
        "bundle/src/main.rs",
      ],
      entryReferences: [],
      joinNativePath: (parent, child) => `${parent}/${child}`,
    });

    expect(resolved.stripComponents).toBe(4);
  });
});
