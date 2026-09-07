# Shared helpers for local:* scripts. Source it, don't execute it:
#   . "$(dirname "$0")/env-keep.sh"
#
# Background: `convex dev` (even with --env-file) deletes the
# CONVEX_DEPLOYMENT line from .env.local on startup. These helpers snapshot
# the cloud file once and re-append exactly that line after every run,
# so the cloud setup is never lost. User edits to .env.local are preserved
# (repair only appends the missing line, nothing else).
KEEP_DIR="$(dirname "$0")"
CLOUD_BACKUP="$KEEP_DIR/.env.cloud-backup"
SWAP_MARKER="$KEEP_DIR/.swapped"

# Call before running: heals a previous hard kill, captures the pristine
# cloud file on first use.
keep_snapshot() {
  if [ -f "$SWAP_MARKER" ]; then
    keep_repair
  fi
  if [ ! -f "$CLOUD_BACKUP" ]; then
    cp .env.local "$CLOUD_BACKUP"
    chmod 600 "$CLOUD_BACKUP"
  fi
  touch "$SWAP_MARKER"
}

# Call on exit (trap): re-appends CONVEX_DEPLOYMENT iff the CLI removed it.
keep_repair() {
  if ! grep -q '^CONVEX_DEPLOYMENT=' .env.local 2>/dev/null; then
    line="$(grep '^CONVEX_DEPLOYMENT=' "$CLOUD_BACKUP" 2>/dev/null || true)"
    if [ -n "$line" ]; then
      printf '%s\n' "$line" >> .env.local
    fi
  fi
  rm -f "$SWAP_MARKER"
}
