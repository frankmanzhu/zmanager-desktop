import { describe, expect, it } from "vitest";

declare const process: {
  cwd(): string;
};

declare function require(id: "fs"): {
  readFileSync(path: string, encoding: string): string;
};

declare function require(id: "path"): {
  join(...parts: string[]): string;
};

const { readFileSync } = require("fs");
const { join } = require("path");

function normalizedWorkspaceFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8").replace(/\r\n/g, "\n");
}

const styles = normalizedWorkspaceFile("src", "styles.css");
const compositionRootSource = normalizedWorkspaceFile("src", "main.ts");
const mainSource = normalizedWorkspaceFile("src", "runtimeBridge.ts");
const appShellSource = normalizedWorkspaceFile("src", "ui", "react", "AppShell.tsx");
const appFrameSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "AppFrame.tsx");
const menuBarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "MenuBar.tsx");
const commandToolbarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "CommandToolbar.tsx");
const statusBarSource = normalizedWorkspaceFile("src", "ui", "react", "shell", "StatusBar.tsx");
const dropOverlaySource = normalizedWorkspaceFile("src", "ui", "react", "shell", "DropOverlay.tsx");
const browserFileDropAdapterSource = normalizedWorkspaceFile("src", "ui", "react", "interaction", "BrowserFileDropAdapter.tsx");
const paneResizerSource = normalizedWorkspaceFile("src", "ui", "react", "interaction", "PaneResizer.tsx");
const dialogRootSource = normalizedWorkspaceFile("src", "ui", "react", "dialogs", "DialogRoot.tsx");
const contextMenuRootSource = normalizedWorkspaceFile("src", "ui", "react", "context-menu", "ContextMenuRoot.tsx");
const appRuntimeSource = normalizedWorkspaceFile("src", "ui", "react", "appRuntime.ts");
const preferencesDialogSource = normalizedWorkspaceFile("src", "ui", "react", "preferences", "PreferencesDialog.tsx");
const archiveWorkspaceSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveWorkspace.tsx");
const archiveTableSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveTable.tsx");
const archivePathBarSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchivePathBar.tsx");
const archiveDetailsPaneSource = normalizedWorkspaceFile("src", "ui", "react", "archive", "ArchiveDetailsPane.tsx");
const createWorkspaceSource = normalizedWorkspaceFile("src", "ui", "react", "create", "CreateWorkspace.tsx");
const workspaceBrowserShellSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "WorkspaceBrowserShell.tsx");
const workspacePathBarSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "WorkspacePathBar.tsx");
const tableMarqueeSelectionSource = normalizedWorkspaceFile("src", "ui", "react", "workspace", "tableMarqueeSelection.ts");
const extractStartControllerSource = normalizedWorkspaceFile("src", "app", "controllers", "extractStartController.ts");
const shellWorkspaceSource = normalizedWorkspaceFile("src", "app", "shell", "shellWorkspace.ts");
const contextMenuModelSource = normalizedWorkspaceFile("src", "app", "commands", "contextMenuModel.ts");
const contextMenuHelpersSource = normalizedWorkspaceFile("src", "ui", "contextMenuHelpers.ts");
const modalControllerSource = normalizedWorkspaceFile("src", "ui", "modalController.ts");
const jobsSurfacesSource = normalizedWorkspaceFile("src", "ui", "react", "jobs", "JobsSurfaces.tsx");
const constantsSource = normalizedWorkspaceFile("src", "app", "constants.ts");
const appRootInnerHtmlToken = ["appRoot", "innerHTML"].join(".");
const runtimeBridgeRootToken = ["zmanager", "runtime", "bridge", "root"].join("-");
const legacyPrivatizationToken = ["privatize", "Legacy"].join("");

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
  it("keeps main.ts as the React composition root while legacy GUI migrates", () => {
    expect(compositionRootSource).toContain('from "./ui/react/AppShell"');
    expect(compositionRootSource).toContain("createRoot(app).render(");
    expect(compositionRootSource).not.toContain(appRootInnerHtmlToken);
    expect(compositionRootSource).not.toContain("@tauri-apps/api/");
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
    expect(appShellSource).not.toContain(runtimeBridgeRootToken);
    expect(styles).not.toContain(runtimeBridgeRootToken);
    expect(mainSource).not.toContain(appRootInnerHtmlToken);
    expect(mainSource).not.toContain(legacyPrivatizationToken);
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
    expect(mainSource).not.toContain('data-dialog-default="#extract-start"');
    expect(mainSource).not.toContain('data-dialog-cancel="#extract-cancel"');
    expect(mainSource).not.toContain('from "./ui/modalController"');
    expect(mainSource).not.toContain("const modalController = createModalController");
    expect(modalControllerSource).toContain("function resolveReturnFocus");
    expect(modalControllerSource).toContain("function getDialogSurface");
    expect(modalControllerSource).toContain("function dialogButtonFromSelector");
    expect(modalControllerSource).toContain("function keepFocusInsideOpenModal");
    expect(mainSource).not.toContain("browsePasswordInput");
    expect(styles).toContain(".task-dialog");
    expect(styles).toContain(".property-dialog");
    expect(styles).toContain(".dialog-section");
    expect(styles).toContain(".property-dialog-body");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(styles).toContain(".dialog-section .form-grid > label:first-child");
  });

  it("keeps About diagnostics in the dialog body layout", () => {
    expect(mainSource).not.toContain('id="about-dialog"');
    expect(mainSource).not.toContain('id="info-dialog"');
    expect(mainSource).not.toContain('id="about-diagnostics"');
    expect(dialogRootSource).toContain('<div id="about-diagnostics" className="diagnostics diagnostics-groups">');
    expect(mainSource).toContain('function diagnosticsText(): string');
    expect(mainSource).toContain("function serializeAboutDiagnostics");
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
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .browser-shell {\n  grid-template-rows: auto minmax(0, 1fr);");
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

  it("keeps Compress create canonical in-window with validation and source actions", () => {
    expect(createWorkspaceSource).toContain('className="compress-create-panel"');
    expect(mainSource).not.toContain('id="create-dialog"');
    expect(commandToolbarSource).toContain('id="create-destination-recent"');
    expect(createWorkspaceSource).toContain('id="clear-sources"');
    expect(createWorkspaceSource).toContain('id="create-plan-meta"');
    expect(createWorkspaceSource).toContain("create.options.readiness.unavailableReason");
    expect(mainSource).not.toContain("createArchiveUnavailableReason({");
    expect(createWorkspaceSource).toContain('className="compress-options-summary"');
    expect(createWorkspaceSource).toContain("const useBrowserLayoutEffect = typeof window");
    expect(createWorkspaceSource).toContain("useBrowserLayoutEffect(() => {");
    expect(createWorkspaceSource).toContain("sourcePathForCreatePlanRow(row");
    expect(createWorkspaceSource).toContain("data-compress-source-path={sourcePath || undefined}");
    expect(mainSource).toContain('{ action: "reveal-source", sourcePath }');
    expect(mainSource).toContain('{ action: "remove-source", sourcePath, sourcePaths: [sourcePath] }');
    expect(createWorkspaceSource).toContain('aria-keyshortcuts={selectable ? "Space Enter Delete ContextMenu Shift+F10"');
    expect(mainSource).not.toContain("function removableSourcePathForCompressRow");
    expect(mainSource).toContain("function removableSourcePathForCompressPath");
    expect(mainSource).toContain("createCreateWorkspaceSelection");
    expect(mainSource).toContain("createWorkspaceSelection.has(row.path)");
    expect(mainSource).toContain("if (!rowPath || snapshot.view.currentFolder)");
    expect(mainSource).toContain("normalizeEntryPath(rowPath) === getPathBasename(sourcePath)");
    expect(mainSource).toContain("removableSourcePath ? sourcePathsForCompressMenu(removableSourcePath) : []");
    expect(mainSource).toContain("function sourcePathsForCompressMenu");
    expect(mainSource).toContain('message("command.removeSelectedSources"');
    expect(mainSource).not.toContain('event.key === "Delete"');
    expect(mainSource).not.toContain('<button type="button" data-command-id="helpContents" data-i18n-text="common.help">Help</button>');
    expect(mainSource).not.toContain('createPasswordInput.addEventListener("input"');
    expect(mainSource).not.toContain('createPasswordConfirmInput.addEventListener("input"');
    expect(mainSource).not.toContain('startCreateButton.addEventListener("click"');
    expect(mainSource).not.toContain("createPasswordInput.value = intent.password");
    expect(mainSource).not.toContain("createPasswordConfirmInput.value = intent.passwordConfirm");
    expect(styles).toContain(".compress-destination-field .inline-field");
    expect(styles).toContain(".source-stage-badge");
    expect(styles).toContain(".plan-validation");
    expect(styles).toContain("#start-create:not(:disabled)");
  });

  it("keeps Extract selected validation and optional fields in React state", () => {
    expect(mainSource).not.toContain('id="extract-dialog"');
    expect(mainSource).not.toContain('<button id="extract-start"');
    expect(mainSource).not.toContain("function isExtractDestinationValid");
    expect(mainSource).not.toContain("function syncExtractDialogState");
    expect(mainSource).toContain("function requestExtractPasswordInDialog");
    expect(mainSource).not.toContain("function handleExtractDialogEnter");
    expect(appShellSource).toContain("<DialogRoot />");
    expect(dialogRootSource).toContain('id="extract-destination"');
    expect(dialogRootSource).toContain('id="extract-start"');
    expect(dialogRootSource).toContain('type: "submitExtract"');
    expect(dialogRootSource).toContain('type: "browseExtractDestination"');
    expect(mainSource).toContain("setReactDialogSnapshot(currentReactExtractDialogSnapshot(mode));");
    expect(mainSource).toContain("closeExtractDialog: closeReactDialog");
    expect(mainSource).toContain("extractStartInputFromFormValues(intent.mode");
    expect(mainSource).not.toContain("extractStartInputFromLegacyControls");
    expect(mainSource).not.toContain("writeReactExtractFormToLegacyControls");
    expect(extractStartControllerSource).not.toContain("readInput");
    expect(mainSource).not.toContain('extractDialog.addEventListener("keydown"');
    expect(mainSource).not.toContain("extractDestinationInput");
    expect(mainSource).not.toContain("function isDefaultSafeDialogTextEntry");
    expect(mainSource).not.toContain("dialog === extractDialog");
    expect(mainSource).toContain('directory: true,\n    multiple: false,');
    expect(dialogRootSource).toContain('className="advanced-options extract-password-options"');
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
    expect(commandToolbarSource).toContain("function CompressDestinationToolbarControls");
    expect(commandToolbarSource).toContain('id="browse-create-destination"');
    expect(commandToolbarSource).toContain('id="create-destination-recent"');
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
    expect(mainSource).toContain('{ label: message("detail.path"), value: entry.path }');
    expect(styles).toContain("grid-template-columns: minmax(76px, 34%) minmax(0, 1fr);");
    expect(styles).toContain(".detail-value-wrap");
    expect(styles).toContain(".detail-value-middle");
  });

  it("keeps compact and minimum workspace pane behavior explicit", () => {
    expect(styles).toContain("@media (max-width: 1100px)");
    expect(styles).toContain("grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);");
    expect(styles).toContain(".workspace[data-mode=\"compress\"] .details-pane {\n    grid-row: 3;");
    expect(styles).toContain("@media (max-width: 760px), (max-height: 520px)");
    expect(styles).toContain("grid-template-rows: auto minmax(36px, auto) minmax(150px, 1fr) minmax(36px, auto);");
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
    expect(contextMenuModelSource).toContain("export type ContextMenuModelItem");
    expect(mainSource).toContain('{ action: "sort-ascending"');
    expect(mainSource).toContain('{ action: "sort-descending"');
    expect(mainSource).toContain('{ action: "extract-here"');
    expect(mainSource).toContain('{ action: "paste-archive-path"');
    expect(mainSource).toContain('action: "open-recent-archive"');
    expect(mainSource).toContain('{ action: "reset-columns"');
    expect(contextMenuHelpersSource).toContain("export function contextMenuItems");
    expect(contextMenuHelpersSource).not.toContain("decodeContextMenuAction");
    expect(contextMenuHelpersSource).not.toContain("addEventListener");
    expect(contextMenuRootSource).toContain("function handleContextMenuKeyboard");
    expect(contextMenuRootSource).toContain("onClick: (event: MouseEvent<HTMLButtonElement>) =>");
    expect(contextMenuRootSource).toContain('actions.handleContextMenuIntent({ type: "action", payload });');
    expect(contextMenuRootSource).not.toContain("dangerouslySetInnerHTML");
    expect(archiveTableSource).toContain('<table id="entry-table">');
    expect(mainSource).toContain("function updateCompressSelectionByIntent");
    expect(mainSource).toContain("showCompressRowContextMenu");
    expect(styles).toContain(".table-shell.has-start-empty #archive-empty-state");
    expect(styles).toContain(".table-shell.has-start-empty #entry-table tbody .empty");
    expect(styles).toContain('tbody tr[aria-selected="true"] .row-primary::before');
  });

  it("keeps context menu snapshots typed instead of hidden HTML", () => {
    expect(appRuntimeSource).toContain("items: readonly ContextMenuModelItem[]");
    expect(appRuntimeSource).not.toContain("html: string");
    expect(contextMenuRootSource).not.toContain("dangerouslySetInnerHTML");
    expect(contextMenuRootSource).not.toContain("decodeContextMenuAction");
    expect(mainSource).toContain("function showContextMenu(x: number, y: number, items: readonly ContextMenuModelItem[])");
    expect(mainSource).not.toContain("function showContextMenu(x: number, y: number, html: string)");
  });

  it("keeps screen-reader-only text fully clipped out of visual rows", () => {
    expect(styles).toContain(".sr-only {\n  position: absolute;");
    expect(styles).toContain("clip-path: inset(50%);");
    expect(styles).toContain("white-space: nowrap;");
  });

  it("keeps Extract empty and loaded archive navigation understandable", () => {
    expect(archiveTableSource).toContain('data-empty-action="open-archive"');
    expect(archiveDetailsPaneSource).toContain("<h3");
    expect(archiveDetailsPaneSource).toContain('data-details-action="open-archive"');
    expect(archiveDetailsPaneSource).toContain("data-copy-value={value}");
    expect(mainSource).toContain("function currentArchiveDisplayPath");
    expect(workspacePathBarSource).toContain("readOnly");
    expect(workspacePathBarSource).toContain("hidden={crumbsHidden}");
    expect(archivePathBarSource).toContain("crumbsHidden={!archive.currentArchivePath}");
    expect(archivePathBarSource).toContain("archive.view.breadcrumbs.map((crumb) => ({");
    expect(archivePathBarSource).toContain("name: crumb.isRoot ? archiveName : crumb.name");
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
    expect(mainSource).toContain('flatView: isFlatView,');
    expect(commandToolbarSource).toContain("aria-pressed={typeof pressed === \"boolean\" ? pressed : undefined}");
    expect(menuBarSource).toContain("aria-pressed={typeof pressed === \"boolean\" ? pressed : undefined}");
    expect(styles).toContain(".search-box");
    expect(styles).toContain(".search-count");
    expect(styles).toContain('.command-toolbar .tool-button[aria-pressed="true"]');
    expect(styles).toContain('.menu-item[aria-pressed="true"]::before');
    expect(styles).toContain(".row-secondary");
  });

  it("keeps selection properties and entry preview surfaces unambiguous", () => {
    expect(mainSource).toContain('message("info.selectionTitle")');
    expect(mainSource).toContain("function showSelectionInfo");
    expect(archiveDetailsPaneSource).toContain('action: "extract-selected"');
    expect(mainSource).toContain('action: "archive-info"');
    expect(mainSource).toContain('action: "preview"');
    expect(archiveDetailsPaneSource).toContain('data-details-action="preview"');
    expect(archiveDetailsPaneSource).toContain('data-details-action="extract-selected"');
    expect(mainSource).toContain("function entryPropertyRows");
    expect(mainSource).toContain("{ label: message(\"detail.ratio\"), value: formatRatio(entry) }");
    expect(mainSource).not.toContain("infoReturnFocusForCurrentSelection");
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
    expect(mainSource).toContain('document.querySelector<HTMLButtonElement>("#drop-open-archive")?.focus();');
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
