# impact-geo on GeoServer — data and ids

## How it works

The impact-geo map is a grid of cells. ixmp4 only stores one number per country, city, or
EEZ, so the grid can't come from ixmp4. It comes from the climate models (MESMER, UrbClim,
GFDL) and goes into GeoServer. The browser loads the map from GeoServer. The labels, units,
and text still come from ixmp4 and Strapi. Nothing runs between the browser and GeoServer.

There are two ways to serve the map. Pick one based on whether you can add PostGIS:

- **Option A — vector tiles from PostGIS, coloured in the browser.** More interactive;
  flexible colours and difference view. Needs PostGIS and a one-time step to turn the grid
  into polygons.
- **Option B — raster tiles from WMS, coloured on the server.** No PostGIS; this is the path
  GeoServer is built for. Colours and value read-outs are done on the server.

Both use the same ids, the same source NetCDF, and host the same indicators. They differ only
in how the map is drawn.

```
        labels + options                 map tiles
Browser ───────────────────► ixmp4 catalog + Strapi
   │
   └──────────────────────────────────► GeoServer  (A: vector tiles · B: WMS)
        indicator / scenario / year / options as query params
```

## Matching ids

Nothing translates ids. The browser sends the indicator, scenario, year, and options exactly
as ixmp4 gives them, straight to GeoServer. So every GeoServer layer name and value must be
the same as the ixmp4 id — same spelling, capitals, and spaces. If ixmp4 says `SSP5-3.4-OS`
and GeoServer says `ssp534-over`, the map is blank.

ixmp4 names each variable like this:

```
Indicator | Period | Temporal | Spatial | Value
e.g.  Mean Temperature | 2011-2020 (Present Day) | Annual | Area | 50th Percentile
```

A map is picked by four things: the **indicator**, the **scenario**, the **year**, and the
**options** (Period = reference, Temporal = time, plus frequency and threshold where they
apply).

**A layer is one indicator** — the indicator is the only thing that makes a separate layer.
Land and sea indicators cover the whole world; each urban indicator is stored once per city.
Scenario, year, and options select *within* a layer — as filter columns (Option A) or
dimensions (Option B) — they are not separate layers. A single map is one layer narrowed to
one scenario, one year, and one set of options.

The tables below give the id to use. If anything differs, use what the ixmp4 catalog shows.

### Scenarios

| old id | old label | id to use |
|---|---|---|
| `curpol` | Current Policies | `2020 Climate Policies` |
| `gs` | Delayed Action | `Delayed Climate Action` |
| `sp` | 1.5 - shifting pathway | `Shifting Pathway` |
| `modact` | NDCs Pathway | `2020 Climate Targets` |
| `neg` | High negative emissions | `High Negative Emissions` |
| `ren` | 1.5 - high renewables | `High Renewables` |
| `ld` | 1.5 - low demand | `Low Demand` |
| `ssp119` | SSP1-1.9 | `SSP1-1.9` |
| `ssp534-over` | SSP5-3.4-OS | `SSP5-3.4-OS` |
| `ref-1p5` | Stabilisation at 1.5°C | `Stabilisation At 1.5°C` |

Only host scenarios that exist in ixmp4. The old `-os` / `-sap` / `-nzghg` / `-extended`
variants are not included. ixmp4 has both `SSP5-3.4-OS` and `SSP5-3.4-Os` — use `SSP5-3.4-OS`.

### Options

| option | old id → id to use |
|---|---|
| reference (Period) | `present-day` → `2011-2020 (Present Day)` · `pre-industrial` → `1850-1900 (Pre-industrial)` |
| time (Temporal) | `annual` → `Annual` · `djf` → `December - February` · `mam` → `March - May` · `jja` → `June - August` · `son` → `September - November` |
| spatial | `area` → `Area` |
| frequency | `0.1` / `0.05` / `0.02` — set the id during the ixmp4 upload |
| threshold (indicator_value) | `20…35` (°C, for `WBGT-dayoverX`) — set the id during the ixmp4 upload |

### Indicators

Use the indicator name from ixmp4 as the GeoServer layer name.

| old id | old label | id to use |
|---|---|---|
| `terclim-mean-temperature` | Mean Temperature | `Mean Temperature` |
| `terclim-hot-extreme` | Hot Extreme | from ixmp4 catalog |
| `terclim-cold-extreme` | Cold Extreme | from ixmp4 catalog |
| `terclim-txx` | Maximum value of daily maximum temperature | from ixmp4 catalog |
| `terclim-mrso-minmon` | Monthly minimum of soil moisture content | from ixmp4 catalog |
| `terclim-fwisa` | Seasonal average of the Fire Weather Index | from ixmp4 catalog |
| `terclim-fwils` | Length of the fire season | from ixmp4 catalog |
| `urbclim-*` (22, listed below) | — | from ixmp4 catalog |
| `marclim-sst` | Sea Surface Temperature | from ixmp4 catalog |
| `marclim-ph` | pH | from ixmp4 catalog |

Urban indicators need the 8 cities as ixmp4 regions; maritime indicators need EEZ regions.
Maritime is shown per EEZ. The sea temperature / pH map is one global ocean layer, cut to the
EEZ area, so you don't need a separate ocean region.

## Getting the data from provide-api

Use the model NetCDF files in `provide-api/Datasets/`: `MESMER`, `MESMER-M`, `MESMER-X`
(land), `UrbClim` (cities), `GFDL` (sea). GeoServer reads NetCDF directly. Set them up as
NetCDF in EPSG:4326, with a time dimension (year) and a scenario dimension.

The old API changes three things before sending the data. Do the same, or the map will be
wrong:

- Masking: cells over sea or outside the area have no value. Set a nodata value, or the map
  shows cells outside the area.
- Units: the old API divides `terclim-mrso` by 100, and adds 273.15 to `urbclim` temperatures
  for the `absolute` reference (`provide_api.py` lines 974-983). Check if the NetCDF already
  uses display units; if not, apply the same.
- Reference: `present-day` and `pre-industrial` are different data, not computed. Keep them as
  separate data.

## Option A — vector tiles (PostGIS), coloured in the browser

Needs PostGIS. GeoServer can't turn NetCDF into vector tiles on the fly — polygonizing
millions of cells on every tile request is too slow — so do it once, up front.

- Polygonize the NetCDF into polygons that keep the cell value, with columns for scenario,
  year, and options. Land (2.5°) and sea (1°): one polygon per cell. The 100m city data is
  not small enough — quantize the values into bands and merge same-band cells first; this cuts
  the polygon count a lot and looks the same at that zoom.
- Load into PostGIS. Name the layers and the scenario/year/option values with the ids above.
- Serve vector tiles from PostGIS, with scenario/year/options as filter columns. Mapbox colours
  the cells from the value. No WMS.
- Difference view: a PostGIS query that subtracts the two scenarios' values per cell, served as
  its own layer. Computing it on every request can get slow under heavy use — benchmark it, and
  cache or precompute (a materialized view, or a built-once layer) if needed.
- Hover values come straight from the vector.

## Option B — raster tiles (WMS), coloured on the server

No PostGIS. GeoServer serves the NetCDF directly — the path it is built for.

- Load the NetCDF as a coverage / image mosaic per indicator, with a time dimension (year) and
  a scenario dimension (and dimensions for the other options).
- Serve WMS (WMTS for tile caching). The browser asks for a layer plus scenario, year, and
  options, and gets back coloured image tiles.
- Colours: write an SLD style per indicator that matches the current colour scales (the ranges
  and direction). Colour is fixed on the server, not in the browser.
- Difference view: GeoServer subtracts the two scenarios (band-math, WPS/jiffle) and renders
  the result. Same caution — benchmark under heavy use and cache/precompute if slow.
- Hover values: WMS `GetFeatureInfo` returns the value at a clicked point.

## What to host

31 indicators in 3 groups, across the ixmp4 scenarios, years, and places.

Land — global, 2.5°, MESMER:
`terclim-mean-temperature`, `-hot-extreme`, `-cold-extreme`, `-txx`, `-mrso-minmon`, `-fwisa`,
`-fwils`. Options: time (Annual + 4 seasons), reference (2); the four extreme indicators
(`hot-extreme`, `cold-extreme`, `txx`, `mrso-minmon`) also have frequency (3). Years: 2020,
2030, 2050, 2100, 2200, 2300 (check the exact set from the source).

Cities — 100m, UrbClim, 8 cities (berlin, antwerp, accra, buenos-aires, lisbon, los-angeles,
porto, singapore):
`urbclim-T2M-mean`, `-daily-mean-max/min`, `-dayover25/30/35`, `-nightover20/25/28`,
`urbclim-WBGT-daily-mean-max`, `-dayover25/28/295/31`, `-nightover28`, `-hourover25/28/295/31`,
`urbclim-WBGT-dayoverX` (with threshold 20–35), `urbclim-heatwave-days`. Options: reference
(2), plus threshold for `WBGT-dayoverX`. Years: 2030, 2050, 2070, 2090, 2100 (check).

Sea — global, 1°, GFDL:
`marclim-sst`, `marclim-ph`. Options: reference (2).

## Downloads and access (both options)

- Downloads (the old resolutions and formats): serve from the NetCDF with WCS (GeoTIFF), or
  skip for the first version.
- The browser talks to GeoServer directly, so GeoServer must be public and allow the frontend
  origin (CORS). If it can't be public, put a small proxy in front.

## Checklist

1. Agree the ids — one shared table for the ixmp4 upload and GeoServer, including the indicator
   names and the frequency/threshold ids.
2. Prepare the NetCDF (EPSG:4326) from `provide-api/Datasets/`, with time and scenario, and
   apply the masking, unit changes, and reference data.
3. Choose Option A or B:
   - A — polygonize the NetCDF into vector (banded for 100m cities), load into PostGIS, serve
     vector tiles filtered by scenario/year/options.
   - B — load the NetCDF as coverages, serve WMS/WMTS, write an SLD style per indicator.
4. Difference view — A: a PostGIS query; B: band-math. Benchmark, and cache/precompute if heavy.
5. Make GeoServer public with CORS (or a small proxy).
6. Check that the scenario/year/option set for each group matches what the selectors offer.
7. (Frontend, later) point the map at GeoServer — A: Mapbox vector source coloured from the
   value; B: WMS raster source — and delete the old grid code (`coordinatesToRectGrid`,
   `coordinatesToContours`, the geomask worker).

## Open items

1. Option A or B (whether PostGIS can be added to the stack).
2. How frequency and threshold are written as ids.
3. Boundary shapes (geo-shape) — from GeoServer, or keep in D1/legacy.
4. Downloads — WCS GeoTIFF, or skip for the first version.
