# CMS uid drift vs. the catalog API

**Measured 2026-07-27**, against a fresh `npm run db:cms:pull` (remote Fly `provide-cms` →
local Postgres `strapi`) and a live local `/api/catalog` reading ixmp4 `provide-internal`.
Every number below is reproducible from `scripts/`-free queries quoted inline; nothing is
carried over from a design doc.

## Summary

The CMS is **not out of date**. It is a 100% exact match for the legacy Climate Analytics
API — all 25 scenario uids, and 54 of that API's 84 indicator uids, resolve. What changed is
that explore-side surfaces stopped reading the legacy API and now read the convention-driven
catalog, whose ids are the raw ixmp4 names. The CMS is stale only relative to *that*.

Consequently **every CMS↔catalog join that carries editorial content resolved zero rows**,
while every CMS↔legacy join still resolves. The site returns HTTP 200 everywhere; the damage
is entirely missing content.

| | CMS ids | catalog ids | matched (as found) | after the fixes below |
|---|---|---|---|---|
| Scenarios | 25 | 11 | **0** | **10** (all ixmp4 serves today, bar `Today`) |
| Indicators | 59 | 1 | **0** | **0** — blocked on ixmp4 holding more than one indicator |

## The three id spaces

| Space | Scenario | Indicator | Produced by | Consumed by |
|---|---|---|---|---|
| ixmp4 / convention | `2020 Climate Policies`, `SSP1-1.9`, `Today` | `Mean Temperature` | `api/routes/catalog.ts:97`, `api/conventions.ts` | explore, key-terms, case studies |
| legacy Climate Analytics | `curpol`, `ssp119`, `ssp534-over` | `terclim-mean-temperature`, `urbclim-T2M-mean` | `provide-api.iiasa.ac.at/api/meta/` | avoid page (`src/lib/catalog/avoid-meta.js`) |
| curation slugs | — | `city-average`, `urban-hot-spot`, `likely` | `api/curation/*.ts` | avoid, case studies |

Strapi `UID` fields live wholly in the **legacy** space. The avoid page is the only surface
still speaking it, and it must keep working — which is the central constraint on any fix.

Live catalog contents at time of measurement:

```
scenarios (11): SSP5-3.4-OS · Stabilisation At 1.5°C · 2020 Climate Policies ·
                2020 Climate Targets · Delayed Climate Action · High Negative Emissions ·
                High Renewables · Low Demand · SSP1-1.9 · Shifting Pathway · Today
indicators (1): Mean Temperature
```

Note the indicator side has **two independent causes** of breakage, which must not be
conflated: (a) `provide-internal` currently holds variables for one indicator only, and
(b) even that one would not match — CMS has `terclim-mean-temperature`, catalog has
`Mean Temperature`. Loading the rest of the indicators into ixmp4 fixes (a) and leaves (b)
entirely intact.

## Impact matrix

| # | Join | Site | Keys compared | Matched | Symptom | Severity |
|---|---|---|---|---|---|---|
| 1 | Scenario description | `src/lib/utils/apis.js:132` | `ciEquals(strapi.scenarios.uid, catalog.scenario.uid)` | **10 / 25** *(was 0)* | **fixed** by the re-key below. Only `Today` still lacks a description (no CMS entry); the 15 unmapped variants are inert until ixmp4 serves them | resolved |
| 2 | Indicator description | `src/lib/utils/apis.js:126` | `strapi.indicators.uid === catalog.indicator.uid` | **0 / 59** | indicator detail panel renders a title with an empty body — no placeholder, no warning | **high** |
| 3 | Scenario presets | `methodology/key-terms/.../Presets.svelte:19` | preset's linked `scenarios.uid` vs selected catalog uids (set-equality) | **10 / 18** usable *(was 0)* | **fixed** by the re-key. The 4 still broken are all `en-EU` and depend only on unmapped variants; 4 more have no scenario links at all | resolved |
| 4 | Case study → FutureImpacts | `case-studies/[slug]/+page.server.js:150` | snapshot `Indicator` === `catalog.indicator.uid` | **0 / 8** distinct uids | **6 content blocks across 3 case studies vanish** (2 each for lisbon / islamabad / nassau) — verified 0 rendered | **high** |
| 5 | Case study → scenario chips | `case-studies/[slug]/+page.server.js:130` | `scenario_simplifieds.uid === catalog.scenario.uid` | **0 / 1** | chip falls back to the raw uid (`1.5`) instead of a label | low |
| 6 | Case study → city (explore) | `impacts/explore/+page.server.js` | dead `city` field, keyed on `uid` | n/a | **removed** — it had no consumer on either explore or avoid; both pages read only `cityUid` | resolved |
| 12 | Explore case-study cross-link | `explore/+page.svelte`, `ImpactGeo/LinkSection.svelte` | was `geography.uid === geography.adaptationCaseStudy` | **n/a — field absent** | **fixed** by dropping `adaptationCaseStudy` and joining on `geoId` (see below) | resolved |
| 7 | CMS deep links (`ExplorerUrl`) | 6 links in case-study content | `?indicator=` resolved via `resolveIndicator` | **0 / 6** indicator · **6 / 6** geography | link lands on explore with the right city but the wrong indicator; `scenarios[0]=curpol` is **never parsed by any route** | medium |
| 8 | Case study → avoiding-impacts | `case-studies/[slug]/+page.server.js:56,96` | `Indicators[].Uid === catalog.indicator.uid` | 0 / 3 | **latent, not live** — `loadAvoidingImpactsData` has no caller, so its `error(404)` never fires. Wiring it up as-is would 404 `/case-studies/lisbon` and `/islamabad` | **latent high** |
| 9 | Case study → city (case-studies routes) | `case-studies/[slug]/+page.server.js:47` | `geography.geoId === case_study.city_uid` | **3 / 4** | works; the 4th is `adaptation`, a deliberate pseudo-city with a synthetic fallback | ok |
| 10 | Case study → study locations | `case-studies/[slug]/+page.server.js:96` | `StudyLocations[].Uid` vs curation slugs | **4 / 4** | works — same id space both sides | ok |
| 11 | Avoid-page indicator descriptions | `src/lib/catalog/avoid-meta.js:11` | Strapi `UID` vs legacy `/meta` uid | **54 / 84** | works — legacy space both sides. The 30 gaps are `macroeconomy-*` + 3 globals with no CMS entry, unrelated to this drift | ok |

Verified live (`docker compose up`, `http://localhost:8080`): all of
`/case-studies/{lisbon,islamabad,nassau,adaptation}`, `/impacts/explore`,
`/methodology/key-terms` return **HTTP 200**. Nothing errors. That is the problem.

## Failure modes, ranked by invisibility

0. **A feature that cannot fire** — the explore case-study cross-link (#12). The guard field
   does not exist on catalog geographies, so the branch is never entered. No warning, no
   placeholder, no dropped element — the panel is simply never in the tree. The loader still
   fetches `case-study-dynamics` on every explore page load to build data nothing reads.
1. **Silent `undefined`** — indicator descriptions (#2). `lodash.get(undefined, path)` returns
   `undefined`; `IndicatorSelection.svelte:95` guards with `{#if detailsItem.description}` and
   renders nothing. Zero signal anywhere.
2. **Silently dropped content blocks** — FutureImpacts (#4). `resolveSnapshot` returns `null`,
   `.filter(Boolean)` removes it, and `if (!impactGeoSnapshots.length || …) return null` deletes
   the whole section. The code comment acknowledges this ("Legacy `urbclim-*` slugs aren't in the
   catalog yet, so skip those snapshots instead of 404ing"), so it is a *known* degradation — but
   nothing surfaces how much content is being dropped. Currently: 100% of it.
3. **Dead preset buttons** — (#3). Fails set-equality, so `currentPreset` is always `undefined`
   and the block is gated out of the DOM entirely.
4. **Hardcoded placeholder** — scenario descriptions (#1) reach the user as
   `ScenarioDetails.svelte:29` → `{scenario.description || 'Description missing'}`.
5. **Unattributable log spam** — `apis.js:134` warns once per unmatched scenario with **no uid in
   the message**. Measured: exactly **11 identical lines per page load**, one per catalog
   scenario. Enough to notice, useless for diagnosis.
6. **Latent 404** — (#8), armed but unreachable.

## What is already bridged, and why it currently helps nothing

Two translation bridges exist and are the shape any fix would take:

- **Geographies** bridge on `geoId` (`catalog.geographies.geo_id`, 674 rows). Measured: the
  catalog's 144 city `geoId`s and the legacy API's 144 city `uid`s are the **same set exactly** —
  no difference in either direction. So `geoId` is not merely *a* bridge, it **is** the legacy
  city id space, and every legacy-sourced city value (CMS `CityUid`, `adaptationCaseStudy`)
  joins to it directly. This is why #9 passes and #6/#12, which key on `uid`, do not.
- **Indicators** bridge on `legacy_uid` (`catalog.indicators`, seeded from
  `api/db/import/indicators.yaml`, exposed at `api/routes/catalog.ts:78`, consumed by
  `resolveIndicator` in `src/lib/catalog/translate.js:22`).

The indicator bridge has **two separate defects**:

1. **It is not wired into the Strapi joins.** `apis.js:126` compares `UID === indicator.uid`
   directly, ignoring the `legacyUid` already present on the object.
2. **Its 26 seeded ids match nothing in the live catalog.** All 26 rows are `urban-climate`,
   with ids derived from legacy *labels* — e.g. `Mean daily temperature` → `urbclim-T2M-mean`.
   The one indicator actually in the catalog is `Mean Temperature`, which has no row, so
   `/catalog` returns `sector: null, legacyUid: null` for it. `indicators.yaml`'s own header
   warns these ids are "a best-effort PLACEHOLDER … verify/replace each `id` against a live
   `/catalog`" — measured, the placeholder hit rate is **0/1**.

So fixing defect 1 alone changes nothing; the yaml has to be re-derived against the live catalog
either way. The correct row for today's single indicator would be
`id: Mean Temperature` / `legacyUid: terclim-mean-temperature`.

There is **no scenario bridge at all** — no column, no yaml, no `resolveScenario`. The old→new
scenario mapping exists only as prose in `docs/geoserver-data-requirements.md:57-71`.

## The content decision that no code choice avoids

The 25 CMS scenarios split three ways against the 11 catalog scenarios:

- **10 have a documented counterpart**: `curpol`→`2020 Climate Policies`, `gs`→`Delayed Climate
  Action`, `sp`→`Shifting Pathway`, `modact`→`2020 Climate Targets`, `neg`→`High Negative
  Emissions`, `ren`→`High Renewables`, `ld`→`Low Demand`, `ssp119`→`SSP1-1.9`,
  `ssp534-over`→`SSP5-3.4-OS`, `ref-1p5`→`Stabilisation At 1.5°C`.
- **15 have no ixmp4 counterpart**: the `-os` / `-sap` / `-nzghg` / `-extended` / `-nzco2`
  variants. These back 6 of the 18 presets (all `en-EU`), which cannot be revived by any code
  change — either the scenarios get loaded into ixmp4, or that editorial content is retired.
- **1 catalog scenario has no CMS counterpart**: `Today` (the convention baseline). It needs a
  description written, or explicit suppression from the selector.

## What has been done

**1. Scenarios re-keyed onto the live ixmp4 names.** `cms/scripts/rekey-scenario-uids.js`
(+ pure map and tests in `cms/scripts/lib/scenario-uid-map.js`) renames the 10 CMS scenario UIDs
that ixmp4 serves today, per locale, and leaves the 15 overshoot / net-zero / extended variants on
their legacy uid — re-keying those to names nothing returns would trade one broken join for
another. Idempotent; `DRY_RUN=1` prints the plan.

Measured after applying locally: scenario descriptions **0/25 → 10/25**, usable presets
**0/18 → 10/18**, and the unattributable warning storm **11 per page load → 1** (`Today`, which
has no CMS entry and needs one written).

A fuller ixmp4 naming set exists as a proposal — 25 names covering all 25 CMS scenarios 1:1. It
is deliberately **not** applied: `/catalog` does not serve those names yet, and two of the ten
above are renamed by it (`SSP5-3.4-OS` → `SSP5-3.4-Overshoot`, `Stabilisation At 1.5°C` →
`Stabilisation at 1.5 °C`). Extend the map once the rename lands.

> The CMS of record is the **remote** Strapi. This ran against the local copy, so the next
> `npm run db:cms:pull` reverts it — run the script against the remote to make it stick:
> `fly ssh console -a provide-cms -C "/bin/sh -c 'cd /app && node scripts/rekey-scenario-uids.js'"`

**2. `adaptationCaseStudy` dropped; the case-study link now joins on `geoId`.** The legacy field
mapped all 144 cities onto the 3 case studies by nearest-analogue; it never existed in the catalog,
so explore lost it at the cutover. New pure helper `src/lib/catalog/case-study-link.js` joins a
geography to the case study **about that city**, on the geoId space — which works for catalog
geographies (`geoId`) and legacy avoid cities (`uid`) alike. Consumers updated: explore page, avoid
page, `LinkSection`. Behaviour change: only Lisbon / Islamabad / Nassau link to a case study now;
the other 141 cities no longer get a nearest-analogue suggestion. That association was curated
upstream and is not reproducible from conventions — reinstating it needs a content decision.

## Remaining remediation options

Both require re-deriving `indicators.yaml` against a live `/catalog` regardless — that work is
common to either path and is currently the binding constraint on the indicator side.

**A. Re-key the CMS to convention names.** Change Strapi `UID` values to the ixmp4 names.
Fully convention-driven, adds no curation layer, matches the stated project direction.
*But*: the CMS then has to track ixmp4 renames; the 15 orphan scenarios have nowhere to go; and
**indicator `UID`s must stay legacy** or the avoid page (#11, the only working indicator join)
breaks. That splits the `indicator` content type's id space by consumer — a real cost.

**B. Add a scenario `legacyUid` bridge.** Mirror the indicator pattern: `legacy_uid` column on a
`catalog.scenarios` enrichment table, a `scenarios.yaml`, `resolveScenario` in `translate.js`,
and switch the `apis.js` joins to the resolvers. CMS untouched, avoid untouched, orphan scenarios
degrade gracefully. *But*: grows the curation layer `CLAUDE.md` says to shrink, and the 10-row
mapping becomes a thing to maintain.

Still outstanding, independent of A/B:

- `apis.js:126` should go through `resolveIndicator` rather than compare raw ids — worth doing
  together with re-deriving `indicators.yaml`, since neither helps alone.
- `apis.js:134` should name the uid it failed to match, and log once with a count. Now that the
  scenario re-key has taken the noise from 11 lines per page load to 1, this is cosmetic.
- The 4 remaining `en-EU` presets and 15 CMS scenario variants stay dark until ixmp4 serves the
  overshoot / net-zero / extended runs. Content decision if that is not planned.
- `Today` needs a CMS description, or explicit suppression from the selector.
- If the nearest-analogue city→case-study suggestion is wanted back (141 cities lost it), it needs
  a home: a catalog column or a CMS field listing the cities each case study covers. Its values
  are already `geoId`s, so no new id space is introduced either way.

## Reproducing

```bash
npm run db:cms:pull                      # remote Strapi -> local Postgres `strapi`
docker compose up -d api                 # catalog adapter on :8080 behind nginx
docker compose exec -T api bun -e "console.log(await (await fetch('http://localhost:8080/api/catalog')).text())"
psql -h localhost -U rodrigo -d provide -At -c "SELECT DISTINCT uid FROM strapi.scenarios ORDER BY 1"
psql -h localhost -U rodrigo -d provide -At -c "SELECT DISTINCT uid FROM strapi.indicators ORDER BY 1"
```

Pull provenance: remote `data.db` 3.3 MB, transfer archive 129 KB, local backup written to
`cms/dumps/local-strapi-backup-20260727-111620.sql` (1.3 MB). Post-import counts —
scenarios 35 (25 distinct uids × 2 locales), indicators 59, presets 18, glossaries 24,
files 111, case studies 5 — identical to the pre-pull local state, i.e. the remote CMS has not
changed since the previous pull.
