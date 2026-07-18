#!/bin/zsh
set -euo pipefail

readonly app="${1:-/Applications/Z-Manager.app}"
readonly executable="$app/Contents/MacOS/zmanager-desktop"
readonly log_file="${TMPDIR:-/tmp}/zmanager-installed-host-smoke.log"

/usr/bin/pkill -9 -x zmanager-desktop 2>/dev/null || true
: >"$log_file"
ZMANAGER_MACOS_LINKAGE_SELF_TEST=1 "$executable" >"$log_file" 2>&1 &
readonly app_pid=$!
cleanup() {
  /bin/kill -KILL "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in {1..100}; do
  if /usr/bin/grep -q 'ZMANAGER_MACOS_INSTALLED_LINKAGE_SELF_TEST_OK' "$log_file"; then
    break
  fi
  /bin/sleep 0.1
done

/usr/bin/grep -q 'ZMANAGER_MACOS_INSTALLED_LINKAGE_SELF_TEST_OK' "$log_file"
# The installed marker is emitted only after the host callback succeeds, the
# App Group request completes, and a deferred file-promise write completes.
cleanup
trap - EXIT INT TERM
/bin/cat "$log_file"
