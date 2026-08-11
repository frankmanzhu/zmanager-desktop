import { expect, type Page } from "@playwright/test";

export type DesktopDialogLayout = Readonly<{
  surface: { top: number; bottom: number; height: number; scrollHeight: number; clientHeight: number };
  content: { top: number; bottom: number; height: number; scrollHeight: number; clientHeight: number; overflowY: string };
  header: { top: number; bottom: number };
  footer: { top: number; bottom: number } | null;
  document: { width: number; height: number };
  appRoot: { width: number; height: number } | null;
  unexpectedScrollOwners: readonly string[];
}>;

export async function measureDesktopDialogLayout(
  page: Page,
): Promise<DesktopDialogLayout> {
  return page.locator("[data-dialog-surface]").evaluate((surface) => {
    const content = surface.querySelector<HTMLElement>("[data-dialog-content]");
    const header = surface.querySelector<HTMLElement>("header");
    const footer = surface.querySelector<HTMLElement>("footer");
    if (!content || !header) {
      throw new Error("DesktopDialog must expose header and content markers.");
    }
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    return {
      surface: {
        ...rect(surface as HTMLElement),
        scrollHeight: (surface as HTMLElement).scrollHeight,
        clientHeight: (surface as HTMLElement).clientHeight,
      },
      content: {
        ...rect(content),
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        overflowY: window.getComputedStyle(content).overflowY,
      },
      header: rect(header),
      footer: footer ? rect(footer) : null,
      document: {
        width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      },
      appRoot: (() => {
        const root = document.querySelector<HTMLElement>("#root");
        if (!root) {
          return null;
        }
        return {
          width: root.scrollWidth,
          height: root.scrollHeight,
        };
      })(),
      unexpectedScrollOwners: Array.from(
        (surface as HTMLElement).querySelectorAll<HTMLElement>("*")
      ).filter((element) => {
        if (
          element.matches("[data-dialog-content]") ||
          element.closest("[data-dialog-nested-scroll]")
        ) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 2
        );
      }).map((element) => element.id || element.tagName.toLowerCase()),
    };
  });
}

export async function auditDesktopDialogLayout(page: Page): Promise<void> {
  const layout = await measureDesktopDialogLayout(page);
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("A viewport is required for desktop dialog auditing.");
  }
  const tolerance = 2;

  expect(layout.surface.top, "dialog top is inside viewport").toBeGreaterThanOrEqual(-tolerance);
  expect(layout.surface.bottom, "dialog bottom is inside viewport").toBeLessThanOrEqual(viewport.height + tolerance);
  expect(layout.surface.scrollHeight, "dialog surface is not a scroll owner").toBeLessThanOrEqual(layout.surface.clientHeight + tolerance);
  expect(layout.surface.bottom - layout.surface.top, "dialog surface remains intrinsic or capped").toBeLessThanOrEqual(viewport.height - 48 + tolerance);
  expect(layout.unexpectedScrollOwners, "dialog has no unmarked nested scroll owners").toEqual([]);
  expect(layout.content.overflowY, "primary content owns vertical overflow").toMatch(/auto|scroll/);
  expect(layout.document.width, "document has no accidental horizontal overflow").toBeLessThanOrEqual(viewport.width + tolerance);
  expect(layout.document.height, "document has no accidental vertical overflow").toBeLessThanOrEqual(viewport.height + tolerance);
  if (layout.appRoot) {
    expect(layout.appRoot.width, "app root has no accidental horizontal overflow").toBeLessThanOrEqual(viewport.width + tolerance);
    expect(layout.appRoot.height, "app root has no accidental vertical overflow").toBeLessThanOrEqual(viewport.height + tolerance);
  }

  if (layout.footer) {
    expect(layout.footer.bottom, "dialog footer remains visible").toBeLessThanOrEqual(viewport.height + tolerance);
  }
  const invalidControls = page.locator('[data-dialog-surface] [aria-invalid="true"]');
  for (let index = 0; index < await invalidControls.count(); index += 1) {
    const control = invalidControls.nth(index);
    const describedBy = await control.getAttribute("aria-describedby");
    expect(describedBy, "invalid controls reference a description").toBeTruthy();
    for (const id of describedBy?.split(/\s+/) ?? []) {
      if (id) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
    }
    await expect(control).toBeInViewport({ ratio: 0.5 });
  }
}

export async function auditWorkspaceContentLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("A viewport is required for workspace layout auditing.");
  }

  const layout = await page.locator("[data-workspace-content]").evaluate((region) => {
    const element = region as HTMLElement;
    const root = document.querySelector<HTMLElement>("#root");
    return {
      overflowY: window.getComputedStyle(element).overflowY,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      rootWidth: root?.scrollWidth ?? null,
      rootHeight: root?.scrollHeight ?? null,
    };
  });

  expect(layout.overflowY, "workspace content owns vertical overflow").toMatch(/auto|scroll/);
  expect(layout.documentWidth, "document has no workspace horizontal overflow").toBeLessThanOrEqual(viewport.width + 2);
  expect(layout.documentHeight, "document has no workspace vertical overflow").toBeLessThanOrEqual(viewport.height + 2);
  if (layout.rootWidth !== null) {
    expect(layout.rootWidth, "app root has no workspace horizontal overflow").toBeLessThanOrEqual(viewport.width + 2);
  }
  if (layout.rootHeight !== null) {
    expect(layout.rootHeight, "app root has no workspace vertical overflow").toBeLessThanOrEqual(viewport.height + 2);
  }
}
