# Indicator Catalog Technical Design

## Overview

This document outlines the technical design for implementing a data catalog for climate/environmental indicators within the IIASA PROVIDE application.

### Goals
- Rich metadata support (name, description, category, tags, source, project, unit)
- Time series data storage (region, year, value)
- Query capabilities for UI dropdowns/menus (filter by category, tags)
- Integration with existing infrastructure (Strapi CMS, ixmp4-ts)

### Constraint
Must use **ixmp4-ts** for time series storage, which lacks native support for categories, tags, and rich metadata on variables.

---

## Current Architecture Analysis

### Existing Infrastructure

```mermaid
flowchart TB
    subgraph App["PROVIDE Application (SvelteKit)"]
        subgraph apis["src/lib/utils/apis.js"]
            loadFromStrapi["loadFromStrapi()"]
            loadFromAPI["loadFromAPI()"]
            loadMetaData["loadMetaData()"]
        end
        subgraph stores["src/stores/meta.js"]
            INDICATORS
            DICTIONARY_INDICATORS
            INDICATOR_PARAMETERS
        end
    end

    subgraph Strapi["Strapi CMS (Heroku)"]
        direction TB
        collections["Collections:<br/>• indicators<br/>• scenarios<br/>• case-studies<br/>• stories"]
    end

    subgraph CA["Climate Analytics API"]
        direction TB
        endpoints["Endpoints:<br/>• /meta/<br/>• /data/"]
    end

    App --> Strapi
    App --> CA
```

### ixmp4-ts Library Structure

```mermaid
classDiagram
    class Platform {
        +runs: RunRepository
        +iamc: PlatformIamcData
        +scenarios: ScenarioRepository
        +models: ModelRepository
        +meta: MetaIndicatorRepository
        +regions: RegionRepository
        +units: UnitRepository
    }

    class PlatformIamcData {
        +variables: VariableRepository
        +tabulate(variable, region, ...)
    }

    class RunRepository {
        +create(model, scenario)
    }

    class Run {
        +iamc: RunIamcData
    }

    class RunIamcData {
        +add(dataFrame, DataPointType)
    }

    Platform --> PlatformIamcData : iamc
    Platform --> RunRepository : runs
    RunRepository --> Run
    Run --> RunIamcData : iamc
```

**Key Methods:**
- `platform.iamc.tabulate({ variable, region, ... })` - Time series queries
- `run.iamc.add(dataFrame, DataPointType.ANNUAL)` - Add data points
- `platform.regions.create({ name })` - Create regions
- `platform.units.create({ name })` - Create units

---

## Proposed Solution: Hybrid Architecture

Since ixmp4 lacks native metadata support, we use a **hybrid approach**:
- **Strapi CMS** → Rich metadata (categories, tags, descriptions)
- **ixmp4** → Time series data (region, year, value)
- **Link field** → `ixmp4Variable` connects the two systems

```mermaid
flowchart TB
    subgraph UI["User Interface"]
        dropdown["Category<br/>Dropdown"]
        tags["Tags<br/>Multi-sel"]
        list["Indicator List<br/>with descriptions"]
        chart["Indicator Chart<br/>(line/bar/etc)"]

        dropdown --> chart
        tags --> chart
        list --> chart
    end

    subgraph Service["Indicator Catalog Service<br/>src/lib/services/indicator-catalog/"]
        metadata["Metadata Queries<br/>(categories, tags,<br/>search, filter)"]
        timeseries["Time Series Queries<br/>(region, year, value)"]
    end

    subgraph Strapi["Strapi CMS (Metadata Store)"]
        CatalogIndicator["CatalogIndicator<br/>├─ name<br/>├─ description<br/>├─ category (rel)<br/>├─ tags (rel)<br/>├─ source<br/>├─ project<br/>├─ unit<br/>└─ ixmp4Variable"]
        Category["Category<br/>└─ name"]
        Tag["Tag<br/>└─ name"]
    end

    subgraph ixmp4["ixmp4 Backend (Time Series Store)"]
        variable["variable<br/>└─ name"]
        ts["timeseries<br/>├─ region<br/>├─ unit<br/>└─ variable"]
        datapoints["datapoints<br/>├─ step_year<br/>└─ value"]
        variable --> ts --> datapoints
    end

    UI --> Service
    chart -.->|"Time series data"| timeseries
    metadata --> Strapi
    timeseries --> ixmp4
    CatalogIndicator <-->|"link via ixmp4Variable"| variable
```

---

## Data Model

### Strapi Content Types

#### CatalogIndicator

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | Text | Human-readable indicator name | ✓ |
| description | Rich Text | Detailed description with markdown support | |
| category | Relation → Category | Many-to-one relationship | |
| tags | Relation → Tag | Many-to-many relationship | |
| source | Text | Data source (e.g., "IIASA") | |
| project | Text | Project name (e.g., "Climate Pathways") | |
| unit | Text | Measurement unit (e.g., "days/year") | ✓ |
| ixmp4Variable | Text | **Link to ixmp4 variable name** | ✓ (unique) |

#### Category

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | Text | Category name (e.g., "Climate", "Energy") | ✓ (unique) |
| indicators | Relation → CatalogIndicator | One-to-many (inverse) | |

#### Tag

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | Text | Tag name (e.g., "temperature", "health") | ✓ (unique) |
| indicators | Relation → CatalogIndicator | Many-to-many (inverse) | |

### ixmp4 Data Structure

```mermaid
erDiagram
    VARIABLE {
        string name "heat_stress_days_28c"
    }

    TIMESERIES {
        string region "Global, Europe, Asia"
        string unit "days/year"
        string variable "heat_stress_days_28c"
    }

    DATAPOINTS {
        int step_year "2020, 2021, 2022"
        float value "45, 52, 58, 28"
        int timeseries_id "FK"
    }

    VARIABLE ||--o{ TIMESERIES : "matches ixmp4Variable"
    TIMESERIES ||--o{ DATAPOINTS : contains
```

**Example Data:**

| region | unit | variable |
|--------|------|----------|
| Global | days/year | heat_stress_days_28c |
| Europe | days/year | heat_stress_days_28c |
| Asia | days/year | heat_stress_days_28c |

| step_year | value | timeseries_id |
|-----------|-------|---------------|
| 2020 | 45 | 1 |
| 2021 | 52 | 1 |
| 2022 | 58 | 1 |
| 2020 | 28 | 2 (Europe) |

---

## The Link: ixmp4Variable

The `ixmp4Variable` field bridges the two databases:

```mermaid
flowchart LR
    subgraph Strapi["Strapi (Metadata)"]
        name["CatalogIndicator.name<br/>'Days a year with high heat stress'"]
        slug["CatalogIndicator.ixmp4Variable<br/>'heat_stress_days_28c'"]
        name -->|"slugify()"| slug
    end

    subgraph ixmp4["ixmp4 (Time Series)"]
        var["variable.name<br/>'heat_stress_days_28c'"]
    end

    slug ==>|"matches"| var
```

### Slug Generation Rules

1. Convert to lowercase
2. Normalize unicode (remove diacritics)
3. Convert subscript/superscript numbers (CO₂ → co2)
4. Remove special characters except alphanumeric
5. Replace spaces/hyphens with underscores
6. Collapse multiple underscores
7. Ensure uniqueness (append counter if needed)

**Examples:**
| Input | Output |
|-------|--------|
| "Days a year with high heat stress" | `days_a_year_with_high_heat_stress` |
| "CO₂ Emissions (Mt/year)" | `co2_emissions_mt_year` |
| "Global Mean Temperature Δ" | `global_mean_temperature` |

---

## File Structure

```
provide/src/lib/services/indicator-catalog/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript type definitions
├── strapi-client.ts         # Strapi API client for metadata
├── ixmp4-client.ts          # ixmp4-ts wrapper for time series
├── indicator-service.ts     # Main service combining both
├── upload-service.ts        # Handles indicator upload flow
└── utils.ts                 # Slug generation, CSV parsing
```

---

## API Design

### Query Methods

#### Get Categories (for dropdown)

```typescript
async function getCategories(): Promise<string[]>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant Strapi
    Client->>Strapi: GET /api/categories?fields[0]=name&sort=name:asc
    Strapi-->>Client: ["Climate", "Energy", "Population", ...]
```

#### Get Tags (for multi-select)

```typescript
async function getTags(): Promise<string[]>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant Strapi
    Client->>Strapi: GET /api/tags?fields[0]=name&sort=name:asc
    Strapi-->>Client: ["emissions", "health", "temperature", ...]
```

#### Get Indicators (filtered list)

```typescript
async function getIndicators(filter?: {
  category?: string;
  tags?: string[];
  search?: string;
}): Promise<IndicatorMetadata[]>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant Strapi
    Client->>Strapi: GET /api/catalog-indicators<br/>?filters[category][name][$eq]=Climate<br/>&filters[tags][name][$in]=health,temperature<br/>&populate[category]=*&populate[tags]=*
    Strapi-->>Client: [{ id, name, description, category, tags, ixmp4Variable, ... }]
```

#### Get Time Series (for charts)

```typescript
async function getTimeSeries(
  ixmp4Variable: string,
  filter?: { region?: string; yearStart?: number; yearEnd?: number }
): Promise<TimeSeriesData>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant ixmp4
    Client->>ixmp4: platform.iamc.tabulate({ variable: { name: "..." }, region: { name: "..." } })
    ixmp4-->>Client: DataFrame (region, year, unit, value)
```

---

## Upload Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant UploadService
    participant Strapi
    participant ixmp4

    Client->>UploadService: POST /upload {formData, csv}

    Note over UploadService: 1. Validate form + CSV
    Note over UploadService: 2. Generate ixmp4Variable slug

    UploadService->>Strapi: 3. Get/Create Category
    Strapi-->>UploadService: Category response

    UploadService->>Strapi: 4. Get/Create Tags
    Strapi-->>UploadService: Tags response

    UploadService->>Strapi: 5. Create CatalogIndicator
    Strapi-->>UploadService: Indicator created

    UploadService->>ixmp4: 6. Get/Create Regions
    ixmp4-->>UploadService: Regions response

    UploadService->>ixmp4: 7. Get/Create Unit
    ixmp4-->>UploadService: Unit response

    UploadService->>ixmp4: 8. Create Run + Add Data
    ixmp4-->>UploadService: Data stored

    UploadService-->>Client: { indicatorId, ixmp4Variable, success: true }
```

### Upload Form UI

```
┌─────────────────────────────────────────────────────────────────┐
│                    Upload Indicator Page                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  FORM FIELDS (metadata → Strapi)                         │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │  Name:        [Days a year with high heat stress    ]   │   │
│   │  Description: [Number of days per year where WBGT...]   │   │
│   │  Category:    [Climate                          ▼]      │   │
│   │  Tags:        [temperature] [health] [heat] [+]         │   │
│   │  Source:      [IIASA                               ]    │   │
│   │  Project:     [Climate Pathways                    ]    │   │
│   │  Unit:        [days/year                           ]    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  CSV FILE (time series → ixmp4)                          │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │  [Choose File...]  heat_stress_data.csv                  │   │
│   │                                                          │   │
│   │  Expected format:                                        │   │
│   │  ┌────────────┬────────┬─────────┐                       │   │
│   │  │ region     │ year   │ value   │                       │   │
│   │  ├────────────┼────────┼─────────┤                       │   │
│   │  │ Global     │ 2020   │ 45      │                       │   │
│   │  │ Global     │ 2021   │ 52      │                       │   │
│   │  │ Europe     │ 2020   │ 28      │                       │   │
│   │  └────────────┴────────┴─────────┘                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                    [ Upload Indicator ]                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Query Flow Examples

### Example 1: Populate Category Dropdown

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant IndicatorService
    participant Strapi

    User->>Browser: Opens indicator browser
    Browser->>IndicatorService: getCategories()
    IndicatorService->>Strapi: GET /api/categories?fields[0]=name&sort=name:asc
    Strapi-->>IndicatorService: ["Climate", "Energy", "Health", "Population"]
    IndicatorService-->>Browser: Categories list
    Note over Browser: Dropdown populated with categories
```

### Example 2: Filter by Category + Tags

```mermaid
sequenceDiagram
    participant User
    participant IndicatorService
    participant Strapi

    User->>IndicatorService: getIndicators({ category: "Climate", tags: ["health", "temperature"] })

    IndicatorService->>Strapi: GET /api/catalog-indicators<br/>?filters[category][name][$eq]=Climate<br/>&filters[tags][name][$in][0]=health<br/>&filters[tags][name][$in][1]=temperature<br/>&populate=*

    Strapi-->>IndicatorService: Filtered indicators
```

**Result:**

| name | ixmp4Variable |
|------|---------------|
| Days with high heat stress | heat_stress_days_28c |
| Heat-related mortality risk | heat_mortality_risk |

### Example 3: Fetch Time Series for Chart

```mermaid
sequenceDiagram
    participant User
    participant IndicatorService
    participant ixmp4

    User->>IndicatorService: Click "Days with high heat stress"
    IndicatorService->>ixmp4: platform.iamc.tabulate({ variable: { name: "heat_stress_days_28c" } })
    ixmp4-->>IndicatorService: DataFrame with time series
    IndicatorService-->>User: Render Line Chart
```

**Result (DataFrame):**

| region | year | unit | value |
|--------|------|------|-------|
| Global | 2020 | days/year | 45 |
| Global | 2021 | days/year | 52 |
| Global | 2022 | days/year | 58 |
| Europe | 2020 | days/year | 28 |
| Europe | 2021 | days/year | 31 |

```mermaid
xychart-beta
    title "Heat Stress Days"
    x-axis [2020, 2021, 2022]
    y-axis "Days" 20 --> 65
    line "Global" [45, 52, 58]
    line "Europe" [28, 31, 34]
```

---

## Error Handling Strategy

### Transaction Flow with Rollback

```mermaid
flowchart TD
    A["Upload Request"] --> B{"1. Validate Input"}

    B -->|Valid| C["2. Write Strapi (metadata)"]
    B -->|Invalid| D["Return 400<br/>Validation Error"]

    C --> E{"Strapi Write Result"}

    E -->|Success| F["3. Write ixmp4 (time series)"]
    E -->|Failure| G["Return 500<br/>Strapi Error"]

    F --> H{"ixmp4 Write Result"}

    H -->|Success| I["Return 200 OK"]
    H -->|Failure| J["Rollback:<br/>Delete Strapi indicator record<br/>Return 500"]
```

### Error Types

| Error | HTTP Code | User Message |
|-------|-----------|--------------|
| Missing required fields | 400 | "Name and unit are required" |
| Invalid CSV format | 400 | "CSV must have region, year, value columns" |
| Duplicate indicator | 409 | "An indicator with this name already exists" |
| Strapi unavailable | 503 | "Metadata service temporarily unavailable" |
| ixmp4 unavailable | 503 | "Time series service temporarily unavailable" |
| Partial failure | 500 | "Upload partially failed, please retry" |

---

## Integration with Existing Code

### Strapi Client (extend existing apis.js)

The existing `loadFromStrapi()` function in `src/lib/utils/apis.js` can be extended:

```javascript
// Existing function signature
loadFromStrapi(path, fetch, populate = 'populate=*', qs)

// Usage for indicator catalog:
loadFromStrapi('catalog-indicators', fetch, 'populate=category,tags',
  'filters[category][name][$eq]=Climate')
```

### ixmp4-ts Integration

```javascript
import { Platform, DataFrame, DataPointType } from 'ixmp4-ts';

// Initialize platform (needs auth configuration)
const platform = await Platform.create({
  name: 'indicators',
  baseUrl: import.meta.env.VITE_IXMP4_URL,
  auth: { /* JWT auth config */ }
});

// Query time series
const data = await platform.iamc.tabulate({
  variable: { name: 'heat_stress_days_28c' }
});

// Upload time series
const run = await platform.runs.create('Indicators', 'main');
await run.iamc.add(dataFrame, DataPointType.ANNUAL);
```

---

## Strapi Content Type Setup

### Using Strapi Admin UI

1. Navigate to Content-Type Builder
2. Create new Collection Type: **CatalogIndicator**
3. Add fields as specified in Data Model section
4. Create **Category** and **Tag** collection types
5. Set up relations between types
6. Configure API permissions for public/authenticated access

### Alternative: Schema JSON

```json
// catalog-indicator.json
{
  "kind": "collectionType",
  "collectionName": "catalog_indicators",
  "info": {
    "singularName": "catalog-indicator",
    "pluralName": "catalog-indicators",
    "displayName": "Catalog Indicator"
  },
  "attributes": {
    "name": { "type": "string", "required": true },
    "description": { "type": "richtext" },
    "source": { "type": "string" },
    "project": { "type": "string" },
    "unit": { "type": "string", "required": true },
    "ixmp4Variable": { "type": "string", "required": true, "unique": true },
    "category": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::category.category",
      "inversedBy": "indicators"
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::tag.tag",
      "inversedBy": "indicators"
    }
  }
}
```

---

## Environment Variables

Add to `.env`:

```bash
# Existing
VITE_HEROKU_URL=https://your-strapi-instance.herokuapp.com

# New for ixmp4
VITE_IXMP4_URL=https://ixmp.ece.iiasa.ac.at
VITE_IXMP4_PLATFORM=indicators
```

---

## Testing Strategy

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| slugify() | Unicode handling, special chars, uniqueness |
| parseCSV() | Valid CSV, missing columns, invalid values |
| validateIndicatorData() | Required fields, format validation |

### Integration Tests

| Flow | Test Cases |
|------|------------|
| getCategories() | Returns sorted list from Strapi |
| getIndicators(filter) | Category filter, tag filter, combined |
| getTimeSeries() | Variable exists, variable not found |
| uploadIndicator() | Success path, validation failure, rollback |

### E2E Tests

1. Upload new indicator with CSV
2. Browse indicators by category
3. Filter by multiple tags
4. View time series chart
5. Error handling for network failures

---

## Migration Considerations

### Existing Indicators

The current system has indicators in Strapi with `UID` field. Migration path:

1. Create new `CatalogIndicator` content type (don't modify existing `Indicator`)
2. Gradually migrate indicators that need rich metadata + time series
3. Keep existing `Indicator` type for backward compatibility

### Data Migration Script

```
For each existing indicator:
  1. Create CatalogIndicator in Strapi with:
     - Copy name, description
     - Generate ixmp4Variable from UID or name
     - Assign category based on existing grouping
     - Add relevant tags

  2. If time series data exists elsewhere:
     - Parse into DataFrame format
     - Upload to ixmp4 via run.iamc.add()
```

---

## Summary

| Requirement | Solution | Query Support |
|-------------|----------|---------------|
| Name | Strapi `CatalogIndicator.name` | Full-text search |
| Description | Strapi `CatalogIndicator.description` | Full-text search |
| Category | Strapi relation to `Category` | Exact/dropdown filter |
| Tags | Strapi relation to `Tag` (many-to-many) | Multi-select filter |
| Source | Strapi `CatalogIndicator.source` | Filter/display |
| Project | Strapi `CatalogIndicator.project` | Filter/display |
| Unit | Strapi + ixmp4 | Display |
| Time Series | ixmp4 via `ixmp4Variable` link | Fetch by variable name |

This hybrid architecture leverages existing infrastructure (Strapi for CMS, ixmp4-ts for time series) while providing the rich metadata and query capabilities needed for an indicator catalog.
