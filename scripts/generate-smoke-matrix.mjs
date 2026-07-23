import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function generateMatrix(evidenceDir, outputPath) {
  const files = readdirSync(evidenceDir).filter(f => f.startsWith("evidence-") && f.endsWith(".json"));
  
  let markdown = "# Native Integration Smoke Matrix\n\n";
  markdown += "This matrix is generated from cross-platform release evidence records.\n\n";
  
  if (files.length === 0) {
    markdown += "*No evidence records found in the specified directory.*\n";
    writeFileSync(outputPath, markdown);
    return;
  }
  
  markdown += "| Platform | OS | Package | Arch | Capabilities | Inspection | Registration |\n";
  markdown += "|----------|----|---------|------|--------------|------------|--------------|\n";
  
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(resolve(evidenceDir, file), "utf8"));
      const platform = `${data.os} ${data.architecture}`;
      const capabilities = data.capabilities ? data.capabilities.join(", ") : "None";
      const inspection = data.inspection?.status || "unknown";
      const registration = data.registration?.status || "unknown";
      
      markdown += `| ${platform} | ${data.os} | ${data.packageKind} | ${data.architecture} | ${capabilities} | ${inspection} | ${registration} |\n`;
    } catch (e) {
      console.error(`Failed to parse ${file}:`, e);
    }
  }
  
  writeFileSync(outputPath, markdown);
  console.log(`Generated smoke matrix at ${outputPath}`);
}

const args = process.argv.slice(2);
const evidenceDir = args[0] ? resolve(args[0]) : resolve(root, "target/release-gate");
const outputPath = args[1] ? resolve(args[1]) : resolve(root, "docs/native-integration/SMOKE_MATRIX.md");

generateMatrix(evidenceDir, outputPath);
