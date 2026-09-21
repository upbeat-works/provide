# Scoreboard maps

## Overview

Keep the mocked country ranking map and its top-five panel. Both use the same
scores. Show it in every sector, even when no charts are configured. Keep a short
mock-data label. A real combined score has not been defined.

## Indicator page

Use ixmp4 values for the selected scenario and year. Map country values to country
boundaries and regional values to matching regional boundaries. Do not spread an
area total across countries. Keep the base map when no values match.

Stakeholders define one fixed map variable per sector. Users only change the
available scenario, region and year filters. Keep this definition separate from
the chart array.

Definitions live in `api/scoreboard/heat-stress-map.json` and
`api/scoreboard/testing-map.json`, registered as `mapDefinition` by the sector
controller.

Each map definition has `title`, `geographyType` (`admin0` or `r9`) and `data`
containing an exact `variable`, `model` and `unit` reference. Testing maps IMAGE
heat-vulnerable population over R9 regions; Heat stress maps RIME-X maximum air
temperature over countries. Heat stress keeps its empty chart array.

The initial definitions are:

| Sector | Geography | Variable | Model | Unit |
| --- | --- | --- | --- | --- |
| Testing | `r9` | `Population\|Vulnerable\|Heat` | `IMAGE 3.4` | `million` |
| Heat stress | `admin0` | `Maximum Air Temperature\|Absolute Values (No Change)\|Annual\|Area\|50th Percentile` | `RIME-X v1.0.0` | `°C` |

These choices belong to stakeholders and are not inferred from the chart list.
The UI has no variable picker.

The API returns `map: { definition, status, values, error? }`, where each value is
`{ uid, label, value }`. Country UIDs are ISO alpha-3; R9 UIDs are exact region
names. Values use default runs and the selected scenario and year. The selected
area limits the mapped regions. Missing values stay unpainted. Errors are visible
and logged safely. Chart embeds do not request map data.

The legend shows numeric values and units, not invented risk thresholds. Bundle
R9 boundaries from IIASA's scse-geojson repository with source attribution.

## Workstreams

| Owner | Work |
| --- | --- |
| Sol: overview | Restore the ranking map and top-five panel; test selection and links. |
| Sol: data | Query the chosen map variable from default runs; resolve geography IDs and test missing values. |
| Sol: map | Render matching boundaries, values, units and legend; test selection changes. |
| Main | Confirm the indicator-map choice, verify live coverage and check the Docker pages. |

No commits. Keep existing changes and the agreed chart behavior.
