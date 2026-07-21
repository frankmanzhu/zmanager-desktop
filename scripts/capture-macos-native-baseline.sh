#!/usr/bin/env bash
set -euo pipefail

readonly expected_bundle_id="com.frankmanzhu.zmanager"
readonly expected_version="1.0.0"
readonly finder_bundle_id="com.frankmanzhu.zmanager.finder-extension"
readonly quicklook_bundle_id="com.frankmanzhu.zmanager.quicklook-preview"
readonly install_root="$HOME/Applications/ZManager Migration Baseline"
readonly installed_app="$install_root/ZManager.app"
readonly lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

usage() {
  cat <<'EOF'
Usage:
  scripts/capture-macos-native-baseline.sh prepare OLD_APP
  scripts/capture-macos-native-baseline.sh capture OUTPUT.md
  scripts/capture-macos-native-baseline.sh cleanup

Run this script only from a disposable, interactively logged-in macOS account.

prepare validates and installs an isolated user-local copy of the native v1.0.0
application, registers its extensions, and opens it for manual baseline checks.

capture records non-secret installed identity and registration evidence. It
records preference key presence only; preference values are never emitted.

cleanup unregisters the isolated copy and removes only the fixed user-local
baseline install directory. It does not remove preferences or Application
Support data because those are evidence for later replacement testing.
EOF
}

fail() {
  echo "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1"
}

require_disposable_interactive_user() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This harness must run on macOS."
  [[ "$EUID" -ne 0 ]] || fail "Do not run this harness as root."

  local console_user current_user
  console_user="$(stat -f '%Su' /dev/console)"
  current_user="$(id -un)"
  [[ "$console_user" == "$current_user" ]] || fail \
    "Run this harness inside the disposable user's active graphical login session."

  [[ -x "$lsregister" ]] || fail "Launch Services registration tool is unavailable."
  require_command codesign
  require_command ditto
  require_command open
  require_command pluginkit
  require_command plutil
}

validate_native_release() {
  local app="$1"
  local plist="$app/Contents/Info.plist"
  [[ -d "$app" && -f "$plist" ]] || fail "Not an application bundle: $app"

  local bundle_id version
  bundle_id="$(plist_value "$plist" CFBundleIdentifier)"
  version="$(plist_value "$plist" CFBundleShortVersionString)"
  [[ "$bundle_id" == "$expected_bundle_id" ]] || fail \
    "Expected bundle identifier $expected_bundle_id, found $bundle_id."
  [[ "$version" == "$expected_version" ]] || fail \
    "Expected native release version $expected_version, found $version."

  [[ -d "$app/Contents/PlugIns/ZManagerFinderExtension.appex" ]] || fail \
    "Native release is missing its Finder Sync extension."
  [[ -d "$app/Contents/PlugIns/ZManagerQuickLookPreview.appex" ]] || fail \
    "Native release is missing its Quick Look preview extension."
  codesign --verify --deep --strict "$app"
}

assert_clean_disposable_state() {
  local preference_plist="$HOME/Library/Preferences/$expected_bundle_id.plist"
  local application_support="$HOME/Library/Application Support/ZManager"

  [[ ! -e "$preference_plist" ]] || fail \
    "Existing native preferences found at $preference_plist. Use a clean disposable account."
  [[ ! -e "$application_support" ]] || fail \
    "Existing native Application Support found at $application_support. Use a clean disposable account."
  [[ ! -e "$install_root" ]] || fail \
    "Baseline install already exists at $install_root. Capture or clean it first."
}

prepare() {
  [[ $# -eq 1 ]] || fail "prepare requires OLD_APP."
  local source_app="$1"
  validate_native_release "$source_app"
  assert_clean_disposable_state

  install -d -m 0755 "$install_root"
  ditto "$source_app" "$installed_app"
  validate_native_release "$installed_app"

  "$lsregister" -f "$installed_app"
  pluginkit -a "$installed_app/Contents/PlugIns/ZManagerFinderExtension.appex"
  pluginkit -a "$installed_app/Contents/PlugIns/ZManagerQuickLookPreview.appex"
  pluginkit -e use -i "$finder_bundle_id"
  pluginkit -e use -i "$quicklook_bundle_id"

  open "$installed_app"

  cat <<EOF
Native v1.0.0 baseline is installed at:
  $installed_app

Complete the manual checks in docs/migration/macos-phase-0-installed-capture.md,
then run:
  scripts/capture-macos-native-baseline.sh capture /path/to/phase-0-installed-evidence.md
EOF
}

preference_key_state() {
  local key="$1"
  if defaults read "$expected_bundle_id" "$key" >/dev/null 2>&1; then
    printf '%s' present
  else
    printf '%s' absent
  fi
}

append_signature_summary() {
  local target="$1"
  local label="$2"
  {
    echo "### $label"
    echo
    echo '```text'
    codesign -dv --verbose=4 "$target" 2>&1 \
      | awk '/^(Executable|Identifier|Format|CodeDirectory|VersionPlatform|VersionMin|VersionSDK|TeamIdentifier|Signature)=/{print}'
    echo '```'
    echo
  } >> "$3"
}

append_registration_summary() {
  local output="$1"
  {
    echo '## Extension registration'
    echo
    echo '```text'
    pluginkit -m -A -D -i "$finder_bundle_id" 2>&1 || true
    pluginkit -m -A -D -i "$quicklook_bundle_id" 2>&1 || true
    echo '```'
    echo
    echo '## Launch Services identity excerpt'
    echo
    echo '```text'
    "$lsregister" -dump \
      | awk -v id="$expected_bundle_id" '
          index($0, id) { remaining = 24 }
          remaining > 0 { print; remaining -= 1 }
        '
    echo '```'
    echo
  } >> "$output"
}

capture() {
  [[ $# -eq 1 ]] || fail "capture requires OUTPUT.md."
  local output="$1"
  [[ ! -e "$output" ]] || fail "Refusing to overwrite existing evidence: $output"
  validate_native_release "$installed_app"

  local plist="$installed_app/Contents/Info.plist"
  local executable_name
  executable_name="$(plist_value "$plist" CFBundleExecutable)"

  {
    echo '# macOS native v1.0.0 installed baseline evidence'
    echo
    echo "- Capture timestamp (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "- Console user: $(id -un)"
    echo "- macOS: $(sw_vers -productVersion)"
    echo "- Architecture: $(uname -m)"
    echo "- Bundle path: $installed_app"
    echo "- Bundle identifier: $(plist_value "$plist" CFBundleIdentifier)"
    echo "- Product version: $(plist_value "$plist" CFBundleShortVersionString)"
    echo "- Build number: $(plist_value "$plist" CFBundleVersion)"
    echo "- Executable format: $(file -b "$installed_app/Contents/MacOS/$executable_name")"
    echo
    echo '## Code signatures'
    echo
  } > "$output"

  append_signature_summary "$installed_app" 'Application' "$output"
  append_signature_summary \
    "$installed_app/Contents/PlugIns/ZManagerFinderExtension.appex" \
    'Finder Sync extension' "$output"
  append_signature_summary \
    "$installed_app/Contents/PlugIns/ZManagerQuickLookPreview.appex" \
    'Quick Look preview extension' "$output"
  append_registration_summary "$output"

  {
    echo '## Non-secret preference key presence'
    echo
    echo '| Key | State |'
    echo '|---|---|'
  } >> "$output"

  local key
  for key in \
    defaultArchiveFormat \
    defaultCleanSourceEnabled \
    defaultCreateProfile \
    defaultOutputLocation \
    customOutputFolderPath \
    quickOpenExtractionEnabled \
    quickExtractionLocation \
    quickExtractionFolderPath \
    previewCleanupPolicy \
    defaultOpenerSavedPreviousHandlers
  do
    printf '| `%s` | %s |\n' "$key" "$(preference_key_state "$key")" >> "$output"
  done

  {
    echo
    echo 'No preference values were captured.'
    echo
    echo '## Storage path presence'
    echo
    if [[ -e "$HOME/Library/Preferences/$expected_bundle_id.plist" ]]; then
      echo '- Native preference plist: present'
    else
      echo '- Native preference plist: absent'
    fi
    if [[ -d "$HOME/Library/Application Support/ZManager" ]]; then
      echo '- Native Application Support directory: present'
    else
      echo '- Native Application Support directory: absent'
    fi
    echo
    echo '## Manual observation record'
    echo
    echo '- [ ] Cold launch completed'
    echo '- [ ] Warm activation completed'
    echo '- [ ] Dock reopen completed'
    echo '- [ ] Finder Open With/association behavior recorded'
    echo '- [ ] Finder Sync single-selection menu recorded'
    echo '- [ ] Finder Sync multi-selection menu recorded'
    echo '- [ ] Services menu behavior recorded'
    echo '- [ ] Quick Look behavior recorded'
    echo '- [ ] Preference persistence after relaunch recorded'
    echo '- [ ] Default-opener state and restoration behavior recorded'
    echo '- [ ] Screenshots/logs attached or linked'
    echo
    echo 'Complete these observations before treating this evidence as passing.'
  } >> "$output"

  echo "Wrote non-secret baseline evidence to $output"
}

cleanup() {
  if [[ -d "$installed_app" ]]; then
    "$lsregister" -u "$installed_app" || true
  fi
  pluginkit -e ignore -i "$finder_bundle_id" || true
  pluginkit -e ignore -i "$quicklook_bundle_id" || true

  if [[ -d "$install_root" ]]; then
    case "$install_root" in
      "$HOME/Applications/ZManager Migration Baseline")
        rm -rf "$install_root"
        ;;
      *)
        fail "Refusing to remove unexpected path: $install_root"
        ;;
    esac
  fi

  echo "Removed the isolated user-local baseline application."
  echo "Preferences and Application Support evidence were intentionally preserved."
}

main() {
  require_disposable_interactive_user
  [[ $# -ge 1 ]] || {
    usage
    exit 2
  }

  local command="$1"
  shift
  case "$command" in
    prepare)
      prepare "$@"
      ;;
    capture)
      capture "$@"
      ;;
    cleanup)
      [[ $# -eq 0 ]] || fail "cleanup accepts no arguments."
      cleanup
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
