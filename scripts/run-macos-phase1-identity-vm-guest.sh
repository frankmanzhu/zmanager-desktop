#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 IDENTITY_FIXTURE_ZIP" >&2
  exit 2
fi

zip=$1
console_user=$(stat -f '%Su' /dev/console)
uid=$(id -u "$console_user")
home=$(dscl . -read "/Users/$console_user" NFSHomeDirectory | awk '{print $2}')
install_root="$home/Applications/ZManager Migration Baseline"
app="$install_root/ZManager.app"
report="/Users/Shared/ZManagerMigrationPhase0-20260716/phase-1-identity-evidence.md"
stage=$(mktemp -d /tmp/zmanager-phase1-identity.XXXXXX)
trap 'rm -rf "$stage"' EXIT

ditto -x -k "$zip" "$stage"
candidate="$stage/ZManager.app"
[[ -d "$candidate" ]]
[[ $(defaults read "$candidate/Contents/Info" CFBundleIdentifier) == org.tzap-org.zmanager ]]
product_version=$(defaults read "$candidate/Contents/Info" CFBundleShortVersionString)
[[ $product_version =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]
codesign --verify --deep --strict "$candidate"

rm -rf "$app"
ditto "$candidate" "$app"
chown -R "$console_user":staff "$install_root"
launchctl asuser "$uid" sudo -H -u "$console_user" /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"

finder_id=$(defaults read "$app/Contents/PlugIns/ZManagerFinderExtension.appex/Contents/Info" CFBundleIdentifier)
quicklook_id=$(defaults read "$app/Contents/PlugIns/ZManagerQuickLookPreview.appex/Contents/Info" CFBundleIdentifier)
[[ $finder_id == org.tzap-org.zmanager.finder-extension ]]
[[ $quicklook_id == org.tzap-org.zmanager.quicklook-preview ]]

count=0
while IFS= read -r -d '' candidate_app; do
  id=$(defaults read "$candidate_app/Contents/Info" CFBundleIdentifier 2>/dev/null || true)
  [[ $id == org.tzap-org.zmanager ]] && count=$((count + 1))
done < <(find "$home/Applications" -type d -name '*.app' -print0)
[[ $count -eq 1 ]]

cat > "$report" <<EOF
# macOS Phase 1 clean-machine identity evidence

- Timestamp (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Console user: $console_user
- Replacement path: $app
- Bundle identifier: org.tzap-org.zmanager
- Product version: $product_version
- Canonical user-local application count: $count
- Finder extension identifier: $finder_id
- Quick Look preview identifier: $quicklook_id
- Nested signature verification: PASS
- In-place old-product replacement: PASS
- Duplicate canonical product after replacement: no
- Preference values emitted: no
EOF
chown "$console_user":staff "$report"
echo "$report"
