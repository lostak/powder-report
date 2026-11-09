#!/usr/bin/env bash
# Copies the latest Windows build from this private repo's "desktop-latest" release to the public update feed
# (lostak/powder-report, release "my-life-desktop") that installed copies of My Life check for updates.
set -euo pipefail
d=$(mktemp -d); cd "$d"
gh release download desktop-latest -R lostak/my-life -p 'MyLife-Setup.exe' -p 'MyLife-Setup.exe.blockmap' -p 'latest.yml'
grep -E '^version:' latest.yml
R=lostak/powder-report
if gh api "repos/$R/releases/tags/my-life-desktop" >/dev/null 2>&1; then
  gh release upload my-life-desktop -R $R MyLife-Setup.exe MyLife-Setup.exe.blockmap latest.yml --clobber
else
  gh release create my-life-desktop -R $R MyLife-Setup.exe MyLife-Setup.exe.blockmap latest.yml --title "My Life for Windows (update feed)" \
    --notes "Installer and update feed for the My Life Windows app. Installed copies update themselves from here." --latest=false
fi
echo "published to https://github.com/$R/releases/download/my-life-desktop/MyLife-Setup.exe"
