#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 APPLICATION_BUNDLE" >&2
  exit 2
fi

app=$1
executable_name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist")
executable="$app/Contents/MacOS/$executable_name"
frameworks="$app/Contents/Frameworks"
mkdir -p "$frameworks"

dependencies=()
while IFS= read -r dependency; do dependencies+=("$dependency"); done < <(otool -L "$executable" | awk 'NR > 1 {print $1}' | grep -E '^/(opt/homebrew|usr/local)/' | sort -u)
for dependency in "${dependencies[@]}"; do
  name=$(basename "$dependency")
  ditto "$dependency" "$frameworks/$name"
  chmod 0755 "$frameworks/$name"
  install_name_tool -id "@rpath/$name" "$frameworks/$name"
  install_name_tool -change "$dependency" "@rpath/$name" "$executable"
done

if ! otool -l "$executable" | grep -q '@executable_path/../Frameworks'; then
  install_name_tool -add_rpath '@executable_path/../Frameworks' "$executable"
fi

identity=${ZMANAGER_CODESIGN_IDENTITY:--}
options=()
if [[ $identity != - ]]; then options=(--options runtime --timestamp); fi
while IFS= read -r -d '' nested; do codesign --force "${options[@]}" --sign "$identity" "$nested"; done < <(find "$frameworks" -type f -print0)
codesign --force "${options[@]}" --sign "$identity" "$executable"
codesign --force --deep "${options[@]}" --sign "$identity" "$app"
codesign --verify --deep --strict "$app"

if otool -L "$executable" | grep -Eq '^\s+/(opt/homebrew|usr/local)/'; then
  echo "Application still contains build-machine library paths" >&2
  exit 1
fi
echo "Prepared self-contained signed application: $app"
