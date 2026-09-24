# Chart config decisions

Each sector JSON file has a `charts` array. Sector stays outside each chart
definition. The chart config is reusable across sectors and does not name
rendering components.

A chart has `chartId`, `title`, `description`, `chartType`, optional
`caseStudyId`, and `data`. `caseStudyId` is the CMS record ID for a linked case
study. Omit it when there is no linked study.

Every chart lists full ixmp4 names in `data.variables`. The loader queries
those names unchanged. Model names and units come from ixmp4;
`data.unitFallback` supplies a display unit only when the source has none.
It does not filter or convert values. A variable with more than one source
unit is rejected. Resolved references and units are returned in `series`,
separate from the unchanged `definition`.

| `chartType` | Fields that assign variables |
| --- | --- |
| `line` | None: each variable draws a line, in list order. |
| `line_with_range` | `line`, `rangeLow`, `rangeHigh` |
| `stacked_bar` | `bars` and `stacks` for named bars; `stacks` alone for regional bars. Without either, each variable is a stack segment. |
| `scatter` | `x`, `y` |
| `bubble` | `x`, `y`, `size` |

Role names match exact `|`-separated subsegments, at any position. A role must
match one variable; missing or unclear matches are errors. Every listed
variable must be used. Role names also label axes and stacks. Plain lines
and unnamed stacks derive labels from the variable names.

A range chart has one central line and two bounds. A scatter or bubble chart
has one set of coordinates per region or scenario. Stacked bars use direct
segment values; segments must be separate parts with matching units.
Stacked bars, bubbles and scatter plots use the selected year. Lines and
ranges show all available years.

`data.groupBy` has these possible values. A region-grouped chart may also set
`data.regions` to an explicit array of region IDs:

| Value | Meaning |
| --- | --- |
| omitted | Resolve the series for the selected region itself. |
| `"region"` | Resolve one mark per configured `data.regions` entry. Without that list, resolve known regions within the selected area. Supported for `stacked_bar`, `bubble` and `scatter`. |
| `"scenario"` | Resolve one mark per matching scenario at the selected region and year. Supported for `stacked_bar`, `bubble` and `scatter`. |

No other value is valid. Grouping by model or year is not supported. Multiple
matching rows for one scenario and region are rejected; the loader does not
choose a model. An explicit region list is fixed and does not
follow the selected country. Without that list, region membership comes from
known geography links. The controller must not infer it from name prefixes or
mix an area total with its child regions.

Grouped results use `data: [{ "region": { "uid", "label" }, "series": [...] }]`.
Scenario-grouped results replace `region` with
`"scenario": { "uid", "label" }`. The selected scenario does not filter a
scenario-grouped chart. Ungrouped results keep the resolved role array. A grouped
point is excluded when a required coordinate is missing. Bars omit missing
segments and keep available values unchanged. A group with no matching data
is empty. Empty charts are omitted from the page, including their title,
description, frame and spacing.

The EU scoreboard fixes the instance to `sparccle-internal`; controls supply the
country, scenario and year. The map indicator is a separate choice and does not
change chart config. The shared query layer selects default runs. Run version
selection stays outside this config. No unit conversion or silent model
selection is added.

## Named bars and stacks

A stacked chart for the selected region can list full variables and name the
bar and stack subsegments:

```json
{
  "variables": [
    "Population|Female|Age 0-14",
    "Population|Male|Age 0-14",
    "Population|Female|Age 15-24",
    "Population|Male|Age 15-24"
  ],
  "unitFallback": "people",
  "bars": ["Age 0-14", "Age 15-24"],
  "stacks": ["Female", "Male"]
}
```

These are the chart's `data` fields. Each name is both a displayed label and an
exact `|`-separated subsegment. Position and variable length do not matter. The
loader queries the listed variable names unchanged. The arrays set bar and stack
order, independently of variable order. Each variable must match one bar and
one stack; each pair must have one variable. This form has no `groupBy` or
`series` list in the authored config. The response supplies a separate `series` list
with source units for rendering.

For named bars, missing segments are omitted while the other
segments remain visible. Bar order and stack colours stay fixed. A bar with no
available segments keeps its label and empty space. A chart with no data is
still hidden.

## Regional values

Values and units come from ixmp4. By default, the chart displays them unchanged.
Set `data.stackMode: "percent"` to show each available segment as a share of its
bar’s available total. Those shares add up to 100%, even if a segment is missing.
Missing segments are omitted; bars with a zero total stay blank. Source units
remain in the data details, while the chart displays `%`.

For regional charts, `data.regionLevel` selects NUTS1 or NUTS2 regions within
the chosen country using the map boundary data. The country sets the query
scope; returned regional values remain separate.

Scatter plots use equal-size points and need no size variable.

## Map defaults and ranking

`map.defaultIndicator` names an entry in `map.indicators`. It is used when
the URL has no indicator or names an unknown one. Without a matching default,
the first indicator is used.
Use `null` when the sector has no map indicators.

`map.ranking` names the variable used to rank countries and the upper limits
of its colour bands:

```json
{
  "defaultIndicator": "High Heat Risk",
  "ranking": {
    "variable": "High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile",
    "bins": [2, 6, 23]
  }
}
```

Bins are increasing numeric upper limits, included in their band. Three limits
define four bands: ≤2, >2–6, >6–23, and >23. Values are not rounded before being
placed in a band. Bins hold no unit; the variable's data supplies it. The ranking
variable is independent of the selected map indicator.

Testing uses maximum air temperature with provisional limits of 25, 30 and 35.
Socioeconomic uses `Population|Age 65+` as its default map and ranking variable.
Its limits of 1, 5 and 10 need review against the indicator's units and data.
These limits are examples, not validated risk bands.

The ranking view currently uses mock scores; it does not yet read `map.ranking`.

## Examples

These are `data` objects. All chart types share the same variable list.

A line chart:

```json
{
  "variables": ["Temperature|Mean"]
}
```

A line with a range:

```json
{
  "variables": ["Temperature|Mean", "Temperature|Low", "Temperature|High"],
  "line": "Mean",
  "rangeLow": "Low",
  "rangeHigh": "High"
}
```

Regional bars, with stack order set independently of variable order:

```json
{
  "variables": ["Population|Young", "Population|Old"],
  "groupBy": "region",
  "regionLevel": "NUTS2",
  "stacks": ["Old", "Young"]
}
```

A scatter chart:

```json
{
  "variables": [
    "Population|Age 25-44|Educational Attainment Low",
    "Population|Age 25-44|Educational Attainment High"
  ],
  "unitFallback": "people",
  "groupBy": "region",
  "regionLevel": "NUTS2",
  "x": "Educational Attainment Low",
  "y": "Educational Attainment High"
}
```

A bubble chart:

```json
{
  "variables": ["Temperature|Mean", "Temperature|Maximum", "Population|Exposed"],
  "groupBy": "region",
  "regions": ["Austria", "Germany", "France"],
  "x": "Mean",
  "y": "Maximum",
  "size": "Exposed"
}
```

## Socioeconomic charts

`api/scoreboard/socioeconomic.json` defines:

- Population by age and sex: five age-group bars, each split into female and
  male population for the selected region. It reads those values directly,
  without NUTS grouping or a country-total calculation.
- Age distribution by region: one percentage stack per NUTS2 region, split into
  ages 0–14, 15–24, 25–44, 45–64 and 65+.
- Educational attainment, ages 25–44: one point per NUTS2 region, with low
  attainment on X and high attainment on Y.

Each chart follows the selected country, scenario and year. Models and units come from ixmp4,
with `people` as the fallback. On 23 September 2026, live default-run queries
for all five `Population|Age …` variables returned unit `million` for AT11, AT12
and AT13 under SSP1 in 2050. For example, `Population|Age 65+` returned
0.570025 for AT13. These variables supply counts, not percentages, so the regional age chart uses
`stackMode: "percent"`. This check
does not cover other scenarios, years or chart variables.

The map uses `Population|Age 65+` at NUTS2 level. Scenario choices are SSP1–SSP5,
with SSP1 as the default. Years are 2020, 2030, 2040, 2050, 2075 and 2100.
