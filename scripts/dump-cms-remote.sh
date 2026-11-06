#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CMS_PG_SERVICE:?Set CMS_PG_SERVICE to the remote PostgreSQL service name}"
output="${1:-cms/dumps/strapi-remote.dump}"
mkdir -p "$(dirname "$output")"
pg_dump --dbname="service=$CMS_PG_SERVICE" --schema=strapi --format=custom --file="$output"
printf 'Database backup: %s\n' "$output"
