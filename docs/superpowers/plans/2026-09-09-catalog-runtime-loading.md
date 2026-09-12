# Catalog Runtime Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run tasks in order. Use Sol implementers and a Sol senior code reviewer at each phase gate.

**Goal:** Replace the full catalog load with small runtime requests while keeping both selection orders correct.

**Architecture:** Hono owns technical indexes, availability, and detail data. SvelteKit `/app/*` endpoints add server-only Strapi text for a named screen use case. Focused browser stores track request state, selected instance, and stale responses.

**Tech Stack:** Bun, TypeScript, Hono, IXMP4 SDK, PostgreSQL with Drizzle, SvelteKit 2, Svelte 4, MSW, Bun test, Vitest

**Spec:** `docs/superpowers/specs/2026-09-09-catalog-runtime-loading-design.md`

## Global Constraints

- Treat the six phases as one release. Do not keep a dual catalog path after phase 6.
- Run tasks and phases in order.
- After each phase, run a Sol senior code reviewer against the phase diff, this plan, the spec, and `AGENTS.md`.
- Fix accepted review findings before starting the next phase.
- After each phase, update all remaining file paths, interfaces, steps, and checks in this plan to match the code that exists.
- Use TDD. RED must run production code and fail on behavior, not imports or compilation.
- Prefer integration tests. Use MSW only at network boundaries.
- Do not test framework, SDK, browser, database, Strapi, IXMP4, or MSW behavior.
- Do not add pagination, persistence, shared caching, compatibility layers, or a general request framework.
- Do not use nested ternaries or behavior-switching boolean function arguments.
- Keep comments only for non-obvious constraints.
- Do not commit, merge, push, or open a pull request.

---

## Phase 1: Contracts, rules, and baseline

### Task 1: Catalog response contracts

**Files:**

- Create: `api/catalog/contracts.ts`
- Create: `api/catalog/contracts.test.ts`

**Interfaces:**

- Produces: `IndicatorIndexEntry`, `FailedInstance`, `IndicatorIndexResponse`, `IndicatorFilterGroup`, `IndicatorDetailsResponse`, `ScenarioAvailabilityResponse`, `ScenarioDetailsResponse`, and `RequestError`.
- Consumes: no application code.

- [ ] **Step 1: Add a production stub and a behavioral contract test**

Create `parseRequiredInstance` in `api/catalog/contracts.ts` as a stub that returns its input. Add a table-driven test that calls it with `undefined`, an unknown name, and `provide-internal`. Assert the first two return a `RequestError` and the last returns the configured instance.

```ts
export function parseRequiredInstance(value: string | undefined): Ixmp4Instance | RequestError {
  return value as never;
}
```

- [ ] **Step 2: Run RED**

Run: `bun test api/catalog/contracts.test.ts`

Expected: the assertions for missing and unknown instances fail after production code runs.

- [ ] **Step 3: Define the exact types and implement instance parsing**

Copy the response shapes from the spec without aliases for old `uid` fields. Implement:

```ts
export function parseRequiredInstance(value: string | undefined): Ixmp4Instance | RequestError {
  if (!value) return { status: 400, error: 'instance is required' };
  const instance = instances.find(({ slug }) => slug === value);
  if (!instance) return { status: 404, error: `Unknown instance: ${value}` };
  return instance;
}
```

- [ ] **Step 4: Run GREEN and the API type check**

Run: `bun test api/catalog/contracts.test.ts`

Run: `npx tsc --noEmit`

Expected: both commands pass.

### Task 2: One early-availability rule

**Files:**

- Create: `api/catalog/availability.ts`
- Create: `api/catalog/availability.test.ts`
- Modify: `api/routes/indicators.ts`
- Modify: `api/routes/geographies.ts`
- Test: `api/routes/indicators.test.ts`
- Test: `api/routes/geographies.test.ts`

**Interfaces:**

- Produces: `indicatorIdsFromVariableNames(names: string[]): string[]`.
- Produces: `geographyIdsForIndicator(platform, indicator: string): Promise<string[]>`.
- Consumes: `parseVariable` and the IXMP4 variable and region list methods.

- [ ] **Step 1: Stub the shared rule and add a non-default-data test**

The geography fixture must contain an indicator only under a non-default value such as `Seasonal|Point|95th Percentile`. Assert that geography-first and indicator-first checks both include the same pair. The stub returns an empty list, so the test imports and runs production code.

```ts
export async function geographyIdsForIndicator(): Promise<string[]> {
  return [];
}
```

- [ ] **Step 2: Run RED**

Run: `bun test api/catalog/availability.test.ts api/routes/indicators.test.ts api/routes/geographies.test.ts`

Expected: the non-default pair is missing from indicator-first availability.

- [ ] **Step 3: Implement the shared rule**

List variables whose names start with the selected indicator, collect every exact variable name, request regions for those variables, and return distinct region IDs. Do not call `representativeVariable`. Keep indicator discovery based on every matching variable.

- [ ] **Step 4: Move indicator filtering to the shared identifier helper**

Make `/api/indicators?region=` and the new geography rule use the same parsing and distinct-ID code. Keep response changes for phase 2.

- [ ] **Step 5: Run GREEN**

Run: `bun test api/catalog/availability.test.ts api/routes/indicators.test.ts api/routes/geographies.test.ts`

Expected: both selection orders include the non-default pair and all existing route cases pass.

### Task 3: Record the current index baseline

**Files:**

- Create: `docs/catalog-runtime-loading-measurements.md`

**Interfaces:**

- Produces: the baseline used to decide whether later work needs pagination or caching.
- Consumes: the current `/api/indicators` response.

- [ ] **Step 1: Start the existing API with normal local credentials**

Run: `bun run server.ts`

Expected: the API reports its local listening address.

- [ ] **Step 2: Measure a cold request**

Run in another shell:

```bash
curl --silent --output /tmp/provide-indicators.json --write-out 'seconds=%{time_total}\nbytes=%{size_download}\n' http://localhost:8080/api/indicators
jq '.indicators | length' /tmp/provide-indicators.json
```

Expected: the commands print request seconds, response bytes, and the unique indicator count.

- [ ] **Step 3: Write only the measured values and environment**

Record the date, local or deployed environment name, cold request seconds, bytes, and unique indicator count. Do not set a target or propose pagination from one result.

### Phase 1 gate

- [ ] Run `bun test api/catalog/ api/routes/indicators.test.ts api/routes/geographies.test.ts` and `npx tsc --noEmit`.
- [ ] Dispatch a Sol `senior-code-reviewer` for phase 1.
- [ ] Fix accepted findings and rerun the checks.
- [ ] Update phases 2–6 in this plan to match phase 1 names and signatures.

## Phase 2: Hono resources

### Task 4: Indicator index and advanced filters

**Files:**

- Modify: `api/routes/indicators.ts`
- Modify: `api/routes/indicators.test.ts`
- Modify: `api/facets.ts`
- Modify: `api/facets.test.ts`
- Modify: `api/test-helpers.ts`

**Interfaces:**

- Produces: `GET /api/indicators` as `IndicatorIndexResponse`, plus `filters` when filter query keys are present.
- Consumes: phase 1 contracts, `FACET_KEYS`, `fetchRunFacetData`, D1 indicator enrichment, and IXMP4 variable lists.

- [ ] **Step 1: Add failing route tests for the new public response**

Cover full index fields, two entries with the same ID from different instances,
one failed instance with a `200` partial result, every instance failed with
`503`, cascading counts, and a region plus filter query. Make one partial-failure
case fail during authentication or platform creation, before variables are
listed. Use MSW for IXMP4 calls and the real route with an isolated database.

```ts
expect(await res.json()).toEqual({
  indicators: [{ id: 'Heat', label: 'Heat', unit: 'days', sector: 'health', instance: 'provide-internal' }],
  failedInstances: [],
});
```

- [ ] **Step 2: Run RED**

Run: `bun test api/routes/indicators.test.ts api/facets.test.ts`

Expected: assertions fail because the route still returns `uid` entries and has no partial result.

- [ ] **Step 3: Implement per-instance results**

Create and load each instance inside its own settled operation. Do not call the
current `createPlatforms`, whose `Promise.all` fails before per-instance results
can settle. Map successful values to exact contract fields. Return a safe
failed-instance entry for each rejection. Return `503` only when none succeeds.

- [ ] **Step 4: Move cascading filters to the indicator route**

Reuse the pure filter calculation in `api/facets.ts`. Scope indicator identity by `{ id, instance }`; do not merge same-name indicators across instances. Keep filter keys and comma-separated values from `FACET_KEYS`. Remove the server-side `q` query path; search is a client operation over the returned index.

- [ ] **Step 5: Run GREEN**

Run: `bun test api/routes/indicators.test.ts api/facets.test.ts`

Expected: all indicator and filter use cases pass.

### Task 5: Geography and indicator detail resources

**Files:**

- Create: `api/routes/geography-availability.ts`
- Create: `api/routes/geography-availability.test.ts`
- Create: `api/routes/indicator-details.ts`
- Create: `api/routes/indicator-details.test.ts`
- Modify: `api/index.ts`
- Modify: `api/routes/geographies.ts`
- Modify: `api/routes/geographies.test.ts`

**Interfaces:**

- Produces: `GET /api/geography-availability?indicator=&instance=`.
- Produces: `GET /api/indicator-details/:id?instance=`.
- Consumes: phase 1 instance parsing and availability helpers.

- [ ] **Step 1: Create route stubs that return empty success bodies**

Register both routes so tests call production handlers. Return `{ geographyIds: [] }` and a minimal empty indicator detail response.

- [ ] **Step 2: Add failing integration tests**

Test required and unknown instances, non-default geography availability, valid empty success, exact parameter options, models, sources, IXMP4 description, and absence of old IDs.

- [ ] **Step 3: Run RED**

Run: `bun test api/routes/geography-availability.test.ts api/routes/indicator-details.test.ts`

Expected: route bodies fail their behavior assertions, not imports or route lookup.

- [ ] **Step 4: Implement geography availability**

Resolve the required instance, call `geographyIdsForIndicator`, intersect with known database geography IDs, and return `{ geographyIds }`.

- [ ] **Step 5: Implement indicator details**

Fetch variables and variable docs only from the required instance. Parse parameter dimensions, load citations for runs that contain the indicator, and return the exact contract. Keep D1 index enrichment out unless a returned field needs it.

- [ ] **Step 6: Remove indicator filtering from `/api/geographies`**

Delete its `indicator` query branch and its tests. `/api/geographies` remains the index; the new route owns availability.

- [ ] **Step 7: Run GREEN**

Run: `bun test api/routes/geography-availability.test.ts api/routes/indicator-details.test.ts api/routes/geographies.test.ts`

Expected: all tests pass.

### Task 6: Scenario resources

**Files:**

- Create: `api/routes/scenario-availability.ts`
- Create: `api/routes/scenario-availability.test.ts`
- Delete: `api/routes/scenarios.ts`
- Delete: `api/routes/scenarios.test.ts`
- Create: `api/routes/scenario-details.ts`
- Create: `api/routes/scenario-details.test.ts`
- Create: `api/routes/methodology-scenarios.ts`
- Create: `api/routes/methodology-scenarios.test.ts`
- Modify: `api/views/scenarios.ts`
- Modify: `api/views/scenarios.test.ts`
- Modify: `api/views/gmt.ts`
- Modify: `api/index.ts`

**Interfaces:**

- Produces: `GET /api/scenario-availability`.
- Produces: `GET /api/scenario-details/:id?instance=`.
- Produces: `GET /api/methodology-scenarios`.
- Consumes: phase 1 contracts and instance parsing, `fetchScenarioAvailability`, and `fetchGmt`.

- [ ] **Step 1: Move the availability route without changing behavior**

Update registration and existing tests to call `/api/scenario-availability`. Require `instance`; remove the first-instance fallback.

- [ ] **Step 2: Add detail and methodology stubs**

Register handlers that return empty success responses. This lets RED reach production handlers.

- [ ] **Step 3: Add failing integration tests**

Cover required instance, invalid axis, source-bound scenario lookup, exact GMT and characteristic fields, no Strapi text, global methodology entries retaining instance, and no cross-instance name merge.

- [ ] **Step 4: Run RED**

Run: `bun test api/routes/scenario-availability.test.ts api/routes/scenario-details.test.ts api/routes/methodology-scenarios.test.ts`

Expected: the new detail and methodology bodies fail their assertions.

- [ ] **Step 5: Implement scenario details**

Resolve the instance, load that instance's runs and GMT map, match the scenario case-insensitively inside that instance, and return `ScenarioDetailsResponse`. Return `404` when neither run nor GMT detail exists.

- [ ] **Step 6: Implement methodology scenarios**

Build details per instance and return one entry per `{ id, instance }`. Do not collapse equal names across instances. Keep only the fields in `ScenarioDetailsResponse`.

- [ ] **Step 7: Run GREEN and the phase suite**

Run: `bun test api/routes/scenario-availability.test.ts api/routes/scenario-details.test.ts api/routes/methodology-scenarios.test.ts api/views/scenarios.test.ts api/views/gmt.test.ts`

Expected: all tests pass.

### Phase 2 gate

- [ ] Run `bun test api/` and `npx tsc --noEmit`.
- [ ] Dispatch a Sol `senior-code-reviewer` for phase 2.
- [ ] Fix accepted findings and rerun the checks.
- [ ] Update phases 3–6 in this plan to match the delivered API.

## Phase 3: SvelteKit `/app` endpoints

**Phase 2 inputs:** The technical routes are `/api/indicator-details/:id?instance=`,
`/api/scenario-details/:id?instance=`, and `/api/methodology-scenarios`. Detail
requests require the selected instance. Scenario GMT bands contain nullable cells
for missing source values. A technical source failure returns a safe `502` body.

### Task 7: Server-side API and Strapi clients

**Files:**

- Create: `src/lib/server/catalog-api.js`
- Create: `src/lib/server/catalog-api.test.js`
- Create: `src/lib/server/catalog-content.js`
- Create: `src/lib/server/catalog-content.test.js`
- Modify: `src/lib/utils/apis.js`

**Interfaces:**

- Produces: `loadIndicatorTechnicalDetails(fetch, { id, instance })` for `/api/indicator-details/:id?instance=`.
- Produces: `loadScenarioTechnicalDetails(fetch, { id, instance })` for `/api/scenario-details/:id?instance=`.
- Produces: `loadIndicatorDescription(fetch, { id })` and `loadScenarioDescription(fetch, { id })`.
- Consumes: internal API and CMS environment URLs.

- [ ] **Step 1: Add production stubs and MSW-backed tests**

Tests assert exact encoded ID and instance query values, safe owned HTTP errors,
Strapi UID query, and `undefined` for missing or failed optional text. Include a
scenario response with a nullable GMT cell so the client does not turn a data
gap into zero.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/server/catalog-api.test.js src/lib/server/catalog-content.test.js`

Expected: returned stubs fail response and request assertions.

- [ ] **Step 3: Implement focused clients**

Use named object arguments. Keep technical and editorial clients separate.
Preserve the technical HTTP status in a small owned error. Do not expose raw
upstream bodies or source errors.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/lib/server/catalog-api.test.js src/lib/server/catalog-content.test.js`

Expected: all tests pass.

### Task 8: Indicator and scenario display endpoints

**Files:**

- Create: `src/routes/app/indicator-details/[id]/+server.js`
- Create: `src/routes/app/indicator-details/[id]/server.test.js`
- Create: `src/routes/app/scenario-details/[id]/+server.js`
- Create: `src/routes/app/scenario-details/[id]/server.test.js`

**Interfaces:**

- Produces: `GET /app/indicator-details/:id?instance=`.
- Produces: `GET /app/scenario-details/:id?instance=`.
- Consumes: task 7 clients.

- [ ] **Step 1: Register empty handlers and add failing endpoint tests**

Assert required instance forwarding, Strapi text replacing only description,
IXMP4 fallback text, successful technical data when Strapi fails, technical
error status propagation, and preservation of nullable GMT cells.

- [ ] **Step 2: Run RED**

Run: `npx vitest run 'src/routes/app/indicator-details/[id]/server.test.js' 'src/routes/app/scenario-details/[id]/server.test.js'`

Expected: merge behavior assertions fail after the handlers run.

- [ ] **Step 3: Implement the two joins**

Use `Promise.allSettled` only for optional Strapi text. Await technical data as required. Return exact public shapes and no raw Strapi records.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run 'src/routes/app/indicator-details/[id]/server.test.js' 'src/routes/app/scenario-details/[id]/server.test.js'`

Expected: all endpoint tests pass.

### Phase 3 gate

- [ ] Run `npx vitest run src/lib/server/catalog-api.test.js src/lib/server/catalog-content.test.js 'src/routes/app/indicator-details/[id]/server.test.js' 'src/routes/app/scenario-details/[id]/server.test.js'`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Dispatch a Sol `senior-code-reviewer` for phase 3.
- [ ] Fix accepted findings and rerun the checks.
- [ ] Update phases 4–6 in this plan to match the delivered app endpoints.

## Phase 4: Browser request and selection state

**Phase 3 inputs:** Browser detail loads use
`/app/indicator-details/:id?instance=` and
`/app/scenario-details/:id?instance=`. Both require a non-empty instance. They
return final display descriptions, safe technical error status codes, and
nullable scenario GMT cells. Browser stores must not call Strapi or the Hono
detail routes directly.

### Task 9: Request-state primitive

**Files:**

- Create: `src/stores/request-state.js`
- Create: `src/stores/request-state.test.js`

**Interfaces:**

- Produces: `createLatestRequest(load)` with `state`, `run(input)`, and `clear()`.
- Consumes: a promise-returning load function.

- [ ] **Step 1: Add a stub and behavior tests**

Test idle, loading, success, failure, clear, and A–B–clear where A finishes last. Call only the public factory.

```js
export function createLatestRequest() {
  return { state: readable({ status: 'idle' }), run() {}, clear() {} };
}
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/stores/request-state.test.js`

Expected: loading and late-response assertions fail.

- [ ] **Step 3: Implement the latest-request rule**

Use an increasing request ID. `run` records loading, then success or failure only when its ID is current. `clear` increases the ID and sets idle. Do not add retry flags; callers retry by calling `run` again.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/stores/request-state.test.js`

Expected: all public behavior tests pass.

### Task 10: Runtime catalog stores and selection reconciliation

**Files:**

- Create: `src/stores/runtime-catalog.js`
- Create: `src/stores/runtime-catalog.test.js`
- Modify: `src/stores/scenario-selection.js`
- Modify: `src/stores/scenario-selection.test.js`
- Modify: `src/stores/state.js`
- Modify: `src/stores/meta.js`
- Modify: `src/lib/utils/url.js`

**Interfaces:**

- Produces: index, detail, availability, filter, and selected-instance stores.
- Produces: `reconcileConfirmedSelection({ current, allowed })` returning the current value or an empty value.
- Consumes: task 9 `createLatestRequest`, phase 2 index and availability
  endpoints, and the two phase 3 `/app` detail endpoints.

- [ ] **Step 1: Stub reconciliation and add user-flow tests**

Cover a slow shared URL, failure preserving choices, successful empty results clearing choices, selected instance traveling with the indicator, invalid parameter clearing after details, invalid scenario clearing after availability, and late response rejection.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/stores/runtime-catalog.test.js src/stores/scenario-selection.test.js`

Expected: confirmed incompatibility remains selected under current scenario rules.

- [ ] **Step 3: Implement focused runtime stores**

Keep raw Strapi data out. Keep final app-endpoint descriptions on detail
results. Pass `{ id, instance }` together for every detail load, and include
the instance in every source-bound availability request. Treat nullable GMT
cells as missing data. Split request functions by resource; do not add a
behavior flag.

- [ ] **Step 4: Change scenario reconciliation**

Preserve choices for idle, loading, and failure. On success, filter scenarios to allowed IDs; use defaults only when the confirmed current selection becomes empty.

- [ ] **Step 5: Make URL values pending**

Parse canonical IDs only. Hold them until matching index and detail success. Remove legacy matching from inbound URL resolution while keeping outbound old-API translation functions.

- [ ] **Step 6: Run GREEN**

Run: `npx vitest run src/stores/runtime-catalog.test.js src/stores/scenario-selection.test.js src/lib/catalog/translate.test.js`

Expected: request state, automatic clearing, and canonical URL tests pass.

### Phase 4 gate

- [ ] Run `npx vitest run src/stores src/lib/catalog/translate.test.js`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Dispatch a Sol `senior-code-reviewer` for phase 4.
- [ ] Fix accepted findings and rerun the checks.
- [ ] Update phases 5–6 in this plan to match the delivered stores.

## Phase 5: Consumer migration

**Phase 4 inputs:** Use the public `runtimeCatalog` methods
`loadIndicatorIndex`, `loadFilterGroups`, `loadFilteredIndicators`,
`loadGeographyIndex`, `loadGeographyAvailability`, `loadIndicatorDetails`,
`loadPercentileAvailability`, `loadWarmingLevelAvailability`, and
`loadScenarioDetails`. Selection methods are `selectIndicator`,
`selectGeography`, `selectParameters`, and `selectScenarios`. An indicator is
always `{ id, instance }`. Request stores expose `idle`, `loading`, `success`,
or `failure`; page code must not turn loading or failure into an empty success.

### Task 11: Landing and explore flows

**Files:**

- Modify: `src/routes/(default)/+page.server.js`
- Modify: `src/routes/(default)/+page.svelte`
- Modify: `src/routes/(default)/landing-page/sections/SectionExplore.svelte`
- Modify: `src/routes/(default)/impacts/explore/+page.server.js`
- Modify: `src/routes/(default)/impacts/explore/+page.svelte`
- Modify: `src/routes/(default)/impacts/components/ShareLink/ShareLink.svelte`
- Modify: `src/routes/(default)/impacts/explore/components/ImpactTime/ImpactTime.svelte`
- Modify: `src/routes/(default)/impacts/components/UnavoidableRisk/UnavoidableRisk.svelte`
- Modify: `src/lib/components/controls/IndicatorSelection.svelte`
- Modify: `src/lib/components/controls/GeographySelection/GeographySelection.svelte`
- Modify: `src/lib/components/controls/ScenarioSelection/ScenarioSelection.svelte`
- Modify: `src/routes/(default)/impacts/explore/components/IndicatorFilters.svelte`
- Modify: `src/stores/state.js`
- Modify: `src/stores/meta.js`
- Test: `src/routes/(default)/catalog-flow.test.js`

**Interfaces:**

- Produces: working quick-start and explore selection through runtime stores.
- Consumes: phase 4 stores and phase 2/3 routes.

- [ ] **Step 1: Add MSW-backed flow tests**

Automate how a user chooses geography first, indicator first, changes parameters,
retries a failed detail, applies the first advanced filter, and keeps using one
index when the other index fails on first load. Cover percentile and
warming-level availability at the same time. Assert visible choices and owned
request URLs, not component internals.

- [ ] **Step 2: Run RED**

Run: `npx vitest run 'src/routes/(default)/catalog-flow.test.js'`

Expected: the page still depends on loader `catalog` data and misses runtime requests.

- [ ] **Step 3: Migrate landing-page loading**

Start `loadIndicatorIndex`, `loadFilterGroups`, and `loadGeographyIndex`
independently beside the landing page editorial content. Keep their request
states and failures separate. Do not fetch details before a choice needs them.

- [ ] **Step 4: Migrate explore and controls**

Move the `state.js` and `meta.js` adapters from `$page.data.catalog` and the old
catalog routes to the runtime stores. Read those adapters in the controls, show
their loading or retry state, and pass selected instance on every dependent
request and every shared or graph URL. Store and restore `{ id, instance }`
together. Keep chart data requests unchanged except for reading the new detail
shape. Call `loadPercentileAvailability` and `loadWarmingLevelAvailability`
independently so both charts retain their own result. Remove nested ternaries in
touched selection flow code.

- [ ] **Step 5: Run GREEN**

Run: `npx vitest run 'src/routes/(default)/catalog-flow.test.js'`

Expected: both selection orders and retry pass.

### Task 12: Methodology and remaining consumers

**Files:**

- Modify: `src/routes/(default)/methodology/key-terms/+layout.server.js`
- Modify: `src/routes/(default)/methodology/key-terms/+page.server.js`
- Modify: `src/routes/(default)/methodology/key-terms/+page.svelte`
- Modify: `src/routes/(embed)/+layout.server.js`
- Modify: `src/routes/(embed)/embed/[embed]/+page.svelte`
- Modify: `src/routes/(default)/adaptation/+layout.server.js`
- Modify: `src/routes/(default)/projects/eu-scoreboard/+layout.server.js`
- Modify: `src/routes/(default)/projects/eu-scoreboard/+page.svelte`
- Modify: `src/routes/(default)/projects/eu-scoreboard/indicators/+page.svelte`
- Modify: `src/routes/(default)/case-studies/+layout.server.js`
- Modify: `src/routes/(default)/case-studies/+page.server.js`
- Modify: `src/routes/(default)/case-studies/[slug]/+page.server.js`
- Test: `src/routes/catalog-consumers.test.js`

**Interfaces:**

- Produces: no consumer of `loadCatalog` or `$page.data.catalog`.
- Consumes: methodology scenario endpoint, index loaders, and runtime stores.

- [ ] **Step 1: Add consumer-level request tests**

Assert methodology requests only methodology scenarios. Assert embeds and
adaptation load geography and indicator indexes, global scenario data, and their
existing curation data. Assert scoreboard loads geography and indicator indexes
plus global scenarios. Assert case studies load those same three indexes plus
their existing curation data. Assert embed URL choices and chart state use the
same runtime selection, including the instance. Assert no tested page requests
`/api/catalog`.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/routes/catalog-consumers.test.js`

Expected: current loaders request `/api/catalog`.

- [ ] **Step 3: Migrate methodology**

Bind its scenario components to the dedicated result rather than global scenario stores. Keep its Strapi and curation loads only where the page renders them.

- [ ] **Step 4: Migrate embeds, adaptation, scoreboard, and case studies**

Replace each broad catalog load with the existing geography and indicator index
loaders plus `/api/methodology-scenarios` where the page needs a fixed global
scenario list. Bind scoreboard and case-study children to those named results.
Embed and adaptation views use runtime details after selection. Do not add
another combined endpoint.

- [ ] **Step 5: Run GREEN and search for remaining consumers**

Run: `npx vitest run src/routes/catalog-consumers.test.js`

Run: `rg -n "loadCatalog|data\\.catalog|\\$page\\.data\\?\\.catalog" src`

Expected: tests pass and the search returns no live consumer.

### Phase 5 gate

- [ ] Run all Vitest files, `npx tsc --noEmit`, and `npm run build`.
- [ ] Dispatch a Sol `senior-code-reviewer` for phase 5.
- [ ] Fix accepted findings and rerun the checks.
- [ ] Update phase 6 in this plan to match the completed migration.

## Phase 6: Remove the full catalog and verify the release

### Task 13: Migrate content, then delete broad and legacy input paths

**Files:**

- Delete: `api/routes/catalog.ts`
- Delete: `api/routes/catalog.test.ts`
- Modify: `api/index.ts`
- Modify: `api/test-setup.ts`
- Modify: `src/lib/utils/apis.js`
- Modify: `src/stores/meta.js`
- Modify: `src/lib/catalog/translate.js`
- Modify: `src/lib/catalog/translate.test.js`
- Modify: `src/routes/(default)/impacts/explore/+page.svelte`
- Modify: `src/routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte`
- Modify: `src/routes/(default)/case-studies/[slug]/+page.server.js`
- Modify: `src/lib/server/case-study-avoiding.js`
- Modify: `src/routes/(default)/impacts/avoid/+page.svelte`
- Modify: `src/routes/(default)/impacts/avoid/components/AvoidShareLink.svelte`
- Modify: `cms/src/components/future-impacts/impact-geo.json`
- Modify: `cms/src/components/future-impacts/impact-time-snapshot.json`
- Modify: `cms/src/components/avoiding-impacts/indicator.json`
- Create: `cms/scripts/lib/catalog-reference-migration.js`
- Create: `cms/scripts/lib/catalog-reference-migration.test.js`
- Create: `cms/database/migrations/2026.09.10T00.00.00.canonical-catalog-references.js`
- Test: `src/lib/catalog/case-study-explorer-url.test.js`
- Test: `src/lib/server/case-study-avoiding.test.js`

**Interfaces:**

- Removes: `GET /api/catalog`, `loadCatalog`, and incoming legacy ID resolution.
- Produces: one checked CMS migration from the eight known legacy indicator IDs
  to exact canonical `{ id, instance }` references and canonical Explorer URLs.
- Keeps: explicit ID translation only at live old map and avoiding API calls.

- [ ] **Step 1: Add final absence and canonical-ID behavior tests**

Assert `/api/catalog` returns `404`, incoming old indicator and geography IDs do
not resolve, canonical IDs plus instance do resolve, and old map and avoiding
API calls still receive translated IDs.

- [ ] **Step 2: Run RED**

Run: `bun test api/index.test.ts`

Run: `npx vitest run src/lib/catalog/translate.test.js`

Expected: the catalog route still exists and incoming old IDs still resolve.

- [ ] **Step 3: Remove the broad paths**

Delete route registration, cache reset, loader, broad store fields, and dead helpers. Remove comments that describe the deleted catalog or a completed move.

- [ ] **Step 4: Add and verify the one-shot CMS migration**

Add required `Instance` strings beside indicator fields in the two future-impact
snapshot components and the avoiding-impact indicator component. Build one pure
migration plan from the eight checked legacy IDs to canonical IDs and the exact
configured instance. Rewrite snapshot and avoiding rows, and rewrite Explorer
URLs to canonical geography, indicator, instance, scenarios, and parameter
values. Reject the whole migration plan when any value is unmapped or any
rewritten indicator lacks an instance. Test the pure plan with repository-shaped
fixtures before wiring the idempotent Strapi boot migration. Because boot
migrations run before Strapi schema sync, the migration must add all three
`instance` columns before writing them. Do not keep dual reading after the
migration.

- [ ] **Step 5: Narrow ID translation at live old API boundaries**

Keep separate functions used by live old map and avoiding API boundaries. Make
`/impacts/avoid` accept canonical indicator plus instance and translate only
when calling the old API. Join case-study references by exact ID and instance.
Remove old-ID matching from inbound URL functions and delete tests that preserve
that compatibility.

- [ ] **Step 6: Run targeted GREEN checks**

Run: `bun test api/index.test.ts`

Run: `npx vitest run src/lib/catalog/translate.test.js`

Run: `node --test cms/scripts/lib/catalog-reference-migration.test.js`

Expected: canonical input, one-shot content migration, and live boundary
translation pass.

### Task 14: Full verification and final measures

**Files:**

- Modify: `docs/catalog-runtime-loading-measurements.md`
- Modify: `docs/superpowers/plans/2026-09-09-catalog-runtime-loading.md`

**Interfaces:**

- Produces: evidence that the one-release migration is ready for user review.
- Consumes: every prior task.

- [ ] **Step 1: Run all automated checks**

Run: `bun test api/`

Run:

```bash
npx vitest run \
  src/lib/catalog/case-study-explorer-url.test.js \
  src/lib/catalog/methodology-scenarios.test.js \
  src/lib/catalog/translate.test.js \
  src/lib/server/catalog-api.test.js \
  src/lib/server/catalog-content.test.js \
  src/lib/server/case-study-avoiding.test.js \
  src/lib/utils/url.test.js \
  'src/routes/(default)/case-studies/[slug]/sections/ExplorerLink.ssr.test.js' \
  'src/routes/(default)/catalog-flow.test.js' \
  'src/routes/(default)/projects/eu-scoreboard/indicators/page.ssr.test.js' \
  'src/routes/app/indicator-details/[id]/server.test.js' \
  'src/routes/app/scenario-details/[id]/server.test.js' \
  src/routes/catalog-consumers.test.js \
  src/stores/catalog-adapters.test.js \
  src/stores/facet-selection.test.js \
  src/stores/owned-indicator-index.test.js \
  src/stores/request-state.test.js \
  src/stores/runtime-catalog.test.js \
  src/stores/scenario-selection.test.js
```

Run: `npx tsc --noEmit`

Run: `npm run build`

Expected: every command exits zero.

- [ ] **Step 2: Check removed and forbidden patterns**

Run:

```bash
rg -n "loadCatalog|/api/catalog|data\.catalog|representativeVariable\(indicator\)|Unknown instance.*instances\[0\]" api src
```

Expected: no broad catalog consumer, representative geography probe, or default-instance fallback remains. References in explicit route-absence tests are allowed.

- [ ] **Step 3: Measure the final cold index**

Run the phase 1 curl and `jq` commands against the final local API. Add final seconds, bytes, and unique indicator count beside the baseline. State facts only; do not add pagination or caching unless the user opens that work.

- [ ] **Step 4: Check the plan record**

Mark completed steps. Confirm every phase review finding is either fixed or recorded with the user's decision. Confirm no pending plan edits remain.

### Phase 6 gate

- [ ] Dispatch a Sol `senior-code-reviewer` for phase 6 and the whole change.
- [ ] Fix accepted findings.
- [ ] Rerun all task 14 checks and record their results.
- [ ] Present the uncommitted change and evidence to the user.
