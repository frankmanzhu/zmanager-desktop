#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-version> (e.g. 1.1.2 or v1.1.2)" >&2
  exit 1
fi

new_version="${1#v}"
if [[ ! "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: version '$new_version' is not valid SemVer." >&2
  exit 1
fi

old_version="$(node -p 'require("./package.json").version')"
node scripts/set-product-version.mjs "$new_version"

# Regenerate tracked Cargo lockfiles for the desktop-owned packages.
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path crates/zmanager-shell-contract/Cargo.toml
cargo metadata --manifest-path native/windows-shell-extension/Cargo.toml --format-version 1 >/dev/null

node scripts/check-product-version-consistency.mjs
git diff --check

if [[ "$old_version" != "$new_version" ]]; then
  old_version_pattern="${old_version//./\\.}"
  old_version_pattern="${old_version_pattern//+/\\+}"
  stale_refs="$(git grep -n -E "(^|[^0-9A-Za-z])${old_version_pattern}([^0-9A-Za-z]|$)" -- . ':(exclude)package-lock.json' ':(exclude)**/Cargo.lock' || true)"
  if [[ -n "$stale_refs" ]]; then
    echo "Stale product version references remain for $old_version:" >&2
    echo "$stale_refs" >&2
    exit 1
  fi
fi

echo "Successfully bumped product version to $new_version."
