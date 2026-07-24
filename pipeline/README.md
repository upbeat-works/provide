# PROVIDE modern pipeline

A small, vectorised reimplementation of the legacy `provide/` offline scripts
(`impact_time.py`, `impact_geo.py`, `unavoidable-risk.py`, `tools.py`) using
**modern xarray + regionmask**. It turns MESMER climate-emulator netCDFs into
the JSON products the PROVIDE dashboard consumes.

The legacy code hand-rolled country masking (upsample ×10 → rasterise →
coarsen), looped over 174 countries in Python, and duplicated the same
load→mask→reduce→write scaffolding in every function. This package replaces all
of that with a handful of composable xarray reductions and a single
[`regionmask.mask_3D_frac_approx`](https://regionmask.readthedocs.io/en/stable/notebooks/method_mask_3D_frac_approx.html)
call — the exact same "fraction of each grid cell inside the country" algorithm,
but computed for every country at once.

---

## Products

| Product | What it is | Legacy script |
|---|---|---|
| `impact-time` | Per-country warming/extreme **time series** (2020–2100, 5-yr steps) with an uncertainty band | `impact_time.py` |
| `impact-geo` | Per-country gridded **change maps** for 2030 / 2050 / 2100 | `impact_geo.py` |
| `unavoidable-risk` | Per-country probability that warming **exceeds** 0.5–3.0 °C thresholds | `unavoidable-risk.py` |

All three support the indicators `mean-temperature`, `hot-extreme`,
`cold-extreme` (extremes take a `frequency`, e.g. `0.1` = hottest/coldest 10 %).

---

## Install & run

```bash
cd pipeline
pip install -e '.[dev]'          # or open in the devcontainer (see below)

# 1) Run every product on in-memory synthetic data — nothing on disk needed:
provide-pipeline demo --out ./out

# 2) Run from the BUNDLED data files (real country polygons + a synthetic cube):
provide-pipeline run impact-time \
    --data-dir data/mesmer --scenario GS \
    --shapefile data/countries.geojson --geographies data/geographies.csv \
    --indicator mean-temperature --reference pre-industrial --out ./out

# 3) Point at real MESMER cubes when you have them (same flags, different --data-dir):
provide-pipeline run impact-time \
    --data-dir ../data_in/MESMER --scenario GS \
    --shapefile data/countries.geojson --geographies data/geographies.csv \
    --indicator mean-temperature --reference pre-industrial --out ../data_out
```

## New dataset? The four-step workflow

When new netCDFs arrive, the whole conversion is: **validate → run-all → check
→ publish**. No flags to remember beyond one manifest file — copy
[`manifest.example.yaml`](manifest.example.yaml) next to your data and adjust
the paths (it runs on the bundled synthetic data as committed, so you can try
the workflow right now).

```bash
# 1) Does the new data satisfy the pipeline's input contract?
#    (variable/dim names, equally-spaced grid, reference + forecast years, …)
#    Errors are phrased so you can fix the export, not read the source.
provide-pipeline validate --data-dir ../data_in/MESMER \
    --shapefile data/countries.geojson --geographies data/geographies.csv

# 2) Run every scenario × product × indicator the manifest describes.
#    (run-all re-validates inputs first; the region mask is built once per
#    scenario and reused across all its products.)
provide-pipeline run-all --manifest manifest.yaml          # add --dry-run to preview

# 3) Sanity-gate the outputs: strict JSON, shapes, bands ordered, probabilities
#    in [0,1] and monotonic in threshold, grids matching lat × lon.
provide-pipeline check ../data_out

# 4) Copy to the dashboard's data dir (or a mounted bucket). Refuses to publish
#    if step 3 fails; writes a published.json index (sha256 + sizes) so a
#    partial upload is detectable.
provide-pipeline publish --src ../data_out --dest /srv/dashboard-data
```

Green from `check` means *schema-valid and scientifically plausible* — the
one-time parity validation against legacy outputs (deviation #3 below) still
applies when switching datasets or code versions.

Programmatic use:

```python
from provide_pipeline import Session, RunSpec, session_from_files

session = session_from_files("../data_in/MESMER", "GS",
                             ".../ne_10m_admin_0_countries_deu_CA.shp",
                             "../data_in/list_countries_pixel_stat.csv")
doc = session.impact_time(RunSpec("mean-temperature", "GS"))
# build the mask once, reuse across many scenarios/indicators
```

---

## Inputs

Everything needed to run is **bundled in [`data/`](data/)** — the pipeline is
self-contained out of the box:

| Input | Bundled file | Notes |
|---|---|---|
| Country polygons | [`data/countries.geojson`](data/countries.geojson) (0.75 MB) | The 174 needed countries, slimmed to `ADM0_A3` + simplified geometry from NaturalEarth 10m. |
| Geography list | [`data/geographies.csv`](data/geographies.csv) | The original `list_countries_pixel_stat.csv` (a `country` column of ISO-A3 codes). |
| MESMER cube | [`data/mesmer/GS.nc`](data/mesmer/), `CurPol.nc`, `SP.nc` (~1 MB each) | **Synthetic** stand-ins with the full MESMER layout `tas(mesmer_esm_calibration, fair_scenario, run_id, realisation, year, lat, lon)` on a global 5° grid. |

The synthetic cubes let the whole thing run without the large, non-public real
MESMER data. Regenerate them any time with:

```bash
provide-pipeline make-synthetic --out data/mesmer
```

To run on **real** data, drop the real MESMER netCDFs into a directory and pass
`--data-dir` at it. Requirements: a single variable `tas`, the dimension names
above, and an **equally-spaced** lat/lon grid (required by
`mask_3D_frac_approx`). Small countries may be all-`null` on the coarse 5° demo
grid — that is expected; real MESMER grids are finer.

---

## Output JSON schemas

Outputs are **self-describing** (the legacy files were bare
`{country: [...]}` with the year mapping hard-coded in the Flask API). Filenames
match the legacy pattern, e.g. `impact_time_GS_mean-temperature_None_pre-industrial.json`.

### `impact-time`
```jsonc
{
  "product": "impact-time",
  "indicator": "mean-temperature",
  "scenario": "GS",
  "reference": "pre-industrial",
  "frequency": null,
  "years":   [2020, 2025, …, 2100],
  "columns": ["lower", "mean", "upper"],
  "units":   "deg C (anomaly vs reference)",
  "data": {
    "DEU": [[0.02, 0.11, 0.20], …],   // one [lower, mean, upper] row per year
    "IND": [ … ]
  }
}
```

### `unavoidable-risk`
```jsonc
{
  "product": "unavoidable-risk",
  "thresholds": [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
  "years": [2020, 2030, 2050, 2100],
  "data": {
    "DEU": { "gs": [ [p@0.5 …per year], [p@1.0 …], … [p@3.0 …] ] }   // one row per threshold
  }
}
```

### `impact-geo`
```jsonc
{
  "product": "impact-geo",
  "years": [2030, 2050, 2100],
  "data": {
    "DEU": {
      "lat":  [ … ],                 // cropped to the country's covered cells
      "lon":  [ … ],
      "grids": { "2030": [[…]], "2050": [[…]], "2100": [[…]] }   // lat × lon anomaly
    }
  }
}
```

All non-finite values are serialised as `null` (valid JSON).

---

## How this maps onto the legacy code

| Legacy (`provide/…`) | Here |
|---|---|
| `tools.py` `rasterize` / `transform_from_latlon` / `add_shape_coord_from_data_array` / `calc_pixel_percentage_mask` + upsample/coarsen | `masks.region_fraction` → `regionmask.mask_3D_frac_approx` |
| `for geography in geographies:` (174×, re-mask each pass) | vectorised over the `region` dimension — no loop |
| `reindex(np.arange(min, max+2.5, 2.5))` "make regular" | `masks.ensure_regular` — **verifies** regularity, sorts; doesn't blindly resample |
| `.weighted(weights*ppm).mean(("lon","lat")).mean("realisation")` | `core.national_mean_series` (unchanged idiom) |
| reference subtraction + `median`/`quantile` over ensemble | `core.collapse_ensemble` |
| `Bootstrap.*` nested Python loops | `impact_time._bootstrap_band` via `xr.apply_ufunc`, **seeded** |
| `1 - percentileofscore(anom, T)/100` | `(anom > T).mean(ensemble)` |
| manual `DataFrame` → `dict` → `json.dump` | `io.write_json` (+ NaN→null) |

### Intentional deviations from the legacy behaviour

These are documented, not accidental — flag them if bit-for-bit legacy parity is required:

1. **Seeded bootstrap.** The extreme-band bootstrap uses a fixed seed
   (`config.BOOTSTRAP_SEED`), so outputs are reproducible and testable. The
   legacy code used an unseeded `np.random.choice`, so its numbers varied
   run-to-run.
2. **`impact-geo` uses a mask crop, not a bbox crop.** Legacy cropped each map
   to the country's bounding box (and the `ppm` weighting there was a no-op,
   since only `realisation` was reduced). We clip to the cells the polygon
   actually covers (`fraction > 0`) — same intent, tighter maps.
3. **Approximation tolerance.** `mask_3D_frac_approx` is accurate to ~5 % and
   requires an equally-spaced grid. Validate a couple of countries (e.g. DEU,
   IND) against existing `data_out` JSONs before switching production over.
4. **Fixed `reference_period` bug.** The legacy `if/if/else` let
   `"pre-industrial"` fall through to `else: pass`; here the reference windows
   live in `config.REFERENCE_PERIODS` and are selected explicitly.

---

## Docker (deploying alongside the app)

The pipeline ships as a batch-job image in this repo's Docker setup — it runs
on dataset drops and exits; it is **not** a service and never needs to be "up":

```bash
docker build -f docker/Dockerfile.pipeline -t provide-pipeline .   # from repo root
docker run --rm -v /path/to/data:/data provide-pipeline \
    run-all --manifest /data/manifest.yaml
docker run --rm -v /path/to/data:/data provide-pipeline \
    publish --src /data/out --dest /data/published
```

Once the compose stack lands on main (PR #63), wire it in as a profiled
one-off job so `docker compose up` never starts it:

```yaml
  pipeline:
    profiles: ['pipeline']
    build:
      context: .
      dockerfile: docker/Dockerfile.pipeline
    volumes:
      - ${PIPELINE_DATA_DIR:-./pipeline/data}:/data
# then: docker compose run --rm pipeline run-all --manifest /data/manifest.yaml
```

CI runs the test suite and builds this image on every PR touching
`pipeline/**` (`.github/workflows/pipeline.yml`).

---

## Devcontainer

`.devcontainer/` provides a **slim** environment: `python:3.12-slim` + pip.
The scientific stack installs from manylinux wheels (bundled GEOS/PROJ/GDAL/HDF5),
so no system geo libraries or C compiler are needed. Open the `modern/` folder in
VS Code → "Reopen in Container"; `postCreateCommand` runs `pip install -e '.[dev]'`.

---

## Tests

```bash
pytest            # runs entirely on synthetic data — no MESMER files required
```

Coverage: masking/weighting correctness (`test_masks.py`), each product's schema
+ scientific sanity (band ordering, anomaly≈0 at baseline, risk monotonic in
threshold, hotter scenario ⇒ more warming/risk), JSON validity, the CLI demo,
the input contract (`test_validate.py`), and the full
validate → run-all → check → publish workflow (`test_workflow_cli.py`).
