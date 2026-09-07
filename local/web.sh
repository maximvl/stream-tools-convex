#!/bin/sh
# Runs vite against the local self-hosted backend by temporarily pointing
# VITE_CONVEX_URL in .env.local at it (Vite prefers the file over process
# env). The original file is restored on exit — Ctrl+C when done.
# While this runs, don't start cloud `convex:dev` in another terminal:
# it reads the same file.
set -eu
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
. ./local/env-keep.sh
WEB_BACKUP="local/.env.web-backup"
keep_snapshot
# A previous hard kill may have left a stale swap behind; the backup is authoritative.
if [ ! -f "$WEB_BACKUP" ]; then
  cp .env.local "$WEB_BACKUP"
  chmod 600 "$WEB_BACKUP"
fi
cleanup() {
  if [ -f "$WEB_BACKUP" ]; then
    mv -f "$WEB_BACKUP" .env.local
  fi
  keep_repair
}
trap cleanup EXIT INT TERM HUP
LOCAL_URL="${VITE_CONVEX_URL:-http://127.0.0.1:3210}"
if grep -q '^VITE_CONVEX_URL=' .env.local 2>/dev/null; then
  sed -i "s|^VITE_CONVEX_URL=.*|VITE_CONVEX_URL=$LOCAL_URL|" .env.local
else
  printf '\nVITE_CONVEX_URL=%s\n' "$LOCAL_URL" >> .env.local
fi
echo ">> frontend -> $LOCAL_URL (.env.local restored on exit)"
# NOTE: no `exec` here — the shell must stay alive so the EXIT/INT/TERM
# traps above can restore .env.local. (`exec` would discard the traps.)
pnpm dev "$@"
