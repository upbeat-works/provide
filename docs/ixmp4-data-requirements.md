# ixmp4 Data Requirements

## Catalogue metadata

### `label`

ixmp4 variables already have a `name` field, but it's the uid (`terclim-mean-temperature`) — a slug, not a display string (`"Mean Temperature"`). To drop `label` from curation, uploaders need to either rename variables to human-readable form (and we accept the slug → human gap disappearing), or ixmp4 gains per-variable metadata so a separate display label can live there. Until then, the slug is the uid and the display label stays curated.

### `unit`

The frontend has a fixed registry of supported unit ids in [`src/lib/utils/formatting.js`](../src/lib/utils/formatting.js). ixmp4 instances must use one of these strings as the `unit` on uploaded timeseries to get the correct chart formatting — anything else falls back to a bare integer formatter with no suffix.

Supported unit ids:

- `degrees-celsius`
- `degrees-warming`
- `gigaton-co2eq-year`
- `degree`
- `percent`
- `percent-in-range`
- `integer`
- `currency`
- `float`
- `year`

### `tags`

Tag categories the UI needs:

| Category | Example values |
|---|---|
| `Sector` | `Agriculture`, `Energy`, `Health`, `Infrastructure`, `Forestry`, `Coastal Zones` |
| `Project` | `PROVIDE`, `SPARCCLE`, `Other` |
| `Data source` | TBD |
| `Spatial resolution` | `Global`, `Regional`, `National`, `Sub-national` |
| `Temporal resolution` | `Annual`, `Monthly`, `Daily`, `Seasonal` |

Example: for a run carrying "Mean Temperature" data, uploads attach `{key: "Sector", value: "Energy"}`, `{key: "Project", value: "PROVIDE"}`, `{key: "Spatial resolution", value: "National"}`, `{key: "Temporal resolution", value: "Annual"}`. The vocabulary has to be consistent across instances — otherwise the same indicator shows up under different tag labels depending on who uploaded it.

### `parameters`

When the user picks an indicator like "Mean Temperature", a few extra dropdowns appear next to it:

- **Time** — annual, or a season (`djf`, `mam`, `jja`, `son`)
- **Reference** — change since pre-industrial (`1850–1900`) or since today (`2011–2020`)
- **Spatial** — area-weighted average

Different indicators get different dropdowns: "Hot Extreme" adds a **Frequency** picker (1-in-10 vs 1-in-50 year events); "Days over X°C" adds an **Indicator value** picker (the threshold itself).

In ixmp4 each combination is its own variable:

- `terclim-mean-temperature|annual|pre-industrial|area`
- `terclim-mean-temperature|djf|pre-industrial|area`

That's fine *after* the user has picked something — the app builds the right variable name and fetches it. The problem is *before* anyone picks. The app needs to know "for Mean Temperature, which dropdowns do I render, and what does each one offer?" Reading that off variable names only works if every uploader writes the suffixes in the same slot order — and even then, the human label `"December, January, February"` for `djf` doesn't live in ixmp4 anywhere.

So today we keep two curated files:

- [`api/curation/indicators.json`](../api/curation/indicators.json) — per indicator: which dimensions apply, which values are valid for each.
- [`api/curation/indicator-parameters.ts`](../api/curation/indicator-parameters.ts) — per dimension: human-readable label for each option (`djf` → `"December, January, February"`).

## `/impact-time` (uncertainty bands)

### What the chart shows

Pick an indicator (Mean Temperature), a scenario (curpol), a geography (Germany), and you get a time series with a central line plus a shaded band around it. The data per year is three numbers — `[min, mean, max]` — from the 5th, 50th, and 95th percentiles of a model ensemble. So 2050 might be `[0.6, 1.7, 3.0]` °C: best case 0.6, central estimate 1.7, worst case 3.0.

### Percentile encoding

Each indicator gets three sibling variables uploaded to ixmp4: `terclim-mean-temperature|p05`, `terclim-mean-temperature|p50`, `terclim-mean-temperature|p95`. When the chart loads, the adapter fetches all three for the requested `(scenario, region)` and pairs them year by year into `[min, mean, max]` triples.

### Reference values

The chart description says things like "Mean Temperature in Germany rises from a baseline of 8.5°C". That `8.5°C` is one number per `(indicator, region)` — the pre-industrial baseline. It's the same number regardless of which scenario you're looking at; Germany's baseline doesn't change with emissions pathway.

Today the legacy API reads it from a separate file (`reference_values_terclim-mean-temperature.json`). ixmp4 has no equivalent.

Plan: create one dedicated "reference run" in ixmp4 — a run whose model and scenario are both set to something like `reference`. For each indicator, upload a sibling variable `terclim-mean-temperature|reference` to that run, with one datapoint per region. Because the values are scenario-independent, they live in this single run instead of being duplicated across every scenario.

Example: to fetch the baseline for Mean Temperature in Germany, the adapter queries the reference run for variable `terclim-mean-temperature|reference`, region `DEU`, and reads back `8.5`.

### Citations

The legacy response includes `model: "MESMER (Beusch et al., 2020, 2022)"` and `source: "Schwaab et al., in prep."` — strings shown in the chart footer. They're hardcoded in legacy Python per indicator family. Cheapest path: keep them as curation in the adapter (one entry per sector or per indicator). They're display strings, not data.

## `/unavoidable-risk` (probabilistic thresholds)

### What the chart shows

Same selection as `/impact-time` (indicator, scenario, geography), but the chart shows the probability of exceeding a set of thresholds over time. For Mean Temperature in Germany under curpol, you might see: by 2050 there's a 90% chance of exceeding +1.5°C, 60% of exceeding +2°C, 20% of exceeding +2.5°C. The response shape:

```json
{
  "thresholds": [1.5, 2.0, 2.5],
  "years": [2020, 2025, ...],
  "data": { "curpol": [[0.05, 0.01, 0], ..., [0.9, 0.6, 0.2]] },
  "today": [0.02, 0.01, 0]
}
```

Each `data[scenario][year]` is one row of probabilities, one number per threshold.

### Probability variables

For each indicator, upload one sibling variable per threshold:

- `terclim-mean-temperature|risk|threshold=1.5`
- `terclim-mean-temperature|risk|threshold=2.0`
- `terclim-mean-temperature|risk|threshold=2.5`
- …

Each variable's datapoints are probabilities (0–1) per year, indexed by `(scenario, region)` the same way regular indicator data is. The adapter fetches one time series per threshold for the requested `(scenario, region)` and stacks them into the matrix.

### Threshold registry

Different indicators use different threshold sets — Mean Temperature uses 0.5°C increments, biodiversity uses fractions like 0.1, 0.5, 0.9, etc. The adapter needs to know which thresholds belong to which indicator. Keep this as a small curated JSON (`api/curation/thresholds.json`) listing the threshold values and default per indicator.

### The `today` baseline

The response also includes a `today` array — the current observed probability of exceeding each threshold (not a model output, but an observed baseline). Upload a sibling variable `terclim-mean-temperature|risk|today` with one datapoint per threshold per region. The adapter fetches it once per chart and includes it in the response.

## Naming conventions

If every instance follows these, the adapter can stay thin and most catalogue curation becomes derivable.

- **Variable names**: pack the parameter dimensions into the variable name with `|` separators — `terclim-mean-temperature|annual|pre-industrial|area` is one variable, `terclim-mean-temperature|djf|pre-industrial|area` is a different one. Dimension values must come from the same vocabulary across all instances:
  - **Time** — `annual`, `djf`, `mam`, `jja`, `son`
  - **Reference** — `present-day`, `pre-industrial`
  - **Spatial** — `area`
  - **Frequency** — `0.1`, `0.05`, `0.02`
  - **Indicator value** — varies by indicator (threshold for `*overX` indicators, e.g. `20`, `25`, `28`, `295`, `31`, `35` for temperature; the catalogue's [`indicator-parameters.ts`](../api/curation/indicator-parameters.ts) lists the active set)
  
- **Units**: set `unit` on every timeseries to one of the supported ids.
- **Tags**: every run gets one run-level meta entry per supported tag category (`Sector`, `Project`, `Data source`, `Spatial resolution`, `Temporal resolution`), using the documented vocabulary.
- **Percentile bands**: store as three sibling variables `{indicator}|p05`, `{indicator}|p50`, `{indicator}|p95`.
- **Reference values**: store on a single dedicated reference run (model and scenario both set to `reference`), under sibling variable `{indicator}|reference`.
- **Risk thresholds**: one sibling variable per threshold, named `{indicator}|risk|threshold={value}` (probabilities 0–1).
- **Today baseline**: one sibling variable per indicator, named `{indicator}|risk|today`, one datapoint per threshold per region.
- **Region names**: match the geography ids used in the platform DB (`DEU`, `berlin`, …).
- **Scenario names**: ixmp4 scenario name equals the catalogue scenario uid (`curpol`, not `"Current Policies"`).

## Hardcoded configuration

- [`api/curation/indicators.json`](../api/curation/indicators.json) → `label` — display name per indicator. *Alternative:* uploaders use human-readable variable names, or ixmp4 adds variable-level metadata.
- [`api/curation/indicators.json`](../api/curation/indicators.json) → `sector` — sector grouping per indicator (the other tag categories don't exist in curation yet). *Alternative:* attach all tag categories (`Sector`, `Project`, …) to runs via ixmp4 run-level meta.
- [`api/curation/indicators.json`](../api/curation/indicators.json) → `parameters` — applicable dimensions and valid values per indicator. *Alternative:* fix a strict suffix slot order on variable names so the adapter can derive them, or drop per-indicator filtering and show "no data" instead.
- [`api/curation/indicator-parameters.ts`](../api/curation/indicator-parameters.ts) — human labels for parameter option values (`djf` → `"December, January, February"`). *Alternative:* none — ixmp4 has no display strings.
- `api/curation/thresholds.json` (new, doesn't exist yet) — threshold list and default per indicator. *Alternative:* none — ixmp4 has no native concept of "valid thresholds for this indicator".
- `api/curation/citations.ts` (new, doesn't exist yet) — `model` and `source` strings shown in chart footers. *Alternative:* upload as variable-level meta, requires variable-meta in ixmp4 core.
- [`src/lib/utils/formatting.js`](../src/lib/utils/formatting.js) → `unitLabels` — `°C` / `degrees Celsius` per unit id. *Alternative:* requires variable-level meta in ixmp4 core.
