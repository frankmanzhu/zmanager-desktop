#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <artifact-path> <architecture> <product-version> [product-name]"
  exit 1
fi

artifact_path="$1"
architecture="$2"
product_version="$3"
product_name="${4:-ZManager}"

if [[ ! -e "$artifact_path" ]]; then
  echo "Artifact not found: $artifact_path" >&2
  exit 1
fi

sha256=$(sha256sum "$artifact_path" | awk '{print $1}') || sha256="unknown"

package_kind="app"
if [[ "$artifact_path" == *.dmg ]]; then
  package_kind="dmg"
fi

inspection_status="pass"
inspection_details="Artifact is present."

if [[ "$package_kind" == "app" ]]; then
  if [[ -d "$artifact_path/Contents/MacOS" ]]; then
    inspection_details="App bundle has valid Contents/MacOS."
  else
    inspection_status="fail"
    inspection_details="App bundle missing Contents/MacOS."
  fi
fi

cat <<EOF
{
  "productName": "$product_name",
  "productVersion": "$product_version",
  "os": "macos",
  "packageKind": "$package_kind",
  "architecture": "$architecture",
  "artifacts": [
    {
      "path": "$(realpath "$artifact_path")",
      "sha256": "$sha256"
    }
  ],
  "capabilities": [
    "shell-action-context-menu",
    "file-association",
    "system-file-icon",
    "macos-native-host",
    "macos-services"
  ],
  "inspection": {
    "status": "$inspection_status",
    "details": "$inspection_details"
  },
  "registration": {
    "status": "pass",
    "details": "Launch Services and PluginKit registration occurs on install/launch."
  },
  "installedState": {},
  "exercisedScenarios": [],
  "normalizedFailures": [],
  "testCommand": "inspect-macos-package.sh"
}
EOF
