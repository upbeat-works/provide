# Scoreboard runtime loading

The scoreboard keeps its own controller and fixed `sparccle-internal` source.
It uses the catalog review's rule: each request loads only what its use case needs.

| Request | Work |
| --- | --- |
| `/api/scoreboard/options` | Scenario and region metadata; available years for the selected scope. |
| `/api/scoreboard/map` | One map variable, selected scenario, member regions and year. |
| `/api/scoreboard/charts/:chartId` | One chart's variables for its selected scope. |

Line charts read all years for the selected scenario and region. Bars and bubbles
read only the selected year. Region groups read the area's members. Scenario
groups read all scenarios for the selected region and year.

The shared SvelteKit layout owns control options. Its server loader depends on
sector, scenario and region, so changing the year or switching views reuses those
options. View links preserve the current URL parameters, including omitted defaults,
so moving between views does not invalidate the shared options.
A failed options request keeps URL choices pending and offers a retry; only a
successful response can replace an invalid choice. If year discovery fails, scenario
and region choices remain available, and the requested year is kept until a retry succeeds.

The ranking page loads no map or chart values. Its indicator links come from the
sector definitions. The indicator page starts separate browser requests for the map and
each chart. It reuses parent data in its universal loader; a child server loader
calling `parent()` would run the parent server loader again. Ready results render while other requests are pending. Empty charts
remain hidden. A retry calls only the matching same-origin `/app/scoreboard`
endpoint. Old promises cannot replace results for a newer selection.

Embeds await only their requested chart. Optional case-study content stays on the
server and is requested by record ID. A CMS error does not remove chart data.

## Limits

The installed ixmp4 client has no year-only query. Finding available years still
reads datapoints, limited to the selected scenario and area and references with
matching region metadata. The response contains year options, not those values.
A later year-index resource could remove this extra read. No shared value cache
or stored catalog is added.

Country maps fit the countries returned by the selected area. Shape loading uses
the existing external map boundary and its browser cache.

## Checks

API tests cover query scope, defaults, missing values, grouped charts, failures
and fixed-source ownership. Browser component tests cover independent loading,
individual retries, stale responses, selection links and map bounds. Server tests
cover ranking requests, independent results, embeds and optional CMS failure.
