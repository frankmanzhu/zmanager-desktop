import { describe, expect, it } from "vitest";

import { droppedPathsFromDataTransfer } from "./BrowserFileDropAdapter";

describe("React browser file drop adapter", () => {
  it("normalizes dropped browser files into unknown paths", () => {
    const dataTransfer = {
      files: [
        { path: " C:/archives/demo.zip ", name: "demo.zip" },
        { webkitRelativePath: "photos/raw/image.jpg", name: "image.jpg" },
        { name: "notes.txt" },
        { path: "   ", name: "fallback.txt" },
      ],
    } as unknown as DataTransfer;

    expect(droppedPathsFromDataTransfer(dataTransfer)).toEqual([
      { path: "C:/archives/demo.zip", kind: "unknown" },
      { path: "photos/raw/image.jpg", kind: "unknown" },
      { path: "notes.txt", kind: "unknown" },
      { path: "fallback.txt", kind: "unknown" },
    ]);
  });

  it("returns no paths for an empty transfer", () => {
    expect(droppedPathsFromDataTransfer(null)).toEqual([]);
  });
});
