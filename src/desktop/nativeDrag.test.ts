import { describe, expect, it, vi } from "vitest";

import {
  runStartNativeFileDrag,
} from "../api/commands";
import type {
  NativeFileDragRequest,
  NativeFileDragResponse,
} from "../api/types";
import {
  startNativeFileDrag,
} from "./nativeDrag";

vi.mock("../api/commands", () => ({
  runStartNativeFileDrag: vi.fn(),
}));

describe("desktop native drag adapter", () => {
  it("delegates native file drag requests to the API command", async () => {
    const request: NativeFileDragRequest = {
      archivePath: "C:\\archives\\sample.zip",
      entryPaths: ["docs/readme.txt"],
      password: "secret",
      stripComponents: 0,
    };
    const response: NativeFileDragResponse = {
      outcome: "dropped",
      sessionId: null,
      draggedEntries: ["docs/readme.txt"],
    };
    vi.mocked(runStartNativeFileDrag).mockResolvedValue(response);

    await expect(startNativeFileDrag(request)).resolves.toBe(response);

    expect(runStartNativeFileDrag).toHaveBeenCalledTimes(1);
    expect(runStartNativeFileDrag).toHaveBeenCalledWith(request);
  });

  it("propagates API command errors", async () => {
    const request: NativeFileDragRequest = {
      archivePath: "C:\\archives\\sample.zip",
      entryPaths: ["docs/readme.txt"],
      stripComponents: 0,
    };
    const error = new Error("drag failed");
    vi.mocked(runStartNativeFileDrag).mockRejectedValue(error);

    await expect(startNativeFileDrag(request)).rejects.toBe(error);
  });
});
