# EU scoreboard chart reference

Use this reference when editing an entry in a topic's `charts` array.
For the file location, topic and map settings, preview checks and release steps,
start with [Add and update EU scoreboard topics](eu-scoreboard-topics.md).

[Chart fields](#chart-fields) · [Chart types](#choose-a-chart-type) ·
[Variables and units](#variables-models-and-units) · [Grouping](#grouping) ·
[Country totals](#country-totals) · [Examples](#examples) · [Risk colours](#risk-colours)

## Chart fields

A chart belongs inside `charts` in a file under
[`api/scoreboard/topics/`](../api/scoreboard/topics/). It does not need its own
topic ID or a rendering component name.

| Field | Purpose |
| --- | --- |
| `chartId` | Unique ID within the topic, used in requests and embeds. Changing it affects saved links. |
| `title` | Chart heading. |
| `description` | Text explaining what the reader sees. |
| `chartType` | One of the types below. |
| `data` | Source variables and the settings that assign, group and display them. |
| `caseStudyId` | Optional numeric Strapi case-study record ID. Omit when there is no linked study. |

A complete chart definition:

```json
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
```

## Choose a chart type

| `chartType` | Use it to show | Fields that assign variables | Time shown |
| --- | --- | --- | --- |
| `line` | Change over time. | Each variable draws a line, in list order. | All available years. |
| `line_with_range` | A central line and two bounds. | `line`, `rangeLow`, `rangeHigh`. | All available years. |
| `stacked_bar` | Separate parts of a total. | Optional `stacks`; add `bars` for named bars. Without either, each variable is a segment. | Selected year. |
| `scatter` | Two values per place or scenario. | `x`, `y`. Points have equal size. | Selected year. |
| `bubble` | Two values, with a third shown by size. | `x`, `y`, `size`. | Selected year. |
| `box_plot` | A median and a range. | `median`, `boxLow`, `boxHigh`; optional `whiskerLow` and `whiskerHigh` together. | Selected year. |

Changing the map indicator does not change the charts. Charts read default runs from
`sparccle-internal`; run versions are not set in JSON.

## Variables, models and units

Every `data.variables` entry is a full ixmp4 variable name, queried unchanged.
Role fields such as `x` or `rangeLow` match one whole part between `|` separators,
at any position. For example, `"line": "50th Percentile"` matches the final
part of the variable above.

Each role must match exactly one variable, and every listed variable must be
used. Missing or unclear matches are errors. Role names also label axes and
stacks; plain lines and unnamed stacks derive labels from variable names.

| Field in `data` | Effect |
| --- | --- |
| `model` | Limits all chart variables to one exact ixmp4 model name. Without it, no model filter is sent; overlapping rows for a scenario and region can cause an error. |
| `unitFallback` | Supplies a display unit only when the source has none. It does not convert or filter values. |

Models and units shown in the chart come from the returned data. A variable
with multiple source units is rejected. A fallback label cannot resolve that
conflict. Stacked segments must have matching units and represent separate
parts of a total.

## Grouping

Put grouping fields inside `data`. Use exact source region names or IDs.

| Settings | Result |
| --- | --- |
| `groupBy` omitted | Read the selected country's series. With `region=all`, read a group per country. |
| `groupBy: "region"` and `regionLevel: "NUTS1"` or `"NUTS2"` | Read the selected country's NUTS regions. With `region=all`, read regions across countries. Supported by every chart type. |
| `groupBy: "region"` and `regions: [...]` | Read a fixed list, regardless of the selected country. This list takes precedence over `regionLevel`. |
| `groupBy: "scenario"` | Compare source scenarios at the selected country and year. Supported by stacked bars, scatter, bubbles and box plots. Named bars are excluded. |

Scenario grouping reads all matching source scenarios; the selected scenario
does not filter it. Lines and ranges can be grouped by region, but not by
scenario. Grouping by model or year is not supported.

For a country's NUTS regions, set `regionLevel` explicitly. Without a level or
fixed list, region grouping uses known geography links; it does not select that
country's NUTS regions.

## Country totals

Some values exist only for NUTS regions. To show country totals across Europe,
set `data.aggregate: "sum"` with `groupBy: "region"` and `regionLevel`. Omit a
fixed `regions` list. With `region=all`, the chart sums those regions into
countries; with one country selected, its regional values stay separate.

**Sum only values that can be added**, such as population counts or losses.
Never sum means, rates or percentiles. Box plots reject `aggregate` entirely.
The loader also rejects aggregation without `regionLevel`.

Totals include only regions with data for that year. Missing regions make a
total too small; a year with no reported values stays absent, not zero.
[Map totals](eu-scoreboard-topics.md#maps) use a separate setting on the map
indicator.

## Examples

The snippets below are **`data` objects**, to place inside a chart definition.
Set `chartType` as stated in each section. Short names such as `Temperature|Mean`
show the structure; replace them with exact names from your source.
The [topic guide](eu-scoreboard-topics.md#check-and-release) explains how to
check the resulting values in a running preview.

### Line with a range

Set `chartType: "line_with_range"`. Assign one variable to each role:

```json
{
  "variables": ["Temperature|Mean", "Temperature|Low", "Temperature|High"],
  "line": "Mean",
  "rangeLow": "Low",
  "rangeHigh": "High"
}
```

### Named bars and stacks

Set `chartType: "stacked_bar"`. This example draws two age-group bars, each
split into female and male population:

```json
{
  "variables": [
    "Population|Female|Age 0-14",
    "Population|Male|Age 0-14",
    "Population|Female|Age 15-24",
    "Population|Male|Age 15-24"
  ],
  "bars": ["Age 0-14", "Age 15-24"],
  "stacks": ["Female", "Male"]
}
```

Each variable must match one bar and one stack as whole `|`-separated parts.
Every bar/stack pair needs one variable. The arrays set bar and stack order,
independently of variable order. Named bars support no grouping or
`groupBy: "region"`.

Missing segments are omitted. Other segments keep their values, order and
colours. A bar with no segments keeps its label and empty space; a chart with
no values is hidden.

### Regional percentage bars

Set `chartType: "stacked_bar"`. This example draws one bar per NUTS2 region:

```json
{
  "variables": ["Population|Age 0-14", "Population|Age 65+"],
  "groupBy": "region",
  "regionLevel": "NUTS2",
  "stacks": ["Age 65+", "Age 0-14"],
  "stackMode": "percent"
}
```

`stacks` sets segment order. Each name must match one variable. With
`stackMode: "percent"`, available segments add up to 100% of their bar's
available total. Here that total covers only the two listed age groups, not
the whole population. Missing segments are omitted; zero totals stay blank.
Source units remain in the data details while the chart displays `%`.

### Scatter

Set `chartType: "scatter"`. This example compares two values for each NUTS2
region in the selected country:

```json
{
  "variables": [
    "Population|Age 25-44|Educational Attainment Low",
    "Population|Age 25-44|Educational Attainment High"
  ],
  "groupBy": "region",
  "regionLevel": "NUTS2",
  "x": "Educational Attainment Low",
  "y": "Educational Attainment High"
}
```

### Bubble

Set `chartType: "bubble"`. This fixed country list ignores the country filter;
the scenario and year still apply:

```json
{
  "variables": ["Temperature|Mean", "Temperature|Maximum", "Population|Exposed"],
  "groupBy": "region",
  "regions": ["Austria", "Germany", "France"],
  "x": "Mean",
  "y": "Maximum",
  "size": "Exposed",
  "riskFrom": "size"
}
```

`riskFrom` applies the [risk colours](#risk-colours) described below. Omit it to
use the normal series colour.

### Box plot

Set `chartType: "box_plot"`. Each row shows a horizontal box at the selected
year, for the selected country or each group. The box spans `boxLow` to
`boxHigh`, with a line at `median`.

This uses the same 5th, 50th and 95th percentile roles as the shipped
[Testing topic](../api/scoreboard/topics/testing.json):

```json
{
  "variables": [
    "Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|5th Percentile",
    "Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile",
    "Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|95th Percentile"
  ],
  "median": "50th Percentile",
  "boxLow": "5th Percentile",
  "boxHigh": "95th Percentile"
}
```

The roles define what the box means: this is a 5–95 range, not a 25–75 range.
If your source provides other percentiles, use those exact role names. To draw
whiskers, add their variables and both `whiskerLow` and `whiskerHigh`; a single
whisker is rejected. Do not sum box plots into country totals.

## Risk colours

On scatter or bubble charts, `data.riskFrom` names the role used for colour.
Choose `"x"` or `"y"` for scatter; bubbles can also use `"size"`.

Bands use the values of the visible points, with the 25th and 75th percentiles
calculated by linear interpolation:

| Band | Values | Colour |
| --- | --- | --- |
| Low risk | Below the 25th percentile. | theme 200 (light). |
| Medium risk | From the 25th through the 75th percentile. | theme 500. |
| High risk | Above the 75th percentile. | theme 800 (dark). |

These are relative bands within the shown points, not fixed risk thresholds.
Changing filters can change the limits. Equal values share a band; a single
value or constant series falls in the medium band. Points without a value for
the named role keep their series colour.

## Missing data

Scatter points need both coordinates. Bubbles also need a positive size.
Box-plot rows need every role they draw. Incomplete points or rows are omitted
before display; risk bands use the remaining points.

A chart with no visible values is hidden, including its title and description.
An error is shown as an error state. Use the
[topic guide's troubleshooting table](eu-scoreboard-topics.md#troubleshooting)
to trace missing data or a failed request.
