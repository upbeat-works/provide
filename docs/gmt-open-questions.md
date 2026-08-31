# GMT sourcing — open questions

Context: GMT (Global Mean Temperature, the per-scenario global-warming trajectory) is
currently curated in `scenarios.json` and used by the frontend for the impact-time line
coloring, the scenario comparison chart, scenario characteristics, and warming-category
grouping. The proposal is to source it from ixmp4 as the **Mean Temperature** indicator at a
global region with the pre-industrial reference — no new convention, no curation:

```
Mean Temperature | 1850-1900 (Pre-industrial) | Annual | Area | {5th/50th/95th Percentile}   @ region = World
```

## Interim decision (to not be blocked)

No global region exists yet, so **GMT temporarily reuses the same region selected for the
indicator** (`Mean Temperature | 1850-1900 (Pre-industrial) | Annual | Area | p05/p50/p95` at
the chart's region). The value is regional warming, not global — **knowingly wrong**, but it
unblocks the impact-time line coloring until a `World` region is uploaded. Swap the region to
`World` once it exists; nothing else changes.

## The global region

- What should the global region be **named** so it matches a catalogue geography id? Add a `World` (or `Global`) geography the same way we added the missing countries?
- Is it a true **area-weighted global mean**, or a specific global diagnostic (e.g. GSAT)? Does the `Area` spatial segment mean the same thing at global scope?
- Who uploads the World-region Mean Temperature series, and when? (The teammate is already generating Mean Temperature per scenario — is the global aggregate just one more region in the same job?)
- Will the World region have data for **the same scenarios** as the country data (coverage parity), including `Today` and the `SSP5-3.4-OS`/`SSP5-3.4-Os` duplicate?

## Semantics / correctness

- Does "Mean Temperature | Pre-industrial | World | p50" numerically reproduce the legacy curated GMT? (Sanity check against e.g. curpol ≈ 1.3 °C in 2020, ≈ 2.7 °C in 2100.)
- GMT for coloring is always **warming since pre-industrial**, regardless of the reference period the user picked for the indicator itself — correct?
- Do the `5th / 50th / 95th` percentiles map to the curated `[min, median, max]` band as-is?
- Should the impact-time line always color by **global** warming (GMT), or is there any case where regional warming is intended? (Land warming ≠ global mean.)
- For indicators other than Mean Temperature, the coloring GMT still comes from the **World-region Mean Temperature**, not from the indicator being charted — confirm?

## Scenario characteristics (derived from GMT)

- `gmtPeak`, `gmt2100`, `warmingCategory` — derive these from the World-region series (peak = max of p50, 2100 = p50 at 2100, category from cutoffs), or keep curated for now?
- What are the `warmingCategory` cutoffs (high / medium / low)?
- The `likelihood15 / likelihood2 / likelihood3` characteristics — are these exceedance probabilities (i.e. unavoidable-risk at global level), separately sourced, or curated?

### Live consequence: scenario selector sections are gone

The scenario selector used to group scenarios into **warming-category sections**
(`Paris Agreement consistent up to 2050`, `Temperature rise above 1.5°C`,
`Temperature well above 1.5°C`), driven by the curated `scenario.warmingCategory`. Convention
scenarios don't carry it, so **all scenarios now render in a single ungrouped section**.

`warmingCategory` is derived from a scenario's **peak global warming** — i.e. it depends on the
GMT series above. Once GMT (or just peak warming per scenario) is queryable from ixmp4 and we
fix the cutoffs, the grouping returns automatically (`ScenarioList` already re-groups by the
field the moment it's present). Open question: **derive `warmingCategory` from GMT in the
adapter, and what are the exact cutoffs?**

## Adapter / wiring

- Where should GMT live in the API response? The frontend reads `scenario.gmt` off `/meta` today — keep attaching it there (fetch once per scenario), or bundle it into the `/impact-time` response?
- If it stays on `/meta`: fetch the World-region Mean Temperature for all scenarios once at meta time and attach `gmt` per scenario?
- `source` / `citations` for GMT — the curated scenarios carry a `source`; does the World-region series need its own citation, or reuse the indicator's?

## Scope / sequencing

- Is GMT-from-ixmp4 in scope now, or do we keep `scenarios.json` `gmt` as a transitional bridge until the World region exists?
- Does this unblock dropping `scenarios.json` entirely, or do other scenario fields (label, source, characteristics) still need a home first?
