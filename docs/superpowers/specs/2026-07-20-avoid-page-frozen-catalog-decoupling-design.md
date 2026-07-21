# Avoid page: isolate it as a self-contained legacy page, decoupled from the ixmp4 catalog

- **Date:** 2026-07-20
- **Status:** Approved design → ready for implementation plan
- **Author:** Rodrigo Solís (with Claude)
- **Related, separate spec:** persisting explore/avoid selection in the URL (follow-up; will reuse
  the interchange defined here).

## Problem

The catalog migration on `feat/catalog-api` split the app across two backends, and the **avoid page
(`/impacts/avoid`) straddles both** because it shares selection stores with explore:

| Surface | Selection / catalog (what you can pick) | Chart data (what is plotted) |
|---|---|---|
| Explore (`impact-time`, `impact-geo`, `unavoidable-risk`) | ixmp4 catalog | ixmp4 (`base: VITE_API_URL`) — consistent |
| **Avoid** (`avoiding-impacts`, `avoiding-reference`) | **ixmp4 catalog** (shared stores) | **legacy** `VITE_DATA_API_URL` — **mismatched** |

The avoid chart endpoints (`avoiding-impacts`, `avoiding-reference`) were never migrated — they still
call the frozen legacy Climate Analytics API (`${VITE_DATA_API_URL}`). But avoid's selection surface
comes from the shared, now-ixmp4-driven stores (`INDICATORS`, `GEOGRAPHIES`, `AVAILABLE_*`,
`IS_COMBINATION_AVAILABLE_*`). So avoid offers/gates selections by what **ixmp4** knows, then fetches
from a **different, hand-curated** backend. Where the identifier spaces diverge, avoid can enable
combinations the legacy endpoint can't serve, or send ixmp4 ids the legacy endpoint doesn't
recognize. Before commit `dee0c04a` the whole app drove its catalog from `${VITE_DATA_API_URL}/meta`
— the frozen catalog that matches this frozen data.

### Why isolate rather than translate in-place
An earlier draft kept the shared, ixmp4-canonical stores and translated ids per-route at the fetch
boundary. That pushed route-awareness into the data layer and coupled the API surface to frontend
routing. Instead: **make avoid a self-contained legacy page** in one id space, keep explore entirely
as-is, and collapse translation to a single boundary — the explore↔avoid handoff — owned by explore.

## Goals

1. Avoid's selectable cities, indicators, parameters, and availability come from the **frozen legacy
   `/meta`**, in lockstep with the legacy `avoiding-impacts` / `avoiding-reference` data it plots.
2. Avoid is **agnostic of the new world**: its own stores hold legacy ids, its own simple selectors
   read legacy sources, and it **never calls the new API or handles a new uid**.
3. Explore is **untouched** (ixmp4 catalog/stores/new uids) and additionally gains `sector`.
4. Explore↔avoid selection carry-over is preserved, as **one explicit translated handoff** owned by
   explore (the only side that holds both id spaces).
5. Pure, testable translation and catalog shaping; I/O stays at the edges.

## Non-goals

- Migrating `avoiding-impacts` / `avoiding-reference` to the new API (they stay legacy — the point of
  "frozen").
- Per-page URL persistence for refresh/share (separate spec; reuses the interchange below).
- Building out Advanced Filters (sector is added to the explore catalog here; wiring the filter UI is
  separate — see Appendix D).
- Any change to explore charts or the `unavoidable-risk` scatter.

## Key findings (the identifier bridges)

### Geographies — deterministic, no table
The D1 `geo_id` column **literally holds the legacy uid**. Confirmed in `api/db/seed.sql`:
- `admin0`: new `id="Afghanistan"`, `geoId="AFG"` ⇄ legacy uid `"AFG"` (ISO3)
- `cities`: new `id="Accra"`, `geoId="accra"` ⇄ legacy uid `"accra"` (slug)

So `newGeo.geoId === legacyGeo.uid` — a clean bijection for anything present in both.

### Scope is cities-only
`GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS = [GEOGRAPHY_TYPE_CITY]` (`'cities'`). Avoid only selects
**cities** (legacy `/meta` has 144). Only the **30 city-available** legacy indicators matter (all
`urban-climate`; appendix). 4 reference uids with no full indicator metadata and are inert.

### Indicators — additive D1 enrichment table
New convention uid = the raw ixmp4 variable's first segment (uid == label, e.g. `"Mean daily
temperature"`). Legacy uid = sector-prefixed slug (`"urbclim-T2M-mean"`) = Strapi `UID`. Unrelated id
spaces → a curated `newUid → legacyUid` mapping is required.

**ixmp4 can tag runs but not variables**, so this curated mapping lives in an **additive D1
enrichment table** (`indicators`), same pattern as `geographies` (authored from YAML → `seed.sql`).
Semantics: the app works without it; a row *adds* fields (`sector`, `legacy_uid`), never removes
anything. Two consumers only: explore's `/catalog` (gains `sector`, reviving the dead
`AdvancedFilters.svelte` mockup) and the translation module (`legacy_uid`). Only genuinely-curated
facts belong here — `project` = ixmp4 **instance** and the run-specific dims are ixmp4-derived, not
columns (Appendix D). Legacy scaffold in Appendix A.

## Architecture — isolated avoid + explore-owned translation

```
  EXPLORE (unchanged + sector)                    AVOID  (new, self-contained, legacy only)
  ─────────────────────────────                   ────────────────────────────────────────
  loadCatalog() ixmp4 + enrichment join           loadAvoidMeta() → ${VITE_DATA_API_URL}/meta
  loadGeographies() (new tree)                       cities, indicators, params, availability,
  stores keyed by NEW uid                            likelihoods, studyLocations, scenarios
  indicators carry .legacyUid, geos carry .geoId   AVOID_* stores keyed by LEGACY id
        │                                          simple City + Indicator selectors
        │  translate.js (owns both id spaces)      avoiding-impacts / -reference (legacy ids direct)
        ▼
  explore→avoid: build /impacts/avoid?geography=<geoId>&indicator=<legacyUid>&…  ──►  avoid reads NATIVE
  avoid→explore: /impacts/explore?geography=<geoId>&indicator=<legacyUid>        ──►  explore RESOLVES
                                                       (accepts new OR legacy, normalises to new uid)

  D1 `indicators` table (id=newUid, sector, legacy_uid)  ── join ──►  /catalog   (explore only)
```

Avoid never touches the new API or a new uid. Explore holds both ids (`.legacyUid` on catalog
indicators from the enrichment join, `.geoId` on geographies) and therefore owns every translation:
it *emits* legacy ids when linking to avoid and *resolves* legacy ids when receiving from avoid.

### A. Avoid page — self-contained legacy mini-app
- **Loader** `avoid/+page.server.js`: `loadAvoidMeta(fetch)` — fetch `${VITE_DATA_API_URL}/meta/`
  plus Strapi indicator/scenario descriptions; return the legacy slices avoid needs: `cities`,
  `indicators` (the 30 city ones, with legacy `unit`/`direction`/`parameters`/`selectableYears`/
  `availableGeographies`/…), `indicatorParameters`, `likelihoods`, `studyLocations`, `scenarios`.
  Pure shaping (`buildAvoidMeta(legacyMeta, descriptions)`) split from the fetch for unit tests.
  Everything stays in **legacy id space**.
- **Stores** (`src/stores/avoid.js` or a new `avoid-catalog.js`): `AVOID_CITY` (legacy city uid),
  `AVOID_INDICATOR` (legacy uid), `AVOID_PARAMS` (legacy option values) + derived `AVOID_CITIES`,
  `AVOID_INDICATORS`, `AVOID_PARAMETERS`, `AVOID_IS_EMPTY`, `AVOID_IS_AVAILABLE` (from legacy
  `availableGeographies`), and `AVOID_TEMPLATE_PROPS` for the chart frames. The existing avoid-only
  stores (likelihood, study-location, level-of-impact) stay; their `LIKELIHOODS` / `STUDY_LOCATIONS`
  source moves from `page.data.curation` (new API) to `page.data.avoidMeta` (legacy).
- **Selectors** (new, small): `CitySelect` (flat dropdown of `AVOID_CITIES`), `IndicatorSelect`
  (dropdown of `AVOID_INDICATORS`), `AvoidParamFilters` (legacy param dropdowns), replacing the
  shared `ParameterSelection` / `IndicatorFilters` on avoid. Availability gating reads legacy
  `availableGeographies` (city uid ∈ list) — no ixmp4 fetch.
- **Charts** (`ThresholdLevels`, `Reference`): read the `AVOID_*` stores; send `AVOID_CITY`/
  `AVOID_INDICATOR` (already legacy ids) straight to `avoiding-impacts`/`avoiding-reference`. No
  translation, no route-conditional ids.
- **ShareLink** on avoid: an avoid variant emitting legacy ids from `AVOID_*` (native).

### B. Enrichment table (D1) + `/catalog` join — `api/`
- **Schema** (`api/db/schema.ts`): `indicators` — `id TEXT PRIMARY KEY` (convention uid = ixmp4
  variable segment 0), `sector TEXT`, `legacy_uid TEXT`, both nullable. Extensible only for future
  genuinely-curated tags (Appendix D). Drizzle migration as usual.
- **Authoring** (`api/db/import/indicators.yaml` + `import-indicators.ts`): mirror the geographies
  workflow — YAML of `{ id, sector, legacyUid }` compiled into `seed.sql`.
- **`/catalog` join** (`api/routes/catalog.ts`): left-join onto scanned indicators so each gains
  `sector` + `legacyUid` **when a row exists** (missing → unchanged; purely additive).
- No cheap `/indicators/meta` endpoint and no per-page catalog split are needed — avoid doesn't touch
  the new API at all.

### C. Translation module — `src/lib/catalog/translate.js` (pure, explore-owned)
- `toLegacyGeoId(geo)` → `geo.geoId`; `resolveGeo(value, geoIndex)` → the geography whose `uid` **or**
  `geoId` equals `value` (new/legacy tolerant; ISO3 & slugs don't collide with names).
- `toLegacyIndicatorUid(newUid, catalog)` → the catalog indicator's `legacyUid`;
  `resolveIndicator(value, catalog)` → the indicator whose `uid` **or** `legacyUid` equals `value`.
- Unmapped → `undefined` (caller: no avoid data / disable the handoff).

### D. Handoff wiring (the one translation boundary)
- **Explore → avoid** (`explore/+page.svelte` "Visualize on avoiding future impacts" button): build
  `/impacts/avoid?geography=<geoId>&indicator=<legacyUid>&…legacy params`, translating the current
  explore selection via `translate.js`. **Disabled/hidden when the current indicator has no
  `legacyUid`** (no avoid data). Avoid reads these params as its native legacy ids on load.
- **Avoid → explore** (avoid links to the explorer): emit `/impacts/explore?geography=<geoId>&
  indicator=<legacyUid>` — avoid's own native ids, no translation on avoid's side.
- **Explore inbound resolver**: explore reads `geography`/`indicator` params and resolves each via
  `resolveGeo`/`resolveIndicator` (accepts new **or** legacy, normalises to new uid) before seeding
  its stores. This is the only place a legacy id enters explore, and explore owns it.
- **Interchange = `(geoId, legacyUid)`** — avoid-native, explore-translatable. The separate URL
  spec adopts the same interchange for cross-page links; explore's own refresh/share format (which
  must also cover explore-only indicators that have no `legacyUid`) is that spec's concern.

### E. Layout / data loading
- `explore/+page.server.js`: `loadGeographies` + `loadCatalog` (ixmp4 + enrichment join).
- `avoid/+page.server.js`: `loadAvoidMeta` (legacy).
- `impacts/+layout.server.js`: drop the shared `catalog`/`curation`; keep only what both truly share
  (verify nothing else depends on the shared curation once avoid sources its own). The case-study
  `LinkSection` on avoid needs new-geo metadata (`adaptationCaseStudy`) — resolve it by `geoId` via
  `translate.js` (a cross-link, so it belongs at the translation boundary), or load the minimal geo
  lookup it needs. Flag during implementation.

## Testing strategy (TDD; `bun test`)

Pure units (no stores, no network):
- `translate.js`: geo `toLegacyGeoId` + `resolveGeo` (by uid and by geoId); indicator
  `toLegacyIndicatorUid` + `resolveIndicator` (by uid and by legacyUid); unmapped → `undefined`.
- `buildAvoidMeta(legacyMeta, descriptions)`: keeps legacy ids, filters to the 30 city indicators,
  attaches descriptions, drops the 4 inert uids, carries `availableGeographies`.
- avoid availability helper: city uid ∈ indicator `availableGeographies`.

API (`bun test api/`, Hono `api.request(...)` + D1 fixture):
- `/catalog` left-join: indicator **with** a row gains `sector`/`legacyUid`; **without** unchanged
  (additive, no drop).
- `import-indicators`: `id` unique; `legacyUid` unique among set rows; every `legacyUid` exists in
  the legacy `/meta` city set (Appendix A).

Integration / behavioral:
- Avoid page runs entirely on legacy: selecting a city + indicator builds `avoiding-impacts` params
  with the **legacy** city uid + indicator uid, and **no request hits `VITE_API_URL`**.
- Explore→avoid handoff: the button is disabled for an indicator with no `legacyUid`; enabled ones
  link to avoid with `(geoId, legacyUid)` and land pre-selected.
- Avoid→explore + explore resolver: a legacy `(geoId, legacyUid)` link normalises to the right new
  uids on explore; an unmapped one falls back gracefully (no crash, `FallbackMessage`).
- Explore regression: catalog still ixmp4, now carries `sector`.

## Edge cases & risks

- **Unit/formatting:** avoid indicator metadata (incl. `unit`) comes from legacy `/meta`, matching
  the legacy data — no drift.
- **Case-study LinkSection on avoid:** needs new-geo `adaptationCaseStudy`; resolve by `geoId` at the
  translation boundary rather than giving avoid the whole new geo tree.
- **Casualties:** a legacy city indicator with no enrichment row is absent on avoid; a convention
  indicator with no legacy data simply has no `legacyUid` and its "go to avoid" button is disabled.
  Enumerate both during implementation (diff Appendix A vs local `/catalog`).
- **Inert legacy uids:** `urbclim-T2M-daily-mean-min-topography`, `-daily-mean-max-topography`,
  `-nightover20`, `-dayover35` have no indicator metadata — no enrichment row.
- **Join-key volatility:** the enrichment `id` is the convention indicator name (ixmp4 variable
  segment 0); an ixmp4 rename silently unmatches it — acceptable "never subtracts" degradation; the
  import test cross-checks `legacyUid`s against legacy `/meta`, not live ixmp4.
- **Shared curation removal:** confirm no non-avoid surface still reads `page.data.curation` before
  dropping it from the shared layout (adaptation/methodology/embed layouts load it independently).

## Appendix

### A. Legacy city indicators (enrichment-table scaffold — legacy side, 30)
Each becomes an `indicators.yaml` row: set `id` to the matching convention indicator (from local
`/catalog`) and `legacyUid` to the value below. ⚠ = no legacy indicator metadata → omit.

```
urbclim-T2M-dayoverX                       Days a year with maximum temperatures above X°C
urbclim-T2M-nightoverX                     Nights a year with minimum temperatures above X°C
urbclim-WBGT-dayover31                     Days a year with extreme heat stress
urbclim-WBGT-dayover295                    Days a year with very high heat stress
urbclim-WBGT-dayover25                     Days a year with moderate heat stress
urbclim-WBGT-dayover28                     Days a year with high heat stress
urbclim-cooling-degree-hours               Cooling degree hours
urbclim-WBGT-hourover31                    Hours a year with extreme heat stress
urbclim-T2M-daily-mean-max                 Mean daily maximum temperature
urbclim-T2M-daily-mean-min-topography   ⚠  (no indicator metadata)
urbclim-WBGT-nightover28                   Nights a year with high heat stress
urbclim-LWH-mod                            Lost working hours per year for moderate activities
urbclim-HWMI                               Heat-wave magnitude index daily (HWMId)
urbclim-T2M-daily-mean-min                 Mean daily minimum temperature
urbclim-WBGT-hourover25                    Hours a year with moderate heat stress
urbclim-WBGT-daily-mean-max                Mean daily maximum wet bulb globe temperature
urbclim-LWH-light                          Lost working hours per year for light activities
urbclim-T2M-mean                           Mean daily temperature
urbclim-T2M-daily-mean-max-topography   ⚠  (no indicator metadata)
urbclim-LWH-int                            Lost working hours per year for intense activities
urbclim-WBGT-hourover28                    Hours a year with high heat stress
urbclim-WBGT-hourover295                   Hours a year with very high heat stress
urbclim-heatwave-days                      Heatwave days per year
urbclim-T2M-nightover20                 ⚠  (no indicator metadata)
urbclim-T2M-dayover35                   ⚠  (no indicator metadata)
urbclim-heatwaves-population-exposed       Population exposed to heatwaves
urbclim-heatstressimpact-wbgt-dayover25    Population exposed to moderate heatstress
urbclim-heatstressimpact-wbgt-dayover28    Population exposed to high heat stress
urbclim-heatstressimpact-wbgt-dayover295   Population exposed to very high heat stress
urbclim-heatstressimpact-wbgt-dayover31    Population exposed to extreme heatstress
```

### B. Legacy `indicatorParameters` keys
`time` (5), `indicator_value` (7), `reference` (7), `frequency` (3), `spatial` (1). `indicator_value`
and `frequency` exist in legacy but not the ixmp4 catalog — another reason avoid keeps its own params.

### C. Files touched
**API (enrichment table — additive):**
- `api/db/schema.ts` — new `indicators` table (`id`, `sector`, `legacy_uid`).
- `api/db/migrations/*` — generated migration.
- `api/db/import/indicators.yaml` + `import-indicators.ts` (+ `.test.ts`); `api/db/seed.sql`.
- `api/routes/catalog.ts` (+ test) — left-join `sector`/`legacyUid`.

**Avoid (isolate):**
- `src/lib/utils/apis.js` — `loadAvoidMeta` + pure `buildAvoidMeta` (+ test).
- `src/stores/avoid.js` (or new `avoid-catalog.js`) — `AVOID_*` stores; repoint `LIKELIHOODS`/
  `STUDY_LOCATIONS` to `avoidMeta`.
- `src/routes/(default)/impacts/avoid/+page.server.js` — load `avoidMeta`.
- `src/routes/(default)/impacts/avoid/+page.svelte` — use `AVOID_*`; swap in new selectors.
- New selectors: `CitySelect`, `IndicatorSelect`, `AvoidParamFilters`, avoid `ShareLink` variant.
- `…/avoid/components/ThresholdLevels/ThresholdLevels.svelte`, `…/Reference/Reference.svelte` — read
  `AVOID_*`, fetch with legacy ids.

**Explore (translation owner):**
- `src/lib/catalog/translate.js` (pure) + `translate.test.js`.
- `src/routes/(default)/impacts/explore/+page.server.js` — `loadGeographies` + `loadCatalog`.
- `src/routes/(default)/impacts/explore/+page.svelte` — avoid-link builder (translate + disable) +
  inbound resolver seeding stores.
- `src/routes/(default)/impacts/+layout.server.js` — drop shared `catalog`/`curation`.

Note: `AdvancedFilters.svelte` can later consume the real `sector` now on catalog indicators — out of
scope here, but unblocked.

### D. Advanced Filters sourcing (reference — separate feature)
| Filter group | Source | In this spec? |
|---|---|---|
| `sector` | **Curated** — D1 `indicators.sector` | Yes (added) |
| `project` | ixmp4 **instance** (`indicator.instance`, already on `/catalog`) | Already present |
| `data source` | ixmp4 **run meta** | No — future |
| `spatial resolution` | ixmp4 run meta + convention `spatial` facet | No — future |
| `temporal` | convention `temporal` facet + run meta | No — future |

The enrichment table only ever needs curated columns; `project` and the run-specific dims come from
ixmp4, never as curated rows.
