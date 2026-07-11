import { describe, expect, it } from "vitest";

declare const process: {
  cwd(): string;
};

declare function require(id: "fs"): {
  readFileSync(path: string, encoding: string): string;
  readdirSync(path: string): string[];
  statSync(path: string): {
    isDirectory(): boolean;
    isFile(): boolean;
  };
};

declare function require(id: "path"): {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};

const { readFileSync, readdirSync, statSync } = require("fs");
const { join, relative } = require("path");

function normalizedWorkspaceFile(...parts: string[]): string {
  return readFileSync(workspaceFilePath(...parts), "utf8").replace(/\r\n/g, "\n");
}

function workspaceFilePath(...parts: string[]): string {
  return join(process.cwd(), ...parts);
}

function workspaceRelativePath(filePath: string): string {
  return relative(process.cwd(), filePath).replace(/\\/g, "/");
}

const styles = normalizedWorkspaceFile("src", "styles.css");
const compositionRootSource = normalizedWorkspaceFile("src", "main.ts");
const runtimeBridgeSource = normalizedWorkspaceFile("src", "runtimeBridge.ts");
const mainSource = normalizedWorkspaceFile("src", "runtime", "zmanagerRuntimeAdapter.ts");
const contextMenuRuntimeSource = normalizedWorkspaceFile("src", "runtime", "contextMenuRuntime.ts");
const appShellSource = normalizedWorkspaceFile("src", "ui", "react", "AppShell.tsx");
const appFrameSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "AppFrame.tsx");
const menuBarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "MenuBar.tsx");
const commandToolbarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "CommandToolbar.tsx");
const statusBarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "StatusBar.tsx");
const dropOverlaySource = normalizedWorkspaceFile("src", "ui", "react", "shell", "DropOverlay.tsx");
const browserFileDropAdapterSource = normalizedWorkspaceFile("src", "ui", "react", "interaction", "BrowserFileDropAdapter.tsx");
const paneResizerSource = normalizedWorkspaceFile("src", "ui", "react", "interaction", "PaneResizer.tsx");
const dialogRootSource = normalizedWorkspaceFile("src", "ui", "react", "dialogs", "DialogRoot.tsx");
const appRuntimeSource = normalizedWorkspaceFile("src", "ui", "react", "appRuntime.ts");
const contextMenuRootSource = normalizedWorkspaceFile("src", "ui", "react", "context-menu", "ContextMenuRoot.tsx");
const preferencesDialogSource = normalizedWorkspaceFile("src", "ui", "react", "preferences", "PreferencesDialog.tsx");
const archiveWorkspaceSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveWorkspace.tsx");
const archiveTableSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveTable.tsx");
const archiveTreeSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveTree.tsx");
const archivePathBarSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchivePathBar.tsx");
const archiveDetailsPaneSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveDetailsPane.tsx");
const createWorkspaceSource = normalizedWorkspaceFile("src", "ui", "react", "create", "CreateWorkspace.tsx");
const createPasswordContextSource = normalizedWorkspaceFile("src", "ui", "react", "create", "CreatePasswordContext.tsx");
const workspaceBrowserShellSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "WorkspaceBrowserShell.tsx");
const workspacePathBarSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "WorkspacePathBar.tsx");
const tableMarqueeSelectionSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "tableMarqueeSelection.ts");
const extractStartControllerSource = normalizedWorkspaceFile("src", "app", "controllers", "extractStartController.ts");
const dialogSnapshotsSource = normalizedWorkspaceFile("src", "app", "display", "dialogSnapshots.ts");
const shellWorkspaceSource = normalizedWorkspaceFile("src", "app", "shell", "shellWorkspace.ts");
const archiveWorkspaceStateSource = normalizedWorkspaceFile("src", "app", "workspaces", "archiveWorkspace.ts");
const createWorkspaceStateSource = normalizedWorkspaceFile("src", "app", "workspaces", "createWorkspace.ts");
const contextMenuModelSource = normalizedWorkspaceFile("src", "app", "commands", "contextMenuModel.ts");
const contextMenuHelpersSource = normalizedWorkspaceFile("src", "ui", "contextMenuHelpers.ts");
const modalControllerSource = normalizedWorkspaceFile("src", "ui", "modalController.ts");
const jobsSurfacesSource = normalizedWorkspaceFile("src", "ui", "react", "jobs", "JobsSurfaces.tsx");
const constantsSource = normalizedWorkspaceFile("src", "app", "constants.ts");

type FutureForbiddenTargetId = never;

type FutureForbiddenTarget = Readonly<{
  id: FutureForbiddenTargetId;
  phase: string;
  description: string;
}>;

const FUTURE_FORBIDDEN_TARGETS: readonly FutureForbiddenTarget[] = [];

type AuditScanId =
  | "hiddenLegacyDom"
  | "dangerousHtml"
  | "legacyViewImports"
  | "innerHtml"
  | "broadDomWiring";

type AuditScanDefinition = Readonly<{
  id: AuditScanId;
  command: string;
  roots: readonly string[];
  pattern: RegExp;
}>;

const LEGACY_AUDIT_SCANS: readonly AuditScanDefinition[] = [
  {
    id: "hiddenLegacyDom",
    command: "rg -n \"zmanager-runtime-bridge-root|appRoot\\.innerHTML|privatizeLegacy|writeReactExtractFormToLegacyControls\" src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    roots: ["src"],
    pattern: /zmanager-runtime-bridge-root|appRoot\.innerHTML|privatizeLegacy|writeReactExtractFormToLegacyControls/,
  },
  {
    id: "dangerousHtml",
    command: "rg -n \"dangerouslySetInnerHTML|html:\" src\\ui\\react src\\runtime src\\runtimeBridge.ts --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    roots: ["src/ui/react", "src/runtime", "src/runtimeBridge.ts"],
    pattern: /dangerouslySetInnerHTML|html:/,
  },
  {
    id: "legacyViewImports",
    command: "rg -n 'ui/(archiveWorkspaceView|createWorkspaceView)' src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    roots: ["src"],
    pattern: /ui\/(?:archiveWorkspaceView|createWorkspaceView)/,
  },
  {
    id: "innerHtml",
    command: "rg -n \"innerHTML|insertAdjacentHTML\" src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    roots: ["src"],
    pattern: /innerHTML|insertAdjacentHTML/,
  },
  {
    id: "broadDomWiring",
    command: "rg -n \"document\\.querySelector|getElementById|addEventListener\" src\\runtimeBridge.ts src\\runtime src\\ui\\react src\\app src\\desktop --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    roots: ["src/runtimeBridge.ts", "src/runtime", "src/ui/react", "src/app", "src/desktop"],
    pattern: /document\.querySelector|getElementById|addEventListener/,
  },
];

type AllowedLegacyException = Readonly<{
  id: string;
  scanId: AuditScanId;
  targetId: FutureForbiddenTargetId;
  file: string;
  line: string;
  reason: string;
}>;

const ALLOWED_HIDDEN_LEGACY_DOM_EXCEPTIONS: readonly AllowedLegacyException[] = [];

const ALLOWED_DANGEROUS_HTML_EXCEPTIONS: readonly AllowedLegacyException[] = [];

const ALLOWED_LEGACY_VIEW_IMPORT_EXCEPTIONS: readonly AllowedLegacyException[] = [];

const ALLOWED_INNER_HTML_EXCEPTIONS: readonly AllowedLegacyException[] = [];

const ALLOWED_LEGACY_EXCEPTIONS = [
  ...ALLOWED_HIDDEN_LEGACY_DOM_EXCEPTIONS,
  ...ALLOWED_DANGEROUS_HTML_EXCEPTIONS,
  ...ALLOWED_LEGACY_VIEW_IMPORT_EXCEPTIONS,
  ...ALLOWED_INNER_HTML_EXCEPTIONS,
];

const ALLOWED_BROAD_DOM_ACCESS_FILES: readonly Readonly<{
  file: string;
  reason: string;
}>[] = [
  {
    file: "src/ui/react/archive/ArchiveTable.tsx",
    reason: "Archive table drag and marquee interactions still attach temporary document listeners.",
  },
  {
    file: "src/ui/react/context-menu/ContextMenuRoot.tsx",
    reason: "Context menu outside-click dismissal is owned by the React context menu surface.",
  },
  {
    file: "src/ui/react/create/CreateWorkspace.tsx",
    reason: "Create table drag and marquee interactions still attach temporary document listeners.",
  },
  {
    file: "src/ui/react/dialogs/DialogRoot.tsx",
    reason: "React dialogs own escape-key and return-focus DOM interactions.",
  },
  {
    file: "src/ui/react/shell/MenuBar.tsx",
    reason: "Classic menu outside-click dismissal is owned by the React menu surface.",
  },
  {
    file: "src/ui/react/interaction/BrowserFileDropAdapter.tsx",
    reason: "Browser file drop remains an explicit React interaction adapter.",
  },
  {
    file: "src/ui/react/interaction/PaneResizer.tsx",
    reason: "Pane resizing remains an explicit React interaction adapter.",
  },
  {
    file: "src/ui/react/interaction/ShellKeyboardShortcuts.tsx",
    reason: "Shell shortcuts remain an explicit React interaction adapter.",
  },
  {
    file: "src/ui/react/workspace/tableMarqueeSelection.ts",
    reason: "Shared table marquee selection still attaches temporary document listeners.",
  },
  {
    file: "src/desktop/previewCleanup.ts",
    reason: "Preview cleanup is a named desktop adapter for page lifecycle events.",
  },
];

type AllowedImportException = Readonly<{
  file: string;
  specifier: string;
  targetId: FutureForbiddenTargetId;
  reason: string;
}>;

const ALLOWED_REACT_API_DESKTOP_IMPORT_EXCEPTIONS: readonly AllowedImportException[] = [];

type SourceLineMatch = Readonly<{
  file: string;
  lineNumber: number;
  line: string;
}>;

type ImportReference = Readonly<{
  file: string;
  lineNumber: number;
  specifier: string;
}>;

function listWorkspaceFiles(...rootParts: string[]): string[] {
  const root = workspaceFilePath(...rootParts);
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const filePath = join(directory, entry);
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        visit(filePath);
      } else if (stat.isFile()) {
        files.push(workspaceRelativePath(filePath));
      }
    }
  };
  visit(root);
  return files.sort();
}

function isProductionSourceFile(file: string): boolean {
  return /\.(?:css|ts|tsx)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file);
}

function productionSourceFilesFromRoots(roots: readonly string[]): string[] {
  return uniqueSorted(
    roots.flatMap((root) => {
      const rootParts = root.split("/");
      const rootPath = workspaceFilePath(...rootParts);
      const stat = statSync(rootPath);
      if (stat.isFile()) {
        return [root];
      }
      return listWorkspaceFiles(...rootParts);
    }).filter(isProductionSourceFile),
  );
}

function sourceLineMatches(files: readonly string[], pattern: RegExp): SourceLineMatch[] {
  const linePattern = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const matches: SourceLineMatch[] = [];
  for (const file of files) {
    const lines = normalizedWorkspaceFile(...file.split("/")).split("\n");
    lines.forEach((line, index) => {
      linePattern.lastIndex = 0;
      if (linePattern.test(line)) {
        matches.push({ file, lineNumber: index + 1, line: line.trim() });
      }
    });
  }
  return matches;
}

function sourceLineMatchesForScan(scanId: AuditScanId): SourceLineMatch[] {
  const scan = auditScan(scanId);
  return sourceLineMatches(productionSourceFilesFromRoots(scan.roots), scan.pattern);
}

function auditScan(scanId: AuditScanId): AuditScanDefinition {
  const scan = LEGACY_AUDIT_SCANS.find((candidate) => candidate.id === scanId);
  if (!scan) {
    throw new Error(`missing audit scan: ${scanId}`);
  }
  return scan;
}

function expectScanMatchesOnlyAllowed(scanId: AuditScanId) {
  expect(sourceLineMatchesForScan(scanId).map(sourceLineKey).sort()).toEqual(
    ALLOWED_LEGACY_EXCEPTIONS
      .filter((exception) => exception.scanId === scanId)
      .map((exception) => sourceLineKey(exception))
      .sort(),
  );
}

function sourceLineKey(match: Pick<SourceLineMatch, "file" | "line">): string {
  return JSON.stringify([match.file, match.line.trim()]);
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function importReferencesForFiles(files: readonly string[]): ImportReference[] {
  const references: ImportReference[] = [];
  const importStatementPattern = /\bimport[\s\S]*?;(?=\n|$)/g;

  for (const file of files) {
    const source = normalizedWorkspaceFile(...file.split("/"));
    let match: RegExpExecArray | null;
    while ((match = importStatementPattern.exec(source)) !== null) {
      const statement = match[0];
      const specifier = /\bfrom\s+["']([^"']+)["']/.exec(statement)?.[1]
        ?? /^import\s+["']([^"']+)["']/.exec(statement.trim())?.[1];
      if (!specifier) {
        continue;
      }
      references.push({
        file,
        lineNumber: source.slice(0, match.index).split("\n").length,
        specifier,
      });
    }
  }

  return references;
}

function importReferenceKey(reference: Pick<ImportReference, "file" | "specifier">): string {
  return JSON.stringify([reference.file, reference.specifier]);
}

function importTargetFor(reference: Pick<ImportReference, "file" | "specifier">): string {
  if (!reference.specifier.startsWith(".")) {
    return reference.specifier;
  }
  const directory = reference.file.slice(0, reference.file.lastIndexOf("/"));
  return normalizePosixPath(`${directory}/${reference.specifier}`);
}

function importTargetsSrcDirectory(reference: ImportReference, directory: "api" | "desktop" | "ui/react"): boolean {
  const target = importTargetFor(reference);
  return target === `src/${directory}` || target.startsWith(`src/${directory}/`);
}

function normalizePosixPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function controllerDomGlobalMatches(): SourceLineMatch[] {
  const controllerFiles = productionSourceFilesFromRoots(["src/app/controllers"]);
  return sourceLineMatches(controllerFiles, /\b(?:document|window)\s*\.|\b(?:HTMLElement|HTMLInputElement|HTMLButtonElement|HTMLDivElement|HTMLTableElement|HTMLDetailsElement|HTMLSelectElement|HTMLTextAreaElement|HTMLDataListElement|HTMLSpanElement|HTMLParagraphElement|HTMLHeadingElement|HTMLOutputElement|Element|Node|KeyboardEvent|MouseEvent|PointerEvent|DragEvent|EventTarget|DataTransfer)\b|\baddEventListener\s*\(/);
}

function selectorsContainingFirstTableColumnRules(css: string): string[] {
  const selectors: string[] = [];
  const rulePattern = /(^|})\s*([^{}@][^{}]*)\{/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(css)) !== null) {
    const selectorList = match[2];
    if (!/\b(?:td|th):first-child\b/.test(selectorList)) {
      continue;
    }
    selectors.push(...selectorList.split(",").map((selector) => selector.trim()).filter(Boolean));
  }
  return selectors;
}

describe("GUI layout contracts", () => {
  for (const target of FUTURE_FORBIDDEN_TARGETS) {
    it.todo(`${target.phase}: final guardrail forbids ${target.description}`);
  }

  it("keeps main.ts as the React composition root", () => {
    expect(compositionRootSource).toContain('from "./ui/react/AppShell"');
    expect(compositionRootSource).toContain("createRoot(app).render(");
    expect(compositionRootSource).not.toContain('from "./runtimeBridge"');
    expect(compositionRootSource).not.toMatch(/from "\.\/(?:api|desktop|app\/controllers|app\/workspaces)\//);
    expect(compositionRootSource).not.toContain("appRoot.innerHTML");
    expect(compositionRootSource).not.toContain("@tauri-apps/api/");
  });

  it("records the Phase 0 audit rg scans used by the guardrails", () => {
    expect(LEGACY_AUDIT_SCANS.map((scan) => scan.command)).toEqual([
      "rg -n \"zmanager-runtime-bridge-root|appRoot\\.innerHTML|privatizeLegacy|writeReactExtractFormToLegacyControls\" src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
      "rg -n \"dangerouslySetInnerHTML|html:\" src\\ui\\react src\\runtime src\\runtimeBridge.ts --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
      "rg -n 'ui/(archiveWorkspaceView|createWorkspaceView)' src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
      "rg -n \"innerHTML|insertAdjacentHTML\" src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
      "rg -n \"document\\.querySelector|getElementById|addEventListener\" src\\runtimeBridge.ts src\\runtime src\\ui\\react src\\app src\\desktop --glob '!**/*.test.ts' --glob '!**/*.test.tsx'",
    ]);
  });

  it("keeps runtimeBridge.ts as a tiny compatibility export", () => {
    expect(runtimeBridgeSource.split("\n").filter((line) => line.trim()).length).toBeLessThanOrEqual(5);
    expect(runtimeBridgeSource).toContain('import "./styles.tailwind.css";');
    expect(normalizedWorkspaceFile("src", "styles.tailwind.css")).toContain('@import "./styles.css";');
    expect(runtimeBridgeSource).toContain('export { getZManagerRuntimeAdapter } from "./runtime/zmanagerRuntimeAdapter";');
    expect(runtimeBridgeSource).not.toContain("createCommandRouter");
    expect(runtimeBridgeSource).not.toContain("createArchiveWorkspace");
    expect(runtimeBridgeSource).not.toContain("appRoot.innerHTML");
  });

  it("keeps every allowed architecture exception mapped to a later deletion target", () => {
    const targetIds = new Set(FUTURE_FORBIDDEN_TARGETS.map((target) => target.id));
    const scanIds = new Set(LEGACY_AUDIT_SCANS.map((scan) => scan.id));
    const allowedExceptionIds = ALLOWED_LEGACY_EXCEPTIONS.map((exception) => exception.id);
    const usedTargetIds = new Set([
      ...ALLOWED_LEGACY_EXCEPTIONS.map((exception) => exception.targetId),
      ...ALLOWED_REACT_API_DESKTOP_IMPORT_EXCEPTIONS.map((exception) => exception.targetId),
    ]);

    expect(allowedExceptionIds.sort()).toEqual(uniqueSorted(allowedExceptionIds));
    expect(ALLOWED_LEGACY_EXCEPTIONS.filter((exception) => !targetIds.has(exception.targetId)).map((exception) => exception.id)).toEqual([]);
    expect(ALLOWED_LEGACY_EXCEPTIONS.filter((exception) => !scanIds.has(exception.scanId)).map((exception) => exception.id)).toEqual([]);
    expect(ALLOWED_REACT_API_DESKTOP_IMPORT_EXCEPTIONS.filter((exception) => !targetIds.has(exception.targetId)).map((exception) => exception.file)).toEqual([]);
    expect(FUTURE_FORBIDDEN_TARGETS.filter((target) => !usedTargetIds.has(target.id)).map((target) => target.id)).toEqual([]);
  });

  it("forbids the hidden legacy DOM bootstrap", () => {
    expectScanMatchesOnlyAllowed("hiddenLegacyDom");
  });

  it("forbids dangerous React and runtime HTML rendering exceptions", () => {
    expectScanMatchesOnlyAllowed("dangerousHtml");
  });

  it("keeps context menus as typed snapshots rendered by React without raw HTML", () => {
    expect(appRuntimeSource).toContain("items: readonly ContextMenuItem[];");
    expect(appRuntimeSource).not.toContain("html: string;");
    expect(contextMenuRuntimeSource).toContain("show(x: number, y: number, items: readonly ContextMenuItem[]): void;");
    expect(contextMenuRuntimeSource).toContain("let snapshot: ZManagerContextMenuSnapshot");
    expect(mainSource).toContain("contextMenuRuntime.show(");
    expect(mainSource).not.toContain("function showContextMenu(");
    expect(mainSource).not.toContain("function showContextMenu(x: number, y: number, html: string)");
    expect(mainSource).not.toContain("data-context-action");
    expect(contextMenuModelSource).toContain("export type ContextMenuItem");
    expect(contextMenuModelSource).toContain("export type ContextMenuActionPayload");
    expect(contextMenuRootSource).toContain("function renderContextMenuItem");
    expect(contextMenuRootSource).toContain('addEventListener("pointerdown"');
    expect(contextMenuRootSource).not.toContain('addEventListener("click"');
    expect(contextMenuRootSource).not.toContain("dangerouslySetInnerHTML");
  });

  it("forbids legacy archive/create view imports", () => {
    expectScanMatchesOnlyAllowed("legacyViewImports");
  });

  it("keeps create workspace rendering and selection out of hidden legacy bridge controls", () => {
    expect(productionSourceFilesFromRoots(["src"])).not.toContain("src/ui/createWorkspaceView.ts");
    expect(mainSource).not.toContain("./ui/createWorkspaceView");
    expect(mainSource).not.toContain("selectedCompressRows");
    expect(mainSource).not.toContain("focusedCompressRowPath");
    expect(mainSource).not.toContain("compressSelectionAnchorPath");
    expect(appRuntimeSource).not.toContain("createSelection:");
    expect(createWorkspaceStateSource).toContain("export type CreateWorkspaceSelectionSnapshot");
    expect(createWorkspaceStateSource).toContain("selection: CreateWorkspaceSelectionSnapshot;");
    expect(createWorkspaceSource).toContain("snapshot.create.selection.selectedPaths");
    expect(createWorkspaceSource).toContain("snapshot.create.selection.focusedPath");
  });

  it("forbids runtime and app innerHTML renderers", () => {
    expectScanMatchesOnlyAllowed("innerHtml");
  });

  it("keeps broad DOM event wiring limited to named runtime, interaction, and desktop seams", () => {
    expect(uniqueSorted(sourceLineMatchesForScan("broadDomWiring").map((match) => match.file))).toEqual(
      ALLOWED_BROAD_DOM_ACCESS_FILES.map((exception) => exception.file).sort(),
    );
  });

  it("keeps runtime bridge free of DOM access and UI event wiring", () => {
    expect(sourceLineMatches(["src/runtimeBridge.ts"], /document\.querySelector|getElementById|addEventListener/)
      .map(sourceLineKey)
      .sort()).toEqual([]);
  });

  it("keeps React UI modules from importing api or desktop directly except named interaction adapters", () => {
    const allowedImports = new Set(ALLOWED_REACT_API_DESKTOP_IMPORT_EXCEPTIONS.map(importReferenceKey));
    const violations = importReferencesForFiles(productionSourceFilesFromRoots(["src/ui/react"]))
      .filter((reference) => importTargetsSrcDirectory(reference, "api") || importTargetsSrcDirectory(reference, "desktop"))
      .filter((reference) => !allowedImports.has(importReferenceKey(reference)));
    const invalidExceptions = ALLOWED_REACT_API_DESKTOP_IMPORT_EXCEPTIONS
      .filter((exception) => !exception.file.startsWith("src/ui/react/interaction/"));

    expect(violations.map((reference) => `${reference.file}:${reference.lineNumber}: ${reference.specifier}`)).toEqual([]);
    expect(invalidExceptions.map((exception) => `${exception.file}: ${exception.specifier}`)).toEqual([]);
  });

  it("keeps app controllers free of React, DOM globals, desktop adapters, and Tauri imports", () => {
    const controllerFiles = productionSourceFilesFromRoots(["src/app/controllers"]);
    const importViolations = importReferencesForFiles(controllerFiles)
      .filter((reference) =>
        reference.specifier === "react"
        || reference.specifier.startsWith("react/")
        || reference.specifier === "react-dom"
        || reference.specifier.startsWith("react-dom/")
        || reference.specifier.startsWith("@tauri-apps/")
        || importTargetsSrcDirectory(reference, "desktop")
        || importTargetsSrcDirectory(reference, "ui/react")
      )
      .map((reference) => `${reference.file}:${reference.lineNumber}: ${reference.specifier}`);
    const domViolations = controllerDomGlobalMatches()
      .map((match) => `${match.file}:${match.lineNumber}: ${match.line}`);

    expect(importViolations).toEqual([]);
    expect(domViolations).toEqual([]);
  });

  it("keeps the Windows 11 native look foundation explicit", () => {
    expect(styles).toContain("--native-window-bg");
    expect(styles).toContain("--native-control-bg-hover");
    expect(styles).toContain("--native-selection-bg");
    expect(styles).toContain("--native-row-selected");
    expect(styles).toContain("--native-shadow-dialog");
  });

  it("keeps runtime chrome constants aligned with CSS fallbacks", () => {
    expect(styles).toContain("--zmanager-toolbar-height: 48px");
    expect(styles).toContain("--zmanager-statusbar-height: 26px");
    expect(constantsSource).toContain("APP_TOOLBAR_HEIGHT_PX = 48");
    expect(constantsSource).toContain("APP_STATUS_BAR_HEIGHT_PX = 26");
    expect(constantsSource).toContain("APP_NAV_PANE_DEFAULT_WIDTH_PX = 190");
    expect(constantsSource).toContain("APP_DETAILS_PANE_DEFAULT_WIDTH_PX = 280");
    expect(constantsSource).toContain("APP_STATUS_BAR_PARTS = 5");
  });

  it("renders the classic menu, command strip, and durable status surface visibly", () => {
    expect(appShellSource).toContain('<AppFrame runtimeBridgeReady={runtimeBridgeState === "ready"}>');
    expect(appFrameSource).toContain('className={workspaceClassName(snapshot)}');
    expect(menuBarSource).toContain('className="app-menu"');
    expect(commandToolbarSource).toContain('className="command-strip"');
    expect(commandToolbarSource).toContain("data-command-group={group.id}");
    expect(statusBarSource).toContain('id="workspace-status"');
    expect(mainSource).not.toContain('<nav class="app-menu"');
    expect(mainSource).not.toContain('<header class="command-toolbar mode-toolbar"');
    expect(mainSource).not.toContain('<footer class="status-bar"');
    expect(styles).toContain('"menu"\n    "toolbar"\n    "path"\n    "body"\n    "status"');
    expect(styles).not.toContain("#zmanager-runtime-bridge-root");
    expect(styles).toContain(".command-strip {");
    expect(styles).toContain(".toolbar-group-label {");
  });

  it("keeps status selection and focus text rendering in React shell chrome", () => {
    expect(statusBarSource).toContain("function statusBarModel");
    expect(statusBarSource).toContain("selection.visibleSelectedCount");
    expect(mainSource).not.toContain("renderShellStatusBar(shellStatusBarElements");
    expect(mainSource).not.toMatch(
      /status(?:SelectionCount|SelectionSize|FocusedSize|FocusedModified)Element\.textContent/,
    );
  });

  it("keeps Slice 9 UI adapters out of workflow and runtime seams", () => {
    const slice9Sources = [
      contextMenuHelpersSource,
      modalControllerSource,
    ];
    for (const source of slice9Sources) {
      expect(source).not.toMatch(/from "\.\.\/api/);
      expect(source).not.toMatch(/from "\.\.\/app\/(?:workspaces|controllers|shell)\//);
      expect(source).not.toMatch(/from "\.\.\/desktop/);
      expect(source).not.toMatch(
        /archiveWorkspace\.|createWorkspace\.|shellWorkspace\.|commandRouter|runRoutedCommand|invoke|Tauri|openNativeDialog|localStorage|sessionStorage|passwordInput|passwordConfirm|\.value.*password|password.*\.value|fetch\(|listen\(/,
      );
    }
    expect(jobsSurfacesSource).toContain('id="job-drawer"');
    expect(jobsSurfacesSource).toContain('id="quick-progress"');
    expect(mainSource).not.toContain("renderJobsListHtml");
    expect(mainSource).not.toContain("jobsListElement");
  });

  it("does not duplicate command buttons in secondary panes", () => {
    expect(mainSource).not.toContain("flat-view-toggle");
    expect(mainSource).not.toContain("data-detail-action");
    expect(styles).not.toContain(".flat-toggle");
  });

  it("does not show unimplemented preferences", () => {
    expect(mainSource).not.toContain("<h3>System</h3>");
    expect(mainSource).not.toContain("<h3>Menu/Shell integration</h3>");
    expect(mainSource).not.toContain("Integrate to shell context menu");
    expect(mainSource).not.toContain("Cascaded context menu");
    expect(mainSource).not.toContain("Icons in context menu");
  });

  it("keeps dialogs on shared native task and property primitives", () => {
    expect(dialogRootSource).toContain('className="dialog task-dialog"');
    expect(dialogRootSource).toContain('className="dialog property-dialog"');
    expect(preferencesDialogSource).toContain('className="dialog property-dialog dialog-wide"');
    expect(dialogRootSource).toContain('id="extract-start"');
    expect(dialogRootSource).toContain('id="extract-cancel"');
    expect(mainSource).not.toContain('from "./ui/modalController"');
    expect(mainSource).not.toContain("const modalController = createModalController");
    expect(dialogRootSource).toContain("function useDialogFocusRestoration");
    expect(dialogRootSource).toContain("function dialogReturnFocusElement");
    expect(dialogRootSource).toContain('element.closest("[hidden], .context-menu")');
    expect(dialogRootSource).toContain("function focusTargetForClosedDialog");
    expect(dialogRootSource).toContain('document.querySelector<HTMLElement>("#extract-all")');
    expect(mainSource).not.toContain("browsePasswordInput");
    expect(styles).toContain(".task-dialog");
    expect(styles).toContain(".property-dialog");
    expect(styles).toContain(".dialog-section");
    expect(styles).toContain(".property-dialog-body");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(styles).toContain(".dialog-section .form-grid > label:first-child");
  });

  it("keeps About diagnostics in the dialog body layout", () => {
    expect(dialogRootSource).toContain('className="dialog about-dialog"');
    expect(dialogRootSource).toContain('id="about-diagnostics"');
    expect(dialogSnapshotsSource).toContain("export function serializeAboutDiagnostics");
    expect(mainSource).toContain("serializeAboutDiagnostics(snapshot)");
    expect(mainSource).not.toContain("function diagnosticsText");
    expect(mainSource).not.toContain("aboutDiagnostics.querySelectorAll");
    expect(styles).toContain(".detail-list > div {\n  display: contents;");
    expect(styles).toContain(".diagnostics-groups");
  });

  it("scopes archive selection-column sizing to the archive table", () => {
    expect(styles).not.toMatch(/(^|[},]\s*)td:first-child\s*,\s*th:first-child\s*\{/m);
    expect(styles).toContain("#entry-table td:first-child");
    expect(styles).toContain("#entry-table th:first-child");
    expect(
      selectorsContainingFirstTableColumnRules(styles).filter((selector) => !selector.startsWith("#entry-table ")),
    ).toEqual([]);
  });

  it("centers the empty archive message inside the whole drop surface", () => {
    expect(styles).toContain(".browser-shell {\n  grid-area: body;\n  display: grid;\n  grid-template-rows: minmax(0, 1fr);");
    expect(styles).not.toContain(".workspace[data-mode=\"compress\"] .browser-shell {\n  grid-template-rows: auto minmax(0, 1fr);");
    expect(styles).toContain(".archive-table-pane {\n  min-width: 0;\n  min-height: 0;\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);");
    expect(styles).toContain(".table-shell.has-start-empty {\n  overflow: auto;");
    expect(styles).toContain(".table-shell.has-start-empty #archive-empty-state");
    expect(styles).toContain(".table-shell.has-start-empty #entry-table tbody .empty");
    expect(styles).toContain(".archive-empty-state {\n  min-height: 0;\n  height: 100%;");
  });

  it("declares stable Compress source table columns", () => {
    expect(createWorkspaceSource).toContain('id="compress-include-all"');
    expect(createWorkspaceSource).toContain('type="checkbox"');
    expect(createWorkspaceSource).toContain("function includeAllState");
    expect(createWorkspaceSource).toContain("node.indeterminate = includeAll.indeterminate");
    expect(mainSource).not.toContain('<th class="inclusion-column" data-i18n-text="table.include">Include</th>');
    expect(createWorkspaceSource).toContain('<CompressSourceHeader columnId="name"');
    expect(createWorkspaceSource).toContain('data-compress-column-id={columnId}');
    expect(createWorkspaceSource).toContain('data-column-resizer={columnId}');
    expect(createWorkspaceSource).toContain("function startCompressSourceColumnResize");
    expect(createWorkspaceSource).toContain('actions.handleCreateIntent({ type: "setCurrentFolderIncluded"');
    expect(styles).toContain("#compress-source-table th:nth-child(1)");
    expect(styles).toContain("#compress-source-table th:nth-child(2)");
    expect(styles).toContain("#compress-source-table th:nth-child(3)");
    expect(styles).toContain("#compress-source-table th:nth-child(4)");
    expect(styles).toContain("var(--compress-source-name-column-width, 42%)");
  });

  it("keeps Compress create canonical in-window with validation and table actions", () => {
    expect(createWorkspaceSource).not.toContain('className="compress-create-panel"');
    expect(mainSource).not.toContain('id="create-dialog"');
    expect(commandToolbarSource).toContain('<ToolbarButton commandId="add" />');
    expect(commandToolbarSource).toContain('id="browse-create-destination"');
    expect(commandToolbarSource).toContain('label={i18n.t("compress.outputFolder")}');
    expect(commandToolbarSource).not.toContain('label={i18n.t("common.browse")}');
    expect(mainSource).toContain('title: displayContext.translator.t("nativeDialog.chooseCreateOutputFolder")');
    expect(mainSource).toContain("directory: true");
    expect(mainSource).toContain("destinationPathForOutputFolder(selected, optionSnapshot.destinationPath)");
    expect(mainSource).not.toContain("CREATE_ARCHIVE_FILTERS");
    expect(mainSource).not.toContain("saveNativeDialog");
    expect(commandToolbarSource).toContain('id="start-create"');
    expect(commandToolbarSource).toContain('id="include-all-sources"');
    expect(commandToolbarSource).toContain('id="exclude-all-sources"');
    expect(commandToolbarSource).toContain('id="clear-sources"');
    expect(commandToolbarSource).toContain('data-command-group="table"');
    expect(commandToolbarSource).toContain("setVisibleRowsIncluded");
    expect(commandToolbarSource).toContain("createPlanRowInclusionState");
    expect(commandToolbarSource).not.toContain("setAllIncluded");
    expect(commandToolbarSource).not.toContain('id="create-destination-recent"');
    expect(commandToolbarSource).not.toContain('commandId="createFile"');
    expect(commandToolbarSource).toContain("create.options.readiness.unavailableReason");
    expect(commandToolbarSource).toContain('type: "runCreate"');
    expect(createWorkspaceSource).not.toContain('id="add-source"');
    expect(createWorkspaceSource).not.toContain('id="start-create"');
    expect(createWorkspaceSource).not.toContain('id="create-plan-meta"');
    expect(mainSource).not.toContain("createArchiveUnavailableReason({");
    expect(createWorkspaceSource).toContain('className="compress-options-summary"');
    expect(createWorkspaceSource).toContain("const useBrowserLayoutEffect = typeof window");
    expect(createWorkspaceSource).toContain("useBrowserLayoutEffect(() => {");
    expect(appShellSource).toContain("<CreatePasswordProvider>");
    expect(commandToolbarSource).toContain("useCreatePasswordState");
    expect(createWorkspaceSource).toContain("useCreatePasswordState");
    expect(createPasswordContextSource).toContain("useState(\"\")");
    expect(createPasswordContextSource).toContain("setPasswordConfirm(\"\")");
    expect(createPasswordContextSource).toContain("setShowPassword(false)");
    expect(createWorkspaceSource).toContain("sourcePathForCreatePlanRow(row");
    expect(createWorkspaceSource).toContain("data-compress-source-path={sourcePath || undefined}");
    expect(contextMenuModelSource).toContain('action: "reveal-source"');
    expect(contextMenuModelSource).toContain('action: "remove-source"');
    expect(createWorkspaceSource).toContain('aria-keyshortcuts={selectable ? "Space Enter Delete ContextMenu Shift+F10"');
    expect(mainSource).toContain("function removableSourcePathForCompressPath");
    expect(mainSource).toContain("if (!rowPath || snapshot.view.currentFolder)");
    expect(mainSource).toContain("normalizeEntryPath(rowPath) === getPathBasename(sourcePath)");
    expect(mainSource).toContain("removableSourcePath ? sourcePathsForCompressMenu(removableSourcePath) : []");
    expect(mainSource).toContain("function sourcePathsForCompressMenu");
    expect(contextMenuModelSource).toContain('command.removeSelectedSources');
    expect(createWorkspaceSource).toContain('event.key === "Delete"');
    expect(mainSource).not.toContain('<button type="button" data-command-id="helpContents" data-i18n-text="common.help">Help</button>');
    expect(mainSource).not.toContain('createPasswordInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);');
    expect(mainSource).not.toContain('createPasswordConfirmInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);');
    expect(mainSource).not.toContain("createPasswordInput.value = intent.password");
    expect(mainSource).not.toContain("createPasswordConfirmInput.value = intent.passwordConfirm");
    expect(styles).toContain(".source-stage-badge");
    expect(styles).toContain(".tool-button.is-primary-command");
    expect(styles).not.toContain(".compress-destination-field");
    expect(styles).not.toContain(".plan-validation");
    expect(styles).not.toContain("#start-create:not(:disabled)");
  });

  it("keeps Extract selected validation and optional fields native", () => {
    expect(mainSource).toContain("function requestExtractPasswordInDialog");
    expect(appShellSource).toContain("<DialogRoot />");
    expect(dialogRootSource).toContain('id="extract-destination"');
    expect(dialogRootSource).toContain('id="extract-start"');
    expect(dialogRootSource).toContain('type: "submitExtract"');
    expect(dialogRootSource).toContain('type: "browseExtractDestination"');
    expect(mainSource).toContain("function buildReactExtractDialogSnapshot");
    expect(mainSource).toContain("function updateOpenExtractDialogSnapshot");
    expect(mainSource).toContain("function extractDialogFormFromIntent");
    expect(mainSource).toContain("extractStartInputFromDialogForm(activeExtractDialogForm, intent.password)");
    expect(mainSource).toContain("closeExtractDialog: closeReactDialog");
    expect(mainSource).not.toContain("writeReactExtractFormToLegacyControls");
    expect(mainSource).not.toContain("currentReactExtractDialogSnapshot");
    expect(mainSource).not.toContain("syncReactExtractDialogSnapshot");
    expect(mainSource).not.toContain('extractDialog.addEventListener("keydown"');
    expect(mainSource).not.toContain('extractDestinationInput.addEventListener("input"');
    expect(mainSource).not.toContain("function isDefaultSafeDialogTextEntry");
    expect(mainSource).not.toContain("dialog === extractDialog");
    expect(mainSource).not.toContain("target instanceof HTMLInputElement");
    expect(dialogRootSource).toContain('onClick={() => actions.handleDialogIntent({ type: "closeCurrent" })}');
    expect(mainSource).toContain('directory: true,\n    multiple: false,');
    expect(dialogRootSource).toContain('className="advanced-options extract-password-options"');
    expect(mainSource).not.toContain("browsePasswordInput");
    expect(extractStartControllerSource).not.toContain("readInput");
    expect(extractStartControllerSource).toContain("startExtract(mode: ExtractMode, input: ExtractStartInput)");
    expect(extractStartControllerSource).toContain('operation: passwordRetryOperation(mode)');
    expect(extractStartControllerSource).toContain('"extractArchive" : "extractSelection"');
    expect(extractStartControllerSource).toContain("options.requestPasswordInDialog(retry);");
    expect(mainSource).not.toContain('id="extract-restore-security"');
    expect(styles).toContain("#extract-start.primary-action");
    expect(styles).toContain(".task-dialog .dialog-section .form-grid > label");
    expect(styles).toContain(".task-dialog .dialog-section .form-grid > .checkbox-row");
    expect(styles).toContain("details.advanced-options:not([open]) > :not(summary)");
    expect(styles).toContain(".extract-password-options:not([open])");
    expect(styles).toContain(".task-dialog .dialog-body");
  });

  it("keeps the three-pane workspace splitters visible and keyboard reachable", () => {
    expect(archiveWorkspaceSource).toContain("<WorkspaceBrowserShell");
    expect(createWorkspaceSource).toContain("<WorkspaceBrowserShell");
    expect(workspaceBrowserShellSource).not.toContain("topPanel");
    expect(workspaceBrowserShellSource).toContain('<PaneResizer pane="navigation"');
    expect(workspaceBrowserShellSource).toContain('<PaneResizer pane="details"');
    expect(createWorkspaceSource).toContain('id="navigation-pane"');
    expect(paneResizerSource).toContain('data-pane-resizer={pane}');
    expect(paneResizerSource).toContain('role="separator"');
    expect(paneResizerSource).toContain("tabIndex={0}");
    expect(paneResizerSource).toContain('aria-keyshortcuts="ArrowLeft ArrowRight Home End"');
    expect(paneResizerSource).toContain("resizePaneByKeyboard(event.currentTarget, event.nativeEvent, pane)");
    expect(paneResizerSource).toContain('nextWidth = pane === "navigation" ? currentWidth - step : currentWidth + step');
    expect(paneResizerSource).toContain('nextWidth = pane === "navigation" ? currentWidth + step : currentWidth - step');
    expect(styles).toContain(".pane-resizer-grip");
    expect(styles).toContain(".pane-resizer::before");
    expect(styles).toContain("grid-template-columns:\n    minmax(var(--zmanager-nav-pane-min), clamp(var(--zmanager-nav-pane-min), var(--zmanager-nav-pane-width, 190px), var(--zmanager-nav-pane-max)))");
  });

  it("keeps Compress on the shared workspace path bar instead of the old create-only chrome", () => {
    expect(createWorkspaceSource).toContain("<WorkspacePathBar");
    expect(createWorkspaceSource).toContain('pathInputId="create-destination"');
    expect(createWorkspaceSource).toContain('type: "setSearchQuery"');
    expect(workspacePathBarSource).not.toContain("pathActions");
    expect(workspacePathBarSource).not.toContain("pathDatalist");
    expect(commandToolbarSource).toContain("function CompressDestinationToolbarButton");
    expect(commandToolbarSource).toContain("function CreateArchiveToolbarButton");
    expect(commandToolbarSource).toContain("function CompressTableToolbarButtons");
    expect(commandToolbarSource).toContain('id="browse-create-destination"');
    expect(commandToolbarSource).toContain("compress.outputFolder");
    expect(commandToolbarSource).toContain('id="start-create"');
    expect(commandToolbarSource).not.toContain('id="create-destination-recent"');
    expect(createWorkspaceSource).not.toContain('<label className="compress-destination-field">');
    expect(createWorkspaceSource).not.toContain("pathActions=");
    expect(createWorkspaceSource).not.toContain("pathDatalist=");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] {\n  grid-template-rows: var(--zmanager-menu-height) var(--zmanager-toolbar-height) var(--zmanager-pathbar-height) minmax(0, 1fr) var(--zmanager-statusbar-height);");
    expect(styles).not.toContain(".workspace[data-mode=\"compress\"] .path-bar {\n  display: none;\n}");
  });

  it("keeps details values aligned and long paths predictable", () => {
    expect(archiveDetailsPaneSource).toContain('function detailValueMode(value: string): "wrap" | "middle"');
    expect(archiveDetailsPaneSource).toContain("function middleTruncateDetailValue");
    expect(archiveDetailsPaneSource).toContain('className="detail-value detail-value-middle"');
    expect(archiveDetailsPaneSource).toContain('aria-label={`${label}: ${value}`}');
    expect(archiveDetailsPaneSource).toContain('<span className="sr-only">{value}</span>');
    expect(dialogSnapshotsSource).toContain('{ label: message(display, "detail.path"), value: entry.path }');
    expect(styles).toContain("grid-template-columns: minmax(76px, 34%) minmax(0, 1fr);");
    expect(styles).toContain(".detail-value-wrap");
    expect(styles).toContain(".detail-value-middle");
  });

  it("keeps compact and minimum workspace pane behavior explicit", () => {
    expect(styles).toContain("@media (max-width: 1100px)");
    expect(styles).toContain("grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .details-pane {\n    grid-row: 4;");
    expect(styles).toContain("@media (max-width: 760px), (max-height: 520px)");
    expect(styles).toContain("grid-template-rows: minmax(42px, auto) minmax(156px, 1fr) minmax(146px, auto);");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .archive-table-pane {\n    grid-row: 3;");
    expect(styles).toContain("max-height: 56px;");
    expect(styles).toContain(".navigation-pane .tree-content {\n    min-width: 0;\n    display: flex;");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .compress-options-panel {\n    min-height: 0;\n    gap: 0;\n    overflow: hidden;");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .compress-options-summary {\n    min-height: 29px;");
    expect(styles).toContain(".detail-block .detail-list > div:nth-of-type(n+5)");
    expect(styles).toContain(".detail-block .detail-list > div:nth-of-type(n+4)");
    expect(styles).toContain(".compress-options-panel:not([open]) > :not(summary)");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .compress-options-panel .create-options-grid");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .details-pane:has(.compress-options-panel[open])");
    expect(styles).not.toContain(".workspace[data-mode=\"compress\"] .compress-options-panel > * {\n    display: none;");
  });

  it("keeps native icon image sizing separate from file-kind icon classes", () => {
    expect(styles).toContain(".row-icon-native-image");
    expect(styles).toContain(".tree-icon-native-image");
    expect(styles).toContain(".detail-icon-native-image");
    expect(styles).toContain("max-height: 100%;");
    expect(styles).toContain("overflow: hidden;");
    expect(styles).not.toMatch(/\.row-icon-image,\s*\n\.tree-icon-image,\s*\n\.detail-icon-image\s*\{\s*\n\s*width:\s*100%;/);
  });

  it("keeps Explorer-like table keyboard and empty-state contracts explicit", () => {
    expect(archiveTableSource).toContain('aria-keyshortcuts="Enter Space ContextMenu Shift+F10"');
    expect(archiveTableSource).toContain('aria-keyshortcuts="Space Enter ContextMenu Shift+F10"');
    expect(contextMenuModelSource).toContain('action: "sort-ascending"');
    expect(contextMenuModelSource).toContain('action: "sort-descending"');
    expect(contextMenuModelSource).toContain('"extract-here"');
    expect(contextMenuModelSource).toContain('action: "paste-archive-path"');
    expect(contextMenuModelSource).toContain('action: "open-recent-archive"');
    expect(contextMenuModelSource).toContain('action: "reset-columns"');
    expect(contextMenuHelpersSource).toContain("export function contextMenuItems");
    expect(contextMenuHelpersSource).not.toContain("addEventListener");
    expect(contextMenuRootSource).toContain("function handleContextMenuKeyboard");
    expect(contextMenuRootSource).toContain("onClick={(event) =>");
    expect(archiveTableSource).toContain('<table id="entry-table" className={archiveTableClassName(snapshot)}>');
    expect(createWorkspaceSource).toContain('aria-keyshortcuts={selectable ? "Space Enter Delete ContextMenu Shift+F10"');
    expect(createWorkspaceStateSource).toContain("selectRow(path, modifiers)");
    expect(mainSource).toContain("createWorkspace.selectRow(intent.path, intent)");
    expect(mainSource).toContain("showCompressRowContextMenuForPath");
    expect(styles).toContain(".table-shell.has-start-empty #archive-empty-state");
    expect(styles).toContain(".table-shell.has-start-empty #entry-table tbody .empty");
    expect(styles).toContain('tbody tr[aria-selected="true"] .row-primary::before');
  });

  it("keeps screen-reader-only text fully clipped out of visual rows", () => {
    expect(styles).toContain(".sr-only {\n  position: absolute;");
    expect(styles).toContain("clip-path: inset(50%);");
    expect(styles).toContain("white-space: nowrap;");
  });

  it("keeps Extract destination, defaults, and archive navigation understandable", () => {
    expect(archiveTableSource).toContain('data-empty-action="open-archive"');
    expect(archiveDetailsPaneSource).toContain("<h3");
    expect(archiveDetailsPaneSource).toContain('data-details-action="open-archive"');
    expect(archiveDetailsPaneSource).toContain("data-copy-value={value}");
    expect(archivePathBarSource).toContain('pathInputId="extract-destination"');
    expect(archivePathBarSource).toContain('type: "setExtractDestination"');
    expect(archivePathBarSource).toContain('type: "browseExtractDestination"');
    expect(archiveDetailsPaneSource).toContain("<ExtractOptions />");
    expect(archiveDetailsPaneSource).toContain('className="advanced-options"');
    expect(archiveDetailsPaneSource).toContain('id="extract-password"');
    expect(workspacePathBarSource).toContain("readOnly");
    expect(workspacePathBarSource).toContain("hidden={crumbsHidden}");
    expect(workspacePathBarSource).toContain("pathAccessory ?");
    expect(archiveTreeSource).toContain("archive.view.treeFolders.map");
    expect(workspacePathBarSource).toContain('aria-keyshortcuts="Enter Space"');
    expect(mainSource).toContain('open: { primary: mode === "extract" && !hasArchive },');
    expect(mainSource).toContain('refresh: { secondary: true },');
    expect(commandToolbarSource).toContain('primary ? "is-primary-command" : ""');
    expect(commandToolbarSource).toContain('secondary ? "is-secondary-command" : ""');
    expect(workspacePathBarSource).toContain("disabled={search.disabled}");
    expect(styles).toContain(".detail-copyable");
    expect(styles).toContain(".tool-button.is-primary-command");
    expect(styles).toContain(".tool-button.is-secondary-command");
  });

  it("keeps search and flat view as stateful file-table controls", () => {
    expect(workspacePathBarSource).toContain('id="search-submit"');
    expect(workspacePathBarSource).toContain('id="clear-search"');
    expect(workspacePathBarSource).toContain('id="search-count"');
    expect(archivePathBarSource).toContain("archive.view.selection.visibleSelectablePaths.length");
    expect(archiveTableSource).toContain('className={archive.view.searchQuery ? "search-empty-row" : ""}');
    expect(archiveDetailsPaneSource).toContain('i18n.t("detail.selectionHiddenBySearch")');
    expect(archiveDetailsPaneSource).toContain('action: "clear-search"');
    expect(archiveDetailsPaneSource).toContain('data-details-action="clear-search"');
    expect(archiveWorkspaceStateSource).toContain("setFlatView(flatView)");
    expect(archiveWorkspaceStateSource).toContain("flatView: state.view.flatView");
    expect(archiveTableSource).toContain("snapshot.archive.view.flatView");
    expect(commandToolbarSource).toContain("aria-pressed={typeof pressed === \"boolean\" ? pressed : undefined}");
    expect(menuBarSource).toContain("aria-pressed={typeof pressed === \"boolean\" ? pressed : undefined}");
    expect(styles).toContain(".search-box");
    expect(styles).toContain(".search-count");
    expect(styles).toContain('.command-toolbar .tool-button[aria-pressed="true"]');
    expect(styles).toContain('.menu-item[aria-pressed="true"]::before');
    expect(styles).toContain(".row-secondary");
  });

  it("keeps selection properties and entry preview surfaces unambiguous", () => {
    expect(dialogSnapshotsSource).toContain('message(display, "info.selectionTitle")');
    expect(mainSource).toContain("function showSelectionInfo");
    expect(archiveDetailsPaneSource).toContain('action: "extract-selected"');
    expect(dialogSnapshotsSource).toContain('action: "archive-info"');
    expect(dialogSnapshotsSource).toContain('action: "preview"');
    expect(archiveDetailsPaneSource).toContain('data-details-action="preview"');
    expect(archiveDetailsPaneSource).toContain('data-details-action="extract-selected"');
    expect(dialogSnapshotsSource).toContain("export function entryInfoDetailRows");
    expect(dialogSnapshotsSource).toContain('label: message(display, "detail.ratio")');
    expect(dialogSnapshotsSource).toContain("value: display.format.ratio(entry.size, entry.compressedSize");
    expect(mainSource).toContain("returnFocusPath: infoReturnFocusPath()");
    expect(mainSource).not.toContain('id="info-dialog-close"');
    expect(styles).toContain(".detail-actions");
    expect(styles).toContain(".dialog-action-group");
  });

  it("shares drag-window selection behavior without merging table row ownership", () => {
    expect(tableMarqueeSelectionSource).toContain("applyHierarchicalMarqueeSelection");
    expect(archiveTableSource).toContain("armTableMarqueeSelectionGesture");
    expect(createWorkspaceSource).toContain("armTableMarqueeSelectionGesture");
    expect(archiveTableSource).toContain('rowSelector: "tr[data-entry-path]"');
    expect(createWorkspaceSource).toContain('rowSelector: "tr[data-compress-path]"');
    expect(archiveTableSource).toContain("export function ArchiveTable()");
    expect(createWorkspaceSource).toContain("function CreateTable()");
  });

  it("keeps drag and drop affordances local, explicit, and deterministic", () => {
    expect(dropOverlaySource).toContain('id="drop-overlay-actions"');
    expect(dropOverlaySource).toContain('data-drop-choice="open-archive"');
    expect(dropOverlaySource).toContain('data-drop-choice="add-compress"');
    expect(appFrameSource).toContain("data-drop-state={snapshot.shell.dropOverlay.mode}");
    expect(appFrameSource).toContain("data-drop-target={snapshot.shell.dropOverlay.copy?.target}");
    expect(mainSource).not.toContain('<div id="drop-overlay"');
    expect(shellWorkspaceSource).toContain('export type DropOverlayMode = "idle" | "active" | "choosing";');
    expect(appFrameSource).toContain("data-drop-target={snapshot.shell.dropOverlay.copy?.target}");
    expect(mainSource).toContain("setDropOverlayChoice(decision, dropCopyForDecision(decision));");
    expect(shellWorkspaceSource).toContain("setDropOverlayChoice(choice, copy)");
    expect(mainSource).not.toContain('document.querySelector<HTMLButtonElement>("#drop-open-archive")?.focus();');
    expect(dropOverlaySource).toContain("primaryActionRef.current?.focus();");
    expect(dropOverlaySource).toContain('actions.handleDesktopIntent({ type: "dropChoice", choice: "openArchive" })');
    expect(browserFileDropAdapterSource).toContain('droppedPathsFromDataTransfer');
    expect(mainSource).toContain('droppedPathsFromDesktopEvent');
    expect(mainSource).not.toContain("window.confirm(");
    expect(styles).toContain("grid-area: body;");
    expect(styles).toContain('.workspace[data-drop-state="active"][data-drop-target="compress"] .compress-table-shell');
    expect(styles).toContain('.workspace[data-drop-state="active"][data-drop-target="extract"] .table-shell');
    expect(styles).toContain('.workspace[data-drop-target="blocked"] .drop-overlay');
    expect(styles).toContain(".drop-overlay-actions");
  });
});
