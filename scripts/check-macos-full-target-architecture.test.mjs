import assert from "node:assert/strict";
import test from "node:test";
import {
  cssFileViolation,
  sourceViolations,
} from "./check-macos-full-target-architecture.mjs";

test("rejects navigator-based frontend operating-system selection", () => {
  assert.match(sourceViolations("fixture.ts", "const os = navigator.userAgent;").join("\n"), /frontend OS detection/);
  assert.match(sourceViolations("fixture.ts", "navigator.platform").join("\n"), /frontend OS detection/);
  assert.match(sourceViolations("fixture.ts", "navigator.userAgentData").join("\n"), /frontend OS detection/);
});

test("rejects imperative GUI, inline styles, and standalone DOM wiring", () => {
  const result = sourceViolations("fixture.tsx", "document.createElement('div'); root.addEventListener('click', f); <div style={{ color: 'red' }} />").join("\n");
  assert.match(result, /imperative HTML rendering/);
  assert.match(result, /DOM listeners/);
  assert.match(result, /inline styles/);
});

test("a changed legacy surface must shrink its allowed violations", () => {
  const text = "root.addEventListener('click', f);";
  const result = sourceViolations("legacy.ts", text, { sha256: "not-the-hash", eventListeners: 1, inlineStyles: 0 }).join("\n");
  assert.match(result, /did not shrink DOM listeners/);
});

test("accepts a Tailwind-only inventory after legacy CSS deletion", () => {
  const allowlist = {
    legacyCss: null,
    tailwindEntrypoints: ["src/styles.tailwind.css"],
  };
  assert.equal(cssFileViolation("src/styles.tailwind.css", allowlist), null);
  assert.match(
    cssFileViolation("src/new-raw.css", allowlist),
    /new raw CSS file is forbidden/,
  );
});
