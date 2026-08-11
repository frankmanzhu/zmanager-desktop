import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FieldMessage, fieldValidationProps } from "./field-message";

describe("FieldMessage", () => {
  it("renders a polite visible error and composes the control description", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement("input", {
          id: "output-path",
          ...fieldValidationProps(true, ["output-help", "output-error"]),
        }),
        createElement(FieldMessage, {
          id: "output-error",
          error: "Choose an output folder.",
        }),
      ),
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="output-help output-error"');
    expect(html).toContain('id="output-error"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Choose an output folder.");
    expect(html).not.toContain("hidden=\"\"");
  });

  it("clears invalid state without removing the stable description contract", () => {
    const props = fieldValidationProps(false, ["output-help", "output-error"]);
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement("input", { id: "output-path", ...props }),
        createElement(FieldMessage, { id: "output-error", error: null }),
      ),
    );

    expect(html).not.toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="output-help output-error"');
    expect(html).toContain('id="output-error"');
    expect(html).toContain('hidden=""');
  });
});
