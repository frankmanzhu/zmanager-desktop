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

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

describe("GUI layout contracts", () => {
  it("scopes archive selection-column sizing to the archive table", () => {
    expect(styles).not.toMatch(/(^|[},]\s*)td:first-child\s*,\s*th:first-child\s*\{/m);
    expect(styles).toContain("#entry-table td:first-child");
    expect(styles).toContain("#entry-table th:first-child");
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
