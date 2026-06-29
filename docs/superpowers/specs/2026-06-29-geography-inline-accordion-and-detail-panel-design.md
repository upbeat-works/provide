# Geography selection: inline nested accordion + enriched detail panel

**Date:** 2026-06-29
**Status:** Approved (pending written-spec review)
**Branch:** feat/catalog-api

## Problem

The geography selector's current interaction is a *drill-in / replace* flow that costs extra
clicks and a context switch, and the right panel shows almost no information about the
selected geography. Compared against the reference prototype at
`~/Desktop/city-and-region-pills`, two changes are wanted:

1. A different left-list interaction — an inline nested accordion instead of drill-in/replace.
2. More information on the right detail panel.

### Current behavior (what we're replacing)

- Clicking a country both **selects** it and **expands** an accordion, but the accordion only
  shows per-type **summaries** ("3 Cities ›", "2 River basins ›") — counts, not children.
- Clicking a summary fires `onDrill(countryUid, typeUid)`, which **replaces the entire list**
  with a separate view: a "‹ Back to <country>" button plus the flat list of that one type.
- Reaching a city is therefore: *click country → click "Cities ›" → view swaps → click city*
  (3 clicks + a context switch); the country list is hidden while drilled in.
- All selectable geography types are equal top-level pills.
- Right panel: the choropleth `Map`, plus a single strip of count tags shown only when a
  country is selected. No identity, metadata, or cross-links.

## Goals

- Replace drill-in/replace with an **inline nested accordion**: expanding a country reveals its
  actual children inline, grouped by type, each directly selectable.
- **Separate selection from expansion**: clicking the name selects (and auto-expands); clicking
  the caret only toggles.
- Make `cities` **country-scoped only** (removed from the top-level pills; reachable only by
  drilling into a country).
- **Enrich the right panel** using only fields our real data can populate.

## Non-goals (YAGNI)

- Free-text "context tags" — our geography records do not have them.
- Per-sub-location map markers / hover-on-map — our `Map` is a choropleth; keep it as-is.
- Any API/schema change. Everything is derivable from existing meta data.
- Making `river_basins` / `eez` country-scoped — they remain top-level pills (and still appear
  nested under countries).

## Data model (grounding)

Geography types (`api/db/seed.sql`): `continent` (not selectable), `admin0` (Countries), `eez`,
`cities`, `river_basins`, `glacier_regions`, `macroeconomies`, `northern_latitudes`.

Per-geography fields available: `uid`, `label`, `geographyType`, `parents[]`, `geoId`,
`icon`/`emoji`. No free-text descriptions/tags.

Existing tree lookups (`geography-tree.js` → `buildIndex`): `byId`, `childrenByParent[parent][type]`,
`countriesByContinent`. A country's child types are `cities`, `river_basins`, `eez`
(`CHILD_TYPE_ORDER`). A child's `parents[]` includes its country (or multiple countries when
transboundary), and a country's `parents[]` includes its continent.

## Design

### A. Left list — inline nested accordion

`CountryAccordion.svelte`:
- Renders the country row: emoji/icon + name + a small child **count** + a caret icon.
- **Name area** is a `RadioGroupOption` for the country: clicking it selects the country
  (`CURRENT_GEOGRAPHY_UID = country.uid`) and auto-expands. Country is `admin0`, so the modal
  stays open (existing rule in `GeographySelection.svelte`).
- **Caret** is a separate control that only toggles `expanded`; it does not select. Uses the
  existing `Chevron` icon component (`isOpen={expanded}`), not a character.
- When expanded, renders the country's children **inline, nested** (left nesting border),
  grouped by type in `CHILD_TYPE_ORDER`. Each type group has a sub-header using the type's
  `label` (from `GEOGRAPHY_TYPES`). Each child is a selectable `RadioGroupOption` +
  `InteractiveListItem`.
- **Child row click** selects the leaf → modal closes (existing leaf behavior).

`Geographies.svelte`:
- **Remove** the `drill` state, `onDrill`/`backToCountries`, the "‹ Back to X" button, and the
  drilled-in `GeographyGroup`. The countries branch just renders continent groups of
  `CountryAccordion`s.
- Search and non-country flat-list branches are unchanged.

`GeographyGroup.svelte`:
- Drops the `onDrill` prop wiring (no longer needed); still renders `CountryAccordion` in
  `asCountries` mode and flat `InteractiveListItem`s otherwise.

### B. Type pills — country-scoped types

Introduce `COUNTRY_SCOPED_TYPES = ['cities']`. Filter these out of the top-level `PillGroup`
options in `GeographySelection.svelte` (without changing the API or `GEOGRAPHY_TYPES` itself).
`cities` remain reachable only by expanding a country.

### C. Right panel — enriched, data-backed only

A context card rendered with the existing `Map` (below it, matching current layout) for the
selected geography:
- **Identity header**: emoji/icon + label + a **type badge** (`labelSingular` from
  `GEOGRAPHY_TYPES`); for countries, the **continent** label (from the continent parent).
- **By-type breakdown** (countries only): the existing `childSummary` counts, rendered with type
  labels (kept from today's behavior).
- **Parent-country context** (children): "Country: <X>" derived from the child's `admin0`
  parent(s).
- **"Also linked to"** cross-links: when a child has more than one country parent
  (transboundary), list those countries as clickable buttons that re-select that country.
  Renders only when our data actually has >1 country parent.

### D. Helpers + testing

`geography-tree.js` gains pure helpers, each unit-tested in `geography-tree.test.js`:
- `parentCountriesOf(index, uid)` → the `admin0` geographies among a geography's parents.
- `continentOf(index, uid)` → the continent geography among a country's parents (or null).
- Reuse `childrenByParent` / `childSummary` for inline children + breakdown.

Component behavior, tested in the existing style:
- Country **name** click selects the country and expands; **caret** click toggles without
  selecting.
- Expanded country renders children grouped by type; clicking a child selects that leaf.
- `cities` is absent from the top-level pills but present nested under a country.
- Detail panel shows identity + type badge + continent/parent context, and cross-links only when
  >1 country parent exists.

## Files touched

- `src/lib/components/controls/GeographySelection/CountryAccordion.svelte` — inline children,
  name-selects / caret-toggles.
- `src/lib/components/controls/GeographySelection/Geographies.svelte` — remove drill-in/replace.
- `src/lib/components/controls/GeographySelection/GeographyGroup.svelte` — drop `onDrill` wiring.
- `src/lib/components/controls/GeographySelection/GeographySelection.svelte` — filter
  country-scoped types from pills; render enriched detail card.
- `src/lib/components/controls/GeographySelection/geography-tree.js` — `parentCountriesOf`,
  `continentOf`.
- `src/lib/components/controls/GeographySelection/geography-tree.test.js` — helper tests.
- Possibly a small `GeoDetailPanel.svelte` for the context card (keeps `GeographySelection.svelte`
  focused).

## Open questions

None outstanding. Decisions locked: full inline accordion; right panel uses only data-backed
fields; `cities` is the sole country-scoped type.
