import { describe, expect, it } from "vitest";

import {
  nativeDialogErrorMessage,
  runNativeOpenDialog,
  runNativeSaveDialog,
  unknownErrorMessage,
} from "./dialogs";

describe("dialog helpers", () => {
  it("formats unknown errors with useful fallbacks", () => {
    expect(unknownErrorMessage(new Error("permission denied"), "fallback")).toBe("permission denied");
    expect(unknownErrorMessage("plugin missing", "fallback")).toBe("plugin missing");
    expect(unknownErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("only uses the browser preview message outside desktop mode", () => {
    expect(nativeDialogErrorMessage(false, new Error("denied"))).toBe(
      "Native dialogs are unavailable in browser preview.",
    );
    expect(nativeDialogErrorMessage(true, new Error("denied"))).toBe("denied");
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
    );

    expect(result).toBe("C:/tmp/archive.zip");
  });
});
