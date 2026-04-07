# ixmp4 Data Ingestion Conventions

Conventions for structuring data in ixmp4 instances so the adapter can query uniformly across federated instances.

**Status:** Draft — _TBD_ items need alignment before ingestion. _Pending approval_ items need sign-off.

---

## 1. Federation

#### 1.1 Instance Resolution

Each indicator and scenario in the `meta/` response is decorated with an **`instanceId`**. The client includes it in data queries (`impact-time`, `unavoidable-risk`) so the adapter routes to the correct instance.

**Decision:** Pending approval

#### 1.2 Catalogue Filtering

Catalogue queries (`meta/`, dropdowns) query all instances in parallel and merge the results. This adds latency proportional to the slowest instance. Data queries route to a single instance and are not affected.

**Decision:** Pending approval

#### 1.3 Data Ownership

Same variable name on different instances = different indicators, disambiguated by **`instanceId`**. No cross-instance deduplication.

**Decision:** Pending approval

#### 1.4 Adapter Layer

An adapter transforms ixmp4 responses into the JSON shapes the frontend expects, minimizing frontend changes.

**Decision:** Pending approval

#### 1.5 Geography Storage

Geography hierarchy (types, coordinates, parent relationships) lives in a SQL database, not in ixmp4. ixmp4 regions lack type hierarchy, coordinates, and parent references.

**Decision:** Pending approval

#### 1.6 Indicator Display Config

Display metadata (**`colorScale`**, **`direction`**, **`icon`**, **`labelWithinSentence`**) lives in Strapi, extending the existing indicator model.

**Decision:** Pending approval

#### 1.7 Instance Registry

Instances are registered via a self-service API endpoint.

**Decision:** Pending approval

## 2. Variable Naming

How are indicator option parameters (**`time`**, **`reference`**, **`frequency`**, **`spatial`**, **`indicator_value`**) encoded?

- **A)** Pipe-delimited in the variable name: `temperature|annual|pre-industrial`. Available options derived by parsing existing variable names.
- **B)** Separate meta-indicators on the variable: `time=annual`, `reference=pre-industrial`.

**Decision:** _TBD_

## 3. Uncertainty Representation

The frontend expects `[min, value, max]` tuples per timestep. How are min/max stored in ixmp4?

- **A)** Separate variables: `temperature`, `temperature|p10`, `temperature|p90`
- **B)** Separate runs with a **`percentile`** meta-indicator (10, 50, 90)
- **C)** Multi-value columns (if supported by ixmp4)

**Decision:** _TBD_

## 4. Scenario Identification

A scenario is a **Model + Scenario name pair** on a Run (e.g., `MESMER` + `curpol`). The scenario ID is the Run's **`scenario`** field.

**Decision:** Pending approval

## 5. Meta-Indicator Keys

All instances must use the same key names for tag-based filtering.

| Key | Example values |
|-----|---------------|
| `Category` | `Terrestrial Climate`, `Biodiversity`, `Marine Climate` |
| `Sector` | `Energy`, `Agriculture`, `Health` |
| `Project` | `PROVIDE`, `ISIMIP` |
| `Data source` | `Climate Analytics`, `IIASA` |
| `Temporal resolution` | `annual`, `monthly`, `daily` |
| `Spatial resolution` | `country`, `grid-0.5deg`, `city` |

Open: Complete set? Free-form or controlled vocabulary? Casing convention?

**Decision:** _TBD_

## 6. Threshold Storage

Exceedance thresholds for `unavoidable-risk` are indicator-specific. Examples from the current API:

| Indicator | Thresholds | Default |
|-----------|-----------|---------|
| `terclim-mean-temperature` | `[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]` | `2` |
| `biodiversity-*` | `[0.95, 0.9, 0.85, ..., 0.1]` | `0.5` |
| `marclim-sst` | `[0.25, 0.5, ..., 2]` | `1` |
| `glacier-*` | `[0.1, 0.2, ..., 0.99]` | `0.5` |

These can't live in the frontend or the adapter since they depend on the indicator. They need to be stored alongside the indicator definition.

- **A)** Meta-indicators on variables in ixmp4: **`thresholds`**, **`defaultThreshold`**
- **B)** Strapi, as part of the indicator display config

**Decision:** _TBD_

## 7. Region Naming

ixmp4 region names must match the geography **`id`** values in the platform database.

| Type | Example ID |
|------|-----------|
| Countries | `DEU` |
| Cities | `berlin` |
| EEZ | `DEU-eez` |
| Glacier regions | `arctic_canada` |
| River basins | `ob` |
| Global | `global` |

Open:
- Should we use the ixmp4 **`region`** field at all, or link via a different mechanism (e.g., meta-indicator, separate lookup)?
- Should region names include a type prefix (`admin0:DEU`) to avoid collisions?

**Decision:** _TBD_
