# Chart config implementation

Implement [the agreed config](eu-scoreboard-chart-config.md). Testing uses real
data examples of all four types. Heat stress keeps its empty chart array.
Use the same query and rendering path for both sectors.

The sector registry and JSON files live under `api/scoreboard/`, shared with the
web app. The API container must not depend on frontend route files.

## Workstreams

| Owner | Work |
| --- | --- |
| Sol: data | Add a fixed-SPARCCLE chart endpoint and a shared default-run series reader. Query exact variable, model and unit; derive selections from returned data. Test requests and responses at the service boundary. |
| Sol: charts | Turn chart results into the existing line, bar and bubble components. Derive labels and units. Test ranges, direct stack values, missing data and bubble inputs. |
| Sol: pages | Replace stub JSON with real config, wire the server controller and selectors, and load matching embeds. Resolve optional case studies by ID. Test selection, errors and links. |
| Main agent | Verify live variable references, review the combined changes, run tests and build, and record limits. |

Agents own separate files and keep existing edits. Write behaviour tests before
or alongside code. No commits, pushes, PRs or Superpowers skills.

## Data flow

Page loaders call the scoreboard server controller, which calls
`GET /api/scoreboard?sector=…&scenario=…&region=…&year=…`. An optional `chartId`
limits an embed request to one chart. The API resolves server-owned definitions;
request parameters cannot change the instance or variable references.

The endpoint reads each distinct variable/model/unit reference from default runs
in SPARCCLE. It returns available scenarios, regions and years, the selected
values, and chart results. Series retain their configured roles. Line roles contain
`[{year, value}]`; bar and bubble roles contain a number or null for the selected
year. Missing values stay missing. Data errors are visible, not replaced by mocks.

Definitions put role entries in `data.series`. With no `data.groupBy`, results use
the selected region and scenario and keep the resolved role array. For
`stacked_bar` and `bubble`, `groupBy: "region"` resolves known regions within the
selected area at the selected scenario and year. `groupBy: "scenario"` resolves
all matching scenarios at the selected region and year; the selected scenario
does not filter that chart. Grouped results contain
`{ region: { uid, label }, series: [...] }` or
`{ scenario: { uid, label }, series: [...] }`. Model and year grouping are not
supported, and each variable reference still names its exact model. The
controller owns grouping; chart components do not infer membership. A group with
a missing required value is omitted rather than shown as zero or as a partial
stacked total. No matching groups yields an empty chart.
Empty chart results are omitted from the page, including their title,
description, frame and spacing. Error results stay visible with a retry action.

Charts and exports use the same selection. The overview links to available charts;
it does not present mock country scores as real results. A risk-ranking formula
and map data are outside this chart config.
The map section stays visible in every sector, including empty and error states.
Without map data, show the base map with no data overlay.

## Shared result

```js
{
  scenarios: [{ uid, label }],
  regions: [{ uid, label }],
  years: [{ uid, label }],
  selection: { scenario, region, year },
  map: { definition, status, values, error },
  charts: [{ definition, status, data, error }]
}
```

`status` is `ready`, `empty` or `error`. For ungrouped charts, `data` is an array
matching `definition.data.series`. For grouped charts, each data entry names its
region or scenario and contains that resolved series array. Variable references
stay in `definition`; resolved values go in `data`. No unit conversion or silent
model selection is added.
Each selection is an option object (`{ uid, label }`) or `null`.

The map definition is separate from the chart array and fixes one stakeholder
chosen variable for each sector. Its values follow the same scenario and year
selection. Missing map values leave the base map visible without a legend; map
errors keep the map visible with a retry action. See
[Scoreboard maps](eu-scoreboard-map-plan.md) for the map contract and initial
references.

Live catalog/CMS dependencies remain. Do not add a special mock path. The final
checks must cover all four chart types, default-run and source selection, missing
values, selector changes, case-study links, embeds and the production build.

## Current limits

Heat stress has no configured charts. The overview's combined risk score remains
mock data because no real score definition exists. Both pages keep their map
visible for empty and error states.

Testing examples do not all share scenarios and regions. The population examples
use `1.5C_SSP1`; the temperature range is available for `1.5C` / `Austria`.
Testing defaults to `World`. Its grouped bar and bubble charts use the nine R9
world regions. The bubble uses IMAGE 3.4 `GDP|PPP` (`billion USD_2010/yr`),
`Population|Vulnerable|Heat` (`million`), and `Population` (`million`); all nine
regions have positive values in 2050 under `1.5C_SSP1`. All references were
checked against live default runs.

The World partition follows the nine region names documented by
[IIASA's scenario explorer GeoJSON](https://github.com/iiasa/scse-geojson) and
[IAMC common region definitions](https://github.com/IAMconsortium/common-definitions/blob/main/definitions/region/common.yaml).
For other selected areas, the controller uses exact catalog parent links. It does
not infer membership from model-region prefixes or mix area aggregates with
countries. When an area has no defined child regions with complete values, the
grouped chart is empty.

CSV download is not implemented. Image export needs the existing screenshot
service configuration.

## Checks

The focused suite and production build pass. Live ixmp4 checks covered all four
chart types. Browser checks covered chart rendering, the temperature embed and
switching to empty Heat stress while keeping the same map mounted.
