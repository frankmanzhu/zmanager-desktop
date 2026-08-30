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

  it("keeps Preferences validation inline and restores menu focus after Escape", async () => {
    const toolsMenu = await $('[data-menu-group-label="Tools"]');
    await toolsMenu.click();
    const optionsCommand = await $("#menu-command-options");
    await optionsCommand.click();

    const dialog = await $('[role="dialog"][aria-labelledby="preferences-title"]');
    await dialog.waitForDisplayed();

    const outputLocation = await $("#pref-output-location");
    await outputLocation.click();
    const customOutputOption = await $('[role="option"][data-value="customFolder"]');
    await customOutputOption.waitForDisplayed();
    await customOutputOption.click();

    const customOutput = await $("#pref-custom-output");
    assert.equal(await customOutput.getAttribute("aria-invalid"), "true");
    assert.match(
      (await customOutput.getAttribute("aria-describedby")) ?? "",
      /pref-custom-output-validation/,
    );
    assert.equal(await $("#preferences-save").isEnabled(), false);

    await browser.keys("Escape");
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "Preferences dialog should close on Escape",
    });
    const focusedElement = await browser.execute(() => {
      const element = document.activeElement;
      return {
        id: element?.id ?? "",
        tagName: element?.tagName ?? "",
        menuGroup: element?.getAttribute("data-menu-group-label") ?? "",
        visible: element instanceof HTMLElement && Boolean(element.offsetWidth || element.offsetHeight),
      };
    });
    assert.equal(focusedElement.tagName, "SUMMARY");
    assert.equal(focusedElement.menuGroup, "Tools");
    assert.equal(focusedElement.visible, true);
  });

  it("keeps the Account dialog bounded while Contacts remains keyboard reachable", async () => {
    const accountLauncher = await $('button[aria-label="TZAP Account"]');
    await accountLauncher.click();
    const dialog = await $('[role="dialog"][aria-labelledby="account-title"]');
    await dialog.waitForDisplayed();

    const tabs = await dialog.$$('[role="tab"]').getElements();
    assert.ok(tabs.length >= 2);
    const contactsTab = tabs[tabs.length - 1];
    await contactsTab.click();
    assert.equal(await contactsTab.getAttribute("aria-selected"), "true");

    const layout = await browser.execute(() => {
      const surface = document.querySelector<HTMLElement>("[data-dialog-surface]");
      const content = document.querySelector<HTMLElement>("[data-dialog-content]");
      if (!surface || !content) {
        throw new Error("Account dialog layout markers are missing.");
      }
      const bounds = surface.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        right: bounds.right,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        contentOverflowY: getComputedStyle(content).overflowY,
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      };
    });
    assert.ok(layout.bottom <= layout.viewportHeight + 2);
    assert.ok(layout.right <= layout.viewportWidth + 2);
    assert.match(layout.contentOverflowY, /auto|scroll/);
    assert.ok(layout.documentHeight <= layout.viewportHeight + 2);

    await $("button[aria-label='Close account']").click();
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "Account dialog should close from its native shell",
    });
  });

  it("restores focus to the Account launcher after native Escape", async () => {
    const accountLauncher = await $('button[aria-label="TZAP Account"]');
    await accountLauncher.click();
    const dialog = await $('[role="dialog"][aria-labelledby="account-title"]');
    await dialog.waitForDisplayed();

    await browser.keys("Escape");
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "Account dialog should close on Escape",
    });
    assert.deepEqual(
      await browser.execute(() => ({
        id: document.activeElement?.id ?? "",
        ariaLabel: document.activeElement?.getAttribute("aria-label") ?? "",
      })),
      { id: "", ariaLabel: "TZAP Account" },
    );
  });

  it("recovers Preferences validation without leaving a stale error or disabled Save", async () => {
    const dialog = await openOptionsDialog();
    const outputLocation = await $("#pref-output-location").getElement();

    await chooseCustomOutputWithKeyboard(outputLocation);
    assert.equal(await $("#pref-custom-output").getAttribute("aria-invalid"), "true");
    assert.equal(await $("#preferences-save").isEnabled(), false);

    await outputLocation.click();
    await browser.keys("ArrowUp");
    await browser.keys("Enter");
    await browser.waitUntil(async () => (await $("#pref-custom-output").isEnabled()) === false, {
      timeout: 5_000,
      timeoutMsg: "Custom output should be disabled after returning to source folder",
    });
    assert.equal(await $("#pref-custom-output").getAttribute("aria-invalid"), null);
    assert.equal(await $("#preferences-save").isEnabled(), true);

    await $("#preferences-cancel").click();
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "Preferences should close after cancellation",
    });
  });

  it("keeps the native Preferences error surface inside the viewport", async () => {
    const dialog = await openOptionsDialog();
    await chooseCustomOutputWithKeyboard(await $("#pref-output-location").getElement());

    const layout = await browser.execute(() => {
      const surface = document.querySelector<HTMLElement>("[data-dialog-surface]");
      const content = document.querySelector<HTMLElement>("[data-dialog-content]");
      const validation = document.querySelector<HTMLElement>("#pref-custom-output-validation");
      if (!surface || !content || !validation) {
        throw new Error("Preferences error layout markers are missing.");
      }
      const bounds = surface.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        right: bounds.right,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        contentOverflowY: getComputedStyle(content).overflowY,
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        validationVisible: validation.getBoundingClientRect().height > 0,
      };
    });
    assert.ok(layout.bottom <= layout.viewportHeight + 2);
    assert.ok(layout.right <= layout.viewportWidth + 2);
    assert.match(layout.contentOverflowY, /auto|scroll/);
    assert.ok(layout.documentHeight <= layout.viewportHeight + 2);
    assert.equal(layout.validationVisible, true);

    await $("#preferences-cancel").click();
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "Preferences should close after the native layout check",
    });
  });

  it("keeps About diagnostics bounded and copyable in the native shell", async () => {
    const helpMenu = await $('[data-menu-group-label="Help"]');
    await helpMenu.click();
    await $("#menu-command-about").click();

    const dialog = await $('[role="dialog"][aria-labelledby="about-title"]');
    await dialog.waitForDisplayed();
    const diagnostics = await $("#about-diagnostics");
    assert.equal(await diagnostics.isDisplayed(), true);
    assert.ok((await dialog.$$("[data-diagnostics-group]").getElements()).length >= 3);

    const layout = await browser.execute(() => {
      const surface = document.querySelector<HTMLElement>("[data-dialog-surface]");
      const content = document.querySelector<HTMLElement>("[data-dialog-content]");
      if (!surface || !content) {
        throw new Error("About dialog layout markers are missing.");
      }
      const bounds = surface.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        right: bounds.right,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        contentOverflowY: getComputedStyle(content).overflowY,
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        diagnosticText: document.querySelector("#about-diagnostics")?.textContent?.trim() ?? "",
      };
    });
    assert.ok(layout.bottom <= layout.viewportHeight + 2);
    assert.ok(layout.right <= layout.viewportWidth + 2);
    assert.match(layout.contentOverflowY, /auto|scroll/);
    assert.ok(layout.documentHeight <= layout.viewportHeight + 2);
    assert.ok(layout.diagnosticText.length > 100);
    assert.equal(layout.diagnosticText.includes("password"), false);

    const copyButton = await $("#copy-diagnostics");
    await copyButton.click();
    assert.equal(await copyButton.getText(), "Copied");

    await browser.keys("Escape");
    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 5_000,
      timeoutMsg: "About dialog should close on Escape",
    });
  });

  it("keeps the native empty Extract workspace inside the viewport", async () => {
    const extractMode = await $("#mode-extract");
    await extractMode.click();
    await $("#archive-empty-state").waitForDisplayed();
    assert.equal(await $("#open-archive").isEnabled(), true);
    assert.equal(await $("#search-entries").isEnabled(), false);
    assert.match(await $("#details-content").getText(), /No archive open/);
    assert.equal(await $("#archive-empty-state [data-empty-action='open-archive']").isDisplayed(), true);

    const layout = await browser.execute(() => {
      const region = document.querySelector<HTMLElement>("[data-workspace-content]");
      if (!region) {
        throw new Error("Extract workspace content marker is missing.");
      }
      return {
        overflowY: getComputedStyle(region).overflowY,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    assert.match(layout.overflowY, /auto|scroll/);
    assert.ok(layout.documentWidth <= layout.viewportWidth + 2);
    assert.ok(layout.documentHeight <= layout.viewportHeight + 2);

    await $("#mode-compress").click();
  });

  it("keeps the native Create options pane as the workspace scroll owner", async () => {
    const compressMode = await $("#mode-compress");
    await compressMode.click();
    const optionsPane = await $("#details-pane");
    await optionsPane.waitForDisplayed();

    const layout = await browser.execute(() => {
      const region = document.querySelector<HTMLElement>("#details-pane");
      if (!region) {
        throw new Error("Create options pane is missing.");
      }
      return {
        overflowY: getComputedStyle(region).overflowY,
        scrollHeight: region.scrollHeight,
        clientHeight: region.clientHeight,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    assert.match(layout.overflowY, /auto|scroll/);
    assert.ok(layout.scrollHeight >= layout.clientHeight);
    assert.ok(layout.documentWidth <= layout.viewportWidth + 2);
    assert.ok(layout.documentHeight <= layout.viewportHeight + 2);
  });

});

async function openOptionsDialog() {
  const toolsMenu = await $('[data-menu-group-label="Tools"]');
  await toolsMenu.click();
  await $("#menu-command-options").click();
  const dialog = await $('[role="dialog"][aria-labelledby="preferences-title"]');
  await dialog.waitForDisplayed();
  return dialog;
}

async function chooseCustomOutputWithKeyboard(outputLocation: WebdriverIO.Element) {
  await outputLocation.click();
  await browser.keys("Home");
  await browser.keys("ArrowDown");
  await browser.keys("Enter");
  await browser.waitUntil(async () => (await $("#pref-custom-output").isEnabled()) === true, {
    timeout: 5_000,
    timeoutMsg: "Custom output should be enabled after selecting the custom folder mode",
  });
}
