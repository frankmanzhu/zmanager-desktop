#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 1 ]]; then echo "usage: $0 APPLICATION_BUNDLE" >&2; exit 2; fi
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app=$1
register_plan=$("$repo_root/scripts/macos-register-bundle.sh" register "$app" --dry-run)
unregister_plan=$("$repo_root/scripts/macos-register-bundle.sh" unregister "$app" --dry-run)

for exact_path in \
  "$app" \
  "$app/Contents/PlugIns/ZManagerFinderExtension.appex" \
  "$app/Contents/PlugIns/ZManagerQuickLookPreview.appex" \
  "$app/Contents/PlugIns/ZManagerQuickLookThumbnail.appex" \
  "$app/Contents/Library/Spotlight/ZManagerSpotlight.mdimporter"; do
  quoted=$(printf '%q' "$exact_path")
  grep -Fq "$quoted" <<<"$register_plan$unregister_plan" || {
    echo "registration plan omits exact path: $exact_path" >&2
    exit 1
  }
done
if grep -Eq -- '(-kill|-seed|-reset)[[:space:]]' <<<"$register_plan$unregister_plan"; then
  echo "registration plan contains a destructive global reset" >&2
  exit 1
fi
grep -Fq 'register completed for exact bundle path:' <<<"$register_plan"
grep -Fq 'unregister completed for exact bundle path:' <<<"$unregister_plan"
echo "deterministic macOS registration plans passed"
