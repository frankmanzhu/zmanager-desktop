#!/usr/bin/env bash
set -euo pipefail

# ensure-sibling-repos.sh — clone tzap (and optionally zmanager) as sibling
# directories so that Cargo path dependencies resolve.
#
# The tzap repo is required because src-tauri/Cargo.toml patches tzap-core,
# tzap-plugin-keywrap and tzap-plugin-signing to their local source trees.
# The zmanager repo is required when zmanager-core is a path dependency
# (local-dev mode; CI pins it to git via pin-zmanager-core-release.sh instead).
#
# Override defaults via environment variables:
#   ZMANAGER_TZAP_REPO    – tzap repository URL
#   ZMANAGER_TZAP_REF     – branch or tag to check out (default: main)
#   ZMANAGER_ZMANAGER_REPO – zmanager repository URL
#   ZMANAGER_ZMANAGER_REF  – branch or tag to check out (default: main)
#
# Pass --skip-zmanager to skip cloning the zmanager sibling entirely
# (useful when zmanager-core is pinned to a git dependency in CI).

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "$repo_root/.." && pwd)"

tzap_repo="${ZMANAGER_TZAP_REPO:-https://github.com/tzap-org/tzap}"
tzap_ref="${ZMANAGER_TZAP_REF:-main}"
tzap_dir="${ZMANAGER_TZAP_DIR:-$parent_dir/tzap}"

zmanager_repo="${ZMANAGER_ZMANAGER_REPO:-https://github.com/tzap-org/zmanager}"
zmanager_ref="${ZMANAGER_ZMANAGER_REF:-main}"
zmanager_dir="${ZMANAGER_ZMANAGER_DIR:-$parent_dir/zmanager}"

skip_zmanager=0

usage() {
  cat <<'EOF'
Usage: scripts/ensure-sibling-repos.sh [--skip-zmanager]

Ensure the tzap repository (and optionally zmanager) exist as sibling
directories so that Cargo path dependencies in src-tauri/Cargo.toml
and its vendored crates can resolve.

Options:
  --skip-zmanager  Only clone tzap; skip zmanager entirely.
  -h, --help       Show this help.
EOF
}

while (($#)); do
  case "$1" in
    --skip-zmanager)
      skip_zmanager=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

# ── zmanager-desktop ───────────────────────────────────────────────────

zmanager_desktop_dir="${ZMANAGER_DESKTOP_DIR:-$parent_dir/zmanager-desktop}"

if [[ -d "$repo_root/.git" ]]; then
  echo "Updating zmanager-desktop repository at: $repo_root"
  git -C "$repo_root" pull || echo "Warning: git pull failed for zmanager-desktop at $repo_root"
fi

if [[ "$zmanager_desktop_dir" != "$repo_root" && -d "$zmanager_desktop_dir/.git" ]]; then
  echo "Updating sibling zmanager-desktop at: $zmanager_desktop_dir"
  git -C "$zmanager_desktop_dir" pull || echo "Warning: git pull failed for zmanager-desktop at $zmanager_desktop_dir"
fi

# ── tzap ───────────────────────────────────────────────────────────────

if [[ -d "$tzap_dir" ]]; then
  echo "tzap sibling found at: $tzap_dir"
  if [[ -d "$tzap_dir/.git" ]]; then
    echo "Updating tzap repository at: $tzap_dir"
    git -C "$tzap_dir" pull || echo "Warning: git pull failed for tzap at $tzap_dir"
  fi
else
  echo "Cloning tzap ($tzap_ref) into: $tzap_dir"
  git clone --depth 1 --branch "$tzap_ref" "$tzap_repo" "$tzap_dir"
  echo "tzap clone complete."
fi

# ── zmanager ───────────────────────────────────────────────────────────

if ((skip_zmanager)); then
  echo "Skipping zmanager sibling (--skip-zmanager)."
  exit 0
fi

if [[ -d "$zmanager_dir" ]]; then
  echo "zmanager sibling found at: $zmanager_dir"
  if [[ -d "$zmanager_dir/.git" ]]; then
    echo "Updating zmanager repository at: $zmanager_dir"
    git -C "$zmanager_dir" pull || echo "Warning: git pull failed for zmanager at $zmanager_dir"
  fi
else
  echo "Cloning zmanager ($zmanager_ref) into: $zmanager_dir"
  git clone --depth 1 --branch "$zmanager_ref" "$zmanager_repo" "$zmanager_dir"
  echo "zmanager clone complete."
fi
