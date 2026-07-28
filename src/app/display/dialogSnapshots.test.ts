import { describe, expect, it } from "vitest";

import type { ArchiveEntryDto, HealthcheckResponse, ProjectContract } from "../../api/types";
import { createArchiveWorkspace } from "../workspaces/archiveWorkspace";
import { createDisplayContext } from "./displayContext";
import {
  buildAboutDialogSnapshot,
  buildArchiveInfoDialogSnapshot,
  buildEntryInfoDialogSnapshot,
  buildSelectionInfoDialogSnapshot,
  serializeAboutDiagnostics,
} from "./dialogSnapshots";
import { nativeCapabilitySnapshots } from "../../test/nativeCapabilityFixtures";

function rowValue(
  snapshot: Extract<ReturnType<typeof buildArchiveInfoDialogSnapshot>, { kind: "info" }>,
  label: string,
): string | undefined {
  return snapshot.rows.find((row) => row.label === label)?.value;
}

describe("dialog snapshots", () => {
  it("builds archive info from the archive workspace snapshot", () => {
    const display = createDisplayContext("en");
    const workspace = createArchiveWorkspace();
    const archive = workspace.loadSucceeded({
      archivePath: "C:/tmp/photos.zip",
      entryCount: 3,
      totalSize: 3072,
      entries: [
        { path: "photos", kind: "directory" },
        { path: "photos/a.jpg", kind: "file", size: 2048, compressedSize: 1024 },
        { path: "photos/b.jpg", kind: "file", size: 1024, compressedSize: 512 },
      ],
    });

    const snapshot = buildArchiveInfoDialogSnapshot({
      archive,
      display,
      lastTestStatus: "Last test: completed",
      returnFocusPath: "photos/a.jpg",
    });

    expect(snapshot.title).toBe("Archive Info");
    expect(rowValue(snapshot, "Archive name")).toBe("photos.zip");
    expect(rowValue(snapshot, "Path")).toBe("C:/tmp/photos.zip");
    expect(rowValue(snapshot, "Format")).toBe("ZIP");
    expect(rowValue(snapshot, "Entries")).toBe("3");
    expect(rowValue(snapshot, "Total unpacked size")).toBe("3 KB");
    expect(rowValue(snapshot, "Packed size")).toBe("1.5 KB");
    expect(rowValue(snapshot, "Last test status")).toBe("Last test: completed");
    expect(snapshot.actions.find((action) => action.label === "Copy Details")?.copyValue).toContain(
      "Archive name: photos.zip",
    );
    expect(snapshot.returnFocusPath).toBe("photos/a.jpg");
  });

  it("builds entry info actions from entry kind", () => {
    const display = createDisplayContext("en");
    const file: ArchiveEntryDto = {
      path: "docs/readme.txt",
      kind: "file",
      size: 200,
      compressedSize: 100,
      modified: "2026-07-08T04:05:06Z",
      mode: 0o640,
      metadataDiagnostics: ["portable-v1 mode Restore/Skipped: projected mode"],
    };
    const directory: ArchiveEntryDto = { path: "docs", kind: "directory" };

    const fileSnapshot = buildEntryInfoDialogSnapshot({
      entry: file,
      display,
      previewActionTitle: "Open a temporary copy",
    });
    const directorySnapshot = buildEntryInfoDialogSnapshot({ entry: directory, display });

    expect(fileSnapshot.actions.map((action) => action.action ?? action.label)).toEqual([
      "preview",
      "Copy Path",
      "Copy Details",
      "archive-info",
    ]);
    expect(fileSnapshot.actions[0]).toMatchObject({
      label: "View",
      primary: true,
      title: "Open a temporary copy",
    });
    expect(fileSnapshot.actions.find((action) => action.label === "Copy Details")?.copyValue).toContain(
      "Ratio: 50%",
    );
    expect(fileSnapshot.rows).toContainEqual({ label: "Mode", value: "0640", mode: undefined });
    expect(fileSnapshot.rows.some((row) => row.label === "Metadata diagnostics")).toBe(true);
    expect(directorySnapshot.actions.some((action) => action.action === "preview")).toBe(false);
  });

  it("builds selection info and copy-details text from selected rows", () => {
    const display = createDisplayContext("en");
    const workspace = createArchiveWorkspace();
    workspace.loadSucceeded({
      archivePath: "C:/tmp/project.zip",
      entryCount: 2,
      entries: [
        { path: "docs", kind: "directory" },
        { path: "readme.txt", kind: "file", size: 2048, compressedSize: 1024 },
      ],
    });
    const archive = workspace.updateSelection({
      selectedPaths: new Set(["docs", "readme.txt"]),
      focusedPath: "readme.txt",
      anchorPath: "docs",
    });

    const snapshot = buildSelectionInfoDialogSnapshot({
      archive,
      display,
      returnFocusPath: "readme.txt",
    });

    expect(rowValue(snapshot, "Entries")).toBe("2");
    expect(rowValue(snapshot, "Selected files")).toBe("1");
    expect(rowValue(snapshot, "Selected folders")).toBe("1");
    expect(rowValue(snapshot, "Total size")).toBe("2 KB");
    expect(rowValue(snapshot, "Packed size")).toBe("1 KB");
    expect(rowValue(snapshot, "Path preview")).toBe("docs, readme.txt");
    expect(snapshot.actions.find((action) => action.label === "Copy Details")?.copyValue).toBe([
      "Entries: 2",
      "Selected files: 1",
      "Selected folders: 1",
      "Total size: 2 KB",
      "Packed size: 1 KB",
      "Path preview: docs, readme.txt",
    ].join("\n"));
  });

  it("serializes about diagnostics from the about snapshot data", () => {
    const display = createDisplayContext("en");
    const healthcheck: HealthcheckResponse = {
      engine: "zmanager-core",
      version: "1.2.3",
      ready: true,
      summary: "ready",
      shell: "tauri",
      status: "ready",
      appVersion: "9.9.9",
      buildId: "Windows-x86_64-42",
    };
    const contract: ProjectContract = {
      commands: ["list", "extract"],
      platformStrategy: "desktop",
      coreDependency: "zmanager-core 1.2.3",
      platformIntegration: {
        platform: "windows",
        packageKind: "development",
        capabilities: nativeCapabilitySnapshots("windows", {
          shellSelectedItemActions: "available",
          shellBackgroundActions: "unavailable",
          fileAssociations: "available",
        }),
      },
      sourceTableCapabilities: { availableColumnIds: ["name", "kind", "size", "modified", "sourcePath"] },
    };

    const snapshot = buildAboutDialogSnapshot({
      display,
      healthcheck,
      contract,
      appTitle: "Test Manager",
      appVersion: "9.9.9",
      diagnosticLogPath: "C:/Program Files/ZManager/logs/zmanager-diagnostics.log",
      diagnosticLogLocation: "installation",
    });

    expect(serializeAboutDiagnostics(snapshot)).toBe([
      "Product",
      "App name: Test Manager",
      "Version: 9.9.9",
      "Build: Windows-x86_64-42",
      "",
      "Shell and Runtime",
      "Shell: tauri",
      "Engine: zmanager-core 1.2.3",
      "Core dependency: zmanager-core 1.2.3",
      "",
      "Desktop Integration",
      "Platform: windows",
      "Selected-item actions: enabled",
      "Background actions: disabled",
      "File associations: enabled",
      "",
      "Support Diagnostics",
      "Status: ready",
      "Shell actions: enabled",
      "Diagnostic log: C:/Program Files/ZManager/logs/zmanager-diagnostics.log",
      "Log location: installation folder",
    ].join("\n"));
  });

  it("describes the macOS per-user diagnostic log location", () => {
    const snapshot = buildAboutDialogSnapshot({
      display: createDisplayContext("en"),
      diagnosticLogPath: "/Users/test/Library/Logs/org.tzap-org.zmanager/zmanager-diagnostics.log",
      diagnosticLogLocation: "user",
    });

    expect(serializeAboutDiagnostics(snapshot)).toContain(
      "Log location: per-user log folder",
    );
  });

  it("uses display context labels instead of persisted workflow labels", () => {
    const display = createDisplayContext("zh-CN");
    const workspace = createArchiveWorkspace();
    const archive = workspace.loadSucceeded({
      archivePath: "C:/tmp/photos.zip",
      entryCount: 0,
      entries: [],
    });

    const snapshot = buildArchiveInfoDialogSnapshot({ archive, display });

    expect(snapshot.title).toBe("归档信息");
    expect(snapshot.actions.map((action) => action.label)).toEqual(["复制路径", "复制详细信息"]);
  });
});
