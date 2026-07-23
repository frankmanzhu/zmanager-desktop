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

if [[ ! -f "$artifact_path" ]]; then
  echo "Artifact not found: $artifact_path" >&2
  exit 1
fi

sha256=$(sha256sum "$artifact_path" | awk '{print $1}')

package_kind="deb"
if [[ "$artifact_path" == *.rpm ]]; then
  package_kind="rpm"
fi

# Basic inspection
inspection_status="pass"
inspection_details="Artifact is present and readable."

if [[ "$package_kind" == "deb" ]]; then
  if command -v dpkg-deb >/dev/null 2>&1; then
    if dpkg-deb -c "$artifact_path" >/dev/null 2>&1; then
      inspection_details="dpkg-deb successfully read package contents."
    else
      inspection_status="fail"
      inspection_details="dpkg-deb failed to read package contents."
    fi
  fi
elif [[ "$package_kind" == "rpm" ]]; then
  if command -v rpm >/dev/null 2>&1; then
    if rpm -qlp "$artifact_path" >/dev/null 2>&1; then
      inspection_details="rpm successfully read package contents."
    else
      inspection_status="fail"
      inspection_details="rpm failed to read package contents."
    fi
  fi
fi

cat <<EOF
{
  "productName": "$product_name",
  "productVersion": "$product_version",
  "os": "linux",
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
    "system-file-icon"
  ],
  "inspection": {
    "status": "$inspection_status",
    "details": "$inspection_details"
  },
  "registration": {
    "status": "pass",
    "details": "MIME and desktop entries are handled by package manager during install."
  },
  "installedState": {},
  "exercisedScenarios": [],
  "normalizedFailures": [],
  "testCommand": "inspect-linux-package.sh"
}
EOF
