#!/usr/bin/env bash
#
# Pull the latest remote Strapi content into the local Postgres `strapi` schema.
# One command, five stages: fetch -> export -> backup -> import -> restart+verify.
#
# Why it works this way: the remote (Fly `provide-cms`) runs SQLite; running
# `strapi export` ON that tiny machine trips its scale-to-zero suspend. So we
# copy the DB down (read-only) and run `strapi export` locally — inside the cms
# CONTAINER, because host Node breaks `better-sqlite3` (NODE_MODULE_VERSION).
# Then `strapi import --force` loads it into local Postgres. Media stays on R2
# (`--exclude files`); only the file-entry rows (their R2 URLs) transfer.
#
# Usage:
#   npm run db:cms:pull                       # full pipeline
#   SKIP_FETCH=1  npm run db:cms:pull         # reuse existing cms/dumps/data-remote.db
#   SKIP_BACKUP=1 npm run db:cms:pull         # don't pg_dump the local strapi schema first
#   SKIP_IMPORT=1 npm run db:cms:pull         # build the tarball but don't touch local data
#   SKIP_VERIFY=1 npm run db:cms:pull         # don't restart cms / print counts
#   KEEP_ASSETS=1 npm run db:cms:pull         # bundle R2 media into the tarball (large, slow)
#
# Requires: flyctl (authed) + jq for fetch, docker (compose stack up) for export/import,
# pg_dump for the safety backup, psql for verify. Postgres defaults: DB_USER/DB_NAME.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/cms-remote.sh
source "$ROOT/scripts/lib/cms-remote.sh"

DUMPS_DIR="cms/dumps"
RAW_DB="$ROOT/$DUMPS_DIR/data-remote.db"
TARBALL="$ROOT/$DUMPS_DIR/strapi-transfer.tar.gz"
DB_USER="${DB_USER:-rodrigo}"
DB_NAME="${DB_NAME:-provide}"
EXCLUDE="--exclude files"; [ -z "${KEEP_ASSETS:-}" ] || EXCLUDE=""

cms_require docker "Install Docker Desktop and run 'docker compose up'."

# 1. Fetch the remote SQLite DB (read-only).
if [ -z "${SKIP_FETCH:-}" ]; then
  echo "== [1/5] Fetch remote database =="
  cms_fetch_db "$RAW_DB"
else
  echo "== [1/5] Fetch skipped (reusing $RAW_DB) =="
  [ -s "$RAW_DB" ] || { echo "error: $RAW_DB missing — unset SKIP_FETCH." >&2; exit 1; }
fi

# 2. Export a transfer archive from that DB, inside the cms container (Node 20 +
#    prebuilt native deps). DATABASE_FILENAME resolves under /app (== cms/) which
#    is where ./cms/dumps is mounted, so the tarball lands back on the host.
echo "== [2/5] Export transfer archive =="
rm -f "$TARBALL"
# shellcheck disable=SC2086
docker compose run --rm \
  -e DATABASE_CLIENT=sqlite \
  -e DATABASE_FILENAME="dumps/$(basename "$RAW_DB")" \
  cms yarn strapi export --no-encrypt $EXCLUDE --file dumps/strapi-transfer
[ -s "$TARBALL" ] || { echo "error: export did not produce $TARBALL." >&2; exit 1; }
echo "-> $TARBALL ($(du -h "$TARBALL" | cut -f1))"

# 3. Back up the local strapi schema before the destructive --force import.
if [ -z "${SKIP_IMPORT:-}" ] && [ -z "${SKIP_BACKUP:-}" ] && command -v pg_dump >/dev/null 2>&1; then
  echo "== [3/5] Back up local strapi schema =="
  BK="$ROOT/$DUMPS_DIR/local-strapi-backup-$(date +%Y%m%d-%H%M%S).sql"
  pg_dump -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -n strapi -f "$BK"
  echo "-> $BK"
else
  echo "== [3/5] Backup skipped =="
fi

# 4. Import into local Postgres. --force replaces the strapi schema content.
if [ -z "${SKIP_IMPORT:-}" ]; then
  echo "== [4/5] Import into local Postgres (--force) =="
  docker compose run --rm cms yarn strapi import --file dumps/strapi-transfer.tar.gz --force
else
  echo "== [4/5] Import skipped (tarball ready at $TARBALL) =="
fi

# 5. Restart the running cms (it cached the old tables) and show row counts.
if [ -z "${SKIP_IMPORT:-}" ] && [ -z "${SKIP_VERIFY:-}" ]; then
  echo "== [5/5] Restart cms + verify =="
  docker compose restart cms >/dev/null
  if command -v psql >/dev/null 2>&1; then
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -At -c "
      select 'indicators='  || count(*) from strapi.indicators
      union all select 'scenarios='   || count(*) from strapi.scenarios
      union all select 'glossaries='  || count(*) from strapi.glossaries
      union all select 'files='       || count(*) from strapi.files
      union all select 'case_studies='|| count(*) from strapi.case_study_dynamics;"
  fi
else
  echo "== [5/5] Verify skipped =="
fi

echo "Done. Local CMS admin: http://cms.localhost:8080/admin (or http://localhost:1337/admin)."
