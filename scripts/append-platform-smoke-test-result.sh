#!/usr/bin/env sh
set -eu

PLATFORM="${1:-}"
OS="${2:-}"
ARTIFACT="${3:-}"
INSTALL_STEP="${4:-}"
LAUNCH="${5:-Not Run}"
OPEN_ARCHIVE="${6:-Not Run}"
EXTRACT="${7:-Not Run}"
DISMISS_JOB="${8:-Not Run}"
RESULT="${9:-Pending}"
COMMIT_TAG="${10:-}"
NOTES="${11:-Not yet executed}"

if [ -z "$PLATFORM" ] || [ -z "$OS" ] || [ -z "$ARTIFACT" ]; then
  echo "Usage: append-platform-smoke-test-result.sh <platform> <os> <artifact> <install_step> [launch] [open_archive] [extract] [dismiss_job] [result] [commit_tag] [notes]"
  exit 1
fi

RESULTS_FILE="docs/platform-smoke-test-results.md"
DATE=$(date +%Y-%m-%d)

ESC_FN() {
  printf '%s' "$1" | tr '\r\n' ' ' | sed 's/|/\\|/g'
}

PLATFORM=$(ESC_FN "$PLATFORM")
OS=$(ESC_FN "$OS")
ARTIFACT=$(ESC_FN "$ARTIFACT")
INSTALL_STEP=$(ESC_FN "$INSTALL_STEP")
LAUNCH=$(ESC_FN "$LAUNCH")
OPEN_ARCHIVE=$(ESC_FN "$OPEN_ARCHIVE")
EXTRACT=$(ESC_FN "$EXTRACT")
DISMISS_JOB=$(ESC_FN "$DISMISS_JOB")
RESULT=$(ESC_FN "$RESULT")
COMMIT_TAG=$(ESC_FN "$COMMIT_TAG")
NOTES=$(ESC_FN "$NOTES")

if [ ! -f "$RESULTS_FILE" ]; then
  echo "Smoke-test matrix file not found: $RESULTS_FILE"
  exit 1
fi

printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' \
  "$DATE" "$PLATFORM" "$OS" "$ARTIFACT" "$INSTALL_STEP" "$LAUNCH" "$OPEN_ARCHIVE" "$EXTRACT" "$DISMISS_JOB" "$RESULT" "$COMMIT_TAG" "$NOTES" >> "$RESULTS_FILE"

echo "Appended smoke-test row to $RESULTS_FILE"
