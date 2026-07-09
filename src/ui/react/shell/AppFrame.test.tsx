import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import { createInitialZManagerReactSnapshot } from "../appRuntime";
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

    expect(html).toContain('class="workspace"');
    expect(html).toContain('class="window-titlebar"');
    expect(html).toContain('class="app-menu"');
    expect(html).toContain('class="command-toolbar mode-toolbar');
    expect(html).toContain('id="mode-compress"');
    expect(html).toContain('data-command-id="open"');
    expect(html).toContain('id="status-job-button"');
    expect(html).toContain('id="drop-overlay"');
  });
});
