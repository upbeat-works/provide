"""impact-time: national warming/extreme time series with an uncertainty band.

Legacy equivalent: ``provide/impact_time.py`` (``run_hu_mean_temperature`` /
``run_hu_hot_extreme`` / ``run_hu_cold_extreme``).

Output per country is a table of ``[lower, mean, upper]`` rows, one row per
forecast year (2020..2100 step 5), expressed as an anomaly relative to the
reference baseline.
"""

from __future__ import annotations

import numpy as np
import xarray as xr

from . import config, core
from .config import RunSpec
from .masks import Regions


# ---------------------------------------------------------------------------
# Uncertainty band around the extreme tail quantile (seeded bootstrap).
# ---------------------------------------------------------------------------
def _bootstrap_1d(sample: np.ndarray, q: float, n_boot: int, size: int, seed: int) -> np.ndarray:
    """Return ``[lower, median, upper]`` of the bootstrap distribution of the
    ``q`` quantile of ``sample``.  Deterministic for a given ``seed``.
    """
    sample = sample[np.isfinite(sample)]
    if sample.size == 0:
        return np.array([np.nan, np.nan, np.nan])
    rng = np.random.default_rng(seed)
    draws = rng.choice(sample, size=(n_boot, size), replace=True)
    stats = np.nanquantile(draws, q, axis=1)
    lo, hi = config.BOOTSTRAP_BAND
    return np.nanquantile(stats, [lo, 0.5, hi])


def _bootstrap_band(series: xr.DataArray, q: float) -> xr.DataArray:
    """Bootstrap CI of the tail quantile over the ensemble, per (region, year).

    ``series`` has dims ``(region, *ensemble, year)``.  We stack the ensemble
    into a single ``member`` dimension and apply the 1-D bootstrap, yielding a
    ``ci`` dimension of ``[lower, median, upper]``.
    """
    ens = config.present_ensemble_dims(series.dims)
    stacked = series.stack(member=ens).load()
    result = xr.apply_ufunc(
        _bootstrap_1d,
        stacked,
        kwargs=dict(q=q, n_boot=config.N_BOOTSTRAP, size=config.N_SAMPLESIZE, seed=config.BOOTSTRAP_SEED),
        input_core_dims=[["member"]],
        output_core_dims=[["ci"]],
        exclude_dims={"member"},
        vectorize=True,
    )
    return result.assign_coords(ci=["lower", "median", "upper"])


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def compute(cube: xr.Dataset, regions: Regions, weights: xr.DataArray, spec: RunSpec) -> dict:
    """Compute the impact-time product for one :class:`RunSpec`.

    Returns a JSON-ready ``dict`` (see ``README.md`` for the schema).
    """
    series = core.national_mean_series(cube, weights).load()
    years = config.FORECAST_YEARS_TIME

    if spec.indicator == "mean-temperature":
        lower, mean, upper = _mean_temperature(series, spec)
    else:  # hot-extreme / cold-extreme
        lower, mean, upper = _extreme(series, spec)

    lower, mean, upper = (core.select_years(a, years) for a in (lower, mean, upper))
    return _assemble(regions, lower, mean, upper, spec, years)


def _mean_temperature(series: xr.DataArray, spec: RunSpec):
    """Central = ensemble median; band = 10th/90th ensemble percentile."""
    baseline = core.collapse_ensemble(core.reference_window(series, spec.reference), "median").mean(config.YEAR)
    mean = core.collapse_ensemble(series, "median") - baseline
    lo_q, hi_q = config.ENSEMBLE_BAND
    lower = core.collapse_ensemble(series, "quantile", lo_q) - baseline
    upper = core.collapse_ensemble(series, "quantile", hi_q) - baseline
    return lower, mean, upper


def _extreme(series: xr.DataArray, spec: RunSpec):
    """Central = tail quantile; band = seeded bootstrap of that tail quantile.

    ``hot-extreme`` uses the ``1 - frequency`` quantile (upper tail);
    ``cold-extreme`` uses the ``frequency`` quantile (lower tail).
    """
    q = (1 - spec.frequency) if spec.indicator == "hot-extreme" else spec.frequency
    baseline = core.collapse_ensemble(core.reference_window(series, spec.reference), "quantile", q).median(config.YEAR)
    mean = core.collapse_ensemble(series, "quantile", q) - baseline
    band = _bootstrap_band(series, q) - baseline
    lower = band.sel(ci="lower").drop_vars("ci")
    upper = band.sel(ci="upper").drop_vars("ci")
    return lower, mean, upper


def _assemble(regions: Regions, lower, mean, upper, spec: RunSpec, years: list[int]) -> dict:
    """Stack the three series into per-country ``[lower, mean, upper]`` rows."""
    from .io import rows_to_native

    stacked = xr.concat([lower, mean, upper], dim="stat").transpose("region", config.YEAR, "stat")
    values = stacked.values  # (region, year, 3)
    data = {code: rows_to_native(values[i]) for i, code in enumerate(regions.codes)}
    return {
        "product": "impact-time",
        "indicator": spec.indicator,
        "scenario": spec.scenario,
        "reference": spec.reference,
        "frequency": spec.frequency,
        "years": list(np.asarray(mean[config.YEAR])),
        "columns": ["lower", "mean", "upper"],
        "units": "deg C (anomaly vs reference)",
        "data": data,
    }
