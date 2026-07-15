#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

install_deps=0
skip_tests=0
bundle_kind="all"

usage() {
  cat <<'EOF'
Usage: scripts/build-macos.sh [--install-deps] [--skip-tests] [--bundle app|dmg|all]

Builds macOS Tauri bundles without Developer ID signing or notarization and stages them under
/tmp/zmanager-desktop-macos (override with ZMANAGER_MACOS_STAGE_DIR).

By default the script builds the host architecture and produces both a .app
bundle and a .dmg. Signing, notarization, Finder Sync, Quick Look, and packaging
for the separate SwiftUI application remain outside this repository.

macOS prerequisites:
  xcode-select --install
  brew install cmake node
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

Options:
  --install-deps  Install missing CMake/Node dependencies with Homebrew and
                  install or update Rust with rustup.
  --skip-tests    Skip frontend and Rust tests before bundling.
  --bundle VALUE  Build app, dmg, or all bundles. Default: all.
  -h, --help      Show this help.
EOF
}

while (($#)); do
  case "$1" in
    --install-deps)
      install_deps=1
      ;;
    --skip-tests)
      skip_tests=1
      ;;
    --bundle)
      if (($# < 2)); then
        echo "--bundle requires app, dmg, or all." >&2
        exit 2
      fi
      bundle_kind="$2"
      shift
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

case "$bundle_kind" in
  app|dmg|all)
    ;;
  *)
    echo "Unsupported bundle value: $bundle_kind (expected app, dmg, or all)." >&2
    exit 2
    ;;
esac

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS bundles must be built on macOS." >&2
  exit 1
fi

source_cargo_env() {
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.cargo/env"
  fi
}

version_major() {
  "$1" --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/'
}

version_minor() {
  "$1" --version | sed -E 's/^[^0-9]*[0-9]+\.([0-9]+).*/\1/'
}

node_install_required() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    return 0
  fi
  local node_major
  node_major="$(version_major node)"
  [[ -z "$node_major" || "$node_major" -lt 20 ]]
}

rust_install_required() {
  if ! command -v cargo >/dev/null 2>&1 || ! command -v rustc >/dev/null 2>&1; then
    return 0
  fi
  local rust_major rust_minor
  rust_major="$(version_major rustc)"
  rust_minor="$(version_minor rustc)"
  [[ -z "$rust_major" || -z "$rust_minor" || "$rust_major" -lt 1 || ("$rust_major" -eq 1 && "$rust_minor" -lt 85) ]]
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi
  echo "Homebrew is required for --install-deps." >&2
  echo "Install it from https://brew.sh, then rerun this script." >&2
  exit 1
}

if ! xcode-select -p >/dev/null 2>&1; then
  if ((install_deps)); then
    echo "Requesting installation of the Xcode Command Line Tools."
    xcode-select --install || true
  fi
  echo "Xcode Command Line Tools are required. Complete 'xcode-select --install', then rerun." >&2
  exit 1
fi

source_cargo_env

if ((install_deps)); then
  if ! command -v cmake >/dev/null 2>&1 || node_install_required; then
    ensure_homebrew
  fi
  if ! command -v cmake >/dev/null 2>&1; then
    brew install cmake
  fi
  if node_install_required; then
    brew install node
  fi
  if rust_install_required; then
    if command -v rustup >/dev/null 2>&1; then
      rustup update stable
    else
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      source_cargo_env
    fi
  fi
fi

missing_commands=()
for command_name in node npm cargo rustc cmake xcrun ditto; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing_commands+=("$command_name")
  fi
done
if ((${#missing_commands[@]})); then
  echo "Missing required command(s): ${missing_commands[*]}" >&2
  echo "Install the macOS prerequisites, or rerun with --install-deps." >&2
  exit 1
fi

if ! xcrun --find clang >/dev/null 2>&1; then
  echo "The active Xcode toolchain does not provide clang." >&2
  echo "Select a valid toolchain with xcode-select, then rerun." >&2
  exit 1
fi

if [[ ! -f src-tauri/icons/icon.icns ]]; then
  echo "Missing macOS application icon: src-tauri/icons/icon.icns" >&2
  echo "Generate and commit an ICNS asset before building macOS bundles." >&2
  exit 1
fi

rust_major="$(version_major rustc)"
rust_minor="$(version_minor rustc)"
if ((rust_major < 1 || (rust_major == 1 && rust_minor < 85))); then
  echo "Rust 1.85 or newer is required. Current rustc: $(rustc --version)" >&2
  echo "Update the stable toolchain with: rustup update stable" >&2
  exit 1
fi

node_major="$(version_major node)"
if ((node_major < 20)); then
  echo "Node.js 20 or newer is required. Current node: $(node --version)" >&2
  echo "Install a current Node.js release, or rerun with --install-deps." >&2
  exit 1
fi

if [[ ! -d node_modules ]] || ! npm ls --depth=0 @tauri-apps/cli typescript vite vitest >/dev/null 2>&1; then
  npm install
fi

if ((!skip_tests)); then
  npm run test:frontend
  (cd src-tauri && cargo test)
fi

case "$bundle_kind" in
  app)
    tauri_bundles="app"
    ;;
  dmg)
    tauri_bundles="dmg"
    ;;
  all)
    tauri_bundles="app,dmg"
    ;;
esac

tauri_args=(build --bundles "$tauri_bundles" --no-sign)
npm run tauri -- "${tauri_args[@]}"

cargo_target_dir="${CARGO_TARGET_DIR:-$repo_root/src-tauri/target}"
bundle_root="$cargo_target_dir/release/bundle"

stage_dir="${ZMANAGER_MACOS_STAGE_DIR:-/tmp/zmanager-desktop-macos}"
install -d -m 0755 "$stage_dir"

stage_app_bundles() {
  local count=0 artifact staged_artifact
  while IFS= read -r artifact; do
    count=$((count + 1))
    staged_artifact="$stage_dir/$(basename "$artifact")"
    rm -rf "$staged_artifact"
    ditto "$artifact" "$staged_artifact"
    echo "Built application: $artifact"
    echo "Staged application: $staged_artifact"
  done < <(find "$bundle_root/macos" -maxdepth 1 -type d -name '*.app' -print 2>/dev/null | sort)
  if ((count == 0)); then
    echo "Tauri build completed, but no .app was found under $bundle_root/macos." >&2
    exit 1
  fi
}

stage_dmg_bundles() {
  local count=0 artifact staged_artifact
  while IFS= read -r artifact; do
    count=$((count + 1))
    staged_artifact="$stage_dir/$(basename "$artifact")"
    install -m 0644 "$artifact" "$staged_artifact"
    echo "Built disk image: $artifact"
    echo "Staged disk image: $staged_artifact"
  done < <(find "$bundle_root/dmg" -maxdepth 1 -type f -name '*.dmg' -print 2>/dev/null | sort)
  if ((count == 0)); then
    echo "Tauri build completed, but no .dmg was found under $bundle_root/dmg." >&2
    exit 1
  fi
}

case "$bundle_kind" in
  app)
    stage_app_bundles
    ;;
  dmg)
    stage_dmg_bundles
    ;;
  all)
    stage_app_bundles
    stage_dmg_bundles
    ;;
esac

echo "Unnotarized macOS artifacts are ready under: $stage_dir"
