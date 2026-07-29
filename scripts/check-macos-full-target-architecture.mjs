import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const count = (text, regex) => [...text.matchAll(regex)].length;

export function sourceViolations(path, text, allowance = null) {
  const errors = [];
  const checks = [
    [/navigator\s*\.\s*(?:userAgent|platform|userAgentData)/g, "frontend OS detection"],
    [/(?:innerHTML\s*=|insertAdjacentHTML\s*\(|document\s*\.\s*createElement\s*\(|ReactDOM\s*\.\s*render\s*\()/g, "imperative HTML rendering"],
    [/\.module\.css\b/g, "CSS module reference"]
  ];
  for (const [pattern, label] of checks) if (pattern.test(text)) errors.push(`${path}: forbidden ${label}`);
  const eventListeners = count(text, /addEventListener\s*\(/g);
  const inlineStyles = count(text, /\bstyle\s*=\s*\{/g);
  if (eventListeners > (allowance?.eventListeners ?? 0)) errors.push(`${path}: ${eventListeners} standalone DOM listeners exceed allowance`);
  if (inlineStyles > (allowance?.inlineStyles ?? 0)) errors.push(`${path}: ${inlineStyles} inline styles exceed allowance`);
  if (allowance && hash(text) !== allowance.sha256) {
    if (eventListeners >= allowance.eventListeners && allowance.eventListeners > 0) errors.push(`${path}: modified legacy surface did not shrink DOM listeners`);
    if (inlineStyles >= allowance.inlineStyles && allowance.inlineStyles > 0) errors.push(`${path}: modified legacy surface did not shrink inline styles`);
  }
  return errors;
}

export function cssFileViolation(path, allowlist) {
  if (allowlist.tailwindEntrypoints.includes(path)) return null;
  if (allowlist.legacyCss?.path === path) return null;
  return `${path}: new raw CSS file is forbidden`;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function validateWorkspace(workspaceRoot = root) {
  const errors = [];
  const allowlist = { legacyCss: null, tailwindEntrypoints: ["src/styles.tailwind.css"], entries: [] };
  const allowances = new Map(allowlist.entries.map((entry) => [entry.path, entry]));
  const production = walk(join(workspaceRoot, "src")).filter((path) => !/\.(?:test|spec)\.[^.]+$/.test(path));
  for (const path of production) {
    const rel = relative(workspaceRoot, path);
    if ([".ts", ".tsx"].includes(extname(path))) errors.push(...sourceViolations(rel, readFileSync(path, "utf8"), allowances.get(rel)));
    if (extname(path) === ".css") {
      const violation = cssFileViolation(rel, allowlist);
      if (violation) errors.push(violation);
    }
  }
  if (allowlist.legacyCss) {
    const legacyCss = readFileSync(join(workspaceRoot, allowlist.legacyCss.path), "utf8");
    if (hash(legacyCss) !== allowlist.legacyCss.sha256 && legacyCss.split(/\r?\n/).length >= allowlist.legacyCss.maxLines) errors.push(`${allowlist.legacyCss.path}: modified legacy CSS did not shrink`);
  }

  const nativeRoots = [join(workspaceRoot, "src-tauri"), join(workspaceRoot, "native")].filter(existsSync);
  for (const file of nativeRoots.flatMap(walk).filter((path) => [".swift", ".m", ".mm"].includes(extname(path)))) {
    const rel = relative(workspaceRoot, file);
    if (!rel.startsWith("native/macos/")) errors.push(`${rel}: macOS native source is outside native/macos`);
  }

  const governingDocs = ["AGENTS.md", "CONTEXT.md", "docs/ARCHITECTURE.md", "docs/REQUIREMENTS.md", "docs/developer-setup.md"];
  const forbiddenPolicy = /separate SwiftUI|separate native Swift|Do not (?:add|move).*?(?:Finder Sync|Quick Look|notarization)|Windows and Linux are the signed\/release packaging targets/gi;
  for (const doc of governingDocs) if (forbiddenPolicy.test(readFileSync(join(workspaceRoot, doc), "utf8"))) errors.push(`${doc}: contains active separate-product policy`);
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateWorkspace();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("macOS full-target and frontend GUI architecture checks passed");
}
