#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 IMPORTER_BUNDLE TZAP_FIXTURE" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${TMPDIR:-/tmp}/zmanager-spotlight-importer-smoke"
sdk="$(xcrun --sdk macosx --show-sdk-path)"

xcrun clang -fobjc-arc -mmacosx-version-min=14.0 \
  -F "$sdk/System/Library/Frameworks/CoreServices.framework/Frameworks" \
  "$repo_root/scripts/macos-spotlight-importer-smoke.m" \
  -framework Foundation -framework CoreServices \
  -o "$output"
"$output" "$1" "$2"
