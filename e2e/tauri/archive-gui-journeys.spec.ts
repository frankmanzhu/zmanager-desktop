import assert from "node:assert/strict";

/**
 * Tier A DOM-driven GUI journeys in the native desktop shell.
 *
 * Drives user interactions against real UI components, verifying mode
 * switching, format capability control presentation in Compress mode, and
 * Extract workspace controls.
 */

describe("Tier A GUI archive journeys", () => {
  it("switches cleanly between Compress and Extract workspace modes", async () => {
    const compressTab = await $("#mode-compress");
    const extractTab = await $("#mode-extract");

    await compressTab.waitForExist();
    await extractTab.waitForExist();

    // Switch to Extract mode
    await extractTab.click();
    assert.equal(await extractTab.getAttribute("aria-selected"), "true");
    assert.equal(await compressTab.getAttribute("aria-selected"), "false");
    assert.ok(await $("main[data-mode='extract']").isExisting());

    // Switch to Compress mode
    await compressTab.click();
    assert.equal(await compressTab.getAttribute("aria-selected"), "true");
    assert.equal(await extractTab.getAttribute("aria-selected"), "false");
    assert.ok(await $("main[data-mode='compress']").isExisting());
  });

  it("renders format selector and options in Compress mode", async () => {
    const compressTab = await $("#mode-compress");
    await compressTab.click();

    // Verify format dropdown trigger exists
    const formatTrigger = await $("#create-format");
    await formatTrigger.waitForExist();
    assert.ok(await formatTrigger.isDisplayed());

    // Verify compression level control exists
    const levelControl = await $("#create-compression-level");
    assert.ok(await levelControl.isExisting());

    // Verify clean source and gitignore checkboxes exist
    assert.ok(await $("#create-clean-source").isExisting());
    assert.ok(await $("#create-respect-gitignore").isExisting());
  });

  it("renders Extract workspace table, navigation, and details pane", async () => {
    const extractTab = await $("#mode-extract");
    await extractTab.click();

    // Empty state or entry table
    const emptyState = await $("#archive-empty-state");
    const entryTable = await $("#entry-table");
    assert.ok((await emptyState.isExisting()) || (await entryTable.isExisting()));

    // Search and navigation controls
    assert.ok(await $("#search-entries").isExisting());
    assert.ok(await $("#tree-content").isExisting());

    // Details / Options pane
    assert.ok(await $("#extract-path-mode").isExisting());
    assert.ok(await $("#extract-overwrite").isExisting());
  });
});
