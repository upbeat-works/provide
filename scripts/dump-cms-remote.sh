#!/usr/bin/env bash
#
# Dump the REMOTE Strapi database (Fly app `provide-cms`) into a local .sql file.
#
# The remote CMS still runs on SQLite (a file on a Fly volume) and `main` depends
# on it, so this is strictly READ-ONLY: it copies the DB file down over SSH and
# runs `sqlite3 .dump` locally. The remote is never modified.
#
# Requires: flyctl (authenticated: `fly auth login`) and the sqlite3 CLI.
# Usage:
#   npm run db:cms:dump                 # → cms/dumps/strapi-remote.sql
#   npm run db:cms:dump -- path/to.sql  # custom output path
#
# Note: the output is a SQLite-dialect dump (a faithful snapshot/backup of the
# remote data). It is not directly loadable into Postgres as-is; to move the CMS
# content into the local `strapi` Postgres schema use Strapi's transfer/import.
set -euo pipefail

APP="${FLY_CMS_APP:-provide-cms}"
REMOTE_DB="${FLY_CMS_DB_PATH:-/data/data.db}"
OUT="${1:-cms/dumps/strapi-remote.sql}"

command -v flyctl >/dev/null 2>&1 || { echo "error: flyctl not found (see https://fly.io/docs/flyctl/install)." >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "error: sqlite3 CLI not found." >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
# `fly ssh sftp get` refuses to overwrite an existing local file, so hand it a
# fresh path inside a temp dir (not a pre-created mktemp file).
TMP_DIR="$(mktemp -d -t strapi-remote-XXXXXX)"
TMP_DB="$TMP_DIR/data.db"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "-> Fetching $REMOTE_DB from Fly app '$APP' (read-only)..."
if ! flyctl ssh sftp get "$REMOTE_DB" "$TMP_DB" -a "$APP"; then
  echo "error: failed to fetch the remote DB. Is the machine reachable? Try 'fly machine list -a $APP'." >&2
  exit 1
fi

# Sanity-check that we got a real SQLite database before dumping.
if ! sqlite3 "$TMP_DB" 'SELECT 1;' >/dev/null 2>&1; then
  echo "error: the fetched file is not a readable SQLite database." >&2
  exit 1
fi

echo "-> Dumping to $OUT ..."
sqlite3 "$TMP_DB" .dump > "$OUT"
echo "Wrote $(wc -l < "$OUT" | tr -d ' ') lines -> $OUT"
