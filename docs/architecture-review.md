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
