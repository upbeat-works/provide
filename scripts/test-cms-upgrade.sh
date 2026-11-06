#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
run="provide-cms-upgrade-$$"
cleanup() {
  docker rm -f "$run-db" >/dev/null 2>&1 || true
  docker volume rm "$run-media" >/dev/null 2>&1 || true
  docker network rm "$run" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker build -f cms/tests/migration/Dockerfile -t provide-cms-upgrade-v4 .
docker build -f docker/Dockerfile.cms -t provide-cms-upgrade-v5 cms
docker network create "$run" >/dev/null
docker volume create "$run-media" >/dev/null
docker run --rm -d --name "$run-db" --network "$run" -e POSTGRES_DB=migration -e POSTGRES_PASSWORD=test-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  # PostgreSQL briefly accepts socket connections before its test database exists.
  if docker exec "$run-db" psql -h 127.0.0.1 -U postgres -d migration -c 'SELECT 1' >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 30 ]; then
    printf 'Migration test database is not ready after 30 attempts.\n' >&2
    docker logs "$run-db" >&2
    exit 1
  fi
  sleep 1
done
docker exec "$run-db" psql -h 127.0.0.1 -U postgres -d migration -c 'CREATE SCHEMA strapi' >/dev/null
options=(--rm --network "$run" -v "$run-media:/app/public/uploads"
  -e DATABASE_CLIENT=postgres -e DATABASE_HOST="$run-db" -e DATABASE_NAME=migration
  -e DATABASE_USERNAME=postgres -e DATABASE_PASSWORD=test-only -e DATABASE_SCHEMA=strapi
  -e DATABASE_SSL=false -e APP_KEYS=test-key,test-key-two -e API_TOKEN_SALT=test-token
  -e ADMIN_JWT_SECRET=test-admin -e JWT_SECRET=test-jwt -e TRANSFER_TOKEN_SALT=test-transfer
  -e ADMIN_ENCRYPTION_KEY=01234567890123456789012345678901 -e S3_BUCKET=)
docker run "${options[@]}" provide-cms-upgrade-v4
docker run "${options[@]}" provide-cms-upgrade-v5 node tests/migration/verify.cjs
