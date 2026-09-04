#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "usage: $0 register|unregister APPLICATION_BUNDLE [--dry-run]" >&2
  exit 2
fi
action=$1
app=$2
dry_run=0
[[ ${3:-} != --dry-run ]] || dry_run=1
case "$action" in register|unregister) ;; *) echo "expected register or unregister" >&2; exit 2 ;; esac
[[ -d $app && -f $app/Contents/Info.plist ]] || { echo "invalid application bundle: $app" >&2; exit 1; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
identity_config="$repo_root/packaging/macos/product-identity.json"
product_id() { /usr/bin/python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$identity_config" "$1"; }

readonly lsregister=${ZMANAGER_LSREGISTER:-/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister}
readonly pluginkit=${ZMANAGER_PLUGINKIT:-/usr/bin/pluginkit}
readonly qlmanage=${ZMANAGER_QLMANAGE:-/usr/bin/qlmanage}
readonly mdimport=${ZMANAGER_MDIMPORT:-/usr/bin/mdimport}
readonly finder="$app/Contents/PlugIns/ZManagerFinderExtension.appex"
readonly preview="$app/Contents/PlugIns/ZManagerQuickLookPreview.appex"
readonly thumbnail="$app/Contents/PlugIns/ZManagerQuickLookThumbnail.appex"
readonly spotlight="$app/Contents/Library/Spotlight/ZManagerSpotlight.mdimporter"

main_id=$(product_id mainBundleIdentifier)
finder_id=$(product_id finderExtensionBundleIdentifier)
preview_id=$(product_id quickLookPreviewBundleIdentifier)
thumbnail_id=$(product_id quickLookThumbnailBundleIdentifier)
spotlight_id=$(product_id spotlightImporterBundleIdentifier)

assert_id() {
  local bundle=$1 expected=$2 actual
  [[ -f $bundle/Contents/Info.plist ]] || { echo "missing required bundle: $bundle" >&2; exit 1; }
  actual=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$bundle/Contents/Info.plist")
  [[ $actual == "$expected" ]] || { echo "refusing to operate on unexpected bundle identifier $actual at $bundle" >&2; exit 1; }
}
assert_id "$app" "$main_id"
assert_id "$finder" "$finder_id"
assert_id "$preview" "$preview_id"
assert_id "$thumbnail" "$thumbnail_id"
assert_id "$spotlight" "$spotlight_id"

run() {
  if ((dry_run)); then printf '%q ' "$@"; printf '\n'; else "$@"; fi
}
optional() {
  if ((dry_run)); then run "$@"; else "$@" || true; fi
}

# Retire old bundle locations only after the current extensions have been added.
# Never remove the current paths: doing so creates a Finder discovery gap.
remove_stale_registrations() {
  while IFS='|' read -r bundle_id current_path; do
    while IFS= read -r registered_path; do
      [[ -n "$registered_path" ]] || continue
      [[ $registered_path != "$current_path" ]] || continue
      optional "$pluginkit" -r "$registered_path"
    done < <(
      "$pluginkit" -m -A -D -vvv -i "$bundle_id" 2>/dev/null |
        sed -n 's/^[[:space:]]*Path = //p'
    )
  done <<EOF
$finder_id|$finder
$preview_id|$preview
$thumbnail_id|$thumbnail
EOF
}

if [[ $action == register ]]; then
  # Announce the replacement before retiring old locations. PluginKit owns the
  # user's enabled/disabled preference, so registration never toggles it.
  run "$lsregister" -f "$app"
  for extension in "$finder" "$preview" "$thumbnail"; do run "$pluginkit" -a "$extension"; done
  remove_stale_registrations
  run "$qlmanage" -r cache
  run "$mdimport" -r "$spotlight"
else
  # Uninstall the exact bundle without persisting a disabled preference that
  # would unexpectedly carry over to a future reinstall.
  for extension in "$finder" "$preview" "$thumbnail"; do optional "$pluginkit" -r "$extension"; done
  optional "$lsregister" -u "$app"
  run "$qlmanage" -r cache
  # Re-import this exact importer path after removal so Spotlight notices the
  # registration change without a destructive global metadata reset.
  optional "$mdimport" -r "$spotlight"
fi
echo "$action completed for exact bundle path: $app"
