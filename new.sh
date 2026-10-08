#!/usr/bin/env bash
# Start a new talk from the template
#   ./new.sh 2026-11-05-localboast
set -euo pipefail
NAME="${1:?Usage: ./new.sh YYYY-MM-DD-name}"
DEST="talks/$NAME"
if [ -e "$DEST" ]; then echo "$DEST already exists" >&2; exit 1; fi
mkdir -p "$DEST/img"
cp talks/_template/slides.md "$DEST/slides.md"
touch "$DEST/img/.gitkeep"
echo "Created $DEST/slides.md"
