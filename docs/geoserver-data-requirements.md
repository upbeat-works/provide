# impact-geo on GeoServer — data & id hand-off

> **Audience:** the team standing up GeoServer and uploading data. It specifies *what* raster
> data to host, *in what shape*, and *under which ids*, so the frontend renders the map by
> talking to GeoServer directly.

## 0. Architecture

impact-geo is a **gridded raster** (a value per lat/lng cell). ixmp4 stores only **per-region
scalars** (one number per country/city/EEZ), so the rasters do not live in ixmp4 — they are
climate-model outputs (MESMER, UrbClim, GFDL) and belong in **GeoServer**. The browser adds
GeoServer's **vector tiles (MVT)** as a Mapbox source and colours them client-side with a
data-driven `fill-color` expression. The rest of the chart (indicator label, description,
unit, model/source text) comes from the **ixmp4 `/catalog` + Strapi** already used across
Explore. No adapter sits between the browser and GeoServer.

```
        selectors + metadata            raster tiles
Browser ───────────────────► ixmp4 /catalog + Strapi
   │
   └──────────────────────────────────► GeoServer  (MVT vector tiles)
        indicator/scenario/year/facets as query params
```

The browser addresses GeoServer with the **same ids ixmp4 exposes**, so §1 is the crux: the
id vocabulary must be identical on both sides.

## 1. The id convention

### 1.1 Why it matters
There is no translation layer. The frontend takes the user's selection — indicator, scenario,
year, facet values — as the id strings from ixmp4 `/catalog` and puts them straight into the
GeoServer request. **Every GeoServer layer name and dimension value must equal the ixmp4
convention id character-for-character** (spaces, capitalisation and punctuation included). If
ixmp4 says `SSP5-3.4-OS` and GeoServer's `scenario` dimension says `ssp534-over`, the map is
blank.

### 1.2 The scheme
ixmp4 encodes an indicator's data in a pipe-delimited variable name:

```
Indicator | Period | Temporal | Spatial | Value
   e.g.  Mean Temperature | 2011-2020 (Present Day) | Annual | Area | 50th Percentile
```

For impact-geo the pieces that address a raster are **Indicator** (the layer), **scenario**,
**year**, and the **facets** (`Period`→reference, `Temporal`→time, plus `frequency` /
`indicator_value` where they apply).

The tables in §1.3–1.5 are the id vocabulary, derived from the legacy catalogue. The ixmp4
upload and the GeoServer configuration must use the **same strings** — the "convention id"
column — with the ixmp4 `/catalog` authoritative if anything differs.

### 1.3 Scenario ids
GeoServer `scenario` dimension value = the convention id.

| legacy uid | legacy label | convention id |
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

Host a scenario only if it exists in the ixmp4 catalogue; the `-os` / `-sap` / `-nzghg` /
`-extended` legacy variants are not part of it. ixmp4 contains a `SSP5-3.4-OS` / `SSP5-3.4-Os`
case-duplicate — use the single casing `SSP5-3.4-OS` in GeoServer.

### 1.4 Facet ids
GeoServer dimension values must be the convention id strings.

| facet | legacy uid → convention id |
|---|---|
| **reference** (`Period`) | `present-day` → `2011-2020 (Present Day)` · `pre-industrial` → `1850-1900 (Pre-industrial)` |
| **time** (`Temporal`) | `annual` → `Annual` · `djf` → `December - February` · `mam` → `March - May` · `jja` → `June - August` · `son` → `September - November` |
| **spatial** (`Spatial`) | `area` → `Area` |
| **frequency** | `0.1` / `0.05` / `0.02` (return period) — convention encoding pinned during the ixmp4 upload |
| **indicator_value** | `20…35` (°C threshold for `WBGT-dayoverX`) — convention encoding pinned during the ixmp4 upload |

### 1.5 Indicator ids
The convention id is the indicator name ixmp4 uses (the first segment of the variable name);
use the same string as the GeoServer layer. Take each from the ixmp4 catalogue.

| legacy uid | legacy label | convention id |
|---|---|---|
| `terclim-mean-temperature` | Mean Temperature | `Mean Temperature` |
| `terclim-hot-extreme` | Hot Extreme | from ixmp4 catalogue |
| `terclim-cold-extreme` | Cold Extreme | from ixmp4 catalogue |
| `terclim-txx` | Maximum value of daily maximum temperature | from ixmp4 catalogue |
| `terclim-mrso-minmon` | Monthly minimum of soil moisture content | from ixmp4 catalogue |
| `terclim-fwisa` | Seasonal average of the Fire Weather Index | from ixmp4 catalogue |
| `terclim-fwils` | Length of the fire season | from ixmp4 catalogue |
| `urbclim-*` (22, see §4) | — | from ixmp4 catalogue |
| `marclim-sst` | Sea Surface Temperature | from ixmp4 catalogue |
| `marclim-ph` | pH | from ixmp4 catalogue |

**Region types.** Urban indicators require the **8 cities** as ixmp4 regions; maritime require
**EEZ** regions. Maritime is EEZ-scoped (a country's coastal SST/pH); the SST/pH raster in
GeoServer is a global ocean field sliced to the EEZ bbox, so no separate ocean region is
needed to host it.

## 2. Source data (legacy `provide-api`)

Source the rasters from the **model NetCDF** under `provide-api/Datasets/`: `MESMER`,
`MESMER-M`, `MESMER-X` (terrestrial), `UrbClim` (urban), `GFDL` (maritime). These are the
lossless model outputs, and GeoServer ingests CF-NetCDF natively. Organise/reproject them to
**CF-compliant NetCDF, EPSG:4326**, with a `time` dimension (year) and a custom `scenario`
dimension.

The legacy API applies three things at serve time; bake them into what GeoServer serves, or
values/placement will be wrong:

- **Masking** — cells over sea / outside the region are "no data"; set an explicit GeoServer
  **nodata** value, or a bbox slice leaks cells outside the region.
- **Unit representation** — the legacy endpoint rescales some indicators on the way out
  (`terclim-mrso*` ÷ 100; `urbclim` temperatures `+273.15` for the `absolute` reference —
  `provide_api.py:974-983`). Confirm whether the NetCDF already holds display units or needs
  the same rescale, and bake it in.
- **Reference is different data** — `present-day` and `pre-industrial` are separate value
  sets; they must be a NetCDF dimension / separate coverage, not computed on the fly.

## 3. Hosting in GeoServer

### 3.1 Coverage format
- **CF-NetCDF or Cloud-Optimized GeoTIFF**, **EPSG:4326**, one band = the indicator value,
  explicit **nodata**, and the **unit** in metadata.
- **Two families:**
  - **Global** — terrestrial (**2.5°**) + maritime (**1°**): host the global field once; the
    frontend requests a bbox for the selected region.
  - **Per-city** — urban (**100m**), one coverage per city (8: berlin, antwerp, accra,
    buenos-aires, lisbon, los-angeles, porto, singapore).

### 3.2 Layer organisation — mosaic with dimensions
Publish **one ImageMosaic per `(indicator + partitioning facets)`**, exposing a **`TIME`**
(year) and a **custom `scenario`** dimension (both ImageMosaic and NetCDF support custom
dimensions). Facets that change the physics (reference, season, frequency, threshold) are
cleanest as separate mosaics encoded in the layer name; this avoids one-layer-per-combination
blow-up. Layer names and dimension values use the §1 convention ids.

### 3.3 Vectorization → MVT
The frontend renders **vector**, not images. Turn each coverage into vector and serve **MVT
vector tiles**:

- Polygonize the raster to **cell polygons** (`ras:PolygonExtraction`, or an equivalent
  grid→polygon step) carrying the cell **value** as an attribute, and publish as a
  **vector-tile layer**.
- One cell-polygon layer works at every resolution: coarse (2.5°) reads as blocky squares,
  100m reads as a smooth gradient (cells are sub-pixel). MVT tiling + per-zoom simplification
  handles the density; no separate contour path is needed. Sanity-check tile weight on the
  densest city, and lightly quantize values if needed.
- **Do not** configure WMS/SLD server-side styling — colour is applied in Mapbox from the
  value attribute.
- **WCS** is needed only if downloads are in scope (§5).

### 3.4 CORS / reachability
The browser hits GeoServer directly, so GeoServer must be **publicly reachable and
CORS-enabled** for the frontend origin. If it cannot be public, front it with a **thin
reverse-proxy** (no logic).

## 4. What to host — the matrix

**31 indicators, 3 sectors**, × the catalogue scenarios (§1.3) × years × geographies.

### Terrestrial climate — global, **2.5°**, MESMER
`terclim-mean-temperature`, `-hot-extreme`, `-cold-extreme`, `-txx`, `-mrso-minmon`,
`-fwisa`, `-fwils`.
Facets: **time** (`Annual` + 4 seasons) × **reference** (2) × **spatial** (`Area`); the four
extreme indicators (`hot-extreme`, `cold-extreme`, `txx`, `mrso-minmon`) also × **frequency** (3).
Years: 2020, 2030, 2050, 2100, 2200, 2300 (confirm the exact set from the source).

### Urban climate — per-city, **100m**, UrbClim (8 cities)
22 indicators (WBGT/T2M families): `urbclim-T2M-mean`, `-daily-mean-max/min`,
`-dayover25/30/35`, `-nightover20/25/28`; `urbclim-WBGT-daily-mean-max`, `-dayover25/28/295/31`,
`-nightover28`, `-hourover25/28/295/31`; `urbclim-WBGT-dayoverX` (× **indicator_value** 20–35);
`urbclim-heatwave-days`.
Facets: **reference** (2) (+ **indicator_value** for `WBGT-dayoverX`).
Years: 2030, 2050, 2070, 2090, 2100 (confirm the exact set from the source).

### Maritime climate — global, **1°**, GFDL
`marclim-sst`, `marclim-ph`. Facets: **reference** (2).

## 5. Difference mode, downloads

- **Difference display** subtracts two scenarios cell-by-cell. GeoServer computes it with
  **band-math** (WPS / `jiffle`): subtract the two scenario coverages into a difference
  coverage, then polygonize + tile it exactly like the single-scenario path, exposed as a
  vector-tile layer parameterised by the two scenarios.
- **Downloads** (the legacy `resolutions` + `formats`) are served via **WCS** (GeoTIFF), or
  out of scope for v1.

## 6. Checklist

1. **Fix the id vocabulary** (§1) — one table shared by the ixmp4 upload and GeoServer,
   including the indicator convention names and the `frequency` / `indicator_value` encoding.
2. **Prepare the source** — CF-NetCDF (EPSG:4326) from `provide-api/Datasets/`, with `time`
   and `scenario` dimensions.
3. **Load coverages** — nodata + unit metadata; global (2.5° / 1°) + per-city (100m); carry
   over masking, unit rescales, and the reference dimension (§2).
4. **Build mosaics** with `TIME` + `scenario` dimensions, named with the convention ids (§3.2).
5. **Publish MVT vector-tile layers** of the polygonized cells; no WMS.
6. **Expose publicly + CORS** for the frontend origin (or a thin proxy).
7. **Confirm coverage** — the `(scenario × year × facet)` set per sector matches what the
   selectors can request.
8. *(Frontend, separate track)* swap the map to the GeoServer MVT source + Mapbox
   `fill-color`, and delete `coordinatesToRectGrid` / `coordinatesToContours` / the geomask
   worker.

## 7. Open items

1. `frequency` / `indicator_value` encoding in the convention.
2. **geo-shape** boundaries — served from GeoServer (WFS), or kept in D1 / legacy.
3. **Downloads** — WCS GeoTIFF, or out of scope for v1.
