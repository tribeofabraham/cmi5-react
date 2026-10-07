#!/usr/bin/env bash
# One-time setup of the VPS for the cmi5 quiz. Safe to run again. From Git Bash on your PC (logs in as
# root with your SSH key):
#
#   npm run setup
#
# The quiz is just files (it talks to the LMS's LRS itself), so Caddy serves them straight from
# /srv/cmi5/site at https://learn.tribeofabraham.com/cmi5/, alongside the elearning-react quiz,
# which keeps everything else on that address. Then run npm run deploy.
set -euo pipefail

SERVER="${CMI5_SERVER:-root@50.6.206.202}"
DOMAIN="${CMI5_DOMAIN:-learn.tribeofabraham.com}"
quiet() { grep -v -E 'post-quantum|store now|upgraded|^\*\* ' || true; }

echo "Setting up $SERVER…"
ssh -o BatchMode=yes "$SERVER" "DOMAIN=$DOMAIN bash -s" 2>&1 <<'REMOTE' | quiet
set -euo pipefail
mkdir -p /srv/cmi5/site
chmod 755 /srv/cmi5 /srv/cmi5/site
echo "  ✔ /srv/cmi5/site"

CADDYFILE=/etc/caddy/Caddyfile
if grep -q 'handle_path /cmi5/\*' "$CADDYFILE"; then
  echo "  ✔ Caddy already serves https://$DOMAIN/cmi5/"
  exit 0
fi
grep -q "^$DOMAIN {" "$CADDYFILE" || { echo "  ✖ No $DOMAIN site in Caddy yet: set up elearning-react first (its npm run setup)."; exit 1; }

cp "$CADDYFILE" "$CADDYFILE.bak"
# Within the $DOMAIN block: /cmi5/ from the folder, everything else as it was
python3 - "$CADDYFILE" "$DOMAIN" <<'PY'
import sys
path, domain = sys.argv[1], sys.argv[2]
s = open(path).read()
start = s.index(domain + ' {')
end = s.index('\n}', start)
block = s[start:end]
old = '\treverse_proxy 127.0.0.1:3030'
assert old in block, 'unexpected site block'
new = '''\t# cmi5-react: the cmi5 quiz, as files (index.html never cached, the hashed assets for a year)
\tredir /cmi5 /cmi5/ 308
\thandle_path /cmi5/* {
\t\troot * /srv/cmi5/site
\t\t@assets path /assets/*
\t\theader @assets Cache-Control "public, max-age=31536000, immutable"
\t\t@pages not path /assets/*
\t\theader @pages Cache-Control "no-cache"
\t\tfile_server
\t}
\t# elearning-react: everything else
\thandle {
\t\treverse_proxy 127.0.0.1:3030
\t}'''
s = s[:start] + block.replace(old, new) + s[end:]
open(path, 'w').write(s)
PY

if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy
  echo "  ✔ Caddy now serves https://$DOMAIN/cmi5/ (elearning-react unchanged)"
else
  mv "$CADDYFILE.bak" "$CADDYFILE"
  echo "  ✖ Caddy didn't accept the change, so the Caddyfile was put back as it was."
  exit 1
fi
REMOTE
echo "Done. Next: npm run deploy"
