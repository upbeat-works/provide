# PROVIDE

SvelteKit frontend + Hono API (Node/Bun runtime). The catalog is **convention-driven**:
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
(catalog/indicators/geographies do their small derivations in the route). Don't extract a module that
has one caller and nothing pure to test.

**Catalog slices, not a god-endpoint.** The catalog surface is split by domain + cost, and each is
loaded only by the sections that use it (never the global layout): `/geographies` (+ `/types`) — the
selectable place tree, pure D1, cheap; `/catalog` — convention-derived indicators + their parameter
dimensions + the scenario universe, the expensive ixmp4 variable scan; `/study-locations` +
`/likelihoods` — transitional curation. The frontend loaders (`loadGeographies` / `loadCatalog` /
`loadCuration` in `src/lib/utils/apis.js`) feed the `geographies` / `catalog` / `curation` page-data
slices that the stores read.

`api/curation/` holds transitional remnants (`likelihoods`, `study-locations`) not yet derivable
from conventions — shrink it, don't grow it.

## Tests

`npm test` selects files importing `bun:test` under `api/` and `src/`.
`npm run test:web` selects Vitest files and disables Node Web Storage so jsdom
supplies browser storage. Both Node 26.13.0 and Bun 1.4.4 must be available.
`npm run test:content` runs the Node content and CMS copy tests.

The API tests need a separate PostgreSQL database configured through
`DATABASE_*`. `npm run test:cms` runs CMS tests; `npm run test:cms:migration`
rehearses a Strapi 4-to-5 upgrade in temporary Docker containers.
See `docs/strapi-v5-migration-guide.md` for release and database-copy instructions.
