# Add and update EU scoreboard topics

A topic defines the maps, charts, scenarios and years readers can choose.
Each topic is one JSON file in
[`api/scoreboard/topics/`](../api/scoreboard/topics/).

The API reads these files on each request. Once a file reaches the running API,
reload the page to see it. No code imports, restart or web rebuild are needed.

[Add a topic](#add-a-topic) · [Update a topic](#update-a-topic) ·
[Check and release](#check-and-release) · [Field reference](#field-reference) ·
[Troubleshooting](#troubleshooting)

## Add a topic

This example adds an **Air temperature** topic with a regional map and a chart
showing change over time. Start with that pair and check its values.

### 1. Copy a working example

| Example | Useful for |
| --- | --- |
| [`heat-stress.json`](../api/scoreboard/topics/heat-stress.json) | Regional maps and lines with a range. |
| [`socioeconomic.json`](../api/scoreboard/topics/socioeconomic.json) | Stacked bars, scatter plots, regional lines and country totals. |
| [`testing.json`](../api/scoreboard/topics/testing.json) | Simple lines, bubbles, fixed country lists and raster maps. |

Copy the closest example to `api/scoreboard/topics/air-temperature.json`.
The filename becomes the topic ID, selected with `?sector=air-temperature`.
The code calls topics *sectors*.

Use lowercase words or numbers separated by hyphens. Only `.json` files directly
in this directory are read; subdirectories are ignored.

### 2. Name the topic and choose its data

Set the required `label` to `Air temperature`. Optional `order` sets its menu
position: smaller numbers come first; files without an order come last. Ties
are sorted by filename. The first topic is the default. No `uid` field is needed.

Replace the copied map indicators, charts, scenarios and years with exact
source names. The source must provide these values for your chosen regions
and units. Charts and regional maps read `sparccle-internal` in ixmp4; raster
maps read GeoServer. JSON settings do not create source data.

### 3. Define the map and chart

Here is the complete file. The map shows regional values for the selected year;
the chart shows country values over time.

```json
{
  "label": "Air temperature",
  "order": 40,
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

Use double quotes, with no comments or trailing commas. Keep drafts outside the
running API's topics directory: one invalid file blocks topic loading. Then
[check and release](#check-and-release) the finished file.

## Update a topic

| Change | Edit |
| --- | --- |
| Topic name or menu position | `label` or `order`. |
| Map choices | `map.indicators`; also update `map.defaultIndicator` if you rename its indicator. |
| Scenario or year choices | `map.scenarios` or `map.years`. |
| Chart text, type or data | The matching entry in `charts`. |
| Chart order | The order of entries in `charts`. |

Changing the filename, an indicator's `name`, or a `chartId` affects saved links
and embeds. Removing a file removes its topic; keep at least one valid topic.
Follow the same checks below for additions and edits.

## Check and release

### 1. Load it in a running preview

Put the file in the preview API's `api/scoreboard/topics/` directory. Open
**Explore indicators** on your preview site:

```text
/impacts/eu-scoreboard/indicators?sector=air-temperature&region=Austria
```

Confirm that **Air temperature** appears in the Topic menu and is selected.
The API validates files on load. If loading fails, its log names the file and
problem; ask the service maintainer if you need help getting that message.

### 2. Check the displayed values

A valid file can still point to missing or conflicting source data. Check:

- The map and chart display values, with the expected titles and units.
- One map value and one chart value agree with the source.
- Country, scenario and year changes work for choices with known data.
- The all-countries view (`region=all`) gives the expected result, especially
  when using regional sums or a fixed list of regions.

Empty charts are hidden. Confirm that values appear on **Explore indicators**;
the overview ranking still uses mock scores. See [Troubleshooting](#troubleshooting)
for missing results.

### 3. Release the checked file

Deliver the checked JSON to production:

| Setup | Release step |
| --- | --- |
| Files included in the API Docker image | Build and deploy the API image with the changed files. It includes `api/scoreboard/topics/`. |
| Topics directory mounted into the API container | Replace the file in that mounted directory. The API reads it on the next request. |

A local file edit does not update production. After release, reload the page
and check the topic again. The web app needs no rebuild.

## Field reference

### Topic choices and defaults

Keep both `map` and `charts` in every file, even when one has no content.

| Field | Rule |
| --- | --- |
| `map.indicators` | Map choices in menu order, with unique `name` values used in the URL. Use `[]` for charts only. |
| `map.defaultIndicator` | An exact indicator `name`; omit to use the first, or use `null` for no indicators. Unknown names are rejected. |
| `map.scenarios` | Nonempty list of objects with unique source `id` values. The first is the default. Labels come from Strapi when available; otherwise the ID is shown. |
| `map.years` | Nonempty list of four-digit numbers. Defaults to 2050 when listed, otherwise the first year. |
| `charts` | Chart definitions in page order. Use `[]` for a topic with only a map. |

Countries come from the shared [country list](../api/scoreboard/countries.ts).
The URL's `region` is a country name, such as `Austria`, or `all`; an invalid
country choice falls back to Austria. A topic with only charts still needs
scenarios and years. Changing the map indicator does not change the charts.

### Maps

A **regional map** uses `type: "choropleth"`, the full ixmp4 `variable` name, and
`level: "NUTS1"` or `"NUTS2"`. Source region IDs must match `NUTS_ID` in the
[packaged boundaries](../api/scoreboard/data/README.md). Selecting a country
shows its regions; selecting all countries reads country values by default.

| Field on the indicator | Effect |
| --- | --- |
| `aggregate: "sum"` | Builds country totals from NUTS regions in the all-countries view. See [Totals and display settings](#totals-and-display-settings). |
| `colorRamp` | Sets map colours, for example `["#FEDB5C", "#E27B47"]`. Use at least two full six-digit hex colours. Invalid ramps use the default. Value limits stay unchanged. |

A **raster map** uses `type: "raster"` plus `name`, `indicator`, `reference`,
`time` and `spatial`. Copy the raster entry in `testing.json` and use names that
match GeoServer. Optional `unit` supplies the display label.

If GeoServer uses a different scenario name, add `rasterName` to that scenario,
for example `{ "id": "CurrentPolicies", "rasterName": "Current Policies" }`.
The API needs `GEOSERVER_URL` and any required GeoServer credentials. Raster maps
require a selected country; they do not support the all-countries view.

`map.ranking` can hold a `variable` and increasing numeric `bins`, but the
overview does not yet read them. Editing these fields will not change its scores.

### Charts

Each chart needs a unique `chartId` within the topic, plus `title`, `description`,
`chartType` and `data`. List full source names in `data.variables`.

| `chartType` | How variables are used | Time shown |
| --- | --- | --- |
| `line` | One line per variable. | All available years. |
| `line_with_range` | Assign `line`, `rangeLow` and `rangeHigh`. | All available years. |
| `stacked_bar` | Each variable is a segment. Optional `stacks` names and orders segments; add `bars` for named bars. | Selected year. |
| `scatter` | Assign `x` and `y`. | Selected year. |
| `bubble` | Assign `x`, `y` and `size`. | Selected year. |

These assignments are **roles**. Each matches one whole part of a `|`-separated
variable name. For example, `"line": "50th Percentile"` matches the final part
of the example variable. Each role must match one variable; every listed
variable must be used.

For named bars, each variable must match one bar and one stack; every bar/stack
pair needs a variable. Keep stack segments in matching units.

### Chart groups

These fields belong inside a chart's `data` object:

| Field | Effect |
| --- | --- |
| `groupBy` omitted | Reads the selected country's series. With `region=all`, reads a group per country. |
| `groupBy: "region"` with `regionLevel: "NUTS1"` or `"NUTS2"` | Reads the selected country's regions, or regions across countries when `region=all`. Works with all five chart types. |
| `groupBy: "region"` with `regions` | Uses a fixed list of exact source region names or IDs. Ignores the country choice and takes precedence over `regionLevel`. |
| `groupBy: "scenario"` | Compares source scenarios at the selected place and year. Works with bars, scatter and bubbles. The scenario filter does not limit this query. |

### Totals and display settings

These fields also belong inside the chart's `data` object:

| Field | Effect |
| --- | --- |
| `aggregate: "sum"` | With regional grouping and `regionLevel`, sums NUTS values into countries when `region=all`. Omit a fixed `regions` list. |
| `model` | Limits all chart variables to one exact ixmp4 model name. Without it, no model filter is sent; overlapping rows can cause an error. |
| `unitFallback` | Labels values only when the source has no unit. It does not convert values or resolve conflicting units. |
| `stackMode: "percent"` | Shows available segments as shares of their bar's total. Missing segments are omitted; zero totals stay blank. |
| `riskFrom` | Colours scatter or bubble points by `"x"`, `"y"` or `"size"`. Use a role the chart has. Bands use the shown values' 25th and 75th percentiles, so risk is relative to those points. |

**Sum only values that can be added**, such as population counts or losses.
Never sum temperatures, rates or percentiles. Missing regions reduce a country
total; a country with no reported values stays absent. This applies to both
map and chart sums.

For charts that follow a country's NUTS regions, set `regionLevel` explicitly.
`groupBy: "region"` alone uses geography links and does not select those regions.
Charts read default ixmp4 runs; run versions are not set in JSON.

Optional `caseStudyId` sits beside `chartId`, outside `data`, and names the numeric
Strapi case-study record ID. Omit it when there is no linked study.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Topic missing, or another topic selected | The filename sets the topic ID. Check the URL and confirm the `.json` file reached the running API's topics directory. |
| Topic settings fail to load | Check the API log for a filename and validation message. One invalid file, or an empty directory, blocks topic loading. |
| Empty map or missing chart | Check that the exact variables exist for the selected regions, scenario and year. |
| Map or chart data error | Check API logs for source access failures, duplicate rows or conflicting units. Correct the source or query settings. |
| Country totals look too small | Sums include only regions with data. Check which regions reported values for that year. |

For a service maintainer, the definition request is
`/api/scoreboard/definition?sector=<topic-id>`. Browser data requests use
`/app/scoreboard/map` and `/app/scoreboard/charts/<chartId>`. Inspect their result
bodies as well as HTTP status: a successful response can still contain a data
error or an empty result.
