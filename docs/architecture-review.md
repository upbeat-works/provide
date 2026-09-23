# Catalog runtime loading: architecture review

**Review date:** 9 September 2026  
**Subject:** `docs/catalog-runtime-loading-design.md`  
**Method:** Two adversarial passes, blended into one list

## Verdict

Request changes before implementation. The split resource model is smaller than
the current catalog, but it does not yet define one meaning for availability or
a safe client state flow. Those gaps can give different answers based on which
selector the user opens first and can lose choices from slow or shared URLs.

## Data flow

Today, a page loader requests geographies and the full catalog. The API scans
IXMP4 variables and runs, builds indicators, parameters, filters, scenarios,
time spans, citations, and GMT data, then adds database fields. The page loader
also requests Strapi and merges its text into the catalog. Svelte stores read
the page data.

After the page loads, the browser asks the API to limit indicators by geography,
geographies by indicator, scenarios by the full selection, and indicators by
advanced filters. The stores join those results to the full catalog. Charts ask
the API for data. The map also changes current IDs to IDs used by the live old
map API.

The design would load two indexes first, limit the second selector after the
first choice, then load indicator and scenario details for the chosen pair. This
can remove the large catalog from most pages. It also moves more work into
browser request state, so the design must say which response may change a choice
and must remove the old full-catalog path instead of keeping both systems.

## Issues and decisions

### 1. Availability has two meanings

**Risk:** Blocker  
**Decision:** Accepted

The design says that both selection orders are equal, but does not define what
“supports” means before parameters are chosen
([design](catalog-runtime-loading-design.md#indicator-chosen-first)). The live
geography-first request accepts an indicator when any variable exists in the
region ([indicators route](../api/routes/indicators.ts#L15)). The live
indicator-first request checks only one present-day, annual, area, 50th
percentile variable ([geographies route](../api/routes/geographies.ts#L15),
[convention](../api/conventions.ts#L95)). The two orders can therefore show
different valid pairs.

Recommendation: define early availability as “at least one valid parameter
combination exists.” Apply that rule to both routes. Load and validate exact
parameters only after both main choices are known.

### 2. Delayed requests have no state rules

**Risk:** Blocker  
**Decision:** Accepted with comments — clear a confirmed incompatible choice
automatically. Review this rule if testing shows confusing behavior.

“Clear or adjust” does not say how to tell loading, failure, and a confirmed
empty result apart ([selection rules](catalog-runtime-loading-design.md#selection-rules)).
This matters because current code treats an empty indicator result as “not
checked yet” ([state store](../src/stores/state.js#L336)), resolves URL values
only once against loaded catalog data
([explore page](../src/routes/(default)/impacts/explore/+page.svelte#L68)), and
may change parameter values when indicator details change
([state store](../src/stores/state.js#L376)). A late response can also replace a
newer choice unless every request has stale-response control.

Recommendation: keep a small state for each request: idle, loading, success, or
failure. Keep URL and stored choices pending until the matching request succeeds.
Only that response may validate or clear them. Ignore or cancel older requests.
Clear a confirmed incompatible choice. Current scenario code instead keeps it so
the user can act ([scenario selection](../src/stores/scenario-selection.js#L4));
change that behavior as part of this work. Do not add a general request
framework.

### 3. The first indicator index still performs an expensive scan

**Risk:** High  
**Decision:** Accepted with comments — measure the scan and final index first.
Do not add pagination unless the unique indicator list is itself too large.

The expected result says expensive IXMP4 work starts after a choice
([expected result](catalog-runtime-loading-design.md#expected-result)). Yet the
live indicator index connects to every source and lists every variable before it
can reduce them to indicators ([indicators route](../api/routes/indicators.ts#L10)).
The split avoids run, GMT, citation, filter, and time-span work, but it does not
avoid the first full variable scan.

Recommendation: state the smaller promise and measure the index time and size.
If the scan is still too slow, the design needs a cheaper source of indicator
index data. Do not add persistence or caching to this draft merely to make the
claim true.

### 4. Advanced filters still depend on the full catalog

**Risk:** Blocker  
**Decision:** Accepted

The current UI sends filter choices to `/api/catalog` to get matching indicator
IDs, option values, and counts ([state store](../src/stores/state.js#L205)). The
proposed indicator index says only that it may take filters, while filter fields
and counts remain open questions. The live indicator route accepts only search
and region ([indicators route](../api/routes/indicators.ts#L10)). The old catalog
cannot be removed until another resource owns this behavior.

Recommendation: decide whether advanced filters remain part of this work. If
they do, define their query fields, count rules, and result shape on the indicator
index. If they do not, remove them from the changed flow and state that the old
catalog remains for pages that use them. Do not build both paths without naming
their owners.

### 5. Pages without a selected pair have no scenario path

**Risk:** High  
**Decision:** Accepted with comments — add a dedicated API endpoint for the
methodology page's global scenario data and time spans.

The proposed scenario list needs an indicator and geography, while the scenario
methodology page needs the global scenario set and time spans without either
choice. That page currently loads the whole catalog
([methodology loader](../src/routes/(default)/methodology/key-terms/+layout.server.js#L1)).
Leaving this open is likely to keep the old catalog beside the new resources.

Recommendation: add a dedicated API endpoint for the methodology page and bind
that page to its result. Remove its full-catalog load. Keep the endpoint limited
to the global scenario data and time spans this page uses.

### 6. Source and resource identity are not defined

**Risk:** High  
**Decision:** Accepted with comments — the frontend keeps the selected instance
name and sends it as a required parameter on every dependent API request.

The indicator index carries `instance`, but the proposed indicator detail and
geography calls carry only the indicator ID. The live scenario route silently
uses the first source when `instance` is absent
([scenario route](../api/routes/scenarios.ts#L17)). The proposed scenario detail
also uses only a scenario ID, although the same name may come from a source and
its detail may be joined to other data. There is one configured source now, so
this is a contract choice rather than a current production fault.

Recommendation: include the instance name in each indicator index entry. The
frontend keeps it with the selected indicator and sends it as a required
parameter on indicator detail, geography availability, scenario availability,
and scenario detail requests. The API must reject a missing or unknown instance
instead of choosing the first one. Define whether a scenario ID is global or
source-bound before adding `/api/scenarios/{id}`.

### 7. Runtime detail and partial failure have no owner

**Risk:** High  
**Decision:** Accepted with comments — each SvelteKit endpoint targets an API
endpoint made for that use case. Reuse is not required when it would load data
the use case does not need.

The design says that Strapi stays in server loaders and that scenario detail is
loaded only where it appears. A choice made in the browser does not run a server
loader unless the app navigates or invalidates page data. The document does not
say whether runtime detail comes from the app server, the Hono API, or a page
reload. It also says a page may show its own Strapi error but gives no result
shape that keeps IXMP4 detail usable when Strapi fails
([Strapi content](catalog-runtime-loading-design.md#strapi-content)).

Recommendation: give each runtime use case a small same-origin SvelteKit server
endpoint. It calls a matching use-case-specific API endpoint and, when needed,
joins the result with Strapi text. It returns API data when Strapi fails. Do not
reuse a broad API endpoint when a smaller use-case endpoint avoids unneeded work.
Also define whether one failed IXMP4 source fails the whole index or returns
other sources with error data. The current routes fail their whole `Promise.all`;
partial results add real state and retry costs.

### 8. Keep old ID changes only at live system boundaries

**Risk:** Medium  
**Decision:** Accepted

“Legacy ID mapping” is listed as possible indicator detail without a stated use.
Some mapping is still required: the map calls a live old data API
([map component](../src/routes/(default)/impacts/explore/components/ImpactGeo/ImpactGeo.svelte#L89)),
and the explore page builds links to the avoid view
([explore page](../src/routes/(default)/impacts/explore/+page.svelte#L60)). By
contrast, accepting old IDs in every new route or URL would preserve
compatibility that has not been requested.

Recommendation: keep canonical IDs in all new resources. Change IDs only at a
live external boundary that still needs it. Old shared URLs containing legacy
IDs do not need to remain valid unless a current use is later found.

## Useful boundaries to keep

The design correctly keeps Strapi from owning IDs and availability, separates
failure of optional text from selection, and delays global scenario and GMT
detail. Joining returned IDs to an index is simple and needs no new abstraction.
Keeping shared caching outside this draft also limits scope.

---

# GeoServer and emissions port: plan review

**Review date:** 21 September 2026
**Subject:** `docs/geoserver-emissions-port-plan.md`
**Method:** Two independent adversarial reviews (GPT-6 Astra and GPT-5.6 Sol),
checked against current code and combined below. Earlier decisions above remain
unchanged. References below use the port plan's line numbers at review time.

## Finding

The decisions below narrow the port to methodology emissions and maps using the
existing selection and naming rules. Downloads use the displayed GeoServer
coverage; styling keeps the current defaults. The plan has been updated with all
decisions. No review decision remains pending.

## Data flow in four paragraphs

The browser loads indicator and geography indexes, then details and availability
for the selected instance and IDs. Current scenario choices come from ixmp4
percentile availability. The map receives the selection through `chartContext`.
Strapi supplies text; it does not decide which data exists.

The proposed map flow asks Hono which years GeoServer holds for a selection, then
asks for a grid. Hono fetches a WCS raster and converts it to the grid the map
already draws. Outlines still come from the old API. Scenario choices remain
those supplied by ixmp4; GeoServer reports which have maps and available years.

Methodology asks its own scenario endpoint for the global series it displays.
That endpoint should read emissions from the selected source, convert units once,
and return points with their years alongside GMT. The frontend draws the lines
and table. The separate scenario popover currently displays GMT, not emissions.

Map publication and lookup use the branch's existing coverage naming convention.
No separate ID mapping or styling store is added. The download route streams the
same coverage used for the map. Tests follow these boundaries and the visible
user flows, with one real WCS check of publication and retrieval.

## Issues and decisions

Ports 1–2 and 4–6 are **accepted**; Port 3 is **deferred**, with current styling
kept for this port. Findings below describe the reviewed draft; each decision
records the agreed outcome applied to the plan.

### Port 1. Fetch emissions only where they are displayed

**Priority:** Medium
**Decision:** Accepted — user: “yes only for methodology.” Applied to the port plan.

Plan lines 19–20, 58–59, and 81–92 add emissions to both methodology and scenario
details. `src/lib/components/controls/ScenarioSelection/ScenarioDetails.svelte`
displays GMT only. This adds a query and a failure source to that panel without
adding visible value. It also conflicts with accepted decision 7 above: each
endpoint should load what its use case needs.

**Recommendation:** Add emissions to methodology only. Give its response the
needed fields without forcing identical payloads on both scenario routes. Add
emissions to the popover later only if that becomes a requested feature.

Keep source errors distinct from absent data, correct units and years, and
instance identity.

### Port 2. Remove raw legacy downloads from GeoServer maps

**Priority:** High
**Decision:** Accepted with comments — user asked to include a GeoServer download
link. Replace legacy downloads with GeoTIFF from the same coverage used by the
map, through the existing map API with `format=geotiff`. Applied to the port plan.

Plan lines 169–174 keep a download when the old API supports the selection.
That proves neither that its values match the GeoServer raster nor that it uses
the same model, units, or dataset version. The current map component builds those
downloads with legacy IDs. Keeping that path adds rules for a second data source.

**Recommendation:** Hide raw data downloads for this port. Keep image export and
the live outline service. Add raw downloads from the displayed GeoServer dataset
as separate work if needed.

**Alternative:** Retain only mappings verified to return the same dataset. This
costs more to maintain; an existing ID mapping is not enough evidence.

### Port 3. Give map metadata one owner

**Priority:** Medium
**Decision:** Deferred — user: “lets keep it like that for now.” Keep `main`'s
palettes in `src/config.js` and its default palette and direction in
`src/lib/utils/geo.js`. Add no per-indicator styling fields or database migration
for this port. Applied to the port plan; metadata needed to identify the raster
and its units remains in scope.

Plan lines 101–121 add database columns and general indicator-detail fields for
map colour and direction. Lines 186–188 also add a map manifest holding units,
attribution, and coverage selection. This makes one map depend on several places
for facts used to draw it. The existing `getColorScale` already has defaults.

**Recommendation:** Keep map colour and direction with the dataset metadata and
return them with the map response. Use a shared entry per indicator within that
definition rather than repeat styling for every file. Drop the database migration
from the initial port if it then has no purpose. Keep ixmp4 as the unit source for
ixmp4 charts and check map values against the map's declared unit.

**Different views:** One reviewer considers the migration and upgrade checks
reasonable. The other questions the need for the migration itself. Both are
consistent: if metadata must serve non-map views or needs database editing, keep
the database owner and its upgrade tests. No such use is stated in this plan.

### Port 4. Decide which source supplies scenario choices

**Priority:** High
**Decision:** Accepted — user: “yes lets keep the current and rely on convention.”
Keep ixmp4's current scenario choices and use the existing coverage naming
convention to find maps and years. Applied to the port plan.

Plan lines 35 and 151–157 promise separate map availability but query it only
after scenarios are selected. `SCENARIOS` in `src/stores/meta.js` comes from
ixmp4 percentile availability; `MAP_CHART_VIEW` also uses the shared combination
check in `src/stores/state.js`. A GeoServer-only scenario cannot be selected by
merely changing the last map check.

**Recommendation:** For this port, keep the current ixmp4 scenario choices.
GeoServer availability says which of those choices have maps and which years
they share. State this limit clearly and keep map loading/error state separate
from chart loading/error state.

**Alternative:** Support GeoServer-only scenarios by discovering its scenario
list before selection and combining it with ixmp4's list. That is a wider change
to selection rules, not a small map adapter change. Neither review establishes
that these extra choices are needed for the initial dataset.

### Port 5. Use one coverage lookup and defer caching

**Priority:** Medium
**Decision:** Accepted with comments — user: “yes i like it lets keep it simple.”
Read published years from WCS capabilities when the selection changes, using the
existing naming convention. Year-only changes fetch the chosen raster directly.
Add no new cache. Applied to the port plan.

**Correction after discussion:** The branch already defines coverage IDs from
canonical selection values in `resolveImpactGeoCoverage`, and its publisher uses
the matching filenames. The port plan reuses that convention. The explicit-ID
manifest recommendation is withdrawn; a new mapping system is not needed.

Plan lines 50–54, 132–137, and 186–188 leave lookup split between explicit
manifest IDs, generated names, published capabilities, and a new cache. They do
not clearly say which source is trusted or which route does discovery.

**Recommendation after correction:** Let availability discover published years
using the existing naming convention; let the grid route resolve the full
selection and fetch that coverage directly.
It should not scan capabilities again to fetch a selected grid. Start without a
cache; measure the availability request before adding one. Publication must check
that configured coverages are actually published.

**Different views:** One reviewer reads the plan as duplicate discovery; the text
could instead mean discovery only through availability. Clarifying that ownership
is required either way. Keep full-selection validation and instance ownership.

### Port 6. Test and deliver complete flows without repeating every case

**Priority:** Low
**Decision:** Accepted — user: “yes.” Finish the methodology emissions flow,
then a working map flow from a published fixture through the API to the browser.
Test each behaviour at the smallest useful layer, reuse existing tests, and
include a real WCS check. Applied to the port plan.

The plan's test lists at lines 97–99, 119–121, 141–143, 176–179, and 213–225 do
not assign cases to layers. They could become repeated suites. Its fixed five
steps also put real publication after most map code, delaying a useful check of
the coverage contract.

**Recommendation:** Deliver emissions as one flow, then one working map slice:
fixture and publication definition, API, frontend, and real WCS smoke test.
Assign each case to its smallest useful layer:

- Pure logic: units, exact years, nodata, and grid subtraction.
- API integration: selection and instance mapping, upstream requests, absence
  versus failure, and metadata returned with the grid.
- Frontend integration: selection changes during loading, retry, scenario/year
  changes, and API-shaped emissions reaching the line and table.
- One map embed/export flow and one real WCS configuration smoke test.
- Database upgrade tests only if a database change remains.

Reuse existing regression tests. Do not build every combination of selection
inputs or test GeoServer/TIFF-library internals. Keep the user's TDD rules.

**Different views:** One reviewer found the boundary and migration checks well
justified; the other warned about the combined volume. Both support the checks
above. The reduction should remove repetition, not checks that protect values.

## Suggestions checked but not carried forward

- **A separate map HTTP client:** One reviewer suggested avoiding changes to
  `fetchMultiple`. That would repeat its retry and stale-response handling.
  Reusing the current helper with a request base is a small change; keep it unless
  implementation shows a real mismatch.
- **Remove emissions table fields:** One reviewer called the derived 2050/2100
  fields duplicate storage. They are calculated response fields, not a second
  stored dataset, and the existing table consumes `characteristics`. Keep that
  small adapter contract; derive the fields from the same points in one function.
- **Reduce data correctness checks:** Do not remove instance, units, grid
  alignment, or nodata checks. `calculateDifference` currently checks null only
  in the first grid; a null in the second can be treated as zero. Cover both
  inputs as part of the port's subtraction behaviour.

No application tests were run for this document review. All agreed outcomes are
recorded in the port plan; application implementation has not started.

---

# EU scoreboard: plan review

**Review date:** 22 September 2026

**Subject:** The revised scoreboard plan in this conversation

**Method:** GPT-5.6 Sol and GPT-6 Astra reviewed the plan against the code;
their findings were challenged, checked and combined using
[paranoid bunch](../../../aku-aku/quality-loops.md). Earlier decisions above are
unchanged. Scoreboard 1 is accepted; Scoreboard 2 is rejected;
Scoreboard 3 is accepted with comments.

## Finding

The main flow is clear. The largest avoidable cost is an HTTP request for choices
already held in the page's imported config. Choices will now be read locally,
and each variable is assumed to use one model. Testing's two grouped charts will
use fixed regions from their config.

Keep the agreed indicator names, Strapi labels, four years, Austria default,
40-country coverage and shared chart selections. This review does not reopen
those choices.

## Data flow in three paragraphs

The sector config supplies indicators, scenario IDs, years and chart definitions.
The SvelteKit layout resolves URL choices and adds optional scenario labels from
Strapi, falling back to IDs. Choices are read locally through the shared config
function, with no options request.

The ranking view draws the NUTS0 countries with the existing mock scores.
Polygon, ranking and tab links open the indicators view for a country, using
Austria by default. Its NUTS0 shape sets the bounds independently of data loading.
Countries without regional data remain selectable.

For the selected indicator, the API and browser read the same pinned NUTS level
file and select the country through CNTR_CODE. The API queries ixmp4 for those
region IDs, the chosen scenario and year, and the agreed annual absolute median
series. The browser joins returned regions to NUTS_ID and draws the values with
their unit. Chart requests remain separate and use the shared country, scenario
and year, except that Testing's two grouped charts use configured regions instead
of the country. Compared maps pool values for one colour scale.

## Issues and decisions

### Scoreboard 1. Remove the static choices HTTP request and its failure states

**Priority:** Medium

**Decision:** Accepted — user: “accept.” Read choices locally through the shared
config function. Remove the options endpoint and its loading, error and retry
code. Keep the optional Strapi label request and the map and chart data requests.

The page already imports the API's config controller directly
([controller](../src/routes/(default)/projects/eu-scoreboard/controller.js#L1)).
It then requests choices over HTTP
([server controller](../src/routes/(default)/projects/eu-scoreboard/controller.server.js#L8)).
A failed request prevents map and chart loading
([indicator loader](../src/routes/(default)/projects/eu-scoreboard/indicators/+page.js#L9)).
That dependency buys nothing once choices come from bundled config.

**Recommendation:** Build choices and resolve selections through one shared
function called locally. Remove `/api/scoreboard/options`, its client helper,
ixmp4 availability discovery, year-error states and “Retry choices” control.
Keep the optional Strapi label request separate from whether choices are usable.
No other live caller was found in this repository.

**Different views:** Astra would keep a thin endpoint for possible standalone
API users. A separately packaged API does not itself prove that such a caller
exists. Keeping the endpoint would be justified by a named current use, not by
backwards compatibility alone.

### Scoreboard 2. Separate unit checks from the model policy

**Priority:** High

**Decision:** Rejected — user correction: “for the previous one i meant to
reject.” Assume each variable uses one model and read its name from the ixmp4
response. Add no model config field, selector or mixed-model check. The review
recommendation below is not accepted.

The reviewed draft proposed rejecting mixed models and units within each response. But comparison
results are pooled before drawing one scale
([combined values](../src/routes/(default)/projects/eu-scoreboard/components/comparison.js#L25),
[map legend](../src/routes/(default)/projects/eu-scoreboard/components/MapPanel.svelte#L103)).
Each response could pass its own checks while the two responses use different
units. The legend also currently reads its unit from config, which the new map
config will no longer contain.

**Recommendation (rejected):** Take legend units from the response and require the same
quantity and unit before sharing a scale. Keep duplicate-region errors and one
model per individual map for this change. Allow different models across the two
maps when the quantity and unit match, showing each model's name. Add no unit
conversion or model picker.

**Different views:** Sol would also allow several models within one map when
they supply different regions, returning their names. Astra favors keeping each
map tied to one model. Both agree that different model names alone do not make a
shared numeric scale invalid. The choice is whether one country map may combine
models; it is not a reason to restore model fields to config.

### Scoreboard 3. Keep Testing's grouped charts on fixed regions

**Priority:** Medium

**Decision:** Accepted with comments — user: “keep those charts regions fixed
instead of depending on the selection.” Keep the stacked bar and bubble charts
visible when data exists by defining their regions in chart config. Use an
explicit `data.regions` list with the existing nine R9 regions for both charts.
Keep `groupBy: "region"`; the configured list supplies the groups without looking
up children of the selected country. Scenario and year still follow the filters.
Other charts keep their existing selection rules.

Show the fixed scope in each chart's description so it is clear that these
charts cover R9 regions. Test that changing country leaves their queried regions
unchanged, while scenario and year changes still reach the query.

Testing's stacked bar and bubble use region grouping
([definitions](../api/scoreboard/testing.json#L41)). The chart reader asks for
children of the selected area, but that helper supports continents and World,
not individual countries
([chart reader](../api/scoreboard/charts.ts#L18),
[region helper](../api/scoreboard/regions.ts#L21)). Both charts will therefore be
empty for every country the new filters offer. Keeping their JSON does not keep
them visible.

**Original recommendation (superseded):** Accept the empty charts under country
selection and choose replacement data in separate work. The chosen fixed regions
keep these examples useful without World/R9 filter choices or another selector.

## Suggestions checked but not carried forward

- **Split the boundary loader into browser and API adapters:** Sol suggested
  this because the current NUTS0 file uses a relative browser URL. The new
  regional loader can use the same absolute, pinned IIASA URLs in both runtimes.
  Keep NUTS0 loading separate and share only the regional loader and country
  rules. A cache of the two successful level files is small; failed loads must
  remain retryable. Add no cache service, expiry rules or general fetch framework.
  Shared code does not mean shared memory between the browser and API.
- **Change the country URL key to CNTR_CODE:** Charts still query country names.
  Changing that key moves the translation elsewhere and widens this change.
  Keep `region=Austria` and one country lookup for the external shape codes.
  This serves current chart requests; it is not an old-URL compatibility layer.
- **Assume ixmp4 rows cannot contain `variable`:** The test fixture omits it,
  but [WideRow](../api/tabulate.ts#L11) accepts arbitrary columns and `dfToRows`
  preserves them. The installed SDK's wide conversion also retains non-time
  columns. That fixture does not establish a missing field in real responses.
- **Add an indicator URL field:** Already part of the plan. Apply it to requests
  and stale-result keys without adding another selection system. Map-only fields
  must not become required chart-embed inputs.

## Implementation limits

Use the scoreboard's agreed absolute-value period explicitly; the general
[facet default](../api/conventions.ts#L72) is present-day change data. Do not
change that global default to make the scoreboard work.

Remove the replaced map config and R9 map path rather than retaining both map
systems. Keep R9 chart grouping while existing chart definitions and embeds use
it. Reserving the raster type does not require a raster loader or fallback now.

Reuse the existing behavior tests. Add cases at the boundary that owns the
behavior, with one browser check of navigation and fitting. Do not repeat the
same cases across helpers, routes, components and browser tests or test Mapbox,
GeoJSON, or ixmp4 internals.

No application files were changed and no application tests were run for this
review. Record each reply above as accepted (with any comments), deferred or
rejected, one issue at a time.

---

# Socioeconomic charts: implementation review

**Review date:** 23 September 2026
**Scope:** The uncommitted socioeconomic chart changes and the shared chart path.
**Method:** GPT-6 Astra and GPT-6 Sol reviewed independently, then challenged the
case for removing features. Findings were checked and combined using
[paranoid bunch](../../../aku-aku/quality-loops.md). Earlier decisions above remain unchanged.

## Finding

The config is still declarative, but several settings appear independent while
silently overriding one another. That is the main threat to future authors.
The answer is a small, clear set of supported chart forms, not a general chart
language or support for every possible combination.

Scatter plots and named bar groups have uses beyond this
PDF. Source units and explicit variable references also earn their place.
Scenario panels have been removed following decision 1: the PDF panels were
examples, and each chart must follow the scenario filter.

## Data flow in three paragraphs

The sector JSON supplies map choices and chart definitions. The page resolves
country, scenario and year from the URL and asks the API for each chart. The
map has its own request. Each chart lists full variable names.
Models and units come from ixmp4, with an explicit unit fallback when absent.

The chart loader chooses either fixed regions, known child regions, or NUTS
regions within the selected country. It reads each distinct variable reference,
then selects regional values for the chosen scenario and year. It does not
combine those values into a country total.

The browser adapter builds bars, stacks, lines or points. It also groups bar
categories and omits missing segments while keeping available values unchanged. The renderer
chooses a chart component. Downloads open the
chart's embed URL and load its data again; they do not capture the current figure.

## Issues and decisions

### Socioeconomic 1. Decide whether direct scenario comparison is required

**Priority:** High
**Decision:** Accepted with comments — user: “we dont need facets/panels ...
the bar charts will update on scenario filter change.” Applied: removed panel
config, loading, rendering and panel-only tests. Each of the two bar chart
definitions now produces one chart for the selected scenario. The scatter plot
also follows that selection.

At review time, `data.scenarios` made the two bar charts ignore the selected
scenario. Those definitions made 77 chart source calls per load: 50 for age/sex, 25 for
age shares and 2 for education. Selected-scenario charts would make 17.
This is a call count, not a measured latency claim.

That version also had a download fault: each panel has a download control, but its embed
request reloads the original chart definition and therefore all panels. Each
panel also chooses its own axis range, which weakens comparison by bar length.
See [panel loading](../api/scoreboard/charts.ts#L17),
[panel rendering](../src/routes/(default)/projects/eu-scoreboard/components/charts/ChartRenderer.svelte#L33)
and [axis range](../src/routes/(default)/projects/eu-scoreboard/components/charts/StackedBarChart.svelte#L21).

**Choice:** Use the existing scenario selector for all three charts, removing
panel config and the panel response/rendering branches; or keep panels because
simultaneous comparison is a required task. If kept, use one download for the
whole set and a shared scale where units match. Do not add per-panel export
options unless needed.

**Different views:** Removing panels saves real code and requests. Both reviewers
challenged treating this as an automatic improvement: a selector cannot replace
seeing scenarios together. Decide the task first. If panels stay, measure source
cost before adding batching or caching.

### Socioeconomic 2. Simplify regional chart requests

**Priority:** High
**Decision:** Accepted with comments — simplify instead of keeping the sum
option and adding checks around it. User: “the country will be taken from the
selected region” and “we dont need to sum them.” The selected country defines
which NUTS regions to request for the regional charts; values stay regional.
Removed the country-total sum branch and its config type. User clarified that
the age-and-sex chart is broken down by age, not NUTS region. That chart now
reads the selected region directly and draws age bars split by sex. It has no
NUTS grouping or sum step.

At review time, combining region grouping and the sum option repeated the
country total under each region label. Removing the sum option removes that
conflict and the line/sum conflict. Decision 1 removed scenario panels.
The category/grouping rules still need to be clear; they do not justify adding
a general config validation framework.

### Socioeconomic 3. Define bars and stacks explicitly

**Priority:** Medium
**Decision:** Accepted with comments — user approved `variables`, `bars` and
`stacks` arrays. Variables are full ixmp4 names, not a base used to build names.
Bar and stack names match whole subsegments at any position, regardless of
variable length, and also serve as labels. Array order sets display order.
The source query keeps each full variable name unchanged.

Applied to the age-and-sex chart. Removed the per-variable category mapping.
Ordinary stacked charts keep a separate identity for each series even when
display labels match. Named-bar charts share colours by the explicit stacks
array. No name patterns, templates or variable-name construction were added.

**Extension accepted:** Use this form across chart types. Plain lines need only
`variables` and `model`; ranges use `line`, `rangeLow` and `rangeHigh`; scatter
uses `x` and `y`; bubbles add `size`. Regional stacks use `stacks` with region
grouping kept separate. Roles match whole subsegments. Removed nested authored
series references and repeated model/unit fields. The API returns resolved
references separately from the config. Tests cover parsing, loading and display,
not the contents of sector files.

**Model decision accepted:** Remove model selection from chart config. Read model
names from ixmp4 for the data details. Keep rejecting multiple matching rows for
one scenario and region instead of choosing a model.

### Socioeconomic 4. Keep available age segments when another is missing

**Priority:** Medium
**Decision:** Accepted with comments — show available segments and omit only
missing segments. Keep each named bar's place and label, even when all its
segments are missing. Do not turn missing values into zero. Stack colours stay
fixed when an earlier segment is absent.

**Further decision accepted:** Percentages must come from the source. Removed
percentage calculation and `stackMode`; source values stay unchanged when
segments are missing. This applies to named, regional and scenario bars.
Live checks of the five configured age variables in AT11–AT13, SSP1, 2050
returned `million`, not percentages. The regional chart therefore shows counts
unless its source variables are changed.

**Final decision accepted:** Keep `stackMode: "percent"` after verifying that
the age variables contain counts. Enable it for the regional age chart. The
available segments make up 100% of each bar; missing segments are omitted and
zero-total bars remain blank. Without this option, source values stay unchanged.

### Socioeconomic 5. Remove climate-specific wording from shared bar tooltips

**Priority:** Medium
**Decision:** Awaiting user.

The shared tooltip says “under the … pathway”, while the bar component supplies
the segment name. These charts therefore call Female and Age 65+ pathways.
This wording predates this work, but it shows real coupling in the shared chart
path. The formatted value also includes the unit while the template adds it again.
See [tooltip input](../src/routes/(default)/projects/eu-scoreboard/components/charts/StackedBarChart.svelte#L38)
and [template](../src/routes/(default)/projects/eu-scoreboard/components/charts/popover-bar.html#L7).

**Recommendation:** Show the bar label, segment label and value with its unit once.
Keep scenario context in the page or panel heading. A generic bar should not
need sector-specific prose or another config option for this.

### Socioeconomic 6. Make the scatter smoke test's claim match its checks

**Priority:** Low
**Decision:** Awaiting user.

The test named “renders scatter points without a bubble-size legend” checks a
figure, axis labels and lack of an error. It checks neither points nor the legend.
See [test](../src/routes/(default)/projects/eu-scoreboard/components/charts/ChartRenderer.ssr.test.js#L34).

**Recommendation:** Rename it as a scatter rendering smoke test. Keep the useful
loader and adapter tests. Cover accepted fixes at the boundary that owns them,
without copying each case into every test layer or fixing config values in tests.
The earlier 176 passing tests did not establish live source coverage or visual
correctness.

## Keep without expanding

- Read source units, with the agreed fallback; reject mixed scales rather than
  silently add values with different units. Add no conversion engine.
- Keep the shared point renderer for scatter and bubbles, and percentage stacks
  as a small display calculation.
- Reuse NUTS membership for regional charts. Do not add a second region catalogue
  just to make this EU feature appear more general.
- Keep missing regional values missing and keep explicit variable references.
  Repeated source names are easier to see than template or inheritance rules.
- Leave earlier map-model decisions alone. No compatibility layer is needed.

## Review checks

Read the changed code, its callers, download path and tests. Ran direct probes
through the chart loader and adapter for repeated regional sums, hidden complete
categories and label collisions. The initial review changed only this report. Decision 1 was then applied to
code, config and tests; the remaining decisions await the user.

Record each user decision above as accepted (with any comments), deferred or
rejected. Ask one issue at a time.
