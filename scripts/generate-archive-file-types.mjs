import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(repoRoot, "src", "app", "archiveFileTypes.manifest.json");
const windowsHookPath = resolve(repoRoot, "packaging", "windows", "nsis-context-menu.nsh");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const windowsExtensions = Array.from(new Set([...manifest.singleExtensions, "001"]))
  .map((extension) => `.${extension}`)
  .sort((left, right) => left.localeCompare(right));

let hook = readFileSync(windowsHookPath, "utf8");
const newline = hook.includes("\r\n") ? "\r\n" : "\n";

const appliesTo = windowsExtensions
  .map((extension) => `NOT System.FileExtension:=${extension}`)
  .join(" AND ");

hook = hook.replace(
  /^!define ZM_NON_ARCHIVE_FILE_APPLIES_TO ".*"$/m,
  `!define ZM_NON_ARCHIVE_FILE_APPLIES_TO "${appliesTo}"`,
);

function replaceArchiveExtensionMacro(content, macroName, insertedMacroName) {
  const body = windowsExtensions
    .map((extension) => `  !insertmacro ${insertedMacroName} "${extension}"`)
    .join(newline);
  return content.replace(
    new RegExp(`(!macro ${macroName}\\r?\\n)[\\s\\S]*?(!macroend)`),
    `$1${body}${newline}$2`,
  );
}

hook = replaceArchiveExtensionMacro(
  hook,
  "ZM_REGISTER_ARCHIVE_EXTENSIONS",
  "ZM_REGISTER_ARCHIVE_EXTENSION",
);
hook = replaceArchiveExtensionMacro(
  hook,
  "ZM_UNREGISTER_ARCHIVE_EXTENSIONS",
  "ZM_UNREGISTER_ARCHIVE_EXTENSION",
);

writeFileSync(windowsHookPath, hook);
