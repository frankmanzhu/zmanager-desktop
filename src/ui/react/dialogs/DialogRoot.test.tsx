import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  type ZManagerDialogSnapshot,
} from "../appRuntime";
import { DialogRoot } from "./DialogRoot";

function renderDialog(
  dialog: ZManagerDialogSnapshot,
  currentArchivePath = "",
): string {
  const initial = createInitialZManagerReactSnapshot();
  const store = createZManagerAppStore({
    ...initial,
    archive: {
      ...initial.archive,
      currentArchivePath,
    },
    dialog,
  });

  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(DialogRoot),
    ),
  );
}

describe("DialogRoot", () => {
  it("renders extract form controls without snapshot password values", () => {
    const html = renderDialog({
      kind: "extract",
      mode: "archive",
      title: "Extract",
      message: "Choose a destination.",
      startLabel: "Extract",
      destination: "C:/out",
      destinationHistory: ["C:/out"],
      useSubfolder: false,
      subfolder: "",
      pathMode: "full",
      overwrite: "refuse",
      stripComponents: "0",
      deduplicateRoot: false,
      tzapRestorePolicy: "portable",
      tzapAllowDegraded: false,
      tzapAllowAbsoluteSymlinks: false,
      passwordPromptOpen: false,
    });

    expect(html).toContain('role="dialog"');
    expect(html).toContain('id="extract-destination"');
    expect(html).toContain('id="extract-start"');
    expect(html).not.toContain("passwordValue");
    expect(html).not.toContain("correct horse");
  });

  it("renders TZAP metadata policy controls for TZAP archives", () => {
    const html = renderDialog(
      {
        kind: "extract",
        mode: "archive",
        title: "Extract",
        message: "Choose a destination.",
        startLabel: "Extract",
        destination: "/tmp/out",
        destinationHistory: [],
        useSubfolder: false,
        subfolder: "",
        pathMode: "full",
        overwrite: "refuse",
        stripComponents: "0",
        deduplicateRoot: false,
        tzapRestorePolicy: "system",
        tzapAllowDegraded: true,
        tzapAllowAbsoluteSymlinks: false,
        passwordPromptOpen: false,
      },
      "/tmp/backup.tzap",
    );

    expect(html).toContain('id="browse-tzap-restore-policy"');
    expect(html).toContain("numeric user/group ownership");
    expect(html).toContain("Allow degraded metadata restore");
  });

  it("renders info rows and actions from a serializable model", () => {
    const html = renderDialog({
      kind: "info",
      title: "Entry Info",
      description: "Archive or entry details.",
      sectionTitle: "Entry Info",
      rows: [{ label: "Path", value: "docs/readme.txt", mode: "middle" }],
      actions: [{ label: "Copy Path", copyValue: "docs/readme.txt" }],
      returnFocusPath: "docs/readme.txt",
    });

    expect(html).toContain("Entry Info");
    expect(html).toContain("docs/readme.txt");
    expect(html).toContain(">Copy Path</button>");
    expect(html).not.toContain("data-info-action");
    expect(html).not.toContain("data-copy-value");
  });

  it("renders about diagnostics groups", () => {
    const html = renderDialog({
      kind: "about",
      title: "About ZManager",
      groups: [
        {
          title: "Runtime",
          rows: [["Shell", "browser preview"]],
        },
      ],
    });

    expect(html).toContain("About ZManager");
    expect(html).toContain('data-diagnostics-group="true"');
    expect(html).toContain("browser preview");
    expect(html).toContain('id="copy-diagnostics"');
  });
});
