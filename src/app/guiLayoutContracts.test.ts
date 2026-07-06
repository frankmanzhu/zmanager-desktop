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
  });

  it("renders the classic menu and command toolbar visibly", () => {
    expect(mainSource).toContain('<nav class="app-menu" data-i18n-aria-label="workspace.menu.aria" aria-label="Application menu">');
    expect(mainSource).toContain('<div class="legacy-command-buttons">');
    expect(styles).toContain('"menu"\n    "toolbar"\n    "path"\n    "body"\n    "status"');
  });

  it("does not duplicate command buttons in secondary panes", () => {
    expect(mainSource).not.toContain("flat-view-toggle");
    expect(mainSource).not.toContain("data-detail-action");
    expect(styles).not.toContain(".flat-toggle");
    expect(styles).not.toContain(".detail-actions");
  });

  it("does not show unimplemented preferences", () => {
    expect(mainSource).not.toContain("<h3>System</h3>");
    expect(mainSource).not.toContain("<h3>Menu/Shell integration</h3>");
    expect(mainSource).not.toContain("Integrate to shell context menu");
    expect(mainSource).not.toContain("Cascaded context menu");
    expect(mainSource).not.toContain("Icons in context menu");
  });

  it("keeps About diagnostics in the dialog body layout", () => {
    expect(mainSource).toContain('<div class="dialog-body">\n          <div id="about-diagnostics" class="diagnostics"></div>');
    expect(styles).toContain(".detail-list > div {\n  display: contents;");
  });

  it("scopes archive selection-column sizing to the archive table", () => {
    expect(styles).not.toMatch(/(^|[},]\s*)td:first-child\s*,\s*th:first-child\s*\{/m);
    expect(styles).toContain("#entry-table td:first-child");
    expect(styles).toContain("#entry-table th:first-child");
  });

  it("centers the empty archive message inside the whole drop surface", () => {
    expect(styles).toContain(".table-shell.has-start-empty {\n  display: grid;\n  grid-template-rows: minmax(0, 1fr);");
    expect(styles).toContain(".archive-empty-state {\n  min-height: 0;\n  height: 100%;");
  });

  it("declares stable Compress source table columns", () => {
    expect(styles).toContain("#compress-source-table th:nth-child(1)");
    expect(styles).toContain("#compress-source-table th:nth-child(2)");
    expect(styles).toContain("#compress-source-table th:nth-child(3)");
    expect(styles).toContain("#compress-source-table th:nth-child(4)");
  });

  it("keeps native icon image sizing separate from file-kind icon classes", () => {
    expect(styles).toContain(".row-icon-native-image");
    expect(styles).toContain(".tree-icon-native-image");
    expect(styles).toContain(".detail-icon-native-image");
    expect(styles).not.toMatch(/\.row-icon-image,\s*\n\.tree-icon-image,\s*\n\.detail-icon-image\s*\{\s*\n\s*width:\s*100%;/);
  });
});
