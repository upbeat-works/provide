#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CMS_PG_SERVICE:?Set CMS_PG_SERVICE to the remote PostgreSQL service name}"
: "${DB_USER:?Set DB_USER to the local PostgreSQL role}"
: "${DB_NAME:?Set DB_NAME to the local PostgreSQL database}"
mkdir -p cms/dumps
stamp="$(date +%Y%m%d-%H%M%S)"
remote="cms/dumps/remote-strapi-$stamp.dump"
backup="cms/dumps/local-strapi-$stamp.dump"
pg_dump --dbname="service=$CMS_PG_SERVICE" --schema=strapi --format=custom --file="$remote"
docker compose stop cms
pg_dump --host=localhost --port=5432 --username="$DB_USER" --dbname="$DB_NAME" --schema=strapi --format=custom --file="$backup"
pg_restore --host=localhost --port=5432 --username="$DB_USER" --dbname="$DB_NAME" --clean --if-exists --single-transaction --no-owner --no-privileges "$remote"
docker compose start cms
printf 'Local backup: %s\n' "$backup"
