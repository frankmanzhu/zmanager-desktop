import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DesktopDialog } from "./DesktopDialog";
import {
  firstInvalidControl,
  revealFirstInvalidControl,
  scrollFirstInvalidControl,
} from "./dialogInteraction";

describe("DesktopDialog", () => {
  it("renders the stable modal contract without a runtime adapter", () => {
    const html = renderToStaticMarkup(
      createElement(DesktopDialog, {
        titleId: "dialog-title",
        descriptionId: "dialog-description",
        header: createElement("h2", { id: "dialog-title" }, "Title"),
        content: createElement("p", { id: "dialog-description" }, "Body"),
        footer: createElement("button", null, "Close"),
        onEscape() {},
      }),
    );

    expect(html).toContain('data-dialog-surface="true"');
    expect(html).toContain('data-dialog-content="true"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="dialog-title"');
    expect(html).toContain('aria-describedby="dialog-description"');
    expect(html).toContain("max-h-[calc(100vh-48px)]");
    expect(html).toContain("overflow-y-auto");
  });

  it("focuses and reveals the first invalid control in its owned region", () => {
    const region = document.createElement("div");
    const control = document.createElement("input");
    control.setAttribute("aria-invalid", "true");
    region.setAttribute("data-dialog-content", "true");
    region.append(control);
    document.body.append(region);
    Object.defineProperty(region, "clientHeight", { value: 50 });
    Object.defineProperty(region, "getBoundingClientRect", {
      value: () => ({ top: 100, bottom: 150 }),
    });
    Object.defineProperty(control, "getBoundingClientRect", {
      value: () => ({ top: 130, bottom: 190 }),
    });

    expect(firstInvalidControl(region)).toBe(control);
    expect(revealFirstInvalidControl(region)).toBe(control);
    expect(document.activeElement).toBe(control);
    expect(region.scrollTop).toBe(40);
  });

  it("does not change focus merely because a passive dialog notice exists", () => {
    const passiveNotice = document.createElement("button");
    passiveNotice.textContent = "Passive notice";
    document.body.append(passiveNotice);
    passiveNotice.focus();

    const invalid = document.createElement("input");
    invalid.setAttribute("aria-invalid", "true");
    const region = document.createElement("div");
    region.setAttribute("data-dialog-content", "true");
    region.append(invalid);
    document.body.append(region);

    expect(document.activeElement).toBe(passiveNotice);
    expect(firstInvalidControl(region)).toBe(invalid);
  });

  it("reveals an invalid control without delegating scrolling to the document", () => {
    const region = document.createElement("div");
    const control = document.createElement("input");
    const focus = vi.spyOn(control, "focus");
    control.setAttribute("aria-invalid", "true");
    region.setAttribute("data-dialog-content", "true");
    region.append(control);
    document.body.append(region);

    revealFirstInvalidControl(region);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("can reveal an invalid control without changing the active focus", () => {
    const passiveNotice = document.createElement("button");
    document.body.append(passiveNotice);
    passiveNotice.focus();
    const region = document.createElement("div");
    const control = document.createElement("input");
    control.setAttribute("aria-invalid", "true");
    region.setAttribute("data-dialog-content", "true");
    region.append(control);
    document.body.append(region);

    expect(scrollFirstInvalidControl(region)).toBe(control);
    expect(document.activeElement).toBe(passiveNotice);
  });
});
