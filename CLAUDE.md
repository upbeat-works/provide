# PROVIDE

SvelteKit frontend + Hono/Cloudflare-Workers API. The catalog is **convention-driven**:
ixmp4 exposes only pipe-delimited variable names (`Indicator | Period | Temporal | Spatial | Value`),
and parsing those names IS the metadata — there is no hand-curated catalog layer.

## API architecture (`api/`)

Four layers, edges-do-I/O, core-is-pure:

- **`api/routes/*.ts`** — thin HTTP adapters. Read query params, pick the instance, call a
  resolver, `c.json(...)`. No ixmp4 logic beyond that.
- **`api/views/*.ts`** — per-view data resolvers (one per chart/endpoint: `impact-time`,
  `scenarios`, `unavoidable-risk`). Each resolves the naming convention → tabulates from ixmp4 →
  shapes the legacy response. Its **pure** assembly functions (`zipBands`, `alignBands`,
  `scenarioAvailabilityFromRows`, …) are unit-tested without touching ixmp4; I/O sits at the edge.
  A view module's response type lives with it (e.g. `ImpactTimeResponse` in `views/impact-time.ts`).
- **The language** — `conventions.ts` (parse/compose variable names), `tabulate.ts` (ixmp4
  DataFrame → rows/years), `util.ts`. Pure, domain-agnostic, shared by routes and views.
- **The connection** — `platform.ts` (createPlatform/createPlatforms), `instances.ts`/`.json`,
  `types.ts`. How to talk to ixmp4.

**Rule of thumb:** a route stays thin; pull data logic into `api/views/<view>.ts` when it has pure
functions worth testing in isolation (the impact-time/scenarios split), inline it when it's trivial
(meta/indicators/geographies do their small derivations in the route). Don't extract a module that
has one caller and nothing pure to test.

`api/curation/` holds transitional remnants (`likelihoods`, `study-locations`) not yet derivable
from conventions — shrink it, don't grow it.

## Tests

`bun test api/` (also `npm test`). Routes use MSW-free Hono `api.request(...)` with a test env;
view pure-functions are unit-tested directly. Tests live next to the code (`*.test.ts`).
