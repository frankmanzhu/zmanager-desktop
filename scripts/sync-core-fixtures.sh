#!/usr/bin/env sh
set -eu

SOURCE_ROOT="${1:-../ZManager/cli/tests/fixtures}"
DESTINATION="${2:-docs/fixtures}"

if [ ! -d "$SOURCE_ROOT" ]; then
  echo "Skipping fixture sync: source not found: $SOURCE_ROOT"
  exit 0
fi

mkdir -p "$DESTINATION"
cp -R "$SOURCE_ROOT/." "$DESTINATION/"

echo "Synced fixture corpus to $DESTINATION from $SOURCE_ROOT"
