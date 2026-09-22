# Scoreboard runtime loading

The scoreboard uses its own controller and the fixed `sparccle-internal` source.
Sector config is bundled with both the API and web app. `getScoreboard(sector,
indicator)` returns the selected sector's `map`, `charts`, and `indicator`.

## Choices and URL state

The layout reads indicators, scenario IDs, and years from local sector config.
It uses the shared 40-country list for regions. It does not make an options API
request. Optional scenario labels come from Strapi; missing content and Strapi
failures fall back to the configured ID without blocking data requests.

A sector with no configured map indicators keeps `map.indicators` empty.
Its chart filters still work. The page shows the selected country outline and
explains that regional map data is unavailable; it makes no map-data request.

The page URL uses `sector`, `indicator`, `region`, `scenario`, and `year`.
`indicator` stores the short map indicator name. `region` stores the country
name because chart requests use that value. Invalid choices fall back to the
first configured indicator and scenario, Austria, and 2050.

Chart URLs and embeds keep their existing chart fields. They do not require an
indicator. Moving between the overview and indicators views keeps valid choices.

## Requests

| Request | Work |
| --- | --- |
| `/api/scoreboard/map` | Load one configured regional map for the selected indicator, country, scenario, and year. |
| `/api/scoreboard/charts/:chartId` | Load one configured chart for the selected country, scenario, and year. |
| `/app/scoreboard/map` and `/app/scoreboard/charts/:chartId` | Same-origin SvelteKit routes that call the matching API request and return its result. |

The overview loads no map values or chart values. Its country shape comes from
the local NUTS0 file. The indicators page starts the map and each chart request
independently in the browser. Ready results remain visible while another request
loads or fails. Retry repeats only the failed resource.

Request identity includes every choice that affects that resource. Old promises
cannot replace results after a filter change. Comparisons keep separate resource
state for each side. Country fitting uses NUTS0 data and does not wait for the
regional value request.

Regional boundary loading is shared by the API and browser. It uses pinned
NUTS1 and NUTS2 sources, filters by `CNTR_CODE` and level, and caches only
successful full-file loads. The API joins values through `NUTS_ID`.

Testing's stacked bar and bubble keep `groupBy: "region"`, but their config
provides the fixed country names Austria, Germany and France. Country changes
do not change those groups. Scenario and year changes still change their
requests.

Optional case-study content is loaded only for a ready chart that names a CMS
record. A CMS failure does not remove chart data. Map errors and chart errors
are reported without exposing credentials or upstream response bodies.

## Local proxy check

Vite serves shared scoreboard source files under `/api/`. The development proxy
routes those exact files to Vite and sends API requests to the backend.
With `docker compose up` running, check both routes with:

```sh
node scripts/verify-scoreboard-dev-proxy.mjs
```

Pass another origin as the first argument to check a different local address.

## Limits

The overview scores are still mock data. Raster maps are deferred. The API
assumes one ixmp4 model for each map variable and returns that model and unit as
metadata. It adds no model choice, unit conversion, shared value cache, or
stored catalog.
