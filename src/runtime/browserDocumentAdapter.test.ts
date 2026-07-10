import { describe, expect, it, vi } from "vitest";

import { createBrowserDocumentAdapter } from "./browserDocumentAdapter";

describe("browser document adapter", () => {
  it("initializes runtime layout variables and Linux chrome class", () => {
    const fakeDocument = createFakeDocument();
    const adapter = createBrowserDocumentAdapter({
      documentRef: fakeDocument.documentRef,
      navigatorRef: { userAgent: "Mozilla/5.0 Linux x86_64" },
      isDesktopRuntime: () => true,
    });

    adapter.initializeLayout();

    expect(fakeDocument.addedClasses).toContain("linux-window-chrome");
    expect(fakeDocument.styleValues["--zmanager-min-window-width"]).toBe("720px");
    expect(fakeDocument.styleValues["--zmanager-statusbar-parts"]).toBe("5");
    expect(adapter.usesLinuxWindowChrome()).toBe(true);
  });

  it("keeps quick action job mode and display metadata behind the adapter", () => {
    const fakeDocument = createFakeDocument();
    const adapter = createBrowserDocumentAdapter({
      documentRef: fakeDocument.documentRef,
      navigatorRef: { userAgent: "Mozilla/5.0 Windows" },
      isDesktopRuntime: () => true,
    });

    adapter.setQuickActionJobMode(true);
    adapter.applyDisplayMetadata({
      documentLanguage: "zh-CN",
      documentDirection: "ltr",
    } as Parameters<typeof adapter.applyDisplayMetadata>[0]);
    adapter.setQuickActionJobMode(false);

    expect(fakeDocument.toggledClasses).toEqual([
      ["quick-action-job-mode", true],
      ["quick-action-job-mode", false],
    ]);
    expect(fakeDocument.documentElement.lang).toBe("zh-CN");
    expect(fakeDocument.documentElement.dir).toBe("ltr");
    expect(adapter.usesLinuxWindowChrome()).toBe(false);
  });
});

function createFakeDocument() {
  const styleValues: Record<string, string> = {};
  const addedClasses: string[] = [];
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
      add: vi.fn((name: string) => {
        addedClasses.push(name);
      }),
      toggle: vi.fn((name: string, active: boolean) => {
        toggledClasses.push([name, active]);
        return active;
      }),
    },
  };

  return {
    addedClasses,
    documentElement,
    styleValues,
    toggledClasses,
    documentRef: {
      body,
      documentElement,
    } as unknown as Document,
  };
}
