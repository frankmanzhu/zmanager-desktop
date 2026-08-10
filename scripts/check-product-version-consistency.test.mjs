import assert from "node:assert/strict";
import test from "node:test";
import { checkVersionConsistency } from "./check-product-version-consistency.mjs";

test("accepts matching product versions", () => {
  assert.equal(checkVersionConsistency([
    { name: "package.json", version: "9.9.9" },
    { name: "Cargo.toml", version: "9.9.9" },
    { name: "Info.plist", version: "9.9.9" }
  ]), "9.9.9");
});

test("rejects an intentionally mismatched nested bundle fixture", () => {
  assert.throws(() => checkVersionConsistency([
    { name: "package.json", version: "9.9.9" },
    { name: "FinderExtension/Info.plist", version: "1.0.0" }
  ]), /FinderExtension\/Info\.plist=1\.0\.0/);
});
