#!/usr/bin/env bash
#
# Dump the REMOTE Strapi database (Fly app `provide-cms`) to a local .sql file —
# a faithful, human-readable SQLite snapshot for backup/inspection. READ-ONLY on
# the remote (copies the DB down over SSH; the remote is never modified).
#
# This is a BACKUP, not the reimport pipeline: a SQLite-dialect .sql does not load
# into Postgres as-is. To pull remote content INTO the local Postgres `strapi`
# schema, use `npm run db:cms:pull` instead.
#
# Requires: flyctl (authed), jq, and the sqlite3 CLI.
# Usage:
#   npm run db:cms:dump                 # -> cms/dumps/strapi-remote.sql
#   npm run db:cms:dump -- path/to.sql  # custom output path
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/cms-remote.sh
source "$ROOT/scripts/lib/cms-remote.sh"

cms_require sqlite3 "Install the sqlite3 CLI."

RAW_DB="$ROOT/cms/dumps/data-remote.db"
OUT="${1:-$ROOT/cms/dumps/strapi-remote.sql}"

# Reuse the shared read-only fetch; leaves cms/dumps/data-remote.db in place
# (the same file `db:cms:pull` exports from).
cms_fetch_db "$RAW_DB"

mkdir -p "$(dirname "$OUT")"
echo "-> Dumping to $OUT ..."
sqlite3 "$RAW_DB" .dump > "$OUT"
echo "Wrote $(wc -l < "$OUT" | tr -d ' ') lines -> $OUT"
