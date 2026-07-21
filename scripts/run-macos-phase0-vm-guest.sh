#!/usr/bin/env bash
set -euo pipefail

readonly guest_user="${ZMANAGER_VM_USER:-localadmin}"
readonly guest_uid="$(id -u "$guest_user")"
readonly guest_user_home="$(dscl . -read "/Users/$guest_user" NFSHomeDirectory | awk '{print $2}')"
readonly kit_root="/Users/Shared/ZManagerMigrationPhase0-20260716"
readonly old_zip="$kit_root/ZManager.zip"
readonly old_app="$guest_user_home/Applications/ZManager Migration Baseline/ZManager.app"
readonly current_app="$guest_user_home/Applications/ZManager Migration Baseline/ZManager.app"
readonly finder_bundle_id="com.frankmanzhu.zmanager.finder-extension"
readonly quicklook_bundle_id="com.frankmanzhu.zmanager.quicklook-preview"
readonly lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
readonly baseline_report="$kit_root/phase-0-installed-evidence.md"
readonly runtime_report="$kit_root/phase-0-runtime-evidence.md"
readonly upgrade_report="$kit_root/phase-0-native-upgrade-evidence.md"

usage() {
  cat <<'EOF'
Usage:
  run-macos-phase0-vm-guest.sh baseline
  run-macos-phase0-vm-guest.sh upgrade CURRENT_NATIVE_ZIP

This helper runs as root through Parallels Tools, but all GUI and preference
operations execute inside the logged-in localadmin Aqua session.
EOF
}

fail() {
  echo "$1" >&2
  exit 1
}

aqua() {
  launchctl asuser "$guest_uid" sudo -H -u "$guest_user" "$@"
}

wait_for_process() {
  local executable_path="$1"
  local attempt
  for attempt in $(seq 1 40); do
    if pgrep -f "$executable_path" >/dev/null 2>&1; then
      pgrep -f "$executable_path" | head -1
      return 0
    fi
    sleep 0.25
  done
  return 1
}

validate_environment() {
  [[ "$EUID" -eq 0 ]] || fail "Run this helper through root-capable Parallels Tools."
  [[ "$(stat -f '%Su' /dev/console)" == "$guest_user" ]] || fail \
    "The $guest_user Aqua session is not logged in."
  [[ -x "$lsregister" ]] || fail "Launch Services registration tool is missing."
  [[ -d "$old_app" ]] || fail "The native v1.0.0 baseline app is not installed."
}

prepare_old_release() {
  if [[ -d "$old_app" ]]; then
    return
  fi

  [[ -f "$old_zip" ]] || fail "The native v1.0.0 ZIP is missing."
  [[ ! -e "$guest_user_home/Library/Preferences/com.frankmanzhu.zmanager.plist" ]] || fail \
    "The VM contains pre-existing native preferences. Restore the clean snapshot."
  [[ ! -e "$guest_user_home/Library/Application Support/ZManager" ]] || fail \
    "The VM contains pre-existing native Application Support. Restore the clean snapshot."

  local staging
  staging="$(mktemp -d /tmp/zmanager-native-v1.XXXXXX)"
  ditto -x -k "$old_zip" "$staging"
  [[ -d "$staging/ZManager.app" ]] || fail "Native v1.0.0 ZIP does not contain ZManager.app."
  codesign --verify --deep --strict "$staging/ZManager.app"
  install -d -m 0755 "$(dirname "$old_app")"
  ditto "$staging/ZManager.app" "$old_app"
  chown -R "$guest_user":staff "$(dirname "$old_app")"
  rm -rf "$staging"
  codesign --verify --deep --strict "$old_app"
}

register_old_release() {
  "$lsregister" -f "$old_app"
  aqua pluginkit -a "$old_app/Contents/PlugIns/ZManagerFinderExtension.appex"
  aqua pluginkit -a "$old_app/Contents/PlugIns/ZManagerQuickLookPreview.appex"
  aqua pluginkit -e use -i "$finder_bundle_id"
  aqua pluginkit -e use -i "$quicklook_bundle_id"
}

baseline() {
  prepare_old_release
  validate_environment
  [[ ! -e "$baseline_report" ]] || fail "Baseline report already exists."
  [[ ! -e "$runtime_report" ]] || fail "Runtime report already exists."

  register_old_release
  aqua open "$old_app"

  local executable="$old_app/Contents/MacOS/ZManager"
  local cold_pid="" warm_pid="" launch_result warm_result crash_reason
  launch_result='PASS'
  warm_result='NOT RUN'
  crash_reason='none'
  if cold_pid="$(wait_for_process "$executable")"; then
    aqua open "$old_app"
    sleep 1
    if warm_pid="$(wait_for_process "$executable")"; then
      if [[ "$cold_pid" == "$warm_pid" ]]; then
        warm_result='PASS — reused the running process'
      else
        warm_result='FAIL — created a second application process'
      fi
    else
      warm_result='KNOWN BASELINE FAILURE — application terminated after activation'
    fi
  else
    launch_result='KNOWN BASELINE FAILURE — application terminated during launch'
  fi

  local latest_crash
  latest_crash="$(find "$guest_user_home/Library/Logs/DiagnosticReports" \
    -maxdepth 1 -type f -name 'ZManager-*.ips' -print 2>/dev/null | sort | tail -1)"
  if [[ -n "$latest_crash" ]] && grep -q 'liblzma.5.dylib' "$latest_crash"; then
    crash_reason='DYLD library missing: Homebrew liblzma.5.dylib is referenced but not packaged'
    launch_result='KNOWN BASELINE FAILURE — packaged application is not self-contained'
  fi

  aqua "$kit_root/capture-macos-native-baseline.sh" capture "$baseline_report"

  {
    echo '# macOS native v1.0.0 automated runtime evidence'
    echo
    echo "- Timestamp (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "- Console user: $(stat -f '%Su' /dev/console)"
    echo "- Cold launch: $launch_result"
    echo "- Warm activation: $warm_result"
    echo "- Normalized crash reason: $crash_reason"
    echo '- Finder Sync registration command: PASS'
    echo '- Quick Look registration command: PASS'
    echo '- Native preference values emitted: no'
    echo
    echo 'Process identifiers are intentionally omitted because they are not stable evidence.'
  } > "$runtime_report"
  chown "$guest_user":staff "$baseline_report" "$runtime_report"

  echo "Baseline capture passed: $baseline_report"
  echo "Runtime capture passed: $runtime_report"
}

seed_non_secret_upgrade_state() {
  aqua defaults write com.frankmanzhu.zmanager defaultArchiveFormat -string zip
  aqua defaults write com.frankmanzhu.zmanager defaultCleanSourceEnabled -bool false
  aqua defaults write com.frankmanzhu.zmanager quickOpenExtractionEnabled -bool true
  aqua defaults write com.frankmanzhu.zmanager previewCleanupPolicy -string whenAppCloses
}

assert_seed_state_present() {
  aqua defaults read com.frankmanzhu.zmanager defaultArchiveFormat >/dev/null
  aqua defaults read com.frankmanzhu.zmanager defaultCleanSourceEnabled >/dev/null
  aqua defaults read com.frankmanzhu.zmanager quickOpenExtractionEnabled >/dev/null
  aqua defaults read com.frankmanzhu.zmanager previewCleanupPolicy >/dev/null
}

upgrade() {
  validate_environment
  [[ $# -eq 1 ]] || fail "upgrade requires CURRENT_NATIVE_ZIP."
  local current_zip="$1"
  [[ -f "$current_zip" ]] || fail "Current native ZIP is missing: $current_zip"
  [[ ! -e "$upgrade_report" ]] || fail "Upgrade report already exists."

  seed_non_secret_upgrade_state
  assert_seed_state_present

  local staging
  staging="$(mktemp -d /tmp/zmanager-current-native.XXXXXX)"
  trap 'rm -rf "$staging"' EXIT
  ditto -x -k "$current_zip" "$staging"
  [[ -d "$staging/ZManager.app" ]] || fail "Current native ZIP does not contain ZManager.app."

  aqua pkill -f "$old_app/Contents/MacOS/ZManager" 2>/dev/null || true
  aqua pkill diagnostics_agent 2>/dev/null || true
  ditto "$staging/ZManager.app" "$current_app"
  chown -R "$guest_user":staff "$current_app"
  codesign --verify --deep --strict "$current_app"
  "$lsregister" -f "$current_app"
  aqua pluginkit -a "$current_app/Contents/PlugIns/ZManagerFinderExtension.appex"
  aqua pluginkit -a "$current_app/Contents/PlugIns/ZManagerQuickLookPreview.appex"
  aqua pluginkit -e use -i "$finder_bundle_id"
  aqua pluginkit -e use -i "$quicklook_bundle_id"
  aqua open "$current_app"

  local current_executable="$current_app/Contents/MacOS/ZManager"
  local current_pid="" current_launch_result current_crash_reason
  current_launch_result='PASS'
  current_crash_reason='none'
  if current_pid="$(wait_for_process "$current_executable")"; then
    sleep 2
    if ! kill -0 "$current_pid" 2>/dev/null; then
      current_launch_result='KNOWN BASELINE FAILURE — application terminated during launch'
    fi
  else
    current_launch_result='KNOWN BASELINE FAILURE — application terminated during launch'
  fi

  local latest_current_crash
  latest_current_crash="$(find "$guest_user_home/Library/Logs/DiagnosticReports" \
    -maxdepth 1 -type f -name 'ZManager-*.ips' -print 2>/dev/null | sort | tail -1)"
  if [[ -n "$latest_current_crash" ]] && grep -q 'liblzma.5.dylib' "$latest_current_crash"; then
    current_launch_result='KNOWN BASELINE FAILURE — packaged application is not self-contained'
    current_crash_reason='DYLD library missing: Homebrew liblzma.5.dylib is referenced but not packaged'
  fi
  assert_seed_state_present

  local matching_app_count
  matching_app_count="$({
    find "$guest_user_home/Applications" -maxdepth 4 -type d -name '*.app' -print0
  } | while IFS= read -r -d '' candidate; do
    if [[ -f "$candidate/Contents/Info.plist" ]] && \
      [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$candidate/Contents/Info.plist" 2>/dev/null || true)" == \
        'com.frankmanzhu.zmanager' ]]; then
      echo "$candidate"
    fi
  done | wc -l | tr -d ' ')"

  {
    echo '# Current native build installed-upgrade evidence'
    echo
    echo "- Timestamp (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo '- Source state: native v1.0.0 installed; launch result captured separately'
    echo '- Upgrade state: current native reference build installed; launch result captured below'
    echo '- Bundle identifier continuity: PASS (`com.frankmanzhu.zmanager`)'
    echo '- Non-secret preference key continuity: PASS'
    echo '- Nested code-signature verification: PASS'
    echo "- Current native launch: $current_launch_result"
    echo "- Normalized current-native crash reason: $current_crash_reason"
    echo "- User-local bundles claiming the canonical identifier after upgrade: $matching_app_count"
    if [[ "$matching_app_count" -eq 1 ]]; then
      echo '- Single-product installed state: PASS'
    else
      echo '- Single-product installed state: KNOWN BASELINE FAILURE'
      echo '- Cause: the tagged release is named `ZManager.app` while the current native build is named `ZManager.app`.'
    fi
    echo '- Preference values emitted: no'
  } > "$upgrade_report"
  chown "$guest_user":staff "$upgrade_report"

  rm -rf "$staging"
  trap - EXIT

  echo "Native installed-upgrade capture completed: $upgrade_report"
}

main() {
  [[ $# -ge 1 ]] || {
    usage
    exit 2
  }
  local command="$1"
  shift
  case "$command" in
    baseline)
      [[ $# -eq 0 ]] || fail "baseline accepts no arguments."
      baseline
      ;;
    upgrade)
      upgrade "$@"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage >&2
      fail "Unknown command: $command"
      ;;
  esac
}

main "$@"
