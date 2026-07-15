# impact-geo on GeoServer — data and ids

## How it works

The impact-geo map is a grid of cells. ixmp4 only stores one number per country, city, or
EEZ, so the grid can't come from ixmp4. It comes from the climate models (MESMER, UrbClim,
GFDL) and goes into GeoServer. The browser loads the map as vector tiles from GeoServer and
colours them with Mapbox. The labels, units, and text still come from ixmp4 and Strapi.
Nothing runs between the browser and GeoServer.

```
        labels + options                 map tiles
Browser ───────────────────► ixmp4 catalog + Strapi
   │
   └──────────────────────────────────► GeoServer  (vector tiles)
        indicator / scenario / year / options as query params
```

The browser asks GeoServer for data using the same ids ixmp4 uses, so the ids must match on
both sides. That is the most important part of this document.

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

For the map, the parts that matter are the **Indicator** (the layer), the **scenario**, the
**year**, and the **options** (Period = reference, Temporal = time, plus frequency and
threshold where they apply).

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
  separate data (a dimension or a separate layer).

## Setting up GeoServer

Format: NetCDF or GeoTIFF, EPSG:4326, one value band, a nodata value, and the unit in the
metadata. Land and sea are global layers (land 2.5°, sea 1°); the browser asks for the area it
needs. Each city is one 100m layer (8 cities: berlin, antwerp, accra, buenos-aires, lisbon,
los-angeles, porto, singapore).

Layers: one mosaic per indicator, with a time dimension (year) and a scenario dimension. Put
options that change the data (reference, season, frequency, threshold) in separate layers with
clear names. This keeps the number of layers small. Name layers and values with the ids above.

Vector tiles: the map is drawn as vector, not images. Turn each layer into cell polygons (each
cell keeps its value) and serve them as vector tiles. One cell layer works at any zoom — big
cells look like squares, 100m cells look smooth, and vector tiles handle the size. Do not set
up server-side styling (WMS) — Mapbox colours the cells from the value. WCS is only needed if
you add downloads.

Access: the browser talks to GeoServer directly, so GeoServer must be public and allow the
frontend origin (CORS). If it can't be public, put a small proxy in front.

## What to host

31 indicators in 3 groups, across the ixmp4 scenarios, years, and places.

Land — global, 2.5°, MESMER:
`terclim-mean-temperature`, `-hot-extreme`, `-cold-extreme`, `-txx`, `-mrso-minmon`, `-fwisa`,
`-fwils`. Options: time (Annual + 4 seasons), reference (2); the four extreme indicators
(`hot-extreme`, `cold-extreme`, `txx`, `mrso-minmon`) also have frequency (3). Years: 2020,
2030, 2050, 2100, 2200, 2300 (check the exact set from the source).

Cities — 100m, UrbClim, 8 cities:
`urbclim-T2M-mean`, `-daily-mean-max/min`, `-dayover25/30/35`, `-nightover20/25/28`,
`urbclim-WBGT-daily-mean-max`, `-dayover25/28/295/31`, `-nightover28`, `-hourover25/28/295/31`,
`urbclim-WBGT-dayoverX` (with threshold 20–35), `urbclim-heatwave-days`. Options: reference
(2), plus threshold for `WBGT-dayoverX`. Years: 2030, 2050, 2070, 2090, 2100 (check).

Sea — global, 1°, GFDL:
`marclim-sst`, `marclim-ph`. Options: reference (2).

## Difference view and downloads

- The difference view subtracts two scenarios. GeoServer does the subtraction (band-math with
  WPS/jiffle): subtract the two scenario layers, then make cell polygons and tiles as usual.
- Downloads (the old resolutions and formats): serve with WCS (GeoTIFF), or skip for the first
  version.

## Checklist

1. Agree the ids — one shared table for the ixmp4 upload and GeoServer, including the indicator
   names and the frequency/threshold ids.
2. Prepare the NetCDF (EPSG:4326) from `provide-api/Datasets/`, with time and scenario
   dimensions.
3. Load the layers — nodata and unit in the metadata; land/sea global, cities 100m; apply the
   masking, unit changes, and the reference dimension.
4. Build mosaics with time and scenario dimensions, named with the ids.
5. Publish vector tiles of the cell polygons; no WMS.
6. Make GeoServer public with CORS (or a small proxy).
7. Check that the scenario/year/option set for each group matches what the selectors offer.
8. (Frontend, later) point the map at the GeoServer tiles and Mapbox colours, and delete the
   old grid code (`coordinatesToRectGrid`, `coordinatesToContours`, the geomask worker).

## Open items

1. How frequency and threshold are written as ids.
2. Boundary shapes (geo-shape) — from GeoServer, or keep in D1/legacy.
3. Downloads — WCS GeoTIFF, or skip for the first version.
