import { describe, expect, it, vi } from "vitest";

import { createBrowserDocumentAdapter } from "./browserDocumentAdapter";

describe("browser document adapter", () => {
  it("initializes runtime layout variables and applies custom chrome from the platform profile", () => {
    const fakeDocument = createFakeDocument();
    const adapter = createBrowserDocumentAdapter({
      documentRef: fakeDocument.documentRef,
    });

    adapter.initializeLayout();
    adapter.setCustomWindowChrome(true);
    adapter.setNativeMenuBar(false);

    expect(fakeDocument.toggledClasses).toContainEqual(["custom-window-chrome", true]);
    expect(fakeDocument.toggledClasses).toContainEqual(["manual-window-resize", true]);
    expect(fakeDocument.toggledClasses).toContainEqual(["native-menu-bar", false]);
    expect(fakeDocument.styleValues["--zmanager-min-window-width"]).toBe("720px");
    expect(fakeDocument.styleValues["--zmanager-statusbar-parts"]).toBe("5");
    expect(adapter.usesCustomWindowChrome()).toBe(true);
    expect(adapter.usesManualWindowResize()).toBe(true);
  });

});

function createFakeDocument() {
  const styleValues: Record<string, string> = {};
  const toggledClasses: Array<[string, boolean]> = [];
  const documentElement = {
    lang: "",
    dir: "",
    style: {
      setProperty: vi.fn((name: string, value: string) => {
        styleValues[name] = value;
      }),
    },
  };
  const body = {
    classList: {
      toggle: vi.fn((name: string, active: boolean) => {
        toggledClasses.push([name, active]);
        return active;
      }),
    },
  };

  return {
    documentElement,
    styleValues,
    toggledClasses,
    documentRef: {
      body,
      documentElement,
    } as unknown as Document,
  };
}
