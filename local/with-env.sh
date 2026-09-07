#!/bin/sh
# Runs the given Convex CLI command against the local self-hosted backend.
# .env.local is never meaningfully touched: deployment selection comes from
# local/.env (--env-file where supported, process env otherwise), and the
# CONVEX_DEPLOYMENT line the CLI strips is re-appended on exit.
# Requires `pnpm local:up` first (provides local/.admin-key + local/.env).
set -eu
cd "$(dirname "$0")/.."
if [ ! -f local/.admin-key ] || [ ! -f local/.env ]; then
  echo "Missing local/.admin-key or local/.env. Run: pnpm local:up" >&2
  exit 1
fi
# shellcheck disable=SC1091
. ./local/env-keep.sh
keep_snapshot
trap keep_repair EXIT INT TERM HUP
export CONVEX_SELF_HOSTED_URL="${CONVEX_SELF_HOSTED_URL:-http://127.0.0.1:3210}"
export CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat local/.admin-key)"
# Empty shadows the cloud CONVEX_DEPLOYMENT from .env.local (env files never
# override existing env); the CLI treats empty as unset.
export CONVEX_DEPLOYMENT=""
export VITE_CONVEX_URL="${VITE_CONVEX_URL:-http://127.0.0.1:3210}"
"$@"
