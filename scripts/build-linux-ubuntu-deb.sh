#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

install_deps=0
skip_tests=0
allow_non_baseline=0
install_package=1

usage() {
  cat <<'EOF'
Usage: scripts/build-linux-ubuntu-deb.sh [--install-deps] [--skip-tests] [--allow-non-baseline] [--no-install]

Builds the Ubuntu/Debian .deb distribution package with Tauri, stages it under
/tmp/zmanager-desktop-deb, and reinstalls the staged package through apt.

Release baseline:
  Build release .deb artifacts on Ubuntu 22.04 LTS (jammy). Building on newer
  Ubuntu releases can link against newer system libraries than Ubuntu 22.04 has.

Ubuntu prerequisites:
  sudo apt-get update
  sudo apt-get install build-essential ca-certificates cmake curl file gnupg libacl1-dev libayatana-appindicator3-dev libbz2-dev libexpat1-dev libgtk-3-dev liblz4-dev libxml2-dev libsoup-3.0-dev librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev patchelf pkg-config
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install nodejs

Options:
  --install-deps  Install required Ubuntu build packages, Node.js, and Rust.
  --skip-tests    Skip frontend and Rust tests before packaging.
  --allow-non-baseline
                  Allow local/test builds outside Ubuntu 22.04 jammy.
  --no-install    Build and stage the .deb without reinstalling it.
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
    --allow-non-baseline)
      allow_non_baseline=1
      ;;
    --no-install)
      install_package=0
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

check_release_baseline() {
  local os_id="" version_codename="" pretty_name=""
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    os_id="${ID:-}"
    version_codename="${VERSION_CODENAME:-}"
    pretty_name="${PRETTY_NAME:-}"
  fi

  if [[ "$os_id" == "ubuntu" && "$version_codename" == "jammy" ]]; then
    return
  fi

  if ((allow_non_baseline)); then
    echo "Warning: building outside the Ubuntu 22.04 jammy release baseline: ${pretty_name:-unknown OS}" >&2
    echo "Use this package for local testing only; build release .deb artifacts on Ubuntu 22.04." >&2
    return
  fi

  cat >&2 <<EOF
Release .deb builds must run on Ubuntu 22.04 LTS (jammy).
Current build OS: ${pretty_name:-unknown OS}

Build on an Ubuntu 22.04 amd64 machine/VM/container for release packages, or
rerun with --allow-non-baseline for a local test package only.
EOF
  exit 1
}

check_release_baseline

ubuntu_packages=(
  build-essential
  ca-certificates
  cmake
  curl
  file
  gnupg
  libacl1-dev
  libayatana-appindicator3-dev
  libbz2-dev
  libexpat1-dev
  libgtk-3-dev
  liblz4-dev
  libxml2-dev
  libsoup-3.0-dev
  librsvg2-dev
  libssl-dev
  libwebkit2gtk-4.1-dev
  libxdo-dev
  patchelf
  pkg-config
)

source_cargo_env() {
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.cargo/env"
  fi
}

source_cargo_env

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

npm_packages=(
  @tailwindcss/vite
  @tauri-apps/cli
  @vitejs/plugin-react
  typescript
  vite
  vitest
)

npm_install_required() {
  if [[ ! -d node_modules ]]; then
    return 0
  fi

  ! npm ls --depth=0 "${npm_packages[@]}" >/dev/null 2>&1
}

collect_missing_commands() {
  local command_name
  missing_commands=()
  required_commands=(node npm cargo rustc pkg-config dpkg-deb cmake)
  if ((install_package)); then
    required_commands+=(apt-get)
    if ((EUID != 0)); then
      required_commands+=(sudo)
    fi
  fi
  for command_name in "${required_commands[@]}"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      missing_commands+=("$command_name")
    fi
  done
}

run_apt_get() {
  if ((EUID == 0)); then
    apt-get "$@"
  else
    sudo apt-get "$@"
  fi
}

ensure_package_install_access() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Installing Ubuntu packages requires apt-get." >&2
    exit 1
  fi

  if ((EUID == 0)); then
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    echo "Installing Ubuntu packages requires sudo or a root shell." >&2
    echo "Run as root or install these packages first:" >&2
    echo "  apt-get update && apt-get install ${ubuntu_packages[*]}" >&2
    exit 1
  fi

  echo "Installing Ubuntu packages requires sudo access."
  sudo -v
}

run_nodesource_setup() {
  if ((EUID == 0)); then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  fi
}

if ((install_deps)); then
  ensure_package_install_access
  run_apt_get update
  run_apt_get install -y "${ubuntu_packages[@]}"

  if node_install_required; then
    run_nodesource_setup
    run_apt_get install -y nodejs
  fi

  if rust_install_required; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source_cargo_env
  fi
fi

collect_missing_commands
if ((${#missing_commands[@]})); then
  echo "Missing required command(s): ${missing_commands[*]}" >&2
  echo "Install Node.js, Rust, and Ubuntu packaging prerequisites, then rerun." >&2
  echo "Or run: scripts/build-linux-ubuntu-deb.sh --install-deps" >&2
  echo "Ubuntu packages: sudo apt-get install ${ubuntu_packages[*]}" >&2
  echo "Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" >&2
  echo "Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install nodejs" >&2
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

if npm_install_required; then
  npm install
fi

if ((!skip_tests)); then
  npm run test:frontend
  (cd src-tauri && cargo test)
fi

npm run tauri -- build --bundles deb

apt_stage_dir="${ZMANAGER_DEB_STAGE_DIR:-/tmp/zmanager-desktop-deb}"
install -d -m 0755 "$apt_stage_dir"

deb_count=0
staged_artifacts=()
while IFS= read -r artifact; do
  deb_count=$((deb_count + 1))
  staged_artifact="$apt_stage_dir/$(basename "$artifact")"
  install -m 0644 "$artifact" "$staged_artifact"
  staged_artifacts+=("$staged_artifact")
  echo "Built package: $artifact"
  echo "Apt-readable package: $staged_artifact"
done < <(find src-tauri/target/release/bundle/deb -maxdepth 1 -type f -name '*.deb' -print 2>/dev/null | sort)

if ((deb_count == 0)); then
  echo "Tauri build completed, but no .deb package was found under src-tauri/target/release/bundle/deb." >&2
  exit 1
fi

if ((install_package)); then
  echo "Installing staged package(s): ${staged_artifacts[*]}"
  if ((EUID == 0)); then
    apt-get install -y --reinstall "${staged_artifacts[@]}"
  else
    sudo apt-get install -y --reinstall "${staged_artifacts[@]}"
  fi
else
  echo "Skipping install because --no-install was set."
  echo "Install without _apt sandbox warning: sudo apt-get install --reinstall ${staged_artifacts[*]}"
fi
