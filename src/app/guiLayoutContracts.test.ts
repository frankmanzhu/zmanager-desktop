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
const mainSource = normalizedWorkspaceFile("src", "main.ts");
const constantsSource = normalizedWorkspaceFile("src", "app", "constants.ts");

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
    expect(mainSource).toContain('<nav class="app-menu" data-i18n-aria-label="workspace.menu.aria" aria-label="Application menu">');
    expect(mainSource).toContain('<div class="command-strip">');
    expect(mainSource).toContain('data-command-group="${group.id}"');
    expect(mainSource).toContain('<span id="workspace-status" class="status-part workspace-status"');
    expect(styles).toContain('"menu"\n    "toolbar"\n    "path"\n    "body"\n    "status"');
    expect(styles).toContain(".command-strip {");
    expect(styles).toContain(".toolbar-group-label {");
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
    expect(mainSource).toContain('class="dialog task-dialog"');
    expect(mainSource).toContain('class="dialog property-dialog"');
    expect(mainSource).toContain('class="dialog property-dialog dialog-wide"');
    expect(mainSource).toContain('data-dialog-default="#extract-start"');
    expect(mainSource).toContain('data-dialog-cancel="#extract-cancel"');
    expect(mainSource).toContain("function trapModalFocus");
    expect(mainSource).toContain("function activateDialogDefault");
    expect(mainSource).toContain("function keepFocusInsideOpenModal");
    expect(mainSource).toContain("function resolveDialogReturnFocus");
    expect(mainSource).toContain('browsePasswordInput.type = "password";');
    expect(styles).toContain(".task-dialog");
    expect(styles).toContain(".property-dialog");
    expect(styles).toContain(".dialog-section");
    expect(styles).toContain(".property-dialog-body");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(styles).toContain(".dialog-section .form-grid > label:first-child");
  });

  it("keeps About diagnostics in the dialog body layout", () => {
    expect(mainSource).toContain('<div class="dialog-body property-dialog-body about-property-body">');
    expect(mainSource).toContain('<div id="about-diagnostics" class="diagnostics diagnostics-groups"></div>');
    expect(mainSource).toContain('function diagnosticsText(): string');
    expect(mainSource).toContain('for (const group of aboutDiagnostics.querySelectorAll<HTMLElement>("[data-diagnostics-group]"))');
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
    expect(mainSource).toContain('id="compress-include-all" type="checkbox"');
    expect(mainSource).toContain("function syncCompressIncludeAllControl");
    expect(mainSource).not.toContain('<th class="inclusion-column" data-i18n-text="table.include">Include</th>');
    expect(styles).toContain("#compress-source-table th:nth-child(1)");
    expect(styles).toContain("#compress-source-table th:nth-child(2)");
    expect(styles).toContain("#compress-source-table th:nth-child(3)");
    expect(styles).toContain("#compress-source-table th:nth-child(4)");
    expect(styles).toContain("#compress-source-table tbody tr[aria-selected=\"true\"] .row-primary::before");
    expect(styles).toContain("content: none;");
  });

  it("keeps Compress create canonical in-window with validation and source actions", () => {
    expect(mainSource).toContain('<div class="compress-create-panel"');
    expect(mainSource).not.toContain('id="create-dialog"');
    expect(mainSource).toContain('id="create-destination-recent"');
    expect(mainSource).toContain('id="clear-sources" class="quiet-action" type="button" data-i18n-text="command.clearAllSources"');
    expect(mainSource).toContain('aria-describedby="create-plan-meta"');
    expect(mainSource).toContain("createArchiveUnavailableReason({");
    expect(mainSource).toContain('class="plan-details"');
    expect(mainSource).toContain('class="compress-options-summary"');
    expect(mainSource).toContain('data-compress-source-path="${escapeHtml(sourcePath)}"');
    expect(mainSource).toContain('data-context-action="reveal-source"');
    expect(mainSource).toContain('data-context-action="remove-source"');
    expect(mainSource).toContain('aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"');
    expect(mainSource).toContain("function removableSourcePathForCompressRow");
    expect(mainSource).toContain("if (!rowPath || currentCompressFolder)");
    expect(mainSource).toContain("normalizeEntryPath(rowPath) === getPathBasename(sourcePath)");
    expect(mainSource).toContain("removableSourcePath ? sourcePathsForCompressMenu(removableSourcePath) : []");
    expect(mainSource).toContain("function sourcePathsForCompressMenu");
    expect(mainSource).toContain('message("command.removeSelectedSources"');
    expect(mainSource).toContain('event.key === "Delete"');
    expect(mainSource).not.toContain('<button type="button" data-command-id="helpContents" data-i18n-text="common.help">Help</button>');
    expect(mainSource).toContain('createPasswordInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);');
    expect(mainSource).toContain('createPasswordConfirmInput.addEventListener("input", refreshCreateStateAfterDestinationEdit);');
    expect(styles).toContain(".compress-destination-field .inline-field");
    expect(styles).toContain(".source-stage-badge");
    expect(styles).toContain(".plan-validation");
    expect(styles).toContain("#start-create:not(:disabled)");
  });

  it("keeps Extract selected validation and optional fields native", () => {
    expect(mainSource).toContain('<button id="extract-start" type="button" data-dialog-default-button data-i18n-text="command.extract" disabled>Extract</button>');
    expect(mainSource).toContain("function isExtractDestinationValid");
    expect(mainSource).toContain("function syncExtractDialogState");
    expect(mainSource).toContain("function requestExtractPasswordInDialog");
    expect(mainSource).toContain("function handleExtractDialogEnter");
    expect(mainSource).toContain('extractStartButton.classList.toggle("primary-action", canExtract);');
    expect(mainSource).toContain('openModal(extractDialog, "#extract-destination");');
    expect(mainSource).toContain('extractDialog.addEventListener("keydown", handleExtractDialogEnter);');
    expect(mainSource).toContain('extractDestinationInput.addEventListener("input", syncExtractDialogState);');
    expect(mainSource).toContain('const defaultSafeTextInput = dialog === extractDialog');
    expect(mainSource).toContain('directory: true,\n    multiple: false,');
    expect(mainSource).toContain('class="advanced-options extract-password-options"');
    expect(mainSource).toContain('browsePasswordInput.type = "password";');
    expect(mainSource).toContain("requestExtractPasswordInDialog(commandError.code);");
    expect(mainSource).not.toContain('id="extract-restore-security"');
    expect(styles).toContain("#extract-start.primary-action");
    expect(styles).toContain(".task-dialog .dialog-section .form-grid > label");
    expect(styles).toContain(".task-dialog .dialog-section .form-grid > .checkbox-row");
    expect(styles).toContain("details.advanced-options:not([open]) > :not(summary)");
    expect(styles).toContain(".extract-password-options:not([open])");
    expect(styles).toContain(".task-dialog .dialog-body");
  });

  it("keeps the three-pane workspace splitters visible and keyboard reachable", () => {
    expect(mainSource).toContain('id="navigation-pane" class="navigation-pane"');
    expect(mainSource).toContain('data-pane-resizer="navigation"');
    expect(mainSource).toContain('data-pane-resizer="details"');
    expect(mainSource).toContain('role="separator"');
    expect(mainSource).toContain('tabindex="0"');
    expect(mainSource).toContain('aria-keyshortcuts="ArrowLeft ArrowRight Home End"');
    expect(mainSource).toContain("resizePaneByKeyboard(event, pane)");
    expect(mainSource).toContain('nextWidth = pane === "navigation" ? currentWidth - step : currentWidth + step');
    expect(mainSource).toContain('nextWidth = pane === "navigation" ? currentWidth + step : currentWidth - step');
    expect(styles).toContain(".pane-resizer-grip");
    expect(styles).toContain(".pane-resizer::before");
    expect(styles).toContain("grid-template-columns:\n    minmax(var(--zmanager-nav-pane-min), clamp(var(--zmanager-nav-pane-min), var(--zmanager-nav-pane-width, 190px), var(--zmanager-nav-pane-max)))");
  });

  it("keeps details values aligned and long paths predictable", () => {
    expect(mainSource).toContain('type DetailValueMode = "wrap" | "middle";');
    expect(mainSource).toContain("function middleTruncateDetailValue");
    expect(mainSource).toContain('class="detail-value detail-value-${valueMode}"');
    expect(mainSource).toContain('aria-label="${escapeHtmlValue(`${label}: ${value}`)}"');
    expect(mainSource).toContain('<span class="sr-only">${escapeHtml(value)}</span>');
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
    expect(mainSource).toContain('aria-keyshortcuts="Enter Space ContextMenu Shift+F10"');
    expect(mainSource).toContain('aria-keyshortcuts="Space Enter ContextMenu Shift+F10"');
    expect(mainSource).toContain('data-context-action="sort-ascending"');
    expect(mainSource).toContain('data-context-action="sort-descending"');
    expect(mainSource).toContain('data-context-action="extract-here"');
    expect(mainSource).toContain('data-context-action="paste-archive-path"');
    expect(mainSource).toContain('data-context-action="open-recent-archive"');
    expect(mainSource).toContain('data-context-action="reset-columns"');
    expect(mainSource).toContain("function contextMenuItems");
    expect(mainSource).toContain('contextMenu.addEventListener("keydown"');
    expect(mainSource).toContain('contextMenu.addEventListener("focusout"');
    expect(mainSource).toContain("entryTable.hidden = false;");
    expect(mainSource).toContain("function updateCompressSelectionByIntent");
    expect(mainSource).toContain("showCompressRowContextMenu");
    expect(styles).toContain(".table-shell.has-start-empty #archive-empty-state");
    expect(styles).toContain(".table-shell.has-start-empty #entry-table tbody .empty");
    expect(styles).toContain('tbody tr[aria-selected="true"] .row-primary::before');
  });

  it("keeps Extract empty and loaded archive navigation understandable", () => {
    expect(mainSource).toContain('data-empty-action="open-archive"');
    expect(mainSource).toContain('<h3>No archive open</h3>');
    expect(mainSource).toContain('data-details-action="open-archive"');
    expect(mainSource).toContain('data-copy-value="${escapeHtmlValue(value)}"');
    expect(mainSource).toContain("function currentArchiveDisplayPath");
    expect(mainSource).toContain("pathFieldInput.readOnly = true;");
    expect(mainSource).toContain("pathCrumbsElement.hidden = false;");
    expect(mainSource).toContain('aria-keyshortcuts="Enter Space">${escapeHtml(crumb.name)}</button>');
    expect(mainSource).toContain('commandId === "open" && workspaceMode === "extract" && !hasArchive');
    expect(mainSource).toContain('commandId === "refresh"');
    expect(mainSource).toContain('searchInput.setAttribute("aria-disabled", String(searchInput.disabled));');
    expect(styles).toContain(".detail-copyable");
    expect(styles).toContain(".tool-button.is-primary-command");
    expect(styles).toContain(".tool-button.is-secondary-command");
  });

  it("keeps search and flat view as stateful file-table controls", () => {
    expect(mainSource).toContain('id="search-submit"');
    expect(mainSource).toContain('id="clear-search"');
    expect(mainSource).toContain('id="search-count"');
    expect(mainSource).toContain('searchCountElement.textContent = formatSearchCount(resultCount);');
    expect(mainSource).toContain('class="${query ? "search-empty-row" : ""}"');
    expect(mainSource).toContain('message("detail.selectionHiddenBySearch")');
    expect(mainSource).toContain('data-details-action="clear-search"');
    expect(mainSource).toContain('button.setAttribute("aria-pressed", String(isFlatView));');
    expect(styles).toContain(".search-box");
    expect(styles).toContain(".search-count");
    expect(styles).toContain('.command-toolbar .tool-button[aria-pressed="true"]');
    expect(styles).toContain('.menu-item[aria-pressed="true"]::before');
    expect(styles).toContain(".row-secondary");
  });

  it("keeps selection properties and entry preview surfaces unambiguous", () => {
    expect(mainSource).toContain('message("info.selectionTitle")');
    expect(mainSource).toContain("function showSelectionInfo");
    expect(mainSource).toContain('data-details-action="extract-selected"');
    expect(mainSource).toContain('data-details-action="test-selected"');
    expect(mainSource).toContain('data-details-action="properties"');
    expect(mainSource).toContain('data-details-action="archive-info"');
    expect(mainSource).toContain('data-details-action="preview"');
    expect(mainSource).toContain("function entryPropertyRows");
    expect(mainSource).toContain("{ label: message(\"detail.ratio\"), value: formatRatio(entry) }");
    expect(mainSource).toContain("infoReturnFocusForCurrentSelection()");
    expect(mainSource).not.toContain('id="info-dialog-close"');
    expect(styles).toContain(".detail-actions");
    expect(styles).toContain(".dialog-action-group");
  });

  it("keeps drag and drop affordances local, explicit, and deterministic", () => {
    expect(mainSource).toContain('id="drop-overlay-actions"');
    expect(mainSource).toContain('data-drop-choice="open-archive"');
    expect(mainSource).toContain('data-drop-choice="add-compress"');
    expect(mainSource).toContain('type DropOverlayMode = "idle" | "active" | "choosing";');
    expect(mainSource).toContain('workspaceElement.dataset.dropTarget = copy.target;');
    expect(mainSource).toContain('setDropOverlay("choosing", dropCopyForDecision(decision));');
    expect(mainSource).toContain('dropOpenArchiveButton.focus();');
    expect(mainSource).toContain('dropOverlay.addEventListener("keydown"');
    expect(mainSource).toContain('droppedPathsFromDataTransfer');
    expect(mainSource).toContain('droppedPathsFromDesktopEvent');
    expect(mainSource).not.toContain("window.confirm(");
    expect(styles).toContain("grid-area: body;");
    expect(styles).toContain('.workspace[data-drop-state="active"][data-drop-target="compress"] .compress-table-shell');
    expect(styles).toContain('.workspace[data-drop-state="active"][data-drop-target="extract"] .table-shell');
    expect(styles).toContain('.workspace[data-drop-target="blocked"] .drop-overlay');
    expect(styles).toContain(".drop-overlay-actions");
  });
});
