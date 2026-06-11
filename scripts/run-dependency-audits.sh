#!/usr/bin/env sh
set -eu

OUTPUT_DIR="${1:-docs/reports}"
TIMESTAMP="$(date +%Y-%m-%d)"
OUTPUT_FILE="${OUTPUT_DIR}/dependency-audit-${TIMESTAMP}.md"

mkdir -p "$OUTPUT_DIR"
{
  echo "# Dependency and license audit (${TIMESTAMP})"
  echo
  echo "## Frontend dependencies"
  echo
  echo "## npm ls --depth 0"
  echo '```'
  npm ls --depth 0 || true
  echo '```'
  echo
  echo "## npm audit --audit-level high"
  echo '```'
  npm audit --audit-level high || true
  echo '```'
  echo
  echo "## Rust dependencies"
  echo
  cd src-tauri
  echo "### cargo tree --depth 1"
  echo '```'
  cargo tree --depth 1 || true
  echo '```'
  echo
  echo "### cargo audit"
  echo '```'
  cargo audit || true
  echo '```'
} > "$OUTPUT_FILE"

echo "Saved dependency and license audit report to $OUTPUT_FILE"

