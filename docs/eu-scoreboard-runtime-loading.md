# Scoreboard runtime loading

The scoreboard uses its own controller and the fixed `sparccle-internal` source.
The API reads topic JSON from `api/scoreboard/topics/` on each request. Each file
supplies its label, optional menu order, map and charts; its filename supplies
the topic ID. `getScoreboard(sector, indicator)` selects from those files.
See [Add and update EU scoreboard topics](eu-scoreboard-topics.md).

## Choices and URL state

The server layout loads indicators, scenario IDs and years from
`/api/scoreboard/definition`. Embeds and the same-origin map/chart routes use
the same endpoint. Topic settings are not bundled into the web app. The browser
uses the shared 40-country list for regions. Optional scenario labels come from
Strapi; missing content and Strapi failures fall back to the configured ID
without blocking data requests.

A sector with no configured map indicators keeps `map.indicators` empty.
Its chart filters still work. The page shows the selected country outline and
explains that regional map data is unavailable; it makes no map-data request.

The page URL uses `sector`, `indicator`, `region`, `scenario`, and `year`.
`indicator` stores the short map indicator name. `region` stores the country
name because chart requests use that value. Invalid choices fall back to the
configured default indicator (or the first), the first scenario, Europe (`all`), and
2050 when listed (otherwise the first year).

Each choropleth indicator's `variable` is the exact ixmp4 query name. Its optional
`unit` filters source rows by an exact unit name before values or country totals
are built. Chart `data.unit` accepts one unit for every variable or an object
keyed by role, such as `{ "x": "°C", "y": "°C", "size": "days/yr" }`.
Neither setting converts values. Raster
indicators provide their GeoServer indicator, reference, time, spatial and unit
fields. An optional scenario `rasterName` maps an ixmp4 scenario ID to its
GeoServer name. An indicator's `name` remains the filter label and URL choice.

Chart URLs and embeds keep their existing chart fields. They do not require an
indicator. Opening the ranking view clears the region choice and returns to Europe.
Other valid choices are kept. Opening the indicators view keeps the selected
geography.

## Requests

| Request | Work |
| --- | --- |
| `/api/scoreboard/definition` | Read and validate topic files, then return the selected topic and menu choices without querying ixmp4. The response uses `Cache-Control: no-store`. |
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

Regional boundary loading is shared by the API and browser. It imports the
requested NUTS level from `api/scoreboard/data/`, with no runtime GitHub request.
The packaged files preserve the pinned source bytes. The loader filters by
`CNTR_CODE` and level; the API joins values through `NUTS_ID`.

Testing's stacked bar and bubble keep `groupBy: "region"`, but their config
provides the fixed country names Austria, Germany and France. Country changes
do not change those groups. Scenario and year changes still change their
requests.

Optional case-study content is loaded only for a ready chart that names a CMS
record. A CMS failure does not remove chart data. Map errors and chart errors
are reported without exposing credentials or upstream response bodies.

## JSON preview

`#preview` opens a JSON dialog on the indicators page. Applying a valid topic
changes the fragment to `#preview=<gzip compressed base64url>`. The browser
reads this fragment; it is not part of the server request URL.

The same-origin `/app/scoreboard/preview/definition`, `/map` and
`/charts/:chartId` routes forward POST bodies to the API's matching scoreboard
routes. POST requests validate and use the supplied topic; GET requests read
topic files. Both use the same map and chart loaders. Drafts use the topic ID
`preview` and are never written to disk. Responses are not cached.

Applying a draft replaces the displayed preview as one unit. Older definition
responses cannot replace a newer draft. Map comparisons and chart retries carry
the same draft in their POST body. Section links scroll without replacing the
preview fragment. Empty charts remain visible in preview.

## Local proxy check

Vite serves shared scoreboard source files under `/api/`. The development proxy
routes those exact files to Vite and sends API requests to the backend.
With `docker compose up` running, check both routes with:

```sh
node scripts/verify-scoreboard-dev-proxy.mjs
```

Pass another origin as the first argument to check a different local address.

## Limits

The overview scores are still mock data. The API assumes one ixmp4 model for
each choropleth variable and returns that model and unit as metadata. Raster
units come from sector config. It adds no model choice, unit conversion, shared
value cache, or stored catalog.
