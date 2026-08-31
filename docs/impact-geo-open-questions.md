# impact-geo → ixmp4 — planning & open questions

Context: `impact-geo` is the map chart on the Explore page (and the adaptation/embed
pages). It's the third and last data view to migrate off the legacy Climate Analytics
API onto the convention-driven ixmp4/Hono adapter, after `impact-time` (done) and
`unavoidable-risk` (route wired, view stubbed).

Unlike the other two, **impact-geo does not fit ixmp4's data model**, so this is a
data-sourcing decision before it is an adapter-coding task. This doc records why, the
exact frontend contract that has to be satisfied, and the options.

## The core mismatch

`impact-time` and `unavoidable-risk` are *per-region timeseries*: for one selected
region, a value per year (± percentile bands / exceedance probabilities). That is
exactly what ixmp4 stores — `(region, variable, scenario, year) → scalar` — so the
adapter just resolves the convention variable name and tabulates.

`impact-geo` is a **gridded raster**: for one region *bounding box*, a 2-D lat/lng grid
of cell values at a **single fixed year**, for a single scenario. It's the opposite
axis — space is the payload, time is collapsed to one slice.

ixmp4 has no raster concept. Its spatial axis is a **flat list of named regions**, and
the live convention's `Spatial` segment is `Area` — an area-*weighted average*, i.e. it
*collapses* space. There is no `Indicator | … | grid` variant, and encoding thousands of
lat/lng cells as ixmp4 regions per city is not practical (`tabulate` would return
per-cell timeseries, not a grid; region coverage/parity and the D1 geography table both
assume named admin regions). Nothing in `docs/data-conventions.md` or
`docs/ixmp4-data-requirements.md` addresses gridded data — it's an unaddressed gap in the
whole convention.

**Conclusion:** we cannot migrate impact-geo to ixmp4 the way impact-time was migrated.
The grid has to come from somewhere else, or the visualization changes. See options.

## What the frontend requires (the contract to satisfy)

From `ImpactGeo.svelte` + `src/lib/utils/geo.js`. Two endpoints per render:

### `impact-geo` — fetched **once per selected scenario** (array of requests)
Request params today (`URL_PATH_*`): `geography` (= geography `geoId`),
`geography-type`, `indicator`, `scenario` (singular), `scenarios` (the full list),
`year`, plus the indicator option values (time/reference/spatial/…).

Response `data` per scenario, consumed shape:
```jsonc
{
  "data": [[number|null, …], …],   // 2-D grid, rows × cols, null = no cell
  "coordinatesOrigin": [lng, lat], // bottom-left origin
  "resolution": 0.25,              // degrees per cell
  "resolutions": [0.25, 0.5, …],   // selectable download resolutions
  "model": "…", "source": "…",
  "title": "…",
  "description": "…" | { "difference": "…", "side-by-side": "…" },
  "formats": ["csv", …]
}
```
Rendering: ≤10 000 cells → `coordinatesToRectGrid` (one GeoJSON polygon per cell);
>10 000 → `coordinatesToContours` (d3-contour). `calculateDifference` subtracts two
scenario grids cell-by-cell for the "Difference" display mode.

### `geo-shape` — fetched once, by geography `uid`
Returns GeoJSON `{ data: { features: [{ properties: { uid }, geometry }] } }`; the
matching `feature` (by `properties.uid`) is the boundary polygon drawn under/around the
raster. Currently legacy; not yet in the Hono adapter. The D1 `geographies` table has a
`geoId` column (ISO3 / external id) already used for shapes and flags — a candidate home,
but the polygon geometry itself is not in D1 today.

## Sourcing options

- **A — Keep the raster on the legacy API; migrate nothing here yet.** impact-geo (and
  geo-shape) keep pointing at `VITE_DATA_API_URL`. Cheapest; lets us finish the catalog +
  impact-time + unavoidable-risk cutover while leaving the map on legacy. Cost: the
  legacy API can't be fully retired, and the map stays on the old scenario/indicator ids
  (mismatch with the convention ids the rest of Explore now uses — needs an id bridge).
- **B — New non-ixmp4 raster source.** IIASA serves the grids some other way (raster/tile
  service, COG/NetCDF, or a dedicated endpoint), and the Hono adapter proxies/reshapes it
  into the contract above. Keeps one API surface for the frontend; requires IIASA to
  stand up and populate that source.
- **C — Encode the grid as ixmp4 regions.** Region name per cell (`lat_lng`) or a
  gridded region hierarchy. Impractical (volume, `Area`-average semantics, tabulate shape,
  geography-table assumptions). Recorded for completeness; not recommended.
- **D — Redesign as a per-region choropleth.** Drop the raster; render values across a set
  of *named* sub-regions at a fixed year — the one spatial thing ixmp4 *can* feed natively
  (tabulate the indicator across regions of a type, take the `year` column). This is a
  product/visualization change (choropleth of admin regions, not a smooth raster), not a
  migration, and it can't reproduce the current within-city gridded maps.

## Frontend plumbing gaps (independent of the sourcing decision)

- `ImpactGeo.svelte` fetches via `fetchData(store, [config, …])` → `fetchMultiple`, which
  **ignores `base` and `arrayFormat`** (only `fetchSingle` honours them). To target the
  Hono adapter (option B) `fetchMultiple` must gain the same `base`/`arrayFormat` support
  impact-time relies on.
- impact-geo fans out **one request per scenario**; the adapter/route must accept a single
  `(scenario, year)` slice and the frontend keeps the array-of-configs pattern, or we add a
  multi-scenario endpoint.
- Scenario/indicator ids: impact-time now uses ixmp4 convention ids + an `instance` slug
  per indicator (from `/catalog`). Whatever serves impact-geo must speak the same ids, or a
  translation layer is needed (esp. under option A, where legacy still uses `curpol`-style
  ids).
- Geography identity: impact-geo keys on `geoId` + `geographyType` (not the catalogue
  `uid`); geo-shape keys on `uid`. Keep both mappings from the D1 `geographies` table.

## Open questions for IIASA

1. **Is gridded/raster impact data available at all in the ixmp4 world, or does it live
   elsewhere?** This single answer picks the option above.
2. If elsewhere: what format and access (tiles / COG / NetCDF / JSON grid), and who serves
   it? Same `(indicator, scenario, year, region-bbox)` addressing?
3. Is the **legacy Climate Analytics API** staying up long enough to keep serving these
   grids (option A viability + how long)?
4. **geo-shape**: move boundary GeoJSON into D1/the adapter (keyed by `geoId`/`uid`), or
   keep it on legacy? Where do the polygons come from — `scse-geojson`?
5. Does the map need to stay a **raster**, or is a named-region **choropleth** (option D)
   acceptable for some/all geography types? (City-scale within-boundary gradients are the
   hard case; country/region choropleths are the easy case.)
6. Download resolutions/formats (`resolutions`, `formats` in the response) — do these have
   a home in the new source, or are downloads out of scope for the migration?

## Recommended sequencing

impact-geo is **blocked on question 1** — it's a data/product decision, not code. Until
it's answered:
- Ship **unavoidable-risk** first (unblocked; per-region timeseries, mirrors impact-time).
- For impact-geo, the likely near-term move is **option A** (leave the map on legacy behind
  an id bridge) so the rest of Explore cuts over, then revisit B/D once IIASA confirms
  whether gridded data has an ixmp4-era home. Do the `fetchMultiple` `base`/`arrayFormat`
  extension only when a target adapter endpoint actually exists.
