import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import { createInitialZManagerReactSnapshot, noopZManagerReactActions } from "../appRuntime";
import { AccountWorkspace } from "./AccountWorkspace";

describe("AccountWorkspace", () => {
  it("renders the React account surface from a secret-free snapshot", () => {
    const initial = createInitialZManagerReactSnapshot();
    const store = createZManagerAppStore({
      ...initial,
      account: { ...initial.account, visible: true, notice: "Ready" },
    }, noopZManagerReactActions);
    const html = renderToStaticMarkup(createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(AccountWorkspace),
    ));
    expect(html).toContain("TZAP Account");
    expect(html).toContain("Identity, certificates, recipient keys, and trusted contacts");
    expect(html).not.toContain("access_token");
  });
});
