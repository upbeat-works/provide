# GeoServer maps and emissions port plan

Reimplement the useful parts of `feat/geoserver` on current `main`. Keep the
separate endpoints, runtime loading, and selection flow. Do not restore
`/catalog` or its full scan on page load.

Reviewed bases: `main` at `7792d961`, `feat/geoserver` at `ffa4b71c`.
Implementation follows the phases below. Changes remain uncommitted.

## Implementation phases and review log

Each phase starts by checking the previous phase against this plan. Record any
change in scope or contract here before proceeding. A Sol agent implements each
phase; a senior engineer reviews it. Fix review findings before the next phase.

| Phase | Work and acceptance | Status |
|---|---|---|
| 1. Methodology emissions | Source query, units and year handling, methodology response, chart/table, focused API and frontend tests. Scenario popover remains unchanged. | Complete; senior review approved |
| 2. Published maps and API | Small reproducible raster dataset, optional local GeoServer, publication using the existing convention, availability/grid/GeoTIFF routes, boundary tests and early real WCS check. | Complete; senior review approved |
| 3. Browser maps and exports | Current selection flow, year discovery, map rendering/comparison, GeoTIFF links, embeds/image export, frontend tests. | Complete; senior review approved |
| 4. Whole-flow checks and handoff | Review previous phases against all agreed decisions, run required suites/build, exercise real WCS through the app API, finish deployment/data instructions and list external blockers. | Complete; senior review approved the local port |

### Phase 1 entry check

Only the plan and review documents were changed at entry. The implementation
must use the current checkout, including its existing Vitest and map component
tests, rather than assume the earlier reviewed commit is still the head.
Keep all six review outcomes: methodology-only emissions, GeoTIFF downloads,
current styling, ixmp4 choices, convention-based year discovery without a new
cache, and tests of complete flows at the smallest useful layer.

### Phase 2 entry check

Phase 1 meets the methodology-only scope. A draft shared response extension was
removed before review; emissions are added after the existing scenario builder.
The existing line renderer now leaves gaps and excludes nulls from its domain.
The senior review's browser-test blocker was fixed with a local framework-store
mock and visible table assertions. The review approved the result; its fixture
comment was addressed by placing zero at 2050 and the missing point at 2075.

Verified: 44 focused API tests and 5 frontend tests pass. The worker also ran a
passing production build. API checks use the separate `provide_geoserver_tests`
database (`DATABASE_HOST=127.0.0.1`, `DATABASE_USERNAME=rodrigo`, SSL off), with
the existing test schema helpers. Phase 1 started from `0390738c`.

Phase 2 keeps the existing coverage naming convention. The cached local
GeoServer 2.28.4 image includes the NetCDF extension archive. A temporary Python
environment can generate the small NetCDF fixture; it is not an app dependency.
Use a separate local GeoServer service for the smoke test. Production deployment
is outside this task; finish code/configuration and record any external steps.

A full frontend run after phase 1 has 391 passing tests and seven failing files.
An untouched `0390738c` archive with the same installed dependencies reproduces
all seven failures, plus the methodology component setup fixed in phase 1
(390 passing tests, eight failing files). The remaining failures involve store
test setup, the map's Svelte mock, a test file URL, and editorial fixture lookup.
Recheck after dependencies are installed for phase 2; fix affected map tests in
phase 3 and account for the remaining baseline failures in phase 4.

Installing declared dependencies fixed the map test's Svelte-version mismatch
(392 frontend tests pass; six baseline files still fail). Updating the npm lock
for GeoTIFF also adds the frontend test dependencies already declared by current
`main` but absent from its npm lock. This larger lock change is needed for a
consistent `npm ci`; it does not add a second test runner or change test scope.

The real fixture check found that this GeoServer setup exposes neither NetCDF
units nor model/source through WCS DescribeCoverage or the coverage REST response.
Return these fields only when the service supplies them. Published rasters must
already use the indicator's display unit; check any declared raster unit before
rendering. Document this input requirement and omit missing attribution from the
map. Do not add a metadata registry or invent values to fill the response.

The first senior review requested a fix before phase 3: WCS exception responses
must not become empty availability or missing coverage. Only a real missing
coverage response counts as absence; other failures must reach the retry path.
It also found inconsistent publication file selection and incomplete filename
checks. The worker fixed these with failing boundary tests first; senior
re-review approved the result. All 16 focused tests pass.

### Phase 3 entry check

Phase 2 supplies the agreed availability, grid and GeoTIFF routes. Real API
checks returned both scenarios with years 2030/2050, the expected grid values
and missing cell, and a 1,428-byte TIFF attachment. Compose validation and
the diff check pass. Publication is limited to Cameroon mean temperature;
the adapter itself follows the naming convention. Other datasets require
publication support and source files, not a new map registry.

The browser work must use the actual contract in `docs/geoserver-setup.md`:
availability is `{ scenarios: { [scenario]: years } }`; grid data is longitude
major. Unit/model/source may be absent. Use the selected indicator unit and
omit unknown attribution. Availability must bypass the existing successful
response cache and run on selection changes, not year changes.

The user refined absence handling: hide unavailable map sections like other
charts. Keep service failures visible with retry. A comparison without shared
years is unavailable; preserve both selected scenarios rather than drop one.

The full API suite passes after phase 2: 331 tests across 44 files, with no
failures, using the isolated local test database.

Two baseline editorial server suites pass all 14 tests when run with Vitest's
Node environment instead of jsdom. Phase 4 should assign these server tests to
their actual runtime; their failure does not require a production content change.

Phase 3's first review found gaps beyond the passing helper tests: relative API
bases and server-side internal addresses, errors thrown during map comparison,
and embed year/error/parameter handling. Fix these with tests through the real
store/component or server-loader boundary before approval. The existing ixmp4
scenario-discovery gate may remain; it does not depend on the chart data request.

### Phase 4 entry check

Phase 3 passed senior re-review after the URL, comparison and embed fixes.
All existing embed tests were restored; separate map embed tests cover discovered
years reaching grid requests, retry, and hiding valid selections without maps.
The focused frontend suite passes 36 tests across eight files, and the production
build passes. The plan's current selection flow, default colours, convention,
year lookup and GeoTIFF decisions remain unchanged.

Final checks will run the full frontend suite, fix its confirmed test-environment
issues, and exercise the real map embed in a browser. The full API suite already
passes 331 tests; rerun it only if backend changes require it. Production data and
external deployment manifests remain outside this local port.

### Final checks

- API: 331 tests pass across 44 files; publication script: two tests pass.
- Frontend: 431 Vitest tests pass across 54 files, plus 133 tests in the 14
  Bun-native frontend files. Production build and `git diff --check` pass.
- Test setup fixes select Node for server loaders and provide local framework
  stores where tests run outside a component. Existing assertions remain intact.
- Real GeoServer and browser: single and side-by-side maps render, difference
  mode works, and changing 2030 to 2050 fetches two grids without another
  availability request. Processing settles with no console errors.
- The selected 2050 GeoTIFF returns 1,428 bytes and an attachment filename.
  Its 3-by-2 grid, extent `[8, 2, 14, 6]`, nodata and values match the API grid
  with origin `[9, 3]` and resolution `2`.
- The PNG button generates the matching static comparison embed. That URL
  renders correctly and was captured as a PNG in the browser. The hosted
  screenshot service was not called against localhost; check that service
  against the deployed site before release.
- A valid selection without published coverage renders no map or error alert.

The ready dataset consists only of four synthetic Cameroon rasters. Real source
files, their display-unit checks, and external production manifests are still
deployment work. Existing non-failing Svelte package/component warnings remain.
Senior review approved the local port after these browser checks. All changes
remain uncommitted.

## Target behaviour

Remote connection follow-up: the workspace is configurable, and discovery and
raster requests share server-only Basic authentication. Senior review approved
the change. The remote workspace `climate-risk-dashboard` responds with HTTP 200
after the user corrected the saved credentials. Its service URL includes
`/geoserver`. The production adapter connected successfully.

That workspace currently advertises only `terclim-mean-temperature`, a 6-by-5
grid over part of Europe. Its name supplies no scenario/year family, and its
reported unit is `W.m-2.Sr-1`, which is not a temperature unit. It cannot supply
the agreed map selections as published. The adapter correctly reports no
matching years. No data or settings were changed on the remote server.

The user approved the map changes after the visual test. The temporary mapping
to `terclim-mean-temperature` has been removed. All workspaces use the coverage
naming convention, including scenario and year. Until matching coverages are
published, the current remote test layer supplies no available map years.

Follow-up checks: 336 API tests pass, including 19 focused map tests. Senior
review approved the final authentication change. The initial signature-change
failure was not a valid RED step; the later partial-credential test failed on
an unwanted upstream request, then passed after configuration validation.

- Explore loads maps from GeoServer through the Hono API. Chart data still comes
  from ixmp4. Keep the current ixmp4 scenario choices. Use the existing naming
  convention to find their GeoServer maps and available years.
- Changing the indicator, instance, geography, parameters, scenario, or year
  cannot leave a map from the previous selection on screen.
- Supported selections show one map or two maps, including a difference view.
  Hide the map section for unsupported selections or comparisons with no shared
  year, as with other charts. Failed requests remain visible and offer retry.
- Shared links and screenshot embeds use the same map request rules as Explore.
- Maps offer NetCDF and GeoTIFF downloads from the same GeoServer coverage and
  selection, using the existing Scenario / Resolution / Format dialog.
- Methodology shows emissions lines and the 2050/2100 values alongside GMT.
  Emissions are loaded only for methodology.
- A source failure is distinct from a successful response with no data.

## Boundaries and contracts

Keep geography, indicator, and scenario loading in their current endpoints.
Keep indicator identity as `{ id, instance }` throughout requests and stores.
Keep Strapi responsible for page text and descriptions.

### Maps

Add two focused routes:

| Route | Input | Output |
|---|---|---|
| `GET /api/impact-geo/availability` | Instance, canonical indicator and geography, reference, time, spatial, and selected scenarios | Published years for each requested scenario |
| `GET /api/impact-geo` | The same selection, one scenario, and a year | Grid, cell origin and resolution, selected coverage details, and any supplied unit/model/source |

`GET /api/impact-geo?format=geotiff` or `format=netcdf` downloads that selection's WCS raster.
Reuse the grid request's coverage lookup and WCS request options. Stream the TIFF
through Hono with the image content type and an attachment filename identifying
the scenario and year. Check upstream failures before starting the download.
Without `format`, the route returns the JSON grid; reject unsupported formats.
GeoServer stays behind the API, so links work with its internal service address.

GeoTIFF is a supported [GeoServer WCS output format](https://docs.geoserver.org/main/en/user/services/wcs/outputformats/).

Validate the instance and required selection fields. Use repeated query keys for
scenario lists. Validate supported parameter values; never silently ignore a
frequency or threshold that changes the requested data.

Return `400` for invalid input, `404` for an unknown instance or missing grid,
`503` when GeoServer is not configured, and `502` for an upstream failure.
An availability request with no published coverage returns an empty result.

Use the branch's JSON grid layout so the existing map drawing code can consume
it. GeoServer WCS remains behind the API; the browser does not need access to
GeoServer administration or credentials.

Reuse the branch's coverage naming convention:

```text
scenario_geography_variable_time_spatial_50th-percentile_year
```

Its `coverageIdSegment` function lowercases each text segment, removes accents,
and replaces runs of non-alphanumeric characters with a hyphen. The IAMC
`variable` field combines the indicator and reference. Fields follow IAMC order
and use one underscore as their separator. WCS 2 requests
prefix the resulting ID with `provide__`. Discover published years by matching
that coverage family in GeoServer capabilities. Publication and lookup must use
the same convention; do not add a separate table of selection-to-coverage IDs.

Keep instance ownership explicit. For the initial dataset, limit coverage to
`provide-internal`; other instances return no map availability. Do not allow
matching names from another instance to select that dataset. Check for collisions
when publishing names that become identical after punctuation is removed.

### Emissions

Define a methodology response in `api/catalog/contracts.ts` for
`/methodology-scenarios`, adding emissions to its existing scenario fields:

```ts
emissions?: {
  data: Array<{ year: number; value: number | null }>;
  unit: 'GtCO2eq/yr';
  model?: string;
};
```

Add optional `emissions2050` and `emissions2100` to `characteristics`. Explicit
years avoid shifting points when source years are uneven. Missing values remain
gaps; absent series omit `emissions`. Keep each instance's series separate even
when scenario names match.

## 1. Port emissions through the methodology endpoint

Files: `api/views/emissions.ts` (new), `api/views/scenarios.ts`,
`api/conventions.ts`, `api/catalog/contracts.ts`, and methodology route tests.

1. Add tests for the public response and ixmp4 query boundary. Start with a stub
   that returns no emissions, so the first failure is a behaviour assertion.
2. Read `Emissions|Kyoto Gases` at `World` once per instance for methodology,
   rather than once per scenario. Do not add this query to scenario details.
3. Adapt the branch's assembly logic. Check source units before converting Mt
   to Gt; do not divide an already-Gt series again. Reject unknown units clearly.
4. Keep years, zero, negative emissions, and internal gaps. Derive table values
   from the actual 2050/2100 points. Do not infer net-zero dates in this port.
5. Add emissions to the methodology results after the existing scenario builder.
   Preserve the current scenario list and timeframe rules. Do not merge across
   instances using only a lowercased scenario name.
6. Treat empty source data as absence. Let request failures reach the existing
   route failure handling; do not copy the branch's catch-all empty result.
7. Map the response into chart points in `src/lib/utils/apis.js`. Use the existing
   methodology chart and table. Verify that line drawing breaks at null values.

## 2. Keep current map styling and check units

Keep the palettes in `src/config.js` and the defaults in `src/lib/utils/geo.js`:
`COLOR_SCALES.default` and direction `1`. Add no per-indicator styling fields to
the database, map configuration, or API. No database migration or indicator seed
change is needed for this port.

Keep ixmp4 units as the indicator unit source. Check declared raster units against
the display unit; add an explicit conversion only where the dataset needs it.
Where raster metadata omits the unit, publication must ensure the values already
use the indicator's display unit.
Cover any conversion in the adapter tests. Do not add tests that merely lock
the current palette or direction in place.

## 3. Add the GeoServer adapter and availability route

Files: new `api/views/impact-geo.ts`, route files, `api/index.ts`, `api/types.ts`,
`server.ts`, and dependency lockfiles.

1. Write route and adapter tests against small WCS boundary fakes and a tiny TIFF
   fixture. Stub the adapter first so tests fail on missing behaviour.
2. Port WCS fetching and TIFF-to-grid conversion. Verify axis order, cell centres,
   nodata, and dimensions. Return a useful failure for unsupported grid geometry.
3. The availability route reads WCS `GetCapabilities` once for all requested
   scenarios, matches their coverage prefixes using the existing convention,
   and returns sorted year suffixes. Use WCS 1.0 for discovery and WCS 2.0.1 for
   raster requests, as the branch does: the local 2.28.4 smoke test showed WCS 2
   capabilities listing only one of four published coverages, while WCS 1 lists
   all four. Discover years before requesting a grid.
   The browser requests availability when the instance, indicator, geography,
   parameters, or scenarios change, not when only the year changes.
4. The grid and download paths build the coverage ID for the chosen year and
   fetch it directly, without reading capabilities again. Add no new cache;
   measure availability latency before considering one.
5. Bound upstream requests with timeouts and validate responses, including WCS
   exception bodies. Distinguish missing coverage from a broken service.
6. Read model/source and unit from dataset metadata. Do not copy the branch's
   hardcoded MESMER attribution for every indicator.
7. Add the GeoTIFF response path using the same raster request as the map. Test
   selection mapping, attachment headers, streamed content, and upstream failure.
   Keep raster units explicit if the display applies a unit conversion.

## 4. Connect maps to the current frontend

Files: `src/lib/api/api.js`, a map request helper, runtime map availability state,
`src/stores/state.js`, Explore's page and `ImpactGeo` components,
`src/lib/charts/embed-context.js`, and embed tests.

1. Keep `main`'s `chartContext` interface and selection ownership. Add map-specific
   availability to that flow instead of restoring the branch's global stores or
   geography controls. Keep the current ixmp4 scenario choices; do not add
   GeoServer-only scenarios. For each selection, use the coverage naming
   convention to check map availability and years. Keep map loading and errors
   separate from chart loading and errors.
2. Replace the legacy map eligibility check with canonical map selections.
   Preserve selected scenario order so labels stay matched to responses. Do not
   silently drop a selected scenario that lacks coverage.
3. Use `VITE_API_URL` for grid, download, and availability requests. Keep the
   legacy base explicit for outlines. No grid fallback to the legacy API is needed.
4. Add per-request base support to `fetchMultiple`, retaining `main`'s request
   sharing, failed-request retry, and stale-response checks.
5. Reset year availability when the selection changes. Keep the chosen year if
   supported; otherwise use the configured default or first supported year.
   For comparison, offer years common to both scenarios. Hide the section when
   there are no supported years; do not replace it with an empty-state message.
6. Keep the existing grid drawing path. Before subtracting grids, check matching
   origin, dimensions, resolution, and units. Show an unavailable difference view
   if they differ; do not silently subtract unrelated cells. A missing value in
   either grid must produce a missing difference value, not treat it as zero.
7. Update embed contexts and share/download links with the same canonical
   selection, including instance. Keep explicit legacy IDs only at the outline
   boundary.
8. Link data downloads to the NetCDF or GeoTIFF response for the selected scenario and year.
   In comparison views, label each scenario download clearly; these are the input
   rasters, not a computed difference raster. Keep the existing dialog layout
   and all three rows: Scenario, Resolution, Format. Offer NetCDF and GeoTIFF
   at native raster resolution (`resolution=native`); reject other resolutions
   rather than silently resample. Keep image export through the embed path.

## 5. Make the dataset and deployment repeatable

Files: `geoserver/`, `docker-compose.yml`, `.env.example`, production build
configuration, and deployment documentation.

1. Adapt the branch's publication script to use the existing coverage naming
   convention. Retain filenames as coverage IDs. Supply the native variable,
   units, and attribution needed for the files being published, without adding
   a second selection-to-coverage mapping. Validate files and naming before
   publication.
2. Supply a small reproducible fixture for local tests. Document how real NetCDF
   files are obtained and loaded; they are not included in the branch.
3. Use the existing remote GeoServer through the API environment settings.
   Compose runs no local GeoServer. Missing configuration affects maps only.
4. Configure persistent data, service networking, credentials, and
   `GEOSERVER_URL` in production. Identify and update the deployment manifests
   managed outside this repository before enabling maps there.
5. Smoke-test real publication, capabilities, and WCS retrieval. This checks our
   configuration and naming against the installed GeoServer version.

Initial acceptance dataset: Cameroon mean temperature, with two scenarios and
at least two common years. Further indicators/geographies require matching
files and metadata; generic adapter code alone does not provide that coverage.

## Order and completion checks

The numbered sections describe the work, not separate delivery stages. Complete
emissions from source query through the methodology chart and table first. Then
build one working map flow: a small published fixture using the existing naming
convention, availability/grid/download API, browser map, and real WCS smoke test.
Check real publication early so naming and raster assumptions are tested before
expanding coverage. Reuse branch functions and tests where they fit; do not merge
the branch wholesale.

For every feature, write tests before or alongside code. Each RED step must run
production code and fail on behaviour, not imports. Use the existing database
setup helpers and mock only external boundaries. Leave changes uncommitted.

Assign each behaviour to the smallest useful test layer. Do not repeat every
case at every layer or build every combination of selection inputs.

| Layer | Coverage |
|---|---|
| Pure logic | Unit conversion; emissions with zero/negative values, gaps and uneven years; exact 2050/2100 values; raster layout and nodata using a small TIFF fixture; compatible grid subtraction and missing values in either input. |
| API integration | Correct ixmp4/WCS requests and instance isolation; available years from matching coverage names; absence versus upstream failure; grid metadata; NetCDF and GeoTIFF attachments. Use a small boundary fake, not a fake GeoServer implementation. |
| Frontend integration | API-shaped emissions reaching the line and table; selection changes during loading; retry; one/two scenarios and shared years; an unsupported comparison; year changes fetching only the grid. |
| Complete flows | One map embed/image export flow and a real WCS publication, map, and NetCDF/GeoTIFF download check. |

Reuse the existing regression suites, including GMT and selection tests. Test
our requests, conversions, and visible results, not TIFF-library or GeoServer
internals. No new database migration tests are needed because this port changes
neither the schema nor the seed.

Before declaring the port complete:

- Run the API suite with PostgreSQL available, affected frontend tests using the
  existing runners, and the production build.
- Check a real map's values and units against its source raster, plus comparison,
  year changes, hidden unavailable sections, error states, retry, and image export.
  Download its NetCDF and GeoTIFF
  and check that selection, extent, resolution, units, and values match the raster
  used by the map.
- Check emissions values against source points, including 2050/2100, and verify
  the chart/table for two instances with overlapping scenario names.
- Verify Explore links, embeds, methodology, avoid, and EU scoreboard flows still
  work. Keep their current scoped requests; no `/catalog` request should return.
- Record the published dataset coverage and any external deployment work still
  pending. Production support is not complete until the real WCS smoke test passes.

The earlier review ran 34 focused branch tests successfully. GeoServer adapter
tests lacked `geotiff`, and database checks lacked PostgreSQL. Those checks must
be run in the port environment; the earlier results do not prove this port works.

### Download dialog restoration

The user requested both file formats and the previous dialog layout. The dialog
keeps its Scenario, Resolution, and Format rows. Resolution shows the native grid
size; the API accepts `resolution=native` and rejects other values. Grid rendering
still uses TIFF. Local GeoServer needs both `netcdf` and `netcdf-out` extensions.

Validation: 26 backend/bootstrap tests and 6 map component tests passed. Both
download routes returned HTTP 200 against the remote test layer: NetCDF returned
1,112 bytes with a CDF signature and `.nc` attachment; GeoTIFF returned 2,432 bytes
with a TIFF signature and `.tif` attachment. The shared dialog layout and styles
were left unchanged.

The user requested removal of the local GeoServer Compose services after the
remote checks passed. Compose retains the API connection settings; fixture and
publication tools remain available for separate test servers.

## Final whole-change review

Senior review approved the full change with no blockers. The fixture publication
check now sends its credentials when reading WCS capabilities. Before release,
measure a real country download: the current 15-second request timeout also
covers the streamed body and can interrupt a longer transfer.

Final checks: 339 API tests, 431 frontend Vitest tests, 133 frontend Bun tests,
and 2 fixture tests passed. The production build passed with existing package
warnings. The TIFF-to-JSON implementation remains unchanged; NetCDF decoding
performance is a separate follow-up.
