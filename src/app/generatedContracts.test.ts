import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/contracts/native-contracts.conformance.json";
import { SHELL_ACTION_IDS, SHELL_ACTION_POLICIES } from "../api/generated/shellActions.generated";
import { baseNameWithoutKnownArchiveExtension, getKnownArchiveSuffix, isSupportedArchivePath } from "./archiveFileTypes";

describe("generated native contracts", () => {
  it("matches shared action ordering and multiplicity", () => {
    expect(SHELL_ACTION_IDS).toEqual(fixture.actionOrder);
    expect(SHELL_ACTION_POLICIES.map((policy) => policy.order)).toEqual([...SHELL_ACTION_POLICIES].map((policy) => policy.order).sort((a, b) => a - b));
    expect(SHELL_ACTION_POLICIES.find((policy) => policy.id === "compressCleanSource")?.multiplicity).toBe("exactly-one");
  });

  it.each(fixture.archivePaths)("matches compound and split suffix policy for $path", ({ path, supported, suffix, baseName }) => {
    expect(isSupportedArchivePath(path)).toBe(supported);
    expect(getKnownArchiveSuffix(path)).toBe(suffix);
    expect(baseNameWithoutKnownArchiveExtension(path)).toBe(baseName);
  });
});
