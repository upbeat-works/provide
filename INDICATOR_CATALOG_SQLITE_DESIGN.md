# Indicator Catalog Technical Design (SQLite + Drizzle)

## Overview

This document outlines the technical design for implementing a data catalog for climate/environmental indicators within the IIASA PROVIDE application using **SQLite with Drizzle ORM** for metadata storage.

### Goals
- Rich metadata support (name, description, category, tags, source, project, unit)
- Time series data storage (region, year, value)
- Query capabilities for UI dropdowns/menus (filter by category, tags)
- Self-contained metadata storage (no external CMS dependency)
- Integration with ixmp4-ts for time series data

### Constraint
Must use **ixmp4-ts** for time series storage, which lacks native support for categories, tags, and rich metadata on variables.

---

## Proposed Solution: Hybrid Architecture

Since ixmp4 lacks native metadata support, we use a **hybrid approach**:
- **SQLite + Drizzle** → Rich metadata (categories, tags, descriptions)
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

    subgraph SQLite["SQLite + Drizzle (Metadata Store)"]
        indicators["indicators<br/>├─ name<br/>├─ description<br/>├─ categoryId (FK)<br/>├─ source<br/>├─ project<br/>├─ unit<br/>└─ ixmp4Variable"]
        categories["categories<br/>├─ id<br/>└─ name"]
        tagsTable["tags<br/>├─ id<br/>└─ name"]
        indicatorTags["indicator_tags<br/>├─ indicatorId<br/>└─ tagId"]
    end

    subgraph ixmp4["ixmp4 Backend (Time Series Store)"]
        variable["variable<br/>└─ name"]
        ts["timeseries<br/>├─ region<br/>├─ unit<br/>└─ variable"]
        datapoints["datapoints<br/>├─ step_year<br/>└─ value"]
        variable --> ts --> datapoints
    end

    UI --> Service
    chart -.->|"Time series data"| timeseries
    metadata --> SQLite
    timeseries --> ixmp4
    indicators <-->|"link via ixmp4Variable"| variable
```

---

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    CATEGORIES {
        integer id PK
        text name UK
        timestamp created_at
    }

    TAGS {
        integer id PK
        text name UK
        timestamp created_at
    }

    INDICATORS {
        integer id PK
        text name
        text description
        integer category_id FK
        text source
        text project
        text unit
        text ixmp4_variable UK
        timestamp created_at
        timestamp updated_at
    }

    INDICATOR_TAGS {
        integer indicator_id PK,FK
        integer tag_id PK,FK
    }

    CATEGORIES ||--o{ INDICATORS : "has many"
    INDICATORS ||--o{ INDICATOR_TAGS : "has many"
    TAGS ||--o{ INDICATOR_TAGS : "has many"
```

### Table Definitions

#### indicators

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | Integer | Primary key, auto-increment | ✓ |
| name | Text | Human-readable indicator name | ✓ |
| description | Text | Detailed description with markdown support | |
| category_id | Integer | Foreign key to categories | |
| source | Text | Data source (e.g., "IIASA") | |
| project | Text | Project name (e.g., "Climate Pathways") | |
| unit | Text | Measurement unit (e.g., "days/year") | ✓ |
| ixmp4_variable | Text | **Link to ixmp4 variable name** | ✓ (unique) |
| created_at | Timestamp | Record creation time | ✓ |
| updated_at | Timestamp | Last update time | ✓ |

#### categories

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | Integer | Primary key, auto-increment | ✓ |
| name | Text | Category name (e.g., "Climate", "Energy") | ✓ (unique) |
| created_at | Timestamp | Record creation time | ✓ |

#### tags

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | Integer | Primary key, auto-increment | ✓ |
| name | Text | Tag name (e.g., "temperature", "health") | ✓ (unique) |
| created_at | Timestamp | Record creation time | ✓ |

#### indicator_tags (Junction Table)

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| indicator_id | Integer | Foreign key to indicators | ✓ (PK) |
| tag_id | Integer | Foreign key to tags | ✓ (PK) |

---

## API Design

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| GET | `/api/tags` | List all tags |
| GET | `/api/indicators` | List indicators (with optional filters) |
| GET | `/api/indicators/:variable` | Get single indicator by ixmp4Variable |
| GET | `/api/indicators/:variable/timeseries` | Get time series data |
| POST | `/api/indicators/upload` | Upload new indicator with CSV |

### Query Methods

#### Get Categories (for dropdown)

```typescript
async function getCategories(): Promise<string[]>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant SQLite
    Client->>SQLite: SELECT name FROM categories ORDER BY name
    SQLite-->>Client: ["Climate", "Energy", "Population", ...]
```

#### Get Tags (for multi-select)

```typescript
async function getTags(): Promise<string[]>
```

**Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant SQLite
    Client->>SQLite: SELECT name FROM tags ORDER BY name
    SQLite-->>Client: ["emissions", "health", "temperature", ...]
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
    participant SQLite

    Client->>SQLite: SELECT indicators.*, categories.name<br/>FROM indicators<br/>LEFT JOIN categories<br/>WHERE category = ? AND name LIKE ?

    Client->>SQLite: SELECT indicator_id FROM indicator_tags<br/>JOIN tags WHERE tags.name IN (?)<br/>GROUP BY indicator_id<br/>HAVING COUNT(*) = ?

    SQLite-->>Client: Filtered indicators with tags
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
    participant API
    participant SQLite
    participant ixmp4

    Client->>API: POST /api/indicators/upload {formData, csv}

    Note over API: 1. Validate form + CSV
    Note over API: 2. Generate ixmp4Variable slug

    API->>SQLite: 3. Get/Create Category
    SQLite-->>API: Category ID

    API->>SQLite: 4. Get/Create Tags
    SQLite-->>API: Tag IDs

    API->>SQLite: 5. INSERT indicator
    SQLite-->>API: Indicator created

    API->>SQLite: 6. INSERT indicator_tags
    SQLite-->>API: Tags linked

    API->>ixmp4: 7. Get/Create Regions
    ixmp4-->>API: Regions response

    API->>ixmp4: 8. Get/Create Unit
    ixmp4-->>API: Unit response

    API->>ixmp4: 9. Create Run + Add Data
    ixmp4-->>API: Data stored

    API-->>Client: { indicatorId, ixmp4Variable, success: true }
```

### Upload Form UI

```
┌─────────────────────────────────────────────────────────────────┐
│                    Upload Indicator Page                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  FORM FIELDS (metadata → SQLite)                         │   │
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
    participant API
    participant SQLite

    User->>Browser: Opens indicator browser
    Browser->>API: GET /api/categories
    API->>SQLite: SELECT name FROM categories ORDER BY name
    SQLite-->>API: ["Climate", "Energy", "Health", "Population"]
    API-->>Browser: JSON response
    Note over Browser: Dropdown populated with categories
```

### Example 2: Filter by Category + Tags

```mermaid
sequenceDiagram
    participant User
    participant API
    participant SQLite

    User->>API: GET /api/indicators?category=Climate&tags=health,temperature

    API->>SQLite: Query indicators with joins and filters

    SQLite-->>API: Filtered indicators with tags
    API-->>User: JSON response
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
    participant API
    participant ixmp4

    User->>API: GET /api/indicators/heat_stress_days_28c/timeseries
    API->>ixmp4: platform.iamc.tabulate({ variable: { name: "heat_stress_days_28c" } })
    ixmp4-->>API: DataFrame with time series
    API-->>User: JSON response
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

    B -->|Valid| C["2. Write SQLite (metadata)"]
    B -->|Invalid| D["Return 400<br/>Validation Error"]

    C --> E{"SQLite Write Result"}

    E -->|Success| F["3. Write ixmp4 (time series)"]
    E -->|Failure| G["Return 500<br/>Database Error"]

    F --> H{"ixmp4 Write Result"}

    H -->|Success| I["Return 200 OK"]
    H -->|Failure| J["Rollback:<br/>DELETE indicator from SQLite<br/>Return 500"]
```

### Error Types

| Error | HTTP Code | User Message |
|-------|-----------|--------------|
| Missing required fields | 400 | "Name and unit are required" |
| Invalid CSV format | 400 | "CSV must have region, year, value columns" |
| Duplicate indicator | 409 | "An indicator with this name already exists" |
| Database unavailable | 503 | "Metadata service temporarily unavailable" |
| ixmp4 unavailable | 503 | "Time series service temporarily unavailable" |
| Partial failure | 500 | "Upload partially failed, please retry" |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| drizzle-orm | Type-safe ORM for SQLite |
| better-sqlite3 | SQLite driver for Node.js |
| drizzle-kit | Migration generation and Drizzle Studio |

---

## Comparison: Strapi vs SQLite + Drizzle

| Aspect | Strapi | SQLite + Drizzle |
|--------|--------|------------------|
| **Deployment** | Separate service (Heroku) | Embedded in app |
| **Admin UI** | Built-in CMS | Drizzle Studio or custom |
| **Scalability** | Horizontal | Vertical (single file) |
| **Complexity** | Higher (external dependency) | Lower (self-contained) |
| **Query Performance** | Network latency | Local, very fast |
| **Schema Changes** | Through Strapi admin | Code-first migrations |
| **Type Safety** | Manual types | Full TypeScript inference |
| **Cost** | Heroku hosting | Free (file-based) |
| **Backup** | Database backup | Copy single file |
| **Best For** | Multi-user CMS, content editors | Developer-managed data |

---

## Migration from Strapi

If migrating from the Strapi-based design:

1. Export existing data from Strapi (categories, tags, indicators)
2. Run migration script to insert into SQLite
3. Verify data integrity
4. Update API endpoints to use new service
5. Remove Strapi dependencies

The migration preserves all relationships and the `ixmp4Variable` links, ensuring time series data in ixmp4 remains accessible.

---

## Summary

| Requirement | Solution | Query Support |
|-------------|----------|---------------|
| Name | SQLite `indicators.name` | Full-text search (LIKE) |
| Description | SQLite `indicators.description` | Full-text search (LIKE) |
| Category | SQLite FK to `categories` | Exact/dropdown filter |
| Tags | SQLite junction table `indicator_tags` | Multi-select filter |
| Source | SQLite `indicators.source` | Filter/display |
| Project | SQLite `indicators.project` | Filter/display |
| Unit | SQLite + ixmp4 | Display |
| Time Series | ixmp4 via `ixmp4Variable` link | Fetch by variable name |

This architecture provides a self-contained, type-safe solution using SQLite with Drizzle ORM for metadata storage while leveraging ixmp4-ts for time series data.
