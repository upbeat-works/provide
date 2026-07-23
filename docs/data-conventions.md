# ixmp4 Data Ingestion Conventions

Conventions for structuring data in ixmp4 instances so the adapter can query uniformly across federated instances.

**Status:** Draft — _TBD_ items need alignment before ingestion. _Pending approval_ items need sign-off.

---

## 1. Federation

#### 1.1 Instance Resolution

Each indicator and scenario in the `meta/` response is decorated with an instance **`slug`**. The client includes it in data queries (`impact-time`, `unavoidable-risk`) so the adapter routes to the correct instance.

##### Feedback
> ✏️ DH: In the scse manager, we use a **`slug`** as short name - this should be used here as well.

**Decision:** Use **`slug`** for instance identification, aligned with scse manager; approved

#### 1.2 Catalogue Filtering

Catalogue queries (`meta/`, dropdowns) query all instances in parallel and merge the results. This adds latency proportional to the slowest instance. Data queries route to a single instance and are not affected.

##### Feedback
> ✏️ DH: In the **ixmp4** package, we use `meta` for qualitative and quantitative indicators related to a "scenario" (**ixmp4.Run**) like a dictionary. I would argue against re-using that term unless you mean exactly that ixmp4 object (but I don't think that this applies here because meta-indicators do not match the notion of "catalogue filtering").

**Note:** The `meta/` here refers to the API endpoint (`/api/meta/`), not the ixmp4 `meta` concept. Kept as-is for backwards compatibility with the existing frontend.

**Decision:** Keep `meta/` endpoint name for backwards compatibility; approved

#### 1.3 Data Ownership

Same variable name on different instances = different indicators, disambiguated by **`slug`**. No cross-instance deduplication.

**Decision:** Approved

#### 1.4 Adapter Layer

An adapter transforms ixmp4 responses into the JSON shapes the frontend expects, minimizing frontend changes.

> **Note:** The adapter layer is an implementation detail, not an architectural decision. The choice of framework, deployment target (Cloudflare Workers vs. Node.js), or routing strategy is flexible. What matters is that *some* normalization layer exists. Discarded as a decision.

##### Feedback
> ✏️ DH: There is a typescript package, which could be useful here.

**Decision:** Discarded as decision point

#### 1.5 Geography Storage

Geography hierarchy (types, coordinates, parent relationships) lives in a SQL database, not in ixmp4. ixmp4 regions lack type hierarchy, coordinates, and parent references. IIASA will provide the geography IDs and hierarchy mappings to use in the platform database.

##### Feedback
> ✏️ DH: We have a repository for https://github.com/iiasa/scse-geojson shapefiles, which could be useful here.

**Decision:** IIASA provides geography IDs and hierarchy; approved

#### 1.6 Indicator Display Config

Display metadata (**`colorScale`**, **`direction`**, **`icon`**, **`labelWithinSentence`**) lives in Strapi, extending the existing indicator model.

**Decision:** Approved

#### 1.7 Instance Registry

Instances are registered via a hardcoded JSON config file versioned with the codebase. No self-service API.

**Decision:** Approved

## 2. Variable Naming

How are indicator option parameters (**`time`**, **`reference`**, **`frequency`**, **`spatial`**, **`indicator_value`**) encoded?

- **A)** Pipe-delimited in the variable name: `temperature|annual|pre-industrial`. Available options derived by parsing existing variable names.
- **B)** Separate meta-indicators on the variable: `time=annual`, `reference=pre-industrial`.

##### Feedback
> ✏️ DH: There is a risk of confusion here because "variable" (for me) refers to one specific column of the IAMC format. We have naming conventions for variable names detailed at https://docs.ece.iiasa.ac.at/standards/variables.html. But I think that this question relates to something else...

**Decision:** Option A — pipe-delimited in variable name; approved

## 3. Uncertainty Representation

The frontend expects `[min, value, max]` tuples per timestep. How are min/max stored in ixmp4?

- **A)** Separate variables: `temperature`, `temperature|p10`, `temperature|p90`
- **B)** Separate runs with a **`percentile`** meta-indicator (10, 50, 90)
- **C)** Multi-value columns (if supported by ixmp4)

##### Feedback
> ✏️ DH: We use option A for example in the Scenario Compass ensemble, see https://explorer.scenariocompass.org.

**Decision:** Option A — separate variables (e.g., `temperature|p10`, `temperature|p90`); approved

## 4. Scenario Identification

A scenario corresponds to the `scenario` field on an ixmp4 Run. Multiple runs may share the same scenario (e.g., different models). Filtering and display use `run.scenario`, not `run.id`.

##### Feedback
> ✏️ DH: Quote "The scenario ID is the Run's **`scenario`**" - I think that this is a misunderstanding.

**Decision:** Filter and identify scenarios by `run.scenario`; approved

## 5. Meta-Indicator Keys

Runs are tagged with a standardized set of meta-indicators for filtering and discovery. ixmp4 meta-indicators are used intentionally here for their native search/filtering capabilities. All instances must use the same key names and controlled vocabulary.

This is a living table — new keys and values can be added as needed.

| Key | Allowed values |
|-----|---------------|
| `Sector` | `Agriculture`, `Energy`, `Health`, `Infrastructure`, `Forestry`, `Coastal Zones` |
| `Project` | `PROVIDE`, `SPARCCLE`, `Other` |
| `Data source` | _TBD_ |
| `Temporal resolution` | `Annual`, `Monthly`, `Daily`, `Seasonal` |
| `Spatial resolution` | `Global`, `Regional`, `National`, `Sub-national` |

##### Feedback
> ✏️ DH: As stated above, this would be confusing compared to the **ixmp4** meta-indicator terminology, so better use a different name for this feature.

**Decision:** Meta-indicators chosen intentionally for filtering capabilities. Controlled vocabulary; approved

## 6. Threshold Storage

Exceedance thresholds for `unavoidable-risk` are indicator-specific. Examples from the current API:

| Indicator | Thresholds | Default |
|-----------|-----------|---------|
| `terclim-mean-temperature` | `[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]` | `2` |
| `biodiversity-*` | `[0.95, 0.9, 0.85, ..., 0.1]` | `0.5` |
| `marclim-sst` | `[0.25, 0.5, ..., 2]` | `1` |
| `glacier-*` | `[0.1, 0.2, ..., 0.99]` | `0.5` |

These can't live in the frontend or the adapter since they depend on the indicator. They need to be stored alongside the indicator definition.

- ~~**A)** Meta-indicators on variables in ixmp4: **`thresholds`**, **`defaultThreshold`**~~
- ~~**B)** Strapi, as part of the indicator display config~~
- **C)** Hardcoded JSON in the codebase, versioned with the app

##### Feedback
> ✏️ DH: I don't think that A works because meta-indicators are always related to one **ixmp4.Run** object.

**Decision:** Option C — hardcoded JSON in codebase; approved

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

##### Feedback
> ✏️ DH: **ixmp4** has a "hierarchy" attribute as part of the **region** definitions. These are accessible via the API and defined as part of the region codelists, see https://github.com/IAMconsortium/common-definitions/tree/main/definitions/region. The hierarchies are used in the IIASA Scenario Explorer user interface to group regions.

**Decision:** _TBD_
