# EU scoreboard: sector controller plan

## Goal

Make the sector/hazard selection choose a JSON chart definition list. The EU
scoreboard uses only `sparccle-internal`. Reuse shared catalog code where useful;
keep the scoreboard's state and source choice separate from the general explorer.

The EU scoreboard controller owns sector selection and data loading. Page loaders
call it; components receive its results. Shared request and ixmp4 code serve that
controller without global catalog state or discovery across other instances.

This step sets up selection and rendering. The real chart config format and real
chart data requests will be defined in the next step.

## Expected behaviour

- **Heat stress** (`heat-stress`) loads `sectors/heat-stress.json`, containing `[]`.
  Show an empty state, with no mock charts, map or ranking.
- **Testing** (`testing`) loads `sectors/testing.json`. It shows the seven existing
  mock charts and the current mock map and ranking controls.
- Both views offer the sector menu. Keep the choice in `?sector=` and carry it
  between tabs and country links. Reloading a link restores the choice.
- Use Heat stress as the default, including for an unknown sector ID. This is a
  proposed default for this implementation, not a requirement of the later schema.
- The sector's definitions choose the charts; remove the unrelated indicator picker.
- Any scoreboard scenario request asks only `sparccle-internal`. Scenario selection
  stays local to the scoreboard, so explorer state cannot select another source.
- An empty definition list needs no catalog or CMS requests.

## Shared contracts

The controller lives beside the scoreboard routes. Its browser-safe sector module
(`controller.js`) exports:

```js
SCOREBOARD_INSTANCE = 'sparccle-internal'
SECTORS = [
  { uid: 'heat-stress', label: 'Heat stress' },
  { uid: 'testing', label: 'Testing' },
]
getScoreboard(sectorId) // returns { instance, sector, definitions }
```

The layout resolves the sector through `getScoreboard` and supplies its result as
`data.scoreboard`. Child page loaders read that result through `parent()`.

Server-only loading lives in `controller.server.js`, with separate functions for
the ranking and indicators views. Those functions receive the selected scoreboard
and the request's `fetch`, load the needed scenarios, geographies and CMS content,
and return page data. They always use `SCOREBOARD_INSTANCE` for ixmp4 requests;
the URL and callers cannot choose another source. Page loaders add page titles
and call these functions, rather than making catalog or CMS requests themselves.

Keep shared login and query code in place. Reuse the narrow helpers that fit;
do not add a general controller framework or copy the catalog's loading flow.
Keep component imports out of controller output so it can pass through the server
loader. Real chart queries remain deferred until the config format is agreed.

Testing uses a temporary reference to the existing chart registry:

```json
[
  { "mockChart": "annual-mean-temperature" }
]
```

Its full file lists all seven existing chart IDs in display order. The renderer
resolves those IDs to the current components and mock values. This is only a stub;
it does not define how real ixmp4 queries or chart options will be expressed.

## Workstreams

| Stream | Owner | Files and responsibility | Checks |
| --- | --- | --- | --- |
| 1. Scoped catalog requests | Sol agent: `catalog_scope` | Add optional `instance` filtering to the methodology-scenarios route and loader helper. Query only the chosen source; keep existing all-source use cases working elsewhere. | Selected source succeeds even if another source fails; unknown source fails before a request; helper sends the source; existing unscoped behaviour works. |
| 2. Controller and sector files | Sol agent: `scoreboard_controller` | Own `controller.js`, `controller.server.js`, both sector JSON files, scoreboard server loaders and their tests. Put scoreboard data requests in the server controller. Remove the unused indicator catalog request. Return stable empty values when no charts are defined. | Sector resolves to usable definitions; empty sector makes no data requests; controller requests only needed data from the fixed source; route loaders use its results. |
| 3. Page and chart wiring | Sol agent: `scoreboard_ui` | Wire the sector menu on both pages. Render the chosen definitions, handle empty state, use local scenario selection, preserve sector links, and keep mock embeds working. | Switching sectors changes visible results; Heat stress shows no mock output; Testing renders its charts; tab, country and reload links retain selection; exports resolve the same mock chart. |
| 4. Review and checks | Main agent; fixes assigned to Sol | Review the combined diff, run relevant tests and the build, check both page flows in a browser if available. | No cross-source scoreboard requests, stale labels, empty-list crashes or unintended changes to other catalog users. |

Each agent owns its listed files. Shared contract changes go through the main
agent before another stream relies on them. Agents must keep each other's edits.
Sol agents make all code changes; the main agent owns this plan and the review.

Required test fixes belong to these streams:

- **Stream 2:** Remove checks that repeat constants and the JSON chart list from
  `controller.test.js`. Keep checks of sector selection and empty definitions.
  In `catalog-consumers.test.js`, make the fake response match the requested
  instance and check that the returned scenarios belong to `sparccle-internal`.
  Exercise the real controller through the page loader; fake the outgoing service
  requests rather than mocking the controller or testing private helpers.
- **Stream 3:** Test that the selected definitions resolve and render through the
  page. In `indicators/page.ssr.test.js`, check the empty state and absence of mock
  results without fixing the exact wording or unrelated methodology text.
- **Stream 4:** Confirm these fixes and the user-flow checks pass before handoff.

Existing all-source requests serve other current pages. Keep those use cases
working, but add no old scoreboard aliases, fallback sources or compatibility layer.

## Order of work

1. Set the contracts above before further code changes.
2. Apply each stream's test fixes before continuing its code changes. Complete
   streams 1 and 2; stream 3 can work against the shared contracts in parallel.
3. Join the page wiring to controller results and verify the scoped requests.
4. Review the full user flow and run checks. Fix failures before handoff.
5. Leave changes uncommitted for review.

## Test approach

Write tests before or alongside code. For new functions, first use a stub that
runs and fails a behaviour assertion; a missing import is not a valid RED step.

Use unit tests for sector resolution, service-boundary tests for source selection,
and page tests for sector switching and empty states. Mock only boundaries needed
to keep tests independent of live ixmp4 and database services. Most confidence
should come from page and request-flow tests. Test our requests and handling of
responses, not Hono, the SDK or the database itself. Use the project's test-data
tools if database state is needed; do not insert test rows directly.

Automate these user checks first:

1. Open Testing and see the mock charts chosen by its definition file.
2. Switch to Heat stress and see an empty state with no mock results left behind.
3. Switch tabs, follow a country link and reload; keep the selected sector.
4. Load Testing with another instance unavailable; request only SPARCCLE scenarios.

Keep the existing map, comparison and chart-data tests in the check set. Do not
duplicate the JSON list or labels in tests. Check that definitions resolve and
render instead. Empty-state tests should check visible state and absent results
without requiring an exact sentence. Do not chase a coverage percentage.

## Code and handoff rules

- Use plain names and explicit control flow. No nested ternaries.
- Use separate functions or named modes instead of boolean behaviour switches.
- Keep comments for constraints or traps. Remove stale comments in code being read;
  do not narrate edits in source files.
- Keep the controller small. Defer extra schema types and query machinery until
  the real config format is agreed.
- No Superpowers skills. No commits, merges, pushes or PRs without a direct request.
- Report what changed, checks run and remaining limits in plain, short text.

## Deferred work

- The final chart config schema and its validation rules.
- Real ixmp4 variable, model/run, region, scenario, year and percentile mappings.
- Real chart and map values, score calculations and data availability controls.
- A working scoreboard CSV endpoint and selection-aware real-data exports.

The Testing sector retains the current mock limitations: chart values do not
follow every filter, and map comparison changes are simulated. Its output must be
clearly marked as mock data.

Do not add special loading paths, local catalog copies or fallbacks for Testing.
The mock charts are a stepping stone; existing CMS and catalog dependencies may
remain. Decide which shared catalog code to reuse based on the scoreboard's
single-source needs, not on making mocks work without services.

## Implementation status

All four streams are complete. Changes are uncommitted.

- The controller owns source-scoped loading; the two sectors select JSON files.
- Both pages use local scenario state and retain the sector in links. Testing
  renders its mock definitions; Heat stress shows an empty view. Chart embeds
  resolve the same sector definitions.
- Review fixes are applied. A final Sol review found no further issues.
- Checks passed: 32 Vitest tests across seven files, 29 existing Bun tests for
  chart/map/comparison logic, the production build, and `git diff --check`.
- The built default indicators page returned HTTP 200 and opened in the browser.
  Live ixmp4 data and screenshot-service downloads were not checked.

The Bun checks used an empty temporary config to skip the unrelated database
setup. The full database-backed API suite was not run.
