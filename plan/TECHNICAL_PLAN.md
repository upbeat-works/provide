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

### 1.1 Application Structure

The PROVIDE application is built with SvelteKit and follows a modular architecture. The source code is organized into configuration files, Svelte stores for state management, route handlers for different pages, and a library of reusable components. The main modules include the "Avoiding Future Impacts" and "Future Impacts" explorers, case studies (adaptation), and various supporting pages like documentation and contact information.

The "Avoiding Future Impacts" module is particularly complex, featuring a reference selector for impact levels, certainty/probability selectors, study location pickers, and interactive threshold visualization components. These components work together to allow users to explore which climate scenarios minimize risk from certain impacts in cities.

### 1.2 State Management Flow

```mermaid
flowchart TD
    subgraph URL["URL Parameters"]
        params["?indicator=X&geography=Y&level_of_impact=Z&certainty_level=W"]
    end

    subgraph Sync["urlToState() in +layout.svelte"]
        sync["Syncs URL params to Svelte stores"]
    end

    subgraph Stores["Svelte Stores"]
        subgraph state["state.js"]
            s1["CURRENT_GEOGRAPHY"]
            s2["CURRENT_INDICATOR"]
            s3["CURRENT_SCENARIOS"]
            s4["IS_AVOID_PAGE"]
        end
        subgraph avoid["avoid.js"]
            a1["SELECTED_LIKELIHOOD_LEVEL"]
            a2["SELECTED_STUDY_LOCATION"]
            a3["LEVEL_OF_IMPACT"]
        end
        subgraph meta["meta.js"]
            m1["LIKELIHOODS"]
            m2["STUDY_LOCATIONS"]
            m3["INDICATORS"]
            m4["GEOGRAPHIES"]
        end
    end

    subgraph Components["Components Subscribe"]
        fetch["fetchData(store, { endpoint, params }) → API"]
    end

    URL --> Sync --> Stores --> Components
```

The application uses URL-based state management where query parameters are synchronized with Svelte stores. When the URL changes, the `urlToState()` function in the layout component updates the relevant stores. Components subscribe to these stores and trigger API calls when their dependencies change. This approach enables deep linking and shareable URLs while maintaining a reactive data flow throughout the application.

### 1.3 Key Configuration

The application centralizes its configuration in a dedicated config file that defines route paths, display labels, API endpoints, and constraints specific to each module. For the "Avoiding Future Impacts" feature, this includes restrictions on which geography types (currently only cities) and which scenarios are available. The config also manages localStorage keys for persisting user preferences like likelihood levels and study locations.

---

## 2. Implementation Timeline

The following Gantt chart illustrates the planned sequence and dependencies between deliverables. Deliverables 1 (Landing Page) and 2 (Methodology & Key Concepts) run in parallel as the foundation. Deliverables 3 (Tools) and 4 (Indicator Catalog) can proceed in parallel after that. Deliverable 5 (GeoServer) runs concurrently as infrastructure work. Deliverable 6 (EU Scoreboard) depends on the Tools, Indicator Catalog, and GeoServer being in place. Deliverable 7 (Case Studies) follows as an enhancement. Deliverable 8 (Project Landing Pages) only requires the design system and can run independently after Deliverable 1.

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

### 3.1 Overview

The landing page redesign focuses on improving discoverability and clearly communicating what the tool does and how to use it. Users should immediately understand the platform's purpose and find relevant entry points for their needs. This deliverable also includes updates to the design system color palette.

### 3.2 Mission Statement

The landing page will feature a crisp mission line that establishes the platform's value proposition. A short statement such as "Thinking about the future of climate" will anchor the page, with supporting copy that explains the tool's capabilities. The exact copy will be refined with stakeholder input, but the placement and visual hierarchy will be established in this deliverable.

Each quick action will link to the most relevant tool or workflow, with brief explanatory text helping users understand what they'll find.

### 3.3 Tools Cards

The landing page will showcase project and tool cards linking to specialized analytical features. These cards provide visual entry points to key areas of the platform:

- **Avoid Future Impacts** - Explore which scenarios minimize risk in cities
- **EU Scoreboard** - European climate performance metrics

### 3.4 Featured Content

An editorially curated section will spotlight timely datasets, recent case studies, or seasonal content. This "Featured" area gives editors flexibility to highlight Case studies.

Content will be managed through Strapi with fields for title, description, thumbnail, link, and display dates to support time-limited features.

### 3.5 Entry Points

Based on user research and stakeholder input, the following entry points should be prominently accessible from the landing page:

- Explore
- Avoiding future impacts (scenario comparison)
- EU Scoreboard (regional metrics)
- Case studies (real-world examples)

### 3.6 Design System Updates

The design system color palette will be updated to improve visual hierarchy, accessibility, and brand consistency. Changes will include:

- Refined primary and secondary color values
- Improved contrast ratios for accessibility compliance
- Updated semantic color tokens (success, warning, error states)
- Consistent application across all components

The theme store and CSS custom properties will be updated, with changes propagating automatically to all components using the design tokens.

### 3.7 Implementation Checklist

- Landing Page Development
- Design System

---

## 4. Deliverable 2: Methodology & Key Concepts

### 4.1 Overview

The Methodology and Key Concepts sections currently exist as separate areas of the site. This deliverable merges them into a single, unified knowledge base with improved navigation and browsing. Users will be able to discover and navigate between methodology explanations and key concept definitions through a cohesive interface.

### 4.2 Unified Structure

The merged section will combine methodology pages and key concept entries into a single browsable collection. Content will be organized with categories and a search function, allowing users to quickly find relevant explanations regardless of whether they originated as methodology or key concept content.

### 4.3 Navigation Improvements

The browsing experience will be improved with a sidebar or index view listing all entries, in-page linking between related concepts, and breadcrumb navigation for context. Entry points from other parts of the application (e.g., tooltips, info icons) will link directly to the relevant entry.

### 4.4 Implementation Checklist

- Content Audit & Merge
- Route & Navigation Setup
- Browse & Search Interface

---

## 5. Deliverable 3: Tools

### 5.1 Overview

The Tools will serve as a dedicated landing page for specialized analytical tools built on the PROVIDE climate data. The first project to be featured is "Avoiding Future Impacts," which will be migrated from its current location at `/impacts/avoid` to a new `/tools/avoiding-future-impact` route. This reorganization creates a scalable structure for adding future tools while improving discoverability.

### 5.2 Content Management via Strapi

Tools will be managed through Strapi CMS, allowing content editors to add and configure new tools without code changes. A new "Tools" collection will be created with fields for slug, title, description, thumbnail, compatible geography types, available scenarios, and publication status. The hub page will fetch this data at build time, rendering only published items.

This approach provides flexibility for stakeholders to manage project metadata, update descriptions, and control visibility directly from the CMS. Project-specific settings like geography constraints and scenario availability can be configured per-item, enabling diverse analytical tools to coexist within the hub.

### 5.3 Route Structure

A new `/tools` route will be created with a landing page displaying project cards in a grid layout. Each card will show a thumbnail, title, and description, linking to the project's dedicated page. The "Avoiding Future Impacts" project will have its own nested route with a custom layout that includes a back link to the hub, main controls, and project-specific introductory content.

The project page itself will retain all the functionality of the current avoid page, including the reference selector, certainty level picker, study location selector, and the threshold visualization sections. The components will be imported from their existing locations or migrated as needed.

### 5.4 Backward Compatibility

To ensure existing links and bookmarks continue to work, the original `/impacts/avoid` route will be converted to a redirect. When users visit the old URL, they will be automatically redirected to the new location with a 301 (permanent) redirect. Query parameters will be preserved during the redirect so that shared links with specific indicator and geography selections remain functional.

### 5.5 Navigation and Deep Linking

The main site header will be updated to include a "Tools" link alongside the existing navigation items. Additionally, a new component will be created for the Future Impacts explore page that detects when the current selection (indicator and geography) is compatible with a deep dive and displays a contextual link inviting users to explore that tool with their current selection.

### 5.6 Implementation Checklist

- Strapi Configuration
- Route Development
- Integration

---

## 6. Deliverable 4: Indicator Catalog

### 6.1 Overview

The Indicator Catalog provides a unified system for managing climate and environmental indicators with rich metadata support. It enables users to browse, filter, and visualize indicators through category dropdowns, tag-based filtering, and time series charts. The catalog bridges metadata management with time series storage in ixmp4.

### 6.2 Hybrid Architecture

The solution uses a hybrid approach due to ixmp4's lack of native metadata support. A separate metadata store handles indicator information including names, descriptions, categories, and tags. The ixmp4 backend stores time series data with region, year, and value dimensions. A link field (`ixmp4Variable`) connects records in both systems.

```mermaid
flowchart LR
    subgraph Frontend["User Interface"]
        browser["Indicator Browser"]
        chart["Time Series Chart"]
    end

    subgraph Service["Catalog Service"]
        meta["Metadata Queries"]
        ts["Time Series Queries"]
    end

    subgraph Storage["Data Storage"]
        metadata["Metadata Store"]
        ixmp4["ixmp4 Backend"]
    end

    browser --> meta --> metadata
    chart --> ts --> ixmp4
    metadata <-.->|"ixmp4Variable"| ixmp4
```

### 6.3 Metadata Store

The metadata store uses an embedded SQL database with a type-safe ORM, providing a self-contained solution with no external dependencies. Best suited for developer-managed data with simple deployment requirements.

### 6.4 Core Features

**Indicator Browser** allows users to explore indicators through a category dropdown for high-level filtering, a tag multi-select for granular filtering, and a searchable list displaying indicator names and descriptions.

**Time Series Visualization** displays indicator data as interactive charts. When a user selects an indicator, the system fetches time series data from ixmp4 using the linked variable name and renders it with region and year dimensions.

**Upload Interface** enables adding new indicators through a form capturing metadata fields plus a CSV file containing time series data. The upload process validates input, stores metadata, and imports time series data into ixmp4.

### 6.5 Implementation Checklist

- Metadata Store Setup
- Catalog Service Development
- Frontend Components

---

## 7. Deliverable 5: GeoServer + MVT Migration

**Priority: Medium**

### 7.1 Current Data Flow

```mermaid
flowchart LR
    API["Data API<br/>(JSON/GeoJSON)"] --> Client["Client JS<br/>Processing"] --> Mapbox["Mapbox GL<br/>Rendering"]
    Client --> Worker["Web Worker<br/>geomask.js<br/>(Turf.js clip)"]
```

Currently, the application fetches geographic data as GeoJSON from the data API and processes it client-side. This includes converting grid coordinates to GeoJSON polygons, generating D3 contours, and applying clipping masks via a web worker using Turf.js. While this approach works, it places significant computational burden on the client and limits the ability to efficiently serve large datasets or support complex styling at multiple zoom levels.

### 7.2 Target Architecture

```mermaid
flowchart LR
    PostGIS["PostGIS<br/>Database"] --> GeoServer["GeoServer<br/>+ GeoWebCache"] --> Mapbox["Mapbox GL<br/>Native MVT"]
    GeoServer --> Tiles["Vector Tiles<br/>(MVT)<br/>Pre-generated"]
```

The migration will move geographic data processing to the server side using GeoServer with PostGIS. Impact data and boundary geometries will be stored in PostGIS and served as Mapbox Vector Tiles (MVT) through GeoServer's GeoWebCache. This enables pre-generated tiles at multiple zoom levels, dramatically reduces client-side processing, and allows Mapbox GL to render the data natively with efficient styling through expressions.

### 7.3 Environment and Configuration

The application will require new environment variables for the GeoServer URL and workspace name. The config will be extended with layer name mappings and a function to generate MVT tile URLs in the format expected by Mapbox GL. This centralized configuration ensures consistency across all components that consume vector tiles.

### 7.4 Frontend Components

A new `VectorTileLayer` Svelte component will be created to handle adding vector tile sources and layers to the Mapbox map. This component will accept props for the layer configuration, paint properties, layout settings, and filter expressions. It will manage the lifecycle of sources and layers, cleaning them up when the component is destroyed, and will reactively update paint properties and filters when props change.

The existing Maps component in the explore section will be updated to use the new VectorTileLayer component instead of the current GeoJSON-based approach. Color scales currently implemented with D3 will be converted to Mapbox style expressions that interpolate colors based on feature properties. Filters will be constructed to show only data for the currently selected scenario and year.

### 7.5 API Utilities

New utility functions will be added to the API module for interacting with GeoServer. These include fetching layer capabilities via WMS GetCapabilities, retrieving available property values via WFS GetPropertyValue, and getting feature information for clicked points via WMS GetFeatureInfo. These utilities enable the application to dynamically discover available data and provide interactive features like tooltips on hover or click.

### 7.6 Cleanup

Once the MVT migration is complete and validated, several client-side processing components can be removed. The geomask web worker will no longer be needed since clipping is handled server-side. The coordinate-to-polygon and contour generation functions in the geo utilities can be removed, though color scale utilities should be retained for other uses.

### 7.7 Implementation Checklist

- Infrastructure Setup
- Data Pipeline
- Frontend Development
- Migration & Cleanup

---

## 8. Deliverable 6: EU Scoreboard

**Priority: Medium**

### 8.1 Overview

The EU Scoreboard is a new project to be added to the Tools, providing a comparative view of climate performance metrics across European countries and regions. It enables users to explore how different EU member states are performing on key climate indicators, compare trajectories, and understand regional variations in climate risk and adaptation progress.

### 8.2 Core Features

**Country Comparison Dashboard** presents key climate indicators for EU member states in a comparative format. Users can select multiple countries to compare side-by-side, with visualizations showing current values, historical trends, and projected trajectories.

**Scenario Comparison** enables users to see how different climate pathways affect country-level outcomes, helping policymakers understand the implications of various mitigation and adaptation strategies.

### 8.3 Data Integration

The EU Scoreboard will integrate with the Indicator Catalog (Deliverable 3) for metadata and with ixmp4 for time series data. Country and regional boundaries will be served via GeoServer (Deliverable 4) for map visualizations. The project will filter available indicators to those with EU coverage and aggregate data appropriately for country-level views.

### 8.4 User Interface Components (TBD)

**Scoreboard Landing** provides an overview of EU climate performance with headline metrics and a map showing the geographic distribution of key indicators. Featured insights highlight notable findings or recent changes.

**Comparison Tool** allows side-by-side comparison of selected countries across chosen indicators. Users can save and share comparison configurations via URL parameters.

**Interactive Maps** display geographic patterns using choropleth maps with the ability to toggle between different indicators and time periods.

### 8.5 Content Management

EU Scoreboard content will be managed through Strapi alongside other deep dives.

### 8.6 Implementation Checklist

- Data Preparation
- Strapi Configuration
- Route Development
- Visualization Components
- Integration

---

## 9. Deliverable 7: Case Studies Enhancement

**Priority: Medium**

### 9.1 Current Structure

The case studies section (adaptation) currently displays city-based case studies loaded from Strapi CMS. Each case study has a dedicated page with various content sections including avoiding impacts visualizations, future impacts data, image sliders, and explorer links. The landing page presents all case studies in a simple list format.

### 9.2 Filter Components

New UI components will be created for displaying categories and tags.

### 9.3 Landing Page Updates

The adaptation landing page will be enhanced with filter controls at the top, allowing users to filter case studies by category and/or tags. Filters will be reflected in the URL query parameters, enabling shareable filtered views.

### 9.4 New Visualization Components

To enrich case study content, new visualization components will be developed.

These components will be integrated with Strapi's dynamic zones feature, allowing content editors to add rich visualizations to case studies without developer intervention.

### 9.5 Implementation Checklist

- CMS Configuration
- Filter System
- Visualization Components

---

## 10. Deliverable 8: Project Landing Pages

### 10.1 Overview

Unlisted project landing pages will serve as shareable entry points for individual PROVIDE projects. Each page provides a brief description of the project and links to its relevant Explore view and Tools page. These pages are not listed in the main navigation but can be shared externally, improving SEO and providing a clean onboarding path for users arriving from external links.

### 10.2 Page Structure

Each project landing page will include a title, short description, and prominent call-to-action links to the Explore interface (pre-filtered for that project's indicators and geography) and the corresponding Tools page. The pages will use the new design system and follow a consistent, minimal template.

### 10.3 Implementation Checklist

- Page Template & Route Setup
- Strapi Content Type for Project Pages
- SEO Metadata (title, description, Open Graph tags)

---

## 11. Indicator Catalog Design

This section details the design for the indicator catalog's data model, API, and UI components.

### 11.1 Goals

- Rich metadata support including name, description, category, tags, source, project, and unit
- Time series data storage with region, year, and value dimensions
- Query capabilities for UI components such as dropdowns and multi-select filters
- Integration with ixmp4-ts for time series storage

### 11.2 Constraint

The ixmp4 backend is required for time series storage but lacks native support for categories, tags, and rich metadata on variables. This necessitates a hybrid architecture with a separate metadata store.

### 11.3 Hybrid Architecture

The solution separates concerns between metadata management and time series storage. A metadata store handles rich indicator information including categories, tags, and descriptions. The ixmp4 backend stores the actual time series data. A link field (`ixmp4Variable`) connects records in both systems, allowing the UI to query metadata for filtering and then fetch corresponding time series data.

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

### 11.4 Data Model

#### Indicator

The core entity representing a climate or environmental indicator with rich metadata.

| Field | Description | Required |
|-------|-------------|----------|
| name | Human-readable indicator name | Yes |
| description | Detailed description with markdown support | No |
| category | Reference to a category for classification | No |
| tags | Multiple tags for granular labeling | No |
| source | Data source (e.g., "IIASA") | No |
| project | Project name (e.g., "Climate Pathways") | No |
| unit | Measurement unit (e.g., "days/year") | Yes |
| ixmp4Variable | Link to the ixmp4 variable name | Yes (unique) |

#### Category

High-level classification for organizing indicators.

| Field | Description | Required |
|-------|-------------|----------|
| name | Category name (e.g., "Climate", "Energy", "Health") | Yes (unique) |

#### Tag

Granular labels that can be applied across categories for flexible filtering.

| Field | Description | Required |
|-------|-------------|----------|
| name | Tag name (e.g., "temperature", "health", "emissions") | Yes (unique) |

### 11.5 API Design

#### Query Operations

The catalog service exposes methods for querying metadata and time series data.

**Get Categories** returns a list of all category names, sorted alphabetically, for populating dropdown menus.

**Get Tags** returns a list of all tag names, sorted alphabetically, for populating multi-select filters.

**Get Indicators** accepts optional filters for category, tags, and search text. It returns indicator metadata including name, description, category, tags, and the ixmp4Variable link. When filtering by multiple tags, indicators must have all specified tags (AND logic).

**Get Time Series** takes an ixmp4Variable identifier and optional filters for region and year range. It queries the ixmp4 backend directly and returns a data frame with region, year, unit, and value columns.

#### Query Flow

```mermaid
sequenceDiagram
    participant User
    participant Service
    participant MetadataStore
    participant ixmp4

    User->>Service: Browse indicators by category
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

### 11.6 Upload Flow

New indicators are uploaded through a form that captures metadata and a CSV file containing time series data. The upload process validates input, stores metadata in the metadata store, and imports time series data into ixmp4.

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

#### CSV Format

The time series CSV must contain three columns: region, year, and value. Each row represents a single data point for a specific region and year.

| region | year | value |
|--------|------|-------|
| Global | 2020 | 45 |
| Global | 2021 | 52 |
| Europe | 2020 | 28 |

### 11.7 Error Handling

The upload process uses a two-phase commit approach. Metadata is written first, followed by time series data. If the time series import fails, the metadata record is rolled back to maintain consistency between systems.

| Error Type | Response | User Message |
|------------|----------|--------------|
| Missing required fields | 400 | "Name and unit are required" |
| Invalid CSV format | 400 | "CSV must have region, year, value columns" |
| Duplicate indicator | 409 | "An indicator with this name already exists" |
| Metadata store unavailable | 503 | "Metadata service temporarily unavailable" |
| ixmp4 unavailable | 503 | "Time series service temporarily unavailable" |
| Partial failure | 500 | "Upload partially failed, please retry" |

### 11.8 Implementation Options

Two implementation approaches were evaluated for the metadata store:

| Aspect | Embedded SQL + ORM | Strapi CMS |
|--------|------------------|------------|
| Deployment | Embedded in application | Separate service |
| Admin Interface | Custom or dev tooling | Built-in CMS |
| Query Performance | Local, very fast | Network latency |
| Type Safety | Full TypeScript inference | Manual types |
| Content Editors | Requires custom UI | Built-in workflows |
| Infrastructure | Single file, no hosting | Requires hosting |

**Decision:** Embedded SQL with a type-safe ORM was chosen for the metadata store.

### 11.9 User Interface Components

#### Indicator Browser

The main interface for exploring indicators includes a category dropdown for high-level filtering, a tag multi-select for granular filtering, a searchable indicator list with name and description, and a detail view with time series chart.

#### Upload Form

The upload interface captures all metadata fields plus a CSV file picker. It validates the CSV format before submission and displays progress and error feedback during the upload process.

### 11.10 Integration with ixmp4-ts

Time series operations use the ixmp4-ts client library. The platform connection requires authentication configuration. Queries use the `platform.iamc.tabulate()` method with variable and optional region filters. Uploads create a run and use `run.iamc.add()` to import data points.

The `ixmp4Variable` field serves as the bridge between systems. When displaying an indicator, the UI first fetches metadata from the metadata store, then uses the ixmp4Variable value to query time series data from ixmp4.
