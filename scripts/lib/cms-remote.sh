# Shared helpers for talking to the remote Strapi CMS.
#
# The remote (Fly app `provide-cms`) runs SQLite on a Fly Volume and is
# scale-to-zero (suspends when idle). Everything here is READ-ONLY on the remote:
# we start the machine if needed and copy its DB file down over SSH. Source this
# file, then call `cms_fetch_db <local-path>`.
#
# Override the target via env: FLY_CMS_APP, FLY_CMS_DB_PATH.

CMS_APP="${FLY_CMS_APP:-provide-cms}"
CMS_REMOTE_DB="${FLY_CMS_DB_PATH:-/data/data.db}"

cms_require() {
  command -v "$1" >/dev/null 2>&1 || { echo "error: '$1' not found. $2" >&2; exit 1; }
}

# Start the (possibly suspended) single machine and wait until it reports
# `started`, so `fly ssh` won't fail with "no started VMs".
cms_start_machine() {
  cms_require flyctl "Install: https://fly.io/docs/flyctl/install and run 'fly auth login'."
  cms_require jq "Install jq (e.g. 'brew install jq')."

  local id state
  id="$(flyctl machine list -a "$CMS_APP" --json 2>/dev/null | jq -r '.[0].id // empty')"
  [ -n "$id" ] || { echo "error: no machine found for app '$CMS_APP'." >&2; exit 1; }

  echo "-> Starting machine $id (scale-to-zero) ..." >&2
  for _ in $(seq 1 20); do
    state="$(flyctl machine list -a "$CMS_APP" --json 2>/dev/null | jq -r '.[0].state // empty')"
    [ "$state" = "started" ] && return 0
    flyctl machine start "$id" -a "$CMS_APP" >/dev/null 2>&1 || true
    sleep 2
  done
  echo "error: machine $id did not reach 'started' (last state: ${state:-unknown})." >&2
  exit 1
}

# Copy the remote SQLite DB (+ WAL sidecars, best-effort) to $1. READ-ONLY.
# `fly ssh sftp get` refuses to overwrite, so we clear the target first.
cms_fetch_db() {
  local out="$1"
  [ -n "$out" ] || { echo "error: cms_fetch_db needs a destination path." >&2; exit 1; }
  cms_require flyctl "Install: https://fly.io/docs/flyctl/install and run 'fly auth login'."
  cms_start_machine

  mkdir -p "$(dirname "$out")"
  rm -f "$out" "$out-wal" "$out-shm"
  echo "-> Fetching $CMS_REMOTE_DB from '$CMS_APP' (read-only) ..." >&2
  flyctl ssh sftp get "$CMS_REMOTE_DB" "$out" -a "$CMS_APP"
  # Pull the WAL/SHM sidecars too when present, so a mid-write snapshot stays
  # consistent once SQLite replays them locally. Absent on a checkpointed DB.
  flyctl ssh sftp get "${CMS_REMOTE_DB}-wal" "$out-wal" -a "$CMS_APP" >/dev/null 2>&1 || true
  flyctl ssh sftp get "${CMS_REMOTE_DB}-shm" "$out-shm" -a "$CMS_APP" >/dev/null 2>&1 || true

  [ -s "$out" ] || { echo "error: fetched DB is empty." >&2; exit 1; }
  [ "$(head -c 15 "$out")" = "SQLite format 3" ] || {
    echo "error: $out is not a SQLite database." >&2; exit 1;
  }
  echo "-> Wrote $out ($(du -h "$out" | cut -f1))." >&2
}
