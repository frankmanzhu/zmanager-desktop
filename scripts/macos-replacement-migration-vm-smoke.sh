#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
user_name="${2:-localadmin}"
user_home="$(dscl . -read "/Users/$user_name" NFSHomeDirectory | awk '{print $2}')"
legacy_domain="com.frankmanzhu.zmanager"
legacy_support="$user_home/Library/Application Support/ZManager/tzap-state"
replacement_support="$user_home/Library/Application Support/com.frankmanzhu.zmanager"
state_file="$replacement_support/replacement-migration-v1.json"
restore_file="$replacement_support/default-handler-restore.json"

seed() {
  if [[ -d "$replacement_support" && ! -e "/tmp/zmanager-phase11-existing-data" ]]; then
    mv "$replacement_support" /tmp/zmanager-phase11-existing-data
  fi
  mkdir -p "$legacy_support" /tmp/zmanager-preview-999999-1
  chown -R "$user_name":staff "$user_home/Library/Application Support/ZManager" \
    /tmp/zmanager-preview-999999-1
  if [[ ! -d /Applications/ZManager.app ]]; then
    ditto /Applications/Z-Manager.app /Applications/ZManager.app
    chown -R "$user_name":staff /Applications/ZManager.app
  fi
  local defaults=(sudo -H -u "$user_name" defaults write "$legacy_domain")
  "${defaults[@]}" defaultArchiveFormat tzap
  "${defaults[@]}" defaultCleanSourceEnabled -bool false
  "${defaults[@]}" defaultOutputLocation customFolder
  "${defaults[@]}" customOutputFolderPath "$user_home/Documents/LegacyArchives"
  "${defaults[@]}" quickOpenExtractionEnabled -bool true
  "${defaults[@]}" quickExtractionLocation chosenFolder
  "${defaults[@]}" quickExtractionFolderPath "$user_home/Documents/LegacyExtracted"
  "${defaults[@]}" previewCleanupPolicy whenAppCloses
  "${defaults[@]}" defaultOpenerSavedPreviousHandlers \
    -dict public.zip-archive com.apple.ArchiveUtility
  echo "replacement migration VM fixture seeded"
}

verify() {
  [[ -f "$state_file" ]]
  [[ -f "$restore_file" ]]
  [[ -d /Applications/ZManager.app ]]
  [[ ! -e /tmp/zmanager-preview-999999-1 ]]
  [[ -f "$user_home/Library/Preferences/$legacy_domain.plist" ]]
  python3 - "$state_file" "$restore_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    state = json.load(handle)
assert state["version"] == 1
assert state["completedAtUnixSeconds"] is not None
assert all(state["steps"].values())
assert state["backup"]["preferences"]["defaultArchiveFormat"] == "tzap"
assert state["backup"]["preferences"]["defaultCleanSourceEnabled"] is False
assert state["backup"]["preferences"]["quickExtractionLocation"] == "chosenFolder"
assert state["backup"]["defaultHandlerRestore"]["public.zip-archive"] == "com.apple.ArchiveUtility"
assert state["appliedPreferenceKeys"] == [
    "defaultArchiveFormat",
    "defaultCleanSourceEnabled",
    "defaultOutputLocation",
    "customOutputFolderPath",
    "defaultExtractionBehavior",
    "customExtractFolderPath",
    "previewCleanupPolicy",
]
assert all(set(item) == {"key", "code"} for item in state["diagnostics"])
print(json.dumps({
    "version": state["version"],
    "completed": True,
    "steps": state["steps"],
    "appliedPreferenceKeys": state["appliedPreferenceKeys"],
    "diagnostics": state["diagnostics"],
}, separators=(",", ":")))
with open(sys.argv[2], "r", encoding="utf-8") as handle:
    restore = json.load(handle)
assert restore["version"] == 1
assert restore["bundleId"] == "com.frankmanzhu.zmanager"
assert restore["handlers"]["zip"] == "com.apple.ArchiveUtility"
PY
}

hash_state() {
  shasum -a 256 "$state_file" | awk '{print $1}'
}

reset_replacement() {
  pkill -x zmanager-desktop 2>/dev/null || true
  local suffix
  suffix="$(date +%s)"
  if [[ -d "$replacement_support" ]]; then
    mv "$replacement_support" "/tmp/zmanager-phase11-replacement-$suffix"
  fi
  local webkit="$user_home/Library/WebKit/$legacy_domain"
  if [[ -d "$webkit" ]]; then
    mv "$webkit" "/tmp/zmanager-phase11-webkit-$suffix"
  fi
  mkdir -p /tmp/zmanager-preview-999999-1
  chown -R "$user_name":staff /tmp/zmanager-preview-999999-1
  echo "replacement migration VM fixture reset"
}

case "$mode" in
  seed) seed ;;
  verify) verify ;;
  hash) hash_state ;;
  reset) reset_replacement ;;
  *) echo "usage: $0 seed|verify|hash|reset [USER]" >&2; exit 2 ;;
esac
