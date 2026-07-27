import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollIntoView — Radix Select uses it.
// Must be set before any component that uses Radix is rendered.
Element.prototype.scrollIntoView = vi.fn();
