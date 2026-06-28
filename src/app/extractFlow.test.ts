import { describe, expect, it } from "vitest";

import { buildStartExtractRequest } from "./extractFlow";

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
});
