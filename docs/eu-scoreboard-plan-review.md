# EU scoreboard plan review

Reviewed 14 September 2026 using the “paranoid bunch” loop in
`../../aku-aku/quality-loops.md`.

Subject: [sector controller plan](eu-scoreboard-sector-plan.md).
Two passes: GPT-5.6 Sol, then GPT-5.6 Terra challenging the first pass and the plan.
The main agent checked the findings against the partial code and merged them below.
This file keeps the review separate from the existing catalog architecture review.

## Data flow

The URL selects a sector. A small controller maps that sector to its JSON array
and the fixed `sparccle-internal` source. Heat stress has no definitions and shows
an empty state. Testing supplies references to the seven existing mock charts.

Page loaders call the scoreboard controller to load scenarios, geography data and
CMS case studies through shared helpers. The page resolves chart references to existing components and
local mock values. These service requests supply controls and links, not the chart
numbers. Scenario state is local to the scoreboard; sector state travels in links.

Real chart requests and their config format come later. The shared catalog route
can select one instance while other current pages still request all instances.
The JSON stub and fixed source are small enough for this stage; no larger config
framework is needed.

## Issues and decisions

### 1. Should mock Testing depend on live services?

**Importance:** Scope decision before continuing.
**Decision:** Rejected — do not add special support for mocks. Existing CMS and
catalog dependencies may remain. The choice between the catalog flow and a
scoreboard controller must be made on its own merits.

The plan defers real chart data but includes live catalog work now
([expected behaviour](eu-scoreboard-sector-plan.md#expected-behaviour),
[workstreams](eu-scoreboard-sector-plan.md#workstreams)). Both reviewers found that
Testing can fail to open because a service is down even though its chart numbers
are already in local files. The partial indicators loader awaits scenarios,
geographies and case studies before returning page data.

**Recommendation:** Use local scenario and country options for Testing, drawn from
the existing mock data, and omit or stub its case-study links. Keep the fixed
SPARCCLE source in the controller; defer live catalog wiring until a real chart
needs it. This removes a live-data workstream from the current mock-only step.
It does not make maps or image exports work offline; their existing services remain.

**Other view:** Keeping the current live controls is a reasonable scope choice.
The source filter itself is small and serves the stated SPARCCLE constraint.
If retained, name those services as Testing dependencies and check the visible
failure state. Do not add a chain of fallback sources or both live and mock modes
to hide those failures.

### 2. Should the scoreboard controller own the data flow?

**Importance:** Architecture decision.
**Decision:** Accepted — the scoreboard controller owns data loading, fixed to
`sparccle-internal`. It reuses shared request and ixmp4 code without global catalog
state or scans of other instances. Page loaders call the controller.

The user's follow-up separates this question from mock data: does the scoreboard
need the general catalog flow, or its own controller? The reviewed draft gave the
controller only sector lookup and left data requests in the page loaders.

**Recommendation:** Let the EU scoreboard controller own sector selection and
scoreboard data loading, with `sparccle-internal` fixed inside that boundary.
Reuse shared request helpers and ixmp4 query code where they fit. Do not route the
scoreboard through global catalog state or all-instance discovery, and do not
duplicate shared login or query code. Route loaders call the controller; components
receive its results. Define real chart queries after the config format is agreed.

The accepted plan extends the controller beyond pure sector lookup. Its sector
list and lookup remain separate from server-only loading code. That split is for
the server boundary, not a new general controller framework.

**Other view:** Keep the controller as a pure config lookup and leave a few scoped
requests in the page loaders. This uses fewer files now, but leaves ownership of
future scoreboard requests spread across the routes.

**Review disagreement:** Sol claimed that the layout and indicators loader also
duplicate scenario requests. Source inspection and the Terra pass rejected that:
the layout makes no scenario request, and the sibling page loaders do not both
run for one page. Repeated sector lookup is minor and does not by itself justify
moving all data loading into the layout.

## Findings not promoted to new issues

- Local scenario state is already required. Use a simple local selector; do not
  extend the global explorer selector with another mode.
- Sector links and reloads already have a workstream and a user-flow check.
- The plan already assigns the fake-response/source mismatch and the tests that
  repeat constants or exact wording to their owners.
- Keeping all-source requests for other current pages is not a new compatibility
  layer. No old scoreboard aliases or fallback sources are needed.
- The `mockChart` stub, empty Heat stress view and existing embed support fit the
  requested step. A larger schema or renderer framework would be premature.

## Decision process

Both issues are decided and the plan reflects the answers. No review decisions
remain open. Implementation is complete; checks and limits are recorded in the
[plan status](eu-scoreboard-sector-plan.md#implementation-status).
