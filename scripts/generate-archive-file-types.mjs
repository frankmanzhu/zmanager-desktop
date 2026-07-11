import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "src", "app", "archiveFileTypes.manifest.json");
const windowsHookPath = resolve(repoRoot, "packaging", "windows", "nsis-context-menu.nsh");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const windowsExtensions = Array.from(new Set([...manifest.singleExtensions, "001"]))
  .map((extension) => `.${extension}`)
  .sort((left, right) => left.localeCompare(right));

let hook = readFileSync(windowsHookPath, "utf8");
const newline = hook.includes("\r\n") ? "\r\n" : "\n";

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
