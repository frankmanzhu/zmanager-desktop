#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# E2E verification script for unified table columns (WP4/WP5/Gate)
#
# Runs the Playwright E2E suite against the Vite dev server. Does NOT require
# the full Tauri desktop — only the frontend dev server is needed.
#
# Usage:
#   ./scripts/run-column-e2e-tests.sh          # run all E2E tests
#   ./scripts/run-column-e2e-tests.sh --ui     # open Playwright UI
#   ./scripts/run-column-e2e-tests.sh columns  # run only the column spec
#
# Prerequisites:
#   npm install        # must be run first
#   npx playwright install chromium
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Running unified table column E2E tests..."
echo "    (starts Vite dev server automatically via Playwright webServer config)"
echo ""

if [ "${1:-}" = "--ui" ]; then
  npx playwright test --ui
elif [ -n "${1:-}" ]; then
  npx playwright test "$1"
else
  npx playwright test
fi

echo ""
echo "==> E2E run complete."
echo ""
echo "Manual verification checklist (requires full Tauri desktop on each OS):"
echo "  1. Open Global Column Options → verify Common / Compress Only / Extract Only sections"
echo "  2. Select a Compress column unavailable on the current system → verify absent from table"
echo "  3. Enable Source Path → verify appears only in Compress table"
echo "  4. Enable Packed Size → verify appears only in Extract table"
echo "  5. Resize & reorder columns → restart → verify intrinsic layout returns"
echo "  6. Reset Columns → verify configured visibility + intrinsic layout"
echo "  7. Configure .tar.gz preferences → open .tgz → verify same preferences apply"
echo "  8. Configure .tar.zst preferences → open .tzst → verify same preferences apply"
echo "  9. Save global column change → verify affected workspaces reset, unaffected preserved"
echo "  10. Hide sort key → verify Name ascending fallback → restore → verify sort returns"
echo ""
echo "Platform-specific manual checks:"
echo "  - Windows: attributes, owner via security descriptor, symlink, access time"
echo "  - macOS: mode, UID/GID, owner/group, BSD flags, symlinks"
echo "  - Linux: with and without birth-time filesystem support"
echo "  - All: large source trees (100K+ entries) with repeated owner/group identities"
