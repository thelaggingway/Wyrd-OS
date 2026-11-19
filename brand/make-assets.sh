#!/usr/bin/env bash
# Regenerates brand/assets from brand/logo.svg and brand.json's name: every upstream icon and email picture that
# carries their mark, at the same path and size, so brand/apply.ts can copy them over apps/web/public.
# Needs ImageMagick 7 (magick) and jq. Run from the repository root: bash brand/make-assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."
LOGO=brand/logo.svg; OUT=brand/assets; NAME=$(jq -r .name brand/brand.json)
rm -rf "$OUT"; mkdir -p "$OUT/app-icons" "$OUT/email"
FILES=(favicon.ico apple-touch-icon.png icon-512.png push-badge.png email/logo-bone.png email/logo-ink.png email/logo-ink-tile.png email/mark.png)
for f in apps/web/public/app-icons/*; do FILES+=("app-icons/$(basename "$f")"); done
for f in "${FILES[@]}"; do
  src="apps/web/public/$f"; dst="$OUT/$f"
  case "$f" in
    *.ico) magick -background none -density 384 "$LOGO" -define icon:auto-resize=48,32,16 "$dst" ;;
    *) size=$(magick identify -format '%wx%h' "$src[0]"); w=${size%x*}; h=${size#*x}; s=$(( w < h ? w : h ))
       magick -background none -density 384 "$LOGO" -resize "${s}x${s}" -gravity center -extent "${w}x${h}" "$dst" ;;
  esac
done
cp "$LOGO" "$OUT/favicon.svg"
# The share card: the mark and the name on white, at upstream's size.
size=$(magick identify -format '%wx%h' apps/web/public/og.png)
TMP=$(mktemp --suffix .png); magick -background none -density 384 "$LOGO" -resize 220x220 "$TMP"
magick -size "$size" xc:'#f6f6f4' "$TMP" -gravity center -geometry +0-90 -composite \
  -font DejaVu-Sans-Bold -pointsize 72 -fill '#131312' -annotate +0+120 "$NAME" "$OUT/og.png"
rm -f "$TMP"
echo "brand/assets: $(find "$OUT" -type f | wc -l) files"
