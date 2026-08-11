import { expect, test } from "@playwright/test";

test("failed Disposable Task keeps task content as the designated scroll owner", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 540 });
  await page.goto(
    "/?surface=disposable-task&jobId=e2e-failed-task&kind=zipExtract&status=failed&createdAt=2026-08-11T00%3A00%3A00Z",
  );

  const taskContent = page.locator("[data-task-content]");
  await expect(taskContent).toBeVisible();
  await expect(
    taskContent.locator("div[role=alert]").filter({ hasText: "Task failed" }),
  ).toBeVisible();

  const layout = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>("[data-task-content]");
    const surface = document.querySelector<HTMLElement>("main");
    if (!content || !surface) {
      throw new Error("Disposable Task surface markers are missing.");
    }

    const scrollOwners = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 2
        );
      })
      .map((element) => element.dataset.taskContent !== undefined ? "task-content" : element.tagName.toLowerCase());

    return {
      viewportHeight: window.innerHeight,
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      surfaceHeight: surface.getBoundingClientRect().height,
      surfaceScrollHeight: surface.scrollHeight,
      surfaceClientHeight: surface.clientHeight,
      contentOverflowY: window.getComputedStyle(content).overflowY,
      scrollOwners,
    };
  });

  expect(layout.surfaceHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.surfaceScrollHeight).toBeLessThanOrEqual(layout.surfaceClientHeight + 2);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.contentOverflowY).toMatch(/auto|scroll/);
  expect(layout.scrollOwners).toEqual([]);
});

test("long Disposable Task failures use the bounded marked details exception", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 540 });
  await page.goto(
    "/?surface=disposable-task&fixture=long-task-error&jobId=e2e-long-failed-task&kind=zipExtract&status=queued&createdAt=2026-08-11T00%3A00%3A00Z",
  );

  const taskContent = page.locator("[data-task-content]");
  const details = page.locator('[data-dialog-nested-scroll="details"]');
  await expect(taskContent).toBeVisible();
  await expect(details).toBeVisible();
  await expect(details).toHaveCSS("max-height", "160px");

  const layout = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>("[data-task-content]");
    const surface = document.querySelector<HTMLElement>("main");
    const details = document.querySelector<HTMLElement>("[data-dialog-nested-scroll='details']");
    if (!content || !surface || !details) {
      throw new Error("Long task fixture markers are missing.");
    }

    const scrollOwners = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 2
        );
      })
      .map((element) => {
        if (element.matches("[data-dialog-nested-scroll='details']")) return "details";
        if (element.closest("[data-task-content]")) return "task-content";
        return element.tagName.toLowerCase();
      });

    return {
      viewportHeight: window.innerHeight,
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      surfaceScrollHeight: surface.scrollHeight,
      surfaceClientHeight: surface.clientHeight,
      contentOverflowY: window.getComputedStyle(content).overflowY,
      detailsScrollHeight: details.scrollHeight,
      detailsClientHeight: details.clientHeight,
      scrollOwners,
    };
  });

  expect(layout.surfaceScrollHeight).toBeLessThanOrEqual(layout.surfaceClientHeight + 2);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.contentOverflowY).toMatch(/auto|scroll/);
  expect(layout.detailsScrollHeight).toBeGreaterThan(layout.detailsClientHeight + 2);
  expect(layout.scrollOwners).toEqual(expect.arrayContaining(["details"]));
  expect(layout.scrollOwners).not.toContain("body");
  expect(layout.scrollOwners).not.toContain("html");
});
