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
