import { mkdtemp, readdir, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

/** Opt-in second endpoint for the cross-device sharing test; never trusts a peer permanently. */
const expectations = process.env.ZMANAGER_SHARE_EXPECTATIONS;
(expectations ? describe : xdescribe)("native ZManager receiver", () => {
  let directory: string;
  it("accepts the generated cross-device fixtures and verifies their hashes", async () => {
    directory = await mkdtemp(join(tmpdir(), "zmanager-share-received-"));
    await browser.waitUntil(async () => await browser.$('[data-runtime-bridge-state="ready"]').isExisting(), { timeout: 30_000 });
    await browser.tauri.execute(async ({ core }, folder) => {
      try { await core.invoke("localsend_stop_receiver"); } catch { /* receiver may already be off */ }
      await core.invoke("localsend_start_receiver", { request: { alias: "Windows Sharing QA", receiveFolderPath: folder, https: true, autoExtract: false } });
    }, directory);
    console.log(`SHARE_RECEIVER_READY ${directory}`);
    const accepted = new Set<string>();
    let declined = false;
    await browser.waitUntil(async () => {
      const shouldDecline = !!process.env.ZMANAGER_SHARE_DECLINE_FIRST && !declined;
      const decision = await browser.$(shouldDecline ? 'button=Decline' : 'button=Accept');
      if (await decision.isExisting()) {
        await decision.click();
        if (shouldDecline) { declined = true; console.log("SHARE_DECLINED_FOR_RETRY_TEST"); }
      }
      let manifest: { name: string; sha256: string; bytes: number }[] = [];
      try { manifest = JSON.parse(await readFile(expectations!, "utf8")); } catch { return false; }
      const names = await readdir(directory);
      for (const expected of manifest) {
        if (accepted.has(expected.name) || !names.includes(expected.name)) continue;
        const bytes = await readFile(join(directory, expected.name));
        if (bytes.length !== expected.bytes) continue;
        const actual = createHash("sha256").update(bytes).digest("hex");
        expect(actual).toBe(expected.sha256);
        accepted.add(expected.name);
        console.log(`SHARE_RECEIVED ${JSON.stringify({ name: expected.name, bytes: bytes.length, sha256: actual })}`);
      }
      return accepted.size === Number(process.env.ZMANAGER_SHARE_EXPECTED_COUNT ?? "2");
    }, { timeout: 240_000, interval: 500 });
    await mkdir(resolve("test-results"), { recursive: true });
    await browser.saveScreenshot(resolve("test-results/sharing-windows-received.png"));
  }, 270_000);
  afterAll(async () => {
    await browser.tauri.execute(async ({ core }) => { try { await core.invoke("localsend_stop_receiver"); } catch { /* cleanup */ } });
    if (directory) await rm(directory, { recursive: true, force: true });
  });
});
