#!/bin/sh
set -eu

base=${GEOSERVER_URL:-http://geoserver:8080/geoserver}
auth=${GEOSERVER_AUTH:-admin:geoserver}
import_dir=${GEOSERVER_IMPORT_DIR:-/opt/geoserver_import}
workspace=provide

if ! curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace.json"; then
  curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' \
    -d "{\"workspace\":{\"name\":\"$workspace\"}}" \
    "$base/rest/workspaces"
fi

publish_coverage() {
  file=$1
  store=$2
  coverage=$3
  source="file:$file"

  if ! curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace/coveragestores/$store.json"; then
    curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' \
      -o /dev/null \
      -d "{\"coverageStore\":{\"name\":\"$store\",\"workspace\":{\"name\":\"$workspace\"},\"type\":\"NetCDF\",\"enabled\":true,\"url\":\"$source\"}}" \
      "$base/rest/workspaces/$workspace/coveragestores"
  fi

  if ! curl -fsS -u "$auth" -o /dev/null "$base/rest/workspaces/$workspace/coveragestores/$store/coverages/$coverage.json"; then
    curl -fsS -u "$auth" -X POST -H 'Content-Type: application/json' \
      -o /dev/null \
      -d "{\"coverage\":{\"nativeName\":\"terclim-mean-temperature\",\"name\":\"$coverage\",\"title\":\"Cameroon mean temperature change\",\"srs\":\"EPSG:4326\"}}" \
      "$base/rest/workspaces/$workspace/coveragestores/$store/coverages"
  fi
}

primary=mean-temperature__2011-2020-present-day__annual__area__50th-percentile__2020-climate-policies__cameroon__2030
found=false
for file in "$import_dir"/mean-temperature__2011-2020-present-day__annual__area__50th-percentile__*__cameroon__*.nc; do
  [ -f "$file" ] || continue
  coverage=${file##*/}
  coverage=${coverage%.nc}
  store=$coverage
  # The original store name may already exist in a persistent development volume.
  if [ "$coverage" = "$primary" ]; then
    store=cameroon-mean-temperature-2030
  fi
  publish_coverage "$file" "$store" "$coverage"
  found=true
done

if [ "$found" != true ]; then
  echo 'No Cameroon mean-temperature NetCDF files found' >&2
  exit 1
fi

capabilities=$(curl -fsS "$base/provide/wcs?service=WCS&version=1.0.0&request=GetCapabilities")

for file in "$import_dir"/mean-temperature__2011-2020-present-day__annual__area__50th-percentile__*__cameroon__*.nc; do
  [ -f "$file" ] || continue
  coverage=${file##*/}
  coverage=${coverage%.nc}
  published_coverage="${workspace}:${coverage}"
  if ! printf '%s' "$capabilities" | grep -Fq ">$published_coverage<"; then
    echo "GeoServer did not advertise $published_coverage after publication" >&2
    exit 1
  fi
done
