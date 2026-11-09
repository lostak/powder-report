#!/usr/bin/env bash
# Ships a new version of the Windows app: copies this desktop folder (screens synced from ../web) to the public
# lostak/powder-report "my-life-desktop" branch. Its Actions build the installer and the update feed
# (release "my-life-desktop"); installed copies pick it up within 30 minutes and install on restart.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
node "$here/scripts/sync-web.js"
d=$(mktemp -d); git clone -q --single-branch --branch refs/heads/my-life-desktop https://github.com/lostak/powder-report "$d" 2>/dev/null || git clone -q --single-branch --branch my-life-desktop https://github.com/lostak/powder-report "$d"
rm -rf "$d/desktop"; mkdir -p "$d/desktop"
(cd "$here" && tar --exclude=node_modules --exclude=dist -cf - .) | tar -xf - -C "$d/desktop"
node -e "const f='$d/desktop/package.json',j=require(f);j.scripts['sync-web']='echo renderer is synced from the private repo';require('fs').writeFileSync(f,JSON.stringify(j,null,2))"
cd "$d" && git add -A
if git diff --cached --quiet; then echo "no changes to ship"; exit 0; fi
git commit -qm "${1:-Update My Life for Windows}" && git push -q origin HEAD:refs/heads/my-life-desktop
echo "pushed; the build takes ~4 min: https://github.com/lostak/powder-report/actions"
