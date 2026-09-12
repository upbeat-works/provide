# Catalog runtime loading

**Draft 1 — 9 September 2026**

## Goal

Load catalog data at runtime without making each page wait for all of it. Support
both selection orders:

- indicator, then geography;
- geography, then indicator.

Persistence and shared caching are outside this draft.

Strapi requests stay on the server. Client-side Strapi requests and related CORS
or ingress changes are outside this draft.

## Current problem

`/api/catalog` builds one large response before the user makes a choice. It loads
all indicators, parameters, filters, scenarios, time spans, GMT data,
descriptions, citations, and extra database fields. One slow or failed source
can delay or fail the response. The home page loads it only for the quick-start
selector.

Each request should load only what the next choice needs.

## Proposed request flow

### Initial load

Load two small indexes in parallel:

```text
GET /api/indicators
GET /api/geographies
```

The indicator index contains only what the first list needs, such as:

```json
{
  "id": "indicator-id",
  "label": "Indicator label",
  "unit": "days",
  "instance": "source-instance",
  "sector": "health"
}
```

The geography index contains the tree, labels, types, and IDs.

### Indicator chosen first

Request the geographies that support the indicator:

```text
GET /api/geographies?indicator={indicatorId}
```

The response can contain IDs. The client joins them with the geography index.

### Geography chosen first

Request the indicators that support the geography:

```text
GET /api/indicators?region={geographyId}
```

The response can contain IDs. The client joins them with the indicator index.

### Both chosen

Load the details needed for the remaining controls and charts:

```text
GET /api/indicators/{indicatorId}
GET /api/scenarios?indicator={indicatorId}&region={geographyId}&...
```

Indicator details may include:

- parameter dimensions and options;
- description;
- source ownership;
- citations;
- legacy ID mapping;
- other display data.

Available scenarios depend on the indicator, geography, and relevant parameters.

Load full scenario descriptions and GMT details only where they appear:

```text
GET /api/scenarios/{scenarioId}
```

## Strapi content

Server loaders fetch Strapi content separately from selection data. A Svelte
store must not merge Strapi content in the browser.

Strapi may add editorial fields such as indicator and scenario descriptions. It
must not replace IDs, parameters, source ownership, units, or availability.

A failed Strapi request must not block indicator or geography selection. Pages
that require editorial content may show their own error. Other pages use the
IXMP4 description or omit the missing content.

## Resource model

| Resource | Purpose |
| --- | --- |
| `GET /api/indicators` | Small indicator index, with optional geography or filters |
| `GET /api/geographies` | Geography index, with an optional indicator |
| `GET /api/indicators/{id}` | Parameters and display details for one indicator |
| `GET /api/scenarios` | Available scenarios for the current choices |
| `GET /api/scenarios/{id}` | Full details for one scenario |

## Selection rules

- Either indicator or geography may come first.
- Selecting either one limits the valid choices for the other.
- Changing the first choice must clear or adjust an incompatible second choice.
- A selection change must not reload the full catalog.
- Each indicator must keep its source.
- URL choices must work in either order.

## Failure boundaries

The indicator and geography indexes are independent. A failed detail, scenario,
GMT, citation, or Strapi request must not stop the page and first selectors from
rendering.

Each later request reports its own failure. Missing optional display data must
not break selection.

## Expected result

The first page needs only two small lists. Expensive IXMP4 work starts after a
choice and covers only that choice.

## Open questions

- Which fields does each first list need?
- Should filter counts be part of the indicator index or a separate request?
- Which indicator parameters affect geography and scenario availability?
- When should changing one choice clear the other rather than preserve it?
- Which pages need full scenario data without an active indicator and geography?
- Which pages require Strapi content, and which may omit it?
- How should each response show a failed IXMP4 source?
- How long may each request take?
