# Chart config decisions

Each sector JSON file has a `charts` array. Sector stays outside each chart
definition. The chart config is reusable across sectors and does not name
rendering components.

A chart has `chartId`, `title`, `description`, `chartType`, optional
`caseStudyId`, and `data`. `caseStudyId` is the CMS record ID for a linked case
study. Omit it when there is no linked study.

`data.series` is an array. Each entry names the variable roles for one series:

| `chartType` | Roles per series entry |
| --- | --- |
| `line` | `line` |
| `line_with_range` | `line`, `rangeLow`, `rangeHigh` |
| `stacked_bar` | `segment` |
| `bubble` | `x`, `y`, `size` |

Each role holds one exact variable reference:

```json
{ "variable": "<full ixmp4 name>", "model": "<model>", "unit": "<unit>" }
```

A reference may also set `label` for chart axes, legends and tooltips. It changes
only the displayed name; queries still use the exact `variable`, `model` and
`unit`. Without a label, the chart derives one from the variable name.

A line supplies yearly points. A range series groups its central line and bounds.
Stacked bars use direct segment values in array order; segments must be separate
parts with matching units. Stacked bars and bubbles use the selected year. Lines
and ranges show all available years.

`data.groupBy` has these possible values. A region-grouped chart may also set
`data.regions` to an explicit array of region IDs:

| Value | Meaning |
| --- | --- |
| omitted | Resolve the series for the selected region itself. |
| `"region"` | Resolve one mark per configured `data.regions` entry. Without that list, resolve known regions within the selected area. Supported only for `stacked_bar` and `bubble`. |
| `"scenario"` | Resolve one mark per matching scenario at the selected region and year. Supported only for `stacked_bar` and `bubble`. |

No other value is valid. Grouping by model or year is not supported. Every role
continues to name one exact model. An explicit region list is fixed and does not
follow the selected country. Without that list, region membership comes from
known geography links. The controller must not infer it from name prefixes or
mix an area total with its child regions.

Grouped results use `data: [{ "region": { "uid", "label" }, "series": [...] }]`.
Scenario-grouped results replace `region` with
`"scenario": { "uid", "label" }`. The selected scenario does not filter a
scenario-grouped chart. Ungrouped results keep the resolved role array. A grouped
mark is excluded when a required value is missing. Missing values are not changed
to zero, and partial stacked totals are not shown. A group with no matching data
is empty. Empty charts are omitted from the page, including their title,
description, frame and spacing.

The EU scoreboard fixes the instance to `sparccle-internal`; controls supply the
country, scenario and year. The map indicator is a separate choice and does not
change chart config. The shared query layer selects default runs. Run version
selection stays outside this config. No unit conversion or silent model
selection is added.

## Examples

Values in `<…>` are placeholders. `caseStudyId` is optional for every chart type.

```json
[
  {
    "chartId": "mean-air-temperature",
    "title": "Mean air temperature",
    "description": "Annual mean air temperature over time for the selected country and scenario.",
    "chartType": "line",
    "data": {
      "series": [
        {
          "line": {
            "variable": "Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile",
            "model": "RIME-X v1.0.0",
            "unit": "°C"
          }
        }
      ]
    }
  },
  {
    "chartId": "example-line-with-range",
    "title": "Line with range",
    "description": "Values over time with lower and upper bounds.",
    "chartType": "line_with_range",
    "data": {
      "series": [
        {
          "line": { "variable": "<central variable>", "model": "<model>", "unit": "<unit>" },
          "rangeLow": { "variable": "<lower-bound variable>", "model": "<model>", "unit": "<unit>" },
          "rangeHigh": { "variable": "<upper-bound variable>", "model": "<model>", "unit": "<unit>" }
        }
      ]
    }
  },
  {
    "chartId": "high-heat-risk-by-country",
    "title": "High heat risk by country",
    "description": "Annual high heat risk days for Austria, Germany and France in the selected scenario and year.",
    "chartType": "stacked_bar",
    "data": {
      "groupBy": "region",
      "regions": ["Austria", "Germany", "France"],
      "series": [
        {
          "segment": {
            "variable": "High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile",
            "model": "RIME-X v1.0.0",
            "unit": "days/yr"
          }
        }
      ]
    }
  },
  {
    "chartId": "temperature-and-heat-risk",
    "title": "Temperature and heat risk",
    "description": "Mean air temperature is shown on the horizontal axis, maximum air temperature on the vertical axis, and high heat risk days by bubble size for Austria, Germany and France in the selected scenario and year.",
    "chartType": "bubble",
    "data": {
      "groupBy": "region",
      "regions": ["Austria", "Germany", "France"],
      "series": [
        {
          "x": { "variable": "Mean Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile", "model": "RIME-X v1.0.0", "unit": "°C" },
          "y": { "variable": "Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile", "model": "RIME-X v1.0.0", "unit": "°C" },
          "size": { "variable": "High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile", "model": "RIME-X v1.0.0", "unit": "days/yr" }
        }
      ]
    }
  }
]
```

Testing's stacked bar and bubble use Austria, Germany and France in
`data.regions`. The bar has one positive quantity: high heat risk days. The
bubble uses mean temperature for its horizontal position, maximum temperature
for its vertical position and high heat risk days for its size. Country changes
leave the fixed groups unchanged; scenario and year changes still apply. The
line and range charts use the selected country.

## Socioeconomic examples

`api/scoreboard/socioeconomic.json` uses IMAGE 3.4 default runs for nine fixed
R9 world regions. Its charts show rural and urban population, GDP at purchasing
power parity, rural and urban population vulnerable to heat, and GDP against
heat-vulnerable population with bubble size set by total population.

Use **Socioeconomic / CurrentPolicies_SSP1 / 2050** to see all four charts.
`CurrentPolicies_SSP2`, `1.5C_SSP1` and `1.5C_SSP2` also have data for 2020,
2030, 2050 and 2100. Country selection does not change these fixed chart regions.
Population units are millions; GDP uses billions of 2010 US dollars per year.

These examples use R9 data. The sector has an empty `map.indicators` list, with
scenarios and years under `map` for the shared filters. Adding a regional map
requires checking NUTS data for the chosen variable.
