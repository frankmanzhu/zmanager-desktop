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

type JobStateFixture = {
  snapshot: {
    jobId: string;
    kind: string;
    status: string;
    createdAt: string;
    canDismiss: boolean;
    events: unknown[];
    terminalSummary: {
      writtenEntries: number;
      skippedEntries: number | null;
      writtenBytes: number;
      warnings: string[];
    } | null;
  };
  events: unknown[];
};

declare global {
  interface Window {
    __zmanagerDev?: {
      loadArchiveFixture: (fixture: ArchiveFixture) => void;
      setSystemIconFixtures: (fixtures: Record<string, string | null>) => void;
      setJobFixtures: (fixtures: JobStateFixture[]) => void;
      openSurface: (surface: "about" | "preferences" | "info" | "jobs") => void;
      closeModal: () => void;
    };
    __TAURI_EVENT_PLUGIN_INTERNALS__?: {
      unregisterListener: (event: string, id: number) => void;
    };
    __TAURI_INTERNALS__?: Record<string, unknown>;
    isTauri?: boolean;
  }
}

const auditDir = "docs/gui-audit";

const nativeImageIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23f9fafb'/%3E%3Crect x='32' y='32' width='192' height='192' rx='18' fill='%2393c5fd'/%3E%3Ccircle cx='180' cy='82' r='24' fill='%23eff6ff'/%3E%3Cpath d='M48 208l60-78 42 48 28-34 34 64z' fill='%230284c7'/%3E%3C/svg%3E";
const nativeFileIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M56 20h94l50 50v166H56z' fill='%23ffffff' stroke='%236b7280' stroke-width='14'/%3E%3Cpath d='M150 20v58h50' fill='%23e5e7eb'/%3E%3C/svg%3E";
const nativeFolderIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M18 72h84l22 28h114v112H18z' fill='%23fbbf24'/%3E%3Cpath d='M18 92h220v120H18z' fill='%23f59e0b'/%3E%3C/svg%3E";

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

const jobsFixture: JobStateFixture[] = [
  {
    snapshot: {
      jobId: "job-create-complete",
      kind: "zipCreate",
      status: "completed",
      createdAt: "2026-06-28T01:00:00Z",
      canDismiss: true,
      events: [],
      terminalSummary: {
        writtenEntries: 3,
        skippedEntries: null,
        writtenBytes: 124_928,
        warnings: [],
      },
    },
    events: [
      { eventType: "started", jobKind: "zipCreate", message: "Creating archive." },
      { eventType: "completed", jobKind: "zipCreate", message: "Archive created." },
    ],
  },
  {
    snapshot: {
      jobId: "job-extract-running",
      kind: "zipExtract",
      status: "running",
      createdAt: "2026-06-28T01:01:00Z",
      canDismiss: false,
      events: [],
      terminalSummary: null,
    },
    events: [
      { eventType: "started", totalBytes: 200_000, message: "Extracting." },
      { eventType: "entryStarted", path: "documents/quarterly-review.pdf" },
      { eventType: "bytesProcessed", totalBytesProcessed: 84_000, totalBytes: 200_000 },
    ],
  },
  {
    snapshot: {
      jobId: "job-test-failed",
      kind: "zipTest",
      status: "failed",
      createdAt: "2026-06-28T01:02:00Z",
      canDismiss: true,
      events: [],
      terminalSummary: null,
    },
    events: [
      { eventType: "failed", code: "io_error", message: "Unable to read central directory." },
    ],
  },
];

test.beforeEach(async ({ page }) => {
  await installTauriStub(page);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__zmanagerDev));
});

test("primary GUI states have visible, non-overlapping controls", async ({ page }) => {
  await captureAndScan(page, "03-compress-empty");
  await captureReadmeHero(page, "00-readme-hero", ".workspace");

  await dragFiles(page, ["draft.zip"]);
  await expect(page.locator("#drop-overlay")).toHaveAttribute("aria-hidden", "false");
  await captureAndScan(page, "25-compress-drop-overlay");
  await dragLeave(page);

  await dropFiles(page, ["desktop-archive-source.zip", "quarterly-report.pdf", "photos-folder"]);
  await expect(page.locator("#compress-source-body tr")).toHaveCount(3);
  await captureAndScan(page, "04-compress-with-sources");

  await expect(page.locator("#compress-options-panel")).toBeVisible();
  await captureAndScan(page, "05-create-dialog");

  await page.locator("#compress-options-panel details.advanced-options summary").click();
  await page.locator("#create-format").selectOption("sevenZ");
  await page.locator("#create-volume").fill("1048576");
  await page.locator("#create-password").fill("correct horse battery staple");
  await page.locator("#create-password-confirm").fill("correct horse battery staple");
  await page.locator("#create-show-password").check();
  await captureAndScan(page, "27-create-dialog-advanced-options");

  await page.getByRole("tab", { name: "Extract" }).click();
  await captureAndScan(page, "06-extract-empty");

  await dragFiles(page, ["sample.zip"]);
  await expect(page.locator("#drop-overlay")).toHaveAttribute("aria-hidden", "false");
  await captureAndScan(page, "28-extract-drop-overlay");
  await dragLeave(page);

  await page.evaluate((fixture) => window.__zmanagerDev?.loadArchiveFixture(fixture), archiveFixture);
  await page.evaluate((fixtures) => window.__zmanagerDev?.setSystemIconFixtures(fixtures), {
    directory: nativeFolderIcon,
    "file:.pdf": nativeFileIcon,
    "file:.png": nativeImageIcon,
    "file:.txt": nativeFileIcon,
    "file:.zip": nativeFileIcon,
  });
  await expect(page.locator('tr[data-entry-path="documents"]')).toBeVisible();
  await expect(page.locator(".row-icon-native-image").first()).toBeVisible();
  await captureAndScan(page, "07-extract-with-archive");

  await page.locator('tr[data-entry-path="documents"] .row-name').click();
  await expect(page.getByRole("button", { name: "Extract" })).toBeVisible();
  await page.getByRole("button", { name: "Extract" }).click();
  await expect(page.getByRole("dialog", { name: "Extract" })).toBeVisible();
  await captureAndScan(page, "08-extract-dialog");
  await page.locator("#extract-cancel").click();

  await page.locator('tr[data-entry-path="documents"]').click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await captureAndScan(page, "09-entry-context-menu");
});

test("secondary GUI surfaces have visible, bounded controls", async ({ page }) => {
  await openDevSurface(page, "jobs");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "false");
  await captureAndScan(page, "29-jobs-drawer-empty");
  await closeDevSurface(page);

  await openDevSurface(page, "preferences");
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible();
  await captureAndScan(page, "10-preferences-dialog");

  await page.locator("#pref-output-location").selectOption("customFolder");
  await page.locator("#pref-custom-output").fill("C:/Users/frankzhu/Desktop/ZManager Output");
  await captureAndScan(page, "30-preferences-custom-output");
  await closeDevSurface(page);

  await openDevSurface(page, "about");
  await expect(page.getByRole("dialog", { name: "About ZManager" })).toBeVisible();
  await captureAndScan(page, "11-about-dialog");
  await closeDevSurface(page);

  await page.evaluate((jobs) => window.__zmanagerDev?.setJobFixtures(jobs), jobsFixture);
  await openDevSurface(page, "jobs");
  await expect(page.locator("#job-drawer")).toHaveAttribute("aria-hidden", "false");
  await captureAndScan(page, "12-jobs-drawer-with-terminal-and-running");
  await closeDevSurface(page);

  await page.getByRole("tab", { name: "Extract" }).click();
  await page.locator("#archive-empty-state").click({ button: "right", position: { x: 20, y: 20 } });
  await expect(page.locator("#context-menu")).toBeVisible();
  await captureAndScan(page, "13-extract-empty-context-menu");

  await loadArchiveWithIcons(page);
  await expect(page.locator('tr[data-entry-path="documents"]')).toBeVisible();
  await captureAndScan(page, "14-extract-archive-details");

  await page.locator("th[data-column-id='name']").click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await captureAndScan(page, "15-column-context-menu");

  await page.locator('tr[data-entry-path="documents"] .row-name').click();
  await page.locator('tr[data-entry-path="images"] .row-name').click({ modifiers: ["Control"] });
  await expect(page.locator('tr[data-entry-path="documents"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[data-entry-path="images"]')).toHaveAttribute("aria-selected", "true");
  await captureAndScan(page, "16-multi-selection-details");

  await openDevSurface(page, "info");
  await expect(page.getByRole("dialog", { name: "Archive Info" })).toBeVisible();
  await captureAndScan(page, "17-multi-selection-info-dialog");
  await closeDevSurface(page);

  await page.locator('tr[data-entry-path="images"] .row-name').dblclick();
  await expect(page.locator('tr[data-entry-path="images/product-screenshot.png"]')).toBeVisible();
  await page.locator('tr[data-entry-path="images/product-screenshot.png"] .row-name').click();
  await captureAndScan(page, "18-image-entry-details");

  await openDevSurface(page, "info");
  await expect(page.getByRole("dialog", { name: "Entry Info" })).toBeVisible();
  await captureAndScan(page, "19-image-entry-info-dialog");
  await closeDevSurface(page);

  await page.locator("#search-entries").fill("missing-entry");
  await captureAndScan(page, "20-search-empty-results");

  await page.locator("#search-entries").fill("");
  await page.locator("summary", { hasText: "View" }).click();
  await page.locator("#menu-command-flatView").click();
  await captureAndScan(page, "31-flat-view-with-icons");
});

test("core surfaces remain bounded in a compact viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await captureAndScan(page, "21-compact-compress-empty");

  await dropFiles(page, ["quarterly-report.pdf", "photos-folder"]);
  await captureAndScan(page, "22-compact-compress-with-sources");

  await page.getByRole("tab", { name: "Extract" }).click();
  await loadArchiveWithIcons(page);
  await captureAndScan(page, "23-compact-extract-loaded");

  await openDevSurface(page, "preferences");
  await captureAndScan(page, "24-compact-preferences-dialog");
  await closeDevSurface(page);
});

test("minimum-size visual surfaces stay within the app bounds", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 540 });
  await captureAndScan(page, "32-min-compress-empty");

  await dropFiles(page, [
    "very-long-file-name-that-should-not-break-the-compress-table-layout-report-final.pdf",
    "deeply-nested-folder-with-a-long-name",
  ]);
  await captureAndScan(page, "33-min-compress-long-sources");

  await expect(page.locator("#compress-options-panel")).toBeVisible();
  await captureAndScan(page, "34-min-create-dialog");

  await page.getByRole("tab", { name: "Extract" }).click();
  await loadArchiveWithIcons(page);
  await captureAndScan(page, "35-min-extract-loaded");

  await page.locator('tr[data-entry-path="documents"] .row-name').click();
  await page.getByRole("button", { name: "Extract" }).click();
  await captureAndScan(page, "36-min-extract-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();
});

async function captureAndScan(page: Page, name: string) {
  await page.screenshot({ path: `${auditDir}/${name}.png`, fullPage: false });
  const problems = await scanVisibleLayout(page);
  expect(problems, `${name} layout problems`).toEqual([]);
}

async function captureHero(page: Page, name: string, selector: string) {
  const target = page.locator(selector);
  await expect(target).toBeVisible();
  await target.screenshot({ path: `${auditDir}/${name}.png` });
}

async function captureReadmeHero(page: Page, name: string, selector: string) {
  const originalStatus = await page.locator(".workspace-status").evaluate((element) => element.textContent ?? "");
  try {
    await page.locator(".workspace-status").evaluate((element) => {
      element.textContent = "Ready.";
    });
    await captureHero(page, name, selector);
    const problems = await scanVisibleLayout(page);
    expect(problems, `${name} layout problems`).toEqual([]);
  } finally {
    await page.locator(".workspace-status").evaluate((element, text) => {
      element.textContent = text;
    }, originalStatus);
  }
}

async function loadArchiveWithIcons(page: Page) {
  await page.evaluate((fixture) => window.__zmanagerDev?.loadArchiveFixture(fixture), archiveFixture);
  await page.evaluate((fixtures) => window.__zmanagerDev?.setSystemIconFixtures(fixtures), {
    directory: nativeFolderIcon,
    "file:.pdf": nativeFileIcon,
    "file:.png": nativeImageIcon,
    "file:.txt": nativeFileIcon,
    "file:.zip": nativeFileIcon,
  });
}

async function openDevSurface(page: Page, surface: "about" | "preferences" | "info" | "jobs") {
  await page.evaluate((surfaceName) => window.__zmanagerDev?.openSurface(surfaceName), surface);
}

async function closeDevSurface(page: Page) {
  await page.evaluate(() => window.__zmanagerDev?.closeModal());
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

async function dragFiles(page: Page, names: string[]) {
  await page.evaluate((fileNames) => {
    const dataTransfer = new DataTransfer();
    for (const name of fileNames) {
      dataTransfer.items.add(new File(["fixture"], name));
    }
    const event = new DragEvent("dragenter", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    document.querySelector("#app")?.dispatchEvent(event);
  }, names);
}

async function dragLeave(page: Page) {
  await page.evaluate(() => {
    const event = new DragEvent("dragleave", {
      bubbles: true,
      cancelable: true,
      relatedTarget: document.body,
    });
    document.querySelector("#app")?.dispatchEvent(event);
  });
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

    const isClippedByScrollableAncestor = (element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const canScroll = /(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`);
        if (canScroll && (parent.scrollHeight > parent.clientHeight + 1 || parent.scrollWidth > parent.clientWidth + 1)) {
          const parentRect = parent.getBoundingClientRect();
          return (
            rect.left < parentRect.left - 1 ||
            rect.right > parentRect.right + 1 ||
            rect.top < parentRect.top - 1 ||
            rect.bottom > parentRect.bottom + 1
          );
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const selector = [
      "button",
      "input",
      "select",
      "summary",
      "th",
      ".pane-resizer",
      ".pane-resizer-grip",
      "h1",
      "h2",
      ".compress-empty-state strong",
      ".compress-empty-state span",
      ".archive-empty-copy h2",
      ".archive-empty-copy p",
      ".archive-empty-hint",
      ".workspace-status",
      ".status-bar button",
      "#context-menu [role='menuitem']",
    ].join(",");

    const isRendered = (element: HTMLElement): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.hidden &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const isHitTestVisible = (element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (centerX < 0 || centerY < 0 || centerX > window.innerWidth || centerY > window.innerHeight) {
        return false;
      }
      const hitElement = document.elementFromPoint(centerX, centerY);
      return hitElement !== null && (element === hitElement || element.contains(hitElement) || hitElement.contains(element));
    };

    const isPersistentActionControl = (element: HTMLElement): boolean =>
      element.closest(".dialog-actions,.dialog-footer,.status-bar") !== null;

    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => isRendered(element) && (!isClippedByScrollableAncestor(element) || isPersistentActionControl(element)));

    const problems: string[] = [];

    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (documentWidth > window.innerWidth + 1) {
      problems.push(`page horizontal overflow ${documentWidth} > ${window.innerWidth}`);
    }

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
      if (isPersistentActionControl(element) && isClippedByScrollableAncestor(element)) {
        problems.push(`clipped by scroll container ${element.tagName.toLowerCase()} "${label}"`);
      }
      const rect = element.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) {
        problems.push(`out of viewport ${element.tagName.toLowerCase()} "${label}"`);
      }
    }

    for (const icon of Array.from(document.querySelectorAll<HTMLElement>(".row-icon,.tree-icon,.detail-icon"))) {
      const style = window.getComputedStyle(icon);
      const rect = icon.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        continue;
      }
      const limit = icon.classList.contains("row-icon") ? 19 : 18;
      if (rect.width > limit || rect.height > limit) {
        problems.push(`oversized ${Array.from(icon.classList).join(".")} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }

    for (const jobCard of Array.from(document.querySelectorAll<HTMLElement>(".job-card"))) {
      const subtitle = jobCard.querySelector<HTMLElement>(".job-subtitle")?.textContent ?? "";
      const progress = jobCard.querySelector<HTMLProgressElement>("progress");
      if (!progress) {
        continue;
      }
      if (/\b(COMPLETED|FAILED|CANCELLED)\b/.test(subtitle) && !progress.hasAttribute("value")) {
        problems.push(`terminal job has indeterminate progress "${subtitle.trim()}"`);
      }
    }

    const controls = elements.filter((element) =>
      element.matches("button,input,select,summary,#context-menu [role='menuitem']") && isHitTestVisible(element),
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
            dataUrl: entry.key === "directory"
              ? nativeFolderIcon
              : entry.key === "file:.png" || entry.key === "file:.bmp"
                ? nativeImageIcon
                : nativeFileIcon,
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
