# Chart config decisions

Each sector selects a JSON array of charts. Sector stays outside the config. The
config is reusable across sectors and does not name rendering components.

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

A line supplies yearly points. A range series groups its central line and bounds.
Stacked bars use direct segment values in array order; segments must be separate
parts with matching units. Stacked bars and bubbles use the selected year. Lines
and ranges show all available years.

`data.groupBy` has these possible values:

| Value | Meaning |
| --- | --- |
| omitted | Resolve the series for the selected region itself. |
| `"region"` | Resolve one mark per known region within the selected area. Supported only for `stacked_bar` and `bubble`. |
| `"scenario"` | Resolve one mark per matching scenario at the selected region and year. Supported only for `stacked_bar` and `bubble`. |

No other value is valid. Grouping by model or year is not supported. Every role
continues to name one exact model. Region membership comes from known geography
links. The controller must not infer it from name prefixes or mix an area total
with its child regions.

Grouped results use `data: [{ "region": { "uid", "label" }, "series": [...] }]`.
Scenario-grouped results replace `region` with
`"scenario": { "uid", "label" }`. The selected scenario does not filter a
scenario-grouped chart. Ungrouped results keep the resolved role array. A grouped
mark is excluded when a required value is missing. Missing values are not changed
to zero, and partial stacked totals are not shown. A group with no matching data
is empty. Empty charts are omitted from the page, including their title,
description, frame and spacing.

The EU scoreboard fixes the instance to `sparccle-internal`; controls supply the
scenario, region and year. The shared query layer selects default runs. Run
version selection stays outside this config. No unit conversion or silent model
selection is added.

## Examples

Values in `<…>` are placeholders. `caseStudyId` is optional for every chart type.

```json
[
  {
    "chartId": "example-line",
    "title": "Line chart",
    "description": "Values over time.",
    "chartType": "line",
    "caseStudyId": "<case-study ID>",
    "data": {
      "series": [
        {
          "line": {
            "variable": "<variable name>",
            "model": "<model>",
            "unit": "<unit>"
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
    "chartId": "example-scenario-stacked-bar",
    "title": "Scenario stacked bars",
    "description": "Parts of a total for each matching scenario.",
    "chartType": "stacked_bar",
    "data": {
      "groupBy": "scenario",
      "series": [
        { "segment": { "variable": "<first part>", "model": "<model>", "unit": "<unit>" } },
        { "segment": { "variable": "<second part>", "model": "<model>", "unit": "<unit>" } }
      ]
    }
  },
  {
    "chartId": "example-regional-bubble",
    "title": "Regional bubbles",
    "description": "One bubble for each known region in the selected area.",
    "chartType": "bubble",
    "data": {
      "groupBy": "region",
      "series": [
        {
          "x": { "variable": "<horizontal variable>", "model": "<model>", "unit": "<x unit>" },
          "y": { "variable": "<vertical variable>", "model": "<model>", "unit": "<y unit>" },
          "size": { "variable": "<size variable>", "model": "<model>", "unit": "<size unit>" }
        }
      ]
    }
  }
]
```
