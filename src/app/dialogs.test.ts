import { describe, expect, it } from "vitest";

import {
  nativeDialogErrorMessage,
  runNativeOpenDialog,
  runNativeSaveDialog,
  unknownErrorMessage,
} from "./dialogs";

const dialogMessages = {
  unavailableInBrowser: "Native dialogs are unavailable in browser preview.",
  failed: "Native dialog failed.",
};

describe("dialog helpers", () => {
  it("formats unknown errors with useful fallbacks", () => {
    expect(unknownErrorMessage(new Error("permission denied"), "fallback")).toBe("permission denied");
    expect(unknownErrorMessage("plugin missing", "fallback")).toBe("plugin missing");
    expect(unknownErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("preserves a structured command error message", () => {
    expect(unknownErrorMessage({ code: "operationFailed", message: "receiver rejected the transfer" }, "fallback")).toBe("receiver rejected the transfer");
  });

  it("only uses the browser preview message outside desktop mode", () => {
    expect(nativeDialogErrorMessage(false, new Error("denied"), dialogMessages)).toBe(
      "Native dialogs are unavailable in browser preview.",
    );
    expect(nativeDialogErrorMessage(true, new Error("denied"), dialogMessages)).toBe("denied");
  });

  it("reports failed open dialogs and returns null", async () => {
    const messages: string[] = [];
    const result = await runNativeOpenDialog(
      async () => {
        throw new Error("open denied");
      },
      { multiple: false },
      true,
      (message) => messages.push(message),
      dialogMessages,
    );

    expect(result).toBeNull();
    expect(messages).toEqual(["open denied"]);
  });

  it("passes successful save dialog results through", async () => {
    const result = await runNativeSaveDialog(
      async () => "C:/tmp/archive.zip",
      { title: "Save" },
      true,
      () => {
        throw new Error("should not report status");
      },
      dialogMessages,
    );

    expect(result).toBe("C:/tmp/archive.zip");
  });
});
