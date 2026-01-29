# PROVIDE Project - Technical Plan

## Table of Contents
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Implementation Timeline](#2-implementation-timeline)
3. [Deliverable 1: Landing Page + Design System](#3-deliverable-1-landing-page--design-system)
4. [Deliverable 2: Methodology & Key Concepts](#4-deliverable-2-methodology--key-concepts)
5. [Deliverable 3: Tools](#5-deliverable-3-tools)
6. [Deliverable 4: Indicator Catalog](#6-deliverable-4-indicator-catalog)
7. [Deliverable 5: GeoServer + MVT Migration](#7-deliverable-5-geoserver--mvt-migration)
8. [Deliverable 6: EU Scoreboard](#8-deliverable-6-eu-scoreboard)
9. [Deliverable 7: Case Studies Enhancement](#9-deliverable-7-case-studies-enhancement)
10. [Deliverable 8: Project Landing Pages](#10-deliverable-8-project-landing-pages)
11. [Indicator Catalog Design](#11-indicator-catalog-design)

---

## 1. Current Architecture Overview

SvelteKit application with modular architecture: Svelte stores for state management, URL-synced query parameters for deep linking, and a centralized config for routes, labels, API endpoints, and per-module constraints.

### Service Architecture

| Service | Role | Technology |
|---------|------|------------|
| **Time Series** | Climate indicator data storage and querying | ixmp4 |
| **GIS** | Geographic data, vector tiles, spatial queries | GeoServer + PostGIS |
| **Metadata Catalog** | Indicator metadata, categories, tags, filtering | Embedded SQL |
| **Content** | CMS-managed pages, case studies, tool descriptions | Strapi |

The SvelteKit frontend orchestrates across these services — for example, the Indicator Catalog combines Metadata Catalog queries (for browsing/filtering) with Time Series queries (for charting), while the EU Scoreboard additionally pulls geographic boundaries from the GIS service and editorial content from Strapi.

---

## 2. Implementation Timeline

```mermaid
gantt
    title Implementation Timeline
    dateFormat YYYY-MM-DD

    section Foundation
    Landing Page + Design System           :d1, 2026-02-01, 6w
    Methodology & Key Concepts             :d2, 2026-02-01, 6w

    section Core Features
    Tools                             :d3, after d1, 6w
    Indicator Catalog                      :d4, after d1, 8w

    section Infrastructure
    GeoServer + MVT Migration              :d5, after d1, 10w

    section Projects
    EU Scoreboard                          :d6, after d3 d4 d5, 8w

    section Enhancements
    Case Studies Enhancement               :d7, after d6, 6w
    Project Landing Pages                  :d8, after d1, 4w
```

### Dependencies

| Deliverable | Depends On | Enables |
|-------------|------------|---------|
| 1. Landing Page | — | 3, 4, 5 |
| 2. Methodology & Key Concepts | — | — |
| 3. Tools | 1 | 6 |
| 4. Indicator Catalog | 1 | 6 |
| 5. GeoServer + MVT | 1 | 6 |
| 6. EU Scoreboard | 3, 4, 5 | 7 |
| 7. Case Studies | 6 | — |
| 8. Project Landing Pages | 1 | — |

---

## 3. Deliverable 1: Landing Page + Design System

Redesign the landing page to improve discoverability and communicate the platform's purpose. Update the design system color palette for better hierarchy, accessibility, and brand consistency.

- **Mission statement** — crisp value-proposition line with supporting copy; exact wording refined with stakeholders.
- **Tool cards** — visual entry points to Avoid Future Impacts and EU Scoreboard.
- **Featured content** — editorially curated section managed via Strapi (title, description, thumbnail, link, display dates).
- **Entry points** — Explore, Avoiding Future Impacts, EU Scoreboard, Case Studies.
- **Design system** — updated color tokens, contrast ratios, and semantic colors propagated via theme store and CSS custom properties.

---

## 4. Deliverable 2: Methodology & Key Concepts

Merge the existing Methodology and Key Concepts sections into a single browsable knowledge base with categories, search, sidebar/index navigation, in-page cross-links, and breadcrumbs.

---

## 5. Deliverable 3: Tools

Dedicated `/tools` hub for analytical tools. First entry: "Avoiding Future Impacts" migrated from `/impacts/avoid` to `/tools/avoiding-future-impact`.

- **Strapi-managed** — "Tools" collection with slug, title, description, thumbnail, geography types, scenarios, and publication status.
- **Route structure** — grid landing page with cards; each tool gets a nested route retaining existing functionality.
- **Backward compatibility** — 301 redirect from `/impacts/avoid` preserving query parameters.
- **Navigation** — "Tools" link in site header; contextual deep-link from Future Impacts explore page when selection is compatible.

---

## 6. Deliverable 4: Indicator Catalog

Unified system for browsing, filtering, and visualizing climate indicators. Bridges the Metadata Catalog service with ixmp4 for time series. See [Section 11](#11-indicator-catalog-design) for detailed design.

- **Hybrid architecture** — metadata store for names/descriptions/categories/tags, ixmp4 for time series, linked via `ixmp4Variable`.
- **Metadata store** — embedded SQL with type-safe ORM; no external dependencies.
- **Indicator browser** — category dropdown, tag multi-select, searchable list, detail view with chart.
- **Time series visualization** — fetches from ixmp4 by linked variable, renders region × year chart.
- **Upload** — form + CSV; validates, stores metadata, imports time series into ixmp4.

---

## 7. Deliverable 5: GeoServer + MVT Migration

Migrate geographic data processing from client-side (GeoJSON + D3 contours + Turf.js clipping) to server-side vector tiles.

```mermaid
flowchart LR
    PostGIS["PostGIS"] --> GeoServer["GeoServer + GeoWebCache"] --> Mapbox["Mapbox GL (native MVT)"]
```

- **Target** — PostGIS stores impact data and boundaries; GeoServer serves pre-generated MVT tiles.
- **Config** — new env vars for GeoServer URL/workspace; layer name mappings and tile URL generation.
- **Frontend** — new `VectorTileLayer` Svelte component; existing Maps component migrated from GeoJSON to MVT; D3 color scales replaced with Mapbox style expressions.
- **API utilities** — WMS GetCapabilities, WFS GetPropertyValue, WMS GetFeatureInfo.
- **Cleanup** — remove geomask web worker, coordinate-to-polygon, and contour generation; retain color scale utilities.

---

## 8. Deliverable 6: EU Scoreboard

Comparative view of climate performance metrics across EU countries, added as a new Tool.

- **Country comparison dashboard** — side-by-side indicators with current values, trends, and projections.
- **Scenario comparison** — how different climate pathways affect country-level outcomes.
- **Data integration** — Indicator Catalog for metadata, ixmp4 for time series, GeoServer for boundaries.
- **UI (TBD)** — scoreboard landing with headline metrics and map, comparison tool with shareable URL state, choropleth maps.
- **Content** — managed through Strapi alongside other tools.

---

## 9. Deliverable 7: Case Studies Enhancement

Enhance the adaptation case studies section with filtering and richer visualizations.

- **Filters** — category and tag controls on the landing page, reflected in URL query parameters.
- **Visualization components** — new components integrated with Strapi dynamic zones for editor-managed rich content.

---

## 10. Deliverable 8: Project Landing Pages

Unlisted, shareable landing pages for individual PROVIDE projects. Each page has a title, short description, and CTAs linking to the relevant Explore view and Tools page. Managed via a Strapi content type with SEO metadata (title, description, Open Graph tags).

---

## 11. Indicator Catalog Design

### Goals

- Rich metadata: name, description, category, tags, source, project, unit
- Time series with region, year, value dimensions
- Query support for dropdowns and multi-select filters
- Integration with ixmp4-ts

### Constraint

ixmp4 lacks native metadata support, necessitating a hybrid architecture with a separate metadata store.

### Hybrid Architecture

```mermaid
flowchart TB
    subgraph UI["User Interface"]
        dropdown["Category Dropdown"]
        tags["Tags Multi-select"]
        list["Indicator List"]
        chart["Indicator Chart"]
    end

    subgraph Service["Indicator Catalog Service"]
        metadata["Metadata Queries"]
        timeseries["Time Series Queries"]
    end

    subgraph MetadataStore["Metadata Store"]
        indicators["Indicators"]
        categories["Categories"]
        tagsTable["Tags"]
    end

    subgraph ixmp4["ixmp4 Backend"]
        variable["Variables"]
        ts["Time Series"]
        datapoints["Datapoints"]
    end

    UI --> Service
    metadata --> MetadataStore
    timeseries --> ixmp4
    indicators <-->|"ixmp4Variable"| variable
```

### Data Model

**Indicator** — name, description (markdown), category (ref), tags (many), source, project, unit, ixmp4Variable (unique link).

**Category** — unique name (e.g., "Climate", "Energy", "Health").

**Tag** — unique name (e.g., "temperature", "health", "emissions").

### API Design

- **Get Categories** — all names, sorted alphabetically.
- **Get Tags** — all names, sorted alphabetically.
- **Get Indicators** — optional filters for category, tags (AND logic), and search text; returns metadata with ixmp4Variable link.
- **Get Time Series** — by ixmp4Variable with optional region/year filters; returns region, year, unit, value.

```mermaid
sequenceDiagram
    participant User
    participant Service
    participant MetadataStore
    participant ixmp4

    User->>Service: Browse by category
    Service->>MetadataStore: Query categories
    MetadataStore-->>Service: Category list
    Service-->>User: Populate dropdown

    User->>Service: Filter by category + tags
    Service->>MetadataStore: Query with filters
    MetadataStore-->>Service: Matching indicators
    Service-->>User: Display indicator list

    User->>Service: Select indicator for chart
    Service->>ixmp4: Fetch time series by variable
    ixmp4-->>Service: Time series data
    Service-->>User: Render chart
```

### Upload Flow

Form + CSV submission → validate → store metadata → import time series into ixmp4. Two-phase commit: if ixmp4 import fails, metadata is rolled back.

```mermaid
sequenceDiagram
    participant User
    participant Service
    participant MetadataStore
    participant ixmp4

    User->>Service: Submit form + CSV
    Note over Service: Validate form and CSV format
    Service->>MetadataStore: Create/link category
    Service->>MetadataStore: Create/link tags
    Service->>MetadataStore: Create indicator record
    Service->>ixmp4: Create regions if needed
    Service->>ixmp4: Create unit if needed
    Service->>ixmp4: Import time series data
    Service-->>User: Success response
```

**CSV format:** three columns — region, year, value.

### Error Handling

| Error Type | Response | User Message |
|------------|----------|--------------|
| Missing required fields | 400 | "Name and unit are required" |
| Invalid CSV format | 400 | "CSV must have region, year, value columns" |
| Duplicate indicator | 409 | "An indicator with this name already exists" |
| Metadata store unavailable | 503 | "Metadata service temporarily unavailable" |
| ixmp4 unavailable | 503 | "Time series service temporarily unavailable" |
| Partial failure | 500 | "Upload partially failed, please retry" |

### Implementation Options

| Aspect | Embedded SQL + ORM | Strapi CMS |
|--------|------------------|------------|
| Deployment | Embedded in application | Separate service |
| Admin Interface | Custom or dev tooling | Built-in CMS |
| Query Performance | Local, very fast | Network latency |
| Type Safety | Full TypeScript inference | Manual types |
| Content Editors | Requires custom UI | Built-in workflows |
| Infrastructure | Single file, no hosting | Requires hosting |

**Decision:** Embedded SQL with a type-safe ORM was chosen for the metadata store.

### UI Components

- **Indicator Browser** — category dropdown, tag multi-select, searchable list, detail view with time series chart.
- **Upload Form** — all metadata fields + CSV picker; validates before submission; progress and error feedback.

### ixmp4-ts Integration

Uses `platform.iamc.tabulate()` for queries and `run.iamc.add()` for uploads. The `ixmp4Variable` field bridges the metadata store and ixmp4.
