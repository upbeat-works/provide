"""Synthetic MESMER-like data.

The real MESMER netCDFs are large and not distributed with the repo, so this
module builds a *tiny* but structurally-faithful cube plus a couple of box
"countries".  It powers the test-suite and ``provide-pipeline demo`` so the
whole pipeline can run end-to-end with zero external data.
"""

from __future__ import annotations

import numpy as np
import xarray as xr

# Small, regular global grid (5 degree) -- big enough to contain the test boxes
# and to mask the real NaturalEarth countries bundled in ``data/``.
LAT = np.arange(-87.5, 88.0, 5.0)
LON = np.arange(-177.5, 178.0, 5.0)
YEARS = np.arange(1850, 2301, 5)

# A curated subset of years that still contains everything the products need
# (reference windows + all forecast years).  Used when writing the *bundled*
# synthetic cubes so the committed netCDFs stay small.
DEMO_YEARS = np.array(
    sorted(
        set(range(1850, 1901, 5))       # pre-industrial reference
        | {2015, 2020}                  # present-day reference
        | set(range(2020, 2101, 5))     # impact-time forecast
        | {2030, 2050, 2100, 2200, 2300}  # impact-geo / risk horizons
    )
)

# Per-scenario warming rate (deg C per year after 2000) -> distinct trajectories.
SCENARIO_WARMING = {"GS": 0.010, "CurPol": 0.035, "SP": 0.015}


def make_cube(scenario: str = "GS", *, n_cal: int = 2, n_scen: int = 2, n_run: int = 2, n_real: int = 2,
              seed: int = 0, years: np.ndarray | None = None) -> xr.Dataset:
    """Build a synthetic ``tas`` cube with the full MESMER dimension layout."""
    rng = np.random.default_rng(seed)
    rate = SCENARIO_WARMING.get(scenario, 0.02)
    years_arr = YEARS if years is None else np.asarray(years)

    # Deterministic climatology: warmer at the equator, plus a post-2000 trend.
    lat2d = LAT[:, None]
    base = 15.0 - 0.3 * np.abs(lat2d)                      # (lat, 1)
    trend = rate * np.clip(years_arr - 2000, 0, None)      # (year,)
    # climatology broadcast to (year, lat, lon)
    clim = base[None, :, :] + trend[:, None, None] + 0.0 * LON[None, None, :]
    clim = np.broadcast_to(clim, (len(years_arr), len(LAT), len(LON)))

    shape = (n_cal, n_scen, n_run, n_real, len(years_arr), len(LAT), len(LON))
    noise = rng.normal(0.0, 0.5, size=shape)
    tas = clim[None, None, None, None] + noise

    ds = xr.Dataset(
        {"tas": (("mesmer_esm_calibration", "fair_scenario", "run_id", "realisation", "year", "lat", "lon"), tas)},
        coords=dict(
            mesmer_esm_calibration=np.arange(n_cal),
            fair_scenario=np.arange(n_scen),
            run_id=np.arange(n_run),
            realisation=np.arange(n_real),
            year=years_arr,
            lat=LAT,
            lon=LON,
        ),
    )
    return ds


def save_cube(scenario: str, path: str, *, years: np.ndarray | None = DEMO_YEARS, **kwargs) -> str:
    """Write a compact, zlib-compressed synthetic cube for ``scenario`` to ``path``."""
    import os

    ds = make_cube(scenario, years=years, **kwargs)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    ds["tas"] = ds["tas"].astype("float32")
    ds.to_netcdf(path, engine="netcdf4", encoding={"tas": {"zlib": True, "complevel": 4}})
    return path


def make_geodataframe():
    """Two non-overlapping box 'countries' (``AAA`` near equator, ``BBB`` mid-lat)."""
    import geopandas as gpd
    from shapely.geometry import box

    rows = [
        {"ADM0_A3": "AAA", "geometry": box(-20, -10, 20, 10)},    # straddles equator
        {"ADM0_A3": "BBB", "geometry": box(40, 30, 70, 55)},      # mid-latitude
    ]
    return gpd.GeoDataFrame(rows, crs="EPSG:4326")


def geographies() -> list[str]:
    return ["AAA", "BBB"]
