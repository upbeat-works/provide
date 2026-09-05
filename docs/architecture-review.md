# Architecture review

This review applies the “paranoid bunch” loop. Two earlier reviews covered the project. On 5 September 2026, two more adversarial reviews covered the dashboard chart work with different models. The list joins findings about the same cause. Earlier decisions are kept; new issues are pending.

## Data flow

SvelteKit server loaders fetch content from Strapi and data from two APIs. The local Hono API supplies geography data, a catalog built from ixmp4, and some chart data. The old Climate Analytics API still supplies maps and the avoid flow. Loaders shape these results and put them in SvelteKit page data (`src/lib/utils/apis.js:82-208`).

The Hono catalog logs in to each ixmp4 instance and loads variables, documents, runs, tags, citations, global temperature series, and scenario time spans. It adds PostgreSQL curation data, builds one response, and keeps that response in memory for ten minutes (`api/routes/catalog.ts:36-207`). Chart routes query ixmp4 again and shape the results for the current chart contracts.

In the browser, stores derive catalog data from SvelteKit page data and keep user choices in global Svelte stores and local storage (`src/stores/meta.js:12-107`, `src/stores/state.js:94-657`). The explore page copies URL values into these stores after mount. Charts react to store changes and fetch their data through a shared browser request helper.

Existing charts then shape API data for fixed Svelte components. The new dashboard path is separate and not live: a caller must supply a checked stakeholder definition and a second chart contract. The renderer checks the contract, builds a chart model, and sends it to table or LayerCake mark components. The EU page still renders placeholders, and no API or embed route produces or displays this contract (`src/lib/components/charts/DashboardChart`, `src/routes/(default)/projects/eu-scoreboard/indicators/+page.svelte:274-282`).

## Issues

### 1. Two live API and ID models

**Risk: high**
**Decision: rejected**

The request helper switches between two base URLs and two array formats (`src/lib/api/api.js:121-151`). Translation tables accept both ID spaces, and ImpactGeo adds separate old selections and positional scenario pairs (`src/lib/catalog/translate.js:13-100`, `src/routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte:89-140`). Avoid keeps a separate old catalog because it still calls old endpoints.

One user choice can have two meanings. A missing map entry can silently remove map support. Changes may need matching edits in database seed data, mapping tables, request rules, URL handling, and chart code.

Use one public ID model. If an old service must remain, put its ID change and response shaping behind one Hono endpoint. Do not make UI components or URLs understand old IDs.

### 2. The catalog is a large, expensive failure unit

**Risk: high**
**Decision: deferred**

A cold catalog request waits for all instances and for variables, documents, runs, tags, citations, global temperature data, time spans, and database enrichment (`api/routes/catalog.ts:64-180`). Some work is repeated: the catalog lists runs, then facet loading lists runs again and queries variables once per run (`api/facets.ts:137-160`). `Promise.all` lets one failed source stop the whole catalog. The ten-minute cache delays the next run but does not reduce the work or fault area.

Build the core catalog only from the data needed to choose an indicator and scenario. Load display details through optional paths, or build them when data is published. Share each ixmp4 scan instead of repeating it.

### 3. Cross-instance catalog data loses source ownership

**Risk: high**
**Decision: accepted — fix**

The catalog joins variables from all ixmp4 instances but assigns each indicator to the first instance that contains it (`api/routes/catalog.ts:93-110`). It joins scenario names and time spans across instances (`api/routes/catalog.ts:163-180`), then the browser sends one chosen instance for chart requests.

If two instances contain the same indicator with different parameters or scenarios, the UI can show their union while the chart request reaches only one source. Keep catalog availability tied to its instance, or reject duplicate indicator ownership. Do not flatten sources and then try to recover ownership later.

### 4. Selection state has several sources of truth

**Risk: high**
**Decision: rejected — Avoid loads different datasets that cannot always be translated, so its state must remain separate.**

The explore page writes URL fields into global stores one at a time after mount (`src/routes/(default)/impacts/explore/+page.svelte:68-102`). Charts react to each change. Avoid splits city, indicator, and parameters into `avoid-catalog.js`, but keeps likelihood, study location, and impact level in `avoid.js`. Its URL code writes an impact-level array while chart requests read a separate scalar (`src/lib/utils/url.js:24-34`, `src/routes/(default)/impacts/avoid/components/ThresholdLevels/ThresholdLevels.svelte:14-23`).

Cold loads and navigation can pass through short-lived mixed states and send requests for them. Parse and check one selection object at the route boundary, then change it as one unit. Keep one owner for each avoid choice. Use global stores only for state that must cross routes.

### 5. Case-insensitive duplicate handling can discard data

**Risk: medium**
**Decision: rejected — Scenario names now come from a fixed vocabulary and no longer differ only by letter case. The split-data compatibility handling is stale.**

The code expects scenario names whose only difference is letter case and notes that their data can be split. Impact-time chooses one matching raw key for each percentile (`api/views/impact-time.ts:69-80`). Unavoidable-risk keeps the first row for each lower-case scenario key (`api/views/unavoidable-risk.ts:72-85`). Neither path joins the data held by both spellings.

The API can return an incomplete series that looks valid. Fix the source names if possible. Otherwise, normalize names once when data enters the system and join duplicate series with a clear conflict rule.

### 6. Process and browser caches have unsafe life spans

**Risk: medium**
**Decision: accepted**

The server platform cache is keyed by instance slug and username, but its value also holds the password and service URLs (`api/platform.ts:117-154`). A password or URL change can keep using the old client until restart. The browser cache keeps every request and error for the life of the tab, with no limit or expiry (`src/lib/api/api.js:11`, `src/lib/api/api.js:81-151`).

Use bounded caches with clear expiry and full connection identity. Do not keep failed browser requests. First check whether the ixmp4 client can own token refresh; keep custom token work only if the dependency cannot meet the service contract.

### 7. CMS errors escape the content boundary

**Risk: medium**
**Decision: rejected**

`loadFromStrapi` does not check `res.ok` and returns `data.data` for any JSON response (`src/lib/utils/apis.js:26-43`). Callers then use the result as an array, such as the explore loader at `src/routes/(default)/impacts/explore/+page.server.js:9-14`.

A CMS error can become an unrelated page error. Check the response at the boundary and return either a clear required-content failure or an empty optional-content value. Callers should not each guess which shape an error has.

### 8. The dashboard chart framework has no production path

**Risk: high**
**Decision: rejected**

No production page imports `DashboardChart`. The EU page still renders `ChartPlaceholder`, `config/dashboards` contains only a schema, and no API route produces a chart contract (`src/routes/(default)/projects/eu-scoreboard/indicators/+page.svelte:17,274-282`, `api/index.ts:21-29`). The config loader only reads an object supplied by another caller; it does not load config files (`src/lib/components/charts/DashboardChart/config.ts:13-23`).

The code already supports fields, two axis types, many marks, many grouping fields, ranges, palettes, tables, two validators, and seven render components. Multiple marks add model and legend work, although all current examples use one mark and bars cannot share their required scales with lines or points (`src/lib/components/charts/DashboardChart/contracts.ts:24-78,296-339`, `src/lib/components/charts/DashboardChart/model.ts:52-108`).

Build one full path first: one real sector config, one ixmp4 response, one adapter, and one page chart. Keep one mark per chart. Add more grammar only when a second live chart needs it. Keep the JSON Schema only if outside tools will use it; otherwise keep one validator.

### 9. Two objects can give the same chart different meanings

**Risk: high**
**Decision: deferred**

The stakeholder definition declares `type` and `dimensions`, but `DashboardChart` never reads either. Rendering comes only from `contract.schema` (`src/lib/components/charts/DashboardChart/contracts.ts:3-9`, `src/lib/components/charts/DashboardChart/DashboardChart.svelte:20-37`). A definition can say `line` while its contract renders a table.

Use one source of truth. The adapter should resolve the stakeholder definition into one checked contract, and the page should render that result. Do not pass both unchecked descriptions into the component.

### 10. Dashboard downloads invent routes and inherit old API rules

**Risk: high**
**Decision: rejected**

One action ID is used for both `/api/{id}` and `/embed/{id}`. Neither route exists for dashboard charts (`src/lib/components/charts/DashboardChart/DashboardChart.svelte:20-35`, `src/routes/(embed)/embed/[embed]/+page.svelte:10-14`). When actions are missing but data notes exist, `ChartFrame` still shows download controls. The data menu then uses the chart display ID, the old API host, and the old array format (`src/lib/components/charts/ChartFrame/ChartFrame.svelte:45-50`, `src/lib/components/charts/ChartFrame/DataDownloadMenu.svelte:14-15`). A valid test contract produced a live but false legacy URL for `scenario-pathways`.

Show each action only when its full target exists. Keep data notes separate. Do not infer API or embed routes from a display ID, and do not expose old/new API choices to dashboard callers.

### 11. Contract checks do not own the full boundary

**Risk: high**
**Decision: accepted — fixed**

`DashboardChart` reads `contract.meta.info` before `ChartRenderer` checks the contract. An empty contract throws before the promised invalid-data message can appear (`src/lib/components/charts/DashboardChart/DashboardChart.svelte:29`, `src/lib/components/charts/DashboardChart/ChartRenderer.svelte:27-41`). The renderer also catches every error, so a code fault can be shown as bad data and miss normal error reporting.

Check the contract once before any read. Pass the checked value to the frame and renderer. Catch `ChartSchemaError` only; let unexpected errors reach the normal error path.

### 12. Hidden rows still control chart limits

**Risk: medium**
**Decision: accepted — fixed**

Mark groups remove incomplete scatter rows, but automatic axis limits use every source row (`src/lib/components/charts/DashboardChart/model.ts:83-84,179-207`). A point with x `1000000` and a missing y value is not drawn, yet it can stretch the x axis to `1000000`. Band axes can also accept values that bar rendering later drops.

Define usable rows once for each chart type. Build marks and automatic limits from those rows. Keep null line values only where they are needed to show a line gap.
