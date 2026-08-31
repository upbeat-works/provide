# Hierarchical Geography Selector — Design

Date: 2026-06-18
Branch: `feat/catalog-api`
Status: Approved (pending spec review)

## Problem

The geography selector currently presents each geography type (Countries, Cities,
EEZ, River Basins, Glacier Regions, Macroeconomies, Northern Latitudes) as a flat,
independent list. The new design (see `geography-selection.png`) introduces a
**country-rooted hierarchy**:

- Countries are grouped under **continent** headers (e.g. "AFRICA").
- A country can be **expanded** to reveal the child geographies that belong to it,
  grouped by type — Cities, River Basins, Exclusive Economic Zones — each with a
  count and a drill-in affordance.
- Clicking a child category **drills into** that country's list of that type.
- The map highlights the selected geography; summary tags beneath it
  ("1 City", "1 River Basin") reflect the selected country's children.

The data to support this does not exist yet: `geographies.parent_id` is defined but
empty for all rows, and there is no continent information. The hierarchy mapping
will be **authored from domain knowledge** (no external dataset is available):
ISO country→continent is reliable; child→country (Cairo→Egypt, EEZ by name) is
feasible; trans-boundary river basins map to multiple countries.

## Scope

In scope: the 7 existing geography types only. Mockup labels with no backing data
("Global Carbon Cycle" top tab, "Regions" under a country) are treated as
illustrative and deferred until data exists. Hierarchy is rooted at countries;
glacier regions, macroeconomies and northern latitudes remain top-level flat lists
with no per-country nesting.

## 1. Data model (`api/db/schema.ts`)

### `geography_types`
- Add **`is_selectable`** (boolean, default `true`). Continents set it to `false`:
  they are grouping headers, not pickable data geographies. (`is_available`
  retains its current meaning — feature-flagging a type's visibility.)

### `geographies`
- **Drop the unused `parent_id` column.** It is NULL for every row today, and the
  join table below becomes the single source of truth for hierarchy. Two sources of
  truth would invite drift.
- Add **`continent`** geographies: Africa, Asia, Europe, North America,
  South America, Oceania, Antarctica (7 rows, `geography_type = 'continent'`).

### New table `geography_parents`
```
geography_parents (
  geography_id text not null references geographies(id),
  parent_id    text not null references geographies(id),
  primary key (geography_id, parent_id)
)
```
Single source of truth for **all** hierarchy edges:

| Child type        | Parent           | Cardinality |
|-------------------|------------------|-------------|
| `admin0` (country)| `continent`      | exactly 1   |
| `cities`          | `admin0`         | 1 (typically)|
| `eez`             | `admin0`         | 1+ (shared/disputed zones) |
| `river_basins`    | `admin0`         | 1+ (trans-boundary) |
| `glacier_regions` | —                | 0 (top-level only) |
| `macroeconomies`  | —                | 0 |
| `northern_latitudes` | —             | 0 |

A new Drizzle migration creates `geography_parents`, adds `is_selectable`, and
drops `geographies.parent_id`.

## 2. Seed (`api/db/`)

The existing `geographies.yaml` only holds names — there is nowhere to express
edges. Add a dedicated, hand-authored hierarchy source:

- **`api/db/geography-hierarchy.ts`** — exports:
  - `continents`: ordered list of continent names.
  - `countryContinent`: `Record<countryName, continentName>` for all ~234 countries.
  - `cityCountry`: `Record<cityName, countryName>` for the 145 cities.
  - `eezCountry`: `Record<eezName, countryName[]>` — derived from the `"X (EEZ)"`
    naming convention where possible, with explicit exceptions for shared/disputed
    zones.
  - `riverBasinCountries`: `Record<basinName, countryName[]>` for the 74 basins
    (many-to-many).

- **`api/db/import-geographies.ts`** is extended to:
  1. Emit the 7 `continent` geographies and their `geography_types` row
     (`is_selectable = 0`).
  2. Emit `is_selectable = 1` for the existing types.
  3. Emit `geography_parents` INSERTs from the hierarchy maps, validating that
     every referenced geography id exists in the YAML (fail the build otherwise).

The importer must remain deterministic and reproducible from a clean checkout
(matches the current convention). Unmapped countries/cities/basins cause a build
error rather than a silent NULL.

## 3. API

- **`/api/meta`** (`api/routes/meta.ts`):
  - Add a `continent` key: `Array<{ uid, label }>`.
  - Include `parents: string[]` on every geography object (from `geography_parents`).
  - Frontend builds the tree client-side from this flat payload. No nested endpoint
    — the dataset is ~670 rows and already shipped in one request (YAGNI).
- **`/api/geographies` and `/api/geographies/:id`**: include `parents: string[]`.
  Existing `?type` / `?indicator` filters unchanged.

## 4. Frontend (Svelte)

### Pure logic modules (framework-agnostic, `bun test`-able)
`src/lib/components/controls/GeographySelection/geography-tree.js`:
- `buildIndex(meta)` → `{ byId, childrenByParent, countriesByContinent }`
  - `childrenByParent`: `parentId → { [type]: Geography[] }`
  - `countriesByContinent`: `continentId → Country[]` (ordered)
- `childSummary(index, countryId)` → `Array<{ type, label, count }>` for the
  expansion rows and the map's summary tags.

All grouping/counting/summary logic lives here so it is unit-testable without a
component test stack.

### Components (`GeographySelection/`)
- **Countries tab**: render continent headers, each followed by its countries
  (flag emoji + name). Each country row is an **accordion**.
  - Expanded: one row per child type present (Cities / River Basins / EEZ) showing
    the count + chevron, sourced from `childSummary`.
- **Drill-in**: clicking a child-type row swaps the panel to that country's list of
  that type, with a back/breadcrumb control to return to the country list. State
  for the active drill-in lives in the list component.
- **Other type tabs** (EEZ, Macroeconomies, Glacier Regions, River Basins,
  Northern Latitudes): unchanged flat lists, sourced from the new structure.
- **Search** (existing Fuse.js): flat results across all geographies; selecting a
  result behaves as today. Continents are excluded from search/selection.
- **Map** (`Map.svelte`): highlight behavior unchanged. The summary tags beneath
  the map derive from `childSummary(index, selectedCountryId)`.
- **Selection model unchanged**: clicking any selectable geography sets
  `CURRENT_GEOGRAPHY_UID`. Continents (`is_selectable = false`) are not clickable.

### Store (`src/stores/meta.js`)
Derive the tree index once from the meta payload and expose it (plus
`countriesByContinent`) to the selection components.

## 5. Testing (TDD)

Decision: cover all pure logic under the existing `bun test` infra; keep components
thin. No new frontend test stack (`@testing-library/svelte` / `vitest`) is added.

- **Backend (`bun test api/`)**
  - Seed integrity: every `admin0` has exactly one `continent` parent; every
    `cities` / `eez` / `river_basins` row has ≥1 `admin0` parent; every
    `geography_parents` row references existing geographies; continents are
    `is_selectable = 0`.
  - API contract: `/api/meta` returns a `continent` list and `parents` on
    geographies; `/api/geographies` and `/api/geographies/:id` include `parents`.
- **Frontend logic (`bun test`)**
  - `geography-tree.js`: `buildIndex` produces correct `childrenByParent`,
    `countriesByContinent`; `childSummary` returns correct types/counts (incl. a
    river basin that maps to multiple countries appearing under each).
- **Component interaction** (expand / drill-in / back): out of automated scope
  given no FE test stack; verified manually.

Per TDD discipline: write a failing test that exercises real production behavior
(e.g. a `buildIndex` stub returning the current flat shape) before implementing,
so RED fails on an assertion, not a missing module.

## Out of scope / deferred

- "Global Carbon Cycle" type and subnational "Regions" (no data).
- Many-parent rendering polish (a basin under multiple countries is shown under
  each; no deduplicated "shared" badge).
- Frontend component test infrastructure.
