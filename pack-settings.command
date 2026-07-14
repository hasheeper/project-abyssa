#!/bin/zsh

set -e
cd -- "$(dirname -- "$0")"

node scripts/pack-settings.mjs

echo
echo "设定合集已生成：st/setting/ABYSSA_SETTINGS_BUNDLE.txt"
