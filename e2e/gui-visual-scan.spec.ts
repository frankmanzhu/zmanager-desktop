import { expect, test, type Page } from "@playwright/test";

type ArchiveEntryKind = "file" | "directory" | "symlink" | "hardlink" | "special";

type ArchiveEntryFixture = {
  path: string;
  kind: ArchiveEntryKind;
  size?: number;
  compressedSize?: number;
  modified?: string;
};

type ArchiveFixture = {
  archivePath: string;
  entries: ArchiveEntryFixture[];
  entryCount: number;
  totalSize: number;
};

declare global {
  interface Window {
    __zmanagerDev?: {
      loadArchiveFixture: (fixture: ArchiveFixture) => void;
    };
    __TAURI_EVENT_PLUGIN_INTERNALS__?: {
      unregisterListener: (event: string, id: number) => void;
    };
    __TAURI_INTERNALS__?: Record<string, unknown>;
    isTauri?: boolean;
  }
}

const auditDir = "docs/gui-audit";

const archiveFixture: ArchiveFixture = {
  archivePath: "C:/fixtures/visual-scan.zip",
  entryCount: 5,
  totalSize: 151_296,
  entries: [
    {
      path: "documents/quarterly-review.pdf",
      kind: "file",
      size: 81_920,
      compressedSize: 42_008,
      modified: "1781085660",
    },
    {
      path: "documents/notes.txt",
      kind: "file",
      size: 1_024,
      compressedSize: 512,
      modified: "1781085720",
    },
    {
      path: "images/product-screenshot.png",
      kind: "file",
      size: 61_440,
      compressedSize: 55_200,
      modified: "1781085780",
    },
    {
      path: "documents",
      kind: "directory",
      size: 0,
      compressedSize: 0,
      modified: "1781085600",
    },
    {
      path: "images",
      kind: "directory",
      size: 0,
      compressedSize: 0,
      modified: "1781085600",
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await installTauriStub(page);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__zmanagerDev));
});

test("primary GUI states have visible, non-overlapping controls", async ({ page }) => {
  await captureAndScan(page, "03-compress-empty");

  await dropFiles(page, ["desktop-archive-source.zip", "quarterly-report.pdf", "photos-folder"]);
  await expect(page.locator("#compress-source-body tr")).toHaveCount(3);
  await captureAndScan(page, "04-compress-with-sources");

  await page.getByRole("button", { name: "Create Archive" }).click();
  await expect(page.getByRole("dialog", { name: "Add to Archive" })).toBeVisible();
  await captureAndScan(page, "05-create-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("tab", { name: "Extract" }).click();
  await captureAndScan(page, "06-extract-empty");

  await page.evaluate((fixture) => window.__zmanagerDev?.loadArchiveFixture(fixture), archiveFixture);
  await expect(page.locator('tr[data-entry-path="documents"]')).toBeVisible();
  await captureAndScan(page, "07-extract-with-archive");

  await page.locator('tr[data-entry-path="documents"] .row-name').click();
  await expect(page.getByRole("button", { name: "Extract" })).toBeVisible();
  await page.getByRole("button", { name: "Extract" }).click();
  await expect(page.getByRole("dialog", { name: "Extract" })).toBeVisible();
  await captureAndScan(page, "08-extract-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.locator('tr[data-entry-path="documents"]').click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await captureAndScan(page, "09-entry-context-menu");
});

async function captureAndScan(page: Page, name: string) {
  await page.screenshot({ path: `${auditDir}/${name}.png`, fullPage: false });
  const problems = await scanVisibleLayout(page);
  expect(problems, `${name} layout problems`).toEqual([]);
}

async function dropFiles(page: Page, names: string[]) {
  await page.evaluate((fileNames) => {
    const dataTransfer = new DataTransfer();
    for (const name of fileNames) {
      dataTransfer.items.add(new File(["fixture"], name));
    }
    const event = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    document.querySelector("#app")?.dispatchEvent(event);
  }, names);
}

async function scanVisibleLayout(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visibleLabel = (element: HTMLElement): string =>
      (
        element.getAttribute("aria-label") ||
        element.textContent ||
        element.getAttribute("placeholder") ||
        element.getAttribute("title") ||
        element.tagName.toLowerCase()
      ).trim().replace(/\s+/g, " ");

    const overlapArea = (first: DOMRect, second: DOMRect): number => {
      const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      return width * height;
    };

    const selector = [
      "button",
      "input",
      "select",
      "summary",
      "th",
      "h1",
      "h2",
      ".workspace-status",
      ".status-bar button",
      "#context-menu [role='menuitem']",
    ].join(",");

    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hitElement =
          centerX >= 0 &&
          centerY >= 0 &&
          centerX <= window.innerWidth &&
          centerY <= window.innerHeight
            ? document.elementFromPoint(centerX, centerY)
            : null;
        return (
          !element.hidden &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          hitElement !== null &&
          (element === hitElement || element.contains(hitElement) || hitElement.contains(element))
        );
      });

    const problems: string[] = [];

    for (const element of elements) {
      const measuredElement = element.matches("th")
        ? (element.querySelector<HTMLElement>(".column-header-label") ?? element)
        : element;
      const label = visibleLabel(measuredElement);
      const clippedInline = measuredElement.scrollWidth > measuredElement.clientWidth + 1;
      const clippedBlock = measuredElement.scrollHeight > measuredElement.clientHeight + 1;
      if (label && (clippedInline || clippedBlock)) {
        problems.push(`clipped ${element.tagName.toLowerCase()} "${label}"`);
      }
    }

    const controls = elements.filter((element) =>
      element.matches("button,input,select,summary,#context-menu [role='menuitem']"),
    );

    for (let index = 0; index < controls.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < controls.length; nextIndex += 1) {
        const first = controls[index];
        const second = controls[nextIndex];
        if (first.contains(second) || second.contains(first)) {
          continue;
        }
        const overlap = overlapArea(first.getBoundingClientRect(), second.getBoundingClientRect());
        if (overlap > 4) {
          problems.push(`overlap "${visibleLabel(first)}" with "${visibleLabel(second)}"`);
        }
      }
    }

    return problems;
  });
}

async function installTauriStub(page: Page) {
  await page.addInitScript(() => {
    const callbacks = new Map<number, { callback: unknown; once: boolean }>();
    let callbackId = 1;

    const invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      if (cmd === "healthcheck") {
        return {
          engine: "zmanager-core",
          version: "visual-scan",
          ready: true,
          summary: "Visual scan backend stub",
          shell: "playwright",
          status: "ok",
        };
      }

      if (cmd === "project_contract") {
        return {
          commands: ["start_native_file_drag"],
          platformStrategy: "visual-scan",
          coreDependency: "stub",
          platformIntegration: {
            platform: "windows",
            explorerIntegrationEnabled: true,
            desktopActionsEnabled: false,
            associatedExtensions: ["zip"],
            shellActions: [],
          },
        };
      }

      if (cmd === "quick_action_startup_state") {
        return {
          launchedForQuickAction: false,
          quickAction: null,
          error: null,
        };
      }

      if (cmd === "system_file_icons") {
        const request = args.request as { entries?: { key: string }[] } | undefined;
        return {
          icons: (request?.entries ?? []).map((entry) => ({
            key: entry.key,
            dataUrl: null,
          })),
        };
      }

      if (cmd === "start_native_file_drag") {
        return {
          outcome: "dropped",
          draggedEntries: [],
        };
      }

      if (cmd === "cleanup_preview_roots") {
        return undefined;
      }

      if (cmd === "plugin:window|inner_size") {
        return { width: 1280, height: 800 };
      }

      if (cmd === "plugin:window|inner_position") {
        return { x: 0, y: 0 };
      }

      if (cmd === "plugin:event|listen") {
        return args.handler;
      }

      if (cmd === "plugin:event|unlisten" || cmd.startsWith("plugin:window|")) {
        return undefined;
      }

      if (cmd.startsWith("plugin:")) {
        return undefined;
      }

      throw new Error(`Unhandled Tauri command in visual scan stub: ${cmd}`);
    };

    const transformCallback = (callback: unknown, once = false) => {
      const id = callbackId++;
      callbacks.set(id, { callback, once });
      return id;
    };

    const unregisterCallback = (id: number) => {
      callbacks.delete(id);
    };

    const runCallback = (id: number, data: unknown) => {
      const registration = callbacks.get(id);
      if (!registration || typeof registration.callback !== "function") {
        return;
      }
      if (registration.once) {
        callbacks.delete(id);
      }
      registration.callback(data);
    };

    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_event: string, id: number) => unregisterCallback(id),
    };

    window.__TAURI_INTERNALS__ = {
      callbacks,
      convertFileSrc: (path: string) => path,
      invoke,
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      runCallback,
      transformCallback,
      unregisterCallback,
    };

    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI_EVENT_PLUGIN_INTERNALS__;
    delete window.isTauri;
  });
}
