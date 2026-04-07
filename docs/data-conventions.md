# ixmp4 Data Ingestion Conventions

Conventions for structuring data in ixmp4 instances. Required for the adapter to query uniformly across federated instances.

**Status:** Draft — decisions marked _TBD_ need alignment before ingestion begins.

---

## 1. Variable Naming

How are indicator option parameters (time, reference, frequency, spatial, indicator_value) encoded?

- **A)** Pipe-delimited in the variable name: `temperature|annual|pre-industrial`
  Available options derived by parsing existing variable names.
- **B)** Separate meta-indicators on the variable: `time=annual`, `reference=pre-industrial`

**Decision:** _TBD_

## 2. Uncertainty Representation

The frontend expects `[min, value, max]` tuples per timestep. How are these stored?

- **A)** Separate variables: `temperature`, `temperature|p10`, `temperature|p90`
- **B)** Separate runs with a `percentile` meta-indicator (10, 50, 90)
- **C)** Multi-value columns (if ixmp4 supports it)

**Decision:** _TBD_

## 3. Scenario Identification

A scenario is a **Model + Scenario name pair** on a Run (e.g., model=`MESMER`, scenario=`curpol`).

Is the scenario ID derived from the Run's `scenario` field or from a meta-indicator?

**Decision:** _TBD_

## 4. Meta-Indicator Keys

All instances must use the same key names for tag-based filtering.

| Key | Example values |
|-----|---------------|
| `Category` | `Terrestrial Climate`, `Biodiversity`, `Marine Climate` |
| `Sector` | `Energy`, `Agriculture`, `Health` |
| `Project` | `PROVIDE`, `ISIMIP` |
| `Data source` | `Climate Analytics`, `IIASA` |
| `Temporal resolution` | `annual`, `monthly`, `daily` |
| `Spatial resolution` | `country`, `grid-0.5deg`, `city` |

Open: Is this the complete set? Free-form or controlled vocabulary? Casing convention?

**Decision:** _TBD_

## 5. Threshold Storage

Exceedance thresholds for unavoidable-risk — where do they live?

- **A)** Meta-indicators on variables: `thresholds=[0,1,2,3,4]`, `defaultThreshold=2`
- **B)** Derived from data range at query time
- **C)** Client sends desired levels in the request

**Decision:** _TBD_

## 6. Region Naming

ixmp4 region names **must match** the geography `id` values in the platform database.

| Type | Example ID |
|------|-----------|
| Countries | `DEU` |
| Cities | `berlin` |
| EEZ | `DEU-eez` |
| Glacier regions | `arctic_canada` |
| River basins | `ob` |
| Global | `global` |

Open: Should region names include a type prefix (e.g., `admin0:DEU`) to avoid collisions, or are the current IDs sufficient?

**Decision:** _TBD_
