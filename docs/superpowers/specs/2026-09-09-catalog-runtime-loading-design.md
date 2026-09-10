# Catalog runtime loading

**Date:** 9 September 2026  
**Status:** Ready for review  
**Review:** `docs/architecture-review.md`

## Goal

Replace the full catalog load with small runtime requests. Support indicator-first
and geography-first selection with the same availability rule. Ship the change
once, after every catalog consumer uses the new flow.

Persistence and shared caching are outside this work. Pagination is also outside
this work unless measurement shows that the final unique indicator list is too
large.

## Rules

- Early availability means that at least one parameter combination has data.
- Exact parameter and scenario availability is checked after both main choices
  exist.
- Every indicator result includes its IXMP4 instance name.
- Every request that depends on an indicator requires that instance name.
- A missing or unknown instance returns an error. The API never chooses one.
- New resources and incoming URLs use canonical IDs.
- ID changes remain only at live old API boundaries that require them.
- Strapi may add text. It cannot replace IDs, units, parameters, ownership, or
  availability.
- Loading and failed requests preserve choices.
- A successful response clears a choice that it proves is incompatible.
- Older responses cannot update newer selection state.

## Initial data

The first page load requests the indicator and geography indexes in parallel.
Each request has its own loading, error, and retry state. One index can render
when the other fails.

### Indicator index

`GET /api/indicators`

Each entry has this shape:

```ts
type IndicatorIndexEntry = {
  id: string;
  label: string;
  unit: string;
  sector?: string;
  instance: string;
};
```

The response has this shape:

```ts
type FailedInstance = {
  instance: string;
  code: 'unavailable';
};

type IndicatorIndexResponse = {
  indicators: IndicatorIndexEntry[];
  failedInstances: FailedInstance[];
};
```

The route requests all configured IXMP4 instances in parallel. A failed instance
does not remove results from working instances. If at least one instance works,
the route returns `200` with `failedInstances`. If every instance fails, it
returns `503` with `{ error: 'Indicator sources unavailable' }`. Responses do
not contain credentials, upstream URLs, or raw errors.

The first version still lists and parses every IXMP4 variable. The work must
record scan time, response size, and unique indicator count. It must not claim
that all expensive IXMP4 work starts after selection. Do not add pagination,
persistence, or caching without evidence from those measures.

### Geography index

`GET /api/geographies` and `GET /api/geographies/types` keep their current
technical ownership. The SvelteKit loader joins them into the existing tree
shape. This data does not depend on Strapi or an indicator.

## Indicator filters

`GET /api/indicators` also owns advanced filter selection. It accepts the filter
keys registered by `FACET_KEYS` as comma-separated query values. `region` may be
present to combine geography-first availability with advanced filters.

When at least one advanced filter is present, the response adds ordered filter
groups:

```ts
type IndicatorFilterOption = {
  value: string;
  count: number;
};

type IndicatorFilterGroup = {
  key: string;
  label: string;
  color: string;
  options: IndicatorFilterOption[];
  selected: string[];
};

type FilteredIndicatorIndexResponse = IndicatorIndexResponse & {
  filters: IndicatorFilterGroup[];
};
```

Each option count applies the selected values from the other groups, matching the
current cascading filter behavior. The route returns full index entries rather
than a second list of IDs. Search remains a client operation over the returned
unique indicators.

## Availability and detail API

These Hono endpoints contain technical data only.

### Geography availability

`GET /api/geography-availability?indicator={id}&instance={instance}`

Both parameters are required. The response is:

```ts
type GeographyAvailabilityResponse = {
  geographyIds: string[];
};
```

A geography is included when any variable for the indicator has data there. The
route must not use one default or representative parameter combination.

### Indicator details

`GET /api/indicator-details/{id}?instance={instance}`

The instance is required. The response contains only technical fields needed
after indicator selection:

```ts
type IndicatorDetailsResponse = {
  id: string;
  instance: string;
  unit: string;
  parameters: Array<{
    id: string;
    label: string;
    options: Array<{ id: string; label: string }>;
  }>;
  models: string[];
  sources: string[];
  ixmp4Description?: string;
};
```

Do not include old IDs. The map adapter reads its required mapping at the old API
boundary.

### Scenario availability

`GET /api/scenario-availability`

Required query parameters are `indicator`, `region`, and `instance`. Supported
optional parameters are `reference`, `time`, `spatial`, and `axis`. `axis` is
`percentile` or `warmingLevel`; another value returns `400`.

```ts
type ScenarioAvailabilityResponse = {
  scenarios: Array<{
    id: string;
    label: string;
    yearStart?: number;
    yearEnd?: number;
  }>;
};
```

### Scenario details

`GET /api/scenario-details/{id}?instance={instance}`

The instance is required, so the scenario ID is source-bound. Strapi text is not
part of the Hono response.

```ts
type ScenarioCharacteristics = {
  gmtPeak?: [number, number];
  gmt2100?: number;
  gmt2300?: number;
  coolingRateAfterPeak?: number;
  coolingAfterPeak?: number;
};

type ScenarioDetailsResponse = {
  id: string;
  label: string;
  instance: string;
  yearStart: number;
  yearStep: number;
  yearEnd: number;
  gmt?: {
    data: Array<[number | null, number | null, number | null]>;
    yearStart: number;
    yearStep: number;
    yearEnd: number;
    model?: string;
    unit?: string;
  };
  characteristics: ScenarioCharacteristics;
};
```

### Methodology scenarios

`GET /api/methodology-scenarios`

This route returns `ScenarioDetailsResponse[]` for the methodology scenario
page. It requests each configured instance because the page shows a global list.
Every entry keeps its instance name. It does not merge equal names from different
instances.

This route replaces the methodology page's full catalog load. It is not a general
batch endpoint.

### API errors

Availability and detail routes return:

- `400` for a missing required query parameter or an invalid enum value;
- `404` for an unknown instance, indicator, or scenario;
- `502` when the selected IXMP4 instance cannot answer;
- `200` with an empty list when the request is valid but no data exists.

The response body is `{ error: string }`. It does not expose a raw upstream
error.

## SvelteKit app endpoints

Nginx sends `/api/*` to Hono, so SvelteKit server endpoints use `/app/*`.
Create an app endpoint only when the use case needs server-only work such as a
Strapi join.

### Indicator display details

`GET /app/indicator-details/{id}?instance={instance}` calls the matching Hono
indicator detail endpoint and requests the matching Strapi indicator text. It
returns the technical response with a final optional `description` field.
Strapi text wins over `ixmp4Description` only for that field. If Strapi fails or
has no match, `description` uses `ixmp4Description` or is absent.

### Scenario display details

`GET /app/scenario-details/{id}?instance={instance}` calls the matching Hono
scenario detail endpoint and requests the matching Strapi scenario text. It adds
only the description fields used by the requesting screen. A Strapi failure does
not fail the technical response.

If two screens need different data, they get separate use-case endpoints. Do not
reuse a broad endpoint when that makes either screen load fields it does not use.
Browser requests that need only technical data call Hono directly.

## Browser state

Keep index data, selected IDs, selected instance, and request state in focused
stores. Do not merge raw Strapi records into a shared store.

Each changing request uses:

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'failure'; error: string };
```

Each request also has an `AbortController` or increasing request ID. Starting a
request stops or makes every older request for that resource unable to write.

URL and local storage choices enter a pending state. The app validates them only
after the matching index or detail request succeeds. Loading and failure preserve
the pending and current choices. A successful response clears an incompatible
dependent choice:

- an indicator-index result filtered by geography clears an unavailable
  indicator;
- a geography-availability result clears an unavailable geography;
- indicator detail clears invalid parameter values;
- scenario availability clears invalid scenarios.

Clearing a main choice also clears detail and availability state that depends on
it. It must not reload the full catalog.

## Page migration

Migrate all current catalog consumers in the same change:

- the landing-page quick-start selector;
- future-impact exploration;
- embed views;
- methodology scenario pages;
- EU scoreboard pages;
- adaptation and other layouts that feed catalog-backed shared stores.

Each page loads only its first visible lists. Later data follows the active use
case. Pages that need a fixed complete list use a page-specific loader or
endpoint, not the former general catalog.

After every consumer has moved:

- remove `GET /api/catalog` and its cache;
- remove `loadCatalog`;
- remove full-catalog fields from page data and shared metadata stores;
- stop accepting old IDs in incoming URLs;
- keep ID mapping only where a live old API still requires it.

No compatibility layer or dual-read period is required because this is one
release.

## Failure behavior

- Indicator and geography indexes fail independently.
- Partial indicator-index failure shows working results and a retry message for
  unavailable sources.
- Detail and availability failure keeps the current selection and shows a local
  retry action.
- Missing optional text does not block selectors or charts.
- A confirmed empty success is different from loading or failure and may clear
  an incompatible choice.

## Testing

Use TDD. A new function or module starts with a production stub that matches the
broken behavior. The first test must run that code and fail on a behavior check,
not an import or compile error.

API integration tests cover:

- both selection orders return the same pairs, including data that exists only
  under a non-default parameter combination;
- dependent routes require a valid instance;
- filter groups, selected values, counts, and combined region filters;
- one failed instance returns a partial indicator index;
- every failed instance returns `503`;
- valid empty availability returns `200` with an empty list;
- detail and methodology response shapes contain only their use-case fields.

Browser-facing tests cover:

- a slow shared URL keeps pending choices until validation;
- a rapid A, B, clear sequence cannot be overwritten by A's late response;
- confirmed incompatibility clears the dependent choice;
- loading and failure do not clear choices;
- retry replaces a failed state with success;
- Strapi failure still returns and displays technical data;
- each migrated page performs only the requests its visible use case needs.

Use MSW when a browser-facing test needs a network boundary fake. Do not mock
pure logic or code owned by this project. Do not test Hono, SvelteKit, Strapi,
IXMP4, or MSW behavior. Test request arguments, owned response handling, and
user-visible results.

The final checks run the API suite, relevant browser tests, static checks, and a
production build. Record indicator scan time, response bytes, and unique
indicator count. Do not set a performance limit without a measured baseline.

## Implementation phases

All phases form one release. After each phase, a Sol senior code reviewer checks
the phase against this spec and `AGENTS.md`. Fix accepted findings before the
next phase. Then update the remaining plan tasks to match the code that now
exists.

1. Define contracts, shared availability rules, and baseline measures.
2. Add the Hono index, availability, detail, and methodology endpoints.
3. Add the required SvelteKit `/app/*` endpoints.
4. Add browser request state and selection behavior.
5. Migrate every catalog consumer.
6. Remove the full catalog and run final checks.

Do not commit, merge, push, or open a pull request unless the user asks.
