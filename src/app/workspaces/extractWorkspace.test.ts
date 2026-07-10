import { describe, expect, it } from "vitest";

import { createExtractWorkspace, extractModeForSelection } from "./extractWorkspace";

describe("extract workspace", () => {
  const defaults = {
    destinationPath: "C:/output/photos",
    pathMode: "full" as const,
    overwrite: "ask" as const,
    stripComponents: 0,
    deduplicateRoot: false,
  };

  it("applies global defaults and tracks explicit overrides", () => {
    const workspace = createExtractWorkspace(defaults);

    expect(workspace.getSnapshot()).toMatchObject({
      ...defaults,
      usesGlobalDefaults: true,
      passwordPromptOpen: false,
    });

    expect(workspace.setOptions({ overwrite: "rename", destinationPath: "D:/custom" })).toMatchObject({
      destinationPath: "D:/custom",
      overwrite: "rename",
      usesGlobalDefaults: false,
    });
    expect(workspace.resetToDefaults()).toMatchObject({
      ...defaults,
      usesGlobalDefaults: true,
    });
  });

  it("keeps passwords transient and only places them in request input", () => {
    const workspace = createExtractWorkspace(defaults);
    workspace.setOptions({ passwordPromptOpen: true, stripComponents: 2 });

    expect(workspace.getSnapshot()).not.toHaveProperty("password");
    expect(workspace.buildStartInput(" secret ")).toEqual({
      destinationBasePath: "C:/output/photos",
      useSubfolder: false,
      subfolder: "",
      pathMode: "full",
      overwrite: "ask",
      stripComponents: "2",
      deduplicateRoot: false,
      password: "secret",
    });
  });

  it("uses the current selection to choose the direct extraction mode", () => {
    expect(extractModeForSelection(0)).toBe("archive");
    expect(extractModeForSelection(2)).toBe("selection");
  });
});
