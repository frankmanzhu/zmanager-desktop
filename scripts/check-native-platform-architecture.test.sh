#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checker="$repo_root/scripts/check-native-platform-architecture.sh"
fixture_parent="$(mktemp -d "${TMPDIR:-/tmp}/zmanager-native-platform-guard.XXXXXX")"
trap 'rm -rf "$fixture_parent"' EXIT

new_fixture() {
  local name="$1"
  local fixture="$fixture_parent/$name"
  mkdir -p "$fixture/src-tauri/src/platform" "$fixture/src"
  printf 'pub fn placeholder() {}\n' >"$fixture/src-tauri/src/commands.rs"
  printf '%s\n' "$fixture"
}

expect_pass() {
  local fixture="$1"
  local output
  if ! output="$(ZMANAGER_NATIVE_PLATFORM_CHECK_ROOT="$fixture" bash "$checker" 2>&1)"; then
    printf 'Expected architecture guard to pass for %s:\n%s\n' "$fixture" "$output" >&2
    exit 1
  fi
}

expect_failure() {
  local fixture="$1"
  local expected="$2"
  local output
  if output="$(ZMANAGER_NATIVE_PLATFORM_CHECK_ROOT="$fixture" bash "$checker" 2>&1)"; then
    printf 'Expected architecture guard to fail for %s.\n' "$fixture" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    printf 'Expected failure containing %q for %s:\n%s\n' "$expected" "$fixture" "$output" >&2
    exit 1
  fi
}

lint_fixture="$(new_fixture lint-only-cfg-attr)"
cat >"$lint_fixture/src-tauri/src/native_drag_session.rs" <<'EOF'
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

pub struct NativeDragSession;
EOF
expect_pass "$lint_fixture"

behavior_fixture="$(new_fixture behavior-cfg)"
cat >"$behavior_fixture/src-tauri/src/main.rs" <<'EOF'
#[cfg(target_os = "macos")]
fn run_native_behavior() {}
EOF
expect_failure "$behavior_fixture" 'Production OS selection must live under'

cfg_attr_fixture="$(new_fixture behavior-cfg-attr)"
cat >"$cfg_attr_fixture/src-tauri/src/lib.rs" <<'EOF'
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod native;
EOF
expect_failure "$cfg_attr_fixture" 'Production OS selection must live under'

test_fixture="$(new_fixture test-only-cfg)"
cat >"$test_fixture/src-tauri/src/lib.rs" <<'EOF'
pub fn production() {}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    #[test]
    fn macos_only_assertion() {}
}
EOF
expect_pass "$test_fixture"

platform_fixture="$(new_fixture platform-owned-cfg)"
cat >"$platform_fixture/src-tauri/src/platform/macos.rs" <<'EOF'
#[cfg(target_os = "macos")]
pub fn platform_behavior() {}
EOF
expect_pass "$platform_fixture"

printf 'Native platform architecture guard tests passed.\n'
