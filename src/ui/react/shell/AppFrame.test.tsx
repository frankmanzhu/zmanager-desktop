import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
} from "../appRuntime";
import { AppFrame } from "./AppFrame";

describe("React AppFrame shell", () => {
  it("renders shell chrome from the app runtime snapshot", () => {
    const store = createZManagerAppStore(createInitialZManagerReactSnapshot());

    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement(
          AppFrame,
          null,
          createElement("section", { className: "path-bar" }),
          createElement("section", { className: "browser-shell" }),
        ),
      ),
    );

    expect(html).toContain("<main");
    expect(html).toContain('data-mode="compress"');
    expect(html).toContain('data-shell-chrome="title"');
    expect(html).toContain('data-shell-chrome="menu"');
    expect(html).toContain('data-shell-chrome="toolbar"');
    expect(html).toContain('id="mode-compress"');
    expect(html).toContain('id="add-archive"');
    expect(html).toContain('id="browse-create-destination"');
    expect(html).toContain("Output Folder...");
    expect(html).toContain('id="start-create"');
    expect(html).toContain("Table actions");
    expect(html).not.toContain("Source actions");
    expect(html).toContain('id="include-all-sources"');
    expect(html).toContain('id="exclude-all-sources"');
    expect(html).toContain('id="clear-sources"');
    expect(html).not.toContain('id="new-archive"');
    expect(html).not.toContain('id="create-destination-recent"');
    expect(html).not.toContain('id="open-archive"');
    expect(html).not.toContain('id="extract-toolbar"');
    expect(html).toContain('id="status-job-button"');
    expect(html).not.toContain('id="drop-overlay"');
  });

  it("renders extract-mode toolbar commands without compress controls", () => {
    const initialSnapshot = createInitialZManagerReactSnapshot();
    const store = createZManagerAppStore(
      createZManagerReactSnapshot({
        ...initialSnapshot,
        shell: {
          ...initialSnapshot.shell,
          activeMode: "extract",
        },
      }),
    );

    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement(AppFrame, null, createElement("section")),
      ),
    );

    expect(html).toContain('id="open-archive"');
    expect(html).toContain("Open archive");
    expect(html).toContain('id="close-archive"');
    expect(html).toContain("Close Archive");
    expect(html).toContain('data-command-group="extract"');
    expect(html).toContain('id="extract-all"');
    expect(html).toContain('id="extract-selected"');
    expect(html).toContain("Extract All");
    expect(html).toContain('id="test-archive"');
    expect(html).toContain('id="toolbar-view"');
    expect(html).toContain('id="copy-toolbar"');
    expect(html).toContain('id="info-toolbar"');
    expect(html).toContain('id="toolbar-refresh"');
    expect(html).toContain('id="toolbar-selectAll"');
    expect(html).toContain('id="toolbar-flatView"');
    expect(html).not.toContain('id="add-archive"');
    expect(html).not.toContain('id="new-archive"');
    expect(html).not.toContain('id="browse-create-destination"');
    expect(html).not.toContain('id="start-create"');
    expect(html).not.toContain('id="include-all-sources"');
    expect(html).not.toContain('id="exclude-all-sources"');
    expect(html).not.toContain('id="clear-sources"');
  });

  it("omits workspace mode before the runtime bridge is ready", () => {
    const store = createZManagerAppStore(createInitialZManagerReactSnapshot());

    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement(
          AppFrame,
          { runtimeBridgeReady: false },
          createElement("section"),
        ),
      ),
    );

    expect(html).toContain("<main");
    expect(html).not.toContain('data-mode="compress"');
  });
});
