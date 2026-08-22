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

node scripts/set-product-version.mjs "$new_version"

# Regenerate tracked Cargo lockfiles for the desktop-owned packages.
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path crates/zmanager-shell-contract/Cargo.toml
cargo metadata --manifest-path native/windows-shell-extension/Cargo.toml --format-version 1 >/dev/null

node scripts/check-product-version-consistency.mjs
# Release notes may intentionally mention prior versions; only structured
# product-version sources participate in the consistency check above.
git diff --check

echo "Successfully bumped product version to $new_version."
