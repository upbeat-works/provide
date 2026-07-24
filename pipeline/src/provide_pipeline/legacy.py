"""Legacy-API parity: fetch reference outputs and compare against ours.

The legacy PROVIDE API (``provide-api[-staging].climateanalytics.org``) serves
the *outputs* of the old pipeline — per-country, per-year anomaly slices with
the ensemble already collapsed.  Useless as pipeline *input*, but it is exactly
the reference we must reproduce before switching production over (README,
"Intentional deviations", #3)::

    # pull legacy impact-geo slices for the parity countries
    provide-pipeline fetch-legacy --out ./legacy \\
        --geographies DEU IND --scenarios CurPol --years 2030 2050

    # compare one legacy slice against our impact-geo JSON
    provide-pipeline compare-legacy --legacy ./legacy/..._DEU_..._2030.nc \\
        --modern ./out/impact_geo_CurPol_mean-temperature_None_pre-industrial.json \\
        --geography DEU --year 2030

Naming notes (from the legacy ``metadata.py``): the public indicator uids match
ours (``mean-temperature``/``hot-extreme``/``cold-extreme``); the API's
``indicator`` param carries a sector prefix (terrestrial climate ->
``terclim-``); scenario uids are lowercased (``CurPol`` -> ``curpol``).
"""

from __future__ import annotations

import os
import urllib.parse
import urllib.request

import numpy as np

STAGING_BASE_URL = "https://provide-api-staging.climateanalytics.org/api"
SECTOR_PREFIX = "terclim"  # terrestrial-climate; all three tas indicators


def legacy_indicator(indicator: str) -> str:
    """Modern indicator uid -> legacy API ``indicator`` param."""
    return f"{SECTOR_PREFIX}-{indicator}"


def legacy_scenario(scenario: str) -> str:
    """Modern scenario name -> legacy API ``scenario`` param (uid)."""
    return scenario.lower().replace("_", "-")


def impact_geo_url(
    *,
    geography: str,
    scenario: str,
    year: int,
    indicator: str = "mean-temperature",
    reference: str = "pre-industrial",
    frequency: float | None = None,
    base_url: str = STAGING_BASE_URL,
    fmt: str = "netcdf",
) -> str:
    """Build the legacy ``/impact-geo/`` request for one slice."""
    params = {
        "scenario": legacy_scenario(scenario),
        "indicator": legacy_indicator(indicator),
        "geography": geography,
        "year": year,
        "time": "annual",
        "frequency": "None" if frequency is None else frequency,
        "reference": reference,
        "spatial": "area",
        "format": fmt,
    }
    return f"{base_url}/impact-geo/?{urllib.parse.urlencode(params)}"


def slice_filename(geography: str, scenario: str, year: int, indicator: str, reference: str) -> str:
    """Local filename for one downloaded legacy slice."""
    return f"legacy_impact_geo_{scenario}_{geography}_{indicator}_{year}_{reference}.nc"


def fetch_impact_geo(
    out_dir: str,
    geographies: list[str],
    scenarios: list[str],
    years: list[int],
    indicator: str = "mean-temperature",
    reference: str = "pre-industrial",
    frequency: float | None = None,
    base_url: str = STAGING_BASE_URL,
    log=print,
) -> list[str]:
    """Download every requested slice.  Failures are reported, not fatal."""
    os.makedirs(out_dir, exist_ok=True)
    written: list[str] = []
    for scenario in scenarios:
        for geography in geographies:
            for year in years:
                url = impact_geo_url(geography=geography, scenario=scenario, year=year,
                                     indicator=indicator, reference=reference,
                                     frequency=frequency, base_url=base_url)
                path = os.path.join(out_dir, slice_filename(geography, scenario, year, indicator, reference))
                try:
                    with urllib.request.urlopen(url, timeout=60) as response:
                        payload = response.read()
                except Exception as exc:  # noqa: BLE001 - report and continue
                    log(f"FAILED {scenario}/{geography}/{year}: {exc}")
                    continue
                with open(path, "wb") as handle:
                    handle.write(payload)
                log(f"fetched {path} ({len(payload)} bytes)")
                written.append(path)
    return written


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------
def compare_impact_geo(legacy_nc_path: str, modern_document: dict, geography: str, year: int) -> dict:
    """Compare one legacy netCDF slice against our impact-geo JSON for a country.

    The two grids are cropped differently (legacy: bounding box; ours: covered
    cells only), so we align cells by exact lat/lon coordinate and compare only
    cells that are non-null in **both**.  Returns summary stats; raises
    ``ValueError`` when there is nothing to compare.
    """
    import xarray as xr

    ds = xr.open_dataset(legacy_nc_path)
    (var_name,) = list(ds.data_vars)  # single-variable slices
    legacy = ds[var_name]
    lat_dim = "latitude" if "latitude" in legacy.dims else "lat"
    lon_dim = "longitude" if "longitude" in legacy.dims else "lon"

    entry = modern_document["data"].get(geography)
    if not entry or not entry.get("lat"):
        raise ValueError(f"{geography} has no grid in the modern document")
    grid = entry["grids"].get(str(int(year)))
    if grid is None:
        raise ValueError(f"year {year} not in the modern document (has {list(entry['grids'])})")

    modern_values = np.asarray([[np.nan if v is None else v for v in row] for row in grid], dtype="float64")
    modern = xr.DataArray(
        modern_values,
        coords={lat_dim: entry["lat"], lon_dim: entry["lon"]},
        dims=(lat_dim, lon_dim),
    )

    # Exact-coordinate alignment: keeps only lat/lon values present in both.
    legacy_aligned, modern_aligned = xr.align(legacy, modern, join="inner")
    both = np.isfinite(legacy_aligned.values) & np.isfinite(modern_aligned.values)
    n_compared = int(both.sum())
    if n_compared == 0:
        raise ValueError(
            "no overlapping non-null cells — check that resolution and grid origin match "
            f"(legacy {legacy.sizes}, modern {modern.sizes})"
        )
    diff = np.abs(legacy_aligned.values[both] - modern_aligned.values[both])
    return {
        "geography": geography,
        "year": year,
        "n_compared": n_compared,
        "n_legacy_cells": int(np.isfinite(legacy.values).sum()),
        "n_modern_cells": int(np.isfinite(modern_values).sum()),
        "max_abs_diff": float(diff.max()),
        "mean_abs_diff": float(diff.mean()),
    }
