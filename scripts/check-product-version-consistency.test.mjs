import assert from "node:assert/strict";
import test from "node:test";
import { checkVersionConsistency } from "./check-product-version-consistency.mjs";

test("accepts matching product versions", () => {
  assert.equal(checkVersionConsistency([
    { name: "package.json", version: "1.1.0" },
    { name: "Cargo.toml", version: "1.1.0" },
    { name: "Info.plist", version: "1.1.0" }
  ]), "1.1.0");
});

test("rejects an intentionally mismatched nested bundle fixture", () => {
  assert.throws(() => checkVersionConsistency([
    { name: "package.json", version: "1.1.0" },
    { name: "FinderExtension/Info.plist", version: "1.0.0" }
  ]), /FinderExtension\/Info\.plist=1\.0\.0/);
});
