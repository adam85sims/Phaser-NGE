#!/usr/bin/env bash
#==============================================================
# import-asset.sh — copy a file into the project's assets folder
#
# Usage:
#   ./tools/import-asset.sh <type> <file_path>
#
# Types:
#   background | bg      → public/assets/backgrounds/
#   portrait   | port    → public/assets/characters/
#   bgm        | music   → public/assets/audio/bgm/
#   sfx        | sound   → public/assets/audio/sfx/
#   font                 → public/assets/fonts/
#
# Examples:
#   ./tools/import-asset.sh background ~/Downloads/city_night.png
#   ./tools/import-asset.sh portrait ~/Downloads/elena_face.png
#   ./tools/import-asset.sh bgm ~/Music/forest_theme.mp3
#   ./tools/import-asset.sh sfx ~/Downloads/click.wav
#   ./tools/import-asset.sh font ~/Downloads/NotoSans.ttf
#
# The script copies the file, it does not move it.
# It will warn before overwriting an existing file.
#==============================================================

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <type> <file_path>"
  echo ""
  echo "Types:"
  echo "  background | bg    → public/assets/backgrounds/"
  echo "  portrait   | port  → public/assets/characters/"
  echo "  bgm        | music → public/assets/audio/bgm/"
  echo "  sfx        | sound → public/assets/audio/sfx/"
  echo "  font               → public/assets/fonts/"
  exit 1
fi

TYPE="$1"
FILE="$2"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Normalise type
case "$TYPE" in
  background|bg)
    DEST_DIR="$PROJECT_DIR/public/assets/backgrounds"
    ;;
  portrait|port)
    DEST_DIR="$PROJECT_DIR/public/assets/characters"
    ;;
  bgm|music)
    DEST_DIR="$PROJECT_DIR/public/assets/audio/bgm"
    ;;
  sfx|sound)
    DEST_DIR="$PROJECT_DIR/public/assets/audio/sfx"
    ;;
  font)
    DEST_DIR="$PROJECT_DIR/public/assets/fonts"
    ;;
  *)
    echo "Unknown type: $TYPE"
    echo "Valid types: background, portrait, bgm, sfx, font"
    exit 1
    ;;
esac

# Check source file exists
if [ ! -f "$FILE" ]; then
  echo "Error: file not found: $FILE"
  exit 1
fi

# Ensure destination directory exists
mkdir -p "$DEST_DIR"

# Get just the filename
FILENAME="$(basename "$FILE")"
DEST="$DEST_DIR/$FILENAME"

# Warn before overwrite
if [ -f "$DEST" ]; then
  echo "Warning: $DEST already exists."
  read -r -p "Overwrite? [y/N] " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
  fi
fi

cp "$FILE" "$DEST"
echo "✅ Imported $TYPE → $DEST"
