#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

install_deps=0
skip_tests=0
install_application=1
bundle_kind="all"
install_dir="${ZMANAGER_MACOS_INSTALL_DIR:-/Applications}"
architecture="$(uname -m)"

usage() {
  cat <<'EOF'
Usage: scripts/build-macos.sh [--install-deps] [--skip-tests] [--no-install] [--install-dir PATH] [--bundle app|dmg|all] [--arch arm64|x86_64]

Builds and stages the unified macOS Tauri Release Bundle under
/tmp/zmanager-desktop-macos (override with ZMANAGER_MACOS_STAGE_DIR).

By default the script builds the host architecture and produces both a .app
bundle and a .dmg, then installs ZManager.app into /Applications. Local builds
embed build-machine codec libraries, rewrite their load paths, and use ad-hoc
inside-out signing. Set ZMANAGER_CODESIGN_IDENTITY to a Developer ID
Application identity and ZMANAGER_NOTARY_PROFILE to a validated notarytool
keychain profile to sign, notarize, staple, and Gatekeeper-check the same output.

macOS prerequisites:
  xcode-select --install
  brew install cmake node lz4 xz
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

Options:
  --install-deps  Install missing CMake/Node dependencies with Homebrew and
                  install or update Rust with rustup.
  --skip-tests    Skip frontend and Rust tests before bundling.
  --no-install    Build and stage artifacts without installing the application.
  --install-dir   Install into PATH instead of /Applications. This can also be
                  set with ZMANAGER_MACOS_INSTALL_DIR.
  --bundle VALUE  Build app, dmg, or all bundles. Default: all.
  --arch VALUE    Build a separate arm64 or x86_64 artifact. Default: host architecture.
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
    --no-install)
      install_application=0
      ;;
    --install-dir)
      if (($# < 2)); then
        echo "--install-dir requires a destination directory." >&2
        exit 2
      fi
      install_dir="$2"
      install_application=1
      shift
      ;;
    --bundle)
      if (($# < 2)); then
        echo "--bundle requires app, dmg, or all." >&2
        exit 2
      fi
      bundle_kind="$2"
      shift
      ;;
    --arch)
      if (($# < 2)); then
        echo "--arch requires arm64 or x86_64." >&2
        exit 2
      fi
      architecture="$2"
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

case "$architecture" in
  arm64) rust_triple="aarch64-apple-darwin" ;;
  x86_64) rust_triple="x86_64-apple-darwin" ;;
  *) echo "Unsupported macOS architecture: $architecture" >&2; exit 2 ;;
esac

if [[ -z "$install_dir" ]]; then
  echo "The macOS application install directory must not be empty." >&2
  exit 2
fi

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
  ensure_homebrew
  brew install cmake lz4 xz
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

scripts/ensure-sibling-repos.sh

if ((!skip_tests)); then
  npm run test:frontend
  (cd src-tauri && cargo test)
fi

cargo_target_dir="${CARGO_TARGET_DIR:-$repo_root/src-tauri/target}"
bundle_root="$cargo_target_dir/$rust_triple/release/bundle"
rm -rf "$bundle_root/macos"

tauri_args=(build --bundles app --no-sign --target "$rust_triple")
npm run tauri -- "${tauri_args[@]}"

applications=()
while IFS= read -r candidate; do applications+=("$candidate"); done < <(
  find "$bundle_root/macos" -maxdepth 1 -type d -name '*.app' -print 2>/dev/null | sort
)
if ((${#applications[@]} != 1)); then
  echo "Expected exactly one Tauri application under $bundle_root/macos." >&2
  exit 1
fi
application="${applications[0]}"
scripts/prepare-macos-self-contained-app.sh "$application" "$architecture"

version=$(node -p 'require("./package.json").version')
artifact_base="ZManager-${version}-macos-${architecture}"
stage_dir="${ZMANAGER_MACOS_STAGE_DIR:-/tmp/zmanager-desktop-macos}"
install -d -m 0755 "$stage_dir"
staged_app="$stage_dir/$artifact_base.app"
zip_artifact="$stage_dir/$artifact_base.zip"
dmg_artifact="$stage_dir/$artifact_base.dmg"
rm -rf "$staged_app"
rm -f "$zip_artifact" "$dmg_artifact"
ditto "$application" "$staged_app"

create_zip() {
  rm -f "$zip_artifact"
  ditto -c -k --sequesterRsrc --keepParent "$staged_app" "$zip_artifact"
}

create_dmg() {
  local image_root="$stage_dir/.$artifact_base-dmg-root"
  rm -rf "$image_root"
  mkdir -p "$image_root"
  ditto "$staged_app" "$image_root/ZManager.app"
  ln -s /Applications "$image_root/Applications"
  hdiutil create -quiet -volname "ZManager" -srcfolder "$image_root" \
    -ov -format UDZO "$dmg_artifact"
  rm -rf "$image_root"
  if [[ ${ZMANAGER_CODESIGN_IDENTITY:--} != - ]]; then
    codesign --force --timestamp --sign "$ZMANAGER_CODESIGN_IDENTITY" "$dmg_artifact"
  fi
}

create_zip
notary_profile=${ZMANAGER_NOTARY_PROFILE:-}
if [[ -n "$notary_profile" ]]; then
  [[ ${ZMANAGER_CODESIGN_IDENTITY:--} == Developer\ ID\ Application:* ]] || {
    echo "Notarization requires a Developer ID Application identity." >&2
    exit 1
  }
  xcrun notarytool submit "$zip_artifact" --keychain-profile "$notary_profile" --wait
  xcrun stapler staple "$staged_app"
  create_zip
fi

if [[ $bundle_kind != app ]]; then
  create_dmg
  if [[ -n "$notary_profile" ]]; then
    xcrun notarytool submit "$dmg_artifact" --keychain-profile "$notary_profile" --wait
    xcrun stapler staple "$dmg_artifact"
  fi
fi

gate_args=("$staged_app" --expected-arch "$architecture")
gate_args+=(--zip "$zip_artifact")
[[ ! -f $dmg_artifact ]] || gate_args+=(--dmg "$dmg_artifact")
if [[ -n "$notary_profile" ]]; then
  gate_args+=(--require-developer-id --require-notarization)
fi
scripts/release-gate-macos.sh "${gate_args[@]}"

if ((install_application)); then
  destination="$install_dir/ZManager.app"
  temporary="$install_dir/.ZManager.app.zmanager-install-$$"
  backup="$install_dir/.ZManager.app.zmanager-backup-$$"
  use_sudo=0
  [[ -d "$install_dir" && -w "$install_dir" ]] || use_sudo=1
  run_install() { if ((use_sudo)); then sudo "$@"; else "$@"; fi; }
  run_install install -d -m 0755 "$install_dir"
  run_install rm -rf "$temporary" "$backup"
  run_install ditto "$staged_app" "$temporary"
  [[ ! -e "$destination" ]] || run_install mv "$destination" "$backup"
  if run_install mv "$temporary" "$destination"; then
    run_install rm -rf "$backup"
  else
    [[ ! -e "$backup" ]] || run_install mv "$backup" "$destination"
    echo "Unable to install the application at $destination." >&2
    exit 1
  fi
  echo "Installed application: $destination"
  # Register Finder Sync Extension so it appears in Finder's context menu.
  # If the extension doesn't show in Finder, enable it manually:
  #   System Settings > General > Login Items & Extensions > Finder Extensions > ZManager
  if [[ -d "$destination/Contents/PlugIns/ZManagerFinderExtension.appex" ]]; then
    pluginkit -e use -i com.frankmanzhu.zmanager.finder-extension 2>/dev/null || true
    echo "Registered Finder Sync Extension (enable in System Settings if it doesn't appear)"
  fi
else
  echo "Skipping application install because --no-install was set."
fi

echo "macOS $architecture artifacts are ready under: $stage_dir"
