"""Shared xarray reductions used by every product.

These are the small, well-understood building blocks that the legacy scripts
open-coded (and duplicated) in every ``run_hu_*`` function.
"""

from __future__ import annotations

import numpy as np
import xarray as xr

from . import config


def national_mean_series(cube: xr.Dataset, weights: xr.DataArray) -> xr.DataArray:
    """Area-weighted national mean time series for every region at once.

    Returns a DataArray with dims ``(region, *ensemble, year)`` -- the spatial
    dimensions are collapsed with the ``cos(lat) * coverage-fraction`` weights,
    then the stochastic ``realisation`` members are averaged out (matching the
    legacy ``.weighted(...).mean(("lon","lat")).mean("realisation")``).

    Because ``weights`` carries a ``region`` dimension, a single call produces
    all countries -- there is no per-country Python loop.
    """
    var = cube[config.VARIABLE]
    weighted = var.weighted(weights.fillna(0.0))
    series = weighted.mean((config.LAT, config.LON))
    if config.REALISATION_DIM in series.dims:
        series = series.mean(config.REALISATION_DIM)
    return series


def gridded_ensemble_median(cube: xr.Dataset) -> xr.DataArray:
    """Per-grid-cell ensemble median, dims ``(year, lat, lon)``.

    Used by the map product; realisation is averaged, then the ensemble is
    collapsed with a median.
    """
    var = cube[config.VARIABLE]
    if config.REALISATION_DIM in var.dims:
        var = var.mean(config.REALISATION_DIM)
    ens = config.present_ensemble_dims(var.dims)
    return var.median(ens) if ens else var


def reference_window(series: xr.DataArray, reference: str) -> xr.DataArray:
    """Slice ``series`` to the reference (baseline) year window."""
    start, end = config.REFERENCE_PERIODS[reference]
    return series.sel({config.YEAR: slice(start, end)})


def collapse_ensemble(series: xr.DataArray, how: str, q: float | None = None) -> xr.DataArray:
    """Collapse the ensemble dimensions with a median or a quantile.

    ``how`` is ``"median"`` or ``"quantile"`` (the latter requires ``q``).
    The transient ``quantile`` scalar coord is dropped for a clean result.
    """
    ens = config.present_ensemble_dims(series.dims)
    if not ens:
        return series
    if how == "median":
        return series.median(ens)
    if how == "quantile":
        if q is None:
            raise ValueError("quantile collapse requires q")
        return series.quantile(q, dim=ens).drop_vars("quantile", errors="ignore")
    raise ValueError(f"unknown collapse {how!r}")


def select_years(series: xr.DataArray, years: list[int]) -> xr.DataArray:
    """Select the subset of ``years`` that are actually present, in order."""
    present = [y for y in years if y in set(np.asarray(series[config.YEAR]))]
    return series.sel({config.YEAR: present})
