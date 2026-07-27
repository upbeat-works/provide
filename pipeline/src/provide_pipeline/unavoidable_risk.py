"""unavoidable-risk: probability that warming exceeds a set of thresholds.

Legacy equivalent: ``provide/unavoidable-risk.py``.

For each threshold ``T`` in {0.5, 1.0, 1.5, 2.0, 2.5, 3.0} deg C and each
forecast year, we report the fraction of the ensemble whose warming anomaly
exceeds ``T``.  The legacy code computed ``1 - percentileofscore(anom, T)/100``
per year; ``(anom > T).mean(ensemble)`` is the vectorised, identical-in-intent
form (strict ``>`` vs the legacy ``<=`` rank differ only at exact ties).
"""

from __future__ import annotations

import numpy as np
import xarray as xr

from . import config, core
from .config import RunSpec
from .masks import Regions


def compute(cube: xr.Dataset, regions: Regions, weights: xr.DataArray, spec: RunSpec) -> dict:
    """Compute the unavoidable-risk product for one :class:`RunSpec`.

    Only ``mean-temperature`` is meaningful here (warming thresholds), matching
    the legacy usage.
    """
    series = core.national_mean_series(cube, weights).load()

    # Baseline: ensemble median over the reference window, then averaged in time.
    baseline = core.collapse_ensemble(core.reference_window(series, spec.reference), "median").mean(config.YEAR)
    anomaly = series - baseline  # (region, *ensemble, year)

    years = [y for y in config.RISK_YEARS if y in set(np.asarray(series[config.YEAR]))]
    anomaly = anomaly.sel({config.YEAR: years})
    ens = config.present_ensemble_dims(anomaly.dims)

    # exceedance[threshold] -> (region, year) probability in [0, 1]
    probabilities = {
        t: (anomaly > t).mean(ens) if ens else (anomaly > t).astype(float)
        for t in config.RISK_THRESHOLDS
    }
    return _assemble(regions, probabilities, spec, years)


def _assemble(regions: Regions, probabilities: dict, spec: RunSpec, years: list[int]) -> dict:
    from .io import rows_to_native

    # Order thresholds; shape per region = (n_thresholds, n_years)
    thresholds = config.RISK_THRESHOLDS
    stacked = xr.concat([probabilities[t] for t in thresholds], dim="threshold").transpose(
        "region", "threshold", config.YEAR
    )
    values = stacked.values  # (region, threshold, year)
    scenario_key = spec.scenario.lower().replace("_", "-")
    data = {code: {scenario_key: rows_to_native(values[i])} for i, code in enumerate(regions.codes)}
    return {
        "product": "unavoidable-risk",
        "indicator": spec.indicator,
        "scenario": spec.scenario,
        "reference": spec.reference,
        "thresholds": thresholds,
        "years": years,
        "units": "probability [0, 1] that warming exceeds threshold",
        "data": data,
    }
