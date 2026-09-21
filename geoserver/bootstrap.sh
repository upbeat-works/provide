#!/bin/sh
set -eu

base=${GEOSERVER_URL:-http://geoserver:8080/geoserver}
auth=${GEOSERVER_AUTH:-admin:geoserver}
import_dir=${GEOSERVER_IMPORT_DIR:-/opt/geoserver_import}
workspace=provide
native_name=${GEOSERVER_NATIVE_NAME:-mean_temperature_change}
pattern="$import_dir/mean-temperature__2011-2020-present-day__annual__area__50th-percentile__*__cameroon__????.nc"

found=false
for file in $pattern; do
  [ -f "$file" ] || continue
  found=true
  coverage=${file##*/}
  coverage=${coverage%.nc}
  if ! printf '%s\n' "$coverage" | grep -Eq '^mean-temperature__2011-2020-present-day__annual__area__50th-percentile__[a-z0-9]+(-[a-z0-9]+)*__cameroon__[0-9]{4}$'; then
    echo "Invalid coverage filename: $coverage.nc" >&2
    exit 1
  fi
done

[ "$found" = true ] || { echo 'No matching NetCDF files found' >&2; exit 1; }

curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace.json" || \
  curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' \
    -d "{\"workspace\":{\"name\":\"$workspace\"}}" "$base/rest/workspaces"

for file in $pattern; do
  [ -f "$file" ] || continue
  coverage=${file##*/}
  coverage=${coverage%.nc}
  store=$coverage
  source="file:$file"

  curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace/coveragestores/$store.json" || \
    curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' -o /dev/null \
      -d "{\"coverageStore\":{\"name\":\"$store\",\"workspace\":{\"name\":\"$workspace\"},\"type\":\"NetCDF\",\"enabled\":true,\"url\":\"$source\"}}" \
      "$base/rest/workspaces/$workspace/coveragestores"

  curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace/coveragestores/$store/coverages/$coverage.json" || \
    curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' -o /dev/null \
      -d "{\"coverage\":{\"nativeName\":\"$native_name\",\"name\":\"$coverage\",\"title\":\"Cameroon mean temperature change\",\"srs\":\"EPSG:4326\"}}" \
      "$base/rest/workspaces/$workspace/coveragestores/$store/coverages"
done

capabilities=$(curl -fsS -u "$auth" "$base/provide/wcs?service=WCS&version=1.0.0&request=GetCapabilities")
for file in $pattern; do
  coverage=${file##*/}
  coverage=${coverage%.nc}
  printf '%s' "$capabilities" | grep -Fq ">provide:${coverage}<" || {
    echo "GeoServer did not advertise provide:${coverage}" >&2
    exit 1
  }
done
