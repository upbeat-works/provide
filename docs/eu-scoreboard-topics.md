# Add and update EU scoreboard topics

The **Topic** menu reads JSON files in [`api/scoreboard/`](../api/scoreboard/).
The code calls topics *sectors*: the URL uses `sector`, and
[`controller.js`](../api/scoreboard/controller.js) lists them in `SECTOR_DEFINITIONS`.
Topic settings are shared by the API and web app. They are not edited in Strapi.
Chart and regional map values come from the `sparccle-internal` ixmp4 instance;
raster maps come from GeoServer.

| File | Use as an example for |
| --- | --- |
| [`heat-stress.json`](../api/scoreboard/heat-stress.json) | Regional maps and lines with a range. |
| [`socioeconomic.json`](../api/scoreboard/socioeconomic.json) | Named bars, percentage stacks, scatter plots, regional lines and country totals. |
| [`testing.json`](../api/scoreboard/testing.json) | Simple lines, bubbles, fixed country lists and raster maps. |

To update a topic:

1. Edit its JSON file. Change map choices in `map.indicators`, chart content in
   `charts`, and filter choices in `map.scenarios` and `map.years`.
2. Copy variable and scenario names exactly from the source data. Adding a name
   here does not create data for it. Check the country, region level, scenario,
   year, model and unit that the source provides.
3. If you rename a map indicator, update `map.defaultIndicator` to match. To
   change the topic's menu label, edit its `label` in `SECTOR_DEFINITIONS`.
4. Check the config and page using the steps below. Changes to the topic `uid`,
   an indicator `name`, or a `chartId` affect saved links and chart embeds.

To add a topic:

1. Copy the closest example to `api/scoreboard/<topic-id>.json`. Use a short,
   unique ID with lowercase words separated by hyphens, such as `air-temperature`.
2. Replace the copied indicators, charts, scenarios and years with your topic's
   settings. Remove copied charts and ranking settings that do not apply.
3. Add an import in `api/scoreboard/controller.js`:

   ```js
   import airTemperature from './air-temperature.json';
   ```

4. Add an entry inside that file's `SECTOR_DEFINITIONS` array:

   ```js
   { uid: 'air-temperature', label: 'Air temperature', definition: airTemperature },
   ```

5. Test that selecting the new topic returns its own map and charts. Extend
   [`controller.test.ts`](../api/scoreboard/controller.test.ts) alongside any
   behavior change. The existing per-topic test checks each registered topic.

The file is not found automatically: both the import and array entry are needed.
The array sets menu order. Its first entry is used when `sector` is missing or
unknown. No separate page, API route or CMS topic record is needed.

A complete topic file can start with one map indicator and one chart:

```json
{
  "map": {
    "defaultIndicator": "Mean Air Temperature",
    "indicators": [
      {
        "name": "Mean Air Temperature",
        "variable": "Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile",
        "type": "choropleth",
        "level": "NUTS2"
      }
    ],
    "scenarios": [{ "id": "CurrentPolicies" }, { "id": "1.5C" }],
    "years": [2020, 2030, 2040, 2050, 2075, 2100]
  },
  "charts": [
    {
      "chartId": "mean-air-temperature",
      "title": "Mean air temperature",
      "description": "Annual mean air temperature for the selected country and scenario.",
      "chartType": "line",
      "data": {
        "variables": [
          "Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile"
        ]
      }
    }
  ]
}
```

Use valid JSON: double quotes, no comments and no trailing commas. Keep `map`
and `charts` even when one has no content. A topic with charts but no map uses
`"indicators": []` and `"defaultIndicator": null`; it still needs scenarios and
years. A topic with only a map uses `"charts": []`.

These fields control the choices:

| Field | What to enter |
| --- | --- |
| `map.defaultIndicator` | An exact indicator `name`, or `null` when there are none. An unknown or missing default falls back to the first indicator. |
| `map.indicators` | Map choices in menu order. Each `name` must be unique within the topic; it is also the URL's `indicator` value. |
| `map.scenarios` | A nonempty list of objects with exact ixmp4 scenario `id` values. The first is the default. Strapi can supply display labels; without one, the ID is shown. |
| `map.years` | A nonempty list of four-digit numbers. The default is 2050 when listed, otherwise the first year. |
| `charts` | Chart definitions in page order. Give each a unique `chartId` within the topic, plus `title`, `description`, `chartType` and `data`. |

Countries come from [`countries.ts`](../api/scoreboard/countries.ts), not the
topic file. The URL's `region` is a country name, such as `Austria`, or `all`.
An invalid country choice falls back to Austria. Changing the map indicator
does not change the topic's charts.

For a regional map, use `type: "choropleth"`, the full ixmp4 `variable` name,
and `level: "NUTS1"` or `"NUTS2"`. Source region IDs must match `NUTS_ID` in the
[packaged boundaries](../api/scoreboard/data/README.md). Country selection loads
values at that level; `region=all` reads country values by default.

An indicator can set `aggregate: "sum"` to build country totals from its NUTS
regions in the all-countries view. Use this only for values that can be added,
such as population counts or losses. Never sum temperatures, rates or
percentiles. Missing regions reduce the total; they do not make the country blank.

Optional `colorRamp` sets map colours, for example
`["#FEDB5C", "#E27B47"]`. Use at least two full six-digit hex colours. Invalid
ramps fall back to the default. This changes colours, not value limits.

For a raster map, copy the raster entry in `testing.json`. It needs `name`,
`type: "raster"`, `indicator`, `reference`, `time` and `spatial`; `unit` is an
optional display label. Those names must match GeoServer data. If its scenario
name differs from ixmp4, set `rasterName` on the scenario entry, for example
`{ "id": "CurrentPolicies", "rasterName": "Current Policies" }`. The API also
needs `GEOSERVER_URL` and any required GeoServer credentials. Raster maps need
a selected country; the all-countries view is unavailable.

`map.ranking` may contain a `variable` and increasing numeric `bins`. The
overview ranking still uses mock scores: editing these fields does not change
the displayed ranking. Check real map and chart data on the **Explore indicators**
page.

Every chart's `data.variables` lists full ixmp4 variable names. The chart type
sets how those variables are used:

| `chartType` | Fields in `data` | Time shown |
| --- | --- | --- |
| `line` | One line per variable; no role fields needed. | All available years. |
| `line_with_range` | `line`, `rangeLow`, `rangeHigh`. | All available years. |
| `stacked_bar` | Optional `stacks` to name and order segments; `bars` plus `stacks` for named bars. Without either, each variable is a segment. | Selected year. |
| `scatter` | `x`, `y`. | Selected year. |
| `bubble` | `x`, `y`, `size`. | Selected year. |

A role names an exact part between `|` separators, not the full variable or a
partial word. For example, `"line": "50th Percentile"` matches the last part
of the example variable. Each role must match one variable, and every variable
must be used. For named bars, each variable must match one bar and one stack,
and every bar/stack pair needs a variable. Keep stack segments in matching units.

Further chart settings:

| Field in `data` | Use |
| --- | --- |
| `groupBy` omitted | Read the selected country's series. With `region=all`, read a group per country. |
| `groupBy: "region"` with `regionLevel: "NUTS1"` or `"NUTS2"` | Read the selected country's regions. Supported by all five chart types. With `region=all`, read regions across countries. |
| `groupBy: "region"` with `regions` | Use a fixed list of exact source region names or IDs, regardless of the selected country. It takes precedence over `regionLevel`. |
| `groupBy: "scenario"` | Compare source scenarios at the selected place and year. Supported for bars, scatter and bubbles. The selected scenario does not filter this query. |
| `aggregate: "sum"` | With regional grouping and `regionLevel`, sum NUTS values into countries when `region=all`. Omit a fixed `regions` list for this. The same rules for valid sums and missing regions apply as for maps. |
| `model` | Limit all chart variables to one exact ixmp4 model name. Without it, no model filter is sent; overlapping rows can cause an error. |
| `unitFallback` | Label values only when the source has no unit. It neither converts nor filters values. Multiple source units cause an error. |
| `stackMode: "percent"` | Show each bar's available segments as shares of their total. Missing segments are omitted; zero totals stay blank. |
| `riskFrom` | Colour scatter or bubble points by `"x"`, `"y"` or `"size"`. Bands use the shown values' 25th and 75th percentiles, so they describe relative risk within those points. Use a role the chart has. |

For regional charts that follow the chosen country, set `regionLevel` explicitly.
`groupBy: "region"` alone uses geography links and does not select that country's
NUTS regions. Charts read default ixmp4 runs. Run versions are not set in JSON.
An optional `caseStudyId` belongs beside `chartId` and names the numeric Strapi
case-study record ID. Omit it when there is no linked study.

To check and release a change:

1. From the repository root, with dependencies installed, check that registered
   topics load and chart definitions pass the existing config checks:

   ```sh
   bun -e '
   import { SECTORS, getScoreboard } from "./api/scoreboard/controller.js";
   import { definitionGroupingError } from "./api/scoreboard/charts.ts";
   for (const { uid } of SECTORS) {
     for (const chart of getScoreboard(uid).charts) {
       const error = definitionGroupingError(chart);
       if (error) throw new Error(`${uid}/${chart.chartId}: ${error}`);
     }
   }
   console.log("Registered topic JSON and chart definitions passed.");
   '
   ```

   This checks JSON imports and chart roles/grouping. It does not prove that
   source data exists, IDs are unique, or map fields and defaults are correct.

2. With the local stack running (`bun run dev`), run the scoreboard page tests:

   ```sh
   docker compose exec web npm run test:web -- eu-scoreboard app/scoreboard
   ```

   Add tests alongside changes to selection, requests or chart behavior. Test
   what a reader can select and see, rather than just repeating labels from JSON.

3. Open
   `http://localhost:8080/impacts/eu-scoreboard/indicators?sector=<topic-id>&region=Austria`.
   Check the topic label, map choices, default scenario and year, chart order,
   titles and units. Switch country, scenario and year to choices with known
   data. Check `region=all` too, especially when using sums or fixed region lists.
4. Check one map value and one chart value against the source. In the browser's
   Network panel, map and chart requests use `/app/scoreboard/map` and
   `/app/scoreboard/charts/<chartId>`. A chart with no matching data is hidden;
   an empty page alone does not prove the config works. A 400 response can point
   to invalid choices or chart roles; a 502 needs an API log check for source
   access or conflicting rows/units. Logs omit credentials and source response bodies.
5. Commit the JSON and controller changes together, then rebuild and release
   both the API and web app. The web app bundles topic settings, and the API
   loads its own copy. A JSON-only topic edit still needs both services updated.
