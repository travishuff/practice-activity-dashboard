#!/bin/zsh

set -euo pipefail

project_dir="${0:A:h:h}"
icon_source="$project_dir/assets/app-icon.svg"
iconset_dir="$project_dir/assets/app-icon.iconset"
render_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$render_dir" "$iconset_dir"
}
trap cleanup EXIT

mkdir -p "$iconset_dir"
qlmanage -t -s 1024 -o "$render_dir" "$icon_source" >/dev/null
source_png="$render_dir/app-icon.svg.png"

sips -z 16 16 "$source_png" --out "$iconset_dir/icon_16x16.png" >/dev/null
sips -z 32 32 "$source_png" --out "$iconset_dir/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$source_png" --out "$iconset_dir/icon_32x32.png" >/dev/null
sips -z 64 64 "$source_png" --out "$iconset_dir/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$source_png" --out "$iconset_dir/icon_128x128.png" >/dev/null
sips -z 256 256 "$source_png" --out "$iconset_dir/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$source_png" --out "$iconset_dir/icon_256x256.png" >/dev/null
sips -z 512 512 "$source_png" --out "$iconset_dir/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$source_png" --out "$iconset_dir/icon_512x512.png" >/dev/null
cp "$source_png" "$iconset_dir/icon_512x512@2x.png"

iconutil -c icns "$iconset_dir" -o "$project_dir/assets/app-icon.icns"
