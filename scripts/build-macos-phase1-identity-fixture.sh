#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 CURRENT_NATIVE_APP OUTPUT_ZIP" >&2
  exit 2
fi

source_app=$1
output_zip=$2
version=$(node -p 'require("./package.json").version')
work=$(mktemp -d "${TMPDIR:-/tmp}/zmanager-phase1-identity.XXXXXX")
trap 'rm -rf "$work"' EXIT
app="$work/Z-Manager.app"

ditto "$source_app" "$app"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Z-Manager" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Z-Manager" "$app/Contents/Info.plist" 2>/dev/null || true

while IFS= read -r -d '' plist; do
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1" "$plist"
done < <(find "$app" -name Info.plist -print0)

while IFS= read -r -d '' binary; do codesign --force --sign - "$binary"; done < <(find "$app/Contents/Frameworks" -type f \( -name '*.dylib' -o -perm -111 \) -print0 2>/dev/null || true)
while IFS= read -r -d '' nested; do codesign --force --sign - "$nested"; done < <(find "$app/Contents" -depth \( -name '*.appex' -o -name '*.mdimporter' \) -print0)
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"

rm -f "$output_zip"
ditto -c -k --keepParent "$app" "$output_zip"
echo "created $output_zip (version $version, sha256 $(shasum -a 256 "$output_zip" | awk '{print $1}'))"
