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

const script = readFileSync(
  join(process.cwd(), "packaging", "windows", "nsis-context-menu.nsh"),
  "utf8",
);

describe("Windows context menu installer hook", () => {
  it("uses ExtendedSubCommandsKey without stale SubCommands values", () => {
    expect(script).toContain('"ExtendedSubCommandsKey"');
    expect(script).toContain('DeleteRegValue HKCU "${SHELL_KEY}\\${ZM_MENU_KEY}" "SubCommands"');
    expect(script).not.toContain('WriteRegStr HKCU "${SHELL_KEY}\\${ZM_MENU_KEY}" "SubCommands"');
  });

  it("keeps the archive submenu actions in the requested order", () => {
    const expected = [
      '"01OpenArchive" "Open archive"',
      '"02ExtractHere" "Extract Here"',
      '"03AddToArchive" "Add to archive..."',
      '"04AddToTzap" "Add to .tzap"',
      '"05AddToZip" "Add to .zip"',
      '"06AddToSevenZ" "Add to .7z"',
      '"07AddToTzst" "Add to .tzst"',
    ];

    let cursor = -1;
    for (const marker of expected) {
      const index = script.indexOf(marker);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should follow the previous action`).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("does not use the removed shell multi-select coordinator flag", () => {
    expect(script).not.toContain("--shell-multi-select");
  });
});
