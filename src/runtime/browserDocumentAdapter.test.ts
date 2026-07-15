import { describe, expect, it, vi } from "vitest";

import { createBrowserDocumentAdapter } from "./browserDocumentAdapter";

describe("browser document adapter", () => {
  it("initializes runtime layout variables and applies custom chrome from the platform profile", () => {
    const fakeDocument = createFakeDocument();
    const adapter = createBrowserDocumentAdapter({
      documentRef: fakeDocument.documentRef,
    });

    adapter.initializeLayout();
    adapter.applyPlatformProfile({ customWindowChrome: true, manualWindowResize: true });

    expect(fakeDocument.toggledClasses).toContainEqual(["custom-window-chrome", true]);
    expect(fakeDocument.toggledClasses).toContainEqual(["manual-window-resize", true]);
    expect(fakeDocument.styleValues["--zmanager-min-window-width"]).toBe("720px");
    expect(fakeDocument.styleValues["--zmanager-statusbar-parts"]).toBe("5");
    expect(adapter.usesCustomWindowChrome()).toBe(true);
    expect(adapter.usesManualWindowResize()).toBe(true);
  });

  it("keeps quick action job mode and display metadata behind the adapter", () => {
    const fakeDocument = createFakeDocument();
    const adapter = createBrowserDocumentAdapter({
      documentRef: fakeDocument.documentRef,
    });

    adapter.applyPlatformProfile({ customWindowChrome: false, manualWindowResize: false });
    adapter.setQuickActionJobMode(true);
    adapter.applyDisplayMetadata({
      documentLanguage: "zh-CN",
      documentDirection: "ltr",
    } as Parameters<typeof adapter.applyDisplayMetadata>[0]);
    adapter.setQuickActionJobMode(false);

    expect(fakeDocument.toggledClasses).toEqual([
      ["custom-window-chrome", false],
      ["manual-window-resize", false],
      ["quick-action-job-mode", true],
      ["quick-action-job-mode", false],
    ]);
    expect(fakeDocument.documentElement.lang).toBe("zh-CN");
    expect(fakeDocument.documentElement.dir).toBe("ltr");
    expect(adapter.usesCustomWindowChrome()).toBe(false);
    expect(adapter.usesManualWindowResize()).toBe(false);
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
