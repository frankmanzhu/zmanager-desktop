import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { preferencesWithPatch } from "../../../app/preferences";
import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  createZManagerReactSnapshot,
  noopZManagerReactActions,
  type ZManagerReactSnapshot,
} from "../appRuntime";
import { PreferencesDialog } from "./PreferencesDialog";

describe("React preferences dialog", () => {
  it("renders preference pages and draft controls", () => {
    const html = renderPreferences(preferencesSnapshot());

    expect(html).toContain('role="dialog"');
    expect(html).toContain('id="preferences-title"');
    expect(html).toContain('data-pref-page-target="folders"');
    expect(html).toContain('data-pref-page="folders"');
    expect(html).toContain('id="pref-output-location"');
    expect(html).toContain('id="pref-default-format"');
    expect(html).toContain('id="pref-language"');
    expect(html).toContain('id="preferences-save"');
  });

  it("disables save and validates when custom output is selected without a path", () => {
    const html = renderPreferences(preferencesSnapshot({
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: "",
    }));

    expect(html).toContain('id="preferences-save" type="button" disabled=""');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Choose a custom output folder before saving.");
  });

  it("renders long custom output paths in middle-truncated display form", () => {
    const longPath = "C:/Users/frankzhu/Documents/Projects/ZManager/Exports/Quarterly/Archive Output";
    const html = renderPreferences(preferencesSnapshot({
      defaultOutputLocation: "customFolder",
      customOutputFolderPath: longPath,
    }));

    expect(html).toContain('title="C:/Users/frankzhu/Documents/Projects/ZManager/Exports/Quarterly/Archive Output"');
    expect(html).toContain("C:/Users/frankzhu/Doc...rchive Output");
  });
});

function renderPreferences(snapshot: ZManagerReactSnapshot): string {
  const store = createZManagerAppStore(snapshot, noopZManagerReactActions);
  return renderToStaticMarkup(
    createElement(
      ZManagerAppRuntimeProvider,
      { store },
      createElement(PreferencesDialog),
    ),
  );
}

function preferencesSnapshot(patch: Partial<ZManagerReactSnapshot["preferences"]> = {}): ZManagerReactSnapshot {
  const initial = createInitialZManagerReactSnapshot();
  const draft = preferencesWithPatch(initial.preferences, patch);
  return createZManagerReactSnapshot({
    ...initial,
    preferencesDraft: draft,
  });
}
