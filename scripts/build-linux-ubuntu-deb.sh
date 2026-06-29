#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

install_deps=0
skip_tests=0

usage() {
  cat <<'EOF'
Usage: scripts/build-linux-ubuntu-deb.sh [--install-deps] [--skip-tests]

Builds the Ubuntu/Debian .deb distribution package with Tauri.

Ubuntu prerequisites:
  sudo apt-get update
  sudo apt-get install build-essential cmake curl file libacl1-dev libayatana-appindicator3-dev libbz2-dev libgtk-3-dev liblz4-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf

Options:
  --install-deps  Install required Ubuntu build packages with apt.
  --skip-tests    Skip frontend and Rust tests before packaging.
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

required_commands=(node npm cargo rustc pkg-config dpkg-deb cmake)
missing_commands=()
for command_name in "${required_commands[@]}"; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing_commands+=("$command_name")
  fi
done

ubuntu_packages=(
  build-essential
  cmake
  curl
  file
  libacl1-dev
  libayatana-appindicator3-dev
  libbz2-dev
  libgtk-3-dev
  liblz4-dev
  libsoup-3.0-dev
  librsvg2-dev
  libssl-dev
  libwebkit2gtk-4.1-dev
  libxdo-dev
  patchelf
)

if ((install_deps)); then
  if ! sudo -n true 2>/dev/null; then
    echo "Installing Ubuntu packages requires sudo access." >&2
    echo "Run this command in a terminal first, then rerun the build:" >&2
    echo "  sudo apt-get update && sudo apt-get install ${ubuntu_packages[*]}" >&2
    exit 1
  fi
  sudo apt-get update
  sudo apt-get install -y "${ubuntu_packages[@]}"
fi

if ((${#missing_commands[@]})); then
  echo "Missing required command(s): ${missing_commands[*]}" >&2
  echo "Install Node.js, Rust, and Ubuntu packaging prerequisites, then rerun." >&2
  echo "Ubuntu packages: sudo apt-get install ${ubuntu_packages[*]}" >&2
  exit 1
fi

required_pkg_config_packages=(
  gtk+-3.0
  libsoup-3.0
  webkit2gtk-4.1
)
missing_pkg_config_packages=()
for package_name in "${required_pkg_config_packages[@]}"; do
  if ! pkg-config --exists "$package_name"; then
    missing_pkg_config_packages+=("$package_name")
  fi
done

if ((${#missing_pkg_config_packages[@]})); then
  echo "Missing required pkg-config package(s): ${missing_pkg_config_packages[*]}" >&2
  echo "Install Ubuntu packaging prerequisites, then rerun:" >&2
  echo "  sudo apt-get update" >&2
  echo "  sudo apt-get install ${ubuntu_packages[*]}" >&2
  echo "Or run: scripts/build-linux-ubuntu-deb.sh --install-deps" >&2
  exit 1
fi

version_major() {
  "$1" --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/'
}

version_minor() {
  "$1" --version | sed -E 's/^[^0-9]*[0-9]+\.([0-9]+).*/\1/'
}

rust_major="$(version_major rustc)"
rust_minor="$(version_minor rustc)"
if ((rust_major < 1 || (rust_major == 1 && rust_minor < 85))); then
  echo "Rust 1.85 or newer is required for the Rust 2024 edition used by src-tauri/Cargo.toml." >&2
  echo "Current rustc: $(rustc --version)" >&2
  echo "Install or select a current toolchain, for example: rustup update stable" >&2
  exit 1
fi

node_major="$(version_major node)"
if ((!skip_tests && node_major < 20)); then
  echo "Node.js 20 or newer is required to run the current frontend tests." >&2
  echo "Current node: $(node --version)" >&2
  echo "Use --skip-tests for packaging-only builds, or install Node.js 20+." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

if ((!skip_tests)); then
  npm run test:frontend
  (cd src-tauri && cargo test)
fi

npm run tauri -- build --bundles deb

apt_stage_dir="/tmp/zmanager-desktop-deb"
install -d -m 0755 "$apt_stage_dir"

deb_count=0
while IFS= read -r artifact; do
  deb_count=$((deb_count + 1))
  staged_artifact="$apt_stage_dir/$(basename "$artifact")"
  install -m 0644 "$artifact" "$staged_artifact"
  echo "Built package: $artifact"
  echo "Apt-readable package: $staged_artifact"
  echo "Install without _apt sandbox warning: sudo apt-get install --reinstall $staged_artifact"
done < <(find src-tauri/target/release/bundle/deb -maxdepth 1 -type f -name '*.deb' -print 2>/dev/null | sort)

if ((deb_count == 0)); then
  echo "Tauri build completed, but no .deb package was found under src-tauri/target/release/bundle/deb." >&2
  exit 1
fi
