#!/usr/bin/env bash
set -euo pipefail

# ensure-sibling-repos.sh — clone/update sibling repositories so that Cargo
# path dependencies resolve.
#
# Sibling repositories:
#   - tzap (https://github.com/tzap-org/tzap)
#   - zmanager (https://github.com/tzap-org/zmanager)
#   - forensic-vfs-engine (https://github.com/frankmanzhu/forensic-vfs-engine)
#   - iso9660-forensic (https://github.com/frankmanzhu/iso9660-forensic)
#   - ntfs-forensic (https://github.com/frankmanzhu/ntfs-forensic)
#   - udf-forensic (https://github.com/frankmanzhu/udf-forensic)
#   - dpp (https://github.com/frankmanzhu/dpp)
#
# Override defaults via environment variables:
#   ZMANAGER_TZAP_REPO                 – tzap repository URL
#   ZMANAGER_TZAP_REF                  – branch or tag to check out (default: main)
#   ZMANAGER_ZMANAGER_REPO             – zmanager repository URL
#   ZMANAGER_ZMANAGER_REF              – branch or tag to check out (default: main)
#   ZMANAGER_FORENSIC_VFS_ENGINE_REPO  – forensic-vfs-engine repository URL
#   ZMANAGER_FORENSIC_VFS_ENGINE_REF   – branch or tag to check out (default: main)
#   ZMANAGER_ISO9660_FORENSIC_REPO     – iso9660-forensic repository URL
#   ZMANAGER_ISO9660_FORENSIC_REF      – branch or tag to check out (default: PR branch)
#   ZMANAGER_ISO9660_FORENSIC_DIR      – absolute path for iso9660-forensic clone
#   ZMANAGER_NTFS_FORENSIC_REPO        – ntfs-forensic repository URL
#   ZMANAGER_NTFS_FORENSIC_REF         – branch or tag to check out (default: main)
#   ZMANAGER_UDF_FORENSIC_REPO         – udf-forensic repository URL
#   ZMANAGER_UDF_FORENSIC_REF          – branch or tag to check out (default: main)
#   ZMANAGER_DPP_REPO                  – dpp repository URL
#   ZMANAGER_DPP_REF                   – branch or tag to check out (default: main)
#
# Pass --skip-zmanager to skip cloning the zmanager sibling entirely.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "$repo_root/.." && pwd)"

tzap_repo="${ZMANAGER_TZAP_REPO:-https://github.com/tzap-org/tzap}"
tzap_ref="${ZMANAGER_TZAP_REF:-main}"
tzap_dir="${ZMANAGER_TZAP_DIR:-$parent_dir/tzap}"

zmanager_repo="${ZMANAGER_ZMANAGER_REPO:-https://github.com/tzap-org/zmanager}"
zmanager_ref="${ZMANAGER_ZMANAGER_REF:-main}"
zmanager_dir="${ZMANAGER_ZMANAGER_DIR:-$parent_dir/zmanager}"

forensic_vfs_engine_repo="${ZMANAGER_FORENSIC_VFS_ENGINE_REPO:-https://github.com/frankmanzhu/forensic-vfs-engine}"
forensic_vfs_engine_ref="${ZMANAGER_FORENSIC_VFS_ENGINE_REF:-main}"
forensic_vfs_engine_dir="${ZMANAGER_FORENSIC_VFS_ENGINE_DIR:-$parent_dir/forensic-vfs-engine}"

iso9660_forensic_repo="${ZMANAGER_ISO9660_FORENSIC_REPO:-https://github.com/frankmanzhu/iso9660-forensic}"
iso9660_forensic_ref="${ZMANAGER_ISO9660_FORENSIC_REF:-macos/fix-hybrid-session-selection}"
iso9660_forensic_dir="${ZMANAGER_ISO9660_FORENSIC_DIR:-$parent_dir/iso9660-forensic}"

ntfs_forensic_repo="${ZMANAGER_NTFS_FORENSIC_REPO:-https://github.com/frankmanzhu/ntfs-forensic}"
ntfs_forensic_ref="${ZMANAGER_NTFS_FORENSIC_REF:-main}"
ntfs_forensic_dir="${ZMANAGER_NTFS_FORENSIC_DIR:-$parent_dir/ntfs-forensic}"

udf_forensic_repo="${ZMANAGER_UDF_FORENSIC_REPO:-https://github.com/frankmanzhu/udf-forensic}"
udf_forensic_ref="${ZMANAGER_UDF_FORENSIC_REF:-main}"
udf_forensic_dir="${ZMANAGER_UDF_FORENSIC_DIR:-$parent_dir/udf-forensic}"

dpp_repo="${ZMANAGER_DPP_REPO:-https://github.com/frankmanzhu/dpp}"
dpp_ref="${ZMANAGER_DPP_REF:-main}"
dpp_dir="${ZMANAGER_DPP_DIR:-$parent_dir/dpp}"

skip_zmanager=0

usage() {
  cat <<'EOF'
Usage: scripts/ensure-sibling-repos.sh [--skip-zmanager]

Ensure all required sibling repositories exist and are updated to the latest
so that Cargo path dependencies in src-tauri/Cargo.toml and vendored crates resolve.

Options:
  --skip-zmanager  Skip zmanager sibling repository.
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

ensure_sibling_repo() {
  local name="$1"
  local dir="$2"
  local repo="$3"
  local ref="$4"

  if [[ -d "$dir" ]]; then
    echo "$name sibling found at: $dir"
    if [[ -d "$dir/.git" ]]; then
      echo "Updating $name repository at: $dir"
      git -C "$dir" pull || echo "Warning: git pull failed for $name at $dir"
    fi
  else
    echo "Cloning $name ($ref) into: $dir"
    git clone --depth 1 --branch "$ref" "$repo" "$dir"
    echo "$name clone complete."
  fi
}

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
ensure_sibling_repo "tzap" "$tzap_dir" "$tzap_repo" "$tzap_ref"

# ── zmanager ───────────────────────────────────────────────────────────
if ((skip_zmanager)); then
  echo "Skipping zmanager sibling (--skip-zmanager)."
else
  ensure_sibling_repo "zmanager" "$zmanager_dir" "$zmanager_repo" "$zmanager_ref"
fi

# ── forensic-vfs-engine ────────────────────────────────────────────────
ensure_sibling_repo "forensic-vfs-engine" "$forensic_vfs_engine_dir" "$forensic_vfs_engine_repo" "$forensic_vfs_engine_ref"

# ── iso9660-forensic ────────────────────────────────────────────────────
ensure_sibling_repo "iso9660-forensic" "$iso9660_forensic_dir" "$iso9660_forensic_repo" "$iso9660_forensic_ref"

# ── ntfs-forensic ──────────────────────────────────────────────────────
ensure_sibling_repo "ntfs-forensic" "$ntfs_forensic_dir" "$ntfs_forensic_repo" "$ntfs_forensic_ref"

# ── udf-forensic ───────────────────────────────────────────────────────
ensure_sibling_repo "udf-forensic" "$udf_forensic_dir" "$udf_forensic_repo" "$udf_forensic_ref"

# ── dpp ────────────────────────────────────────────────────────────────
ensure_sibling_repo "dpp" "$dpp_dir" "$dpp_repo" "$dpp_ref"
