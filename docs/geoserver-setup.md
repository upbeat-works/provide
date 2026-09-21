# GeoServer map setup

The map API uses GeoServer WCS behind the app server. GeoServer is optional: the
site and its other API routes run without it. An empty `GEOSERVER_URL` makes map
routes return `503` while other routes keep working.

## Local fixture

`geoserver/fixtures` contains four small synthetic NetCDF files: Cameroon mean
temperature change for `2020 Climate Policies` and `Low Demand`, in 2030 and
2050. Each file has a 3 by 2 grid, one missing cell, and values made only for
local checks. Regenerate the files with:

```sh
python3 -m venv /tmp/provide-geoserver-fixture-tools
/tmp/provide-geoserver-fixture-tools/bin/pip install numpy scipy
/tmp/provide-geoserver-fixture-tools/bin/python geoserver/generate-fixture.py
```

Choose another local temporary directory if needed. NumPy and SciPy are fixture
tools, not app runtime dependencies.

Compose runs no local GeoServer. Configure the API to use an existing server
through `GEOSERVER_URL` (including `/geoserver`) and `GEOSERVER_WORKSPACE`.
The fixture tools remain available for checks against a separate test server.

The publication check uses WCS 1.0 capabilities. On GeoServer 2.28.4, WCS 2.0
capabilities advertised only the first of four valid NetCDF layers, while WCS
1.0 listed all four. Raster requests still use WCS 2.0.1 and the `provide__`
coverage prefix.

For a remote read-only GeoServer, set `GEOSERVER_WORKSPACE` to its workspace and
set both `GEOSERVER_USERNAME` and `GEOSERVER_PASSWORD`. The API sends them in a
server-side Basic authentication header; browsers, download links, logs, and
errors do not receive them. Leave both credentials empty for an anonymous
server. Setting only one makes map routes return a configuration error. In a
shell-style `.env` file, wrap a password containing a double quote in single
quotes, for example `GEOSERVER_PASSWORD='a"b'`.

## Real data

This repository includes no production NetCDF files or deployment manifests.
Only the synthetic fixture is ready to publish without further data checks.

The supplied publication script is limited to Cameroon mean temperature. To
publish another indicator or geography, update and test its explicit filename
pattern, native variable, and metadata first. Prepare one NetCDF file for each
supported selection and year. Its filename without `.nc` must be the coverage ID:

```text
indicator__reference__time__spatial__50th-percentile__scenario__geography__year
```

Every text part must use the API normalisation: lower case, accents removed,
and each run of other characters changed to one hyphen. Check for duplicate
names after normalisation before publication. The default native variable is
`mean_temperature_change`; set `GEOSERVER_NATIVE_NAME` when a dataset uses a
different variable.

On a separate test server, mount the source directory read-write at
`/opt/geoserver_import`. The files must exist on that server. Replace the test
server address below before running:

```sh
GEOSERVER_IMPORT_DIR=/opt/geoserver_import GEOSERVER_NATIVE_NAME=your_variable \
  GEOSERVER_URL=https://your-test-server/geoserver geoserver/bootstrap.sh
```

The bootstrap script publishes to the `provide` workspace on the chosen server. Do not
run it against a remote read-only service; remote publication stays outside this
repository.

The current GeoServer NetCDF reader does not expose the source variable unit or
global model/source attributes in WCS `DescribeCoverage` or the returned TIFF.
Files must therefore already use the indicator's display unit. Check the source
unit, extent, cell size, missing value, and values before publication. The JSON
grid omits `unit`, `model`, and `source` when WCS cannot supply them; the browser
uses the selected ixmp4 indicator unit. No map registry or database metadata is
used.

For a deployment, set `GEOSERVER_URL` to an internal service address and
`GEOSERVER_WORKSPACE` to the published workspace, persist
the GeoServer data directory, keep its admin interface private, and mount the
real NetCDF source read-write. Production manifests live outside this repository
and must be updated before maps are enabled there.

## API contract

Availability reads capabilities once for all repeated `scenarios` query keys:

```json
{
  "scenarios": {
    "2020 Climate Policies": [2030, 2050],
    "Low Demand": [2030, 2050]
  }
}
```

The grid route fetches its coverage directly and returns longitude-major data:

```json
{
  "coordinatesOrigin": [9, 3],
  "resolution": 2,
  "resolutions": [2],
  "data": [[0.8, 1.1], [0.9, 1.2], [null, 1.3]],
  "parameters": {
    "indicator": "Mean Temperature",
    "geography": "Cameroon",
    "reference": "2011-2020 (Present Day)",
    "time": "Annual",
    "spatial": "Area",
    "scenario": "2020 Climate Policies",
    "frequency": 0.5
  },
  "formats": ["netcdf", "geotiff"],
  "year": 2030,
  "showDifference": false
}
```

Add `format=netcdf` or `format=geotiff` to stream the same WCS coverage as an
`.nc` or `.tif` attachment. Downloads accept an omitted resolution or
`resolution=native`; other values return `400` because the API does not resample
the source coverage. GeoServer needs its `netcdf-out` extension for NetCDF WCS
output. Both routes
require `instance`; only `provide-internal` has published maps. Other configured
instances have empty availability and a missing map response. Unknown instances
return `404`; missing or invalid selection fields return `400`.
