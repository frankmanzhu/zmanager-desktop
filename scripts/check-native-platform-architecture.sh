#!/usr/bin/env bash
set -euo pipefail

default_root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root_dir="${ZMANAGER_NATIVE_PLATFORM_CHECK_ROOT:-$default_root_dir}"
cd "$root_dir"

failures=0

report_matches() {
  local message="$1"
  shift
  local matches
  matches="$("$@" || true)"
  if [[ -n "$matches" ]]; then
    printf '%s\n%s\n' "$message" "$matches" >&2
    failures=1
  fi
}

production_rust_before_tests() {
  awk '
    pending_test_attribute && /^[[:space:]]*mod tests[[:space:]]*\{/ { exit }
    pending_test_attribute { pending_test_attribute = 0 }
    /^[[:space:]]*#\[cfg\(.*test.*\)\][[:space:]]*$/ { pending_test_attribute = 1; next }
    { print }
  ' "$1"
}

strip_lint_only_cfg_attributes() {
  sed -E \
    '/^[[:space:]]*#!?\[cfg_attr\([^,]+,[[:space:]]*(allow|warn|deny|forbid)\([^]]*\)\)\][[:space:]]*$/d'
}

rg_n() {
  local pattern="$1"
  shift
  if command -v rg >/dev/null 2>&1; then
    rg -n "$pattern" "$@"
  else
    grep -rnE "$pattern" "$@" 2>/dev/null
  fi
}

list_rs_files() {
  if command -v rg >/dev/null 2>&1; then
    rg --files src-tauri/src -g '*.rs'
  else
    find src-tauri/src -type f -name '*.rs'
  fi
}

while IFS= read -r file; do
  file="${file//\\//}"
  [[ "$file" == src-tauri/src/platform/* ]] && continue
  source_without_tests="$(production_rust_before_tests "$file")"
  source_without_tests="$(printf '%s\n' "$source_without_tests" | strip_lint_only_cfg_attributes)"
  if [[ "$file" == "src-tauri/src/main.rs" ]]; then
    source_without_tests="$(printf '%s\n' "$source_without_tests" | sed '/windows_subsystem = "windows"/d')"
  fi

  if command -v rg >/dev/null 2>&1; then
    platform_selection="$(printf '%s\n' "$source_without_tests" | rg -n 'cfg(_attr)?!?\([^]]*(target_os|\bwindows\b|\bunix\b)' || true)"
    native_imports="$(printf '%s\n' "$source_without_tests" | rg -n 'windows_sys::|::windows::|\b(gtk|gdk|gio|glib)::' || true)"
  else
    platform_selection="$(printf '%s\n' "$source_without_tests" | grep -nE 'cfg(_attr)?!?\([^]]*(target_os|\bwindows\b|\bunix\b)' || true)"
    native_imports="$(printf '%s\n' "$source_without_tests" | grep -nE 'windows_sys::|::windows::|\b(gtk|gdk|gio|glib)::' || true)"
  fi

  if [[ -n "$platform_selection" ]]; then
    printf 'Production OS selection must live under src-tauri/src/platform: %s\n%s\n' \
      "$file" "$platform_selection" >&2
    failures=1
  fi

  if [[ -n "$native_imports" ]]; then
    printf 'Direct native imports must live under src-tauri/src/platform: %s\n%s\n' \
      "$file" "$native_imports" >&2
    failures=1
  fi
done < <(list_rs_files)

report_matches \
  'Frontend operating-system detection must use explicit platform capabilities:' \
  rg_n 'navigator\.(userAgent|platform|userAgentData)' src

report_matches \
  'Shared native drag command code must not regain Windows filename/path policy:' \
  rg_n 'WINDOWS_FILE_DESCRIPTOR|WINDOWS_RESERVED_FILE_NAMES|virtual_drag_display_path|Windows-(unsafe|reserved)' src-tauri/src/commands.rs

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

printf 'Native platform architecture checks passed.\n'
