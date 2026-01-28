# PROVIDE Project - Technical Implementation Plan

## Table of Contents
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Phase 1: Projects Hub Implementation](#2-phase-1-projects-hub-implementation)
3. [Phase 2: Indicator Catalog](#3-phase-2-indicator-catalog)
4. [Phase 3: GeoServer + MVT Migration](#4-phase-3-geoserver--mvt-migration)
5. [Phase 4: Case Studies Enhancement](#5-phase-4-case-studies-enhancement)
6. [Questions for Stakeholders](#6-questions-for-stakeholders)

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

## 2. Phase 1: Projects Hub Implementation

**Priority: High**

### 2.1 Overview

The Projects Hub will serve as a dedicated landing page for specialized analytical tools built on the PROVIDE climate data. The first project to be featured is "Avoiding Future Impacts," which will be migrated from its current location at `/impacts/avoid` to a new `/projects/avoiding-future-impact` route. This reorganization creates a scalable structure for adding future projects while improving discoverability.

### 2.2 Projects Content Management via Strapi

Projects will be managed through Strapi CMS, allowing content editors to add and configure new projects without code changes. A new "Projects" collection will be created with fields for slug, title, description, thumbnail, compatible geography types, available scenarios, and publication status. The projects landing page will fetch this data at build time, rendering only published projects.

This approach provides flexibility for stakeholders to manage project metadata, update descriptions, and control visibility directly from the CMS. Project-specific settings like geography constraints and scenario availability can be configured per-project, enabling diverse project types to coexist within the hub.

### 2.3 New Route Structure

A new `/projects` route will be created with a landing page displaying project cards in a grid layout. Each project card will show a thumbnail, title, and description, linking to the project's dedicated page. The "Avoiding Future Impacts" project will have its own nested route with a custom layout that includes a back link to the projects hub, main controls, and project-specific introductory content.

The project page itself will retain all the functionality of the current avoid page, including the reference selector, certainty level picker, study location selector, and the threshold visualization sections. The components will be imported from their existing locations or migrated as needed.

### 2.4 Backward Compatibility

To ensure existing links and bookmarks continue to work, the original `/impacts/avoid` route will be converted to a redirect. When users visit the old URL, they will be automatically redirected to the new project location with a 301 (permanent) redirect. Query parameters will be preserved during the redirect so that shared links with specific indicator and geography selections remain functional.

### 2.5 Navigation and Deep Linking

The main site header will be updated to include a "Projects" link alongside the existing navigation items. Additionally, a new component will be created for the Future Impacts explore page that detects when the current selection (indicator and geography) is compatible with the "Avoiding Future Impacts" project and displays a contextual link inviting users to explore avoidance scenarios for their current selection.

### 2.6 Implementation Checklist

**Strapi Configuration**
- Create Projects collection with slug, title, description, thumbnail, geographyTypes, scenarios, and isPublished fields
- Add initial "Avoiding Future Impacts" project entry
- Configure media upload for project thumbnails

**Route Development**
- Create projects landing page that fetches from Strapi
- Create avoiding-future-impact project layout and page
- Implement legacy route redirect with parameter preservation

**Integration**
- Update header navigation with Projects link
- Create contextual deep linking component for explore page
- Update state management to recognize the new project route

**Quality Assurance**
- Test navigation flow between projects hub and project pages
- Verify backward compatibility redirect with query parameters
- Validate URL parameter persistence across navigation

---

## 3. Phase 2: Indicator Catalog

**Priority: High**

### 3.1 Overview

The Indicator Catalog provides a unified system for managing climate and environmental indicators with rich metadata support. It enables users to browse, filter, and visualize indicators through category dropdowns, tag-based filtering, and time series charts. The catalog bridges metadata management with time series storage in ixmp4.

For detailed technical design, see the [Indicator Catalog Design Document](./INDICATOR_CATALOG.md).

### 3.2 Hybrid Architecture

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

### 3.3 Metadata Store Options

Two implementation options are available for the metadata store. The choice depends on infrastructure preferences and content management workflows.

**SQLite + Drizzle ORM** provides a self-contained, embedded solution with type-safe queries and no external dependencies. Best suited for developer-managed data with simple deployment requirements. See [SQLite Implementation](./INDICATOR_CATALOG_SQLITE.md) for details.

**Strapi CMS** provides an external headless CMS with a built-in admin interface. Best suited for workflows involving content editors and non-technical users who need to manage indicator metadata. See [Strapi Implementation](./INDICATOR_CATALOG_STRAPI.md) for details.

### 3.4 Core Features

**Indicator Browser** allows users to explore indicators through a category dropdown for high-level filtering, a tag multi-select for granular filtering, and a searchable list displaying indicator names and descriptions.

**Time Series Visualization** displays indicator data as interactive charts. When a user selects an indicator, the system fetches time series data from ixmp4 using the linked variable name and renders it with region and year dimensions.

**Upload Interface** enables adding new indicators through a form capturing metadata fields plus a CSV file containing time series data. The upload process validates input, stores metadata, and imports time series data into ixmp4.

### 3.5 Implementation Checklist

**Metadata Store Setup**
- Choose and configure metadata store (SQLite or Strapi)
- Define schema for indicators, categories, and tags
- Set up development and production environments

**Catalog Service Development**
- Create repository layer for metadata queries
- Implement category and tag listing endpoints
- Implement indicator filtering with category/tag/search support
- Integrate ixmp4-ts for time series queries

**Frontend Components**
- Create indicator browser with category dropdown and tag filter
- Create indicator list with search functionality
- Create time series chart component
- Create upload form with CSV validation

**Quality Assurance**
- Test filtering combinations
- Test time series data retrieval and chart rendering
- Test upload flow with validation errors
- Test error handling and rollback scenarios

---

## 4. Phase 3: GeoServer + MVT Migration

**Priority: Medium**

### 4.1 Current Data Flow

```mermaid
flowchart LR
    API["Data API<br/>(JSON/GeoJSON)"] --> Client["Client JS<br/>Processing"] --> Mapbox["Mapbox GL<br/>Rendering"]
    Client --> Worker["Web Worker<br/>geomask.js<br/>(Turf.js clip)"]
```

Currently, the application fetches geographic data as GeoJSON from the data API and processes it client-side. This includes converting grid coordinates to GeoJSON polygons, generating D3 contours, and applying clipping masks via a web worker using Turf.js. While this approach works, it places significant computational burden on the client and limits the ability to efficiently serve large datasets or support complex styling at multiple zoom levels.

### 4.2 Target Architecture

```mermaid
flowchart LR
    PostGIS["PostGIS<br/>Database"] --> GeoServer["GeoServer<br/>+ GeoWebCache"] --> Mapbox["Mapbox GL<br/>Native MVT"]
    GeoServer --> Tiles["Vector Tiles<br/>(MVT)<br/>Pre-generated"]
```

The migration will move geographic data processing to the server side using GeoServer with PostGIS. Impact data and boundary geometries will be stored in PostGIS and served as Mapbox Vector Tiles (MVT) through GeoServer's GeoWebCache. This enables pre-generated tiles at multiple zoom levels, dramatically reduces client-side processing, and allows Mapbox GL to render the data natively with efficient styling through expressions.

### 4.3 Environment and Configuration

The application will require new environment variables for the GeoServer URL and workspace name. The config will be extended with layer name mappings and a function to generate MVT tile URLs in the format expected by Mapbox GL. This centralized configuration ensures consistency across all components that consume vector tiles.

### 4.4 Frontend Components

A new `VectorTileLayer` Svelte component will be created to handle adding vector tile sources and layers to the Mapbox map. This component will accept props for the layer configuration, paint properties, layout settings, and filter expressions. It will manage the lifecycle of sources and layers, cleaning them up when the component is destroyed, and will reactively update paint properties and filters when props change.

The existing Maps component in the explore section will be updated to use the new VectorTileLayer component instead of the current GeoJSON-based approach. Color scales currently implemented with D3 will be converted to Mapbox style expressions that interpolate colors based on feature properties. Filters will be constructed to show only data for the currently selected scenario and year.

### 4.5 API Utilities

New utility functions will be added to the API module for interacting with GeoServer. These include fetching layer capabilities via WMS GetCapabilities, retrieving available property values via WFS GetPropertyValue, and getting feature information for clicked points via WMS GetFeatureInfo. These utilities enable the application to dynamically discover available data and provide interactive features like tooltips on hover or click.

### 4.6 Cleanup

Once the MVT migration is complete and validated, several client-side processing components can be removed. The geomask web worker will no longer be needed since clipping is handled server-side. The coordinate-to-polygon and contour generation functions in the geo utilities can be removed, though color scale utilities should be retained for other uses.

### 4.7 Implementation Checklist

**Infrastructure Setup**
- Deploy and configure GeoServer instance with GeoWebCache extension
- Set up PostGIS database connection
- Configure CORS for frontend access
- Define tile caching rules and zoom level coverage

**Data Pipeline**
- Import boundary geometries to PostGIS
- Import gridded impact data with appropriate schema
- Configure data update/refresh procedures
- Test tile generation at various zoom levels

**Frontend Development**
- Create the VectorTileLayer component
- Add GeoServer API utility functions
- Update Maps component to use vector tiles
- Convert D3 color scales to Mapbox expressions
- Implement hover and click interactions

**Migration & Cleanup**
- Conduct performance testing and comparison
- Remove deprecated client-side processing code
- Update documentation to reflect new architecture

---

## 5. Phase 4: Case Studies Enhancement

**Priority: Medium**

### 5.1 Current Structure

The case studies section (adaptation) currently displays city-based case studies loaded from Strapi CMS. Each case study has a dedicated page with various content sections including avoiding impacts visualizations, future impacts data, image sliders, and explorer links. The landing page presents all case studies in a simple list format.

### 5.2 Strapi Schema Enhancements

Two new collections will be added to Strapi: categories and tags. Categories provide high-level classification (e.g., "Flooding", "Heat Stress", "Infrastructure") with optional color coding for visual distinction. Tags offer more granular topic labeling that can be applied across categories. Both collections will have many-to-many relationships with case studies, allowing flexible organization and filtering.

The existing case study collection will be extended with relations to these new collections and a publishedAt field for tracking when studies are published. This enables both categorical browsing and chronological sorting.

### 5.3 Filter Components

New UI components will be created for displaying categories and tags. Category badges will be styled with the category's color and can function as both labels and clickable filters. Tag chips will have a more subtle style with visual feedback when selected. These components will be used both on case study cards and in the filter interface.

### 5.4 Landing Page Updates

The adaptation landing page will be enhanced with filter controls at the top, allowing users to filter case studies by category and/or tags. Filters will be reflected in the URL query parameters, enabling shareable filtered views. A new "Recent Case Studies" section will highlight the most recently published or updated studies in a featured grid layout, providing quick access to new content.

The server-side data loading will be updated to fetch categories and tags alongside case studies, apply any active filters from URL parameters, and sort results by date. The page component will handle filter toggle interactions and URL updates using SvelteKit's navigation functions.

### 5.5 New Visualization Components

To enrich case study content, several new visualization components will be developed. A DataTable component will display tabular data with optional sorting capabilities. StatCards will present key metrics in a grid of highlighted cards with optional trend indicators. A Timeline component will show chronological events or milestones. A ComparisonChart component will render bar or line charts for comparing values across categories. An EmbedMap component will allow embedding external map views with proper attribution.

These components will be integrated with Strapi's dynamic zones feature, allowing content editors to add rich visualizations to case studies without developer intervention.

### 5.6 Implementation Checklist

**CMS Configuration**
- Create categories collection with name, slug, description, and color fields
- Create tags collection with name and slug fields
- Add category and tag relations to case study content type
- Ensure publishedAt field is available and populated
- Create visualization component schemas in Strapi

**Filter System**
- Create CategoryBadge and TagChip UI components
- Update landing page to fetch and apply filters
- Implement filter toggle handlers with URL synchronization
- Add Recent Case Studies section with date-based sorting

**Visualization Components**
- Create DataTable component with optional sorting
- Create StatCards component for metrics display
- Create Timeline component for chronological events
- Create ComparisonChart component using existing chart library
- Create EmbedMap component for external map integration
- Add server-side handlers for new Strapi component types

---

## 6. Questions for Stakeholders

### Indicator Catalog
1. Which metadata store approach is preferred (SQLite or Strapi)?
2. What categories and tags should be pre-defined?
3. Who will be responsible for managing indicator metadata?
4. What is the expected volume of indicators?

### GeoServer Migration
1. Is there an existing GeoServer instance available?
2. What hosting environment will be used?
3. What is the expected data update frequency?
4. What zoom levels are required for vector tiles?

### Projects Hub
1. What other projects are planned beyond "Avoiding Future Impacts"?
2. Should projects have their own navigation submenu?
3. Any specific design requirements for project cards?

### Case Studies
1. Which visualization components should be prioritized?
2. What category/topic taxonomy should be pre-defined?
3. Should "Recent" show by creation date or last update date?
4. Expected maximum number of case studies (pagination needs)?

---

## Related Documents

- [Indicator Catalog Design](./INDICATOR_CATALOG.md) - Core architecture and data model
- [Indicator Catalog - SQLite Implementation](./INDICATOR_CATALOG_SQLITE.md) - Embedded database approach
- [Indicator Catalog - Strapi Implementation](./INDICATOR_CATALOG_STRAPI.md) - Headless CMS approach
