# EU scoreboard implementation

## Agreed behavior

- The overview shows the existing 40 NUTS0 countries and mock ranking. Every
  country polygon is selectable; ranking rows require a score and a boundary.
- Polygon and ranking links select a country. The indicators tab keeps a valid
  country or defaults to Austria. The map fits that country's NUTS0 bounds even
  while data loads or when it is absent.
- Each sector has `map` and `charts` keys. Map indicators use `name`, `type` and,
  for choropleths, `level` (`NUTS1` or `NUTS2`). No indicator ID, title, model,
  variable or unit fields. Raster work is deferred.
- Both sectors start with Maximum Air Temperature and Mean Air Temperature at
  NUTS2, scenarios CurrentPolicies and 1.5C, and years 2020, 2030, 2050, 2100.
  The default year is 2050. Scenario config stores IDs; optional localized Strapi
  labels fall back to IDs. Choices come from shared config, with no options API.
- Map series use annual absolute values, area and the 50th percentile. Read
  variable, model and unit from ixmp4. Assume one model per variable; add no
  model selector, config field or mixed-model check (review issue 2 rejected).
- Use maintained, pinned NUTS files unchanged. Filter by CNTR_CODE and level;
  join ixmp4 `region` to NUTS_ID. Missing regions stay empty; zero is valid.
- Keep country/scenario/year shared with charts. Testing's stacked bar and
  bubble use a fixed `data.regions` list of Austria, Germany and France.
  Their scenario and year still follow the filters.
- Map requests include sector, indicator, country, scenario and year. Ignore old
  results, support comparison and retry, and preserve independent chart embeds.

## Phase 1: Config and data API

**Status:** Complete. Senior review approved with no blockers.

Sol owns the sector config, shared country and choice helpers, regional boundary
loader, map endpoint, chart region override and their API tests. Remove the
options endpoint and obsolete map config/data paths. Add the optional Strapi
Label field. Keep shared resources inside `api` so its package builds alone.

Prove configured requests, country/level scope, NUTS_ID matching, returned
metadata, missing/zero values, boundary failures/retries and fixed chart regions.
Use behavioral RED tests and then pass the relevant API suites and package build.
Frontend callers are migrated in phase 2; do not add a compatibility layer.

A Sol senior code reviewer reviews this phase. Resolve findings before phase 2.

## Phase 2: Filters, navigation and map rendering

**Status:** Complete. Senior review approved with no blockers.

Sol owns the Svelte loaders, optional CMS labels, filters, request helpers,
overview links, regional rendering and comparison state. Remove options-fetch
failure states. Fit country outlines independently of value requests. Include
the indicator in map requests without requiring it for charts or embeds.

Test all three entry paths, local choices and label fallback, level changes,
empty/loading/error map outlines, stale responses, retry and comparison. Keep
tests at our network and Mapbox boundaries.

The shared URL uses `sector`, `indicator` (the short name), `region` (the country
name), `scenario` and `year`. Chart URLs require only the existing chart fields.
Keep the country lookup independent of ranking scores so unscored polygons open
their country too. Filter the ranking to countries that have NUTS0 boundaries.

Check these flows:

- Open the indicators tab with no country, then with a valid country in the URL.
- Open a ranked country and an unscored polygon; both fit the chosen country.
- Switch indicator and country while earlier requests are pending. Only the
  current values and boundaries may be shown.
- Load Ukraine with no regional boundaries. Keep its country outline and show
  no data. Retry a failed request without losing a ready chart.
- Compare countries, scenarios and years, then change indicator or sector.
  Each side must use the current indicator and country bounds.
- Open an existing chart embed without an indicator parameter.

A Sol senior code reviewer reviews this phase. Resolve findings before phase 3.

## Phase 3: Integration, cleanup and checks

**Status:** Complete. Final senior review approved; its doc correction is applied.

Sol checks the complete flow, removes unused map paths/assets where safe, updates
the scoreboard docs, and fixes integration gaps. Run the relevant API and web
suites, API package build and production web build. Check a live NUTS2 country
flow in a browser if the local services are available; cover NUTS1 with fixtures
because the checked source has no NUTS1 indicator series.

A Sol senior code reviewer reviews the final changes. Resolve findings and
report checks and any limits. No commits, pushes or PRs.

## Progress and review results

Record each phase's changes, checks, review findings and next-phase adjustments
here before starting the next phase.

- Baseline: the scoreboard web suite passes (12 files, 93 tests).
- Baseline: the production web build passes.
- Local PostgreSQL is running; no project Docker services are running. The final
  browser check will need local web/API processes.
- Phase 1: behavioral RED produced 7 helper failures and 8 endpoint failures.
  GREEN passes 26 tests with 75 assertions across 8 files, including the API-only
  package build. `git diff --check` passes.
- Live phase 1 check: Maximum Air Temperature / CurrentPolicies / Austria /
  2050 returns HTTP 200, all nine Austrian NUTS2 regions, the agreed full variable,
  model RIME-X v1.0.0 and unit °C. This used the real pinned boundary source and
  ixmp4 through the new API route.
- Phase 1 contract: `getScoreboard(sector, indicator)` returns
  `{instance, sectors, sector, map, charts, indicator}`. The shared
  `resolveScoreboardChoices` returns primitive `{indicator, scenario, region,
  year}` values. `SCOREBOARD_COUNTRIES` contains `{name, iso3, code}` records.
- Regional helpers in `api/scoreboard/boundaries.ts` expose `boundarySource`,
  `filterRegionalBoundaries` and `loadRegionalBoundaries(countryCode, level,
  fetcher?)`. Map responses contain `{definition, status, values, metadata}`;
  values are `{region, value}`, metadata contains variable/model/unit and is
  null for no rows.
- Phase 2 adjustment: migrate all frontend `.definitions` and `.mapDefinition`
  users to `.charts` and `.indicator`; build UI options from `.map`. Split Sol
  ownership between page/filter/request wiring and map components so each can
  use the reviewed data contract without editing the other's files.
- Phase 1 senior review: approved, with no blockers or required changes. Retain
  the planned NUTS1 fixture check. Phase 2 starts against this approved contract.
- Phase 2: each worker recorded behavioral RED before implementation. Combined
  scoreboard, catalog-label, catalog-consumer and embed server checks pass:
  136 tests across 21 files, plus 6 Bun comparison tests. NUTS1 and NUTS2 fixtures
  now cover raw GeoJSON joins, level changes and stale boundary responses.
- Phase 2 parent check found and resolved a CMS timeout gap: the timeout now
  covers both response headers and body and aborts the request.
- Phase 2 browser check found Vite denying browser imports of the shared API
  modules. The scoped file access fix preserves Kit's defaults and passed module
  transform checks, 25 affected tests and senior review. The browser now renders
  Austria's regional values with the returned model and units and no errors.
- Phase 2 senior review: approved with no blockers. The browser check uses its
  own Vite dependency cache to avoid interference from SSR test servers.
- Phase 3 adjustment: NUTS1 fixture coverage is already complete. Focus on current
  docs, unused R9 map assets, shared-helper regressions and the production build.
  The parent will check live navigation, indicator changes, comparisons and
  Ukraine's empty state. Do not repeat the finished unit checks without cause.
- Phase 3: current map, runtime and chart config docs match the implementation;
  older plans are marked historical. The unused R9 map asset is removed; R9 chart
  config and helpers remain.
- Final checks: production build passes; full web suite passes 467 tests across
  63 files; full API suite passes 346 tests with 794 assertions across 46 files.
  The API run needed local network access for PostgreSQL after a sandbox block.
  `git diff --check` passes.
- Live browser checks pass for Austria NUTS2, switching to Mean Air Temperature,
  comparison with Germany on one scale, and Ukraine's fitted outline with no
  regional data. No browser errors were reported in these flows.
- All three live entry paths pass: the tab opens Austria from a fresh overview;
  the Spain ranking link opens Spain with regional values; clicking unscored
  Turkey opens its country view and no-data state.
- Phase 3 senior review approved with one doc comment. The chart config guide
  now correctly describes the `charts` array within each sector JSON object.
  No code blockers remain. All changes are uncommitted.

## Follow-up: working chart examples

The user chose four working climate chart types for the existing map filters.
Replace Testing's three empty population/GDP examples with a mean-temperature
line, high-heat-risk bars, and temperature bubbles sized by high-heat-risk days.
Keep the maximum-temperature range chart. Bars and bubbles use fixed Austria,
Germany and France scopes; lines follow the selected country. No scenario mapping
or chart-query changes are needed. The bars use one series, not summed temperatures.

Live candidate checks through the chart reader and renderer pass for all four
types with Testing / CurrentPolicies / Austria / 2050. The population/GDP examples
were empty because IMAGE uses SSP-suffixed scenario names and R9 geography.
The new examples use verified RIME-X data. Correct conventional variable labels
so legends and bubble axes identify the indicator rather than its percentile.

Sol owns the config/reader checks and the label fix in separate files. Review
the joined change with the senior reviewer before handoff. Keep historical review
decisions intact; update the current chart guide with the working filter set.

Completed checks:
- Behavioral RED: three route failures and two chart-label failures.
- GREEN: 27 API tests with 80 assertions and 140 web tests pass. The API package
  and production web builds pass.
- Live saved-config requests return data for all four charts with Testing /
  Maximum Air Temperature / Austria / CurrentPolicies / 2050. The built page
  displays all four charts without browser errors. Bars and bubbles each show
  the three fixed countries.
- Senior review approved with no required changes. Changes remain uncommitted.

## Follow-up: development proxy failure

The Docker development page returned HTML successfully but showed 500 after
browser module loading failed. Vite's shared `/api/` source imports reached
the backend through nginx and returned 404. The earlier production browser
check did not cover this development route.

Route only the seven shared source files to Vite in the development proxy.
Keep data endpoints on the backend. Sol owns the proxy change and its live
regression check; the parent checks the browser and requests senior review.

- RED: all seven source requests returned 404. The backend map validation
  request returned its expected 400 JSON response.
- The user's Mean Air Temperature / CurrentPolicies / Austria / 2100 data
  requests already pass: nine map regions and all four charts are ready.
- GREEN: all seven modules return Vite JavaScript through the proxy; backend
  validation still returns 400 JSON. nginx config validation and reload pass.
- The exact reported URL now displays its map and four charts in the browser.
  All five data requests return 200, with no browser errors.
- Senior review approved with no required changes. Changes remain uncommitted.

## Follow-up: socioeconomic examples

Add `socioeconomic.json` and a Socioeconomic sector choice. Verify population,
GDP and heat-vulnerability values against live default runs before selecting
references, scenarios and years. Keep chart regions fixed and state their scope.

No supported NUTS map series was found; use an empty map indicator list.
Keep the selected country outline with a clear note, omit map requests and
map-only controls, and continue loading the sector's charts. Do not configure
a variable known to have no map values.

Sol owns live data checks and chart config/tests. A second Sol worker owns the
page and loader behavior for an empty map list. The parent owns registration,
shared choice handling, the development proxy route, docs and browser checks.
Review the combined change with the senior code reviewer before handoff.

- Shared choice RED exposed a crash for an empty map indicator list. GREEN
  passes all four controller tests after making indicator selection optional.
- Live source checks found data for all seven IMAGE 3.4 variables, nine R9
  regions, four SSP scenarios and 2020/2030/2050/2100. No population/GDP name
  matches the current regional map query.
- Registration RED exposed fallback to Heat stress; GREEN passes five
  controller tests, including changing from climate to socioeconomic filters.
- The new config file failed the proxy check before its exact route was added.
  All eight shared modules and the backend validation request now pass.
- All four saved chart definitions return ready data for nine regions through
  the local API with CurrentPolicies_SSP1 / Austria / 2050.
- Frontend RED found three failures: unwanted map requests, map-only controls,
  and comparison requests after losing the indicator. GREEN passes 23 focused
  tests, followed by 117 scoreboard web tests across 18 files.
- The production build passes. The browser renders all four charts without
  errors or map-data requests. Switching from an active Testing comparison to
  Socioeconomic clears comparison and selects the valid SSP scenario.
- Combined scoreboard API checks pass 29 tests with 105 assertions; the
  standalone API package build also passes.
- Senior review requested two fixes before handoff: return a controlled result
  for direct map requests to a sector without indicators, and give the bubble
  axes clear population/GDP labels. Sol workers own those fixes and regression
  tests in separate server and chart files; review them again before completion.
- Review fixes pass: nine server/controller route tests cover missing and stale
  map indicators; 23 adapter tests cover optional display labels and fallback;
  the two socioeconomic API tests still use the exact source references.
  Both direct map requests return 200 with `unavailable` in the running app.
- The final production build passes. A browser reload shows all four charts,
  clear GDP and heat-vulnerable population axis labels, and no errors.
- Senior re-review approved with no remaining findings. No commit was created.
