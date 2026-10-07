#!/usr/bin/env bash
# Put this repo, exactly as it is on GitHub, on the VPS:
#
#   npm run deploy        (or: bash deploy/deploy.sh, from Git Bash)
#
# Refuses unless this copy matches GitHub (nothing uncommitted, unpulled or unpushed). Tests and
# builds here, then swaps the built files in at /srv/cmi5/site in one step. Needs deploy/setup.sh
# to have been run once.
set -euo pipefail

SERVER="${CMI5_SERVER:-root@50.6.206.202}"
DOMAIN="${CMI5_DOMAIN:-learn.tribeofabraham.com}"
SITE=/srv/cmi5/site
cd "$(dirname "$0")/.."
quiet() { grep -v -E 'post-quantum|store now|upgraded|^\*\* ' || true; }

if [ -n "$(git status --porcelain)" ]; then echo "✖ You have changes that are not committed. Commit and push them first."; exit 1; fi
git fetch -q origin
read -r ahead behind < <(git rev-list --left-right --count "HEAD...@{u}")
if [ "$behind" -gt 0 ]; then echo "✖ GitHub has $behind newer commit(s). Run git pull first."; exit 1; fi
if [ "$ahead" -gt 0 ]; then echo "✖ You have $ahead commit(s) not on GitHub. Run git push first."; exit 1; fi
commit=$(git rev-parse --short HEAD)

echo "Testing and building…"
# install, not ci: it leaves an up-to-date node_modules alone, so a running dev server is no obstacle
npm install --silent --no-audit --no-fund
npm test --silent >/dev/null 2>&1 || { npm test; echo "✖ Tests failed. Nothing was deployed."; exit 1; }
npm run build --silent >/dev/null || { echo "✖ The page didn't build. Nothing was deployed."; exit 1; }
echo "$commit" > dist/DEPLOYED

echo "Deploying $commit to $SERVER…"
tar -c -C dist . | ssh -o BatchMode=yes "$SERVER" "
  set -e
  rm -rf $SITE.new && mkdir -p $SITE.new && tar -x -C $SITE.new
  chmod -R a+rX $SITE.new
  rm -rf $SITE.old && mv $SITE $SITE.old && mv $SITE.new $SITE && rm -rf $SITE.old
" 2>&1 | quiet

code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://$DOMAIN/cmi5/" || true)
if [ "$code" = 200 ]; then
  echo "✔ Deployed $commit. https://$DOMAIN/cmi5/ is up."
else
  echo "✖ Deployed $commit, but https://$DOMAIN/cmi5/ answered $code. Has npm run setup been run?"
  exit 1
fi
