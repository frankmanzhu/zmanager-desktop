import assert from "node:assert/strict";

describe("ZManager packaged application", () => {
  it("launches the real Tauri window and reaches the Rust backend", async () => {
    const runtimeState = await browser.execute(() => ({
      href: globalThis.location.href,
      readyState: document.readyState,
      appHtml: document.querySelector("#app")?.innerHTML.slice(0, 200) ?? null,
      hasGlobalTauri: typeof (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__ !== "undefined",
      hasWdioTauri: typeof (globalThis as typeof globalThis & { wdioTauri?: unknown }).wdioTauri !== "undefined",
    }));
    console.log("GUI runtime state", runtimeState);

    const appRoot = await $("#app");
    await appRoot.waitForExist();

    assert.equal(await browser.getTitle(), "ZManager Desktop");

    const health = await browser.tauri.execute(({ core }) => (
      core.invoke("healthcheck")
    )) as { ready: boolean; status: string };
    assert.equal(health.ready, true);
    assert.equal(health.status, "ready");

    const compressMode = await $("#mode-compress");
    await compressMode.waitForExist();
    assert.equal(await compressMode.getAttribute("aria-selected"), "true");

    const extractMode = await $("#mode-extract");
    await extractMode.click();
    assert.equal(await extractMode.getAttribute("aria-selected"), "true");
    assert.equal(await $("main[data-mode='extract']").isExisting(), true);

    await compressMode.click();
    assert.equal(await compressMode.getAttribute("aria-selected"), "true");
  });
});
