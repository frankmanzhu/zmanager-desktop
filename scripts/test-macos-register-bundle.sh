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

test_root=$(mktemp -d "${TMPDIR:-/tmp}/zmanager-registration-test.XXXXXX")
trap 'rm -rf "$test_root"' EXIT
fake_pluginkit="$test_root/pluginkit"
stale_root="$test_root/Old ZManager.app"
export ZMANAGER_TEST_STALE_FINDER="$stale_root/Contents/PlugIns/ZManagerFinderExtension.appex"
export ZMANAGER_TEST_STALE_PREVIEW="$stale_root/Contents/PlugIns/ZManagerQuickLookPreview.appex"
export ZMANAGER_TEST_STALE_THUMBNAIL="$stale_root/Contents/PlugIns/ZManagerQuickLookThumbnail.appex"
cat >"$fake_pluginkit" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
bundle_id=${!#}
case "$bundle_id" in
  com.frankmanzhu.zmanager.finder-extension)
    path=$ZMANAGER_TEST_STALE_FINDER
    ;;
  com.frankmanzhu.zmanager.quicklook-preview)
    path=$ZMANAGER_TEST_STALE_PREVIEW
    ;;
  com.frankmanzhu.zmanager.quicklook-thumbnail)
    path=$ZMANAGER_TEST_STALE_THUMBNAIL
    ;;
  *)
    exit 2
    ;;
esac
printf '+    %s(1.0.0)\n' "$bundle_id"
printf '            Path = %s\n' "$path"
SH
chmod +x "$fake_pluginkit"

stale_plan=$(
  ZMANAGER_PLUGINKIT="$fake_pluginkit" \
    "$repo_root/scripts/macos-register-bundle.sh" register "$app" --dry-run
)
quoted_fake_pluginkit=$(printf '%q' "$fake_pluginkit")
for stale_path in \
  "$ZMANAGER_TEST_STALE_FINDER" \
  "$ZMANAGER_TEST_STALE_PREVIEW" \
  "$ZMANAGER_TEST_STALE_THUMBNAIL"; do
  quoted=$(printf '%q' "$stale_path")
  grep -Fq "$quoted_fake_pluginkit -r $quoted" <<<"$stale_plan" || {
    echo "registration plan does not remove stale extension path: $stale_path" >&2
    exit 1
  }
done
echo "self-healing registration plan verified"
