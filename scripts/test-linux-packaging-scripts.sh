#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

test_root="$(mktemp -d)"
created_node_modules=0
cleanup() {
  rm -rf "$test_root"
  rm -f src-tauri/target/release/bundle/deb/ZManager_test_amd64.deb
  if ((created_node_modules)); then
    rm -rf node_modules
  fi
}
trap cleanup EXIT

bin_dir="$test_root/bin"
log_file="$test_root/commands.log"
stage_dir="$test_root/stage"
mkdir -p "$bin_dir"
if [[ ! -d node_modules ]]; then
  mkdir -p node_modules
  created_node_modules=1
fi

write_stub() {
  local name="$1"
  shift
  cat >"$bin_dir/$name"
  chmod +x "$bin_dir/$name"
}

write_stub sudo <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'sudo %s\n' "$*" >>"${ZMANAGER_PACKAGING_TEST_LOG:?}"
if [[ "${1:-}" == "-n" ]]; then
  echo "sudo -n must not be used by --install-deps" >&2
  exit 92
fi
if [[ "${1:-}" == "-v" ]]; then
  exit 0
fi
if [[ "${1:-}" == "-E" ]]; then
  shift
fi
exec "$@"
EOF

write_stub apt-get <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'apt-get %s\n' "$*" >>"${ZMANAGER_PACKAGING_TEST_LOG:?}"
exit 0
EOF

write_stub node <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "v20.19.0"
EOF

write_stub npm <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\n' "$*" >>"${ZMANAGER_PACKAGING_TEST_LOG:?}"
if [[ "${1:-}" == "ls" ]]; then
  exit 1
fi
if [[ "$*" == "run tauri -- build --bundles deb" ]]; then
  mkdir -p src-tauri/target/release/bundle/deb
  printf 'test deb\n' >src-tauri/target/release/bundle/deb/ZManager_test_amd64.deb
fi
EOF

write_stub rustc <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "rustc 1.85.0 (test)"
EOF

write_stub cargo <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "cargo 1.85.0 (test)"
EOF

write_stub pkg-config <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--exists" ]]; then
  exit 0
fi
echo "pkg-config test stub"
EOF

write_stub cmake <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "cmake version 3.22.0"
EOF

write_stub dpkg-deb <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "Debian dpkg-deb test stub"
EOF

write_stub curl <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "$*" >>"${ZMANAGER_PACKAGING_TEST_LOG:?}"
exit 1
EOF

PATH="$bin_dir:$PATH" \
HOME="$test_root/home" \
ZMANAGER_PACKAGING_TEST_LOG="$log_file" \
ZMANAGER_DEB_STAGE_DIR="$stage_dir" \
  bash scripts/build-linux-ubuntu-deb.sh --install-deps --skip-tests --allow-non-baseline --no-install

if grep -q 'sudo -n' "$log_file"; then
  echo "Expected --install-deps not to use sudo -n." >&2
  exit 1
fi

if ! grep -q 'apt-get install -y .*pkg-config' "$log_file"; then
  echo "Expected --install-deps to install pkg-config explicitly." >&2
  exit 1
fi

if ! grep -q 'npm install' "$log_file"; then
  echo "Expected incomplete node_modules to be repaired with npm install." >&2
  exit 1
fi

if [[ ! -f "$stage_dir/ZManager_test_amd64.deb" ]]; then
  echo "Expected the test .deb to be staged under the configured stage directory." >&2
  exit 1
fi

echo "Linux packaging script tests passed."
