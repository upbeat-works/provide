# Scoreboard maps

This document describes the implemented map behavior. The accepted review
decisions remain in [the architecture review](architecture-review.md#eu-scoreboard-plan-review).

## Overview

The overview draws the existing 40 NUTS0 country polygons and the mock ranking.
Every polygon can open the indicators view. Ranking rows need both a score and a
country boundary, so countries without scores remain available through the map.
Country links keep the current sector and filters.

The NUTS0 boundary sets the selected country's map bounds. This is independent
of regional values, so the outline remains visible while data loads, when the
request fails, and when the selected country has no regional data. A missing or
invalid country defaults to Austria.

## Regional indicator map

Each sector JSON file has a `map` object with `indicators`, `scenarios`, and
`years`. An indicator has `name`, `type`, and, for a choropleth, `variable` and
`level`:

```json
{
  "name": "Maximum Air Temperature",
  "variable": "Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile",
  "type": "choropleth",
  "level": "NUTS2"
}
```

Heat stress and Testing offer Maximum Air Temperature and Mean Air Temperature at
NUTS2. They offer CurrentPolicies and 1.5C, and the years 2020, 2030, 2050, and
2100. The default year is 2050. Scenario config stores the ixmp4 ID. Strapi may
supply an optional localized `Label`; a missing label falls back to the ID.

`name` supplies the filter label and URL choice. `variable` holds the exact
ixmp4 variable name. The API queries it directly without adding or changing
facets. A plain variable name is also valid when it has matching regional data.

Raster indicators name the GeoServer selection fields and display unit:

```json
{
  "name": "Mean Temperature",
  "type": "raster",
  "indicator": "Mean Temperature",
  "reference": "1850-1900 (Pre-industrial)",
  "time": "Annual",
  "spatial": "Area",
  "unit": "°C"
}
```

The API builds the coverage ID from the selected scenario, country and year.
An optional `rasterName` on a configured scenario gives its GeoServer name when
the ixmp4 ID differs. Raster fields follow the convention in
[GeoServer setup](geoserver-setup.md). The API decodes the GeoTIFF and returns
the cell grid; the browser colours finite cells and leaves missing cells empty.

For choropleths, the API reads the model and unit from ixmp4. Raster units come
from map config. There is no model selector, unit conversion, or mixed model
policy.

## Data request and boundaries

`GET /api/scoreboard/map` requires `sector`, `indicator`, `region`, `scenario`,
and a four-digit `year`. `region` is the country name used by chart requests;
`indicator` is a separate map choice. Invalid configured choices return 400.

The API and browser load the same packaged NUTS1 or NUTS2 file. The unchanged
source files and their provenance are in `api/scoreboard/data/`. Only the
requested level is loaded; there are no runtime GitHub requests.
They filter features by the country's
`CNTR_CODE` and the indicator level. The API queries only the resulting
`NUTS_ID` values, then returns:

```js
{
  definition,
  status: 'ready' | 'empty',
  values: [{ region, value }],
  metadata: { variable, model, unit } | null
}
```

The browser joins each choropleth `region` to `NUTS_ID`. Raster responses carry
their origin, resolution and cell matrix. Missing regions and cells stay
unpainted, and zero is a valid value. Empty data keeps the country outline.
Failed boundary loads can be retried. Loaded data is reused through the module
cache.

Map data loads separately from charts. Old responses cannot replace a newer
indicator, country, scenario, year, or sector selection. Comparison maps use
the current indicator for both sides and share their numeric colour range.
Chart embeds do not need an indicator and do not request map data.

Socioeconomic uses fixed R9 chart groups and has no configured map indicators.
Those charts do not use an R9 boundary file.
