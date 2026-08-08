#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
desktop_manifest="$root/src-tauri/Cargo.toml"
desktop_is_path=$(grep -q 'zmanager-core.*path\s*=' "$desktop_manifest" && echo 1 || echo 0)
if ((desktop_is_path)); then
  echo "Skipping zmanager-core revision check (local path dependency)"
  desktop_rev="path"
else
  desktop_rev=$(sed -n 's/.*zmanager-core.*rev = "\([0-9a-f]*\)".*/\1/p' "$desktop_manifest")
  test -n "$desktop_rev"
fi

library=${1:-}
if [[ -n "$library" ]]; then
  # The extension targets consume the UniFFI zmanager-ffi staticlib; assert the
  # entry points they actually call are present in the archive.
  for symbol in \
    _ffi_zmanager_ffi_rustbuffer_alloc \
    _ffi_zmanager_ffi_rustbuffer_free \
    _uniffi_zmanager_ffi_fn_func_tzappublicmetadatadisplaysummary; do
    nm -gU "$library" | awk -v symbol="$symbol" '$NF == symbol { found = 1 } END { exit !found }' || {
      echo "UniFFI library is missing required symbol $symbol" >&2
      exit 1
    }
  done
fi
echo "macOS core revision and UniFFI symbol checks passed: ${desktop_rev:-path}"
