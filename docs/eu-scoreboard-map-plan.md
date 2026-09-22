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
`years`. An indicator has `name`, `type`, and, for a choropleth, `level`:

```json
{
  "name": "Maximum Air Temperature",
  "type": "choropleth",
  "level": "NUTS2"
}
```

Both current sectors offer Maximum Air Temperature and Mean Air Temperature at
NUTS2. They offer CurrentPolicies and 1.5C, and the years 2020, 2030, 2050, and
2100. The default year is 2050. Scenario config stores the ixmp4 ID. Strapi may
supply an optional localized `Label`; a missing label falls back to the ID.

`raster` is reserved as an indicator type. Raster loading and drawing are
deferred. There is no variable, model, unit, title, or indicator ID in map
config. For a choropleth, the API builds this ixmp4 variable name:

```text
<indicator name>|Absolute Values (No Change)|Annual|Area|50th Percentile
```

The API reads the model and unit from ixmp4. The data is assumed to use one
model for each variable. There is no model selector, unit conversion, or mixed
model policy.

## Data request and boundaries

`GET /api/scoreboard/map` requires `sector`, `indicator`, `region`, `scenario`,
and a four-digit `year`. `region` is the country name used by chart requests;
`indicator` is a separate map choice. Invalid configured choices return 400.

The API and browser load the same maintained NUTS1 or NUTS2 file pinned to a
specific `scse-geojson` commit. They filter features by the country's
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

The browser joins each returned `region` to `NUTS_ID`. Missing regions stay
unpainted, and zero is a valid value. Empty data keeps the country outline.
Failed boundary loads can be retried; only successful boundary files are cached.

Map data loads separately from charts. Old responses cannot replace a newer
indicator, country, scenario, year, or sector selection. Comparison maps use
the current indicator for both sides and share their numeric colour range.
Chart embeds do not need an indicator and do not request map data.

The earlier static R9 map was removed. R9 names remain in Testing's fixed chart
groups; those charts do not use an R9 boundary file.
