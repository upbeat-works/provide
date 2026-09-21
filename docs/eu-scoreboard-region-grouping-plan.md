# Chart grouping

Stakeholders choose grouping in the chart config. The scoreboard supplies the
selected area, scenario and year. The controller finds regions within an area or
matching scenarios for a selected region.

## Contract

`data` becomes an object with `series`, holding the existing array of variable
roles, and optional `groupBy`.

- Omitted: use the selected region itself.
- `"region"`: one stacked bar per region, or one bubble per region and configured
  x/y/size group. Supported for `stacked_bar` and `bubble`.
- `"scenario"`: one stacked bar or bubble per matching scenario at the selected
  region and year. The selected scenario does not filter these charts. Supported
  for `stacked_bar` and `bubble`.
- Other values are rejected. Model and year grouping are not supported. Every
  variable reference still names its model.

Grouped results use `data: [{ region: { uid, label }, series: [...] }]`.
Scenario-grouped results use the same shape with
`scenario: { uid, label }` instead of `region`. Each resolved series retains its
configured roles. Ungrouped results keep their existing resolved arrays. Region
membership belongs to the controller, not the chart components. Use known
geography links; never mix country totals with their subregions or infer
membership from a shared name prefix.

Missing required values exclude that group's mark. Do not substitute zero or
display partial stacked totals. A grouping with no matching values is empty.

## Workstreams

| Owner | Work |
| --- | --- |
| Sol: data | Resolve known child regions and matching scenarios, add grouped query results, migrate Testing configs, and test membership, selection and missing values. |
| Sol: charts | Render regional bars and bubbles, keep labels and units, and test multiple marks and missing values. |
| Sol: docs and integration | Update config examples and supported values; adjust page and embed fixtures for the config shape. |
| Main | Check live data and geography links, review changes, run tests/build and verify the Docker page. |

Use tests before or alongside code. Keep the map visible. No commits.
