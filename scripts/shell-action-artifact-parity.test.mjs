import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "manifests/shell-actions.json"), "utf8"),
);
const read = (relative) => readFile(path.join(root, relative), "utf8");
const artifacts = {
  windowsExplorer: [
    await read("native/windows-shell-extension/src/generated.rs"),
    await read("packaging/windows/nsis-shell-actions.generated.nsh"),
  ],
  linuxDesktop: [
    await read("packaging/linux/zmanager-desktop.desktop"),
    await read("packaging/linux/zmanager.desktop.hbs"),
  ],
  linuxNautilus: [
    await read("packaging/linux/nautilus/zmanager_shell_actions_generated.py"),
  ],
  linuxKde: [
    await read("packaging/linux/kde/zmanager-archive-servicemenu.desktop"),
    await read("packaging/linux/kde/zmanager-servicemenu.desktop"),
  ],
  macosFinder: [
    await read("native/macos/Sources/ZManagerGenerated/ShellActions.generated.swift"),
    await read("packaging/macos/FinderExtension/en.lproj/FinderActions.strings"),
  ],
  macosServices: [
    await read("native/macos/Sources/ZManagerGenerated/ShellActions.generated.swift"),
    await read("packaging/macos/main-info.generated.json"),
  ],
};

const ordered = (context) => manifest.actions
  .filter((action) => action.contextMenuContexts.includes(context))
  .sort((left, right) => left.contextMenuOrder - right.contextMenuOrder)
  .map(({ id }) => id);

test("canonical context matrices have one stable generated order", () => {
  assert.deepEqual(ordered("archiveSingle"), [
    "extractHere",
    "extractToFolder",
    "open",
    "compress",
    "compressTzap",
    "compressZip",
    "compressSevenZ",
    "compressTarZst",
    "compressTarGz",
  ]);
  assert.deepEqual(ordered("archiveMultiple"), [
    "extractHere",
    "compress",
    "compressTzap",
    "compressZip",
    "compressSevenZ",
    "compressTarZst",
    "compressTarGz",
  ]);
  assert.deepEqual(ordered("creation"), [
    "compress",
    "compressTzap",
    "compressZip",
    "compressSevenZ",
    "compressTarZst",
    "compressTarGz",
  ]);
  assert.deepEqual(ordered("container"), ordered("creation"));
});

test("every declared native surface contains generated action identity and label", () => {
  for (const action of manifest.actions) {
    for (const surface of action.nativeSurfaces) {
      assert.ok(
        artifacts[surface].some((artifact) =>
          artifact.includes(action.nativeVerb)
          && artifact.includes(action.canonicalLabel)),
        `${surface} is missing ${action.id}`,
      );
    }
  }
});

test("compatibility-only actions stay outside parity context menus", () => {
  for (const id of ["extract", "compressCleanSource"]) {
    const action = manifest.actions.find((candidate) => candidate.id === id);
    assert.equal(action.contextMenuOrder, null);
    assert.deepEqual(action.contextMenuContexts, []);
  }
});
