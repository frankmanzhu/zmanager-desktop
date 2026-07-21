#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
desktop_manifest="$root/src-tauri/Cargo.toml"
metadata_manifest="$root/crates/zmanager-public-metadata-ffi/Cargo.toml"
desktop_is_path=$(grep -q 'zmanager-core.*path\s*=' "$desktop_manifest" && echo 1 || echo 0)
metadata_is_path=$(grep -q 'zmanager-core.*path\s*=' "$metadata_manifest" && echo 1 || echo 0)
if ((desktop_is_path || metadata_is_path)); then
  echo "Skipping zmanager-core revision check (local path dependency)"
else
  desktop_rev=$(sed -n 's/.*zmanager-core.*rev = "\([0-9a-f]*\)".*/\1/p' "$desktop_manifest")
  metadata_rev=$(sed -n 's/.*zmanager-core.*rev = "\([0-9a-f]*\)".*/\1/p' "$metadata_manifest")
  test -n "$desktop_rev"
  test "$desktop_rev" = "$metadata_rev"
fi

library=${1:-}
if [[ -n "$library" ]]; then
  actual=$(nm -gU "$library" | awk '{print $NF}' | grep '^_zmanager_' | sort -u)
  expected=$(sort -u "$root/crates/zmanager-public-metadata-ffi/exported-symbols.txt")
  test "$actual" = "$expected"
fi
echo "macOS core revision and metadata symbol checks passed: ${desktop_rev:-path}"
