import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const text = (relative) => readFile(path.join(root, relative), "utf8");
const manifest = await json("manifests/archive-file-types.json");

test("association types exactly partition engine archive extensions", () => {
  const primary = manifest.associationTypes.flatMap((type) => type.primaryExtensions).sort();
  const compound = manifest.associationTypes.flatMap((type) => type.compoundExtensions).sort();
  const split = manifest.associationTypes.flatMap((type) => type.splitSuffixes).sort();
  assert.deepEqual(primary, [...manifest.singleExtensions].sort());
  assert.deepEqual(compound, [...manifest.compoundExtensions].sort());
  assert.deepEqual(split, [...manifest.splitArchiveSuffixes].sort());
  assert.equal(new Set(primary).size, primary.length);
  assert.equal(new Set(compound).size, compound.length);
  assert.equal(new Set(split).size, split.length);
});

test("package association fixture distinguishes extensions from registered MIME types", async () => {
  const fixture = await json("fixtures/contracts/archive-associations.conformance.json");
  const allExtensions = [
    ...manifest.singleExtensions,
    ...manifest.compoundExtensions,
    ...manifest.splitArchiveSuffixes.map((suffix) => suffix.slice(1)),
  ].sort();
  assert.deepEqual(fixture.expectedPackages.nsis.extensions, allExtensions);
  assert.deepEqual(fixture.expectedPackages.macosApp.extensions, allExtensions);
  assert.deepEqual(
    fixture.expectedPackages.deb.mimeTypes,
    manifest.packageAssociationProfiles.linux.mimeTypes,
  );
  assert.notDeepEqual(fixture.expectedPackages.deb.mimeTypes, allExtensions);
});

test("Linux association consumers use the generated MIME profile", async () => {
  const expected = `${manifest.packageAssociationProfiles.linux.mimeTypes.join(";")};`;
  for (const relative of [
    "packaging/linux/zmanager-desktop.desktop",
    "packaging/linux/zmanager.desktop.hbs",
    "packaging/linux/kde/zmanager-archive-servicemenu.desktop",
  ]) {
    assert.ok((await text(relative)).includes(`MimeType=${expected}`));
  }
  const appstream = await text(
    "packaging/linux/org.tzap-org.zmanager.desktop.metainfo.xml",
  );
  for (const mimeType of manifest.packageAssociationProfiles.linux.mimeTypes) {
    assert.ok(appstream.includes(`<mediatype>${mimeType}</mediatype>`));
  }
});

test("generated runtime and package artifacts cover compound and split formats", async () => {
  const nautilus = await text(
    "packaging/linux/nautilus/zmanager_shell_actions_generated.py",
  );
  const macos = await json("packaging/macos/archive-types.generated.json");
  const nsis = await text("packaging/windows/nsis-context-menu.nsh");
  for (const suffix of manifest.splitArchiveSuffixes) {
    assert.ok(nautilus.includes(JSON.stringify(suffix)));
    assert.ok(macos.associatedExtensions.includes(suffix.slice(1)));
    assert.ok(nsis.includes(`".${suffix.slice(1)}"`));
  }
});

test("Linux custom MIME types declare icons and map mimetype assets in package configs", async () => {
  const xdgMime = await text("packaging/linux/xdg-mime.xml");
  const tauriConfig = await json("src-tauri/tauri.conf.json");

  assert.ok(xdgMime.includes('<icon name="application-x-zmanager-tzap"/>'));
  assert.ok(xdgMime.includes('<icon name="application-x-zmanager-tzst"/>'));
  assert.ok(xdgMime.includes('<generic-icon name="x-office-archive"/>'));

  for (const packageType of ["deb", "rpm"]) {
    const files = tauriConfig.bundle.linux[packageType].files;
    assert.equal(
      files["/usr/share/icons/hicolor/256x256/mimetypes/application-x-zmanager-tzap.png"],
      "icons/icon-256.png",
    );
    assert.equal(
      files["/usr/share/icons/hicolor/512x512/mimetypes/application-x-zmanager-tzap.png"],
      "icons/icon-512.png",
    );
    assert.equal(
      files["/usr/share/icons/hicolor/1024x1024/mimetypes/application-x-zmanager-tzap.png"],
      "icons/icon.png",
    );
    assert.equal(
      files["/usr/share/icons/hicolor/256x256/mimetypes/application-x-zmanager-tzst.png"],
      "icons/icon-256.png",
    );
    assert.equal(
      files["/usr/share/icons/hicolor/512x512/mimetypes/application-x-zmanager-tzst.png"],
      "icons/icon-512.png",
    );
    assert.equal(
      files["/usr/share/icons/hicolor/1024x1024/mimetypes/application-x-zmanager-tzst.png"],
      "icons/icon.png",
    );
  }
});

